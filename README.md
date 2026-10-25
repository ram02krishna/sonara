# Sonara: music for every taste

Sonara is its own music platform, inspired by Spotify and Apple Music. It has its **own accounts**
(email or guest), its **own library, playlists and listening history**, and uses Spotify only as a
**read-only catalogue** (search, artists, albums, new releases) through your app's client ID and secret.
Nobody connects a Spotify account.

## Features

**Discover**
- Home dashboard built per listener from *their* Sonara history plus the languages, genres and artists they chose, so a Punjabi listener and a K-pop listener see different homes. New accounts pick their taste first.
- Explore: browse by language (Hindi, Punjabi, Tamil, Telugu, K-Pop, Latin, ...), genre and mood.
- Search with top result, songs/artists/albums filters, pagination and recent searches. One search everywhere (header, palette, `/search`).
- Artist pages (popular songs, albums, follow) and album pages (save to library).

**Your library**
- Create, rename, reorder (drag and drop) and delete playlists; "add to playlist" from any song; add songs from inside a playlist.
- Liked Songs, followed artists, saved albums, recently played.
- Right-click / ⋯ menu on every song: play next, add to queue, like, add to playlist, song radio, go to artist or album.

**Playback**
- Queue with drag-to-reorder and remove, shuffle, repeat (off / all / one), autoplay of similar music, sleep timer, media keys / lock-screen controls.
- Synced lyrics (LRCLIB), full-screen player with album-colour theming.
- Keyboard shortcuts (press `?`), command palette (`Ctrl/⌘ + K`).
- Audio is a real **30-second preview**, or optionally the **full song in YouTube's official visible player** (needs a `YOUTUBE_API_KEY`, enable in Settings). Sonara never scrapes or hides a player.

**Insights and settings**
- Real listening stats (time, streak, unique songs and artists, top songs and artists, genres), no placeholder numbers.
- Settings: account (name, guest to real account, password), appearance (system/dark/light, 5 accent colours, compact lists, reduce motion), playback, region, download your data, clear history, delete account.

## Architecture

```
Browser ── same-origin /api/v1 ──► Next.js (App Router, TypeScript) ──proxy──► Go API (chi)
                                                                              ├─ PostgreSQL (users, sessions, playlists, library, history)
                                                                              ├─ Redis (optional cache; in-memory fallback)
                                                                              ├─ Spotify catalogue (client-credentials token, cached)
                                                                              ├─ iTunes (30s previews), LRCLIB (lyrics)
                                                                              └─ YouTube Data API (optional, full songs)
```

Spotify Development Mode limits (verified against Spotify's Feb 2026 migration guide) shape the catalogue code: search returns at most 10 results (Sonara paginates with `offset`), `/browse/new-releases` and `/artists/{id}/top-tracks` are gone (replaced by `tag:new` and search), and `popularity`/`followers` are no longer returned. Failures are typed and shown honestly; the dashboard drops a section that Spotify refuses instead of breaking the page.

## Getting Started

### 1. Environment Configuration

Copy the template environment file and add your credentials:

- **Linux / macOS / Git Bash:**
  ```bash
  cp .env.example .env
  ```
- **Windows (PowerShell):**
  ```powershell
  Copy-Item .env.example .env
  ```

*(Optional)* Open `.env` and fill in `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` (from the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)) for catalogue metadata. If left blank, the API falls back to iTunes catalogue search.

---

### Running With Docker

Run the entire Sonara stack (Next.js web frontend, Go backend API, PostgreSQL, and Redis) containerized via Docker Compose.

#### 1. Start all services
```bash
docker compose -f infra/docker-compose.yml up --build -d
```
*Or using Make:*
```bash
make docker-up
```

#### 2. View logs
```bash
docker compose -f infra/docker-compose.yml logs -f
```
*Or using Make:*
```bash
make docker-logs
```

#### 3. Stop all services
```bash
docker compose -f infra/docker-compose.yml down
```
*Or using Make:*
```bash
make docker-down
```

Once started, open **http://127.0.0.1:3000** in your browser and continue as guest or create an account.

---

