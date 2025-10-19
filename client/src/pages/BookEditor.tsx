import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { APP_TITLE } from "@/const";
import {
  BookOpen,
  ArrowLeft,
  Upload,
  Download,
  Sparkles,
  Save,
  Loader2,
  FileText,
  GitBranch,
  Eye,
} from "lucide-react";
import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";

export default function BookEditor() {
  const { bookId } = useParams<{ bookId: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const [sourceContent, setSourceContent] = useState("");
  const [translatedContent, setTranslatedContent] = useState("");
  const [sections, setSections] = useState<any[]>([]);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);

  const { data: book } = trpc.books.get.useQuery(
    { id: bookId || "" },
    { enabled: !!bookId && isAuthenticated }
  );

  const { data: gitInfo } = trpc.git.getUserInfo.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  const splitDocumentMutation = trpc.translation.splitDocument.useMutation();
  const generateDraftMutation = trpc.translation.generateDraft.useMutation();
  const commitFileMutation = trpc.git.commitFile.useMutation();
  const exportPDFMutation = trpc.export.bookToPDF.useMutation();

  const handleUploadSource = async () => {
    if (!sourceContent || !book) return;

    try {
      // Split document into sections
      const result = await splitDocumentMutation.mutateAsync({
        content: sourceContent,
        sourceLanguage: book.sourceLanguage || "en",
        targetLanguage: book.targetLanguage || "es",
      });

      setSections(result);
      setCurrentSectionIndex(0);
      toast.success(`Document split into ${result.length} sections`);
    } catch (error) {
      toast.error("Failed to split document");
      console.error(error);
    }
  };

  const handleGenerateDraft = async () => {
    if (!sections[currentSectionIndex] || !book) return;

    try {
      const draft = await generateDraftMutation.mutateAsync({
        section: sections[currentSectionIndex],
        sourceLanguage: book.sourceLanguage || "en",
        targetLanguage: book.targetLanguage || "es",
      });

      setTranslatedContent(draft.translated);
      toast.success("AI draft generated");
    } catch (error) {
      toast.error("Failed to generate draft");
      console.error(error);
    }
  };

  const handleSaveTranslation = async () => {
    if (!translatedContent || !book || !gitInfo) return;

    try {
      const section = sections[currentSectionIndex];
      const path = `translated/${section?.id || "section"}.md`;

      await commitFileMutation.mutateAsync({
        owner: gitInfo.username,
        repo: book.repoName.split("/").pop() || book.repoName,
        path,
        content: translatedContent,
        message: `translate/${section?.id || "section"}`,
      });

      toast.success("Translation saved to Git");

      // Move to next section
      if (currentSectionIndex < sections.length - 1) {
        setCurrentSectionIndex(currentSectionIndex + 1);
        setTranslatedContent("");
      }
    } catch (error) {
      toast.error("Failed to save translation");
      console.error(error);
    }
  };

  const handleExportPDF = async () => {
    if (!book) return;

    try {
      const result = await exportPDFMutation.mutateAsync({
        bookId: book.id,
        sections: sections.map((s) => ({
          title: s.id,
          content: translatedContent || s.content,
        })),
      });

      // Download PDF
      const blob = new Blob([Buffer.from(result.pdf, "base64")], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("PDF exported successfully");
    } catch (error) {
      toast.error("Failed to export PDF");
      console.error(error);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Please login to edit books</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => setLocation("/dashboard")}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div className="flex items-center gap-2">
                <BookOpen className="h-6 w-6 text-primary" />
                <div>
                  <h1 className="text-lg font-bold">{book?.title || book?.repoName}</h1>
                  <p className="text-sm text-muted-foreground">
                    {book?.sourceLanguage} → {book?.targetLanguage}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation(`/diff/${bookId}`)}
              >
                <Eye className="h-4 w-4 mr-2" />
                View Diffs
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                disabled={exportPDFMutation.isPending || sections.length === 0}
              >
                {exportPDFMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Export PDF
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {sections.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Upload Source Document</CardTitle>
              <CardDescription>
                Paste your source Markdown content to begin translation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Paste your Markdown content here..."
                value={sourceContent}
                onChange={(e) => setSourceContent(e.target.value)}
                className="min-h-[400px] font-mono"
              />
              <Button
                onClick={handleUploadSource}
                disabled={!sourceContent || splitDocumentMutation.isPending}
                className="w-full"
              >
                {splitDocumentMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Split Document & Start Translation
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Progress */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    Section {currentSectionIndex + 1} of {sections.length}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {Math.round(((currentSectionIndex + 1) / sections.length) * 100)}% complete
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{
                      width: `${((currentSectionIndex + 1) / sections.length) * 100}%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Side-by-Side Editor */}
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Source */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Source ({book?.sourceLanguage})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-gray-50 rounded-lg border min-h-[400px] font-mono text-sm whitespace-pre-wrap">
                    {sections[currentSectionIndex]?.content}
                  </div>
                </CardContent>
              </Card>

              {/* Translation */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Translation ({book?.targetLanguage})
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleGenerateDraft}
                      disabled={generateDraftMutation.isPending}
                    >
                      {generateDraftMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      AI Draft
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveTranslation}
                      disabled={!translatedContent || commitFileMutation.isPending}
                    >
                      {commitFileMutation.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Save & Next
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={translatedContent}
                    onChange={(e) => setTranslatedContent(e.target.value)}
                    placeholder="Enter your translation here or generate an AI draft..."
                    className="min-h-[400px] font-mono"
                  />
                </CardContent>
              </Card>
            </div>

            {/* Navigation */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <Button
                    variant="outline"
                    onClick={() => setCurrentSectionIndex(Math.max(0, currentSectionIndex - 1))}
                    disabled={currentSectionIndex === 0}
                  >
                    Previous Section
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Section {currentSectionIndex + 1}: {sections[currentSectionIndex]?.type}
                  </span>
                  <Button
                    variant="outline"
                    onClick={() =>
                      setCurrentSectionIndex(Math.min(sections.length - 1, currentSectionIndex + 1))
                    }
                    disabled={currentSectionIndex === sections.length - 1}
                  >
                    Next Section
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

