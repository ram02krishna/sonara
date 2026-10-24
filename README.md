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

## Run it

```bash
cp .env.example .env        # add SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET
make docker-up              # web, api, postgres, redis
```
Open **http://127.0.0.1:3000** and continue as guest or create an account.

Local development:
```bash
npm install
docker compose -f infra/docker-compose.yml up -d postgres redis
make dev-api                # Go API on :8080
make dev-web                # Next.js on :3000 (proxies /api/v1 to :8080)
```
PostgreSQL is required for accounts, playlists, library and history (tables are created automatically on start).

## Tests

```bash
cd apps/api && go test ./...                 # provider, dashboard, auth/security, repository unit tests
API_BASE=http://127.0.0.1:8080/api/v1 python3 scripts/e2e_api.py   # 47-step scenario against a running API + PostgreSQL
cd apps/web && npm run build                 # lint + type-check + compile
```

## Project structure

```
apps/web/src/app          pages: home, explore, search, library, playlist, album, artist, stats, settings, login, onboarding
apps/web/src/components   layout (Sidebar, Header, RightPanel), player (PlaybackEngine, Player, VideoDock), ui (cards, menus, dialogs)
apps/web/src/hooks        data hooks (TanStack Query), play helpers
apps/web/src/store        Zustand: player, app settings, UI (menus/dialogs)
apps/api/internal         handler, repository, provider (Spotify, iTunes, LRCLIB, YouTube), dashboard, service
infra/                    docker-compose, Dockerfiles, postgres/init.sql
scripts/e2e_api.py        end-to-end API scenario
```

## Notes on music rights

Spotify's catalogue metadata and iTunes previews are used under their public API terms; Sonara does not stream Spotify audio. Full-length playback is only offered through YouTube's own embedded player. If you launch publicly, review the Spotify Developer Policy and YouTube API Terms (attribution, quotas, and Spotify's extended-quota review).
