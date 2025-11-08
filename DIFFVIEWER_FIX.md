# DiffViewer Fix - Commit History Display

## Problem Description

The DiffViewer page was not showing commit history and diffs, even though commits were successfully pushed to GitHub. Users would see "No commits found" message despite having commits in their repository.

### Root Cause

The DiffViewer component was incorrectly parsing the owner and repository name from the `book.repoName` field. The code assumed `repoName` was in "owner/repo" format and tried to split it:

```typescript
// BEFORE (incorrect):
owner: book?.repoName.split("/")[0] || "",
repo: book?.repoName.split("/")[1] || book?.repoName || "",
```

However, in the actual database schema, `repoName` is stored as **just the repository name** (e.g., "my-translation-project"), not "owner/repo". This is set in Dashboard.tsx when creating a book:

```typescript
// Dashboard.tsx line 83:
await createBookMutation.mutateAsync({
  repoName: repo.name,  // ❌ Just the repo name, not "owner/repo"
  repoUrl: repo.url,
  // ...
});
```

As a result:
- `owner` would be an empty string (no "/" to split on)
- `repo` would be the full repoName
- The GitHub API call would fail because owner was empty
- No commits would be displayed

## The Fix

### 1. Frontend Fix (DiffViewer.tsx)

Added logic to properly determine owner and repo:

```typescript
// AFTER (correct):
const { data: gitInfo } = trpc.git.getUserInfo.useQuery(undefined, {
  enabled: isAuthenticated,
});

// Parse owner and repo correctly
// If repoName contains "/", it's in "owner/repo" format
// Otherwise, use gitInfo.username as owner
const owner = book?.repoName.includes("/") 
  ? book.repoName.split("/")[0] 
  : gitInfo?.username || "";
const repo = book?.repoName.includes("/") 
  ? book.repoName.split("/")[1] 
  : book?.repoName || "";

console.log('[DiffViewer] Repository info:', { owner, repo, repoName: book?.repoName });
```

**Key changes:**
1. Fetch `gitInfo` to get the authenticated user's username
2. Check if `repoName` contains "/" to determine format
3. If no "/", use `gitInfo.username` as owner and `repoName` as repo
4. If "/" exists, split it (for backward compatibility)
5. Add logging to track what values are being used

### 2. Backend Logging (git.ts)

Added comprehensive logging to track the request:

```typescript
.query(async ({ ctx, input }) => {
  console.log('[Git.getCommitHistory] Request:', {
    owner: input.owner,
    repo: input.repo,
    path: input.path,
    limit: input.limit,
  });
  
  const { client } = await getGitClient(ctx.user.id);

  const commits = await (client as any).getCommitHistory(
    input.owner,
    input.repo,
    input.path,
    input.limit
  );
  
  console.log('[Git.getCommitHistory] Found commits:', commits.length);
  if (commits.length > 0) {
    console.log('[Git.getCommitHistory] Latest commit:', {
      sha: commits[0].sha.substring(0, 7),
      message: commits[0].message.substring(0, 50),
      author: commits[0].author,
    });
  }
  
  return commits;
});
```

### 3. GitHub Client Logging (github.ts)

Added detailed logging to the GitHub API client:

```typescript
async getCommitHistory(owner: string, repo: string, path?: string, limit = 50): Promise<GitHubCommit[]> {
  console.log(`[GitHub.getCommitHistory] Fetching commits for ${owner}/${repo}`, { path, limit });
  
  try {
    const { data } = await this.octokit.repos.listCommits({
      owner,
      repo,
      path,
      per_page: limit,
    });

    console.log(`[GitHub.getCommitHistory] ✅ Found ${data.length} commits for ${owner}/${repo}`);
    if (data.length > 0) {
      console.log(`[GitHub.getCommitHistory] Latest commit:`, {
        sha: data[0].sha.substring(0, 7),
        message: data[0].commit.message.substring(0, 50),
        author: data[0].commit.author?.name,
      });
    }

    return data.map(commit => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: commit.commit.author?.name || 'Unknown',
      date: commit.commit.author?.date || new Date().toISOString(),
      url: commit.html_url,
    }));
  } catch (error: any) {
    if (error.status === 404 || error.status === 409) {
      console.log(`[GitHub.getCommitHistory] ⚠️ No commits found for ${owner}/${repo} (status: ${error.status})`);
      return [];
    }
    console.error(`[GitHub.getCommitHistory] ❌ Error fetching commits for ${owner}/${repo}:`, error.message);
    throw error;
  }
}
```

## Testing

### Test Scenario: View Commit History

1. **Prerequisites:**
   - User has connected GitHub account
   - User has created a translation project
   - User has translated and committed at least one section

2. **Navigate to DiffViewer:**
   - Open a translation project
   - Click "View Diffs" button (or navigate to `/diff/:bookId`)

3. **Expected Behavior:**
   - Page loads successfully
   - Left sidebar shows "Commit History" card
   - Recent commits are listed with:
     - Commit SHA (7 characters)
     - Commit message
     - Author name
     - Timestamp
   - Two dropdowns for selecting base and head commits
   - No "No commits found" message

