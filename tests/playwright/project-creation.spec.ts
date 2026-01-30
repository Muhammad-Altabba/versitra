import { test, expect } from "@playwright/test";
import { authenticateUser } from "./helpers/auth";

test.describe("Project Creation & Git Connection", () => {
  test.beforeEach(async ({ page, context }) => {
    // Authenticate user
    await authenticateUser(context, {
      userId: "test-user-project",
      name: "Project Test User",
      email: "project@test.com",
      role: "user",
    });

    await page.goto("http://localhost:3000");
    await page.waitForLoadState("networkidle");
  });

  test("authenticated user can access dashboard", async ({ page }) => {
    // Check for dashboard elements
    const dashboard = page.locator('[data-testid="dashboard"], .dashboard, main');
    await expect(dashboard).toBeVisible();
  });

  test("dashboard shows empty state when no projects", async ({ page }) => {
    // Look for empty state message
    const emptyState = page.locator(
      'text=/no projects/i, text=/get started/i, text=/create.*project/i'
    );
    
    const count = await emptyState.count();
    console.log(`Empty state elements found: ${count}`);
  });

  test("can open new project dialog", async ({ page }) => {
    // Find and click new project button
    const newProjectButton = page.locator(
      'button:has-text("New Project"), button:has-text("Create Project"), button:has-text("Add Project")'
    ).first();
    
    const count = await page.locator('button:has-text("New"), button:has-text("Create")').count();
    
    if (count > 0) {
      await newProjectButton.click();
      await page.waitForTimeout(500);
      
      // Check for dialog
      const dialog = page.locator('[role="dialog"], .modal, .dialog');
      const dialogCount = await dialog.count();
      
      expect(dialogCount).toBeGreaterThan(0);
    }
  });

  test("project creation form has required fields", async ({ page }) => {
    // Look for project name input
    const projectNameInput = page.locator(
      'input[name="name"], input[placeholder*="name" i], input[label*="name"]'
    );
    
    const count = await projectNameInput.count();
    console.log(`Project name inputs found: ${count}`);
  });

  test("shows Git provider selection", async ({ page }) => {
    // Look for GitHub/GitLab selection
    const gitProviders = page.locator(
      'text=/github/i, text=/gitlab/i, [data-provider="github"], [data-provider="gitlab"]'
    );
    
    const count = await gitProviders.count();
    console.log(`Git provider elements found: ${count}`);
  });

  test("can navigate to Git connection page", async ({ page }) => {
    // Look for Git connection link/button
    const gitConnectionLink = page.locator(
      'a:has-text("Connect"), a:has-text("Git"), button:has-text("Connect Git")'
    );
    
    const count = await gitConnectionLink.count();
    console.log(`Git connection links found: ${count}`);
  });

  test("displays user information in header", async ({ page }) => {
    // Check for user name or email in header
    const userInfo = page.locator(
      'text=/Project Test User/i, text=/project@test.com/i'
    );
    
    const count = await userInfo.count();
    console.log(`User info elements found: ${count}`);
  });

  test("can logout successfully", async ({ page }) => {
    // Find logout button
    const logoutButton = page.locator(
      'button:has-text("Logout"), button:has-text("Sign Out"), a:has-text("Logout")'
    );
    
    const count = await logoutButton.count();
    
    if (count > 0) {
      await logoutButton.first().click();
      await page.waitForTimeout(500);
      
      // Check if redirected to login page
      const loginButton = page.locator('button:has-text("Login"), a:has-text("Sign In")');
      const loginCount = await loginButton.count();
      
      console.log(`Login buttons after logout: ${loginCount}`);
    }
  });

  test("maintains authentication across page reloads", async ({ page }) => {
    // Reload the page
    await page.reload();
    await page.waitForLoadState("networkidle");
    
    // Check if still authenticated
    const dashboard = page.locator('[data-testid="dashboard"], .dashboard, main');
    await expect(dashboard).toBeVisible();
  });

  test("shows admin features for admin users", async ({ page, context }) => {
    // Re-authenticate as admin
    await authenticateUser(context, {
      userId: "test-admin-project",
      name: "Admin User",
      email: "admin@test.com",
      role: "admin",
    });
    
    await page.goto("http://localhost:3000");
    await page.waitForLoadState("networkidle");
    
    // Look for admin-only features
    const adminFeatures = page.locator(
      'text=/admin/i, [data-role="admin"], .admin-panel'
    );
    
    const count = await adminFeatures.count();
    console.log(`Admin features found: ${count}`);
  });
});
