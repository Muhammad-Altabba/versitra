# GitHub API 404 Error Fix - commitVersion Mutation

## Problem Description

When users tried to create a version by clicking "Create Version" and committing drafts to Git, the operation failed with a GitHub API 404 error:

```
Error: Not Found - https://docs.github.com/rest/repos/contents#create-or-update-file-contents
TRPCClientError: Not Found
```

This error occurred in the `commitVersion` mutation when trying to commit files to the GitHub repository.

### Root Cause

The `commitVersion` mutation was incorrectly parsing the owner and repository name from the `book.repoName` field:

```typescript
// BEFORE (incorrect):
const [owner, repo] = book.repoName.split('/');

// Fallback was also wrong:
owner || ctx.user.id.replace('github:', '')  // This gives user ID, not username
repo || book.repoName
```

**The Problem:**
1. `book.repoName` is stored as just the repository name (e.g., "my-translation-project"), NOT "owner/repo"
2. Splitting by "/" resulted in:
   - `owner` = undefined (no "/" to split on)
   - `repo` = "my-translation-project"
3. The fallback tried to extract owner from `ctx.user.id` by removing "github:" prefix, which gave the GitHub user ID (e.g., "12345"), not the username
4. GitHub API requires the actual username (e.g., "Muhammad-Altabba"), not the user ID
5. Calling `commitFile(userId, repoName, ...)` with wrong owner caused 404 error

### Why It Worked Before

The previous implementation used `commitFileMutation` directly from the frontend (BookEditor.tsx), which had access to `gitInfo.username`. The backend `commitVersion` mutation didn't have this information and tried to reconstruct it incorrectly.

## The Fix

### 1. Use getGitClient to Get Username

The `getGitClient` helper function already returns the correct username:

```typescript
const { client, username } = await getGitClient(ctx.user.id);
```

This gives us `username` from the Git credentials, which is the actual GitHub username.

### 2. Apply Same Logic as DiffViewer

Use the same owner/repo parsing logic that was already fixed in DiffViewer:

```typescript
// Parse owner and repo correctly (same logic as DiffViewer)
const owner = book.repoName.includes('/') 
  ? book.repoName.split('/')[0] 
  : username;
const repo = book.repoName.includes('/') 
  ? book.repoName.split('/')[1] 
  : book.repoName;
```

**This handles both cases:**
- **New format** (if repoName contains "/"): Split it
- **Current format** (repoName is just repo name): Use `username` as owner

### 3. Add Comprehensive Logging

Added logging at multiple points to help debug similar issues in the future:

```typescript
console.log('[Books.commitVersion] Committing drafts:', {
  bookId: input.bookId,
  repoName: book.repoName,
  username,
  draftCount: draftEntries.length,
  message: input.message,
});

console.log('[Books.commitVersion] Parsed repository info:', { owner, repo });

console.log(`[Books.commitVersion] Committing section ${sectionId} to ${owner}/${repo}`);
```

### 4. Better Error Handling

Wrapped the commit operation in try-catch with detailed error information:

```typescript
try {
  await Promise.all(commitPromises);
  console.log(`[Books.commitVersion] Successfully committed all ${draftEntries.length} sections`);
} catch (error: any) {
  console.error('[Books.commitVersion] Error committing sections:', {
    error: error.message,
    status: error.status,
    owner,
    repo,
    draftCount: draftEntries.length,
  });
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: `Failed to commit to Git: ${error.message}. Please check that the repository exists and you have access.`,
  });
}
```

## Code Changes

### Before
```typescript
// Get Git client
const { client } = await getGitClient(ctx.user.id);

// Commit each draft to Git
const commitPromises = draftEntries.map(async ([sectionId, draft]) => {
  if (book.gitProvider === 'github') {
    const [owner, repo] = book.repoName.split('/');
    
    // Commit source
    await (client as any).commitFile(
      owner || ctx.user.id.replace('github:', ''),  // ❌ Wrong: gives user ID
      repo || book.repoName,
      `source/${sectionId}.md`,
      draft.source,
      input.message,
      'main'
    );
    // ... more commits
  }
});

// Wait for all commits
await Promise.all(commitPromises);
```

### After
```typescript
// Get Git client
const { client, username } = await getGitClient(ctx.user.id);

console.log('[Books.commitVersion] Committing drafts:', {
  bookId: input.bookId,
  repoName: book.repoName,
  username,
  draftCount: draftEntries.length,
  message: input.message,
});

// Parse owner and repo correctly (same logic as DiffViewer)
const owner = book.repoName.includes('/') 
  ? book.repoName.split('/')[0] 
  : username;  // ✅ Correct: uses actual username
const repo = book.repoName.includes('/') 
  ? book.repoName.split('/')[1] 
  : book.repoName;

console.log('[Books.commitVersion] Parsed repository info:', { owner, repo });

// Commit each draft to Git
const commitPromises = draftEntries.map(async ([sectionId, draft]) => {
  if (book.gitProvider === 'github') {
    console.log(`[Books.commitVersion] Committing section ${sectionId} to ${owner}/${repo}`);
    
    // Commit source
    await (client as any).commitFile(
      owner,  // ✅ Correct: actual GitHub username
      repo,
      `source/${sectionId}.md`,
      draft.source,
      input.message,
      'main'
    );
    // ... more commits
  }
});

// Wait for all commits
try {
  await Promise.all(commitPromises);
  console.log(`[Books.commitVersion] Successfully committed all ${draftEntries.length} sections`);
} catch (error: any) {
  console.error('[Books.commitVersion] Error committing sections:', {
    error: error.message,
    status: error.status,
    owner,
    repo,
    draftCount: draftEntries.length,
  });
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: `Failed to commit to Git: ${error.message}. Please check that the repository exists and you have access.`,
  });
}
```

