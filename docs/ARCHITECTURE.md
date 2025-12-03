# Git Translation Platform - Architecture

## Overview
A minimal web application that enables human translators to work section-by-section on books while using Git for storage, versioning, and diff visualization.

## Core Principles
1. **Git-first storage**: All translation data lives in Git repositories (no database for content)
2. **User-owned repos**: Each book gets its own repository in the translator's personal Git account
3. **Minimal backend**: Lightweight Node/Express service with no content database
4. **AI-assisted workflow**: Anthropic API + local LLM for contextual splits and draft translations

## Repository Structure

### Book Repository Layout
```
/source/         # Original Markdown files
/translated/     # Translator-approved Markdown files
/drafts/         # Auto-generated AI drafts (optional)
.git/            # Version history
```

### Admin Registry Repository
- Owned by the platform
- Contains a simple registry file tracking all translators
- Format: JSON file with translator metadata
- Commits: `add-translator/<username>` for each new user

## Data Model

### Database Schema (Minimal)
Since we're using Git for content storage, the database only tracks:
- **users**: OAuth user profiles (id, name, email, loginMethod, role, gitProvider, gitUsername, gitAccessToken)
- **books**: Metadata linking to Git repos (id, userId, repoUrl, repoName, gitProvider, createdAt, lastModified)
- **sessions**: Active translation sessions (optional, for UI state)

### Git Storage
- **Content**: All Markdown files live in Git
- **Versioning**: Git commits track every change
- **Metadata**: Commit messages encode operation type (translate/revise/upload)

## Authentication Flow

### OAuth Integration
1. User clicks "Login with GitHub" or "Login with GitLab"
2. OAuth flow redirects to provider
3. Platform receives:
   - User profile (name, email, username)
   - Access token (for Git API operations)
4. Store token securely for Git operations
5. Register user in admin registry (first login only)

### Scopes Required
- **GitHub**: `repo` (full repository access), `user:email`
- **GitLab**: `api` (full API access), `read_user`

## Core Workflows

### 1. Book Creation
1. User uploads/pastes source Markdown
2. Platform creates new repo in user's Git account
3. Commits source files to `/source/` directory
4. Records repo metadata in database

### 2. Translation Workflow
1. Load source Markdown from Git
2. AI suggests contextual splits (paragraphs, sections, chapters)
3. AI generates draft translations
4. Translator reviews in side-by-side editor
5. On acceptance, commit to `/translated/` directory
6. Commit message: `translate/<section-id>` or `revise/<section-id>`

### 3. Version Diff Viewer
1. Fetch commit history via Git API
2. Display commit list with timestamps
3. On selection, fetch diff between two commits
4. Render side-by-side Markdown diff with line-level highlighting

### 4. Export
1. **PDF**: Concatenate all files from `/translated/`, convert to PDF
2. **Markdown**: Zip all files from `/translated/` directory

## Technical Stack

### Frontend
- **Framework**: React 19 + TypeScript
- **Routing**: Wouter
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **State**: tRPC React Query
- **Editor**: Monaco Editor (for side-by-side Markdown editing)
- **Diff Viewer**: react-diff-view or custom implementation

### Backend
- **Runtime**: Node.js + Express 4
- **API**: tRPC 11 (type-safe procedures)
- **Database**: MySQL (via Drizzle ORM) - minimal schema
- **Git Operations**: 
  - GitHub: Octokit (@octokit/rest)
  - GitLab: @gitbeaker/node
- **AI Integration**:
  - Anthropic API (via built-in LLM helper)
  - Local LLM fallback (optional)

### External Services
- **OAuth**: GitHub OAuth, GitLab OAuth
- **Git Hosting**: GitHub, GitLab (user accounts)
- **AI**: Anthropic Claude (via platform LLM helper)
- **Storage**: Git repositories (no S3 needed for MVP)

## API Design

### tRPC Procedures

