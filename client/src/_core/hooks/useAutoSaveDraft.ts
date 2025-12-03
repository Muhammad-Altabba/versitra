import { useEffect, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";

interface UseAutoSaveDraftOptions {
  bookId: string;
  sectionId: string;
  content: string;
  enabled: boolean;
  debounceMs?: number;
}

/**
 * Hook for auto-saving draft translations with debouncing
 * Saves drafts every 30 seconds (default) when content changes
 */
export function useAutoSaveDraft({
  bookId,
  sectionId,
  content,
  enabled,
  debounceMs = 30000, // 30 seconds default
}: UseAutoSaveDraftOptions) {
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<string>(content);
  const saveDraftMutation = trpc.books.saveDraft.useMutation();

  const saveDraft = useCallback(async () => {
    // Only save if content has changed
    if (content === lastSavedContentRef.current) {
      return;
    }

    try {
      await saveDraftMutation.mutateAsync({
        bookId,
        sectionId,
        source: "",
        translated: content,
      });
      lastSavedContentRef.current = content;
    } catch (error) {
      console.error("Failed to auto-save draft:", error);
    }
  }, [bookId, sectionId, content, saveDraftMutation]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer
    debounceTimerRef.current = setTimeout(() => {
      saveDraft();
    }, debounceMs);

    // Cleanup on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [content, enabled, debounceMs, saveDraft]);

  return {
    isSaving: saveDraftMutation.isPending,
    error: saveDraftMutation.error,
    lastSaved: lastSavedContentRef.current === content ? new Date() : null,
  };
}
