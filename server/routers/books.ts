import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import {
  createBook,
  getUserBooks,
  getBook,
  updateBookLastModified,
  deleteBook,
  getGitCredential,
  updateSectionMetadata,
  saveDraft,
  getDraft,
  getAllDrafts,
  clearDraft,
  clearAllDrafts,
} from '../db';
import { GitHubClient } from '../git/github';
import { GitLabClient } from '../git/gitlab';
import { TRPCError } from '@trpc/server';

/**
 * Get Git client for the current user
 */
async function getGitClient(userId: string) {
  const credential = await getGitCredential(userId);

  if (!credential) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Git credentials not found. Please login with GitHub or GitLab.',
    });
  }

  if (credential.gitProvider === 'github') {
    return {
      client: new GitHubClient(credential.accessToken),
      provider: 'github' as const,
      username: credential.gitUsername,
    };
  } else {
    return {
      client: new GitLabClient(credential.accessToken),
      provider: 'gitlab' as const,
      username: credential.gitUsername,
    };
  }
}

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
   * Delete a book (from database and Git repository)
   */
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        deleteRepo: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const book = await getBook(input.id);

      if (!book || book.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      // Delete from Git if requested
      if (input.deleteRepo) {
        try {
          const { client } = await getGitClient(ctx.user.id);
          
          if (book.gitProvider === 'github') {
            // GitHub: owner/repo format
            const [owner, repo] = book.repoName.split('/');
            await (client as any).deleteRepository(owner || ctx.user.id.replace('github:', ''), repo || book.repoName);
          } else if (book.gitProvider === 'gitlab') {
            // GitLab: use full repo name as project ID
            await (client as any).deleteRepository(book.repoName);
          }
          
          console.log(`[Books] Deleted repository: ${book.repoName}`);
        } catch (error) {
          console.error('[Books] Failed to delete repository:', error);
          // Continue with database deletion even if Git deletion fails
        }
      }

      // Delete from database
      await deleteBook(input.id);
      return { success: true };
    }),

  /**
   * Get cached sections and metadata for a book
   */
  getSections: protectedProcedure
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

      return {
        sections: book.sections || [],
        sectionsMetadata: book.sectionsMetadata || {},
      };
    }),

  /**
   * Update translation metadata for a section
   */
  updateSectionMetadata: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        sectionId: z.string(),
        translated: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const book = await getBook(input.id);

      if (!book || book.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      await updateSectionMetadata(input.id, input.sectionId, {
        translated: input.translated,
        lastModified: new Date().toISOString(),
      });

      return { success: true };
    }),

  /**
   * Save a draft translation (not committed to Git yet)
   */
  saveDraft: protectedProcedure
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

      await saveDraft(input.bookId, input.sectionId, input.source, input.translated);
      return { success: true };
    }),

  /**
   * Get draft for a specific section
   */
  getDraft: protectedProcedure
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

      const draft = await getDraft(input.bookId, input.sectionId);
      return draft;
    }),

  /**
   * Get all drafts for a book
   */
  getAllDrafts: protectedProcedure
    .input(z.object({ bookId: z.string() }))
    .query(async ({ ctx, input }) => {
      const book = await getBook(input.bookId);

      if (!book || book.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      const drafts = await getAllDrafts(input.bookId);
      return drafts;
    }),

  /**
   * Clear draft after committing to Git
   */
  clearDraft: protectedProcedure
    .input(
      z.object({
        bookId: z.string(),
        sectionId: z.string(),
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

      await clearDraft(input.bookId, input.sectionId);
      return { success: true };
    }),

  /**
   * Clear all drafts for a book
   */
  clearAllDrafts: protectedProcedure
    .input(z.object({ bookId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const book = await getBook(input.bookId);

      if (!book || book.userId !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      await clearAllDrafts(input.bookId);
      return { success: true };
    }),

  /**
   * Commit all drafts to Git as a new version
   */
  commitVersion: protectedProcedure
    .input(
      z.object({
        bookId: z.string(),
        message: z.string().default('Update translations'),
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

      // Get all drafts
      const drafts = await getAllDrafts(input.bookId);
      const draftEntries = Object.entries(drafts);

      if (draftEntries.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No drafts to commit',
        });
      }

      // Get Git client
      const { client } = await getGitClient(ctx.user.id);

      // Commit each draft to Git
      const commitPromises = draftEntries.map(async ([sectionId, draft]) => {
        if (book.gitProvider === 'github') {
          const [owner, repo] = book.repoName.split('/');
          
          // Commit source
          await (client as any).commitFile(
            owner || ctx.user.id.replace('github:', ''),
            repo || book.repoName,
            `source/${sectionId}.md`,
            draft.source,
            input.message,
            'main'
          );
          
          // Commit translation
          await (client as any).commitFile(
            owner || ctx.user.id.replace('github:', ''),
            repo || book.repoName,
            `translated/${sectionId}.md`,
            draft.translated,
            input.message,
            'main'
          );
        } else if (book.gitProvider === 'gitlab') {
          // Commit source
          await (client as any).commitFile(
            book.repoName,
            `source/${sectionId}.md`,
            draft.source,
            input.message,
            'main'
          );
          
          // Commit translation
          await (client as any).commitFile(
            book.repoName,
            `translated/${sectionId}.md`,
            draft.translated,
            input.message,
            'main'
          );
        }

        // Update metadata to mark as translated
        await updateSectionMetadata(input.bookId, sectionId, {
          translated: true,
          lastModified: new Date().toISOString(),
        });
      });

      // Wait for all commits
      await Promise.all(commitPromises);

      // Clear all drafts after successful commit
      await clearAllDrafts(input.bookId);

      console.log(`[Books] Committed ${draftEntries.length} drafts for book ${input.bookId}`);
      return { 
        success: true, 
        committedCount: draftEntries.length 
      };
    }),
});