#### Auth
- `auth.me` - Get current user
- `auth.logout` - Clear session

#### Git Integration
- `git.createRepo` - Create new book repository
- `git.listRepos` - List user's book repositories
- `git.getFile` - Read file from repository
- `git.commitFile` - Commit file to repository
- `git.getCommitHistory` - Get commit log
- `git.getDiff` - Get diff between commits

#### Books
- `books.create` - Create new book project
- `books.list` - List user's books
- `books.get` - Get book details
- `books.delete` - Delete book project

#### Translation
- `translation.splitDocument` - AI-powered document splitting
- `translation.generateDraft` - Generate AI translation draft
- `translation.saveTranslation` - Commit approved translation
- `translation.getProgress` - Calculate translation progress

#### Export
- `export.generatePDF` - Export translated book as PDF
- `export.downloadMarkdown` - Download translated Markdown files

## Security Considerations

1. **Token Storage**: Encrypt Git access tokens in database
2. **Scope Limitation**: Request minimal OAuth scopes
3. **Repo Isolation**: Only access repos created by platform
4. **Rate Limiting**: Respect Git provider API limits
5. **Input Validation**: Sanitize all Markdown input

## MVP Limitations

### Out of Scope
- ❌ Multiple user roles (everyone is a translator)
- ❌ Collaboration features (one translator per book)
- ❌ Payment/billing system
- ❌ Timeline/deadline tracking
- ❌ Advanced workflow states
- ❌ Custom styling for PDF export
- ❌ Real-time collaboration
- ❌ Comments/annotations

### Future Enhancements
- Multi-user collaboration
- Custom PDF templates
- Translation memory
- Terminology management
- Progress analytics
- Webhook integrations

## Development Phases

1. ✅ **Phase 1**: Project initialization
2. **Phase 2**: OAuth integration (GitHub + GitLab)
3. **Phase 3**: Git operations (create repo, commit, read)
4. **Phase 4**: Translation workflow (split, draft, save)
5. **Phase 5**: Diff viewer
6. **Phase 6**: PDF export
7. **Phase 7**: Testing and polish
8. **Phase 8**: Deployment

## File Structure

```
git-translation-platform/
├── client/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Home.tsx           # Landing page
│   │   │   ├── Dashboard.tsx      # Book list
│   │   │   ├── BookEditor.tsx     # Main translation interface
│   │   │   ├── DiffViewer.tsx     # Version comparison
│   │   │   └── Export.tsx         # Export options
│   │   ├── components/
│   │   │   ├── MarkdownEditor.tsx # Side-by-side editor
│   │   │   ├── SectionList.tsx    # Document sections
│   │   │   └── GitStatus.tsx      # Commit history
│   │   └── lib/
│   │       └── git.ts             # Git helper utilities
├── server/
│   ├── routers.ts                 # tRPC procedures
│   ├── db.ts                      # Database queries
│   ├── git/
│   │   ├── github.ts              # GitHub API client
│   │   ├── gitlab.ts              # GitLab API client
│   │   └── registry.ts            # Admin registry operations
│   ├── translation/
│   │   ├── splitter.ts            # Document splitting logic
│   │   └── drafts.ts              # AI draft generation
│   └── export/
│       └── pdf.ts                 # PDF generation
├── drizzle/
│   └── schema.ts                  # Database schema
└── shared/
    └── types.ts                   # Shared TypeScript types
```

## Key Design Decisions

1. **Git as Database**: Content lives in Git, not in our database
2. **User-Owned Repos**: Translators own their work, platform just facilitates
3. **Commit-Based Workflow**: Every save is a Git commit with semantic messages
4. **AI-Assisted, Human-Approved**: AI suggests, humans decide
5. **Minimal Backend State**: Database only for metadata and auth
6. **OAuth-Only Auth**: No password management, leverage Git providers
7. **Frontend-Heavy**: Most logic in React, backend is thin API layer

