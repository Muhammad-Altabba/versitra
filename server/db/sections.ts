import { eq } from "drizzle-orm";
import { sectionData, InsertSectionData, books } from "../../drizzle/schema";
import { getDb, makeSectionDataId } from "./shared";

/**
 * Section metadata interface
 */
export interface SectionMetadata {
  translated: boolean;
  translationStatus: 'not_translated' | 'draft' | 'committed';
  hasDraft: boolean;
  draftLastModified?: Date | null;
  lastModified?: Date | null;
}

/**
 * Section interface
 */
export interface Section {
  id: string;
  content: string;
  startLine: number;
  endLine: number;
  type: 'paragraph' | 'heading' | 'code' | 'list';
}

/**
 * Result interface for getAllSectionDrafts
 */
export interface AllSectionDraftsResult {
  sections: Section[];
  sectionsMetadata: Record<string, SectionMetadata>;
  sectionDrafts: Record<string, string>;
}

/**
 * Save sections to sectionData table with smart merging to preserve existing translations
 * This replaces the old updateBookSections which stored sections in books.sections
 * 
 * IMPORTANT: This function preserves existing draft and committed translations when re-splitting.
 * Only the originalContent, startLine, endLine, and sectionType are updated for existing sections.
 */
export async function saveSectionsToDatabase(
  bookId: string,
  sections: Array<{ id: string; content: string; startLine: number; endLine: number; type?: 'paragraph' | 'heading' | 'code' | 'list' }>
): Promise<void> {
  console.log('[Database.saveSectionsToDatabase] Saving sections for book:', {
    bookId,
    sectionsCount: sections.length,
    sectionIds: sections.map(s => s.id).slice(0, 5),
  });
  
  const db = await getDb();
  if (!db) {
    console.warn('[Database.saveSectionsToDatabase] Cannot save sections: database not available');
    return;
  }

  try {
    // Get existing section data to preserve translations
    const existingSections = await db
      .select()
      .from(sectionData)
      .where(eq(sectionData.bookId, bookId));
    
    const existingMap = new Map<string, typeof existingSections[0]>();
    for (const existing of existingSections) {
      existingMap.set(existing.sectionId, existing);
    }
    
    console.log('[Database.saveSectionsToDatabase] Found', existingSections.length, 'existing sections');
    
    // Track which sections are in the new split
    const newSectionIds = new Set(sections.map(s => s.id));
    
    // Update or insert each section
    for (const section of sections) {
      const sectionDataId = makeSectionDataId(bookId, section.id);
      const existing = existingMap.get(section.id);
      
      if (existing) {
        // Section exists - UPDATE only source content, preserve translations
        console.log('[Database.saveSectionsToDatabase] Updating existing section:', section.id);
        await db
          .update(sectionData)
          .set({
            originalContent: section.content,
            startLine: section.startLine.toString(),
            endLine: section.endLine.toString(),
            sectionType: section.type || 'paragraph',
            lastModified: new Date(),
            // Explicitly preserve: draftTranslation, draftSource, committedTranslation, committedAt, translationStatus
          })
          .where(eq(sectionData.id, sectionDataId));
      } else {
        // New section - INSERT
        console.log('[Database.saveSectionsToDatabase] Inserting new section:', section.id);
        await db.insert(sectionData).values({
          id: sectionDataId,
          bookId,
          sectionId: section.id,
          originalContent: section.content,
          startLine: section.startLine.toString(),
          endLine: section.endLine.toString(),
          sectionType: section.type || 'paragraph',
          translationStatus: 'not_translated',
          createdAt: new Date(),
        });
      }
    }
    
    // Delete sections that no longer exist in the new split
    const sectionsToDelete = existingSections.filter(s => !newSectionIds.has(s.sectionId));
    if (sectionsToDelete.length > 0) {
      console.log('[Database.saveSectionsToDatabase] Deleting', sectionsToDelete.length, 'removed sections:', 
        sectionsToDelete.map(s => s.sectionId));
      for (const section of sectionsToDelete) {
        await db.delete(sectionData).where(eq(sectionData.id, section.id));
      }
    }
    
    // Update book's lastModified timestamp
    await db.update(books)
      .set({ lastModified: new Date() })
      .where(eq(books.id, bookId));
    
    console.log('[Database.saveSectionsToDatabase] ✅ Sections saved successfully (preserved existing translations)');
  } catch (error) {
    console.error('[Database.saveSectionsToDatabase] Error saving sections:', error);
    throw error;
  }
}

