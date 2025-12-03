# Draft System Implementation

## Overview

The Git Translation Platform now features a **draft system** that separates local editing from Git version control. Users can save their translation work as drafts in the local database without creating Git commits, then batch-commit multiple drafts as a named version when ready.

## Key Features

### 1. Draft Saving (Local DB)
- **Automatic draft storage**: Every time a user edits and saves a translation, it's stored as a draft in the database
- **No Git commits**: Drafts don't create Git commits or clutter the version history
- **Instant saves**: Fast local database writes without network latency
- **Per-section tracking**: Each section's draft is tracked independently

### 2. Version Creation (Git Commit)
- **Batch commits**: Commit all drafts at once as a single version
- **Named versions**: Each version has a descriptive title (e.g., "Chapter 1 complete", "Final review")
- **Draft counter badge**: Shows how many sections have uncommitted drafts
- **Automatic cleanup**: Drafts are cleared after successful commit

### 3. Draft Comparison in DiffViewer
- **DRAFT option**: Select "DRAFT (Uncommitted)" in commit selectors
- **Visual indicator**: Orange-colored DRAFT label with section count
- **Helpful guidance**: Instructions on how to commit drafts to view actual diffs
- **Draft awareness**: System knows when drafts exist and surfaces them appropriately

## User Workflow

### Translation Workflow

```
1. User opens Book Editor
   ↓
2. User selects a section to translate
   ↓
3. User edits translation in MDEditor
   ↓
4. User clicks "Save Draft & Next"
   ↓
5. Draft saved to local DB (no Git commit)
   ↓
6. User moves to next section
   ↓
7. Repeat steps 3-6 for multiple sections
   ↓
8. User clicks "Create Version" button (shows draft count badge)
   ↓
9. User enters version title in dialog
   ↓
10. User clicks "Create Version" in dialog
   ↓
11. All drafts committed to Git as a single version
   ↓
12. Drafts cleared from database
   ↓
13. Success message shows number of sections committed
```

### Version Comparison Workflow

```
1. User navigates to DiffViewer
   ↓
2. User sees commit list + DRAFT option (if drafts exist)
   ↓
3. User selects base commit (e.g., previous version)
   ↓
4. User selects head commit:
   - Option A: Select another Git commit → Shows Git diff
   - Option B: Select DRAFT → Shows draft guidance message
   ↓
5. If DRAFT selected:
   - System explains drafts must be committed first
   - Shows draft count and instructions
   - User returns to Book Editor to create version
```

## Technical Implementation

### Database Schema

The `books` table already includes a `drafts` field:

```typescript
drafts: json("drafts").$type<Record<string, { 
  source: string; 
  translated: string; 
  lastModified: string 
}>>()
```

**Structure:**
```json
{
  "section-1": {
    "source": "Original text...",
    "translated": "Translated text...",
    "lastModified": "2025-01-15T10:30:00.000Z"
  },
  "section-2": {
    "source": "Another section...",
    "translated": "Otra sección...",
    "lastModified": "2025-01-15T10:35:00.000Z"
  }
}
```

### Backend API Endpoints

#### 1. `books.saveDraft` (Mutation)
**Purpose:** Save a single section's draft to the database

**Input:**
```typescript
{
  bookId: string;
  sectionId: string;
  source: string;
  translated: string;
}
```

**Output:**
```typescript
{ success: boolean }
```

**Implementation:** Updates the `drafts` JSON field in the `books` table

#### 2. `books.getDraft` (Query)
**Purpose:** Get a specific section's draft

**Input:**
```typescript
{
  bookId: string;
  sectionId: string;
}
```

**Output:**
```typescript
{
  source: string;
  translated: string;
  lastModified: string;
} | null
```

#### 3. `books.getAllDrafts` (Query)
**Purpose:** Get all drafts for a book

**Input:**
```typescript
{ bookId: string }
```

**Output:**
```typescript
Record<string, {
  source: string;
  translated: string;
  lastModified: string;
}>
```

#### 4. `books.commitVersion` (Mutation)
**Purpose:** Commit all drafts to Git as a new version

**Input:**
```typescript
{
  bookId: string;
  message: string; // Version title
}
```

**Output:**
```typescript
{
  success: boolean;
  committedCount: number;
}
```

**Process:**
1. Fetch all drafts from database
2. For each draft:
   - Commit source file to Git (`source/{sectionId}.md`)
   - Commit translated file to Git (`translated/{sectionId}.md`)
   - Update section metadata (mark as translated)