### Running Without Docker

To run the application natively on your host machine without Docker:

#### Prerequisites
- **Node.js**: v18+ and `npm`
- **Go**: v1.22+
- *(Optional)* **PostgreSQL** (v15+) & **Redis** (v7+) running locally on default ports (`5432` and `6379`).
  > **Note:** If PostgreSQL and Redis are not running, the Go backend will automatically fall back to an in-memory store for development.

#### Step 1: Install frontend dependencies
From the repository root:
```bash
npm install
```

#### Step 2: Start the Go API server
In terminal 1:
```bash
npm run dev:api
```
*Alternative commands:*
```bash
cd apps/api && go run ./cmd/server
# or if you have make:
make dev-api
```
The API server will listen on `http://127.0.0.1:8080`. Database tables are automatically ensured on startup.

#### Step 3: Start the Next.js frontend
In terminal 2:
```bash
npm run dev
```
*Alternative commands:*
```bash
npm run dev --workspace=apps/web
# or if you have make:
make dev-web
```
The frontend dev server will start at **http://127.0.0.1:3000** and automatically proxies `/api/v1` calls to the Go backend on port 8080.

---

### Hybrid Development Mode (Recommended for Local Dev)

If you have Docker installed and want code hot-reloading without installing Postgres and Redis directly on your operating system:

```bash
# 1. Start Postgres and Redis in Docker
docker compose -f infra/docker-compose.yml up -d postgres redis
# or: make dev

# 2. Run backend API in terminal 1
npm run dev:api

# 3. Run frontend web in terminal 2
npm run dev
```

---

### Deploying to production (Vercel + AWS EC2)

Production runs as two halves: the **Next.js web app on Vercel** and the **Go API, PostgreSQL and Redis on an AWS EC2 server**
behind **nginx** (HTTPS via Let's Encrypt), all as Docker containers. Every push to `main` triggers GitHub Actions, which tests
the code, builds the API Docker image, pushes it to Docker Hub, and automatically pulls and updates the EC2 server (no AWS ECR required).
Vercel redeploys the web app on the same push.

**Full step-by-step guide: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**

Quick reference for the Vercel side (set the project's **Root Directory to `apps/web`**):
- `API_INTERNAL_URL` = your public API URL, e.g. `https://api.yourdomain.com`. The Next.js app proxies `/api/v1` to it, so the HTTP-only
  session cookie stays first-party. It is read at build time; the build fails with a clear message if it is missing.
- On the API server set `COOKIE_SECURE=true` and `ALLOWED_ORIGINS=https://your-app.vercel.app` (the production compose file already does the former).

## Verification & Tests

```bash
cd apps/api && go test ./...                 # Go API tests
cd apps/web && npm run build                 # Next.js web lint + type-check + build
```

## Project structure

```
apps/web/src/app          pages: home, explore, search, library, playlist, album, artist, stats, settings, login, onboarding
apps/web/src/components   layout (Sidebar, Header, RightPanel), player (PlaybackEngine, Player, VideoDock), ui (cards, menus, dialogs)
apps/web/src/hooks        data hooks (TanStack Query), play helpers
apps/web/src/store        Zustand: player, app settings, UI (menus/dialogs)
apps/api/internal         handler, repository, provider (Spotify, iTunes, LRCLIB, YouTube), dashboard, service
packages/db               Prisma ORM schema and client for PostgreSQL
packages/api-spec         OpenAPI specification and generated types
infra/                    docker-compose (local), Dockerfiles, postgres/init.sql
infra/aws/                production stack: compose, nginx, deploy + TLS scripts, .env.example
.github/workflows/        ci.yml (checks) and deploy.yml (build -> Docker Hub -> EC2)
docs/DEPLOYMENT.md        Vercel + AWS deployment guide
```

## Notes on music rights

Spotify's catalogue metadata and iTunes previews are used under their public API terms; Sonara does not stream Spotify audio. Full-length playback is only offered through YouTube's own embedded player. If you launch publicly, review the Spotify Developer Policy and YouTube API Terms (attribution, quotas, and Spotify's extended-quota review).
