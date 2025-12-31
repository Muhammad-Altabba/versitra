/**
 * Version control service for committing translations to Git
 */

import { getAllSectionDrafts } from '../db/sections';

export interface ReconstructedDocument {
  content: string;
  sectionCount: number;
  sectionIds: string[];
}

/**
 * Reconstruct full translated document from section drafts
 * Sections are concatenated in order with proper spacing
 */
export async function reconstructDocument(bookId: string): Promise<ReconstructedDocument> {
  console.log('[VersionService.reconstructDocument] Reconstructing document for book:', bookId);
  
  // Fetch all section drafts
  const draftsData = await getAllSectionDrafts(bookId);
  
  if (!draftsData || !draftsData.sections || draftsData.sections.length === 0) {
    throw new Error('No sections found for book');
  }
  
  const { sections, sectionDrafts } = draftsData;
  
  // Filter sections that have drafts
  const sectionsWithDrafts = sections.filter(section => {
    const hasDraft = sectionDrafts[section.id] && sectionDrafts[section.id].trim().length > 0;
    return hasDraft;
  });
  
  if (sectionsWithDrafts.length === 0) {
    throw new Error('No translated sections found. Please translate at least one section before creating a version.');
  }
  
  console.log(`[VersionService.reconstructDocument] Found ${sectionsWithDrafts.length}/${sections.length} sections with drafts`);
  
  // Reconstruct document by concatenating sections
  const contentParts: string[] = [];
  const sectionIds: string[] = [];
  
  for (const section of sectionsWithDrafts) {
    const draft = sectionDrafts[section.id];
    if (draft && draft.trim()) {
      contentParts.push(draft);
      sectionIds.push(section.id);
    }
  }
  
  // Join sections with double newline for proper spacing
  const content = contentParts.join('\n\n');
  
  console.log(`[VersionService.reconstructDocument] Reconstructed document:`, {
    totalLength: content.length,
    sectionCount: sectionIds.length,
    preview: content.substring(0, 100) + '...',
  });
  
  return {
    content,
    sectionCount: sectionIds.length,
    sectionIds,
  };
}

/**
 * Generate commit message for version
 */
export function generateCommitMessage(
  versionTitle: string,
  versionDescription: string | undefined,
  sectionCount: number
): string {
  let message = `${versionTitle}\n\n`;
  
  if (versionDescription) {
    message += `${versionDescription}\n\n`;
  }
  
  message += `Translated ${sectionCount} section${sectionCount === 1 ? '' : 's'}`;
  
  return message;
}

/**
 * Get translation file path in repository
 * Format: translations/{targetLanguage}/{bookTitle}.md
 */
export function getTranslationFilePath(
  targetLanguage: string,
  bookTitle: string
): string {
  // Sanitize book title for filename
  const sanitized = bookTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  return `translations/${targetLanguage}/${sanitized}.md`;
}
