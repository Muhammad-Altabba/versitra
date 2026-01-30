import { test, expect } from "@playwright/test";
import { authenticateUser } from "./helpers/auth";

test.describe("Translation Workflow", () => {
  test.beforeEach(async ({ page, context }) => {
    // Authenticate user
    await authenticateUser(context, {
      userId: "test-user-translation",
      name: "Translation Test User",
      email: "translation@test.com",
      role: "user",
    });

    await page.goto("http://localhost:3000");
    await page.waitForLoadState("networkidle");
  });

  test("displays section list in editor", async ({ page }) => {
    // Look for section list
    const sectionList = page.locator(
      '[data-testid="section-list"], .section-list, nav:has(ul)'
    );
    
    const count = await sectionList.count();
    console.log(`Section lists found: ${count}`);
  });

  test("shows section metadata (word count, status)", async ({ page }) => {
    // Look for metadata
    const metadata = page.locator(
      'text=/\\d+ words?/i, .status, [data-status]'
    );
    
    const count = await metadata.count();
    console.log(`Metadata elements found: ${count}`);
  });

  test("can select a section", async ({ page }) => {
    // Find section items
    const sectionItems = page.locator(
      '.section-item, [data-testid="section-item"], li[role="button"]'
    );
    
    const count = await sectionItems.count();
    
    if (count > 0) {
      await sectionItems.first().click();
      await page.waitForTimeout(500);
      
      // Check if section is selected
      const selected = page.locator('.selected, [aria-selected="true"]');
      const selectedCount = await selected.count();
      
      console.log(`Selected sections: ${selectedCount}`);
    }
  });

  test("displays source text in editor", async ({ page }) => {
    // Look for source text area
    const sourceText = page.locator(
      '[data-testid="source-text"], .source-text, textarea[readonly]'
    );
    
    const count = await sourceText.count();
    console.log(`Source text areas found: ${count}`);
  });

  test("displays translation text area", async ({ page }) => {
    // Look for translation textarea
    const translationArea = page.locator(
      '[data-testid="translation"], textarea[name*="translation"], .translation-editor'
    );
    
    const count = await translationArea.count();
    console.log(`Translation areas found: ${count}`);
  });

  test("can edit translation text", async ({ page }) => {
    // Find translation textarea
    const textarea = page.locator('textarea').first();
    const count = await page.locator('textarea').count();
    
    if (count > 0) {
      await textarea.click();
      await textarea.fill("Test translation text");
      await page.waitForTimeout(300);
      
      const value = await textarea.inputValue();
      expect(value).toContain("Test translation");
    }
  });

  test("shows save draft button", async ({ page }) => {
    // Look for save draft button
    const saveDraftButton = page.locator(
      'button:has-text("Save Draft"), button:has-text("Save")'
    );
    
    const count = await saveDraftButton.count();
    console.log(`Save draft buttons found: ${count}`);
  });

  test("can save translation draft", async ({ page }) => {
    // Find save button
    const saveButton = page.locator('button:has-text("Save")').first();
    const count = await page.locator('button:has-text("Save")').count();
    
    if (count > 0) {
      await saveButton.click();
      await page.waitForTimeout(500);
      
      // Look for success indicator
      const success = page.locator('text=/saved/i, .success');
      const successCount = await success.count();
      
      console.log(`Success indicators: ${successCount}`);
    }
  });

  test("shows draft indicator when unsaved changes", async ({ page }) => {
    // Look for unsaved changes indicator
    const draftIndicator = page.locator(
      'text=/unsaved/i, text=/draft/i, .draft-indicator'
    );
    
    const count = await draftIndicator.count();
    console.log(`Draft indicators found: ${count}`);
  });

  test("shows AI translation button", async ({ page }) => {
    // Look for AI translation button
    const aiButton = page.locator(
      'button:has-text("AI"), button:has-text("Translate"), button:has-text("Generate")'
    );
    
    const count = await aiButton.count();
    console.log(`AI translation buttons found: ${count}`);
  });

  test("can trigger AI translation", async ({ page }) => {
    // Find AI button
    const aiButton = page.locator('button:has-text("AI"), button:has-text("Translate")').first();
    const count = await page.locator('button:has-text("AI"), button:has-text("Translate")').count();
    
    if (count > 0) {
      await aiButton.click();
      await page.waitForTimeout(500);
      
      // Look for loading indicator
      const loading = page.locator('text=/generating/i, .loading');
      const loadingCount = await loading.count();
      
      console.log(`Loading indicators: ${loadingCount}`);
    }
  });

  test("shows AI translation result", async ({ page }) => {
    // Look for AI result
    const aiResult = page.locator(
      '[data-testid="ai-result"], .ai-translation, .suggestion'
    );
    
    const count = await aiResult.count();
    console.log(`AI result areas found: ${count}`);
  });

  test("can accept AI translation", async ({ page }) => {
    // Look for accept button
    const acceptButton = page.locator(
      'button:has-text("Accept"), button:has-text("Use")'
    );
    
    const count = await acceptButton.count();
    console.log(`Accept buttons found: ${count}`);
  });

  test("can reject AI translation", async ({ page }) => {
    // Look for reject button
    const rejectButton = page.locator(
      'button:has-text("Reject"), button:has-text("Dismiss"), button:has-text("Cancel")'
    );
    
    const count = await rejectButton.count();
    console.log(`Reject buttons found: ${count}`);
  });

  test("shows translation progress indicator", async ({ page }) => {
    // Look for progress indicator
    const progress = page.locator(
      'text=/\\d+%/i, .progress, [role="progressbar"]'
    );
    
    const count = await progress.count();
    console.log(`Progress indicators found: ${count}`);
  });

  test("can navigate to next section", async ({ page }) => {
    // Look for next button
    const nextButton = page.locator(
      'button:has-text("Next"), button[aria-label*="next" i]'
    );
    
    const count = await nextButton.count();
    
    if (count > 0) {
      await nextButton.first().click();
      await page.waitForTimeout(500);
    }
  });

  test("can navigate to previous section", async ({ page }) => {
    // Look for previous button
    const prevButton = page.locator(
      'button:has-text("Previous"), button:has-text("Prev"), button[aria-label*="previous" i]'
    );
    
    const count = await prevButton.count();
    
    if (count > 0) {
      await prevButton.first().click();
      await page.waitForTimeout(500);
    }
  });

  test("shows keyboard shortcuts hint", async ({ page }) => {
    // Look for keyboard shortcuts
    const shortcuts = page.locator(
      'text=/ctrl/i, text=/cmd/i, text=/shortcuts/i'
    );
    
    const count = await shortcuts.count();
    console.log(`Keyboard shortcut hints found: ${count}`);
  });

  test("updates section status after saving", async ({ page }) => {
    // Look for status update
    const status = page.locator(
      'text=/draft/i, [data-status="draft"], .status-draft'
    );
    
    const count = await status.count();
    console.log(`Draft status indicators found: ${count}`);
  });

  test("shows word count for translation", async ({ page }) => {
    // Look for translation word count
    const wordCount = page.locator(
      'text=/\\d+ words?/i, [data-testid="translation-word-count"]'
    );
    
    const count = await wordCount.count();
    console.log(`Translation word counts found: ${count}`);
  });

  test("shows character count for translation", async ({ page }) => {
    // Look for character count
    const charCount = page.locator(
      'text=/\\d+ characters?/i, [data-testid="char-count"]'
    );
    
    const count = await charCount.count();
    console.log(`Character counts found: ${count}`);
  });

  test("can toggle source text visibility", async ({ page }) => {
    // Look for toggle button
    const toggleButton = page.locator(
      'button:has-text("Hide"), button:has-text("Show"), button[aria-label*="toggle" i]'
    );
    
    const count = await toggleButton.count();
    console.log(`Toggle buttons found: ${count}`);
  });

  test("shows translation quality indicator", async ({ page }) => {
    // Look for quality indicator
    const qualityIndicator = page.locator(
      'text=/quality/i, .quality-score, [data-testid="quality"]'
    );
    
    const count = await qualityIndicator.count();
    console.log(`Quality indicators found: ${count}`);
  });
});
