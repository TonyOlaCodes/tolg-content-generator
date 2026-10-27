# TOLG Content Generator

Describe what you want to say, pick a platform, and get three ready-to-post drafts with a
hook, a body, a call to action and hashtag suggestions.

It runs entirely in the browser from templates: **no API key, no database, no env vars,
no backend**. That is deliberate — it deploys to Vercel with zero configuration.

## Stack

- Next.js 15 (App Router) + React 19
- TypeScript (strict)
- Tailwind CSS 4
- ESLint 9 (flat config)

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script              | Purpose                          |
| ------------------- | -------------------------------- |
| `npm run dev`       | Local Next.js dev server         |
| `npm run build`     | Production build                 |
| `npm start`         | Serve the production build       |
| `npm run typecheck` | `tsc --noEmit`                   |
| `npm run lint`      | ESLint                           |

## Deploy on Vercel

1. Push this repository to GitHub.
2. In Vercel, **Add New → Project** and import the repository.
3. Framework preset: **Next.js** (auto-detected). Leave build and output settings alone —
   the defaults run `npm run build` and serve `.next`.
4. **Environment variables: none.** Don't add any; the app reads nothing from `process.env`.
5. Deploy.

Nothing else is required: no `vercel.json`, no database, no secrets, no build step beyond
the Next.js default.

## How it works

- `lib/generator.ts` — pure, dependency-free draft logic. Holds the platform list with
  character limits, the tone word-banks, hashtag derivation and a seeded PRNG
  (`mulberry32`) so the same brief always produces the same drafts.
- `components/Generator.tsx` — the client-side form, live preview, copy buttons and
  character meters.
- `app/page.tsx` — page shell and copy.

Platform limits (Instagram 2,200 · LinkedIn 3,000 · X 280) are enforced by trimming at a
word boundary, and each draft is labelled when that happens.

## Notes

Drafts come from hand-written tone and platform templates, not a language model. They are
meant as a fast, credible first pass — review facts and specifics before publishing.
