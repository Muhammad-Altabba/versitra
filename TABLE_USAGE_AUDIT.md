# Table Usage Audit Report

## Overview

This document provides a comprehensive audit of how the three main tables (`books`, `sectionData`, and `sectionComments`) are used throughout the codebase.

---

## 1. Books Table

### Schema Definition
```typescript
export const books = mysqlTable("books", {
  id: varchar("id", { length: 64 }).primaryKey(),
  userId: varchar("userId", { length: 64 }).notNull(),
  repoName: varchar("repoName", { length: 255 }).notNull(),
  repoUrl: text("repoUrl").notNull(),
  gitProvider: mysqlEnum("gitProvider", ["github", "gitlab"]).notNull(),
  title: text("title"),
  sourceLanguage: varchar("sourceLanguage", { length: 10 }),
  targetLanguage: varchar("targetLanguage", { length: 10 }),
  originalText: longtext("originalText"),
  parsedMarkdown: longtext("parsedMarkdown"),
  createdAt: timestamp("createdAt").defaultNow(),
  lastModified: timestamp("lastModified").defaultNow(),
});
```

### Usage Locations

#### Create Operations
- **`server/db.ts::createBook()`** - Creates new book entry with all metadata
  - Called by: `server/routers/books.ts::create` mutation
  - Sets: id, userId, repoName, repoUrl, gitProvider, title, sourceLanguage, targetLanguage
  - Auto-set: createdAt, lastModified

#### Read Operations
- **`server/db.ts::getBook(bookId)`** - Fetches single book by ID
  - Called by: Multiple routers (translation, books, git)
  - Returns: Complete book object
  - Used for: Authorization checks, data retrieval

- **`server/db.ts::getUserBooks(userId)`** - Fetches all books for a user
  - Called by: `server/routers/books.ts::list` query
  - Returns: Array of book objects
  - Used for: Dashboard display

#### Update Operations
- **`server/db.ts::updateBookOriginalText()`** - Updates originalText and parsedMarkdown
  - Called by: `server/routers/translation.ts::uploadPDF` and `splitDocument`
  - Updates: originalText, parsedMarkdown, lastModified
  - Purpose: Store extracted PDF text and markdown conversion

- **`server/db.ts::saveSectionsToDatabase()`** - Updates lastModified timestamp
  - Called by: `server/routers/translation.ts::splitDocument`
  - Updates: lastModified
  - Purpose: Mark book as recently edited

#### Delete Operations
- **`server/db.ts::deleteBook(id)`** - Deletes book and related Git repository
  - Called by: `server/routers/books.ts::delete` mutation
  - Deletes: Book record from database
  - Side effects: Also deletes Git repository

### Data Flow
```
User uploads PDF
    ↓
uploadPDF mutation
    ↓
updateBookOriginalText() → books.originalText, books.parsedMarkdown
    ↓
splitDocument() → saveSectionsToDatabase() → updates books.lastModified
```

---

## 2. SectionData Table

### Schema Definition
```typescript
export const sectionData = mysqlTable("sectionData", {
  id: varchar("id", { length: 64 }).primaryKey(),
  bookId: varchar("bookId", { length: 64 }).notNull(),
  sectionId: varchar("sectionId", { length: 64 }).notNull(),
  // Original content
  originalContent: longtext("originalContent").notNull(),
  startLine: varchar("startLine", { length: 20 }).notNull(),
  endLine: varchar("endLine", { length: 20 }).notNull(),
  sectionType: mysqlEnum("sectionType", ["paragraph", "heading", "code", "list"]).notNull(),
  // Draft translation
  draftTranslation: longtext("draftTranslation"),
  draftSource: longtext("draftSource"),
  // Translation status
  translationStatus: mysqlEnum("translationStatus", ["not_translated", "draft", "committed"]).default("not_translated").notNull(),
  // Committed translation (final version in Git)
  committedTranslation: longtext("committedTranslation"),
  // Metadata
  lastModified: timestamp("lastModified").defaultNow(),
  draftLastModified: timestamp("draftLastModified"),
  committedAt: timestamp("committedAt"),
  createdAt: timestamp("createdAt").defaultNow(),
});
```

