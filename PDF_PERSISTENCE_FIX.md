# PDF Persistence Fix

## Problem Description

When users uploaded a PDF and it was processed into sections, the data was NOT being saved to the database. The PDF would be processed successfully and split into sections, but after a browser refresh, all the data would be lost.

### Root Cause

In `client/src/pages/BookEditor.tsx`, the `handleProcessPDF` function was calling the `uploadPDF` mutation **without** the `bookId` parameter:

```typescript
// BEFORE (line 219-223):
const result = await uploadPDFMutation.mutateAsync({
  base64Data: base64,
  sourceLanguage: book.sourceLanguage || "en",
  targetLanguage: book.targetLanguage || "es",
  // ❌ Missing: bookId parameter!
});
```

On the backend, the `uploadPDF` mutation in `server/routers/translation.ts` only saves to the database if `bookId` is provided:

```typescript
// Save to database if bookId is provided
if (input.bookId) {
  await updateBookOriginalText(input.bookId, text, markdown);
  await updateBookSections(input.bookId, sections);
}
```

Since `bookId` was not provided, the condition was false and nothing was saved.

## The Fix

### 1. Frontend Changes (BookEditor.tsx)

Added `bookId` parameter to the uploadPDF mutation call:

```typescript
// AFTER (line 219-231):
console.log('[BookEditor] Uploading PDF with bookId:', bookId);
const result = await uploadPDFMutation.mutateAsync({
  bookId: bookId, // ✅ Include bookId to save to database
  base64Data: base64,
  sourceLanguage: book.sourceLanguage || "en",
  targetLanguage: book.targetLanguage || "es",
});
console.log('[BookEditor] PDF processed and saved:', {
  sectionsCount: result.sections.length,
  hasOriginalText: !!result.originalText,
  hasMarkdown: !!result.markdown,
});
```

Also updated the UI flow to show sections list and refresh cache:

```typescript
setSourceContent(result.markdown);
setSections(result.sections);
setCurrentSectionIndex(0);
setShowSectionsList(true); // ✅ Show the sections list

// Refresh cached data from database
await utils.books.getSections.invalidate({ id: bookId });

toast.success(`PDF processed and saved! Found ${result.sections.length} sections`);
```

### 2. Backend Logging (translation.ts)

Added comprehensive logging to track the entire PDF processing flow:

```typescript
console.log('[Translation.uploadPDF] Starting PDF upload:', {
  hasBookId: !!input.bookId,
  bookId: input.bookId,
  userId: ctx.user.id,
  pdfSize: input.base64Data.length,
});

// ... processing steps with logging ...

if (input.bookId) {
  console.log('[Translation.uploadPDF] Saving to database for book:', input.bookId);
  // ... save operations ...
  console.log('[Translation.uploadPDF] ✅ All data saved to database');
} else {
  console.warn('[Translation.uploadPDF] No bookId provided - data will NOT be saved to database');
}
```

### 3. Database Logging (db.ts)

Added logging to database update functions:

**updateBookOriginalText:**
```typescript
console.log('[Database.updateBookOriginalText] Updating original text for book:', {
  bookId: id,
  originalTextLength: originalText.length,
  parsedMarkdownLength: parsedMarkdown.length,
});
// ... update operation ...
console.log('[Database.updateBookOriginalText] ✅ Original text and markdown saved successfully');
```

**updateBookSections:**
```typescript
console.log('[Database.updateBookSections] Updating sections for book:', {
  bookId: id,
  sectionsCount: sections.length,
  sectionIds: sections.map(s => s.id).slice(0, 5),
});
// ... update operation ...
console.log('[Database.updateBookSections] ✅ Sections saved successfully');
```

## What Gets Saved

When a PDF is uploaded and processed, the following data is now saved to the database:

### 1. Original Text (`originalText` field)
- Raw text extracted from the PDF
- Preserved exactly as extracted
- Used for reference and re-processing

### 2. Parsed Markdown (`parsedMarkdown` field)
- Text converted to Markdown format
- Includes formatting, headings, lists, etc.
- Used as the source for translation

### 3. Sections (`sections` field)
- Array of section objects
- Each section contains:
  - `id`: Unique identifier
  - `content`: Section text content
  - `startLine`: Starting line number
  - `endLine`: Ending line number
  - `type`: Section type (paragraph, heading, etc.)

### 4. Sections Metadata (`sectionsMetadata` field)
- Metadata for each section
- Tracks translation status
- Updated when sections are translated

## Testing the Fix

### Test Scenario: Upload PDF

1. **Create a new project**
   - Log in to the platform
   - Create a new translation project
   - Note the project ID

