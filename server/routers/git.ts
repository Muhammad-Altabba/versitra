import { z } from 'zod';
import { protectedProcedure, router } from '../_core/trpc';
import { GitHubClient } from '../git/github';
import { GitLabClient } from '../git/gitlab';
import { getGitCredential } from '../db';
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
 * Git operations router
 */
export const gitRouter = router({
  /**
   * Create a new repository for a book
   */
  createRepo: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        isPrivate: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { client, provider, username } = await getGitClient(ctx.user.id);

      const repo = await client.createRepo(input.name, input.description, input.isPrivate);

      return {
        ...repo,
        provider,
        username,
      };
    }),

  /**
   * Get file content from repository
   */
  getFile: protectedProcedure
    .input(
      z.object({
        owner: z.string(),
        repo: z.string(),
        path: z.string(),
        branch: z.string().default('main'),
      })
    )
    .query(async ({ ctx, input }) => {
      const { client } = await getGitClient(ctx.user.id);

      const file = await client.getFile(input.owner, input.repo, input.path, input.branch);

      if (!file) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'File not found',
        });
      }

      return file;
    }),

  /**
   * Commit a file to repository
   */
  commitFile: protectedProcedure
    .input(
      z.object({
        owner: z.string(),
        repo: z.string(),
        path: z.string(),
        content: z.string(),
        message: z.string(),
        branch: z.string().default('main'),
        sha: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { client } = await getGitClient(ctx.user.id);

      await (client as any).commitFile(
        input.owner,
        input.repo,
        input.path,
        input.content,
        input.message,
        input.branch,
        input.sha
      );

      return { success: true };
    }),

  /**
   * Get commit history
   */
  getCommitHistory: protectedProcedure
    .input(
      z.object({
        owner: z.string(),
        repo: z.string(),
        path: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      console.log('[Git.getCommitHistory] Request:', {
        owner: input.owner,
        repo: input.repo,
        path: input.path,
        limit: input.limit,
      });
      
      const { client } = await getGitClient(ctx.user.id);

      const commits = await (client as any).getCommitHistory(
        input.owner,
        input.repo,
        input.path,
        input.limit
      );
      
      console.log('[Git.getCommitHistory] Found commits:', commits.length);
      if (commits.length > 0) {
        console.log('[Git.getCommitHistory] Latest commit:', {
          sha: commits[0].sha.substring(0, 7),
          message: commits[0].message.substring(0, 50),
          author: commits[0].author,
        });
      }
      
      return commits;
    }),

  /**
   * Get diff between two commits
   */
  getDiff: protectedProcedure
    .input(
      z.object({
        owner: z.string(),
        repo: z.string(),
        base: z.string(),
        head: z.string(),
        path: z.string().optional(), // Optional: filter diff by specific file path
      })
    )
    .query(async ({ ctx, input }) => {
      const { client } = await getGitClient(ctx.user.id);

      const fullDiff = await client.getDiff(input.owner, input.repo, input.base, input.head);
      
      // If path is specified, filter diff to only that file
      if (input.path) {
        const lines = fullDiff.split('\n');
        const filtered: string[] = [];
        let inTargetFile = false;
        
        for (const line of lines) {
          if (line.startsWith('diff --git')) {
            // Check if this is the target file
            inTargetFile = line.includes(input.path);
          }
          
          if (inTargetFile) {
            filtered.push(line);
            // Stop at next file
            if (line.startsWith('diff --git') && !line.includes(input.path)) {
              break;
            }
          }
        }
        
        return filtered.join('\n');
      }
      
      return fullDiff;
    }),

  /**
   * List files in a directory
   */
  listFiles: protectedProcedure
    .input(
      z.object({
        owner: z.string(),
        repo: z.string(),
        path: z.string().default(''),
        branch: z.string().default('main'),
      })
    )
    .query(async ({ ctx, input }) => {
      const { client } = await getGitClient(ctx.user.id);

      const files = await (client as any).listFiles(
        input.owner,
        input.repo,
        input.path,
        input.branch
      );
      return files;
    }),

  /**
   * Get current user's Git info
   */
  getUserInfo: protectedProcedure.query(async ({ ctx }) => {
    const credential = await getGitCredential(ctx.user.id);

    if (!credential) {
      return null;
    }

    return {
      provider: credential.gitProvider,
      username: credential.gitUsername,
    };
  }),

  /**
   * Load translation progress from Git repository
   * DEPRECATED: Use books.getSections instead for cached data
   * This endpoint is kept for backward compatibility but will query Git
   */
  loadTranslationProgress: protectedProcedure
    .input(
      z.object({
        owner: z.string(),
        repo: z.string(),
        branch: z.string().default('main'),
      })
    )
    .query(async ({ ctx, input }) => {
      const { client } = await getGitClient(ctx.user.id);

      try {
        // Only list files to check what's been translated (don't read content)
        const translatedFiles = await (client as any).listFiles(
          input.owner,
          input.repo,
          'translated',
          input.branch
        );

        // Build a map of translated section IDs (file existence only)
        const translatedSections: string[] = [];
        if (translatedFiles && translatedFiles.length > 0) {
          for (const file of translatedFiles) {
            if (file.name.endsWith('.md')) {
              const sectionId = file.name.replace('.md', '');
              translatedSections.push(sectionId);
            }
          }
        }

        return {
          translatedSections,
          hasProgress: translatedSections.length > 0,
        };
      } catch (error) {
        console.error('[Git] Failed to load translation progress:', error);
        return {
          translatedSections: [],
          hasProgress: false,
        };
      }
    }),
});


