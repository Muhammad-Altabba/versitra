import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { gitRouter } from "./routers/git";
import { booksRouter } from "./routers/books";
import { translationRouter } from "./routers/translation";
import { exportRouter } from "./routers/export";
import { userRouter } from "./routers/user";
import { adminRouter } from "./routers/admin";
import { testAuthRouter } from "./routers/testAuth";

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Git operations
  git: gitRouter,

  // Books management
  books: booksRouter,

  // Translation workflow
  translation: translationRouter,

  // Export functionality
  export: exportRouter,

  // User settings and preferences
  user: userRouter,

  // Admin operations
  admin: adminRouter,

  // Test-only authentication (only enabled in test/CI mode)
  testAuth: testAuthRouter,
});

export type AppRouter = typeof appRouter;
