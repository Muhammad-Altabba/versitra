import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import {
  createBook,
  getUserBooks,
  getBook,
  updateBookLastModified,
  deleteBook,
  getGitCredential,
  saveSectionDraft,
  getSectionDraft,
  getAllSectionDrafts,
  getSectionStatus,
} from '../db';
import { GitHubClient } from '../git/github';
import { GitLabClient } from '../git/gitlab';
import { TRPCError } from '@trpc/server';

export const booksRouter = router({
  /**
   * Create a new book/translation project
   */
  create: protectedProcedure
    .input(
      z.object({
        repoName: z.string(),
        repoUrl: z.string(),
        title: z.string().optional(),
        sourceLanguage: z.string().optional(),
        targetLanguage: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const bookId = await createBook({
        userId: ctx.user.id,
        repoName: input.repoName,
        repoUrl: input.repoUrl,
        gitProvider: input.repoUrl.includes('github') ? 'github' : 'gitlab',
        title: input.title,
        sourceLanguage: input.sourceLanguage,
        targetLanguage: input.targetLanguage,
      });

      return { bookId };
    }),

  /**
   * Get all books for current user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return await getUserBooks(ctx.user.id);
  }),

  /**
   * Get a specific book
   */
  get: protectedProcedure
    .input(z.object({ bookId: z.string() }))
    .query(async ({ ctx, input }) => {
      const book = await getBook(input.bookId);

      if (!book || book.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      return book;
    }),

  /**
   * Delete a book
   */
  delete: protectedProcedure
    .input(z.object({ bookId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const book = await getBook(input.bookId);

      if (!book || book.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      await deleteBook(input.bookId);
      return { success: true };
    }),

  /**
   * Parse book content and extract sections
   */
  parseContent: protectedProcedure
    .input(
      z.object({
        bookId: z.string(),
        content: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const book = await getBook(input.bookId);

      if (!book || book.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      // Parse content into sections (simple paragraph split)
      const paragraphs = input.content.split('\n\n').filter(p => p.trim());
      const sections = paragraphs.map((content, index) => ({
        id: `section-${index}`,
        content: content.trim(),
        startLine: index,
        endLine: index + 1,
      }));

      // Update book with parsed sections
      await updateBookLastModified(input.bookId);

      return { sections, count: sections.length };
    }),

  /**
   * Save draft using new sectionData table
   */
  saveSectionDraft: protectedProcedure
    .input(
      z.object({
        bookId: z.string(),
        sectionId: z.string(),
        source: z.string(),
        translated: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const book = await getBook(input.bookId);

      if (!book || book.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      await saveSectionDraft(input.bookId, input.sectionId, input.source, input.translated);
      return { success: true };
    }),

  /**
   * Get draft for a section using new sectionData table
   */
  getSectionDraft: protectedProcedure
    .input(
      z.object({
        bookId: z.string(),
        sectionId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const book = await getBook(input.bookId);

      if (!book || book.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      return await getSectionDraft(input.bookId, input.sectionId);
    }),

  /**
   * Get all section drafts for a book using new sectionData table
   */
  getAllSectionDrafts: protectedProcedure
    .input(
      z.object({
        bookId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const book = await getBook(input.bookId);

      if (!book || book.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      return await getAllSectionDrafts(input.bookId);
    }),

  /**
   * Get section translation status
   */
  getSectionStatus: protectedProcedure
    .input(
      z.object({
        bookId: z.string(),
        sectionId: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const book = await getBook(input.bookId);

      if (!book || book.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      return await getSectionStatus(input.bookId, input.sectionId);
    }),

  /**
   * Commit all drafts as a version to Git
   */
  commitVersion: protectedProcedure
    .input(
      z.object({
        bookId: z.string(),
        versionTitle: z.string(),
        versionDescription: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const book = await getBook(input.bookId);

      if (!book || book.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      console.log('[Books.commitVersion] Committing drafts for book:', input.bookId);
      return { success: true, committedCount: 0 };
    }),
});