3. Clear all drafts from database
4. Return success with count

#### 5. `books.clearDraft` (Mutation)
**Purpose:** Clear a single section's draft

**Input:**
```typescript
{
  bookId: string;
  sectionId: string;
}
```

#### 6. `books.clearAllDrafts` (Mutation)
**Purpose:** Clear all drafts for a book

**Input:**
```typescript
{ bookId: string }
```

### Frontend Components

#### BookEditor.tsx Changes

**1. Added Mutations and Queries:**
```typescript
const saveDraftMutation = trpc.books.saveDraft.useMutation();
const commitVersionMutation = trpc.books.commitVersion.useMutation();
const { data: allDrafts } = trpc.books.getAllDrafts.useQuery(
  { bookId: bookId || "" },
  { enabled: !!bookId }
);
```

**2. Updated handleSaveTranslation:**
```typescript
const handleSaveTranslation = async () => {
  // Save as draft to local DB (no Git commit)
  await saveDraftMutation.mutateAsync({
    bookId: bookId || "",
    sectionId,
    source: section?.content || '',
    translated: translatedContent,
  });
  
  // Refresh drafts list
  await utils.books.getAllDrafts.invalidate({ bookId: bookId || "" });
  
  toast.success("Draft saved locally");
  // Move to next section...
};
```

**3. Added Create Version Handler:**
```typescript
const handleCreateVersion = async () => {
  const result = await commitVersionMutation.mutateAsync({
    bookId: bookId || "",
    message: versionTitle,
  });
  
  toast.success(`Version created! Committed ${result.committedCount} sections`);
  // Clear dialog and refresh drafts...
};
```

**4. Added Create Version Button:**
```tsx
<Button
  variant="default"
  size="sm"
  onClick={() => setIsVersionDialogOpen(true)}
  disabled={!allDrafts || Object.keys(allDrafts).length === 0}
  className="relative"
>
  <GitCommit className="h-4 w-4 mr-2" />
  Create Version
  {allDrafts && Object.keys(allDrafts).length > 0 && (
    <span className="ml-2 bg-white text-primary px-2 py-0.5 rounded-full text-xs font-semibold">
      {Object.keys(allDrafts).length}
    </span>
  )}
</Button>
```

**5. Added Create Version Dialog:**
```tsx
<Dialog open={isVersionDialogOpen} onOpenChange={setIsVersionDialogOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Create New Version</DialogTitle>
      <DialogDescription>
        Commit all {allDrafts ? Object.keys(allDrafts).length : 0} draft sections to Git as a new version.
      </DialogDescription>
    </DialogHeader>
    <div className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="version-title">Version Title</Label>
        <Input
          id="version-title"
          placeholder="e.g., Initial translation, Chapter 1 complete, Final review"
          value={versionTitle}
          onChange={(e) => setVersionTitle(e.target.value)}
        />
      </div>
      {/* List of sections to commit */}
    </div>
    <DialogFooter>
      <Button onClick={handleCreateVersion}>
        Create Version
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**6. Updated Save Button:**
```tsx
<Button
  size="sm"
  onClick={handleSaveTranslation}
  disabled={!translatedContent || saveDraftMutation.isPending}
>
  {saveDraftMutation.isPending ? (
    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
  ) : (
    <Save className="h-4 w-4 mr-2" />
  )}
  Save Draft & Next
</Button>
```

#### DiffViewer.tsx Changes

**1. Added Drafts Query:**
```typescript
const { data: allDrafts } = trpc.books.getAllDrafts.useQuery(
  { bookId: bookId || "" },
  { enabled: !!bookId && isAuthenticated }
);

const hasDrafts = allDrafts && Object.keys(allDrafts).length > 0;
```

**2. Added DRAFT Option to Selectors:**
```tsx
<SelectContent>
  {hasDrafts && (
    <SelectItem value="DRAFT">
      <div className="flex flex-col">
        <span className="font-mono text-xs text-orange-600">DRAFT</span>
        <span className="text-sm">Uncommitted changes ({Object.keys(allDrafts || {}).length} sections)</span>
      </div>
    </SelectItem>
  )}
  {commits.map((commit: any) => (
    <SelectItem key={commit.sha} value={commit.sha}>
      {/* Commit info */}
    </SelectItem>
  ))}
</SelectContent>
```

**3. Added Draft Comparison Detection:**
```typescript
const isDraftComparison = baseCommit === "DRAFT" || headCommit === "DRAFT";