## Testing

### Test Scenario: Create Version with Drafts

**Prerequisites:**
- User has connected GitHub account
- User has created a translation project
- User has saved at least one section as a draft

**Steps:**
1. Open Book Editor
2. Translate and save 2-3 sections as drafts
3. Verify "Create Version" button shows badge with draft count
4. Click "Create Version" button
5. Enter version title (e.g., "Initial translation")
6. Click "Create Version" in dialog

**Expected Result:**
- Success toast: "Version created! Committed 2 sections"
- Badge disappears (no more drafts)
- Commits appear on GitHub
- Drafts cleared from database

**Server Logs Should Show:**
```
[Books.commitVersion] Committing drafts: {
  bookId: 'mzUaNUxo58rm_7rexZSvD',
  repoName: 'my-translation-project',
  username: 'Muhammad-Altabba',
  draftCount: 2,
  message: 'Initial translation'
}
[Books.commitVersion] Parsed repository info: { 
  owner: 'Muhammad-Altabba', 
  repo: 'my-translation-project' 
}
[Books.commitVersion] Committing section section-1 to Muhammad-Altabba/my-translation-project
[Books.commitVersion] Committing section section-2 to Muhammad-Altabba/my-translation-project
[Books.commitVersion] Successfully committed all 2 sections
[Books.commitVersion] Committed 2 drafts for book mzUaNUxo58rm_7rexZSvD
```

### Test Scenario: Error Handling (Repository Not Found)

**Steps:**
1. Manually change book.repoName in database to non-existent repo
2. Try to create version
3. Observe error handling

**Expected Result:**
- Error toast with helpful message
- Server logs show detailed error info
- Drafts remain in database (not cleared)
- User can fix issue and retry

## Related Issues Fixed

This fix also applies the same owner/repo parsing logic to:
1. **DiffViewer** - Already fixed in previous checkpoint
2. **BookEditor** - Uses gitInfo.username directly from frontend
3. **commitVersion** - Now uses username from getGitClient

All three components now use consistent logic for determining owner and repo.

## Future Improvements

### 1. Standardize repoName Format
Consider storing `repoName` as "owner/repo" consistently:

```typescript
// In Dashboard.tsx when creating book:
await createBookMutation.mutateAsync({
  repoName: `${gitInfo.username}/${repo.name}`,  // Store as "owner/repo"
  // ...
});
```

**Benefits:**
- No need for fallback logic
- Simpler parsing everywhere
- More explicit and clear

**Migration:**
- Add database migration to prepend username to existing repoName values
- Update all parsing logic to always split by "/"

### 2. Validate Repository Access
Before attempting commits, validate that:
- Repository exists
- User has write access
- Branch exists

```typescript
const { client, username } = await getGitClient(ctx.user.id);

// Validate repo exists and user has access
try {
  const repo = await client.getRepository(owner, repo);
  console.log('[Books.commitVersion] Repository validated:', repo.name);
} catch (error) {
  throw new TRPCError({
    code: 'NOT_FOUND',
    message: 'Repository not found or you do not have access',
  });
}
```

### 3. Atomic Commits
Instead of committing each section separately, create a single commit with all changes:

```typescript
// Collect all file changes
const files = draftEntries.flatMap(([sectionId, draft]) => [
  { path: `source/${sectionId}.md`, content: draft.source },
  { path: `translated/${sectionId}.md`, content: draft.translated },
]);

// Create single commit with all files
await client.createCommit(owner, repo, {
  message: input.message,
  files,
  branch: 'main',
});
```

**Benefits:**
- Single commit for all changes (atomic)
- Faster (one API call instead of many)
- Cleaner Git history
- Better for rollback

## Summary

✅ **Fixed:** GitHub API 404 error when creating versions  
✅ **Root cause:** Incorrect owner/repo parsing (using user ID instead of username)  
✅ **Solution:** Use username from getGitClient and apply DiffViewer logic  
✅ **Logging:** Added comprehensive logging for debugging  
✅ **Error handling:** Better error messages and draft preservation on failure  
✅ **Consistency:** All components now use same owner/repo parsing logic  

The `commitVersion` mutation now correctly commits drafts to GitHub with proper owner and repository information.

