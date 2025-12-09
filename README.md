# Versitra Platform

A git-based translation platform that brings version control to multilingual content. Import books and articles from Markdown or PDF, leverage AI for initial translation drafts, and track every change through git history. Perfect for translators working on long-form content.

## ✨ Key Features

- **📚 Import from Markdown or PDF** - Upload source documents in Markdown format or PDF files. The platform automatically extracts and converts content to structured sections.

- **🤖 AI-powered translation drafts** - Generate initial translation drafts using AI. Perfect for speeding up the translation workflow and reducing manual effort.

- **📝 Markdown-based workflow** - Work with clean, version-controllable Markdown files. Edit translations directly in the web editor with live preview.

- **🔄 Full git version history** - Every translation is committed to git with full history. Track changes, compare versions, and maintain complete audit trails.

- **🌍 Multi-language support** - Support for any language pair. Built-in OAuth integration with GitHub and GitLab for seamless repository management.

## 🚀 Getting Started

### Prerequisites

- Node.js 22.13.0 or higher
- npm or pnpm
- GitHub or GitLab account (for OAuth and repository storage)

### Installation

```bash
# Clone the repository
git clone https://github.com/Muhammad-Altabba/versitra-platform.git
cd versitra-platform

# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Run the development server
pnpm dev
```

The application will be available at `http://localhost:3000`.

## 📋 Project Structure

```
versitra-platform/
├── client/                 # React frontend (TypeScript)
│   ├── src/
│   │   ├── pages/         # Page components (Home, Dashboard, BookEditor, etc.)
│   │   ├── components/    # Reusable UI components
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utilities and helpers
│   └── public/            # Static assets
├── server/                # Express backend (TypeScript)
│   ├── routers/           # tRPC API routes
│   ├── db.ts              # Database operations
│   ├── git/               # Git client implementations (GitHub, GitLab)
│   ├── translation/       # Translation service and AI integration
│   └── _core/             # Core infrastructure (OAuth, auth, etc.)
├── drizzle/               # Database schema and migrations
├── tests/                 # Test suites (unit, integration, e2e)
└── storage/               # S3 storage helpers
```

## 🏗️ Architecture

### Technology Stack

- **Frontend**: React 19 + TypeScript + Tailwind CSS 4
- **Backend**: Express 4 + tRPC 11 + Node.js
- **Database**: MySQL/Turso with Drizzle ORM
- **Authentication**: OAuth 2.0 (GitHub, GitLab)
- **AI Integration**: Anthropic Claude + Local LLM support
- **Storage**: AWS S3 (or compatible)
- **Testing**: Vitest

### Data Flow

1. **User Authentication** - OAuth login via GitHub or GitLab
2. **Project Creation** - Create a translation project linked to a Git repository
3. **Document Upload** - Import source content from Markdown or PDF
4. **Document Splitting** - AI-powered document analysis to split into logical translation sections
5. **Translation Workflow** - Edit translations section-by-section with AI draft assistance
6. **Version Management** - Save drafts locally, commit versions to Git with full history
7. **Diff Viewing** - Compare translations across versions with side-by-side diffs

## 🎯 Workflow

### Step 1: Connect Git Account
- Click "Connect GitHub" or "Connect GitLab"
- Authorize the platform to create repositories in your account

### Step 2: Create Translation Project
- Click "New Project"
- Select source language and target language
- The platform creates a repository in your Git account

### Step 3: Upload Source Document
- Upload a Markdown file or PDF
- The platform automatically extracts and splits content into sections

### Step 4: Translate Section-by-Section
- View sections in the editor
- Generate AI drafts for quick initial translations
- Edit and refine translations manually
- Save drafts locally (no Git commits yet)

### Step 5: Create Version
- When ready, create a version with a meaningful title
- All drafts are committed to Git as a single version
- Full git history is maintained

### Step 6: Review & Compare
- Use the Diff Viewer to compare versions
- See exactly what changed between versions
- Track translation progress

## 🤖 AI Translation Features

### AI Draft Generation
- Click "AI Draft" to generate an initial translation for a section
- Uses Claude or configured LLM provider
- Preserves Markdown formatting and structure
- Includes context-aware translation hints

