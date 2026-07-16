# TOLG Content Generator

Full-stack gym progression content studio. Generates TikTok carousels, Instagram Reels, captions, and fixed hashtags (`#Gym #Fyp #TOLG`) from theme images, physique photos, and music.

**Current status:** Phase 1 complete (auth, schema, media upload/library, tagging, settings). See [docs/PHASED_IMPLEMENTATION_PLAN.md](docs/PHASED_IMPLEMENTATION_PLAN.md).

## Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js App Router, TypeScript, Tailwind CSS, shadcn-style UI |
| Backend | Server Actions, Route Handlers, Zod |
| Database | Neon PostgreSQL + Prisma 7 |
| Auth | Auth.js (Credentials, single-user JWT) |
| Media | Cloudinary (originals preserved; transforms for thumbnails only) |
| AI | OpenAI (optional) + built-in fallback hook DB |
| Video | Isolated FFmpeg worker (local / Railway / Render / Fly) |

## Quick start

### 1. Prerequisites

- Node.js 20.19+
- Neon (or any PostgreSQL) database
- Cloudinary account (for uploads)

### 2. Install

```bash
npm install
cp .env.example .env
```

Fill in `DATABASE_URL`, `AUTH_SECRET`, and Cloudinary keys.

Generate secrets:

```bash
openssl rand -base64 32
```

### 3. Database

```bash
npm run db:migrate
npm run db:seed
```

Default seed user (override with `SEED_USER_*`):

- Email: `admin@tolg.local`
- Password: `tolg-admin-change-me`

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next.js development server |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm test` | Vitest |
| `npm run db:migrate` | Apply migrations (dev) |
| `npm run db:migrate:deploy` | Apply migrations (prod) |
| `npm run db:seed` | Seed tags, hooks, settings, user |
| `npm run worker:render` | Local render worker entry (Phase 4) |

## Environment variables

See [`.env.example`](.env.example).

| Variable | Required for Phase 1 | Notes |
|----------|----------------------|-------|
| `DATABASE_URL` | Yes | Neon PostgreSQL |
| `AUTH_SECRET` | Yes | Auth.js session signing |
| `ENCRYPTION_SECRET` | Recommended | Encrypts connection secrets |
| `CLOUDINARY_*` | Yes (uploads) | Image/music storage |
| `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` | Seed only | Single-user login |
| `OPENAI_API_KEY` | No | Phase 2 AI suggestions |
| `TIKTOK_CLIENT_*` | No | Phase 5 publishing |
| `RENDER_WORKER_*` | No | Phase 4 reels |

## Phase 1 manual test checklist

1. Seed DB and sign in at `/login`
2. Open **Dashboard** — stats show zeros (or counts after uploads)
3. Go to **Upload** — upload a theme image, physique photo (with year + tags), and an MP3
4. Open **Media Library** — search, filter by tag, sort, paginate
5. Multi-select items → bulk tag / bulk delete
6. Edit a physique photo — accept/remove tags, set year
7. Edit a theme image — description + mood tags
8. **Settings** — change default draft count, save, reload
9. **Connections** — Cloudinary shows env status; OpenAI key can be saved encrypted; TikTok/Send disabled without credentials
10. Auto Generate / Manual Builder / Render Jobs show clear Phase 2–4 states (no silent dead buttons)

## Deployment

### Vercel (frontend + API)

1. Connect the repo to Vercel
2. Set env vars from `.env.example` (use Neon pooled `DATABASE_URL`)
3. Build command: `npm run build`
4. Run `npm run db:migrate:deploy` against production (CI or one-off)
5. Seed production once

Video rendering must **not** run on Vercel serverless — use the worker.

### Video worker (Phase 4)

Deploy `src/workers/render` to Railway / Render / Fly.io with FFmpeg installed. Point `RENDER_WORKER_URL` + shared secret at that service.

### Cloudinary

1. Create a cloud
2. Copy cloud name, API key, API secret
3. Uploads store originals without destructive cropping; thumbnails use transformation URLs only

### OpenAI (Phase 2)

Optional. With AI disabled, fallback hook templates in `src/lib/constants/hooks.ts` power generation.

### TikTok (Phase 5)

Register a TikTok developer app with Content Posting API. Without `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET`, Connect/Send remain disabled with an explanation. Tokens are stored encrypted only.

## Architecture notes

- All app pages are auth-protected via middleware
- Zod validates uploads and mutations
- Duplicate uploads blocked by content hash
- Export folder layout (Phase 3+):

```
exports/
  post_001/
    tiktok/
    instagram/
```

## License

Private — TOLG