/**
 * @deprecated Use saveSectionsToDatabase instead
 */
export async function updateBookSections(
  id: string,
  sections: Array<{ id: string; content: string; startLine: number; endLine: number; type?: 'paragraph' | 'heading' | 'code' | 'list' }>
): Promise<void> {
  console.warn('[Database.updateBookSections] DEPRECATED: Use saveSectionsToDatabase instead');
  return saveSectionsToDatabase(id, sections);
}

/**
 * Save draft translation for a section using the new sectionData table
 */
export async function saveSectionDraft(
  bookId: string,
  sectionId: string,
  source: string,
  translated: string
): Promise<void> {
  console.log('[Database.saveSectionDraft] Saving draft for section:', { bookId, sectionId, translatedLength: translated.length });
  
  const db = await getDb();
  if (!db) {
    console.error('[Database.saveSectionDraft] Database not available');
    throw new Error('Database not available');
  }

  try {
    const sectionDataId = makeSectionDataId(bookId, sectionId);
    
    // Check if section data already exists
    const existingData = await db
      .select()
      .from(sectionData)
      .where(eq(sectionData.id, sectionDataId))
      .limit(1);

    if (existingData.length > 0) {
      // Update existing section data
      console.log('[Database.saveSectionDraft] Updating existing section data');
      await db
        .update(sectionData)
        .set({
          draftTranslation: translated,
          draftSource: source,
          translationStatus: 'draft',
          draftLastModified: new Date(),
          lastModified: new Date(),
        })
        .where(eq(sectionData.id, sectionDataId));
    } else {
      // This should never happen if sections are properly initialized via saveSectionsToDatabase
      console.error('[Database.saveSectionDraft] WARNING: Creating section data without metadata!', {
        bookId,
        sectionId,
        message: 'This indicates sections were not properly initialized. Please re-split the document first.',
      });
      throw new Error(
        `Section data not found for ${sectionId}. Please re-split the document from the Dashboard before translating.`
      );
    }

    // Also update the book's lastModified timestamp to mark it as recently edited
    await db
      .update(books)
      .set({ lastModified: new Date() })
      .where(eq(books.id, bookId));

    console.log('[Database.saveSectionDraft] ✅ Section draft saved successfully');
  } catch (error) {
    console.error('[Database.saveSectionDraft] Error saving draft:', error);
    throw error;
  }
}

/**
 * Get draft for a specific section
 */
export async function getSectionDraft(bookId: string, sectionId: string): Promise<{
  sectionId: string;
  source: string;
  translated: string;
  status: 'not_translated' | 'draft' | 'committed';
  lastModified: Date | null;
} | null> {
  console.log('[Database.getSectionDraft] Fetching draft for section:', { bookId, sectionId });
  
  const db = await getDb();
  if (!db) {
    console.warn('[Database.getSectionDraft] Database not available');
    return null;
  }

  try {
    const sectionDataId = makeSectionDataId(bookId, sectionId);
    const result = await db
      .select()
      .from(sectionData)
      .where(eq(sectionData.id, sectionDataId))
      .limit(1);

    if (result.length === 0) {
      console.log('[Database.getSectionDraft] No draft found for section');
      return null;
    }

    const data = result[0];
    console.log('[Database.getSectionDraft] ✅ Draft found, translationStatus:', data.translationStatus);
    
    return {
      sectionId: data.sectionId,
      source: data.draftSource || data.originalContent,
      translated: data.draftTranslation || '',
      status: data.translationStatus,
      lastModified: data.draftLastModified || data.lastModified,
    };
  } catch (error) {
    console.error('[Database.getSectionDraft] Error fetching draft:', error);
    return null;
  }
}

/**
 * Get all drafts for a book - returns book with cached sections and draft metadata
 */
