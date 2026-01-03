import { Page } from '@playwright/test';
import { SignJWT } from 'jose';

/**
 * Authentication helper for Playwright E2E tests
 * 
 * This module provides utilities to mock OAuth authentication
 * by directly setting session cookies, bypassing the OAuth flow.
 */

/**
 * Mock user data for testing
 */
export const mockUser = {
  id: 'test-user-123',
  name: 'Test User',
  email: 'test@example.com',
  loginMethod: 'github',
  role: 'user' as const,
};

export const mockAdminUser = {
  id: 'test-admin-456',
  name: 'Admin User',
  email: 'admin@example.com',
  loginMethod: 'github',
  role: 'admin' as const,
};

/**
 * Create a JWT session token for testing
 * 
 * This mimics the session token created by the OAuth callback
 */
async function createSessionToken(user: typeof mockUser): Promise<string> {
  const secret = new TextEncoder().encode('test_jwt_secret_for_ci');
  
  const jwt = await new SignJWT({
    id: user.id,
    name: user.name,
    email: user.email,
    loginMethod: user.loginMethod,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret);

  return jwt;
}

/**
 * Set authentication cookie for a page
 * 
 * This allows tests to bypass OAuth and directly authenticate
 */
export async function setAuthCookie(
  page: Page,
  user: typeof mockUser = mockUser
): Promise<void> {
  const token = await createSessionToken(user);
  
  // Set the session cookie
  await page.context().addCookies([
    {
      name: 'session',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}

/**
 * Login as a regular user
 */
export async function loginAsUser(page: Page): Promise<void> {
  await setAuthCookie(page, mockUser);
}

/**
 * Login as an admin user
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await setAuthCookie(page, mockAdminUser);
}

/**
 * Logout by clearing cookies
 */
export async function logout(page: Page): Promise<void> {
  await page.context().clearCookies();
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(page: Page): Promise<boolean> {
  const cookies = await page.context().cookies();
  return cookies.some(cookie => cookie.name === 'session');
}
