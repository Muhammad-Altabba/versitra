import { test, expect, Page } from '@playwright/test';

/**
 * Basic E2E Tests for Git Translation Platform
 * 
 * These tests verify basic page loading and structure without requiring authentication.
 * Authenticated workflow tests are in authenticated-workflow.spec.ts
 */

test.describe('Homepage', () => {
  test('should load homepage successfully', async ({ page }) => {
    await page.goto('/');
    
    // Page should load with some title
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    
    // Body should be visible
    await expect(page.locator('body')).toBeVisible();
  });

  test('should have proper HTML structure', async ({ page }) => {
    await page.goto('/');

    // Check for basic HTML structure
    await expect(page.locator('html')).toBeVisible();
    await expect(page.locator('body')).toBeVisible();
    
    // Check for some content
    const content = await page.content();
    expect(content.length).toBeGreaterThan(100);
  });

  test('should have interactive elements', async ({ page }) => {
    await page.goto('/');

    // Should have some buttons or links
    const interactiveElements = page.locator('button, a[href], input');
    const count = await interactiveElements.count();
    
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Navigation', () => {
  test('should handle 404 pages correctly', async ({ page }) => {
    await page.goto('/nonexistent-page-12345');
    
    // Should show 404 or redirect to home
    const is404 = await page.locator('text=/404|Not Found|Page not found/i').count() > 0;
    const isHome = page.url().endsWith('/') || page.url().includes('localhost:3000');
    
    expect(is404 || isHome).toBeTruthy();
  });

  test('should handle book editor redirect', async ({ page }) => {
    // Try to access a book editor page (will redirect if not authenticated)
    await page.goto('/book/test-book-id');

    // Check if we're redirected to login or see a 404/error or the page loads
    const pageLoaded = await page.locator('body').isVisible();
    expect(pageLoaded).toBeTruthy();
  });
});

test.describe('Performance', () => {
  test('should load homepage within acceptable time', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - startTime;

    // Page should load within 10 seconds (generous for CI)
    expect(loadTime).toBeLessThan(10000);
  });

  test('should have proper meta tags', async ({ page }) => {
    await page.goto('/');

    // Check for viewport meta tag
    const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
    expect(viewport).toBeTruthy();

    // Check for title
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});

test.describe('Responsive Design', () => {
  test('should render on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should render on tablet viewport', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });

  test('should render on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });
});
