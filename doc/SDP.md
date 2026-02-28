# Software Development Process

A reusable development process distilled from building Kekkonsnap. Applicable to any small-to-mid-scale web project with a solo developer or small team.

## 1. Planning

### Start with a PLAN.md

Before writing code, create a `doc/PLAN.md` that covers:

- **Context** — what the project does and who it's for
- **Tech stack table** — every major dependency with rationale
- **Database schema** — tables, fields, relationships
- **User flows** — numbered screens, each with concrete behavior notes
- **API routes** — full route inventory with methods and access rules
- **Architecture decisions** — real-time strategy, auth model, file storage, etc.
- **File structure** — planned directory layout
- **Build order** — phased implementation plan with clear dependencies between phases
- **Verification checklist** — manual and automated checks to confirm the app works

The plan is a living document. Update it as the project evolves — it serves as the canonical reference for what the system does and why.

### Phased build order

Break work into sequential phases where each phase builds on the last:

1. **Foundation** — project scaffold, database schema, auth, design system
2. **Core flow** — the primary user-facing feature set
3. **Secondary flows** — galleries, history, read-only views
4. **Real-time / integrations** — SSE, webhooks, external APIs
5. **Admin** — management UI, moderation tools
6. **Deploy + polish** — Docker, reverse proxy, error states, edge cases

Each phase should be independently testable. Don't move on until the current phase is solid.

## 2. Tech stack choices

### Guiding principles

- **Fewer moving parts** — SQLite over Postgres when you don't need concurrent write throughput. EventEmitter over Redis when you're single-process. Local disk over S3 when you're on one VPS.
- **Standalone output** — build artifacts should run without the full dev toolchain (`next build` → `standalone` mode, single `server.js`).
- **One language** — TypeScript everywhere (app, tests, scripts, migrations) reduces context-switching.
- **Pin decisions early** — choose your ORM, CSS framework, and image pipeline before Phase 1 ends. Changing these mid-project is expensive.

### Recommended defaults (2025+)

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) | File-based routing, API routes, SSR, standalone output |
| Language | TypeScript strict | Catches bugs at compile time |
| Database | SQLite + Drizzle ORM | Zero-config, type-safe schema, easy migrations |
| Styling | Tailwind CSS | Utility-first, no context-switching to CSS files |
| Image processing | Sharp | Fast, handles EXIF, WebP compression, thumbnails |
| Auth | JWT (jose) + HttpOnly cookies | Stateless, no session store needed |
| Real-time | SSE via EventEmitter | Simpler than WebSockets for one-way push |
| Deployment | Docker multi-stage + Caddy | Small images, auto HTTPS, zero-config TLS |

Swap any of these based on your project's constraints — the process works regardless of specific tools.

## 3. Test-Driven Development

### Testing philosophy

- **Write tests alongside features, not after.** Each phase in the build order should include its tests.
- **Test at the right level.** Don't mock what you can run for real. Don't spin up browsers for what a unit test covers.
- **Tests are documentation.** A passing test suite is the most trustworthy spec.

### Unit tests (Vitest)

Unit tests cover the "logic layer" — everything below the UI:

- **Database schema** — constraints, cascades, defaults, CRUD operations
- **Auth** — JWT creation/verification, password hashing, session management
- **Business logic** — rate limiting, image processing, fuzzy matching, schedulers
- **API routes** — request/response contracts, error codes, access control

Key practices:

- **In-memory database for speed.** Use SQLite `:memory:` with Drizzle so each test file gets a fresh schema in milliseconds — no test database cleanup.
- **Co-locate tests.** Place test files in `__tests__/` directories next to the code they test (`src/lib/__tests__/`, `src/app/api/__tests__/`).
- **Test constraints, not implementations.** Assert on what the database rejects, what the API returns, what the function outputs — not internal details.

```
vitest.config.ts:
  environment: "node"
  include: ["src/**/__tests__/**/*.test.ts"]
  globals: true
```

### E2E tests (Playwright)

E2E tests cover the "user layer" — real browsers interacting with real pages:

- **Guest flows** — landing, identification, terms, camera, photos, winner reveal
- **Admin flows** — login, dashboard, event management
- **Layout** — no horizontal overflow, header visibility across all pages
- **Visual regression** — per-device screenshot baselines with diff tolerance
- **Cross-device** — test on the actual device profiles your users will have

Key practices:

- **Seed via real API calls.** The `globalSetup` should create test data through the same API your app exposes — not direct DB imports. This tests more of the real stack.
- **Auth fixtures.** Create reusable fixtures like `authedPage` (fully authenticated browser context) and `preTermsPage` (partially authenticated). Cache cookies to avoid rate limit issues.
- **Mock hardware, not APIs.** For camera-dependent features, override `getUserMedia` via `page.addInitScript()` rather than mocking the upload API. Test the real upload path.
- **Multiple device profiles.** Define Playwright projects for each target device. Mobile-first apps need at minimum: small phone, mid phone, large phone, desktop.
- **Sequential, single worker.** Run e2e tests with `workers: 1` and `fullyParallel: false` when tests share server state. Parallelism at the device-project level is fine.
- **Visual regression.** Use `toHaveScreenshot()` with a reasonable diff tolerance (5% works well). Store baselines in git. Regenerate after intentional UI changes.

```
playwright.config.ts:
  fullyParallel: false
  workers: 1
  webServer: { command: "npm run dev", reuseExistingServer: !process.env.CI }
  globalSetup: "./e2e/global-setup.ts"
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.05 } }
```

### When to write which kind of test

| What you're testing | Test type | Why |
|---|---|---|
| Schema constraint (unique, not-null, FK cascade) | Unit | Fast, deterministic |
| API route returns correct status code | Unit | No browser needed |
| Rate limiter blocks after N requests | Unit | Time-sensitive, needs control |
| Image pipeline produces valid WebP | Unit | Binary output validation |
| Guest can identify and reach the camera | E2E | Multi-page flow with cookies |
| Page doesn't overflow on iPhone SE | E2E | Real viewport rendering |
| Admin can pick a winner and announce | E2E | Full stack with SSE |

### Test data strategy

- **Unit tests:** in-memory SQLite, fresh schema per test file, factory functions for common entities.
- **E2E tests:** global setup seeds a test event and guests via HTTP API. Each spec uses fixtures to create authenticated browser contexts. Teardown deletes the test event.
- **Never share mutable state between tests.** Each test should be independent.

## 4. Deployment

### Docker multi-stage build

Three stages minimize the production image:

1. **deps** — `npm ci` only, cached by `package-lock.json`
2. **builder** — full source copy + `npm run build`
3. **runner** — only `standalone/` output, `public/`, static assets, migrations. No `node_modules`, no source.

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
USER nextjs
CMD ["node", "server.js"]
```

Key points:

- **Non-root user.** Create a `nextjs` user and switch to it before `CMD`.
- **Persistent data volumes.** Mount `/app/data` as a Docker volume for the database and uploads. Never bake data into the image.
- **Env vars at runtime.** Use `${VAR:?error}` syntax in `docker-compose.yml` to fail fast on missing required vars.

### Reverse proxy (Caddy)

Caddy provides auto HTTPS with zero configuration beyond a domain name:

```
yourdomain.com {
    encode gzip

    # SSE — disable buffering for real-time streaming
    @sse path /api/events/*/status
    reverse_proxy @sse app:3000 {
        flush_interval -1
    }

    reverse_proxy app:3000
}
```

Critical details:

- **SSE needs `flush_interval -1`.** Without this, Caddy buffers SSE responses and clients see nothing until the buffer fills.
- **Upload size limits.** Set `request_body { max_size 15MB }` or similar based on your needs.
- **HTTPS is mandatory** for browser APIs like `getUserMedia`, `ServiceWorker`, etc.

### docker-compose.yml

```yaml
services:
  app:
    build: .
    restart: unless-stopped
    volumes:
      - app-data:/app/data
    environment:
      - JWT_SECRET=${JWT_SECRET:?Set JWT_SECRET in .env}
    expose:
      - "3000"

  caddy:
    image: caddy:2-alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
    depends_on:
      - app

volumes:
  app-data:
  caddy-data:
```

### Alternative: Tailscale

For testing or private access, Tailscale gives you HTTPS without DNS or port forwarding:

```bash
npm run dev
sudo tailscale serve --bg http://localhost:3000
```

Useful for testing on real devices during development.

## 5. CI/CD

### Recommended pipeline (GitHub Actions or similar)

```
on push / PR:
  1. npm ci
  2. npm run lint
  3. npm test            (unit tests — fast, no browser)
  4. npm run build       (catch build errors)
  5. npx playwright test (e2e — slower, real browsers)
  6. docker build .      (verify the image builds)
```

### Key principles

- **Lint is a test.** Include `next lint` in the unit test suite (or run it separately). Lint errors should break the build, not just warn.
- **Build must succeed.** TypeScript strict mode catches runtime errors at compile time. A passing `npm run build` is a meaningful signal.
- **E2E in CI needs `forbidOnly: true`.** Prevent accidentally committed `.only` from silencing other tests.
- **Retries in CI, not locally.** Use `retries: process.env.CI ? 2 : 0` to handle flaky browser tests in CI without hiding real failures during development.
- **Cache aggressively.** Cache `node_modules/`, `.next/cache/`, Playwright browsers, and Docker layers.

### Deployment trigger

For a self-hosted VPS:

```bash
# On the server (triggered by webhook, SSH, or manual):
git pull
docker compose up -d --build
```

For more sophisticated setups, use a CI step that SSHs into the server or pushes to a container registry.

## 6. Makefile as a task runner

A `Makefile` provides memorable shortcuts that work everywhere:

```makefile
.PHONY: all build start stop test test-e2e test-all

all: stop build start

build:
	npm run build

start:
	nohup npm start > /tmp/app.log 2>&1 & echo $$! > .pid

stop:
	# Graceful PID-based stop with fallback to pgrep

test:
	npm test

test-e2e:
	npx playwright test

test-all: test test-e2e
```

Benefits over npm scripts alone:

- `make` is available on every Unix system
- Targets compose naturally (`test-all: test test-e2e`)
- Process management (start/stop) belongs in Make, not `package.json`

## 7. Development workflow

### Feature development cycle

```
1. Update PLAN.md if the feature changes scope or architecture
2. Write unit tests for the new logic (red)
3. Implement the feature (green)
4. Run `npm test` — all tests pass
5. Run `npm run build` — TypeScript compiles
6. Manual verification on target devices
7. Write e2e tests for the new user flow
8. Run `npm run test:e2e` — all e2e pass
9. Commit with a descriptive message
```

### Bug fix cycle

```
1. Reproduce the bug manually
2. Write a failing test that captures the bug
3. Fix the code
4. Confirm the test passes
5. Run full test suite to check for regressions
6. Commit
```

### Code organization conventions

- **Co-locate related code.** Tests next to source (`__tests__/`), not in a separate tree.
- **Flat over nested.** `src/lib/auth.ts` over `src/lib/auth/index.ts` unless you genuinely have multiple files.
- **Components by domain.** `components/camera/`, `components/guest/`, `components/admin/` — not `components/buttons/`, `components/modals/`.
- **API routes mirror the URL.** `src/app/api/admin/[slug]/lock/route.ts` serves `POST /api/admin/:slug/lock`.
- **Scripts in `scripts/`.** CLI tools for setup, seeding, migration — not buried in `src/`.

## 8. Checklist for new projects

- [ ] Create `doc/PLAN.md` with full spec before writing code
- [ ] Set up TypeScript strict, ESLint, Tailwind
- [ ] Define database schema with Drizzle, generate initial migration
- [ ] Write unit tests alongside each module
- [ ] Set up Playwright with target device profiles
- [ ] Create `Dockerfile` (multi-stage), `docker-compose.yml`, `Caddyfile`
- [ ] Create `Makefile` with build/start/stop/test targets
- [ ] Add `.env.example` with all required variables documented
- [ ] Write seed/setup scripts for local development
- [ ] Test on real devices over HTTPS before shipping
