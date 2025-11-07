# Database Field Size Fix

## Problem Description

When uploading large PDFs, the database save operation was failing with an error:

```
TRPCClientError: Failed query: update `books` set `originalText` = ?, `parsedMarkdown` = ?, `lastModified` = ? where `books`.`id` = ?
```

### Root Cause

The `originalText` and `parsedMarkdown` fields in the `books` table were defined as `TEXT` type in MySQL, which has a maximum size of **65,535 bytes (~64KB)**.

For large PDF documents (like the 57-section document mentioned), the extracted text easily exceeds this limit, causing the database update to fail.

### MySQL Text Type Sizes

| Type | Maximum Size | Use Case |
|------|-------------|----------|
| `TINYTEXT` | 255 bytes | Very short text |
| `TEXT` | 65,535 bytes (~64KB) | ❌ Too small for PDFs |
| `MEDIUMTEXT` | 16,777,215 bytes (~16MB) | Medium documents |
| `LONGTEXT` | 4,294,967,295 bytes (~4GB) | ✅ Perfect for large PDFs |

## The Fix

### 1. Schema Update (drizzle/schema.ts)

Changed from `text()` to `longtext()`:

```typescript
// BEFORE:
import { mysqlEnum, mysqlTable, text, timestamp, varchar, json } from "drizzle-orm/mysql-core";

export const books = mysqlTable("books", {
  // ...
  originalText: text("originalText"), // ❌ Limited to 64KB
  parsedMarkdown: text("parsedMarkdown"), // ❌ Limited to 64KB
  // ...
});
```

```typescript
// AFTER:
import { mysqlEnum, mysqlTable, text, longtext, timestamp, varchar, json } from "drizzle-orm/mysql-core";

export const books = mysqlTable("books", {
  // ...
  originalText: longtext("originalText"), // ✅ Supports up to 4GB
  parsedMarkdown: longtext("parsedMarkdown"), // ✅ Supports up to 4GB
  // ...
});
```

### 2. Database Migration (0006_tidy_whirlwind.sql)

Generated and applied migration:

```sql
ALTER TABLE `books` MODIFY COLUMN `originalText` longtext;
ALTER TABLE `books` MODIFY COLUMN `parsedMarkdown` longtext;
```

Migration applied successfully with:
```bash
pnpm db:push
```

## Impact

### Before Fix
- ❌ PDFs larger than 64KB failed to save
- ❌ Database error: "Failed query: update books..."
- ❌ User sees "Failed to process PDF" error
- ❌ No data persistence

### After Fix
- ✅ PDFs up to 4GB can be saved
- ✅ No database errors
- ✅ Successful processing message
- ✅ Full data persistence

## Testing

### Test Scenario: Large PDF Upload

1. **Upload a large PDF** (e.g., 57 sections, ~100KB+ text)
2. **Expected behavior:**
   - PDF processes successfully
   - Text extracted and converted to Markdown
   - Document split into sections
   - All data saved to database
   - Success message: "PDF processed and saved! Found X sections"
   - No errors in console

3. **Verify in database:**
   - Navigate to `/admin`
   - Start Drizzle Studio: `pnpm db:studio`
   - Open `books` table
   - Check that `originalText` and `parsedMarkdown` contain full text

4. **Verify persistence:**
   - Refresh browser
   - Sections should load from cache
   - No need to re-upload PDF

### Console Logs (Success)

```
[BookEditor] Uploading PDF with bookId: <id>
[Translation.uploadPDF] Starting PDF upload: { hasBookId: true, ... }
[Translation.uploadPDF] PDF decoded, buffer size: 123456
[Translation.uploadPDF] Text extracted: { textLength: 98765, ... }
[Translation.uploadPDF] Converted to Markdown: { markdownLength: 98765 }
[Translation.uploadPDF] Document split into sections: 57
[Translation.uploadPDF] Saving to database for book: <id>
[Database.updateBookOriginalText] Updating original text for book: { bookId: '<id>', originalTextLength: 98765, parsedMarkdownLength: 98765 }
[Database.updateBookOriginalText] ✅ Original text and markdown saved successfully
[Database.updateBookSections] Updating sections for book: { bookId: '<id>', sectionsCount: 57, ... }
[Database.updateBookSections] ✅ Sections saved successfully
[Translation.uploadPDF] ✅ All data saved to database
[BookEditor] PDF processed and saved: { sectionsCount: 57, hasOriginalText: true, hasMarkdown: true }
```

## Technical Details

### Field Sizes

**originalText:**
- Contains raw text extracted from PDF
- Size varies based on PDF content
- Typical range: 10KB - 10MB
- Maximum supported: 4GB

**parsedMarkdown:**
- Contains Markdown-formatted version
- Usually similar size to originalText
- May be slightly larger due to Markdown syntax
- Maximum supported: 4GB

### Performance Considerations

**Storage:**
- LONGTEXT fields are stored off-page in MySQL
- Does not impact row size or index performance
- Only the pointer (8 bytes) is stored in the main table

**Query Performance:**
- Selecting LONGTEXT fields is fast (pointer lookup)
- Only fetched when explicitly selected
- No impact on queries that don't select these fields

**Backup/Restore:**
- Larger backup files
- Longer backup/restore times for large documents
- Consider compression for backups

## Related Files

### Modified Files
1. `drizzle/schema.ts` - Changed text() to longtext() for originalText and parsedMarkdown
2. `drizzle/0006_tidy_whirlwind.sql` - Migration file (auto-generated)

### Affected Components
1. `server/routers/translation.ts` - uploadPDF mutation
2. `server/db.ts` - updateBookOriginalText function
3. `client/src/pages/BookEditor.tsx` - PDF upload handling

## Migration Notes

### For Existing Data

The migration uses `MODIFY COLUMN` which:
- ✅ Preserves existing data
- ✅ Converts TEXT to LONGTEXT automatically
- ✅ No data loss
- ✅ Non-blocking operation (in most cases)

### Rollback (if needed)

To rollback (not recommended):
```sql
ALTER TABLE `books` MODIFY COLUMN `originalText` text;
ALTER TABLE `books` MODIFY COLUMN `parsedMarkdown` text;
```

**Warning:** Rollback will fail if any existing data exceeds 64KB.

## Best Practices

### For Future Schema Changes

1. **Consider data size requirements upfront**
   - TEXT: < 64KB
   - MEDIUMTEXT: < 16MB
   - LONGTEXT: < 4GB

2. **Use appropriate types**
   - Short descriptions: VARCHAR
   - Medium content: TEXT
   - Large documents: LONGTEXT

3. **Test with realistic data**
   - Upload large PDFs during testing
   - Verify database constraints
   - Check error handling

## Summary

✅ **Fixed:** Database field size limitation for large PDFs
✅ **Changed:** TEXT → LONGTEXT for originalText and parsedMarkdown
✅ **Capacity:** Now supports PDFs up to 4GB
✅ **Migration:** Successfully applied to database
✅ **Testing:** Ready for large document uploads

The platform can now handle PDFs of any reasonable size without database errors.

