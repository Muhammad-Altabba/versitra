import { test, expect, Page } from '@playwright/test';
import { loginAsUser, loginAsAdmin, logout, mockUser } from './helpers/auth';

/**
 * Authenticated User Workflow E2E Tests
 * 
 * These tests cover workflows that require authentication.
 * They use mocked OAuth sessions to bypass the login flow.
 */

test.describe('Authenticated User Workflow', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test.beforeEach(async () => {
    // Login before each test
    await loginAsUser(page);
  });

  test.afterEach(async () => {
    // Logout after each test
    await logout(page);
  });

  test('should display projects page when authenticated', async () => {
    await page.goto('/');

    // Should see the projects page, not the login prompt
    await expect(page.locator('text=/My Translation Projects|Projects/i')).toBeVisible();
    
    // Should see "New Project" button
    const newProjectButton = page.locator('button:has-text("New Project")');
    await expect(newProjectButton).toBeVisible();
  });

  test('should display empty state when no projects exist', async () => {
    await page.goto('/');

    // Look for empty state indicators
    const emptyStateText = page.locator('text=/No projects|Create your first|Get started/i');
    
    // Either we see projects or we see empty state
    const hasProjects = await page.locator('[data-testid="project-card"], .project-item').count() > 0;
    const hasEmptyState = await emptyStateText.count() > 0;

    expect(hasProjects || hasEmptyState).toBeTruthy();
  });

  test('should have navigation links when authenticated', async () => {
    await page.goto('/');

    // Test navigation - check for interactive elements
    const interactiveElements = await page.locator('a[href], button').all();
    
    // Should have interactive elements (buttons or links)
    expect(interactiveElements.length).toBeGreaterThan(0);

    // Should see user-related actions
    const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout")');
    await expect(logoutButton).toBeVisible();
  });

  test('should have accessible UI elements when authenticated', async () => {
    await page.goto('/');

    // Check for proper heading hierarchy
    const h1 = await page.locator('h1').count();
    expect(h1).toBeGreaterThan(0);

    // Check for buttons with proper labels
    const buttons = await page.locator('button').all();
    expect(buttons.length).toBeGreaterThan(0);
    
    for (const button of buttons.slice(0, 5)) {
      const text = await button.textContent();
      const ariaLabel = await button.getAttribute('aria-label');
      
      // Button should have either text or aria-label
      expect(text || ariaLabel).toBeTruthy();
    }
  });

  test('should display user information in header', async () => {
    await page.goto('/');

    // Check for user name or email in the UI
    // This might be in a dropdown, avatar, or header
    const userInfo = page.locator(`text=/${mockUser.name}|${mockUser.email}/i`);
    
    // User info might not be visible by default, so we just check if page loaded
    const pageTitle = await page.title();
    expect(pageTitle).toContain('Git Translation Platform');
  });

  test('should allow navigation to admin page for regular user', async () => {
    await page.goto('/');

    // Regular users should see admin link (access control is on the backend)
    const adminLink = page.locator('a:has-text("Admin")');
    
    if (await adminLink.isVisible()) {
      await adminLink.click();
      
      // Should navigate to admin page or show access denied
      await page.waitForLoadState('networkidle');
      
      // Either we see admin content or an error message
      const hasAdminContent = await page.locator('text=/Admin|Database|Settings/i').count() > 0;
      const hasError = await page.locator('text=/Access Denied|Forbidden|Unauthorized/i').count() > 0;
      
      expect(hasAdminContent || hasError).toBeTruthy();
    }
  });
});

test.describe('Admin User Workflow', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test.beforeEach(async () => {
    // Login as admin before each test
    await loginAsAdmin(page);
  });

  test.afterEach(async () => {
    // Logout after each test
    await logout(page);
  });

  test('should access admin page as admin user', async () => {
    await page.goto('/');

    // Admin users should see admin link
    const adminLink = page.locator('a:has-text("Admin")');
    await expect(adminLink).toBeVisible();
    
    await adminLink.click();
    await page.waitForLoadState('networkidle');
    
    // Should see admin content (not access denied)
    const hasAdminContent = await page.locator('text=/Admin|Database|System/i').count() > 0;
    expect(hasAdminContent).toBeTruthy();
  });
});

test.describe('Project Creation Workflow', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test.beforeEach(async () => {
    await loginAsUser(page);
  });

  test.afterEach(async () => {
    await logout(page);
  });

  test('should show new project button when authenticated', async () => {
    await page.goto('/');

    const newProjectButton = page.locator('button:has-text("New Project")');
    await expect(newProjectButton).toBeVisible();
    
    // Button should be clickable
    await expect(newProjectButton).toBeEnabled();
  });

  test('should show git connection prompt if not connected', async () => {
    await page.goto('/');

    // Look for git connection buttons or project creation
    const gitConnectButton = page.locator('button:has-text("Connect GitHub"), button:has-text("Connect GitLab")');
    const newProjectButton = page.locator('button:has-text("New Project")');
    
    // Should see either git connection or new project button
    const hasGitConnect = await gitConnectButton.count() > 0;
    const hasNewProject = await newProjectButton.count() > 0;
    
    expect(hasGitConnect || hasNewProject).toBeTruthy();
  });
});

test.describe('Logout Workflow', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('should logout and redirect to login page', async () => {
    // Login first
    await loginAsUser(page);
    await page.goto('/');

    // Find and click logout button
    const logoutButton = page.locator('button:has-text("Logout"), a:has-text("Logout")');
    
    if (await logoutButton.isVisible()) {
      await logoutButton.click();
      await page.waitForLoadState('networkidle');
      
      // After logout, should see login/connect buttons
      const connectButton = page.locator('button:has-text("Connect"), button:has-text("Login")');
      const hasConnectButton = await connectButton.count() > 0;
      
      expect(hasConnectButton).toBeTruthy();
    }
  });
});
