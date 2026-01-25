import { Page } from '@playwright/test';

/**
 * Authentication helper for Playwright E2E tests
 * 
 * This module provides utilities to authenticate users in tests
 * using the test-only authentication endpoint (only available in test/CI mode).
 */

/**
 * Mock user data for testing
 */
export const mockUser = {
  id: 'test-user-123',
  name: 'Test User',
  email: 'test@example.com',
  role: 'user' as const,
};

export const mockAdminUser = {
  id: 'test-admin-456',
  name: 'Admin User',
  email: 'admin@example.com',
  role: 'admin' as const,
};

/**
 * Login using the test-only authentication endpoint
 * 
 * This endpoint is only available when NODE_ENV=test or CI=true
 */
async function loginViaTestEndpoint(
  page: Page,
  user: typeof mockUser
): Promise<void> {
  // Navigate to the app first to establish the domain
  await page.goto('/');

  // Call the test login endpoint using page.evaluate to make a fetch request
  // This ensures the cookie is set in the correct context
  const result = await page.evaluate(async (userData) => {
    const response = await fetch('/api/trpc/testAuth.testLogin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
      credentials: 'include', // Important: include cookies
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Test login failed: ${response.status} ${text}`);
    }

    return await response.json();
  }, user);

  // Reload the page to ensure the session cookie is recognized
  await page.reload();
}

/**
 * Login as a regular user
 */
export async function loginAsUser(page: Page): Promise<void> {
  await loginViaTestEndpoint(page, mockUser);
}

/**
 * Login as an admin user
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await loginViaTestEndpoint(page, mockAdminUser);
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
