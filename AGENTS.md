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
- `client/src/`: React frontend with tRPC hooks
- `server/`: Express backend with tRPC procedures
- `drizzle/`: Database schema and migrations
- `tests/`: Unit and integration tests
