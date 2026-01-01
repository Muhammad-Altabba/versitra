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
      
      try {
        // Import version service functions
        const { reconstructDocument, generateCommitMessage, getTranslationFilePath } = await import('../version/service');
        const { getAllGitCredentials } = await import('../db/git-credentials');
        const { GitHubClient } = await import('../git/github');
        const { GitLabClient } = await import('../git/gitlab');
        const { updateSectionCommitStatus } = await import('../db/sections');
        
        // 1. Reconstruct document from section drafts
        const { content, sectionCount, sectionIds } = await reconstructDocument(input.bookId);
        
        if (sectionCount === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'No translated sections to commit',
          });
        }
        
        // Get individual section drafts for database storage
        const { getAllSectionDrafts } = await import('../db/sections');
        const { sectionDrafts } = await getAllSectionDrafts(input.bookId);
        
        // 2. Get Git credentials
        const credentials = await getAllGitCredentials(ctx.user.id);
        if (!credentials || credentials.length === 0) {
          throw new TRPCError({
            code: 'PRECONDITION_FAILED',
            message: 'No Git account connected. Please connect GitHub or GitLab first.',
          });
        }
        
        // Use the first available credential (prefer GitHub)
        const gitCred = credentials.find((c: any) => c.provider === 'github') || credentials[0];
        
        // 3. Parse repository info from book.repoUrl
        const repoUrl = book.repoUrl;
        if (!repoUrl) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Book has no repository URL',
          });
        }
        
        // Extract owner and repo name from URL
        // Format: https://github.com/owner/repo or https://gitlab.com/owner/repo
        const urlMatch = repoUrl.match(/(?:github\.com|gitlab\.com)\/([^\/]+)\/([^\/]+?)(?:\.git)?$/);
        if (!urlMatch) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid repository URL format',
          });
        }
        
        const [, owner, repoName] = urlMatch;
        
        // 4. Generate commit message and file path
        const commitMessage = generateCommitMessage(
          input.versionTitle,
          input.versionDescription,
          sectionCount
        );
        
        const filePath = getTranslationFilePath(
          book.targetLanguage || 'en',
          book.title || 'untitled'
        );
        
        console.log('[Books.commitVersion] Committing to Git:', {
          provider: gitCred.provider,
          owner,
          repo: repoName,
          filePath,
          sectionCount,
        });
        
        // 5. Commit to Git repository
        if (gitCred.provider === 'github') {
          const client = new GitHubClient(gitCred.accessToken);
          await client.commitFile(
            owner,
            repoName,
            filePath,
            content,
            commitMessage
          );
        } else if (gitCred.provider === 'gitlab') {
          const client = new GitLabClient(gitCred.accessToken);
          // GitLab uses projectId (owner/repo) as first parameter
          const projectId = `${owner}/${repoName}`;
          await client.commitFile(
            projectId,
            filePath,
            content,
            commitMessage
          );
        } else {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: `Unsupported Git provider: ${gitCred.provider}`,
          });
        }
        
        // 6. Update database: mark sections as committed with individual section content
        const now = new Date();
        for (const sectionId of sectionIds) {
          const sectionTranslation = sectionDrafts[sectionId] || '';
          await updateSectionCommitStatus(input.bookId, sectionId, sectionTranslation, now);
        }
        
        console.log(`[Books.commitVersion] ✅ Successfully committed ${sectionCount} sections`);
        
        return {
          success: true,
          committedCount: sectionCount,
          filePath,
          message: commitMessage,
        };
      } catch (error: any) {
        console.error('[Books.commitVersion] ❌ Error:', error);
        
        // Re-throw TRPC errors as-is
        if (error.code) {
          throw error;
        }
        
        // Wrap other errors
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to commit version: ${error.message}`,
        });
      }
    }),
});
