# DetailFlow

Turn enquiries into bookings. DetailFlow helps Irish appointment-based service businesses (starting with car detailing) organise customer enquiries, manage appointments, and configure follow-up automations.

Phase 1 MVP: booking-request pages, enquiry inbox, appointments/calendar, customers, services, analytics estimates, demo workspace, platform admin.

## Stack

- Next.js 15 (App Router) + React 19
- Auth.js (NextAuth v5) credentials
- Prisma + PostgreSQL (Neon recommended)
- Tailwind CSS 4
- Vitest for unit tests
- Optional: Resend (email), Stripe test mode (billing)

## Local setup

1. Copy env and fill values:

```bash
cp .env.example .env
```

Required:

- `DATABASE_URL` — Postgres connection string
- `AUTH_SECRET` — `openssl rand -base64 32`
- `AUTH_URL` / `NEXTAUTH_URL` / `NEXT_PUBLIC_APP_URL` — e.g. `http://localhost:3000`
- `DEMO_BUSINESS_SLUG` — default `cleancar-demo`

2. Install and migrate:

```bash
npm install
npx prisma migrate deploy
npm run db:seed
```

3. Run:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Seed accounts (fictional demo)

| Email | Password | Role |
|-------|----------|------|
| `demo@cleancar.ie` | `password123` | Demo business owner |
| `admin@detailflow.ie` | `password123` | Platform admin |

Demo customers and enquiries are fictional.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Local Next.js |
| `npm run build` | `prisma generate` + production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest |
| `npm run db:migrate` | Dev migrations |
| `npm run db:seed` | Seed admin + demo business |

## Deploy on Vercel + Neon

1. Create a Neon project; copy the pooled connection string into `DATABASE_URL`.
2. Import the GitHub repo into Vercel.
3. Set environment variables from `.env.example` (production URLs, `AUTH_SECRET`, Neon URL, optional Resend/Stripe).
4. Build command: `npm run build` (already runs `prisma generate`).
5. After first deploy, run migrations against Neon:

```bash
DATABASE_URL="…" npx prisma migrate deploy
DATABASE_URL="…" npm run db:seed
```

Or add a Vercel build/release step that runs `prisma migrate deploy`.

6. Point `AUTH_URL`, `NEXTAUTH_URL`, and `NEXT_PUBLIC_APP_URL` at your Vercel domain.

Without `STRIPE_SECRET_KEY`, billing UI shows plan status only (no charges). Without `RESEND_API_KEY`, emails are preview-logged.

## Tenant & demo isolation

- Dashboard queries always scope by `businessId` from membership (`assertBusinessAccess` / `getUserPrimaryBusiness`).
- `resetDemoBusiness` only deletes/recreates businesses with `isDemo: true` for the demo slug.
- Public booking pages are keyed by slug; requests never auto-confirm appointments.

## Legal

Privacy and Terms pages are templates flagged for legal review — not production legal documents.
