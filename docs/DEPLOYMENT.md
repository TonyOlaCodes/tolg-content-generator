# Deployment guide

## Vercel (app)

1. Import the Git repository into Vercel.
2. Framework preset: Next.js.
3. Set environment variables from `.env.example`.
4. Use Neon’s **pooled** connection string for `DATABASE_URL` in the app.
5. Prefer Neon’s **direct** connection for `prisma migrate deploy` (CI job or local against prod).
6. Build command: `npm run build` (runs `prisma generate`).
7. After first deploy, run migrations + seed once:

```bash
DATABASE_URL="..." npm run db:migrate:deploy
DATABASE_URL="..." npm run db:seed
```

Do **not** run FFmpeg reel rendering inside Vercel serverless functions.

## Neon

1. Create a project at [neon.tech](https://neon.tech).
2. Copy the connection string into `DATABASE_URL`.
3. Ensure SSL (`sslmode=require`).

## Cloudinary

1. Create a cloud at [cloudinary.com](https://cloudinary.com).
2. Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
3. Uploads keep originals; thumbnails use on-the-fly transformation URLs only.

## OpenAI (optional)

1. Create an API key.
2. Set `OPENAI_API_KEY` and optionally `OPENAI_MODEL`.
3. Or save the key encrypted via **Connections** in the app.
4. With AI disabled, fallback hooks still power generation (Phase 2).

## Video worker (Phase 4)

Deploy `src/workers/render` to Railway, Render, or Fly.io with FFmpeg installed.

Suggested env on the worker:

- `DATABASE_URL`
- `RENDER_WORKER_SECRET`
- `CLOUDINARY_*` (to fetch sources / upload outputs)

App env:

- `RENDER_WORKER_URL`
- `RENDER_WORKER_SECRET`

## TikTok API (Phase 5)

1. Create a TikTok developer application.
2. Enable Content Posting API scopes.
3. Set `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI`.
4. Until configured, Connect / Send remain disabled with an explicit reason.
5. Access tokens are stored encrypted (`ENCRYPTION_SECRET`); never returned to the client.
