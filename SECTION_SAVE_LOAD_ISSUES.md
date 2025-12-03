# Critical Issues in Section Save/Load Process

## Issue 1: getAllSectionDrafts Returns Wrong Data Structure

**Location:** `server/db.ts` lines 414-442

**Problem:**
The `getAllSectionDrafts` function returns an array of individual draft objects:
```typescript
return results.map(data => ({
  sectionId: data.sectionId,
  source: data.draftSource || data.originalContent,
  translated: data.draftTranslation || '',
  status: data.translationStatus,
  lastModified: data.draftLastModified || data.lastModified,
}));
```

**But BookEditor expects:**
```typescript
// Line 102-109 in BookEditor.tsx
if (allDrafts.sections && allDrafts.sections.length > 0) {
  setSections(allDrafts.sections);
  setShowSectionsList(true);
}
```

**Impact:** 
- `allDrafts.sections` is undefined
- Sections don't load from cache
- `showSectionsList` never gets set to true
- User sees "Upload Source Document" instead of sections list

---

## Issue 2: getAllSectionDrafts Should Return Book Data with Cached Sections

**Location:** `server/db.ts` lines 414-442 and `server/routers/books.ts` lines 178-195

**Problem:**
The router's `getAllSectionDrafts` procedure should return the book object with cached sections and metadata, not just an array of drafts.

**Expected Return Structure:**
```typescript
{
  id: string;
  title: string;
  sourceLanguage: string;
  targetLanguage: string;
  sections: Array<{
    id: string;
    content: string;
    startLine: number;
    endLine: number;
    type: string;
  }>;
  sectionsMetadata: Record<string, {
    translated: boolean;
    lastModified: Date;
  }>;
}
```

---

## Issue 3: BookEditor Verification Mode Queries Git Unnecessarily

**Location:** `client/src/pages/BookEditor.tsx` lines 61-98

**Problem:**
The verification mode loads from Git every time sections load:
```typescript
const { data: gitProgress } = trpc.git.loadTranslationProgress.useQuery({...});
```

This causes:
- Extra API calls to GitHub/GitLab
- Slow loading times
- Unnecessary network traffic
- Potential rate limiting

**Solution:** Remove verification mode or make it optional (dev-only)

---

## Issue 4: saveSectionDraft Doesn't Update Book's Cached Sections

**Location:** `server/db.ts` lines 308-368

**Problem:**
When saving a draft, the function only updates the `sectionData` table but doesn't update the book's cached `sections` array in the books table.

**Impact:**
- Book's `sections` field becomes stale
- Next time user loads the book, cached sections don't reflect draft saves
- User sees old section data

**Solution:** After saving draft, also update the book's sections array

---

## Issue 5: Missing Cache Invalidation in BookEditor

**Location:** `client/src/pages/BookEditor.tsx` lines 330-331, 394-395

**Problem:**
After saving a draft, the code has placeholder comments:
```typescript
// Refresh drafts list to ensure UI is in sync
console.log('[BookEditor] Invalidating drafts cache...');

// And later:
// Refresh drafts list
```

But never actually invalidates the cache:
```typescript
// Missing: utils.books.getAllSectionDrafts.invalidate();
```

**Impact:**
- UI doesn't update after save
- User doesn't see draft indicator
- Draft count badge doesn't update

---

## Issue 6: handleCreateVersion Not Implemented

**Location:** `client/src/pages/BookEditor.tsx` lines 354-369

**Problem:**
The `handleCreateVersion` function has a TODO:
```typescript
const result = // TODO: Implement commit version with new sectionData
```

This is incomplete and will cause errors when user tries to create a version.

---

## Summary of Required Fixes

1. **Fix getAllSectionDrafts return structure** - Return book with sections and metadata
2. **Update saveSectionDraft** - Also update book's cached sections array
3. **Add cache invalidation** - Invalidate drafts cache after save
4. **Implement handleCreateVersion** - Complete the version commit logic
5. **Remove verification mode** - Or make it dev-only to avoid extra queries
6. **Add proper error handling** - For all async operations

---

## Data Flow After Fixes

### On PDF Upload:
1. Extract text and split into sections
2. Save to books.sections (cached)
3. Save to sectionData table (for drafts)
4. Show sections list

### On Save Draft:
1. Save to sectionData table (draftTranslation, draftSource)
2. Update books.sections array with new draft status
3. Invalidate getAllSectionDrafts cache
4. Update UI with draft indicator

### On Create Version:
1. Get all drafts from sectionData
2. Commit each to Git (translated/{sectionId}.md)
3. Update sectionData.translationStatus to 'committed'
4. Clear drafts from sectionData
5. Invalidate cache

### On Reopen Project:
1. Query getAllSectionDrafts
2. Get book with cached sections and metadata
3. Show sections list immediately (no Git query needed)
4. Load individual translations lazily when user clicks section
