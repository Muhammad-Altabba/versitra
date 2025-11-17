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
          const { client, username } = await getGitClient(ctx.user.id);
          
          console.log(`[Books] Attempting to delete repository: ${book.repoName} (provider: ${book.gitProvider})`);
          
          if (book.gitProvider === 'github') {
            // GitHub: repoName might be just "repo" or "owner/repo"
            let owner: string;
            let repo: string;
            
            if (book.repoName.includes('/')) {
              [owner, repo] = book.repoName.split('/');
            } else {
              // If no slash, use current user as owner
              owner = username;
              repo = book.repoName;
            }
            
            console.log(`[Books] Deleting GitHub repo: ${owner}/${repo}`);
            await (client as any).deleteRepository(owner, repo);
            console.log(`[Books] Successfully deleted GitHub repository: ${owner}/${repo}`);
          } else if (book.gitProvider === 'gitlab') {
            // GitLab: use full repo name as project ID
            console.log(`[Books] Deleting GitLab repo: ${book.repoName}`);
            await (client as any).deleteRepository(book.repoName);
            console.log(`[Books] Successfully deleted GitLab repository: ${book.repoName}`);
          }
        } catch (error) {
          console.error('[Books] Failed to delete repository:', error);
          console.error('[Books] Error details:', JSON.stringify(error, null, 2));
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
      console.log(`[Books.getSections] Request for book: ${input.id}`);
      const book = await getBook(input.id);

      if (!book) {
        console.log(`[Books.getSections] Book not found: ${input.id}`);
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Book not found',
        });
      }

      // Verify ownership
      if (book.userId !== ctx.user.id) {
        console.log(`[Books.getSections] Access denied for user ${ctx.user.id} to book ${input.id}`);
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Access denied',
        });
      }

      const sectionsCount = book.sections?.length || 0;
      const hasMetadata = !!book.sectionsMetadata;
      console.log(`[Books.getSections] Returning data:`, {
        bookId: input.id,
        sectionsCount,
        hasMetadata,
        metadataKeys: hasMetadata ? Object.keys(book.sectionsMetadata || {}).length : 0,
      });

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
      const { client, username } = await getGitClient(ctx.user.id);

      console.log('[Books.commitVersion] Committing drafts:', {
        bookId: input.bookId,
        repoName: book.repoName,
        username,
        draftCount: draftEntries.length,
        message: input.message,
      });

      // Parse owner and repo correctly (same logic as DiffViewer)
      const owner = book.repoName.includes('/') 
        ? book.repoName.split('/')[0] 
        : username;
      const repo = book.repoName.includes('/') 
        ? book.repoName.split('/')[1] 
        : book.repoName;

      console.log('[Books.commitVersion] Parsed repository info:', { owner, repo });

      // Commit each draft to Git
      const commitPromises = draftEntries.map(async ([sectionId, draft]) => {
        if (book.gitProvider === 'github') {
          console.log(`[Books.commitVersion] Committing section ${sectionId} to ${owner}/${repo}`);
          
          // Commit source
          await (client as any).commitFile(
            owner,
            repo,
            `source/${sectionId}.md`,
            draft.source,
            input.message,
            'main'
          );
          
          // Commit translation
          await (client as any).commitFile(
            owner,
            repo,
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
      try {
        await Promise.all(commitPromises);
        console.log(`[Books.commitVersion] Successfully committed all ${draftEntries.length} sections`);
      } catch (error: any) {
        console.error('[Books.commitVersion] Error committing sections:', {
          error: error.message,
          status: error.status,
          owner,
          repo,
          draftCount: draftEntries.length,
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to commit to Git: ${error.message}. Please check that the repository exists and you have access.`,
        });
      }

      // Clear all drafts after successful commit
      await clearAllDrafts(input.bookId);

      console.log(`[Books.commitVersion] Committed ${draftEntries.length} drafts for book ${input.bookId}`);
      return { 
        success: true, 
        committedCount: draftEntries.length 
      };
    }),
});



