import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { publicProcedure, router } from "../_core/trpc";
import { upsertUser } from "../db";
import { sdk } from "../_core/sdk";

/**
 * Test-only authentication router
 * Only enabled when NODE_ENV is 'test' or 'ci'
 * Provides a simple endpoint to create test sessions without OAuth
 */

const isTestMode = process.env.NODE_ENV === "test" || process.env.CI === "true";

export const testAuthRouter = router({
  /**
   * Test-only login endpoint
   * Creates a test user and returns a session cookie
   * Only works in test/CI environments
   */
  testLogin: publicProcedure
    .input(
      z.object({
        userId: z.string().default("test-user-id"),
        name: z.string().default("Test User"),
        email: z.string().email().default("test@example.com"),
        role: z.enum(["user", "admin"]).default("user"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Security check: only allow in test mode
      if (!isTestMode) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Test login is only available in test/CI environments",
        });
      }

      // Create or update test user in database
      await upsertUser({
        id: input.userId,
        name: input.name,
        email: input.email,
        role: input.role,
        loginMethod: "test",
        lastSignedIn: new Date(),
      });

      // Create session token using Manus SDK
      const token = await sdk.createSessionToken(input.userId, {
        name: input.name,
        expiresInMs: ONE_YEAR_MS,
      });

      // Set session cookie
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, cookieOptions);

      return {
        success: true,
        user: {
          id: input.userId,
          name: input.name,
          email: input.email,
          role: input.role,
        },
      };
    }),

  /**
   * Check if test mode is enabled
   */
  isTestMode: publicProcedure.query(() => {
    return { enabled: isTestMode };
  }),
});
