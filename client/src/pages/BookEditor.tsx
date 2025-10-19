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
import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { toast } from "sonner";
import MDEditor from '@uiw/react-md-editor';

export default function BookEditor() {
  const { bookId } = useParams<{ bookId: string }>();
  const [, setLocation] = useLocation();
  const { isAuthenticated } = useAuth();
  const [sourceContent, setSourceContent] = useState("");
  const [translatedContent, setTranslatedContent] = useState("");
  const [sections, setSections] = useState<any[]>([]);
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
  const [uploadMode, setUploadMode] = useState<'text' | 'pdf'>('text');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [translationProgress, setTranslationProgress] = useState<Record<string, string>>({});
  const [isLoadingProgress, setIsLoadingProgress] = useState(true);
  const [showSectionsList, setShowSectionsList] = useState(false);

  const { data: book } = trpc.books.get.useQuery(
    { id: bookId || "" },
    { enabled: !!bookId && isAuthenticated }
  );

  const { data: gitInfo } = trpc.git.getUserInfo.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Load translation progress from Git
  const { data: progress } = trpc.git.loadTranslationProgress.useQuery(
    {
      owner: gitInfo?.username || '',
      repo: book?.repoName.split('/').pop() || '',
    },
    {
      enabled: !!book && !!gitInfo && isAuthenticated,
    }
  );

  // Process loaded progress
  useEffect(() => {
    if (progress) {
      if (progress.hasProgress) {
        setTranslationProgress(progress.translations);
        if (progress.sourceContent && !sourceContent) {
          setSourceContent(progress.sourceContent);
          // Auto-split the loaded source content
          handleSplitDocument(progress.sourceContent);
          // Show sections list if there's progress
          setShowSectionsList(true);
        }
      }
      setIsLoadingProgress(false);
    }
  }, [progress]);

  // Helper function to split document
  const handleSplitDocument = async (content: string) => {
    if (!book) return;
    
    try {
      const result = await splitDocumentMutation.mutateAsync({
        content,
        sourceLanguage: book.sourceLanguage || "en",
        targetLanguage: book.targetLanguage || "es",
      });

      setSections(result);
      setCurrentSectionIndex(0);
    } catch (error) {
      console.error('Failed to split document:', error);
    }
  };

  // Load existing translation when section changes
  useEffect(() => {
    if (sections.length > 0 && sections[currentSectionIndex]) {
      const sectionId = sections[currentSectionIndex].id;
      if (translationProgress[sectionId]) {
        setTranslatedContent(translationProgress[sectionId]);
      } else {
        setTranslatedContent('');
      }
    }
  }, [currentSectionIndex, sections, translationProgress]);

  const splitDocumentMutation = trpc.translation.splitDocument.useMutation();
  const uploadPDFMutation = trpc.translation.uploadPDF.useMutation();
  const generateDraftMutation = trpc.translation.generateDraft.useMutation();
  const commitFileMutation = trpc.git.commitFile.useMutation();
  const exportPDFMutation = trpc.export.bookToPDF.useMutation();

  const handleProcessPDF = async () => {
    if (!pdfFile || !book) return;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;
        const base64 = base64Data.split(',')[1];

        const result = await uploadPDFMutation.mutateAsync({
          base64Data: base64,
          sourceLanguage: book.sourceLanguage || "en",
          targetLanguage: book.targetLanguage || "es",
        });

        setSourceContent(result.markdown);
        setSections(result.sections);
        setCurrentSectionIndex(0);
        toast.success(`PDF processed! Found ${result.sections.length} sections`);
      };
      reader.readAsDataURL(pdfFile);
    } catch (error) {
      toast.error("Failed to process PDF");
      console.error(error);
    }
  };

  const handleUploadSource = async () => {
    if (!sourceContent || !book) return;

    try {
      await handleSplitDocument(sourceContent);
      toast.success(`Document split into sections`);
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
      const sectionId = section?.id || "section";
      const repoName = book.repoName.split("/").pop() || book.repoName;

      // Save source content first
      const sourcePath = `source/${sectionId}.md`;
      await commitFileMutation.mutateAsync({
        owner: gitInfo.username,
        repo: repoName,
        path: sourcePath,
        content: section?.content || '',
        message: `source/${sectionId}`,
      });

      // Save translation
      const translatedPath = `translated/${sectionId}.md`;
      await commitFileMutation.mutateAsync({
        owner: gitInfo.username,
        repo: repoName,
        path: translatedPath,
        content: translatedContent,
        message: `translate/${sectionId}`,
      });

      // Update local progress
      setTranslationProgress(prev => ({
        ...prev,
        [section?.id || 'section']: translatedContent,
      }));

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
        {showSectionsList && sections.length > 0 ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Translation Sections</CardTitle>
                <CardDescription>
                  {Object.keys(translationProgress).length} of {sections.length} sections translated
                  ({Math.round((Object.keys(translationProgress).length / sections.length) * 100)}%)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {sections.map((section, index) => {
                    const isTranslated = !!translationProgress[section.id];
                    return (
                      <button
                        key={section.id}
                        onClick={() => {
                          setCurrentSectionIndex(index);
                          setShowSectionsList(false);
                        }}
                        className="w-full text-left p-4 rounded-lg border hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">Section {index + 1}</span>
                              {isTranslated ? (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Translated</span>
                              ) : (
                                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">Not translated</span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                              {section.content.substring(0, 100)}...
                            </p>
                          </div>
                          <ArrowLeft className="h-4 w-4 rotate-180 text-muted-foreground" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : sections.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Upload Source Document</CardTitle>
              <CardDescription>
                Choose how to upload your source content
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Button
                  variant={uploadMode === 'text' ? 'default' : 'outline'}
                  onClick={() => setUploadMode('text')}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Paste Text
                </Button>
                <Button
                  variant={uploadMode === 'pdf' ? 'default' : 'outline'}
                  onClick={() => setUploadMode('pdf')}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload PDF
                </Button>
              </div>

              {uploadMode === 'text' ? (
                <>
                  <div data-color-mode="light">
                    <MDEditor
                      value={sourceContent}
                      onChange={(val) => setSourceContent(val || '')}
                      height={400}
                      preview="edit"
                    />
                  </div>
                  <Button
                    onClick={handleUploadSource}
                    disabled={!sourceContent || splitDocumentMutation.isPending}
                    className="w-full"
                  >
                    {splitDocumentMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 mr-2" />
                    )}
                    Split Document & Start Translation
                  </Button>
                </>
              ) : (
                <>
                  <div>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setPdfFile(file);
                      }}
                      className="block w-full text-sm text-muted-foreground
                        file:mr-4 file:py-2 file:px-4
                        file:rounded-md file:border-0
                        file:text-sm file:font-semibold
                        file:bg-primary file:text-primary-foreground
                        hover:file:bg-primary/90"
                    />
                    {pdfFile && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Selected: {pdfFile.name}
                      </p>
                    )}
                  </div>
                  <Button
                    onClick={handleProcessPDF}
                    disabled={!pdfFile || uploadPDFMutation.isPending}
                    className="w-full"
                  >
                    {uploadPDFMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    Process PDF & Start Translation
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Back to sections list button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSectionsList(true)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Sections List
            </Button>
            
            {/* Progress */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">
                    Section {currentSectionIndex + 1} of {sections.length}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {Object.keys(translationProgress).length} of {sections.length} translated ({Math.round((Object.keys(translationProgress).length / sections.length) * 100)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{
                      width: `${(Object.keys(translationProgress).length / sections.length) * 100}%`,
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
                  <div data-color-mode="light">
                    <MDEditor
                      value={translatedContent}
                      onChange={(val) => setTranslatedContent(val || '')}
                      height={400}
                      preview="edit"
                    />
                  </div>
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