### Usage Locations

#### Create Operations
- **`server/db.ts::saveSectionsToDatabase()`** - Creates sectionData entries when document is split
  - Called by: `server/routers/translation.ts::splitDocument` and `uploadPDF`
  - Sets: id, bookId, sectionId, originalContent, startLine, endLine, sectionType, translationStatus
  - Auto-set: createdAt, lastModified
  - Note: sectionType is extracted from DocumentSection.type field

- **`server/db.ts::saveSectionDraft()`** - Creates sectionData entry if it doesn't exist
  - Called by: `server/routers/books.ts::saveSectionDraft` mutation
  - Creates new entry if sectionId not found, otherwise updates

#### Read Operations
- **`server/db.ts::getAllSectionDrafts(bookId)`** - Fetches all sectionData for a book
  - Called by: `server/routers/books.ts::getAllSectionDrafts` query
  - Returns: Object with sections array (reconstructed with type field) and metadata
  - Used for: Loading sections list, tracking translation status, loading drafts
  - **CRITICAL**: Reconstructs sections with `type` field from `sectionType` enum

- **`server/db.ts::getSectionDraft(bookId, sectionId)`** - Fetches single section draft
  - Called by: `server/routers/books.ts::getSectionDraft` query
  - Returns: Single sectionData entry with draft content

#### Update Operations
- **`server/db.ts::saveSectionDraft()`** - Updates existing sectionData entry
  - Called by: `server/routers/books.ts::saveSectionDraft` mutation
  - Updates: draftTranslation, draftSource, translationStatus, draftLastModified, lastModified
  - Purpose: Save draft translation for a section

#### Delete Operations
- **`server/db.ts::saveSectionsToDatabase()`** - Deletes all sectionData for a book before re-saving
  - Called by: `server/routers/translation.ts::splitDocument`
  - Deletes: All sectionData entries where bookId matches
  - Purpose: Clear old sections when re-splitting document

### Data Flow
```
Document split into sections (DocumentSection[])
    ↓
saveSectionsToDatabase(bookId, sections)
    ↓
For each section:
  - Create sectionData entry
  - Set sectionType from section.type
  - Set translationStatus = 'not_translated'
    ↓
getAllSectionDrafts(bookId)
    ↓
Reconstruct sections array with type field from sectionType
    ↓
Return to frontend with metadata
```

### Key Issue Fixed
**Problem**: Sections were being saved with hardcoded `sectionType: 'paragraph'` instead of using the actual type from DocumentSection.

**Solution**: 
1. Updated `saveSectionsToDatabase()` to accept optional `type` field
2. Updated `getAllSectionDrafts()` to reconstruct sections with `type` field from `sectionType` enum
3. Sections now preserve their correct type through the entire save/load cycle

---

## 3. SectionComments Table

### Schema Definition
```typescript
export const sectionComments = mysqlTable("sectionComments", {
  id: varchar("id", { length: 64 }).primaryKey(),
  bookId: varchar("bookId", { length: 64 }).notNull(),
  sectionId: varchar("sectionId", { length: 64 }).notNull(),
  userId: varchar("userId", { length: 64 }).notNull(),
  content: longtext("content").notNull(),
  resolved: mysqlEnum("resolved", ["open", "resolved"]).default("open").notNull(),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});
```

### Current Status
**Status**: Defined in schema but NOT YET IMPLEMENTED in application code.

### Planned Usage
- Store comments/notes on specific sections
- Track resolution status (open/resolved)
- Enable collaboration between translators
- Link comments to specific sections and books

### Implementation TODO
- [ ] Create database functions in `server/db.ts`:
  - `addSectionComment(bookId, sectionId, userId, content)`
  - `getSectionComments(bookId, sectionId)`
  - `updateCommentStatus(commentId, resolved)`
  - `deleteSectionComment(commentId)`

- [ ] Create tRPC procedures in `server/routers/books.ts`:
  - `addComment` mutation
  - `getComments` query
  - `updateCommentStatus` mutation
  - `deleteComment` mutation