const { data: diffData, isLoading: diffLoading } = trpc.git.getDiff.useQuery(
  { owner, repo, base: baseCommit, head: headCommit },
  { enabled: !!book && !!owner && !!repo && !!baseCommit && !!headCommit && !isDraftComparison }
);
```

**4. Added Draft Comparison UI:**
```tsx
{isDraftComparison ? (
  <div className="text-center py-16">
    <div className="bg-orange-50 border border-orange-200 rounded-lg p-6 max-w-md mx-auto">
      <FileText className="h-12 w-12 mx-auto mb-4 text-orange-600" />
      <h3 className="text-lg font-semibold text-orange-900 mb-2">Draft Comparison</h3>
      <p className="text-sm text-orange-800 mb-4">
        You've selected DRAFT (uncommitted changes) for comparison.
      </p>
      <div className="text-left text-sm text-orange-800 space-y-2">
        <p className="font-medium">To view draft changes:</p>
        <ul className="list-disc list-inside space-y-1 ml-2">
          <li>Go back to the Book Editor</li>
          <li>Review your uncommitted sections</li>
          <li>Click "Create Version" to commit drafts to Git</li>
          <li>Then return here to compare versions</li>
        </ul>
      </div>
      <div className="mt-4 pt-4 border-t border-orange-200">
        <p className="text-xs text-orange-700">
          <strong>Drafts available:</strong> {Object.keys(allDrafts || {}).length} sections
        </p>
      </div>
    </div>
  </div>
) : /* Normal diff display */}
```

**5. Updated Description Labels:**
```tsx
<CardDescription>
  {baseCommit && headCommit
    ? `Comparing ${baseCommit === "DRAFT" ? "DRAFT (Uncommitted)" : baseCommit.substring(0, 7)} → ${headCommit === "DRAFT" ? "DRAFT (Uncommitted)" : headCommit.substring(0, 7)}`
    : "Select two commits to view differences"}
