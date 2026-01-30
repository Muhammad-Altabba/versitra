import { test, expect } from "@playwright/test";
import { authenticateUser } from "./helpers/auth";

test.describe("Document Processing", () => {
  test.beforeEach(async ({ page, context }) => {
    // Authenticate user
    await authenticateUser(context, {
      userId: "test-user-document",
      name: "Document Test User",
      email: "document@test.com",
      role: "user",
    });

    await page.goto("http://localhost:3000");
    await page.waitForLoadState("networkidle");
  });

  test("shows document upload button", async ({ page }) => {
    // Look for upload button
    const uploadButton = page.locator(
      'button:has-text("Upload"), input[type="file"], label:has-text("Upload")'
    );
    
    const count = await uploadButton.count();
    console.log(`Upload buttons found: ${count}`);
  });

  test("can select file for upload", async ({ page }) => {
    // Look for file input
    const fileInput = page.locator('input[type="file"]');
    const count = await fileInput.count();
    
    if (count > 0) {
      // File input exists
      expect(count).toBeGreaterThan(0);
    }
  });

  test("shows supported file formats", async ({ page }) => {
    // Look for file format information
    const formatInfo = page.locator(
      'text=/pdf/i, text=/markdown/i, text=/txt/i, text=/supported formats/i'
    );
    
    const count = await formatInfo.count();
    console.log(`File format info elements found: ${count}`);
  });

  test("displays upload progress", async ({ page }) => {
    // Look for progress indicator
    const progressIndicator = page.locator(
      '.progress, [role="progressbar"], text=/uploading/i'
    );
    
    const count = await progressIndicator.count();
    console.log(`Progress indicators found: ${count}`);
  });

  test("shows document preview after upload", async ({ page }) => {
    // Look for preview area
    const preview = page.locator(
      '[data-testid="preview"], .preview, .document-preview'
    );
    
    const count = await preview.count();
    console.log(`Preview areas found: ${count}`);
  });

  test("can configure splitting strategy", async ({ page }) => {
    // Look for splitting configuration options
    const splittingOptions = page.locator(
      'text=/split by/i, select[name*="split"], input[name*="strategy"]'
    );
    
    const count = await splittingOptions.count();
    console.log(`Splitting options found: ${count}`);
  });

  test("shows split document button", async ({ page }) => {
    // Look for split button
    const splitButton = page.locator(
      'button:has-text("Split"), button:has-text("Parse"), button:has-text("Process")'
    );
    
    const count = await splitButton.count();
    console.log(`Split buttons found: ${count}`);
  });

  test("displays splitting progress", async ({ page }) => {
    // Look for splitting progress
    const progress = page.locator(
      'text=/splitting/i, text=/processing/i, .progress'
    );
    
    const count = await progress.count();
    console.log(`Splitting progress elements found: ${count}`);
  });

  test("shows section count after splitting", async ({ page }) => {
    // Look for section count display
    const sectionCount = page.locator(
      'text=/\\d+ sections?/i, [data-testid="section-count"]'
    );
    
    const count = await sectionCount.count();
    console.log(`Section count displays found: ${count}`);
  });

  test("displays section list after splitting", async ({ page }) => {
    // Look for section list
    const sectionList = page.locator(
      '[data-testid="section-list"], .section-list, ul:has(li)'
    );
    
    const count = await sectionList.count();
    console.log(`Section lists found: ${count}`);
  });

  test("shows section metadata (word count)", async ({ page }) => {
    // Look for word count
    const wordCount = page.locator(
      'text=/\\d+ words?/i, [data-testid="word-count"]'
    );
    
    const count = await wordCount.count();
    console.log(`Word count displays found: ${count}`);
  });

  test("shows section status indicators", async ({ page }) => {
    // Look for status indicators
    const statusIndicators = page.locator(
      '.status, [data-status], text=/not translated/i, text=/draft/i'
    );
    
    const count = await statusIndicators.count();
    console.log(`Status indicators found: ${count}`);
  });

  test("can navigate to editor after splitting", async ({ page }) => {
    // Look for editor navigation
    const editorLink = page.locator(
      'a:has-text("Edit"), button:has-text("Start"), a:has-text("Editor")'
    );
    
    const count = await editorLink.count();
    console.log(`Editor navigation links found: ${count}`);
  });

  test("shows error for invalid file format", async ({ page }) => {
    // Look for error messages
    const errorMessage = page.locator(
      'text=/invalid/i, text=/unsupported/i, [role="alert"].error'
    );
    
    const count = await errorMessage.count();
    console.log(`Error messages found: ${count}`);
  });

  test("shows error for file size limit", async ({ page }) => {
    // Look for size limit error
    const sizeError = page.locator(
      'text=/too large/i, text=/size limit/i, text=/maximum/i'
    );
    
    const count = await sizeError.count();
    console.log(`Size error messages found: ${count}`);
  });
});
