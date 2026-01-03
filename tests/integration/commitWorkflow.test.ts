import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { drizzle } from 'drizzle-orm/mysql2';
import { eq } from 'drizzle-orm';
import { books, sectionData } from '../../drizzle/schema';
import {
  createBook,
  saveSectionDraft,
  getAllSectionDrafts,
  getBook,
} from '../../server/db';
import { reconstructDocument } from '../../server/version/service';
import { updateSectionCommitStatus } from '../../server/db/sections';

/**
 * Integration tests for Git commit workflow
 * Tests the entire flow from draft creation to commit status update
 */
describe('Git Commit Workflow Integration', () => {
  let db: ReturnType<typeof drizzle>;
  let testBookId: string;
  let testUserId: string;

  beforeEach(async () => {
    const uniqueSuffix = Math.random().toString(36).substr(2, 8);
    testBookId = 'commit-book-' + uniqueSuffix;
    testUserId = 'commit-user-' + uniqueSuffix;

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
        repoName: 'test-commit-repo',
        repoUrl: 'https://github.com/test/commit-repo',
        gitProvider: 'github',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        title: 'Test Commit Workflow Book',
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

  describe('Document Reconstruction', () => {
    it('should reconstruct document from multiple section drafts', async () => {
      // Create sections with drafts
      const sections = [
        { id: 'intro', content: 'Introduction text', translation: 'Texto de introducción' },
        { id: 'chapter1', content: 'Chapter 1 content', translation: 'Contenido del capítulo 1' },
        { id: 'chapter2', content: 'Chapter 2 content', translation: 'Contenido del capítulo 2' },
      ];

      // Insert section data using :: delimiter
      for (const section of sections) {
        await db.insert(sectionData).values({
          id: `${testBookId}::${section.id}`,
          bookId: testBookId,
          sectionId: section.id,
          originalContent: section.content,
          draftTranslation: section.translation,
          startLine: '0',
          endLine: '10',
          sectionType: 'paragraph',
          translationStatus: 'draft',
          createdAt: new Date(),
        });
      }

      // Reconstruct document
      const result = await reconstructDocument(testBookId);

      expect(result.sectionCount).toBe(3);
      // Note: Order may vary based on database query, so check contents instead
      expect(result.sectionIds).toContain('intro');
      expect(result.sectionIds).toContain('chapter1');
      expect(result.sectionIds).toContain('chapter2');
      expect(result.sectionIds).toHaveLength(3);
      expect(result.content).toContain('Texto de introducción');
      expect(result.content).toContain('Contenido del capítulo 1');
      expect(result.content).toContain('Contenido del capítulo 2');
      
      // Verify sections are joined with double newline (order may vary)
      expect(result.content.split('\n\n')).toHaveLength(3);
    });

    it('should only include sections with non-empty drafts', async () => {
      const sections = [
        { id: 'sec1', content: 'Section 1', translation: 'Sección 1' },
        { id: 'sec2', content: 'Section 2', translation: '' }, // Empty draft
        { id: 'sec3', content: 'Section 3', translation: 'Sección 3' },
      ];

      for (const section of sections) {
        await db.insert(sectionData).values({
          id: `${testBookId}::${section.id}`,
          bookId: testBookId,
          sectionId: section.id,
          originalContent: section.content,
          draftTranslation: section.translation,
          startLine: '0',
          endLine: '10',
          sectionType: 'paragraph',
          translationStatus: section.translation ? 'draft' : 'not_translated',
          createdAt: new Date(),
        });
      }

      const result = await reconstructDocument(testBookId);

      expect(result.sectionCount).toBe(2);
      expect(result.sectionIds).toEqual(['sec1', 'sec3']);
      expect(result.content).not.toContain('Section 2');
    });

    it('should throw error when no sections have drafts', async () => {
      await db.insert(sectionData).values({
        id: `${testBookId}::empty`,
        bookId: testBookId,
        sectionId: 'empty',
        originalContent: 'Some content',
        draftTranslation: '',
        startLine: '0',
        endLine: '10',
        sectionType: 'paragraph',
        translationStatus: 'not_translated',
        createdAt: new Date(),
      });

      await expect(reconstructDocument(testBookId)).rejects.toThrow(
        'No translated sections found'
      );
    });
  });

  describe('Commit Status Update', () => {
    it('should store individual section translation in committedTranslation field', async () => {
      const sectionId = 'test-section';
      const sectionTranslation = 'This is the section translation';

      // Create section data
      await db.insert(sectionData).values({
        id: `${testBookId}::${sectionId}`,
        bookId: testBookId,
        sectionId,
        originalContent: 'Original content',
        draftTranslation: sectionTranslation,
        startLine: '0',
        endLine: '10',
        sectionType: 'paragraph',
        translationStatus: 'draft',
        createdAt: new Date(),
      });

      // Update commit status with individual section translation
      const commitTime = new Date();
      await updateSectionCommitStatus(testBookId, sectionId, sectionTranslation, commitTime);

      // Verify the committed translation is stored correctly
      const result = await db
        .select()
        .from(sectionData)
        .where(eq(sectionData.id, `${testBookId}::${sectionId}`))
        .limit(1);

      expect(result).toHaveLength(1);
      expect(result[0].committedTranslation).toBe(sectionTranslation);
      expect(result[0].translationStatus).toBe('committed');
      expect(result[0].committedAt).toBeDefined();
    });

    it('should NOT store full document in section commit status', async () => {
      const sections = [
        { id: 'sec1', translation: 'Translation 1' },
        { id: 'sec2', translation: 'Translation 2' },
        { id: 'sec3', translation: 'Translation 3' },
      ];

      // Create sections
      for (const section of sections) {
        await db.insert(sectionData).values({
          id: `${testBookId}::${section.id}`,
          bookId: testBookId,
          sectionId: section.id,
          originalContent: `Content ${section.id}`,
          draftTranslation: section.translation,
          startLine: '0',
          endLine: '10',
          sectionType: 'paragraph',
          translationStatus: 'draft',
          createdAt: new Date(),
        });
      }

      // Simulate commit: each section gets its own translation (not full document)
      const commitTime = new Date();
      for (const section of sections) {
        await updateSectionCommitStatus(
          testBookId,
          section.id,
          section.translation, // Individual section translation
          commitTime
        );
      }

      // Verify each section has only its own translation
      for (const section of sections) {
        const result = await db
          .select()
          .from(sectionData)
          .where(eq(sectionData.id, `${testBookId}::${section.id}`))
          .limit(1);

        expect(result[0].committedTranslation).toBe(section.translation);
        expect(result[0].committedTranslation).not.toContain('Translation 1\n\nTranslation 2');
        expect(result[0].committedTranslation?.length).toBeLessThan(50); // Should be short
      }
    });

    it('should update translation status to committed', async () => {
      const sectionId = 'status-test';

      await db.insert(sectionData).values({
        id: `${testBookId}::${sectionId}`,
        bookId: testBookId,
        sectionId,
        originalContent: 'Original',
        draftTranslation: 'Draft translation',
        startLine: '0',
        endLine: '10',
        sectionType: 'paragraph',
        translationStatus: 'draft',
        createdAt: new Date(),
      });

      await updateSectionCommitStatus(testBookId, sectionId, 'Draft translation', new Date());

      const result = await db
        .select()
        .from(sectionData)
        .where(eq(sectionData.id, `${testBookId}::${sectionId}`))
        .limit(1);

      expect(result[0].translationStatus).toBe('committed');
    });
  });

  describe('Full Commit Workflow', () => {
    it('should complete full workflow: draft -> reconstruct -> commit', async () => {
      // Step 1: Create sections with drafts
      const sections = [
        { id: 'intro-section', content: 'Introduction', translation: 'Introducción' },
        { id: 'main-section', content: 'Main content', translation: 'Contenido principal' },
      ];

      for (const section of sections) {
        await db.insert(sectionData).values({
          id: `${testBookId}::${section.id}`,
          bookId: testBookId,
          sectionId: section.id,
          originalContent: section.content,
          draftTranslation: section.translation,
          startLine: '0',
          endLine: '10',
          sectionType: 'paragraph',
          translationStatus: 'draft',
          createdAt: new Date(),
        });
      }

      // Step 2: Reconstruct document
      const { content, sectionIds, sectionCount } = await reconstructDocument(testBookId);

      expect(sectionCount).toBe(2);
      // Note: Order may vary, check contents instead
      expect(sectionIds).toContain('intro-section');
      expect(sectionIds).toContain('main-section');
      expect(sectionIds).toHaveLength(2);

      // Step 3: Get individual section drafts (simulating what commitVersion does)
      const { sectionDrafts } = await getAllSectionDrafts(testBookId);

      // Step 4: Update commit status for each section with its own translation
      const commitTime = new Date();
      for (const sectionId of sectionIds) {
        const sectionTranslation = sectionDrafts[sectionId] || '';
        await updateSectionCommitStatus(testBookId, sectionId, sectionTranslation, commitTime);
      }

      // Step 5: Verify each section has correct committed translation
      for (const section of sections) {
        const result = await db
          .select()
          .from(sectionData)
          .where(eq(sectionData.id, `${testBookId}::${section.id}`))
          .limit(1);

        expect(result[0].committedTranslation).toBe(section.translation);
        expect(result[0].translationStatus).toBe('committed');
        expect(result[0].committedAt).toBeDefined();
      }
    });
  });

  describe('ID Parsing with Hyphens', () => {
    it('should handle book IDs with hyphens using :: delimiter', async () => {
      const hyphenatedBookId = 'my-book-with-hyphens-123';
      const sectionId = 'section-with-hyphens';

      // Clean up
      try {
        await db.delete(sectionData).where(eq(sectionData.bookId, hyphenatedBookId));
        await db.delete(books).where(eq(books.id, hyphenatedBookId));
      } catch (error) {
        // Ignore
      }

      // Create book with hyphenated ID
      await db.insert(books).values({
        id: hyphenatedBookId,
        userId: testUserId,
        repoName: 'test-repo',
        repoUrl: 'https://github.com/test/repo',
        gitProvider: 'github',
        sourceLanguage: 'en',
        targetLanguage: 'es',
        title: 'Hyphenated Book',
        createdAt: new Date(),
        lastModified: new Date(),
      });

      // Create section with :: delimiter
      await db.insert(sectionData).values({
        id: `${hyphenatedBookId}::${sectionId}`,
        bookId: hyphenatedBookId,
        sectionId,
        originalContent: 'Content',
        draftTranslation: 'Traducción',
        startLine: '0',
        endLine: '10',
        sectionType: 'paragraph',
        translationStatus: 'draft',
        createdAt: new Date(),
      });

      // Verify we can retrieve it correctly
      const result = await db
        .select()
        .from(sectionData)
        .where(eq(sectionData.id, `${hyphenatedBookId}::${sectionId}`))
        .limit(1);

      expect(result).toHaveLength(1);
      expect(result[0].bookId).toBe(hyphenatedBookId);
      expect(result[0].sectionId).toBe(sectionId);

      // Clean up
      await db.delete(sectionData).where(eq(sectionData.bookId, hyphenatedBookId));
      await db.delete(books).where(eq(books.id, hyphenatedBookId));
    });
  });
});
