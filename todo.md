# Project TODO

## Completed Features

- [x] Basic homepage layout
- [x] User authentication (GitHub/GitLab OAuth)
- [x] Project creation with Git repository
- [x] Document upload (PDF and text)
- [x] AI-powered document splitting into sections
- [x] Section-by-section translation interface
- [x] Git integration for source and translated content
- [x] Project dashboard with project list
- [x] Performance optimization (sections caching, lazy loading)
- [x] JSON parsing error fix
- [x] 404 error prevention for untranslated sections
- [x] Dual-loading verification mode
- [x] DiffViewer empty state handling
- [x] Project deletion with database and Git cleanup
- [x] Draft system for saving edits to database only
- [x] Version commit system to push drafts to GitHub
- [x] Section visibility bug fix
- [x] Enhanced diff viewing with section-level filtering

## Pending Features

- [x] Add comprehensive logging throughout the project for debugging
- [x] Add database exploration tool for admin (minimal code)
- [x] Save parsed PDF text to database for future reference
- [ ] Frontend UI for draft system (save draft button, draft indicator)
- [ ] Frontend UI for version commit (commit version button, commit dialog)
- [ ] Section-level diff viewer in BookEditor
- [ ] Auto-save drafts functionality
- [ ] Draft conflict resolution
- [ ] Selective commit (choose which drafts to commit)
- [ ] Side-by-side diff view
- [ ] Syntax highlighting in diff viewer
- [ ] Undo/redo functionality
- [ ] Collaborative editing
- [ ] Real-time sync
- [ ] Offline mode

## Known Bugs

- [x] GitHub repository not being deleted when project is deleted (FIXED)
- [x] PDF text extraction failing in deployed environment - switched to JavaScript-based pdf-parse (FIXED)
- [x] Parsed book sections not loading after browser refresh - data persistence issue (FIXED - showSectionsList not set to true)

## Technical Debt

- [x] Write unit tests for all features
- [x] Write integration tests for all features
- [x] Add unit tests for draft system
- [x] Add integration tests for version commit
- [x] Add integration tests for project deletion
- [ ] Add E2E tests for full user workflows
- [ ] Improve error handling in Git operations
- [ ] Add retry logic for failed Git commits
- [ ] Optimize database queries for large projects
- [ ] Add caching for commit history
- [ ] Improve TypeScript types for draft system

## Documentation

- [x] FEATURES_IMPLEMENTED.md - Complete feature documentation
- [x] FIXES_APPLIED.md - Bug fixes documentation
- [x] ALL_FIXES_SUMMARY.md - Summary of all fixes
- [x] PERFORMANCE_OPTIMIZATION.md - Performance improvements
- [x] SECTION_VISIBILITY_FIX.md - Section visibility bug fix and logging documentation
- [ ] API documentation
- [ ] User guide
- [ ] Developer setup guide
- [ ] Deployment guide



## New Issues

- [x] PDF processing not saving data to database (original text, parsed text, sections) - FIXED


- [x] Database TEXT field size limitation - need LONGTEXT for large PDFs (FIXED - changed to LONGTEXT)


- [x] DiffViewer page not showing commit history and diffs (commits exist in GitHub) - FIXED

