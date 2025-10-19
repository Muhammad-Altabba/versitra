# Git Translation Platform - Testing Guide

## Complete User Flow Test

### Prerequisites
- GitHub or GitLab account
- OAuth apps configured with credentials in environment variables

### Test Scenario: Create and Translate a Book

#### Step 1: Initial Login
1. Navigate to the home page
2. Click "Continue with GitHub" or "Continue with GitLab"
3. **Expected**: Redirects to GitHub/GitLab OAuth authorization page
4. **Expected**: After authorization, redirects back to `/dashboard`

#### Step 2: Verify Git Connection
1. Check the dashboard header
2. **Expected**: Should show green checkmark with your Git username (e.g., "octocat")
3. **Expected**: Yellow warning banner should NOT be visible
4. **Expected**: "New Project" button should be ENABLED

#### Step 3: Create a New Translation Project
1. Click "New Project" button
2. Fill in the form:
   - Repository Name: `test-translation`
   - Book Title: `Test Book`
   - Source Language: `en`
   - Target Language: `es`
3. Click "Create Project"
4. **Expected**: 
   - Creates a new repository in your GitHub/GitLab account
   - Creates a book record in the database
   - Shows the new project in the dashboard
   - Repository should be private by default

#### Step 4: Open Book Editor
1. Click on the newly created book card
2. **Expected**: Navigates to `/book/{bookId}`
3. **Expected**: Shows "Upload Source Document" section

#### Step 5: Upload Source Content
1. Paste Markdown content in the textarea:
```markdown
# Chapter 1: Introduction

This is a test book for translation.

## Section 1.1

Here we introduce the main concepts.

## Section 1.2

More detailed information follows.
```
2. Click "Split Document & Start Translation"
3. **Expected**: 
   - AI splits document into logical sections
   - Shows progress bar
   - Displays first section in side-by-side editor

#### Step 6: Generate AI Translation Draft
1. Click "AI Draft" button
2. **Expected**:
   - Loading spinner appears
   - AI-generated Spanish translation appears in right panel
   - Translation preserves Markdown formatting

#### Step 7: Edit and Save Translation
1. Review the AI draft
2. Make any necessary edits
3. Click "Save & Next"
4. **Expected**:
   - Commits translation to Git repository under `/translated/section-1.md`
   - Commit message: `translate/section-1`
   - Moves to next section
   - Progress bar updates

#### Step 8: Navigate Between Sections
1. Use "Previous Section" and "Next Section" buttons
2. **Expected**: Can navigate through all sections
3. **Expected**: Section type is displayed (paragraph, heading, etc.)

#### Step 9: View Diff History
1. Click "View Diffs" button in header
2. **Expected**: Navigates to `/diff/{bookId}`
3. **Expected**: Shows commit history in left sidebar
4. Select two commits from dropdowns
5. **Expected**: Shows visual diff with green/red highlighting

#### Step 10: Export to PDF
1. Return to book editor
2. Click "Export PDF" button
3. **Expected**:
   - Generates PDF from translated content
   - Downloads file: `Test Book.pdf`
   - PDF includes metadata (title, author, language)

## Error Scenarios to Test

### Scenario A: No Git Connection
1. Login with Manus OAuth (if separate from Git OAuth)
2. **Expected**: Yellow warning banner visible
3. **Expected**: "New Project" button disabled
4. **Expected**: Button text: "Connect Git Account First"

### Scenario B: Invalid Repository Name
1. Try to create project with invalid name (e.g., spaces, special chars)
2. **Expected**: Validation error or sanitization

### Scenario C: Empty Source Content
1. Try to split document without pasting content
2. **Expected**: Button disabled or validation message

### Scenario D: Network Error During Translation
1. Disconnect network
2. Try to generate AI draft
3. **Expected**: Error toast message
4. **Expected**: Can retry after reconnecting

## API Testing

### Test Git Operations
```bash
# Test create repository
curl -X POST http://localhost:3000/api/trpc/git.createRepo \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"name":"test-repo","description":"Test","isPrivate":true}'

# Test get file
curl -X GET "http://localhost:3000/api/trpc/git.getFile?owner=username&repo=test-repo&path=README.md" \
  -H "Cookie: session=..."

# Test commit file
curl -X POST http://localhost:3000/api/trpc/git.commitFile \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"owner":"username","repo":"test-repo","path":"test.md","content":"# Test","message":"Add test file"}'
```

### Test Translation Service
```bash
# Test split document
curl -X POST http://localhost:3000/api/trpc/translation.splitDocument \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"content":"# Test\n\nParagraph","sourceLanguage":"en","targetLanguage":"es"}'

# Test generate draft
curl -X POST http://localhost:3000/api/trpc/translation.generateDraft \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"section":{"id":"1","content":"Hello","type":"paragraph"},"sourceLanguage":"en","targetLanguage":"es"}'
```

## Database Verification

### Check User Records
```sql
SELECT * FROM users WHERE loginMethod = 'github';
```

### Check Git Credentials
```sql
SELECT id, userId, gitProvider, gitUsername FROM git_credentials;
```

### Check Books
```sql
SELECT id, userId, repoName, title, sourceLanguage, targetLanguage FROM books;
```

## Known Limitations (MVP)

1. **No file browser**: Must paste content directly
2. **No collaborative editing**: Single user per book
3. **No branch management**: All commits to main branch
4. **No conflict resolution**: Assumes single editor
5. **No undo/redo**: Relies on Git history
6. **Limited format support**: Markdown only
7. **No real-time preview**: Side-by-side text only

## Success Criteria

- ✅ User can authenticate with GitHub/GitLab
- ✅ User can create a translation project
- ✅ Repository is created in user's Git account
- ✅ AI can split document into sections
- ✅ AI can generate translation drafts
- ✅ User can edit and save translations
- ✅ Commits are pushed to Git repository
- ✅ User can view diff between versions
- ✅ User can export to PDF
- ✅ All data stored in Git (no platform lock-in)

