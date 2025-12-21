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

### Current Reports
Review these reports and move to `done/` when all issues are resolved:
- `BUG_REPORT.md` - 15 identified issues
- `DATABASE_CODE_REVIEW.md` - Database analysis
- `EXECUTION_SEQUENCE_REVIEW.md` - Workflow documentation
- `SECTION_SAVE_LOAD_ISSUES.md` - Section persistence
- `TABLE_USAGE_AUDIT.md` - Table usage patterns
