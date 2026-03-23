# Agent Guide

Instructions for AI coding agents (Claude Code, Cursor, Windsurf, Copilot, Aider, etc.) working on this codebase.

## Getting oriented

Read these files in order:

1. **`doc/PLAN.md`** — Full project spec: schema, user flows, API routes, architecture decisions, file structure
2. **`src/db/schema.ts`** — The 4-table database schema (events, guests, sessions, photos)
3. **`README.md`** — Quick start, deployment, and test commands

Skim when relevant:
- **`doc/SDP.md`** — Software development process (TDD, deployment, CI/CD patterns)
- **`vitest.config.ts`** / **`playwright.config.ts`** — Test configuration and device profiles

## Project conventions

- **TypeScript strict** — no `any`, no `@ts-ignore`
- **Tailwind CSS v4** with custom theme tokens defined in `src/app/globals.css` (`rose-dust`, `cream`, `beige`, `charcoal`)
- **Fonts**: Playfair Display (headings), Inter (body) — use `font-heading` / `font-body`
- **App Router** — pages in `src/app/`, API routes in `src/app/api/`
- **Co-located tests** — unit tests go in `__tests__/` next to the code they test
- **E2E tests** — in `e2e/` directory, run against a live dev server
- **No file input** — camera uses `getUserMedia` only, never `<input type="file">`

## Running things

```bash
npm install              # install deps
npm run dev              # dev server on :3000
npm test                 # 166 unit tests (vitest)
npm run test:e2e         # e2e tests across 8 devices (playwright)
npm run build            # production build (also validates TypeScript)
npm run lint             # eslint
```

Production (systemd services):
```bash
make deploy              # stop, rebuild, start app + tunnel
make status              # check app and tunnel services
make logs                # tail app logs (journalctl)
make restart             # restart app without rebuilding
```

## Before submitting changes

1. `npm test` — all 166 tests must pass
2. `npm run build` — must compile without errors
3. If you changed UI: verify on mobile viewports (most guests are on phones)
4. If you added a feature: add unit tests for logic, e2e tests for user flows
5. If you changed the schema: run `npm run db:generate` for a new migration

## Key architecture notes

- **SQLite** — single-file database, no concurrent write concerns (single server)
- **SSE** — real-time push via `EventEmitter` singleton in `src/lib/event-emitter.ts`. No WebSocket, no Redis.
- **Image pipeline** — uploads go through Sharp (`src/lib/image-processing.ts`): EXIF orient → resize 2048px → WebP 100% + 300px thumbnail at 85%
- **Auth** — JWT in HttpOnly cookies. Guest sessions in `src/lib/auth.ts`, admin sessions in `src/lib/admin-auth.ts`. Dev fallback secret exists but production requires `JWT_SECRET` env var.
- **Rate limiting** — in-memory sliding window in `src/lib/rate-limit.ts`
- **Scheduled lock** — `scheduledLockAt` field on events, checked on SSE heartbeat via `src/lib/schedule-checker.ts`

## Common tasks and how to approach them

### Add a new API route
1. Read `doc/PLAN.md` for the API route inventory
2. Create route at `src/app/api/...` following existing patterns
3. Add unit tests in `src/app/api/__tests__/`
4. Use `getSessionFromCookie()` or `getAdminSessionFromCookie()` for auth

### Add a new guest page
1. Create page at `src/app/(guest)/[slug]/your-page/page.tsx`
2. Use `useSession()` hook for session context
3. Use `useEventStream()` for real-time event status
4. Middleware in `src/middleware.ts` handles route protection

### Modify the database schema
1. Edit `src/db/schema.ts`
2. Run `npm run db:generate` to create a migration in `drizzle/`
3. Update `src/db/__tests__/schema.test.ts` with the new field
4. Update `src/__tests__/migrations.test.ts` if needed

### Add a UI component
1. Check `src/components/ui/` for existing primitives (Button, Input, Card, Modal, etc.)
2. Use theme tokens from `globals.css` — don't hardcode colors
3. Mobile-first: 95%+ of users are on phones
