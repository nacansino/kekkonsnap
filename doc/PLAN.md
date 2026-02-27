# Kekkonsnap — Wedding Photo Contest App

## Context

You're getting married in a few weeks and want a web app where wedding guests compete to take the best photo. Guests scan a QR code, get a limited number of camera shots, and the best photo wins — revealed live on everyone's phone at the end. No app install, no gallery uploads, just real camera snaps.

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | **Next.js 15** (App Router, standalone output for Docker) |
| Language | **TypeScript** (strict) |
| Database | **SQLite** via `better-sqlite3` + **Drizzle ORM** |
| Styling | **Tailwind CSS v4** |
| Image processing | **Sharp** (EXIF orientation, WebP compression, thumbnails) |
| Real-time | **Server-Sent Events** (SSE via Route Handlers) |
| Fuzzy matching | **Fuse.js** (guest name autocomplete) |
| Sessions | **JWT** via `jose` (HttpOnly cookies) |
| ZIP download | **archiver** |
| Deployment | **Docker** (multi-stage build) + **Caddy** (auto HTTPS) |
| Storage | Local VPS disk for photos, SQLite file for data |

## Design Direction

Inspired by [your wedding site](https://aljeriandniel.com/):
- **Colors**: dusty rose `#a46658`, cream `#fffbf6`, soft beige `#faf3e9`, dark charcoal text
- **Typography**: serif heading font (Playfair Display), clean sans-serif body (Inter)
- **Feel**: soft, romantic, elegant — generous whitespace, rounded elements
- **Mobile-first** (95%+ of guests on phones)

## Database Schema

4 tables in `src/db/schema.ts`:

- **`events`** — id, name, slug, adminPasswordHash, shotLimit (5-10), status (`active`/`locked`/`announced`), winnerPhotoId, termsText, timestamps
- **`guests`** — id, eventId, name, normalizedName (for fuzzy matching), tableNumber (optional)
- **`sessions`** — id (UUID), eventId, guestId, agreedToTerms, userAgent, timestamps
- **`photos`** — id, eventId, guestId, sessionId, storagePath, thumbnailPath, mimeType, fileSize, width, height, isWinner, timestamps

## Guest Flow (6 screens)

### 1. Landing Page — `/[slug]`
- Guest scans QR code, lands here
- "Enter Your Name" input with fuzzy autocomplete (Fuse.js matches against guest list)
- Must select an exact match from dropdown to proceed

### 2. Terms Page — `/[slug]/terms`
- Shows consent: "Others will see photos you upload. Photos cannot be deleted."
- Must tap "I Agree" to continue

### 3. Camera — `/[slug]/camera` (the main experience)
- Full-screen camera viewfinder using `getUserMedia` API
- **No `<input type="file">` anywhere** — camera only, no gallery access
- Shutter button, flip camera button
- Shot counter: "X of Y remaining"
- Thumbnail strip of captured photos at bottom
- Each photo auto-uploads immediately (JPEG blob → server compresses to WebP)
- Shutter disabled when quota reached

### 4. Your Snaps — `/[slug]/photos`
- Grid of guest's own snaps (thumbnails, tap for full-size lightbox)
- Lightbox closes when tapping outside the photo
- **Cannot delete** — no delete button exists
- During active/locked event: can ONLY see own photos
- Pinned bottom navigation: "Back to Camera" (if shots remaining) + "Go to Winner Reveal"

### 5. Winner Reveal — `/[slug]/winner`
- While event is active/locked: elegant "waiting" screen with "Your Snaps" link
- SSE pushes winner announcement → confetti animation + winning photo + winner's name
- "View All Snaps" button appears → links to full gallery
- "Your Snaps" link to own photos on both waiting and announced states
- Camera is stopped when all shots are used (stream released)

### 6. Snap Gallery — `/[slug]/gallery` (post-announcement only)
- All snaps from all guests, winner pinned at top
- Only accessible after admin announces winner

## Admin Flow

### Admin Login — `/admin/[slug]`
- Simple password input (bcrypt-hashed, rate-limited to 5 attempts/min)

### Admin Dashboard — `/admin/[slug]/dashboard`
- **During event**: live photo feed from all guests, stats (total photos, participating guests)
- **Lock Event** button → stops all new uploads, guests see waiting screen
- **Pick Winner** → select any photo as winner
- **Announce Winner** → triggers SSE push to ALL connected guests simultaneously
- Download individual photos or batch ZIP download (organized by guest name)
- Guest management: view list, import from CSV

## API Routes

**Guest routes** (`/api/events/[slug]/...`):
- `GET /` — event public info
- `POST /identify` — fuzzy match name, create session
- `POST /agree` — record terms consent
- `POST /photos` — upload photo (session cookie required, quota enforced server-side)
- `GET /photos/mine` — own photos
- `GET /photos/all` — all photos (only when status = `announced`)
- `GET /status` — **SSE stream** for real-time event state + winner push

**Admin routes** (`/api/admin/[slug]/...`):
- `POST /login` — authenticate, set admin cookie
- `GET /photos` — all photos with guest names
- `POST /lock` — lock event
- `POST /pick-winner` — set winner photo
- `POST /announce` — announce winner (triggers SSE to all clients)
- `GET /download/[photoId]` — single photo download
- `GET /download-all` — ZIP of all photos
- `GET|POST /guests` — guest list management

## Real-Time Architecture

- **Server**: Node.js `EventEmitter` singleton (single process, no Redis needed)
- **Transport**: SSE via Next.js Route Handler returning `ReadableStream`
- **Flow**: Admin action → DB update → EventEmitter fires → all SSE connections push to clients
- **Client**: `EventStreamProvider` React context wraps guest pages, auto-reconnects with exponential backoff
- **Heartbeat**: server sends keepalive every 30s

## Camera Implementation (critical detail)

Uses `navigator.mediaDevices.getUserMedia()` exclusively:
- Live video feed rendered in `<video>` element with `playsinline` (critical for iOS)
- Shutter captures via `<canvas>.drawImage(video)` → `canvas.toBlob("image/jpeg", 0.85)`
- No `<input type="file">` exists anywhere — **no way to open gallery**
- Flip camera toggles `facingMode` between `environment` and `user`
- Falls back gracefully if rear camera unavailable

## Image Processing Pipeline

On upload (`src/lib/image-processing.ts`):
1. Validate it's a real image via Sharp metadata
2. Auto-orient from EXIF (`.rotate()` with no args)
3. Resize to max 2048px, compress to WebP at 100% quality → preserves full detail
4. Generate 300x300 square thumbnail at WebP 85% → ~20-40KB
5. Write both to disk, store paths in DB

**Estimated storage**: 100 guests x 7 shots = 700 photos x ~425KB avg = ~300MB total

## Security

- **Sessions**: JWT in HttpOnly/Secure/SameSite=Strict cookies (24hr expiry)
- **Admin**: separate cookie, bcrypt password, 4hr expiry; master password via `ADMIN_MASTER_PASSWORD` env var for event management API
- **Quota**: enforced server-side (COUNT query), client display is cosmetic only
- **Rate limiting**: in-memory sliding window (uploads: 1/2s, login: 5/min, identify: 10/min)
- **Photo access**: during event, guests can only fetch their own photos (guestId check); post-announcement, all photos accessible
- **HTTPS required**: Caddy auto-provisions TLS (also required for `getUserMedia`)
- **No directory listing**: photos served through authenticated API routes, not static files
- **File naming**: UUIDs prevent URL enumeration

## File Structure

```
src/
  app/
    (guest)/[slug]/           # Guest pages: page, terms/, camera/, photos/, winner/, gallery/
    admin/[slug]/             # Admin pages: page (login), dashboard/, guests/
    api/events/[slug]/        # Guest API routes
    api/admin/[slug]/         # Admin API routes
    api/photos/[id]/          # Photo serving (full/ and thumb/)
  components/
    ui/                       # Button, Input, Card, Modal, LoadingSpinner, ProgressBar
    camera/                   # CameraViewfinder, ShutterButton, ShotCounter, CapturedPhotoStrip
    guest/                    # NameAutocomplete, TermsConsent, PhotoGrid, PhotoLightbox
    winner/                   # WinnerReveal, WaitingScreen, ConfettiEffect
    gallery/                  # MasonryGallery, PhotoCard
    admin/                    # PhotoFeed, EventControls, GuestList, StatsPanel
    providers/                # SessionProvider, EventStreamProvider
  db/
    index.ts, schema.ts, seed.ts
  lib/
    auth.ts, admin-auth.ts, event-emitter.ts, image-processing.ts,
    fuzzy-match.ts, storage.ts, rate-limit.ts, constants.ts
  hooks/
    useCamera.ts, usePhotoUpload.ts, useSession.ts, useEventStream.ts
  middleware.ts               # Route protection
scripts/
  seed.ts, create-event.ts   # CLI scripts for setup
data/                         # Docker volume: SQLite DB + uploads/
Dockerfile, docker-compose.yml, Caddyfile
```

## Build Order

### Phase 1: Foundation
1. Init Next.js + TypeScript + Tailwind + ESLint
2. Drizzle schema + migrations + DB connection
3. JWT session management (`src/lib/auth.ts`)
4. Seed script for event + guest list
5. Design system: Tailwind config with wedding palette, font setup, base UI components

### Phase 2: Guest Flow
6. Landing page with fuzzy name autocomplete
7. Terms/consent page
8. Camera viewfinder with `getUserMedia`
9. Photo capture + upload API + Sharp processing
10. Shot counter + server-side quota enforcement

### Phase 3: Guest Gallery
11. "My Photos" page with photo grid
12. Photo serving routes with access control
13. Session persistence + middleware route guards

### Phase 4: Real-Time + Winner
14. SSE endpoint + EventEmitter
15. EventStreamProvider on client
16. Winner reveal page with confetti animation
17. Post-announcement all-photos gallery

### Phase 5: Admin
18. Admin login + auth
19. Dashboard: photo feed, stats, event controls
20. Lock → Pick Winner → Announce flow
21. Individual + batch ZIP download
22. Guest list management / CSV import

### Phase 6: Deploy + Polish
23. Dockerfile (multi-stage) + docker-compose + Caddyfile
24. Error states, loading states, edge case handling
25. Mobile device testing
26. Generate QR code for the event URL

## Verification

1. **Local dev**: `npm run dev`, open on phone (same network), test full guest flow
2. **Camera**: verify `getUserMedia` works on iOS Safari + Chrome Android, confirm no gallery access
3. **Quota**: upload X photos, confirm X+1 is rejected server-side
4. **Session persistence**: close browser tab, reopen → should restore to camera/photos view
5. **SSE**: open multiple browser tabs as different guests, admin announces winner → all tabs show reveal simultaneously
6. **Admin flow**: login → view photos → lock → pick winner → announce → verify guests see it
7. **Download**: test individual photo download + full ZIP download
8. **Docker**: `docker compose up --build`, verify Caddy serves HTTPS, test full flow