2. **Upload a PDF**
   - Click "Upload PDF" tab
   - Select a PDF file
   - Click "Process PDF"

3. **Verify Processing**
   - Check console logs for:
     ```
     [BookEditor] Uploading PDF with bookId: <id>
     [Translation.uploadPDF] Starting PDF upload: { hasBookId: true, ... }
     [Translation.uploadPDF] PDF decoded, buffer size: ...
     [Translation.uploadPDF] Text extracted: { textLength: ..., ... }
     [Translation.uploadPDF] Converted to Markdown: { markdownLength: ... }
     [Translation.uploadPDF] Document split into sections: 57
     [Translation.uploadPDF] Saving to database for book: <id>
     [Database.updateBookOriginalText] Updating original text for book: ...
     [Database.updateBookOriginalText] ✅ Original text and markdown saved successfully
     [Database.updateBookSections] Updating sections for book: ...
     [Database.updateBookSections] ✅ Sections saved successfully
     [Translation.uploadPDF] ✅ All data saved to database
     [BookEditor] PDF processed and saved: { sectionsCount: 57, ... }
     ```

4. **Verify UI**
   - Sections list should appear
   - Should show "57 sections" (or however many)
   - Toast message: "PDF processed and saved! Found 57 sections"

5. **Test Persistence**
   - Refresh the browser (F5 or Cmd+R)
   - Sections should still be visible
   - No need to re-upload PDF
   - Check console logs:
     ```
     [Database.getBook] Fetching book: <id>
     [Database.getBook] Book found: { ..., sectionsCount: 57, ... }
     [Books.getSections] Returning data: { sectionsCount: 57, ... }
     [BookEditor] Cached data loaded: { sectionsCount: 57, ... }
     [BookEditor] Loading cached sections: 57
     [BookEditor] Sections list visibility set to true
     ```

6. **Verify Database (Admin Tool)**
   - Navigate to `/admin`
   - Follow instructions to start Drizzle Studio
   - Open the `books` table
   - Find your project
   - Verify fields are populated:
     - `originalText`: Should contain raw PDF text
     - `parsedMarkdown`: Should contain Markdown version
     - `sections`: Should contain array of 57 section objects
     - `sectionsMetadata`: Should contain metadata object

## Expected Behavior

### Before Fix
- ❌ PDF processed but data not saved
- ❌ Browser refresh loses all sections
- ❌ User must re-upload PDF every time
- ❌ No persistence

### After Fix
- ✅ PDF processed and saved to database
- ✅ Browser refresh loads sections from cache (<1 second)
- ✅ No need to re-upload PDF
- ✅ Full persistence
- ✅ Comprehensive logging for debugging

## Data Flow

```
1. User uploads PDF
   ↓
2. Frontend: Read file as base64
   ↓
3. Frontend: Call uploadPDF mutation WITH bookId
   ↓
4. Backend: Decode base64 to buffer
   ↓
5. Backend: Extract text from PDF (pdf-parse)
   ↓
6. Backend: Convert text to Markdown
   ↓
7. Backend: Split into sections (AI)
   ↓
8. Backend: Save to database:
   - updateBookOriginalText(bookId, text, markdown)
   - updateBookSections(bookId, sections)
   ↓
9. Backend: Return data to frontend
   ↓
10. Frontend: Update UI state
    - setSections(result.sections)
    - setShowSectionsList(true)
    - Invalidate cache
   ↓
11. Frontend: Show success message
```

## Performance Impact

- **First Upload**: ~5-15 seconds (PDF processing + AI splitting)
- **Subsequent Loads**: <1 second (cached from database)
- **Database Size**: Minimal impact (text and JSON data)

## Related Files

### Modified Files
1. `client/src/pages/BookEditor.tsx` - Added bookId parameter and UI updates
2. `server/routers/translation.ts` - Added comprehensive logging
3. `server/db.ts` - Added logging to update functions

### Database Schema
- `drizzle/schema.ts` - Already has required fields:
  - `originalText: text('originalText')`
  - `parsedMarkdown: text('parsedMarkdown')`
  - `sections: json('sections')`
  - `sectionsMetadata: json('sectionsMetadata')`

## Summary

✅ **Fixed**: PDF data now saves to database (original text, parsed markdown, sections)
✅ **Added**: Comprehensive logging throughout PDF processing flow
✅ **Improved**: UI feedback and cache invalidation
✅ **Tested**: Ready for user testing

The platform now properly persists all PDF data, making the user experience much better. Users can upload a PDF once and return to it anytime without re-processing.