4. **Verify Logs (Browser Console):**
   ```
   [DiffViewer] Repository info: { owner: 'username', repo: 'repo-name', repoName: 'repo-name' }
   ```

5. **Verify Logs (Server Console):**
   ```
   [Git.getCommitHistory] Request: { owner: 'username', repo: 'repo-name', path: undefined, limit: 50 }
   [GitHub.getCommitHistory] Fetching commits for username/repo-name { path: undefined, limit: 50 }
   [GitHub.getCommitHistory] ✅ Found 5 commits for username/repo-name
   [GitHub.getCommitHistory] Latest commit: { sha: 'abc1234', message: 'Translate section 1', author: 'User Name' }
   [Git.getCommitHistory] Found commits: 5
   [Git.getCommitHistory] Latest commit: { sha: 'abc1234', message: 'Translate section 1', author: 'User Name' }
   ```

### Test Scenario: View Diffs

1. **Select two commits:**
   - Click on a commit in the list to set as base
   - Click on another commit to set as head
   - Or use the dropdowns

2. **Expected Behavior:**
   - Right panel shows "Diff Viewer" card
   - Displays changes between the two commits
   - Lines added shown in green
   - Lines removed shown in red
   - Context lines shown in gray

3. **Verify Logs:**
   ```
   [Git.getDiff] Request: { owner: 'username', repo: 'repo-name', base: 'sha1', head: 'sha2' }
   ```

## Data Flow

```
1. User navigates to /diff/:bookId
   ↓
2. DiffViewer loads book data
   ↓
3. DiffViewer fetches gitInfo to get username
   ↓
4. DiffViewer determines owner and repo:
   - If repoName has "/": split it
   - Otherwise: owner = gitInfo.username, repo = repoName
   ↓
5. DiffViewer calls getCommitHistory API
   ↓
6. Backend git router receives request
   ↓
7. Backend calls GitHub client getCommitHistory
   ↓
8. GitHub API returns commits
   ↓
9. Commits displayed in UI
   ↓
10. User selects two commits
   ↓
11. DiffViewer calls getDiff API
   ↓
12. Backend fetches diff from GitHub
   ↓
13. Diff displayed in UI
```

## Edge Cases Handled

### 1. Empty Repository
- **Scenario:** Repository exists but has no commits yet
- **Behavior:** Shows "No commits found" message with helpful text
- **Log:** `[GitHub.getCommitHistory] ⚠️ No commits found for owner/repo (status: 409)`

### 2. Repository Not Found
- **Scenario:** Repository doesn't exist or user doesn't have access
- **Behavior:** Shows "No commits found" message
- **Log:** `[GitHub.getCommitHistory] ⚠️ No commits found for owner/repo (status: 404)`

### 3. Network Error
- **Scenario:** GitHub API is down or network issue
- **Behavior:** Error thrown and handled by tRPC
- **Log:** `[GitHub.getCommitHistory] ❌ Error fetching commits for owner/repo: error message`

### 4. Legacy Data (owner/repo format)
- **Scenario:** Old projects might have repoName in "owner/repo" format
- **Behavior:** Code checks for "/" and splits accordingly
- **Result:** Works for both formats

## Related Files

### Modified Files
1. `client/src/pages/DiffViewer.tsx` - Fixed owner/repo parsing, added gitInfo query
2. `server/routers/git.ts` - Added logging to getCommitHistory endpoint
3. `server/git/github.ts` - Added comprehensive logging to GitHub client

### Related Files (not modified)
1. `client/src/pages/Dashboard.tsx` - Where repoName is set during project creation
2. `drizzle/schema.ts` - Database schema defining repoName field
3. `server/db.ts` - Database operations for books

## Performance Impact

- **Minimal:** Added one additional API call (`getUserInfo`) which is cached by tRPC
- **Logging:** Console logs only, no performance impact in production
- **Network:** Same number of GitHub API calls as before

## Future Improvements

### 1. Consistent repoName Format
Consider storing repoName in "owner/repo" format consistently:

```typescript
// In Dashboard.tsx:
await createBookMutation.mutateAsync({
  repoName: `${repo.username}/${repo.name}`,  // Store as "owner/repo"
  repoUrl: repo.url,
  // ...
});
```

**Benefits:**
- Simpler parsing logic
- No need for gitInfo query
- More explicit and clear

**Migration:**
- Would require database migration to update existing records
- Add migration script to prepend username to existing repoName values

### 2. Cache gitInfo
The `getUserInfo` query is already cached by tRPC, but consider storing it in React Context for faster access across components.

### 3. Better Error Messages
Show more specific error messages to users:
- "Repository is empty. Start translating to create commits!"
- "Unable to connect to GitHub. Please try again."
- "Repository not found. It may have been deleted."

## Summary

✅ **Fixed:** DiffViewer now correctly displays commit history
✅ **Root cause:** Incorrect owner/repo parsing from repoName
✅ **Solution:** Use gitInfo.username as owner when repoName doesn't contain "/"
✅ **Logging:** Comprehensive logging at all levels for debugging
✅ **Backward compatible:** Works with both "repo" and "owner/repo" formats

The DiffViewer page now properly displays commit history and diffs for all projects.

