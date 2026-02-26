# Kekkonsnap

Wedding photo contest web app. Guests scan a QR code, take limited camera-only shots, and compete for best photo. The winner is revealed live on everyone's phone.

## How it works

1. **Guests scan QR** at the wedding and land on the app
2. **Enter name** (fuzzy-matched against the guest list)
3. **Agree to terms** (photos are public, can't be deleted)
4. **Take photos** using the phone camera (no gallery uploads — camera only)
5. **Limited shots** (configurable, e.g. 7 per guest)
6. **Admin picks a winner** after locking the event
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
| `npm test` | Run tests (vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:create-event` | Create a new event via CLI |
| `npm run db:seed` | Seed guest list from file |

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
2. **During the event:** watch photos come in from the live feed
3. **Lock the event** when it's time — this stops all new uploads
4. **Pick a winner** by clicking on a photo
5. **Announce** — the winner appears on everyone's phone instantly
6. **Download all photos** as a ZIP organized by guest name

## Environment variables

| Variable | Description | Default |
|---|---|---|
| `JWT_SECRET` | Secret for signing JWTs (min 32 chars) | Dev default provided |
| `DATABASE_URL` | Path to SQLite database | `./data/kekkonsnap.db` |
| `UPLOAD_DIR` | Path to photo storage directory | `./data/uploads` |

## Tests

```bash
npm test
```

153 tests across 9 test files covering the database schema, auth/JWT, rate limiting, image processing, storage, guest API routes, and admin API routes.
