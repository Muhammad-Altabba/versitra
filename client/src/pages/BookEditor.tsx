import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { APP_TITLE } from "@/const";
import { DraftIndicator } from "@/components/DraftIndicator";
import { SaveDraftButton } from "@/components/SaveDraftButton";
import { CommitVersionButton } from "@/components/CommitVersionButton";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  BookOpen,
  ArrowLeft,
  Upload,
  Download,
  Sparkles,
  Loader2,
  FileText,
  GitBranch,
  Eye,
  GitCommit,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
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
  const [lastSavedTime, setLastSavedTime] = useState<Date | undefined>();
  const lastSavedRef = useRef<Date | undefined>(undefined);

  const { data: book } = trpc.books.get.useQuery(
    { bookId: bookId || "" },
    { enabled: !!bookId && isAuthenticated }
  );

  const { data: gitInfo } = trpc.git.getUserInfo.useQuery(undefined, {
    enabled: isAuthenticated,
  });

  // Load all section drafts for this book
  const { data: allDrafts } = trpc.books.getAllSectionDrafts.useQuery(
    { bookId: bookId || '' },
    { enabled: !!bookId && isAuthenticated }
  );

  // Note: Removed verification mode that was loading from Git unnecessarily
  // Database cache is now the source of truth for section status

  // Load sections from cache on mount
  useEffect(() => {
    if (allDrafts) {
      console.log('[BookEditor] Cached data loaded:', {
        hasSections: !!allDrafts.sections,
        sectionsCount: allDrafts.sections?.length || 0,
        hasMetadata: !!allDrafts.sectionsMetadata,
      });
      
      if (allDrafts.sections && allDrafts.sections.length > 0) {
        // Sections exist in cache - load them
        console.log('[BookEditor] Loading cached sections:', allDrafts.sections.length);
        setSections(allDrafts.sections);
        setShowSectionsList(true); // FIX: Show the sections list!
        console.log('[BookEditor] Sections list visibility set to true');
      } else {
        console.log('[BookEditor] No cached sections found');
      }
      setIsLoadingProgress(false);
    }
  }, [allDrafts]);

  // Helper function to split document
  const handleSplitDocument = async (content: string) => {
    if (!book || !bookId) {
      console.warn('[BookEditor] Cannot split document: missing book or bookId');
      return;
    }
    
    console.log('[BookEditor] Starting document split:', {
      bookId,
      contentLength: content.length,
      sourceLanguage: book.sourceLanguage,
      targetLanguage: book.targetLanguage,
    });
    
    try {
      const result = await splitDocumentMutation.mutateAsync({
        bookId,
        content,
        sourceLanguage: book.sourceLanguage || "en",
        targetLanguage: book.targetLanguage || "es",
      });

      console.log('[BookEditor] Document split successful:', {
        sectionsCount: result.length,
        sectionIds: result.map((s: any) => s.id),
      });
      
      setSections(result);
      setCurrentSectionIndex(0);
      setShowSectionsList(true);
      console.log('[BookEditor] Sections state updated and list shown');
    } catch (error) {
      console.error('[BookEditor] Failed to split document:', error);
      toast.error('Failed to split document');
    }
  };

  // Load existing translation when section changes (lazy load from Git)
  useEffect(() => {
    const loadSectionTranslation = async () => {
      if (sections.length > 0 && sections[currentSectionIndex] && book && gitInfo) {
        const sectionId = sections[currentSectionIndex].id;
        
        // Check if already loaded in memory
        if (translationProgress[sectionId]) {
          console.log(`[BookEditor] Using cached translation for ${sectionId}`);
          setTranslatedContent(translationProgress[sectionId]);
          return;
        }
        
        // First, check if there's a draft in the database
        const draftContent = allDrafts?.sectionDrafts?.[sectionId];
        if (draftContent) {
          console.log(`[BookEditor] Loading draft from database for ${sectionId}`);
          setTranslatedContent(draftContent);
          setTranslationProgress(prev => ({
            ...prev,
            [sectionId]: draftContent,
          }));
          return;
        }
        
        // Check metadata to see if translation is committed to Git
        const metadata = (allDrafts?.sectionsMetadata as Record<string, any>)?.[sectionId];
        if (!metadata || !metadata.translated) {
          // Not translated yet
          console.log(`[BookEditor] Section ${sectionId} not translated yet`);
          setTranslatedContent('');
          return;
        }
        
        // Translation is committed to Git - load from Git
        console.log(`[BookEditor] Loading translation for ${sectionId} from Git`);
        try {
          const content = await utils.git.getFile.fetch({
            owner: gitInfo.username,
            repo: book.repoName.split('/').pop() || '',
            path: `translated/${sectionId}.md`,
            branch: 'main',
          });
          
          if (content) {
            setTranslatedContent(content.content);
            // Cache it in memory
            setTranslationProgress(prev => ({
              ...prev,
              [sectionId]: content.content,
            }));
          } else {
            console.warn(`[BookEditor] Metadata says translated but file not found: ${sectionId}`);
            setTranslatedContent('');
          }
        } catch (error) {
          console.error(`[BookEditor] Failed to load translation for ${sectionId}:`, error);
          setTranslatedContent('');
        }
      }
    };
    
    loadSectionTranslation();
  }, [currentSectionIndex, sections, book, gitInfo, allDrafts]);

  const splitDocumentMutation = trpc.translation.splitDocument.useMutation();
  const uploadPDFMutation = trpc.translation.uploadPDF.useMutation();
  const generateDraftMutation = trpc.translation.generateDraft.useMutation();
  const utils = trpc.useUtils();
  const commitFileMutation = trpc.git.commitFile.useMutation();
  const exportPDFMutation = trpc.export.bookToPDF.useMutation();
  const saveSectionDraftMutation = trpc.books.saveSectionDraft.useMutation();
  const commitVersionMutation = trpc.books.commitVersion.useMutation();

  const handleProcessPDF = async () => {
    if (!pdfFile || !book) return;

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;
        const base64 = base64Data.split(',')[1];

        console.log('[BookEditor] Uploading PDF with bookId:', bookId);
        const result = await uploadPDFMutation.mutateAsync({
          bookId: bookId,
          base64Data: base64,
          sourceLanguage: book.sourceLanguage || "en",
          targetLanguage: book.targetLanguage || "es",
        });
        console.log('[BookEditor] PDF processed and saved:', {
          sectionsCount: result.sections.length,
          hasOriginalText: !!result.originalText,
          hasMarkdown: !!result.markdown,
        });

        setSourceContent(result.markdown);
        setSections(result.sections);
        setCurrentSectionIndex(0);
        setShowSectionsList(true);
        
        // Refresh cached data from database
        
        toast.success(`PDF processed and saved! Found ${result.sections.length} sections`);
        console.log('[BookEditor] Sections list shown and cache invalidated');
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

      // Auto-save the AI draft
      try {
        const section = sections[currentSectionIndex];
        const sectionId = section?.id || "section";
        
        // Validate that we have the translated content
        if (!draft.translated || draft.translated.trim() === '') {
          console.error('[BookEditor] AI draft is empty, cannot save');
          toast.error("AI draft is empty, cannot save");
          return;
        }
        
        // Validate bookId
        if (!bookId) {
          console.error('[BookEditor] bookId is missing');
          toast.error("Cannot save: book ID is missing");
          return;
        }
        
        console.log('[BookEditor] Auto-saving AI draft for section:', { sectionId, translatedLength: draft.translated.length, bookId });
        console.log('[BookEditor] About to call saveDraftMutation with:', {
          bookId,
          sectionId,
          sourceLength: (section?.content || '').length,
          translatedLength: draft.translated.length,
        });
        
        // Call the save mutation and wait for it to complete
        try {
          const saveResult = await saveSectionDraftMutation.mutateAsync({
            bookId: bookId,
            sectionId,
            source: section?.content || '',
            translated: draft.translated,
          });

          console.log('[BookEditor] ✅ Save mutation returned successfully:', saveResult);
        } catch (mutationError: any) {
          console.error('[BookEditor] ❌ Mutation threw error:', {
            error: mutationError,
            message: mutationError?.message,
            code: mutationError?.code,
            data: mutationError?.data,
          });
          throw mutationError;
        }

      // Refresh drafts list to ensure UI is in sync
      console.log('[BookEditor] Invalidating drafts cache...');
      await utils.books.getAllSectionDrafts.invalidate({ bookId });
        
        // Update last saved time
        const now = new Date();
        setLastSavedTime(now);
        lastSavedRef.current = now;

        console.log('[BookEditor] ✓ AI draft auto-saved successfully');
        toast.success("AI draft auto-saved to database");
      } catch (saveError: any) {
        console.error('[BookEditor] ✗ Failed to auto-save AI draft:', {
          error: saveError,
          message: saveError?.message,
          code: saveError?.code,
        });
        toast.error(`AI draft generated but save failed: ${saveError?.message || 'Unknown error'}`);
      }
    } catch (error) {
      toast.error("Failed to generate draft");
      console.error(error);
    }
  };

  const handleCreateVersion = async (title: string, description?: string) => {
    try {
      console.log("[BookEditor] Creating version:", title);
      
      const result = await commitVersionMutation.mutateAsync({
        bookId: bookId || "",
        versionTitle: title,
        versionDescription: description,
      });

      toast.success(`Version created! Committed ${result.committedCount} sections`);
      
      // Refresh drafts list (should be empty now)
      await utils.books.getAllSectionDrafts.invalidate({ bookId });
      
      console.log("[BookEditor] Version created successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to create version");
      console.error("[BookEditor] Failed to create version:", error);
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

  const handleSaveTranslation = async () => {
    if (!translatedContent || !book) return;

    try {
      const section = sections[currentSectionIndex];
      const sectionId = section?.id || "section";

      console.log('[BookEditor] Saving draft for section:', sectionId);
      
      // Save as draft to local DB (no Git commit)
      await saveSectionDraftMutation.mutateAsync({
        bookId: bookId || "",
        sectionId,
        source: section?.content || '',
        translated: translatedContent,
      });

      // Update local progress
      setTranslationProgress(prev => ({
        ...prev,
        [section?.id || 'section']: translatedContent,
      }));

      // Refresh drafts list
      await utils.books.getAllSectionDrafts.invalidate({ bookId });
      
      // Update last saved time
      const now = new Date();
      setLastSavedTime(now);
      lastSavedRef.current = now;

      console.log('[BookEditor] Draft saved successfully');

      toast.success("Draft saved locally");

      // Keep the translated content - do NOT clear it
      // User should manually clear or navigate to next section
      // NOTE: Do NOT auto-navigate to next section - user should manually navigate
    } catch (error) {
      toast.error("Failed to save translation");
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
              <CommitVersionButton
                draftCount={allDrafts ? Object.keys(allDrafts).length : 0}
                onCommit={handleCreateVersion}
                variant="default"
                size="sm"
              />
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
        {!allDrafts ? (
          <Card>
            <CardContent className="flex items-center justify-center py-16">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">Loading translation sections...</p>
              </div>
            </CardContent>
          </Card>
        ) : showSectionsList && sections.length > 0 ? (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Translation Sections</CardTitle>
                <CardDescription>
                  {(() => {
                    const metadata = allDrafts?.sectionsMetadata || {};
                    const translatedCount = Object.values(metadata).filter((m: any) => m.translated).length;
                    return `${translatedCount} of ${sections.length} sections translated (${Math.round((translatedCount / sections.length) * 100)}%)`;
                  })()}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {sections.map((section, index) => {
                    const metadata = (allDrafts?.sectionsMetadata as Record<string, any>) || {};
                    const isTranslated = metadata[section.id]?.translated || false;
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
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      {Object.keys(translationProgress).length} of {sections.length} translated ({Math.round((Object.keys(translationProgress).length / sections.length) * 100)}%)
                    </span>
                    <DraftIndicator
                      hasDraft={!!allDrafts && Object.keys(allDrafts).length > 0}
                      lastSaved={lastSavedRef.current}
                    />
                  </div>
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
                    <SaveDraftButton
                      onClick={handleSaveTranslation}
                      disabled={saveSectionDraftMutation.isPending}
                      hasChanges={!!translatedContent}
                      size="sm"
                    />
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

