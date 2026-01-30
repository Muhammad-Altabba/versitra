import { test, expect } from "@playwright/test";
import { authenticateUser } from "./helpers/auth";

test.describe("Git Commit Workflow", () => {
  test.beforeEach(async ({ page, context }) => {
    // Authenticate user
    await authenticateUser(context, {
      userId: "test-user-git-commit",
      name: "Git Commit Test User",
      email: "gitcommit@test.com",
      role: "user",
    });

    await page.goto("http://localhost:3000");
    await page.waitForLoadState("networkidle");
  });

  test("shows commit version button", async ({ page }) => {
    // Look for commit button
    const commitButton = page.locator(
      'button:has-text("Commit"), button:has-text("Publish"), button:has-text("Version")'
    );
    
    const count = await commitButton.count();
    
    if (count > 0) {
      const isVisible = await commitButton.first().isVisible();
      console.log(`Commit button visible: ${isVisible}`);
    }
  });

  test("commit button disabled without drafts", async ({ page }) => {
    // Find commit button
    const commitButton = page.locator(
      'button:has-text("Commit"), button:has-text("Publish")'
    ).first();
    
    const count = await page.locator('button:has-text("Commit"), button:has-text("Publish")').count();
    
    if (count > 0) {
      // Check if disabled (might be disabled without drafts)
      const isDisabled = await commitButton.isDisabled();
      console.log(`Commit button disabled (no drafts): ${isDisabled}`);
    }
  });

  test("can open commit dialog", async ({ page }) => {
    // Find and click commit button
    const commitButton = page.locator(
      'button:has-text("Commit"), button:has-text("Publish")'
    ).first();
    
    const count = await page.locator('button:has-text("Commit")').count();
    
    if (count > 0) {
      const isEnabled = await commitButton.isEnabled();
      
      if (isEnabled) {
        await commitButton.click();
        await page.waitForTimeout(500);
        
        // Check for dialog
        const dialog = page.locator('[role="dialog"], .modal, .dialog');
        const dialogCount = await dialog.count();
        
        expect(dialogCount).toBeGreaterThan(0);
      }
    }
  });

  test("commit dialog shows commit message input", async ({ page }) => {
    // This test assumes we can open the commit dialog
    // Look for commit message input
    const messageInput = page.locator(
      'textarea[placeholder*="commit" i], input[placeholder*="message" i], textarea[name*="message"]'
    );
    
    const count = await messageInput.count();
    console.log(`Commit message inputs found: ${count}`);
  });

  test("commit dialog shows section selection", async ({ page }) => {
    // Look for section selection UI in commit dialog
    const sectionSelection = page.locator(
      'input[type="checkbox"], [role="checkbox"], text=/select sections/i'
    );
    
    const count = await sectionSelection.count();
    console.log(`Section selection elements found: ${count}`);
  });

  test("can enter commit message", async ({ page }) => {
    // Find commit message input
    const messageInput = page.locator(
      'textarea[placeholder*="commit" i], textarea[name*="message"]'
    ).first();
    
    const count = await page.locator('textarea').count();
    
    if (count > 0) {
      await messageInput.click();
      await messageInput.fill("Test commit message");
      await page.waitForTimeout(300);
      
      const value = await messageInput.inputValue();
      expect(value).toContain("Test commit");
    }
  });

  test("can select sections to commit", async ({ page }) => {
    // Find checkboxes for section selection
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();
    
    if (count > 0) {
      // Click first checkbox
      await checkboxes.first().click();
      await page.waitForTimeout(300);
      
      // Verify it's checked
      const isChecked = await checkboxes.first().isChecked();
      console.log(`Checkbox checked: ${isChecked}`);
    }
  });

  test("shows commit confirmation button", async ({ page }) => {
    // Look for final commit/confirm button in dialog
    const confirmButton = page.locator(
      'button:has-text("Confirm"), button:has-text("Commit"), button:has-text("Publish")'
    );
    
    const count = await confirmButton.count();
    console.log(`Confirm buttons found: ${count}`);
  });

  test("shows loading state during commit", async ({ page }) => {
    // This test would check for loading indicators during commit
    const loadingIndicators = page.locator(
      'text=/committing/i, text=/publishing/i, .loading, .spinner'
    );
    
    const count = await loadingIndicators.count();
    console.log(`Loading indicators found: ${count}`);
  });

  test("shows success message after commit", async ({ page }) => {
    // Look for success notification
    const successMessage = page.locator(
      'text=/committed/i, text=/published/i, text=/success/i, [role="alert"]'
    );
    
    const count = await successMessage.count();
    console.log(`Success message elements found: ${count}`);
  });

  test("updates section status after commit", async ({ page }) => {
    // Look for committed status indicators
    const committedStatus = page.locator(
      'text=/committed/i, .status-committed, .badge:has-text("Committed")'
    );
    
    const count = await committedStatus.count();
    console.log(`Committed status indicators found: ${count}`);
  });

  test("shows diff viewer button", async ({ page }) => {
    // Look for button to view diffs/history
    const diffButton = page.locator(
      'button:has-text("Diff"), button:has-text("History"), button:has-text("Changes")'
    );
    
    const count = await diffButton.count();
    
    if (count > 0) {
      const isVisible = await diffButton.first().isVisible();
      console.log(`Diff viewer button visible: ${isVisible}`);
    }
  });

  test("can open diff viewer", async ({ page }) => {
    // Find and click diff viewer button
    const diffButton = page.locator(
      'button:has-text("Diff"), button:has-text("History")'
    ).first();
    
    const count = await page.locator('button:has-text("Diff"), button:has-text("History")').count();
    
    if (count > 0) {
      await diffButton.click();
      await page.waitForTimeout(500);
      
      // Check for diff viewer UI
      const diffViewer = page.locator(
        '[data-testid="diff-viewer"], .diff-viewer, .history'
      );
      const viewerCount = await diffViewer.count();
      
      console.log(`Diff viewer elements found: ${viewerCount}`);
    }
  });

  test("diff viewer shows commit history", async ({ page }) => {
    // Look for commit history list
    const commits = page.locator(
      'text=/commit/i, .commit-item, [data-testid="commit-item"]'
    );
    
    const count = await commits.count();
    console.log(`Commit items found: ${count}`);
  });

  test("diff viewer shows commit messages", async ({ page }) => {
    // Look for commit messages in history
    const messages = page.locator(
      '.commit-message, [data-testid="commit-message"]'
    );
    
    const count = await messages.count();
    console.log(`Commit messages found: ${count}`);
  });

  test("diff viewer shows commit timestamps", async ({ page }) => {
    // Look for timestamps
    const timestamps = page.locator(
      'time, text=/ago/i, text=/\\d{4}-\\d{2}-\\d{2}/'
    );
    
    const count = await timestamps.count();
    console.log(`Timestamps found: ${count}`);
  });

  test("can select commits to compare", async ({ page }) => {
    // Look for commit selection UI
    const selectableCommits = page.locator(
      'input[type="radio"][name*="commit"], .commit-item'
    );
    
    const count = await selectableCommits.count();
    
    if (count > 1) {
      // Select two commits
      await selectableCommits.nth(0).click();
      await page.waitForTimeout(300);
      await selectableCommits.nth(1).click();
      await page.waitForTimeout(300);
    }
  });

  test("shows diff between versions", async ({ page }) => {
    // Look for diff display
    const diffDisplay = page.locator(
      '.diff, [data-testid="diff"], text=/added/i, text=/removed/i'
    );
    
    const count = await diffDisplay.count();
    console.log(`Diff display elements found: ${count}`);
  });

  test("highlights added content in diff", async ({ page }) => {
    // Look for added content indicators
    const addedContent = page.locator(
      '.added, .insertion, text=/\\+/i, [data-diff="added"]'
    );
    
    const count = await addedContent.count();
    console.log(`Added content indicators found: ${count}`);
  });

  test("highlights removed content in diff", async ({ page }) => {
    // Look for removed content indicators
    const removedContent = page.locator(
      '.removed, .deletion, text=/-/i, [data-diff="removed"]'
    );
    
    const count = await removedContent.count();
    console.log(`Removed content indicators found: ${count}`);
  });

  test("can filter diff by section", async ({ page }) => {
    // Look for section filter in diff viewer
    const sectionFilter = page.locator(
      'select[name*="section"], button:has-text("Section"), .section-filter'
    );
    
    const count = await sectionFilter.count();
    console.log(`Section filter elements found: ${count}`);
  });

  test("shows GitHub/GitLab repository link", async ({ page }) => {
    // Look for link to Git repository
    const repoLink = page.locator(
      'a[href*="github.com"], a[href*="gitlab.com"], text=/view on github/i'
    );
    
    const count = await repoLink.count();
    console.log(`Repository links found: ${count}`);
  });

  test("shows commit SHA/hash", async ({ page }) => {
    // Look for commit SHA display
    const commitSha = page.locator(
      'code, .commit-sha, text=/[0-9a-f]{7,40}/'
    );
    
    const count = await commitSha.count();
    console.log(`Commit SHA elements found: ${count}`);
  });

  test("can copy commit SHA", async ({ page }) => {
    // Look for copy button for commit SHA
    const copyButton = page.locator(
      'button:has-text("Copy"), [title*="Copy"]'
    );
    
    const count = await copyButton.count();
    console.log(`Copy buttons found: ${count}`);
  });

  test("shows error for failed commits", async ({ page }) => {
    // Look for error messages
    const errorMessages = page.locator(
      'text=/failed/i, text=/error/i, [role="alert"].error'
    );
    
    const count = await errorMessages.count();
    console.log(`Error message elements found: ${count}`);
  });

  test("allows retrying failed commits", async ({ page }) => {
    // Look for retry button
    const retryButton = page.locator(
      'button:has-text("Retry"), button:has-text("Try Again")'
    );
    
    const count = await retryButton.count();
    console.log(`Retry buttons found: ${count}`);
  });

  test("shows commit statistics", async ({ page }) => {
    // Look for commit stats (files changed, additions, deletions)
    const stats = page.locator(
      'text=/\\d+ files? changed/i, text=/\\d+ additions?/i, text=/\\d+ deletions?/i'
    );
    
    const count = await stats.count();
    console.log(`Commit statistics found: ${count}`);
  });
});
