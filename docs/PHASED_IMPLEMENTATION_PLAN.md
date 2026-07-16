# TOLG Content Generator — Phased Implementation Plan

## Architecture overview

```
┌─────────────────────────────────────────────────────────────┐
│  Vercel (Next.js App Router)                                │
│  ├── UI pages (Dashboard, Media, Builder, Drafts, …)        │
│  ├── Auth.js (credentials / single-user)                    │
│  ├── Server Actions + Route Handlers (Zod-validated)        │
│  ├── Prisma → Neon PostgreSQL                               │
│  └── Cloudinary (images; originals preserved)               │
└───────────────────────────┬─────────────────────────────────┘
                            │ enqueue RenderJob
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Isolated Video Worker (Railway / Render / Fly / local)     │
│  ├── Polls or receives jobs                                 │
│  ├── FFmpeg reel render                                     │
│  └── Writes output URL + job status                         │
└─────────────────────────────────────────────────────────────┘
```

### Folder structure

```
src/
  app/
    (auth)/login/
    (app)/          # protected application shell
      dashboard/
      media/
      upload/
      auto-generate/
      manual-builder/
      drafts/
      drafts/[id]/
      settings/
      connections/
      render-jobs/
    api/
      auth/[...nextauth]/
      upload/
      media/
      render/
  components/
    ui/             # shadcn-style primitives
    layout/
    media/
    drafts/
  lib/
    auth.ts
    db.ts
    cloudinary.ts
    utils.ts
    validations/
    constants/
  server/
    actions/
    services/
      media/
      tagging/
      generation/   # Phase 2+
      export/       # Phase 3+
      render/       # Phase 4+
  workers/
    render/         # local FFmpeg worker entry
prisma/
  schema.prisma
  seed.ts
  migrations/
tests/
docs/
```

---

## Phase 1 — Foundation (current)

- [x] Project setup (Next.js, TS, Tailwind, shadcn-style UI)
- [x] Auth.js single-user authentication + protected routes
- [x] Full Prisma schema + seed (tags, hooks, settings)
- [x] Cloudinary media upload (theme / physique / music)
- [x] Media Library (tabs, search, filter, sort, pagination, bulk ops)
- [x] Manual tagging flows
- [x] Settings persistence
- [x] Connections UI (config-required states)
- [x] Page shells for later phases (no dead buttons)

## Phase 2 — Generation engine

- AI tag suggestions + theme descriptions (OpenAI + fallbacks)
- Fallback hook database selection
- Auto-generate N drafts
- Weighted photo matching score
- Draft creation with selection rules

## Phase 3 — Builder & TikTok export

- Manual Builder (slots, filters, reorder)
- Draft preview + text styling / drag position
- TikTok carousel export (1080×1920, black letterbox)
- Per-draft export folders + caption.txt

## Phase 4 — Instagram Reels

- Timeline builder (reading duration, cut/fade ratio)
- Music selection (≥ reel duration)
- RenderJob DB tracking
- Local FFmpeg worker + remote worker abstraction

## Phase 5 — TikTok publishing

- Connections: Connect / Disconnect / Send to TikTok
- Encrypted token storage boundary
- Disabled state when credentials missing (no fake publish)

## Phase 6 — Hardening

- Full test suite coverage for acceptance criteria
- Error handling polish
- Responsive pass
- Production deployment docs (Vercel + worker)

---

## Acceptance criteria mapping

| # | Criterion                         | Phase |
|---|-----------------------------------|-------|
| 1–4 | Upload/tag theme, physique, music | 1–2 |
| 5–8 | Auto-generate + sequences         | 2 |
| 9–12 | Manual edit + TikTok export       | 3 |
| 13–16 | Instagram Reel + timing/music     | 4 |
| 17–19 | Export folders + approve all      | 3–4 |
| 20–22 | AI-optional, no placeholders, DX  | 1–6 |