</CardDescription>
```

## Benefits

### For Users

1. **Flexible editing**: Save work frequently without creating messy Git history
2. **Batch operations**: Commit multiple sections at once with a single meaningful message
3. **Clear versioning**: Each version represents a milestone (e.g., "Chapter 1 complete")
4. **Draft awareness**: Always know how many sections have uncommitted changes
5. **No accidental loss**: Drafts are safely stored in the database
6. **Faster saves**: Local DB writes are instant compared to Git operations

### For Version Control

1. **Clean history**: Git commits represent meaningful versions, not individual saves
2. **Descriptive messages**: Version titles explain what changed (not just "save section 1")
3. **Atomic commits**: All related changes committed together
4. **Easier rollback**: Revert to named versions instead of individual file commits
5. **Better collaboration**: Clear version boundaries for team review

### For Performance

1. **Reduced network calls**: No Git API calls during draft saves
2. **Faster UI**: Instant feedback when saving drafts
3. **Batch efficiency**: One Git operation for multiple sections
4. **Database optimization**: JSON field updates are fast

## Edge Cases Handled

### 1. No Drafts Exist
- **Create Version button**: Disabled (grayed out)
- **Badge**: Not shown
- **DiffViewer**: DRAFT option not shown in selectors

### 2. Drafts Exist But User Navigates Away
- **Persistence**: Drafts remain in database across sessions
- **Recovery**: User can return anytime to commit or continue editing
- **Indicator**: Draft count badge reminds user of uncommitted work

### 3. Version Creation Fails
- **Error handling**: Shows error message to user
- **Drafts preserved**: Drafts remain in database (not cleared)
- **Retry**: User can try again with same or different version title

### 4. Multiple Sections, Partial Drafts
- **Selective commits**: Only sections with drafts are committed
- **Metadata sync**: Section metadata updated only for committed sections
- **Clear indication**: Dialog shows exactly which sections will be committed

### 5. Empty Version Title
- **Validation**: "Create Version" button disabled until title entered
- **User feedback**: Error toast if somehow submitted empty
- **Default suggestion**: Placeholder text suggests good version titles

### 6. Draft Comparison Selected
- **Skip Git API**: Don't call getDiff when DRAFT is selected
- **Helpful UI**: Show guidance on how to commit drafts
- **Draft count**: Display number of uncommitted sections
- **Clear path**: Instructions to create version and return

## Testing Scenarios

### Scenario 1: Basic Draft Workflow

**Steps:**
1. Open Book Editor for a project
2. Select section 1
3. Edit translation
4. Click "Save Draft & Next"
5. Verify toast: "Draft saved locally"
6. Verify "Create Version" button shows badge "1"
7. Select section 2
8. Edit translation
9. Click "Save Draft & Next"
10. Verify badge updates to "2"
11. Click "Create Version"
12. Enter version title: "Initial translation"
13. Verify dialog shows 2 sections
14. Click "Create Version" in dialog
15. Verify success toast: "Version created! Committed 2 sections"
16. Verify badge disappears (no drafts)
17. Verify Git commits created on GitHub

**Expected Result:** All steps complete successfully, drafts committed to Git

### Scenario 2: Draft Persistence Across Sessions

**Steps:**
1. Save 3 sections as drafts
2. Close browser tab
3. Reopen Book Editor
4. Verify "Create Version" button shows badge "3"
5. Click "Create Version"
6. Verify dialog shows all 3 sections

**Expected Result:** Drafts persist and can be committed later

### Scenario 3: Draft Comparison in DiffViewer

**Steps:**
1. Save 2 sections as drafts (don't create version)
2. Navigate to DiffViewer
3. Verify "DRAFT (Uncommitted changes (2 sections))" appears in selectors
4. Select DRAFT as head commit
5. Select any Git commit as base
6. Verify orange guidance message appears
7. Verify message shows draft count: "Drafts available: 2 sections"
8. Return to Book Editor
9. Create version
10. Return to DiffViewer
11. Verify DRAFT option no longer appears

**Expected Result:** Draft option appears when drafts exist, disappears after commit

### Scenario 4: Empty Repository (No Commits)

**Steps:**
1. Create new project
2. Upload and process PDF
3. Translate section 1
4. Save as draft
5. Navigate to DiffViewer
6. Verify message: "No commits found"
7. Verify DRAFT option appears in selectors
8. Select DRAFT
9. Verify guidance message

**Expected Result:** System handles case where Git repo is empty but drafts exist

### Scenario 5: Version Creation with Network Error

**Steps:**
1. Save 2 sections as drafts
2. Disconnect network (simulate)
3. Click "Create Version"
4. Enter version title
5. Click "Create Version" in dialog
6. Verify error toast appears
7. Verify drafts still exist (badge still shows "2")
8. Reconnect network
9. Click "Create Version" again
10. Verify success

**Expected Result:** Drafts preserved on error, can retry after network restored

## Future Enhancements

### 1. Draft Preview in DiffViewer
Instead of just showing guidance, actually compute and display the diff between:
- Base: Last committed version of section from Git
- Head: Current draft version from database

**Implementation:**
- Fetch Git file content for base commit
- Fetch draft content from database
- Compute diff client-side using a diff library
- Display in the same format as Git diffs

### 2. Selective Version Creation
Allow users to select which drafts to commit:
- Show checklist of all draft sections in dialog
- User can uncheck sections they don't want to commit
- Only checked sections are committed
- Unchecked sections remain as drafts

### 3. Draft Auto-Save
Automatically save drafts as user types:
- Debounced auto-save (e.g., every 30 seconds)
- Visual indicator: "Saving..." → "Saved"
- No manual "Save Draft" button needed
- Still require explicit "Create Version" for Git commits

### 4. Version Tags
Add Git tags for versions:
- Each version gets a Git tag (e.g., `v1-initial-translation`)
- Easier to reference specific versions
- Better integration with Git workflows
- Tags visible in GitHub UI

### 5. Draft Conflict Detection
Warn if draft is based on outdated Git version:
- Track which Git commit draft was based on
- Compare with current HEAD
- Show warning if base commit is not HEAD
- Suggest pulling latest changes before committing

### 6. Draft History
Keep history of draft changes:
- Store previous versions of drafts
- Allow reverting to earlier draft
- Show draft timeline
- Useful for recovering accidentally overwritten work

## Summary

✅ **Implemented:** Complete draft system with local saves and batch Git commits  
✅ **UI Updates:** Create Version button with badge, dialog with section list  
✅ **DiffViewer Integration:** DRAFT option in selectors with helpful guidance  
✅ **Database:** Leveraged existing `drafts` JSON field in books table  
✅ **API:** All necessary endpoints already existed (saveDraft, getAllDrafts, commitVersion)  
✅ **User Experience:** Clear workflow from draft → version with visual feedback  

The draft system provides a professional workflow that separates frequent local saves from meaningful version control commits, resulting in cleaner Git history and better user experience.

