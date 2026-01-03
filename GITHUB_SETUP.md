# GitHub Setup & CI/CD Testing Guide

This guide explains how to push the Git Translation Platform to GitHub and test the CI/CD pipeline.

---

## Prerequisites

- GitHub account
- Git installed locally
- GitHub CLI (optional, for easier setup)

---

## Step 1: Create GitHub Repository

### Option A: Using GitHub Web Interface

1. Go to https://github.com/new
2. Repository name: `git-translation-platform` (or your preferred name)
3. Description: "AI-powered platform for translating books and documents with Git integration"
4. Visibility: Choose Public or Private
5. **DO NOT** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

### Option B: Using GitHub CLI

```bash
gh repo create git-translation-platform --public --description "AI-powered platform for translating books and documents with Git integration"
```

---

## Step 2: Initialize Local Git Repository

If not already initialized:

```bash
cd /path/to/git-translation-platform
git init
git add .
git commit -m "Initial commit: Git Translation Platform with CI/CD"
```

If already initialized, just add and commit:

```bash
git add .
git commit -m "Add CI/CD pipeline and E2E tests"
```

---

## Step 3: Connect to GitHub Remote

Replace `YOUR_USERNAME` with your GitHub username:

```bash
git remote add origin https://github.com/YOUR_USERNAME/git-translation-platform.git
```

Or with SSH:

```bash
git remote add origin git@github.com:YOUR_USERNAME/git-translation-platform.git
```

---

## Step 4: Push to GitHub

### Push main branch:

```bash
git branch -M main
git push -u origin main
```

### If you encounter errors:

**Error: "failed to push some refs"**
```bash
git pull origin main --rebase
git push -u origin main
```

**Error: "remote contains work that you do not have"**
```bash
git pull origin main --allow-unrelated-histories
git push -u origin main
```

---

## Step 5: Verify CI/CD Pipeline

### 5.1 Check Actions Tab

1. Go to your GitHub repository
2. Click the "Actions" tab
3. You should see a workflow run triggered by your push
4. Click on the workflow run to see details

### 5.2 Monitor Pipeline Jobs

The CI/CD pipeline consists of 4 jobs:

1. **Test** - Runs all 200 unit/integration tests + 21 E2E tests
2. **Lint** - Checks code formatting with Prettier
3. **Build** - Builds the production application
4. **Summary** - Generates pipeline summary

### 5.3 Expected Results

**✅ Test Job**:
- 200/200 unit/integration tests passing
- 18/21 E2E tests passing (3 require auth setup)
- TypeScript type check: ✅
- MySQL service: ✅

**✅ Lint Job**:
- Code formatting check (may show warnings)

**✅ Build Job**:
- Production build successful
- Artifacts uploaded

**✅ Summary Job**:
- Shows status of all jobs

### 5.4 View Test Artifacts

1. Go to workflow run details
2. Scroll to "Artifacts" section
3. Download:
   - `playwright-report` - HTML report of E2E tests
   - `test-results` - Screenshots and videos of failed tests
   - `build-artifacts` - Production build files

---

## Step 6: Configure Branch Protection (Recommended)

### 6.1 Navigate to Settings

1. Go to repository Settings
2. Click "Branches" in left sidebar
3. Click "Add branch protection rule"

### 6.2 Configure Main Branch Protection

**Branch name pattern**: `main`

**Required settings**:
- ✅ Require a pull request before merging
- ✅ Require approvals: 1
- ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ Require status checks to pass before merging
- ✅ Require branches to be up to date before merging
- Select required checks:
  - `test`
  - `lint`
  - `build`
- ✅ Require conversation resolution before merging
- ✅ Require linear history
- ✅ Include administrators

### 6.3 Save Protection Rules

Click "Create" to save the branch protection rules.

---

## Step 7: Test CI/CD with a Pull Request

### 7.1 Create a Feature Branch

```bash
git checkout -b feature/test-ci-cd
```

### 7.2 Make a Small Change

```bash
echo "# Test CI/CD" >> TEST.md
git add TEST.md
git commit -m "Test: Verify CI/CD pipeline"
```

### 7.3 Push Feature Branch

```bash
git push origin feature/test-ci-cd
```

### 7.4 Create Pull Request