- [ ] Create frontend component in `client/src/components/`:
  - `SectionComments.tsx` - Display and manage comments
  - Integrate into `BookEditor.tsx`

---

## 4. Data Relationships

### Foreign Key Relationships
```
books (1)
  ├── sectionData (many)
  │   └── sectionComments (many)
  └── gitCredentials (1)

users (1)
  ├── books (many)
  ├── gitCredentials (1)
  ├── sectionComments (many)
  └── userPreferences (1)
```

### Data Consistency Rules
1. **Book Deletion**: When a book is deleted, all associated sectionData and sectionComments should be deleted
2. **Section Type**: Must be one of: 'paragraph', 'heading', 'code', 'list'
3. **Translation Status**: Must be one of: 'not_translated', 'draft', 'committed'
4. **Comment Resolution**: Must be one of: 'open', 'resolved'

---

## 5. Type Field Consistency

### The Issue
The `DocumentSection` interface (frontend/service) uses `type` field, but the database schema uses `sectionType` field.

### Resolution
- **Database**: Uses `sectionType` enum field
- **Frontend**: Sections passed to API use `type` field (from DocumentSection interface)
- **Conversion**: 
  - When saving: `section.type` → `sectionType` in database
  - When loading: `sectionType` → reconstructed as `type` field in returned sections array

### Code Locations
- **DocumentSection interface**: `server/translation/service.ts:3-9`
- **Save conversion**: `server/db.ts:278` - `sectionType: section.type || 'paragraph'`
- **Load conversion**: `server/db.ts:490` - `type: (data.sectionType as ...) || 'paragraph'`
- **API validation**: `server/routers/translation.ts:128` - `z.enum(['paragraph', 'heading', 'code', 'list'])`

---

## 6. Testing Coverage

### Tested Operations
- ✅ Create sections via `saveSectionsToDatabase()`
- ✅ Retrieve sections via `getAllSectionDrafts()` with type field
- ✅ Save drafts via `saveSectionDraft()`
- ✅ Update drafts
- ✅ Persist across multiple calls
- ✅ Handle empty sections
- ✅ Preserve special characters and formatting
- ✅ Track timestamps (lastModified, draftLastModified)
- ✅ Update book lastModified when draft saved
- ✅ Track translation status

### Test Files
- `tests/e2e/draftPersistence.test.ts` - 13 comprehensive e2e tests
- `tests/unit/sections.test.ts` - 2 unit tests
- `tests/integration/books.test.ts` - 13 integration tests

**All 172 tests passing** ✅

---

## 7. AI Draft Error - Root Cause and Fix

### Error
```
Failed to load resource: the server responded with a status of 400 ()
Invalid option: expected one of "paragraph"|"heading"|"code"|"list"
```

### Root Cause
The `generateDraft` procedure expects `section.type` in the input, but the validation was failing because:
1. Sections from `getAllSectionDrafts()` were missing the `type` field
2. Frontend was passing sections without the `type` field to `generateDraft`

### Fix Applied
1. **Updated `saveSectionsToDatabase()`** to accept and preserve the `type` field
2. **Updated `getAllSectionDrafts()`** to reconstruct sections with `type` field from database `sectionType`
3. **Updated `updateBookSections()` wrapper** to accept optional `type` field

### Verification
- ✅ All 172 tests passing
- ✅ TypeScript compilation: 0 errors
- ✅ Type field now flows through entire save/load cycle
- ✅ AI Draft button should now work correctly

---

## 8. Recommendations

### Immediate Actions
1. ✅ Fix section type field consistency (DONE)
2. Test AI Draft button to verify the fix works
3. Create comprehensive integration test for generateDraft with various section types

### Future Improvements
1. Implement sectionComments table functionality
2. Add cascade delete for related records when book is deleted
3. Add database indexes for common queries (bookId, sectionId)
4. Implement soft deletes for audit trail
5. Add data validation constraints at database level

### Code Quality
1. Add TypeScript strict mode validation for section types
2. Create type-safe helpers for enum conversions
3. Add database migration versioning
4. Document all foreign key relationships in schema comments
