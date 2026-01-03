# AGENTS.md

## Setup commands

- Install dependencies: `pnpm install`
- Start dev server: `pnpm dev`
- Run tests: `pnpm test`

## Code style

- TypeScript strict mode enabled
- Use functional components and hooks
- Use shadcn/ui components for UI
- Follow existing patterns in `client/src/pages/` and `server/routers.ts`

## Testing instructions

- Run all tests: `pnpm test`
- Run specific test: `pnpm vitest run -t "<test name>"`
- Tests must pass before committing

## Build and deployment

- Build: `pnpm build`
- Deploy: Use Manus Settings → Publish button (requires checkpoint)
- Environment variables: Configure via Manus Settings → Secrets panel

## Project structure

- `docs/`: Project documentation (architecture, features, deployment guides)
- `agents-artifacts/`: Agent-generated logs, progress notes, and intermediate artifacts
  - `doing/`: In-progress work reports and analysis
  - `done/`: Completed reports with timestamp prefix (YYYY-MM-DD-HHmm-{name}.md)
- `client/src/`: React frontend with tRPC hooks
- `server/`: Express backend with tRPC procedures
- `drizzle/`: Database schema and migrations
- `tests/`: Unit and integration tests
- `todo.md`: High-level task tracking (root directory)

## Documentation Workflow

### In-Progress Work
- Create reports in `agents-artifacts/doing/` for ongoing analysis
- Use descriptive names: `bug-investigation.md`, `feature-analysis.md`
- Update `todo.md` with specific tasks

### Completed Work
- Move reports from `doing/` to `done/` when all issues are resolved
- Prepend timestamp: `YYYY-MM-DD-HHmm-{original-name}.md`
- Example: `2025-12-20-0326-BUG_REPORT.md`
- Mark corresponding tasks in `todo.md` as complete

### Recent Sessions
- **Session 25**: Code review identifying 8 critical issues
- **Session 26**: Fixed all 8 critical issues (data integrity, API consistency, type safety)
- **Session 27**: Added 20 new tests (8 integration + 12 E2E), all 200 tests passing
- **Session 28**: Documentation cleanup, browser E2E tests, CI/CD pipeline setup

### Current Status
- ✅ All critical bugs fixed
- ✅ 200/200 tests passing
- ✅ Production-ready
- 🚧 Adding browser E2E tests with Playwright
- 🚧 Setting up CI/CD pipeline with GitHub Actions