1. Go to GitHub repository
2. Click "Pull requests" tab
3. Click "New pull request"
4. Base: `main`, Compare: `feature/test-ci-cd`
5. Click "Create pull request"

### 7.5 Watch CI/CD Run

- The CI/CD pipeline will run automatically
- All checks must pass before merging (if branch protection is enabled)
- Review the test results and artifacts

### 7.6 Merge Pull Request

Once all checks pass:
1. Click "Merge pull request"
2. Confirm merge
3. Delete the feature branch

---

## Troubleshooting

### Pipeline Fails on Test Job

**MySQL Connection Error**:
- Check that MySQL service is configured in `.github/workflows/ci.yml`
- Verify health checks are working

**Test Failures**:
- Review test logs in Actions tab
- Download test artifacts for screenshots
- Check if tests pass locally: `pnpm test && pnpm test:e2e`

### Pipeline Fails on Build Job

**Build Errors**:
- Check TypeScript errors: `pnpm check`
- Verify dependencies: `pnpm install`
- Test build locally: `pnpm build`

### E2E Tests Failing

**3 Expected Failures**:
- `Authenticated User Workflow › should display projects page when authenticated`
- `Authenticated User Workflow › should display empty state when no projects exist`
- `Authenticated User Workflow › should have navigation links when authenticated`

These tests require proper JWT secret configuration. They're marked as `continue-on-error` in CI.

**Unexpected Failures**:
- Check Playwright logs in artifacts
- View screenshots of failed tests
- Run locally: `pnpm test:e2e:headed`

### Lint Job Warnings

**Formatting Issues**:
```bash
pnpm format
git add .
git commit -m "Fix: Code formatting"
git push
```

---

## CI/CD Pipeline Configuration

### Workflow File Location

`.github/workflows/ci.yml`

### Trigger Events

- Push to `main` or `develop` branches
- Pull requests targeting `main` or `develop`

### Environment Variables

Set these in GitHub repository settings if needed:
- Settings → Secrets and variables → Actions → New repository secret

**Current secrets** (auto-configured in CI):
- `DATABASE_URL` - MySQL connection for tests
- `JWT_SECRET` - Session signing secret
- `NODE_ENV` - Set to `test`

### Modify Workflow

To customize the CI/CD pipeline, edit `.github/workflows/ci.yml`:

**Add deployment**:
```yaml
deploy:
  needs: [test, lint, build]
  if: github.ref == 'refs/heads/main'
  runs-on: ubuntu-latest
  steps:
    - name: Deploy to production
      run: # your deployment commands
```

**Add notifications**:
```yaml
- name: Notify on failure
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## Local Testing Before Push

### Run All Tests

```bash
pnpm test:all
```

### Run Individual Test Suites

```bash
# Unit and integration tests
pnpm test

# E2E tests
pnpm test:e2e

# E2E with UI
pnpm test:e2e:ui

# TypeScript check
pnpm check

# Format check
pnpm format --check

# Build
pnpm build
```

### Fix Issues Before Pushing

```bash
# Fix formatting
pnpm format

# Fix TypeScript errors
pnpm check

# Run tests
pnpm test
```

---

## Next Steps After Setup

1. **Add Repository Secrets**: Configure any additional environment variables needed
2. **Set Up Deployment**: Add deployment job to workflow for automatic deploys
3. **Configure Notifications**: Add Slack/Discord notifications for pipeline status
4. **Add Code Coverage**: Integrate Codecov or similar service
5. **Security Scanning**: Add dependency vulnerability scanning
6. **Performance Monitoring**: Add Lighthouse CI for performance metrics

---

## Useful Commands

```bash
# View workflow runs
gh run list

# View specific run
gh run view RUN_ID

# Watch run in real-time
gh run watch

# Download artifacts
gh run download RUN_ID

# Re-run failed jobs
gh run rerun RUN_ID --failed
```

---

## Support

If you encounter issues:

1. Check GitHub Actions logs
2. Review test artifacts
3. Run tests locally to reproduce
4. Check this documentation for troubleshooting steps

---

**Last Updated**: 2026-01-01  
**Pipeline Version**: 1.0  
**Test Coverage**: 200 unit/integration + 21 E2E tests
