import { protectedProcedure, router } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { getDb, getUser } from '../db';
import { users, userPreferences, aiUsageTracking } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';

/**
 * Admin router - procedures for admin-only operations
 */
export const adminRouter = router({
  /**
   * Get all users (admin only)
   */
  getAllUsers: protectedProcedure.query(async ({ ctx }) => {
    // Check if user is admin
    if (ctx.user.role !== 'admin') {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only admins can access this',
      });
    }

    const db = await getDb();
    if (!db) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Database not available',
      });
    }

    console.log('[Admin.getAllUsers] Fetching all users');
    const allUsers = await db.select().from(users);
    
    console.log('[Admin.getAllUsers] Found', allUsers.length, 'users');
    return allUsers;
  }),

  /**
   * Get user AI usage and limit (admin only)
   */
  getUserAiUsage: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ ctx, input }) => {
      // Check if user is admin
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admins can access this',
        });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database not available',
        });
      }

      console.log('[Admin.getUserAiUsage] Fetching usage for user:', input.userId);

      // Get user preferences
      const prefs = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, input.userId))
        .limit(1);

      const limit = prefs.length > 0 ? (prefs[0].aiUsageLimit || 'unlimited') : 'unlimited';

      // Get current month usage
      const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
      const usage = await db
        .select()
        .from(aiUsageTracking)
        .where(
          eq(aiUsageTracking.userId, input.userId) &&
          eq(aiUsageTracking.month, currentMonth)
        )
        .limit(1);

      const current = usage.length > 0 ? parseInt(usage[0].requestCount || '0') : 0;

      // Calculate percentage
      let percentageUsed = 0;
      if (limit !== 'unlimited') {
        const limitNum = parseInt(limit);
        percentageUsed = Math.round((current / limitNum) * 100);
      }

      return {
        current,
        limit: limit === 'unlimited' ? null : parseInt(limit),
        percentageUsed,
      };
    }),

  /**
   * Update user AI usage limit (admin only)
   */
  updateUserAiLimit: protectedProcedure
    .input(
      z.object({
        userId: z.string(),
        aiUsageLimit: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if user is admin
      if (ctx.user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only admins can update user limits',
        });
      }

      const db = await getDb();
      if (!db) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Database not available',
        });
      }

      console.log('[Admin.updateUserAiLimit] Updating limit for user:', {
        userId: input.userId,
        newLimit: input.aiUsageLimit,
      });

      try {
        // Check if user exists
        const user = await getUser(input.userId);
        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        // Get or create user preferences
        const existing = await db
          .select()
          .from(userPreferences)
          .where(eq(userPreferences.userId, input.userId))
          .limit(1);

        if (existing.length > 0) {
          // Update existing
          await db
            .update(userPreferences)
            .set({
              aiUsageLimit: input.aiUsageLimit,
              updatedAt: new Date(),
            })
            .where(eq(userPreferences.userId, input.userId));

          console.log('[Admin.updateUserAiLimit] Updated existing preferences');
        } else {
          // Create new
          const id = `pref_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await db.insert(userPreferences).values({
            id,
            userId: input.userId,
            aiUsageLimit: input.aiUsageLimit,
            autoSaveDrafts: 'enabled',
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          console.log('[Admin.updateUserAiLimit] Created new preferences');
        }

        return { success: true };
      } catch (error) {
        console.error('[Admin.updateUserAiLimit] Error:', error);
        throw error;
      }
    }),
});