### Supported AI Providers
- **Built-in**: Manus platform LLM (default)
- **Custom**: OpenAI, Anthropic Claude, Google Gemini
- **Local**: Support for local LLM endpoints

### Usage Limits
- Configurable per-user AI usage limits
- Track monthly token usage
- Admin dashboard for usage monitoring

## 📊 Database Schema

### Core Tables
- **users** - User accounts and authentication
- **books** - Translation projects metadata
- **sectionData** - Section content, drafts, and translation status
- **sectionComments** - Comments and notes on sections
- **gitCredentials** - Encrypted OAuth tokens
- **userPreferences** - User settings and AI configuration

## 🔐 Security Features

- **OAuth 2.0 Authentication** - Secure login via GitHub/GitLab
- **Encrypted Credentials** - Git tokens stored encrypted
- **Role-based Access** - User and admin roles
- **Authorization Checks** - All operations verify user ownership
- **CSRF Protection** - Built-in CSRF token validation

## 🧪 Testing

The project includes comprehensive test coverage:

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test tests/e2e/draftPersistence.test.ts

# Run tests in watch mode
pnpm test --watch
```

### Test Coverage
- **Unit Tests**: Component logic, utilities, helpers
- **Integration Tests**: Database operations, API endpoints
- **E2E Tests**: Complete user workflows (draft persistence, version creation, etc.)

**Current Status**: 172 tests passing ✅

## 📝 Environment Variables

### Required
```
DATABASE_URL=mysql://user:password@host/database
JWT_SECRET=your-jwt-secret
GITHUB_CLIENT_ID_PRODUCTION=your-github-client-id
GITHUB_CLIENT_SECRET_PRODUCTION=your-github-client-secret
GITLAB_CLIENT_ID=your-gitlab-client-id
GITLAB_CLIENT_SECRET=your-gitlab-client-secret
```

### Optional
```
VITE_APP_TITLE=Versitra Platform
VITE_APP_LOGO=https://example.com/logo.png
BUILT_IN_FORGE_API_URL=https://api.manus.im
BUILT_IN_FORGE_API_KEY=your-api-key
```

## 🚀 Deployment

### Manus Platform (Recommended)
The project is built for deployment on the Manus platform with built-in:
- Database hosting
- S3 storage
- OAuth configuration
- Environment management
- Automatic scaling

### Custom Deployment
For custom deployment:
1. Set up MySQL/Turso database
2. Configure OAuth apps on GitHub/GitLab
3. Set up S3 bucket for file storage
4. Deploy to your hosting provider (Vercel, Railway, etc.)

## 📚 Documentation

- **TABLE_USAGE_AUDIT.md** - Comprehensive database table usage documentation
- **DEPLOYMENT_GUIDE.md** - Step-by-step deployment instructions
- **OAUTH_VERIFICATION.md** - OAuth implementation details and security features

## 🤝 Contributing

Contributions are welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙋 Support

For issues, questions, or feature requests:
- Open an issue on GitHub
- Check existing documentation
- Review test cases for usage examples

## 🎓 Learning Resources

- **React & TypeScript**: Official React and TypeScript documentation
- **tRPC**: https://trpc.io/docs
- **Drizzle ORM**: https://orm.drizzle.team
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Git Integration**: GitHub and GitLab API documentation

## 🔄 Recent Updates

### Session 16
- Fixed AI Draft persistence bug where drafts reverted to old content
- Added missing database fields for proper data persistence
- Improved cache refresh mechanism for real-time data updates

### Session 15
- Fixed section type field consistency across save/load cycle
- Created comprehensive table usage audit documentation
- Resolved AI Draft button validation errors

### Session 14
- Removed redundant sections column from books table
- Consolidated all section data into sectionData table
- Improved database schema consistency

## 🎯 Roadmap

### Planned Features
- [ ] Section-level comments and collaboration
- [ ] Auto-save with visual feedback
- [ ] Selective commit (choose which sections to commit)
- [ ] Advanced diff viewer with syntax highlighting
- [ ] Translation memory and glossary management
- [ ] Batch translation operations
- [ ] Real-time collaboration
- [ ] Offline mode support

### Performance Improvements
- [ ] Database query optimization
- [ ] Caching strategy enhancement
- [ ] Frontend bundle size reduction
- [ ] Lazy loading for large documents

---

**Built with ❤️ for translators and content creators**