export async function getAllSectionDrafts(bookId: string): Promise<AllSectionDraftsResult> {
  console.log('[Database.getAllSectionDrafts] Fetching all drafts for book:', bookId);
  
  const db = await getDb();
  if (!db) {
    console.warn('[Database.getAllSectionDrafts] Database not available');
    return { sections: [], sectionsMetadata: {}, sectionDrafts: {} };
  }

  try {
    // Get the book with cached sections
    const bookResult = await db
      .select()
      .from(books)
      .where(eq(books.id, bookId))
      .limit(1);
    
    if (bookResult.length === 0) {
      console.log('[Database.getAllSectionDrafts] Book not found');
      return { sections: [], sectionsMetadata: {}, sectionDrafts: {} };
    }
    
    const book = bookResult[0];
    
    // Get all section data from sectionData table (source of truth)
    const sectionDataResults = await db
      .select()
      .from(sectionData)
      .where(eq(sectionData.bookId, bookId));

    console.log('[Database.getAllSectionDrafts] ✅ Found', sectionDataResults.length, 'sections in sectionData table');
    
    // Reconstruct sections list from sectionData table
    const sections: Section[] = sectionDataResults.map(data => ({
      id: data.sectionId,
      content: data.originalContent,
      startLine: parseInt(data.startLine),
      endLine: parseInt(data.endLine),
      type: (data.sectionType as 'paragraph' | 'heading' | 'code' | 'list') || 'paragraph',
    }));
    
    // Build metadata map and draft content map
    const sectionsMetadata: Record<string, SectionMetadata> = {};
    const sectionDrafts: Record<string, string> = {};
    
    // Create a map of section data by sectionId for quick lookup
    const sectionDataMap: Record<string, typeof sectionDataResults[0]> = {};
    for (const data of sectionDataResults) {
      sectionDataMap[data.sectionId] = data;
    }
    
    // Build metadata for ALL sections in the book
    for (const section of sections) {
      const data = sectionDataMap[section.id];
      
      if (data) {
        // Section has draft data
        sectionsMetadata[section.id] = {
          translated: data.translationStatus === 'committed',
          translationStatus: data.translationStatus,
          hasDraft: data.draftTranslation !== null && data.draftTranslation !== undefined,
          draftLastModified: data.draftLastModified,
          lastModified: data.draftLastModified || data.lastModified,
        };
        
        // Include draft content if it exists (including empty strings)
        if (data.draftTranslation !== null && data.draftTranslation !== undefined) {
          sectionDrafts[section.id] = data.draftTranslation;
        }
      } else {
        // Section has no draft data yet
        sectionsMetadata[section.id] = {
          translated: false,
          translationStatus: 'not_translated',
          hasDraft: false,
          draftLastModified: undefined,
          lastModified: undefined,
        };
      }
    }
    
    return {
      sections,
      sectionsMetadata,
      sectionDrafts,
    };
  } catch (error) {
    console.error('[Database.getAllSectionDrafts] Error fetching drafts:', error);
    return { sections: [], sectionsMetadata: {}, sectionDrafts: {} };
  }
}

/**
 * Update section commit status after successful Git commit
 */
export async function updateSectionCommitStatus(
  bookId: string,
  sectionId: string,
  committedContent: string,
  committedAt: Date
): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn('[Database.updateSectionCommitStatus] Database not available');
    return;
  }

  const dataId = makeSectionDataId(bookId, sectionId);

  try {
    await db
      .update(sectionData)
      .set({
        committedTranslation: committedContent,
        committedAt: committedAt,
        translationStatus: 'committed',
        lastModified: committedAt,
      })
      .where(eq(sectionData.id, dataId));

    console.log(`[Database.updateSectionCommitStatus] Updated commit status for ${dataId}`);
  } catch (error) {
    console.error('[Database.updateSectionCommitStatus] Error:', error);
    throw error;
  }
}

/**
 * Get section translation status
 */
export async function getSectionStatus(bookId: string, sectionId: string): Promise<'not_translated' | 'draft' | 'committed'> {
  console.log('[Database.getSectionStatus] Fetching status for section:', { bookId, sectionId });
  
  const db = await getDb();
  if (!db) {
    console.warn('[Database.getSectionStatus] Database not available');
    return 'not_translated';
  }

  try {
    const sectionDataId = makeSectionDataId(bookId, sectionId);
    const result = await db
      .select()
      .from(sectionData)
      .where(eq(sectionData.id, sectionDataId))
      .limit(1);

    if (result.length === 0) {
      return 'not_translated';
    }

    return result[0].translationStatus;
  } catch (error) {
    console.error('[Database.getSectionStatus] Error fetching status:', error);
    return 'not_translated';
  }
}
