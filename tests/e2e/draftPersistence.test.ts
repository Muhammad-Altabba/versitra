import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { drizzle } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';
import { books, sectionData } from '../../drizzle/schema';
import { saveSectionDraft, getAllSectionDrafts, getBook } from '../../server/db';

/**
 * End-to-end test suite for draft persistence
 * Verifies that drafts are correctly saved to the database and can be loaded on project reopen
 */
describe('Draft Persistence E2E', () => {
  let db: ReturnType<typeof drizzle>;
  let testBookId: string;
  let testUserId: string;
  let testSection1Id: string;
  let testSection2Id: string;

  beforeEach(async () => {
    // Generate unique IDs for each test (keep them short to fit 64-char limit)
    const uniqueSuffix = Math.random().toString(36).substr(2, 8);
    testBookId = 'book-' + uniqueSuffix;
    testUserId = 'user-' + uniqueSuffix;
    testSection1Id = 'sec1-' + uniqueSuffix;
    testSection2Id = 'sec2-' + uniqueSuffix;

    // Initialize database connection
    if (process.env.DATABASE_URL) {
      db = drizzle(process.env.DATABASE_URL);

      // Clean up any leftover data from previous test runs
      try {
        await db.delete(sectionData).where(eq(sectionData.bookId, testBookId));
        await db.delete(books).where(eq(books.id, testBookId));
      } catch (error) {
        // Ignore cleanup errors if data doesn't exist
      }

      // Create test book with sections in JSON format
      await db.insert(books).values({
        id: testBookId,
        userId: testUserId,
        repoName: 'test-repo',
        repoUrl: 'https://github.com/test/repo',
        gitProvider: 'github',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        title: 'Test Book for Draft Persistence',
        sections: [
          {
            id: testSection1Id,
            content: 'This is the introduction section.',
            startLine: 0,
            endLine: 10,
          },
          {
            id: testSection2Id,
            content: 'This is chapter 1 content.',
            startLine: 11,
            endLine: 20,
          },
        ],
        createdAt: new Date(),
        lastModified: new Date(),
      });
    }
  });

  afterEach(async () => {
    // Clean up test data
    if (db) {
      try {
        await db.delete(sectionData).where(eq(sectionData.bookId, testBookId));
        await db.delete(books).where(eq(books.id, testBookId));
      } catch (error) {
        console.warn('Cleanup error:', error);
      }
    }
  });

  describe('Single Section Draft Persistence', () => {
    it('should save a draft and retrieve it with getAllSectionDrafts', async () => {
      if (!db) {
        console.warn('Database not available, skipping test');
        return;
      }

      const draftContent = 'Esta es la introducción traducida.';
      const sourceContent = 'This is the introduction section.';

      // Save draft
      await saveSectionDraft(testBookId, testSection1Id, sourceContent, draftContent);

      // Retrieve all drafts
      const drafts = await getAllSectionDrafts(testBookId);

      // Verify draft is returned
      expect(drafts).toBeDefined();
      expect(drafts.sectionDrafts).toBeDefined();
      expect(drafts.sectionDrafts[testSection1Id]).toBe(draftContent);

      // Verify metadata is correct
      expect(drafts.sectionsMetadata).toBeDefined();
      expect(drafts.sectionsMetadata[testSection1Id]).toBeDefined();
      expect(drafts.sectionsMetadata[testSection1Id].hasDraft).toBe(true);
      expect(drafts.sectionsMetadata[testSection1Id].translated).toBe(false);
    });

    it('should update an existing draft', async () => {
      if (!db) {
        console.warn('Database not available, skipping test');
        return;
      }

      const sourceContent = 'This is the introduction section.';
      const firstDraft = 'Primera versión de la traducción.';
      const secondDraft = 'Segunda versión mejorada de la traducción.';

      // Save first draft
      await saveSectionDraft(testBookId, testSection1Id, sourceContent, firstDraft);
      let drafts = await getAllSectionDrafts(testBookId);
      expect(drafts.sectionDrafts[testSection1Id]).toBe(firstDraft);

      // Update with second draft
      await saveSectionDraft(testBookId, testSection1Id, sourceContent, secondDraft);
      drafts = await getAllSectionDrafts(testBookId);

      // Verify draft was updated
      expect(drafts.sectionDrafts[testSection1Id]).toBe(secondDraft);
    });

    it('should persist draft across multiple getAllSectionDrafts calls', async () => {
      if (!db) {
        console.warn('Database not available, skipping test');
        return;
      }

      const draftContent = 'Traducción persistente.';
      const sourceContent = 'This is the introduction section.';

      // Save draft
      await saveSectionDraft(testBookId, testSection1Id, sourceContent, draftContent);

      // Call getAllSectionDrafts multiple times
      const drafts1 = await getAllSectionDrafts(testBookId);
      const drafts2 = await getAllSectionDrafts(testBookId);
      const drafts3 = await getAllSectionDrafts(testBookId);

      // Verify draft is consistent across calls
      expect(drafts1.sectionDrafts[testSection1Id]).toBe(draftContent);
      expect(drafts2.sectionDrafts[testSection1Id]).toBe(draftContent);
      expect(drafts3.sectionDrafts[testSection1Id]).toBe(draftContent);
    });
  });

  describe('Multiple Sections Draft Persistence', () => {
    it('should save and retrieve drafts for multiple sections', async () => {
      if (!db) {
        console.warn('Database not available, skipping test');
        return;
      }

      const sourceContent1 = 'This is the introduction section.';
      const draftContent1 = 'Esta es la introducción.';

      const sourceContent2 = 'This is chapter 1 content.';
      const draftContent2 = 'Este es el contenido del capítulo 1.';

      // Save drafts for both sections
      await saveSectionDraft(testBookId, testSection1Id, sourceContent1, draftContent1);
      await saveSectionDraft(testBookId, testSection2Id, sourceContent2, draftContent2);

      // Retrieve all drafts
      const drafts = await getAllSectionDrafts(testBookId);

      // Verify both drafts are present
      expect(drafts.sectionDrafts[testSection1Id]).toBe(draftContent1);
      expect(drafts.sectionDrafts[testSection2Id]).toBe(draftContent2);

      // Verify metadata for both sections
      expect(drafts.sectionsMetadata[testSection1Id].hasDraft).toBe(true);
      expect(drafts.sectionsMetadata[testSection2Id].hasDraft).toBe(true);
    });

    it('should handle partial section drafts (some sections with drafts, some without)', async () => {
      if (!db) {
        console.warn('Database not available, skipping test');
        return;
      }

      const sourceContent1 = 'This is the introduction section.';
      const draftContent1 = 'Esta es la introducción.';

      // Save draft only for section 1, not section 2
      await saveSectionDraft(testBookId, testSection1Id, sourceContent1, draftContent1);

      // Retrieve all drafts
      const drafts = await getAllSectionDrafts(testBookId);

      // Verify section 1 has draft
      expect(drafts.sectionDrafts[testSection1Id]).toBe(draftContent1);
      expect(drafts.sectionsMetadata[testSection1Id].hasDraft).toBe(true);

      // Verify section 2 has no draft
      expect(drafts.sectionDrafts[testSection2Id]).toBeUndefined();
      expect(drafts.sectionsMetadata[testSection2Id]?.hasDraft).toBe(false);
    });

    it('should update one section draft without affecting others', async () => {
      if (!db) {
        console.warn('Database not available, skipping test');
        return;
      }

      const sourceContent1 = 'This is the introduction section.';
      const draftContent1 = 'Esta es la introducción.';

      const sourceContent2 = 'This is chapter 1 content.';
      const draftContent2 = 'Este es el contenido del capítulo 1.';
      const updatedDraftContent2 = 'Contenido del capítulo 1 mejorado.';

      // Save drafts for both sections
      await saveSectionDraft(testBookId, testSection1Id, sourceContent1, draftContent1);
      await saveSectionDraft(testBookId, testSection2Id, sourceContent2, draftContent2);

      // Update only section 2
      await saveSectionDraft(testBookId, testSection2Id, sourceContent2, updatedDraftContent2);

      // Retrieve all drafts
      const drafts = await getAllSectionDrafts(testBookId);

      // Verify section 1 is unchanged
      expect(drafts.sectionDrafts[testSection1Id]).toBe(draftContent1);

      // Verify section 2 is updated
      expect(drafts.sectionDrafts[testSection2Id]).toBe(updatedDraftContent2);
    });
  });

  describe('Draft Content Integrity', () => {
    it('should preserve special characters and formatting in drafts', async () => {
      if (!db) {
        console.warn('Database not available, skipping test');
        return;
      }

      const sourceContent = 'This is a test with special chars: "quotes", ñ, é, 中文, emoji 🚀';
      const draftContent = 'Esto es una prueba con caracteres especiales: "comillas", ñ, é, 中文, emoji 🚀';

      // Save draft with special characters
      await saveSectionDraft(testBookId, testSection1Id, sourceContent, draftContent);

      // Retrieve and verify
      const drafts = await getAllSectionDrafts(testBookId);
      expect(drafts.sectionDrafts[testSection1Id]).toBe(draftContent);
    });

    it('should preserve multiline content in drafts', async () => {
      if (!db) {
        console.warn('Database not available, skipping test');
        return;
      }

      const sourceContent = `Line 1
Line 2
Line 3
Line 4`;

      const draftContent = `Línea 1
Línea 2
Línea 3
Línea 4`;

      // Save draft with multiline content
      await saveSectionDraft(testBookId, testSection1Id, sourceContent, draftContent);

      // Retrieve and verify
      const drafts = await getAllSectionDrafts(testBookId);
      expect(drafts.sectionDrafts[testSection1Id]).toBe(draftContent);
    });

    it('should handle empty draft content', async () => {
      if (!db) {
        console.warn('Database not available, skipping test');
        return;
      }

      const sourceContent = 'This is the introduction section.';
      const draftContent = '';

      // Save empty draft
      await saveSectionDraft(testBookId, testSection1Id, sourceContent, draftContent);

      // Retrieve and verify
      const drafts = await getAllSectionDrafts(testBookId);
      expect(drafts.sectionDrafts[testSection1Id]).toBe('');
      expect(drafts.sectionsMetadata[testSection1Id].hasDraft).toBe(true);
    });

    it('should handle very long draft content', async () => {
      if (!db) {
        console.warn('Database not available, skipping test');
        return;
      }

      const sourceContent = 'This is a long source text.';
      const longDraftContent = 'A'.repeat(10000); // 10k characters

      // Save long draft
      await saveSectionDraft(testBookId, testSection1Id, sourceContent, longDraftContent);

      // Retrieve and verify
      const drafts = await getAllSectionDrafts(testBookId);
      expect(drafts.sectionDrafts[testSection1Id]).toBe(longDraftContent);
      expect(drafts.sectionDrafts[testSection1Id].length).toBe(10000);
    });
  });

  describe('Draft Metadata Tracking', () => {
    it('should track draft last modified timestamp', async () => {
      if (!db) {
        console.warn('Database not available, skipping test');
        return;
      }

      const sourceContent = 'This is the introduction section.';
      const draftContent = 'Esta es la introducción.';

      const beforeSave = new Date();
      await saveSectionDraft(testBookId, testSection1Id, sourceContent, draftContent);
      const afterSave = new Date();

      // Verify draft was saved
      const drafts = await getAllSectionDrafts(testBookId);
      expect(drafts.sectionsMetadata[testSection1Id].draftLastModified).toBeDefined();

      // Verify timestamp is within expected range (with 1 second tolerance for database precision)
      const draftTimestamp = new Date(drafts.sectionsMetadata[testSection1Id].draftLastModified);
      const tolerance = 1000; // 1 second
      expect(draftTimestamp.getTime()).toBeGreaterThanOrEqual(beforeSave.getTime() - tolerance);
      expect(draftTimestamp.getTime()).toBeLessThanOrEqual(afterSave.getTime() + tolerance);
    });

    it('should update book lastModified when draft is saved', async () => {
      if (!db) {
        console.warn('Database not available, skipping test');
        return;
      }

      const sourceContent = 'This is the introduction section.';
      const draftContent = 'Esta es la introducción.';

      const beforeSave = new Date();
      await saveSectionDraft(testBookId, testSection1Id, sourceContent, draftContent);
      const afterSave = new Date();

      // Retrieve book and verify lastModified was updated
      const book = await getBook(testBookId);
      expect(book).toBeDefined();
      expect(book?.lastModified).toBeDefined();

      const bookTimestamp = new Date(book!.lastModified!);
      const tolerance = 1000; // 1 second tolerance for database precision
      expect(bookTimestamp.getTime()).toBeGreaterThanOrEqual(beforeSave.getTime() - tolerance);
      expect(bookTimestamp.getTime()).toBeLessThanOrEqual(afterSave.getTime() + tolerance);
    });

    it('should track translation status as draft', async () => {
      if (!db) {
        console.warn('Database not available, skipping test');
        return;
      }

      const sourceContent = 'This is the introduction section.';
      const draftContent = 'Esta es la introducción.';

      // Save draft
      await saveSectionDraft(testBookId, testSection1Id, sourceContent, draftContent);

      // Retrieve and verify status
      const drafts = await getAllSectionDrafts(testBookId);
      expect(drafts.sectionsMetadata[testSection1Id].translationStatus).toBe('draft');
      expect(drafts.sectionsMetadata[testSection1Id].translated).toBe(false);
    });
  });
});
