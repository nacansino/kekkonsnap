# Kekkonsnap

Wedding photo contest web app. Guests scan a QR code, take limited camera-only shots, and compete for best photo. The winner is revealed live on everyone's phone.

## How it works

1. **Guests scan QR** at the wedding and land on the app
2. **Enter name** (fuzzy-matched against the guest list)
3. **Agree to terms** (photos are public, can't be deleted)
4. **Take photos** using the phone camera (no gallery uploads — camera only)
5. **Limited shots** (configurable, e.g. 7 per guest)
6. **Admin picks a winner** after locking the event (can also schedule auto-lock)
7. **Winner revealed** live on everyone's phone via SSE push
8. **All photos unlocked** for everyone to see after the announcement

## Tech stack

- **Next.js 15** (App Router, standalone output)
- **SQLite** via better-sqlite3 + Drizzle ORM
- **Tailwind CSS v4** with custom wedding palette
- **Sharp** for image processing (EXIF orientation, WebP compression, thumbnails)
- **SSE** via EventEmitter singleton for real-time winner announcement
- **jose** for JWT sessions, **bcryptjs** for admin password hashing
- **Fuse.js** for fuzzy guest name matching
- **Docker** + **Caddy** for deployment with auto HTTPS

## Quick start

```bash
# Install dependencies
npm install

# Create .env
cp .env.example .env
# Edit .env and set a real JWT_SECRET (at least 32 chars)

# Create an event
npm run db:create-event -- --name "Our Wedding" --slug our-wedding --password admin123 --shot-limit 7

# Seed guests (JSON file)
npm run db:seed -- --slug our-wedding --file ./data/guests.json

# Or seed with demo data
npm run db:seed -- --demo

# Start dev server
npm run dev
```

Guest URL: `http://localhost:3000/our-wedding`
Admin URL: `http://localhost:3000/admin/our-wedding`

## Guest list format

**JSON:**
```json
[
  {"name": "John Smith", "table": "1"},
  {"name": "Jane Doe", "table": "2"}
]
```

**CSV:**
```
name,table
John Smith,1
Jane Doe,2
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm test` | Run unit tests (vitest) |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run test:e2e` | Run Playwright e2e tests (all 8 devices) |
| `npm run test:e2e:ui` | Open Playwright interactive UI |
| `npm run test:e2e:debug` | Run e2e tests in debug mode |
| `npm run test:e2e:update-snapshots` | Regenerate visual regression baselines |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:create-event` | Create a new event via CLI |
| `npm run db:seed` | Seed guest list from file |
| `make build` | Production build (alias) |
| `make start` | Start production server (daemon) |
| `make stop` | Stop production server |
| `make test` | Run unit tests |
| `make test-e2e` | Run Playwright e2e tests |
| `make test-e2e-ui` | Open Playwright interactive UI |
| `make test-all` | Run unit + e2e tests |

## Deployment (Docker + Caddy)

```bash
# Edit .env with production values
# Edit Caddyfile — replace kekkonsnap.example.com with your domain

docker compose up -d --build
```

Caddy auto-provisions HTTPS via Let's Encrypt. HTTPS is required for the camera API (`getUserMedia`).

### Seed the event inside Docker:

```bash
docker compose exec app node scripts/create-event.js \
  --name "Our Wedding" --slug our-wedding --password YOUR_PASSWORD --shot-limit 7
```

## Tailscale (alternative to Caddy)

For testing or small-scale use, you can serve via Tailscale instead of Caddy:

```bash
npm run dev
sudo tailscale serve --bg http://localhost:3000
```

This gives you HTTPS at `https://your-machine.tailnet-name.ts.net/`.

## Project structure

```
src/
  app/
    (guest)/[slug]/       Landing, terms, camera, photos, winner, gallery
    admin/[slug]/         Login, dashboard, guest management
    api/                  All API routes
  components/
    ui/                   Button, Input, Card, Modal, LoadingSpinner, ProgressBar
    camera/               CameraViewfinder, ShutterButton, ShotCounter, etc.
    guest/                NameAutocomplete, TermsConsent, PhotoGrid, PhotoLightbox
    winner/               WinnerReveal, WaitingScreen, ConfettiEffect
    providers/            SessionProvider, EventStreamProvider
  db/                     Schema, connection, seed
  lib/                    Auth, image processing, storage, rate limiting, SSE
```

## Admin flow

1. Go to `/admin/our-wedding` and enter your password
2. **During the event:** watch photos come in from the live feed, swipe through them in the lightbox
3. **Lock the event** when it's time — or schedule an auto-lock time
4. **Pick a winner** by clicking on a photo (or from within the lightbox)
5. **Announce** — the winner appears on everyone's phone instantly
6. **Download all photos** as a ZIP organized by guest name
7. **Navigate** between events using the "Events" link in the nav header

## Environment variables

| Variable | Description | Default |
|---|---|---|
| `JWT_SECRET` | Secret for signing JWTs (min 32 chars) | Dev default provided |
| `DATABASE_URL` | Path to SQLite database | `./data/kekkonsnap.db` |
| `UPLOAD_DIR` | Path to photo storage directory | `./data/uploads` |
| `ADMIN_MASTER_PASSWORD` | Master password for creating/managing events | `kekkonsnap-admin` |

## Tests

### Unit tests

```bash
npm test
```

164 tests across 11 test files covering the database schema, auth/JWT, rate limiting, image processing, storage, fuzzy matching, guest API routes, admin API routes, schedule-lock API, and schedule-checker.

### E2E tests (Playwright)

```bash
# Install browsers (first time only)
npx playwright install --with-deps

# Run all tests across 8 device profiles
npm run test:e2e

# Interactive UI for visual inspection
npm run test:e2e:ui

# Regenerate screenshot baselines after intentional UI changes
npm run test:e2e:update-snapshots
```

Tests across 8 device profiles:

| Device | Viewport | Engine |
|--------|----------|--------|
| iPhone SE | 320x568 | WebKit |
| iPhone 14 | 390x844 | WebKit |
| iPhone 15 Pro Max | 430x932 | WebKit |
| Pixel 7 | 412x915 | Chromium |
| Samsung Galaxy S23 | 360x780 | Chromium |
| Desktop Chrome | 1280x720 | Chromium |
| Desktop Firefox | 1280x720 | Firefox |
| Desktop Safari | 1280x720 | WebKit |

Tests cover:
- **Landing**: autocomplete, button state, viewport bounds
- **Terms**: checkbox/button interaction, navigation to camera
- **Camera**: getUserMedia mock (denied + ready states), shutter button positioning
- **Photos**: empty state, bottom nav visibility
- **Winner**: waiting state, navigation to photos
- **Gallery**: redirect when not announced
- **Full flow**: landing → identify → terms → camera → photos → winner
- **Layout**: no horizontal overflow, header visibility across all pages
- **Admin dashboard**: events nav link, photo lightbox, schedule lock modal
- **Visual regression**: per-device screenshots with 5% diff tolerance
