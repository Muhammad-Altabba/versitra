import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';
import { books, sectionData } from '../../drizzle/schema';
import {
  saveSectionsToDatabase,
  getAllSectionDrafts,
  saveSectionDraft,
} from '../../server/db/sections';

/**
 * End-to-end tests for section splitting and translation workflow
 * Tests the complete flow including re-splitting with existing translations
 */
describe('Section Split & Translation E2E', () => {
  let db: ReturnType<typeof drizzle>;
  let testBookId: string;
  let testUserId: string;

  beforeEach(async () => {
    const uniqueSuffix = Math.random().toString(36).substr(2, 8);
    testBookId = 'split-book-' + uniqueSuffix;
    testUserId = 'split-user-' + uniqueSuffix;

    if (process.env.DATABASE_URL) {
      db = drizzle(process.env.DATABASE_URL);

      // Clean up
      try {
        await db.delete(sectionData).where(eq(sectionData.bookId, testBookId));
        await db.delete(books).where(eq(books.id, testBookId));
      } catch (error) {
        // Ignore cleanup errors
      }

      // Create test book
      await db.insert(books).values({
        id: testBookId,
        userId: testUserId,
        repoName: 'test-split-repo',
        repoUrl: 'https://github.com/test/split-repo',
        gitProvider: 'github',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        title: 'Test Split Book',
        createdAt: new Date(),
        lastModified: new Date(),
      });
    }
  });

  afterEach(async () => {
    if (db) {
      try {
        await db.delete(sectionData).where(eq(sectionData.bookId, testBookId));
        await db.delete(books).where(eq(books.id, testBookId));
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Initial Document Split', () => {
    it('should create section data for all sections', async () => {
      const sections = [
        {
          id: 'intro',
          content: 'Introduction paragraph',
          startLine: 0,
          endLine: 5,
          type: 'paragraph' as const,
        },
        {
          id: 'chapter1',
          content: 'Chapter 1 content',
          startLine: 6,
          endLine: 15,
          type: 'paragraph' as const,
        },
      ];

      await saveSectionsToDatabase(testBookId, sections);

      const result = await db
        .select()
        .from(sectionData)
        .where(eq(sectionData.bookId, testBookId));

      expect(result).toHaveLength(2);
      
      // Find sections by ID (order not guaranteed)
      const introSection = result.find(r => r.sectionId === 'intro');
      const chapter1Section = result.find(r => r.sectionId === 'chapter1');
      
      expect(introSection).toBeDefined();
      expect(introSection?.originalContent).toBe('Introduction paragraph');
      expect(chapter1Section).toBeDefined();
      expect(chapter1Section?.originalContent).toBe('Chapter 1 content');
    });

    it('should initialize sections with not_translated status', async () => {
      const sections = [
        {
          id: 'sec1',
          content: 'Content 1',
          startLine: 0,
          endLine: 5,
          type: 'paragraph' as const,
        },
      ];

      await saveSectionsToDatabase(testBookId, sections);

      const result = await db
        .select()
        .from(sectionData)
        .where(eq(sectionData.bookId, testBookId))
        .limit(1);

      expect(result[0].translationStatus).toBe('not_translated');
      expect(result[0].draftTranslation).toBeNull();
      expect(result[0].committedTranslation).toBeNull();
    });
  });

  describe('Re-Split Preserves Translations', () => {
    it('should preserve draft translations when re-splitting document', async () => {
      // Initial split
      const initialSections = [
        {
          id: 'section1',
          content: 'Original content 1',
          startLine: 0,
          endLine: 10,
          type: 'paragraph' as const,
        },
        {
          id: 'section2',
          content: 'Original content 2',
          startLine: 11,
          endLine: 20,
          type: 'paragraph' as const,
        },
      ];

      await saveSectionsToDatabase(testBookId, initialSections);

      // Add translations
      await saveSectionDraft(testBookId, 'section1', 'Original content 1', 'Traducción 1');
      await saveSectionDraft(testBookId, 'section2', 'Original content 2', 'Traducción 2');

      // Re-split with updated content (same sections, different content)
      const updatedSections = [
        {
          id: 'section1',
          content: 'Updated content 1',
          startLine: 0,
          endLine: 10,
          type: 'paragraph' as const,
        },
        {
          id: 'section2',
          content: 'Updated content 2',
          startLine: 11,
          endLine: 20,
          type: 'paragraph' as const,
        },
      ];

      await saveSectionsToDatabase(testBookId, updatedSections);

      // Verify translations are preserved
      const result = await getAllSectionDrafts(testBookId);

      expect(result.sectionDrafts['section1']).toBe('Traducción 1');
      expect(result.sectionDrafts['section2']).toBe('Traducción 2');

      // Verify source content is updated
      const dbResult = await db
        .select()
        .from(sectionData)
        .where(eq(sectionData.bookId, testBookId));

      expect(dbResult[0].originalContent).toBe('Updated content 1');
      expect(dbResult[1].originalContent).toBe('Updated content 2');
    });

    it('should preserve committed translations when re-splitting', async () => {
      // Initial split
      const sections = [
        {
          id: 'committed-sec',
          content: 'Original content',
          startLine: 0,
          endLine: 10,
          type: 'paragraph' as const,
        },
      ];

      await saveSectionsToDatabase(testBookId, sections);

      // Add and commit translation
      await db
        .update(sectionData)
        .set({
          draftTranslation: 'Traducción borrador',
          committedTranslation: 'Traducción confirmada',
          translationStatus: 'committed',
          lastCommitted: new Date(),
        })
        .where(eq(sectionData.id, `${testBookId}::committed-sec`));

      // Re-split with updated content
      const updatedSections = [
        {
          id: 'committed-sec',
          content: 'Updated content',
          startLine: 0,
          endLine: 10,
          type: 'paragraph' as const,
        },
      ];

      await saveSectionsToDatabase(testBookId, updatedSections);

      // Verify committed translation is preserved
      const result = await db
        .select()
        .from(sectionData)
        .where(eq(sectionData.id, `${testBookId}::committed-sec`))
        .limit(1);

      expect(result[0].committedTranslation).toBe('Traducción confirmada');
      expect(result[0].draftTranslation).toBe('Traducción borrador');
      expect(result[0].translationStatus).toBe('committed');
      expect(result[0].originalContent).toBe('Updated content');
    });

    it('should handle added sections during re-split', async () => {
      // Initial split with 2 sections
      const initialSections = [
        {
          id: 'sec1',
          content: 'Content 1',
          startLine: 0,
          endLine: 10,
          type: 'paragraph' as const,
        },
        {
          id: 'sec2',
          content: 'Content 2',
          startLine: 11,
          endLine: 20,
          type: 'paragraph' as const,
        },
      ];

      await saveSectionsToDatabase(testBookId, initialSections);
      await saveSectionDraft(testBookId, 'sec1', 'Content 1', 'Traducción 1');

      // Re-split with 3 sections (added sec3)
      const updatedSections = [
        {
          id: 'sec1',
          content: 'Content 1',
          startLine: 0,
          endLine: 10,
          type: 'paragraph' as const,
        },
        {
          id: 'sec2',
          content: 'Content 2',
          startLine: 11,
          endLine: 20,
          type: 'paragraph' as const,
        },
        {
          id: 'sec3',
          content: 'New content 3',
          startLine: 21,
          endLine: 30,
          type: 'paragraph' as const,
        },
      ];

      await saveSectionsToDatabase(testBookId, updatedSections);

      const result = await db
        .select()
        .from(sectionData)
        .where(eq(sectionData.bookId, testBookId));

      expect(result).toHaveLength(3);

      // Verify existing translation preserved
      const sec1 = result.find((r) => r.sectionId === 'sec1');
      expect(sec1?.draftTranslation).toBe('Traducción 1');

      // Verify new section has no translation
      const sec3 = result.find((r) => r.sectionId === 'sec3');
      expect(sec3?.draftTranslation).toBeNull();
      expect(sec3?.translationStatus).toBe('not_translated');
    });

    it('should remove deleted sections during re-split', async () => {
      // Initial split with 3 sections
      const initialSections = [
        {
          id: 'sec1',
          content: 'Content 1',
          startLine: 0,
          endLine: 10,
          type: 'paragraph' as const,
        },
        {
          id: 'sec2',
          content: 'Content 2',
          startLine: 11,
          endLine: 20,
          type: 'paragraph' as const,
        },
        {
          id: 'sec3',
          content: 'Content 3',
          startLine: 21,
          endLine: 30,
          type: 'paragraph' as const,
        },
      ];

      await saveSectionsToDatabase(testBookId, initialSections);
      await saveSectionDraft(testBookId, 'sec2', 'Content 2', 'Traducción 2');

      // Re-split with only 2 sections (removed sec3)
      const updatedSections = [
        {
          id: 'sec1',
          content: 'Content 1',
          startLine: 0,
          endLine: 10,
          type: 'paragraph' as const,
        },
        {
          id: 'sec2',
          content: 'Content 2',
          startLine: 11,
          endLine: 20,
          type: 'paragraph' as const,
        },
      ];

      await saveSectionsToDatabase(testBookId, updatedSections);

      const result = await db
        .select()
        .from(sectionData)
        .where(eq(sectionData.bookId, testBookId));

      expect(result).toHaveLength(2);
      expect(result.find((r) => r.sectionId === 'sec3')).toBeUndefined();

      // Verify remaining translation preserved
      const sec2 = result.find((r) => r.sectionId === 'sec2');
      expect(sec2?.draftTranslation).toBe('Traducción 2');
    });
  });

  describe('Translation Draft Workflow', () => {
    it('should save and load translation drafts', async () => {
      const sections = [
        {
          id: 'draft-test',
          content: 'Test content',
          startLine: 0,
          endLine: 10,
          type: 'paragraph' as const,
        },
      ];

      await saveSectionsToDatabase(testBookId, sections);

      // Save draft
      await saveSectionDraft(testBookId, 'draft-test', 'Test content', 'Contenido de prueba');

      // Load drafts
      const result = await getAllSectionDrafts(testBookId);

      expect(result.sectionDrafts['draft-test']).toBe('Contenido de prueba');
      expect(result.sectionsMetadata['draft-test'].hasDraft).toBe(true);
      expect(result.sectionsMetadata['draft-test'].translationStatus).toBe('draft');
    });

    it('should update existing draft on re-save', async () => {
      const sections = [
        {
          id: 'update-test',
          content: 'Content',
          startLine: 0,
          endLine: 10,
          type: 'paragraph' as const,
        },
      ];

      await saveSectionsToDatabase(testBookId, sections);

      // Save initial draft
      await saveSectionDraft(testBookId, 'update-test', 'Content', 'Primera versión');

      // Update draft
      await saveSectionDraft(testBookId, 'update-test', 'Content', 'Segunda versión');

      // Verify updated
      const result = await getAllSectionDrafts(testBookId);
      expect(result.sectionDrafts['update-test']).toBe('Segunda versión');
    });

    it('should throw error when saving draft for non-existent section', async () => {
      // Don't create any sections

      await expect(
        saveSectionDraft(testBookId, 'nonexistent', 'Content', 'Translation')
      ).rejects.toThrow('Section data not found');
    });
  });

  describe('Section Metadata Tracking', () => {
    it('should track section metadata correctly', async () => {
      const sections = [
        {
          id: 'meta-test',
          content: 'Test content',
          startLine: 5,
          endLine: 15,
          type: 'heading' as const,
        },
      ];

      await saveSectionsToDatabase(testBookId, sections);

      const result = await getAllSectionDrafts(testBookId);
      const metadata = result.sectionsMetadata['meta-test'];

      expect(metadata).toBeDefined();
      // Note: sectionsMetadata doesn't include startLine/endLine/sectionType
      // Those are in the sections array
      expect(metadata.hasDraft).toBe(false);
      expect(metadata.translationStatus).toBe('not_translated');
      
      // Check section data instead
      const section = result.sections.find(s => s.id === 'meta-test');
      expect(section).toBeDefined();
      expect(section?.startLine).toBe(5);
      expect(section?.endLine).toBe(15);
      expect(section?.type).toBe('heading');
    });

    it('should update metadata after draft save', async () => {
      const sections = [
        {
          id: 'meta-draft',
          content: 'Content',
          startLine: 0,
          endLine: 10,
          type: 'paragraph' as const,
        },
      ];

      await saveSectionsToDatabase(testBookId, sections);
      await saveSectionDraft(testBookId, 'meta-draft', 'Content', 'Traducción');

      const result = await getAllSectionDrafts(testBookId);
      const metadata = result.sectionsMetadata['meta-draft'];

      expect(metadata.hasDraft).toBe(true);
      expect(metadata.translationStatus).toBe('draft');
      expect(metadata.draftLastModified).toBeDefined();
    });
  });

  describe('Complex Re-Split Scenarios', () => {
    it('should handle complete document restructure', async () => {
      // Initial: 3 sections
      const initial = [
        { id: 'intro', content: 'Intro', startLine: 0, endLine: 5, type: 'paragraph' as const },
        { id: 'body', content: 'Body', startLine: 6, endLine: 15, type: 'paragraph' as const },
        { id: 'conclusion', content: 'End', startLine: 16, endLine: 20, type: 'paragraph' as const },
      ];

      await saveSectionsToDatabase(testBookId, initial);
      await saveSectionDraft(testBookId, 'intro', 'Intro', 'Introducción');
      await saveSectionDraft(testBookId, 'body', 'Body', 'Cuerpo');
      await saveSectionDraft(testBookId, 'conclusion', 'End', 'Conclusión');

      // Re-split: Remove body, add two new sections
      const updated = [
        { id: 'intro', content: 'Intro updated', startLine: 0, endLine: 5, type: 'paragraph' as const },
        { id: 'chapter1', content: 'Ch1', startLine: 6, endLine: 10, type: 'paragraph' as const },
        { id: 'chapter2', content: 'Ch2', startLine: 11, endLine: 15, type: 'paragraph' as const },
        { id: 'conclusion', content: 'End updated', startLine: 16, endLine: 20, type: 'paragraph' as const },
      ];

      await saveSectionsToDatabase(testBookId, updated);

      const result = await db
        .select()
        .from(sectionData)
        .where(eq(sectionData.bookId, testBookId));

      expect(result).toHaveLength(4);

      // Verify preserved translations
      const intro = result.find((r) => r.sectionId === 'intro');
      expect(intro?.draftTranslation).toBe('Introducción');
      expect(intro?.originalContent).toBe('Intro updated');

      const conclusion = result.find((r) => r.sectionId === 'conclusion');
      expect(conclusion?.draftTranslation).toBe('Conclusión');
      expect(conclusion?.originalContent).toBe('End updated');

      // Verify removed section
      expect(result.find((r) => r.sectionId === 'body')).toBeUndefined();

      // Verify new sections
      const ch1 = result.find((r) => r.sectionId === 'chapter1');
      expect(ch1?.draftTranslation).toBeNull();

      const ch2 = result.find((r) => r.sectionId === 'chapter2');
      expect(ch2?.draftTranslation).toBeNull();
    });
  });
});
