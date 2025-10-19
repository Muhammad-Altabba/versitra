import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import {
  createBook,
  getUserBooks,
  getBook,
  updateBookLastModified,
  deleteBook,
  getGitCredential,
} from '../db';
import { TRPCError } from '@trpc/server';

/**
 * Books router
 */
export const booksRouter = router({
  /**
   * Create a new book project
   */
  create: protectedProcedure
    .input(
      z.object({
        repoName: z.string().min(1).max(255),
        repoUrl: z.string().url(),
        title: z.string().optional(),
        sourceLanguage: z.string().max(10).optional(),
        targetLanguage: z.string().max(10).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const credential = await getGitCredential(ctx.user.id);

      if (!credential) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Git credentials not found',
        });
      }

      const bookId = await createBook({
        userId: ctx.user.id,
        repoName: input.repoName,
        repoUrl: input.repoUrl,
        gitProvider: credential.gitProvider,
        title: input.title,
        sourceLanguage: input.sourceLanguage,
        targetLanguage: input.targetLanguage,
      });

      return { id: bookId };
    }),

  /**
   * List user's books
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    return await getUserBooks(ctx.user.id);
  }),

  /**
   * Get a specific book
   */
  get: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const book = await getBook(input.id);

      if (!book) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Book not found',
        });
      }

      // Verify ownership
      if (book.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      return book;
    }),

  /**
   * Update book's last modified timestamp
   */
  updateLastModified: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const book = await getBook(input.id);

      if (!book || book.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      await updateBookLastModified(input.id);
      return { success: true };
    }),

  /**
   * Delete a book
   */
  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const book = await getBook(input.id);

      if (!book || book.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      await deleteBook(input.id);
      return { success: true };
    }),
});

