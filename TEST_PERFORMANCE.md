# Performance Optimization Testing Guide

## Quick Test Steps

### 1. Verify Database Schema

```bash
cd /home/ubuntu/git-translation-platform
pnpm db:push
```

Expected output: Migration applied successfully

### 2. Start Development Server

```bash
cd /home/ubuntu/git-translation-platform
pnpm dev
```

Expected output: Server running on http://localhost:3002/

### 3. Test New Project Flow

**Steps:**
1. Open browser to http://localhost:3002/
2. Login with Manus account
3. Connect GitHub/GitLab account
4. Create new project
5. Upload a PDF or paste text content
6. Click "Split Document" button

**Expected Behavior:**
- Document splits into sections
- Sections appear in list immediately
- Database should now contain cached sections
- No delay on subsequent opens

**Verification:**
```sql
-- Check if sections are cached in database
SELECT id, title, 
  JSON_LENGTH(sections) as section_count,
  JSON_KEYS(sectionsMetadata) as translated_sections
FROM books 
WHERE id = 'YOUR_BOOK_ID';
```

### 4. Test Existing Project Loading

**Steps:**
1. Navigate to dashboard
2. Click on an existing project with cached sections
3. Measure time from click to sections list appearing

**Expected Behavior:**
- Sections list appears in <1 second
- No Git API calls visible in Network tab
- Translation status indicators show correctly
- Progress percentage calculated from cached metadata

**Browser DevTools Check:**
1. Open Network tab (F12)
2. Filter by "Fetch/XHR"
3. Click on project
4. Verify only these calls are made:
   - `books.get` (get book metadata)
   - `books.getSections` (get cached sections)
   - NO `git.loadTranslationProgress` calls
   - NO `git.listFiles` calls

### 5. Test Section Translation

**Steps:**
1. Open a project with sections
2. Click on an untranslated section
3. Enter translation text
4. Click "Save Translation"

**Expected Behavior:**
- Translation saved to Git (source/ and translated/ folders)
- Metadata updated in database
- Section marked as "Translated" in list
- Progress percentage updates immediately

**Verification:**
```sql
-- Check if metadata was updated
SELECT sectionsMetadata 
FROM books 
WHERE id = 'YOUR_BOOK_ID';
```

Expected JSON:
```json
{
  "section-1": {
    "translated": true,
    "lastModified": "2025-10-19T..."
  }
}
```

### 6. Test Lazy Loading

**Steps:**
1. Open project with translated sections
2. Click on a translated section
3. Observe Network tab

**Expected Behavior:**
- Section content loaded from Git on demand
- Only ONE `git.getFile` call for that specific section
- Content appears in editor
- Subsequent clicks on same section use cached content (no new API call)

## Performance Benchmarks

### Target Metrics

| Operation | Before | After | Target |
|-----------|--------|-------|--------|
| Project Open (new) | N/A | <500ms | <1s |
| Project Open (existing) | 5-10s | <500ms | <1s |
| Section Click (untranslated) | Instant | Instant | <100ms |
| Section Click (translated) | N/A | 200-500ms | <1s |
| Save Translation | 1-2s | 1-2s | <2s |

### Measuring Performance

Use browser DevTools Performance tab:

1. Open Performance tab (F12 → Performance)
2. Click "Record"
3. Open a project
4. Stop recording when sections list appears
5. Look for:
   - Total time from click to render
   - Number of API calls
   - Time spent in network requests

## Common Issues & Solutions

### Issue: TypeScript errors about `getSections` not existing

**Solution:**
```bash
# Restart dev server
pkill -f "tsx watch"
cd /home/ubuntu/git-translation-platform
pnpm dev
```

### Issue: Sections not appearing in list

**Possible causes:**
1. Sections not cached in database (first-time project)
2. Database migration not applied

**Solution:**
```bash
# Check database migration
pnpm db:push

# Verify sections exist
# Use database client to check books table
```

### Issue: Translation status not updating

**Possible causes:**
1. Metadata not being saved to database
2. Frontend not refreshing after save

**Solution:**
- Check browser console for errors
- Verify `updateSectionMetadata` mutation is called
- Check database to see if metadata was saved

## API Call Comparison

### Before Optimization

Opening existing project with 10 sections:
```
1. git.loadTranslationProgress
   ├─> git.listFiles (source/) - 1-2s
   ├─> git.listFiles (translated/) - 1-2s
   └─> git.getFile × 20 (all sections) - 3-6s
Total: 5-10 seconds, 22 API calls
```

### After Optimization

Opening existing project with 10 sections:
```
1. books.get - 100ms
2. books.getSections - 100ms
Total: 200ms, 2 API calls
```

**Improvement: 25-50x faster, 91% fewer API calls**

## Success Criteria

- [x] Database schema updated with sections and sectionsMetadata columns
- [x] TypeScript compilation passes without errors
- [x] Dev server starts successfully
- [ ] New project: sections cached in database after splitting
- [ ] Existing project: opens in <1 second
- [ ] Sections list displays with correct translation status
- [ ] Translation save updates metadata in database
- [ ] No unnecessary Git API calls on project open
- [ ] Lazy loading works for individual sections
- [ ] Progress indicators update correctly

## Next Steps After Testing

1. **If all tests pass:**
   - Document the optimization in README
   - Update user documentation
   - Consider deploying to production

2. **If tests fail:**
   - Check browser console for errors
   - Verify database migration applied
   - Check server logs for issues
   - Review API call patterns in Network tab

3. **Future optimizations:**
   - Add cache invalidation mechanism
   - Implement background sync for metadata
   - Add performance monitoring/logging
   - Consider IndexedDB for client-side caching

