import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { COOKIE_NAME } from "@shared/const";
import { getUser } from "../db";
import * as jose from "jose";
import { ENV } from "./env";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

const isTestMode = process.env.NODE_ENV === "test" || process.env.CI === "true";

/**
 * Validate JWT token in test mode (bypasses Manus SDK)
 */
async function validateTestToken(token: string): Promise<User | null> {
  try {
    const secret = new TextEncoder().encode(ENV.cookieSecret);
    const { payload } = await jose.jwtVerify(token, secret);
    
    if (payload.sub) {
      // Try to get user from database
      const user = await getUser(payload.sub);
      if (user) {
        return user;
      }
      
      // Return minimal user object if not in database
      return {
        id: payload.sub,
        name: (payload.name as string) || 'Test User',
        email: (payload.email as string) || null,
        role: (payload.role as 'user' | 'admin') || 'user',
        loginMethod: 'test',
        createdAt: new Date(),
        lastSignedIn: new Date(),
      };
    }
    return null;
  } catch (error) {
    console.error('[Test Mode] JWT validation failed:', error);
    return null;
  }
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    // In test mode, try test JWT validation first
    if (isTestMode) {
      const token = opts.req.cookies?.[COOKIE_NAME];
      if (token) {
        user = await validateTestToken(token);
        if (user) {
          return { req: opts.req, res: opts.res, user };
        }
      }
    }
    
    // Fall back to Manus SDK authentication
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
