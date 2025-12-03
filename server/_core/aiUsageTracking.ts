import { drizzle } from "drizzle-orm/mysql2";
import { eq, and } from "drizzle-orm";
import { aiUsageTracking, userPreferences } from "../../drizzle/schema";
import { ENV } from "./env";

let _db: ReturnType<typeof drizzle> | null = null;

async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    _db = drizzle(process.env.DATABASE_URL);
  }
  return _db;
}

interface UsageLimit {
  type: "unlimited" | "monthly" | "custom";
  value?: number; // requests per month
}

/**
 * Parse usage limit string to structured format
 * Examples: "unlimited", "1000", "5000"
 */
function parseUsageLimit(limitStr: string | null): UsageLimit {
  if (!limitStr || limitStr === "unlimited") {
    return { type: "unlimited" };
  }

  const parsed = parseInt(limitStr, 10);
  if (!isNaN(parsed) && parsed > 0) {
    return { type: "custom", value: parsed };
  }

  // Default to unlimited if parsing fails
  return { type: "unlimited" };
}

/**
 * Get current month in YYYY-MM format
 */
function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Track AI API usage for a user
 */
export async function trackAiUsage(
  userId: string,
  requestCount: number = 1,
  tokenCount: number = 0
): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[AI Usage] Database not available");
    return;
  }

  const month = getCurrentMonth();

  try {
    // Check if usage record exists for this month
    const existing = await db
      .select()
      .from(aiUsageTracking)
      .where(
        and(
          eq(aiUsageTracking.userId, userId),
          eq(aiUsageTracking.month, month)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing record
      const currentRequests = parseInt(existing[0].requestCount, 10) || 0;
      const currentTokens = parseInt(existing[0].tokenCount, 10) || 0;

      await db
        .update(aiUsageTracking)
        .set({
          requestCount: String(currentRequests + requestCount),
          tokenCount: String(currentTokens + tokenCount),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(aiUsageTracking.userId, userId),
            eq(aiUsageTracking.month, month)
          )
        );
    } else {
      // Create new record
      const id = `usage_${userId}_${month}_${Date.now()}`;
      await db.insert(aiUsageTracking).values({
        id,
        userId,
        month,
        requestCount: String(requestCount),
        tokenCount: String(tokenCount),
      });
    }
  } catch (error) {
    console.error("[AI Usage] Failed to track usage:", error);
  }
}

/**
 * Get current month's usage for a user
 */
export async function getMonthlyUsage(userId: string): Promise<{
  requestCount: number;
  tokenCount: number;
}> {
  const db = await getDb();
  if (!db) {
    return { requestCount: 0, tokenCount: 0 };
  }

  const month = getCurrentMonth();

  try {
    const result = await db
      .select()
      .from(aiUsageTracking)
      .where(
        and(
          eq(aiUsageTracking.userId, userId),
          eq(aiUsageTracking.month, month)
        )
      )
      .limit(1);

    if (result.length > 0) {
      return {
        requestCount: parseInt(result[0].requestCount, 10) || 0,
        tokenCount: parseInt(result[0].tokenCount, 10) || 0,
      };
    }

    return { requestCount: 0, tokenCount: 0 };
  } catch (error) {
    console.error("[AI Usage] Failed to get usage:", error);
    return { requestCount: 0, tokenCount: 0 };
  }
}

/**
 * Check if user has exceeded their usage limit
 */
export async function checkUsageLimit(userId: string): Promise<{
  allowed: boolean;
  current: number;
  limit: number | null;
  percentageUsed: number;
}> {
  const db = await getDb();
  if (!db) {
    return { allowed: true, current: 0, limit: null, percentageUsed: 0 };
  }

  try {
    // Get user preferences
    const prefs = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);

    const limit = parseUsageLimit(
      prefs.length > 0 ? prefs[0].aiUsageLimit : null
    );

    // Get current usage
    const usage = await getMonthlyUsage(userId);

    if (limit.type === "unlimited") {
      return {
        allowed: true,
        current: usage.requestCount,
        limit: null,
        percentageUsed: 0,
      };
    }

    const limitValue = limit.value || 1000;
    const allowed = usage.requestCount < limitValue;
    const percentageUsed = Math.round((usage.requestCount / limitValue) * 100);

    return {
      allowed,
      current: usage.requestCount,
      limit: limitValue,
      percentageUsed,
    };
  } catch (error) {
    console.error("[AI Usage] Failed to check limit:", error);
    return { allowed: true, current: 0, limit: null, percentageUsed: 0 };
  }
}

/**
 * Get environment-based default AI usage limit
 */
export function getDefaultAiLimit(): string {
  return process.env.AI_USAGE_LIMIT || "unlimited";
}

/**
 * Get environment-based AI provider
 */
export function getDefaultAiProvider(): string {
  return process.env.AI_PROVIDER || "builtin";
}
