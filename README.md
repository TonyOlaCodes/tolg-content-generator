# Freestyle Lab

Mobile-first training app for elite **off-the-top freestyle** skills: rapid association, rhyme chains, reference-heavy punchlines, topic transitions, flow, recovery, and endurance.

Not a rhyme dictionary. Not related to any prior TOLG project.

## Stack

- Next.js App Router + TypeScript + Tailwind CSS 4
- Zustand + localStorage / IndexedDB (progress + recordings)
- Mock transcription + mock AI providers (swap-in OpenAI server-side)
- Royalty-free generated placeholder beats in `public/beats`

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Optional:

```bash
OPENAI_API_KEY=...   # enables server-side coach/analysis enrichment
```

Without an API key, structured mock analysis still powers results.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript |
| `npm test` | Vitest |

## Architecture

```
src/
  app/                 # routes (Home, Learn, Practice, Freestyle, Progress, Library, Coach, Settings)
  components/          # UI + feature screens
  lib/
    ai/                # AIProvider interface, mock + OpenAI
    audio/             # mic recorder, waveform helpers
    data/              # seed lessons, references, words, beats, exercises
    storage/           # localStorage + IndexedDB
    transcription/     # TranscriptionProvider + mock
    training/          # prompts, daily plans
    store/             # Zustand app state
```

### Providers

- `AIProvider`: `analyzeFreestyle`, `generateExercise`, `generateAssociations`, `evaluateWordplay`, `coach`, `improveSection`
- `TranscriptionProvider`: `transcribe(blob)`

Secret keys stay server-side via `/api/ai/*` routes with Zod validation and simple rate limiting.

### Recording model

Microphone audio is recorded separately from beat playback (beat is not baked into the take). Sessions store audio blob, metadata, prompts, transcript segments, and analysis JSON in IndexedDB / localStorage.

## Product map

- **Home** — level, XP, streak, today’s session, quick freestyle, daily challenge, skills
- **Learn** — 10 modules with interactive steps
- **Practice** — 20+ drills (Association Lab, Reference Lab, Connection Game, …)
- **Freestyle** — beat library/upload, live prompts, distraction-free / blind modes, results
- **Progress** — charts, limiter recommendations, personal dictionary & association map
- **Library / Coach / Settings** — knowledge base, chat coach, preferences

## License

Private
