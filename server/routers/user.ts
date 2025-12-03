import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { drizzle } from "drizzle-orm/mysql2";
import { eq } from "drizzle-orm";
import { userPreferences } from "../../drizzle/schema";
import {
  checkUsageLimit,
  getMonthlyUsage,
  trackAiUsage,
} from "../_core/aiUsageTracking";

let _db: ReturnType<typeof drizzle> | null = null;

async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    _db = drizzle(process.env.DATABASE_URL);
  }
  return _db;
}

export const userRouter = router({
  /**
   * Get user's AI preferences
   */
  getAiPreferences: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    const prefs = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, ctx.user.id))
      .limit(1);

    if (prefs.length === 0) {
      return {
        aiApiProvider: "builtin",
        aiUsageLimit: "unlimited",
        aiApiKey: null,
        aiApiEndpoint: null,
      };
    }

    return {
      aiApiProvider: prefs[0].aiApiProvider || "builtin",
      aiUsageLimit: prefs[0].aiUsageLimit || "unlimited",
      aiApiKey: prefs[0].aiApiKey ? "***" : null, // Don't expose full key
      aiApiEndpoint: prefs[0].aiApiEndpoint,
    };
  }),

  /**
   * Update user's AI preferences
   */
  updateAiPreferences: protectedProcedure
    .input(
      z.object({
        aiApiProvider: z.enum(["builtin", "openai", "claude", "gemini"]).optional(),
        aiApiKey: z.string().optional(),
        aiApiEndpoint: z.string().url().optional(),
        aiUsageLimit: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      // Validate API key for non-builtin providers
      if (input.aiApiProvider && input.aiApiProvider !== "builtin" && !input.aiApiKey) {
        throw new Error("API key is required for custom providers");
      }

      const existing = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, ctx.user.id))
        .limit(1);

      if (existing.length === 0) {
        // Create new preferences
        await db.insert(userPreferences).values({
          id: `prefs_${ctx.user.id}_${Date.now()}`,
          userId: ctx.user.id,
          aiApiProvider: input.aiApiProvider || "builtin",
          aiApiKey: input.aiApiKey,
          aiApiEndpoint: input.aiApiEndpoint,
          aiUsageLimit: input.aiUsageLimit || "unlimited",
        });
      } else {
        // Update existing preferences
        const updates: Record<string, any> = { updatedAt: new Date() };
        if (input.aiApiProvider) updates.aiApiProvider = input.aiApiProvider;
        if (input.aiApiKey) updates.aiApiKey = input.aiApiKey;
        if (input.aiApiEndpoint !== undefined) updates.aiApiEndpoint = input.aiApiEndpoint;
        if (input.aiUsageLimit) updates.aiUsageLimit = input.aiUsageLimit;

        await db
          .update(userPreferences)
          .set(updates)
          .where(eq(userPreferences.userId, ctx.user.id));
      }

      return { success: true };
    }),

  /**
   * Get current month's AI usage
   */
  getAiUsage: protectedProcedure.query(async ({ ctx }) => {
    const usage = await checkUsageLimit(ctx.user.id);
    return usage;
  }),

  /**
   * Track AI usage (called by backend when AI is used)
   */
  trackAiUsage: protectedProcedure
    .input(
      z.object({
        requestCount: z.number().default(1),
        tokenCount: z.number().default(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await trackAiUsage(ctx.user.id, input.requestCount, input.tokenCount);
      return { success: true };
    }),
});
