"use client";

import { useMemo, useState } from "react";
import {
  PLATFORMS,
  TONES,
  generateDrafts,
  getPlatform,
  splitKeyPoints,
  validateBrief,
  type Brief,
  type Draft,
  type PlatformId,
  type ToneId,
} from "@/lib/generator";

const EXAMPLE = {
  topic: "turning enquiries into bookings",
  audience: "independent car detailers",
  keyPoints:
    "Reply within an hour, keep one shared inbox, send a short quote, follow up after three days",
  cta: "Message me for the one-page enquiry checklist",
};

function DraftCard({ draft }: { draft: Draft }) {
  const [copied, setCopied] = useState(false);

  const used = draft.limit ? Math.min(draft.characters / draft.limit, 1) : 0.25;
  const near = draft.limit !== null && draft.characters > draft.limit * 0.9;

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft.text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <article className="panel p-4 sm:p-5">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <span className="chip" style={{ color: "var(--accent-2)", borderColor: "rgba(255,122,198,0.35)" }}>
          {draft.angle}
        </span>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {draft.label}
        </span>
        <button type="button" className="btn btn-ghost ml-auto" onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </header>

      <p className="draft-body">{draft.text}</p>

      {draft.hashtags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {draft.hashtags.map((tag) => (
            <li key={tag} className="chip">
              {tag}
            </li>
          ))}
        </ul>
      )}

      <footer className="mt-4">
        <div className="meter">
          <span
            style={{
              width: `${Math.max(used * 100, 4)}%`,
              backgroundImage: near
                ? "linear-gradient(90deg, var(--warn), var(--bad))"
                : undefined,
            }}
          />
        </div>
        <p className="mt-2 text-xs" style={{ color: "var(--muted)" }}>
          {draft.characters.toLocaleString()} characters
          {draft.limit ? ` of ${draft.limit.toLocaleString()}` : ""}
          {draft.trimmed ? " · trimmed to fit the platform limit" : ""}
        </p>
      </footer>
    </article>
  );
}

export default function Generator() {
  const [topic, setTopic] = useState("");
  const [audience, setAudience] = useState("");
  const [keyPoints, setKeyPoints] = useState("");
  const [cta, setCta] = useState("");
  const [platform, setPlatform] = useState<PlatformId>("instagram");
  const [tone, setTone] = useState<ToneId>("friendly");
  const [seed, setSeed] = useState(7);

  const brief: Brief = { topic, audience, keyPoints, cta, platform, tone, seed };
  const drafts = useMemo(
    () => generateDrafts({ topic, audience, keyPoints, cta, platform, tone, seed }),
    [topic, audience, keyPoints, cta, platform, tone, seed],
  );

  const problem = validateBrief(brief);
  const activePlatform = getPlatform(platform);
  const pointCount = splitKeyPoints(keyPoints).length;

  function loadExample() {
    setTopic(EXAMPLE.topic);
    setAudience(EXAMPLE.audience);
    setKeyPoints(EXAMPLE.keyPoints);
    setCta(EXAMPLE.cta);
    setPlatform("instagram");
    setTone("friendly");
  }

  function reset() {
    setTopic("");
    setAudience("");
    setKeyPoints("");
    setCta("");
    setPlatform("instagram");
    setTone("friendly");
    setSeed(7);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <section className="panel h-fit p-5">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
          The brief
        </h2>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Topic</span>
            <input
              className="field"
              value={topic}
              onChange={(event) => setTopic(event.target.value)}
              placeholder="What is this post about?"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">Audience</span>
            <input
              className="field"
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
              placeholder="Who should read it?"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">
              Key points
              <span className="ml-2 font-normal" style={{ color: "var(--muted)" }}>
                one per line, comma or bullet
              </span>
            </span>
            <textarea
              className="field"
              rows={4}
              value={keyPoints}
              onChange={(event) => setKeyPoints(event.target.value)}
              placeholder={"Reply within an hour\nKeep one shared inbox"}
            />
            <span className="mt-1 block text-xs" style={{ color: "var(--muted)" }}>
              {pointCount} point{pointCount === 1 ? "" : "s"} detected
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">
              Call to action
              <span className="ml-2 font-normal" style={{ color: "var(--muted)" }}>
                optional
              </span>
            </span>
            <input
              className="field"
              value={cta}
              onChange={(event) => setCta(event.target.value)}
              placeholder="Leave blank and we will suggest one"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Platform</span>
              <select
                className="field"
                value={platform}
                onChange={(event) => setPlatform(event.target.value as PlatformId)}
              >
                {PLATFORMS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Tone</span>
              <select
                className="field"
                value={tone}
                onChange={(event) => setTone(event.target.value as ToneId)}
              >
                {TONES.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="text-xs" style={{ color: "var(--muted)" }}>
            {activePlatform.note}
          </p>

          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              className="btn btn-primary"
              disabled={Boolean(problem)}
              onClick={() => setSeed((current) => current + 1)}
            >
              Write another set
            </button>
            <button type="button" className="btn btn-ghost" onClick={loadExample}>
              Use example
            </button>
            <button type="button" className="btn btn-ghost" onClick={reset}>
              Clear
            </button>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="panel flex flex-wrap items-center gap-3 p-4">
          <div>
            <p className="text-sm font-semibold">
              {problem ? "Waiting on your brief" : `${drafts.length} drafts ready`}
            </p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {problem
                ? "Start with a topic and the drafts appear instantly."
                : "Everything is generated in your browser, so nothing is sent anywhere."}
            </p>
          </div>
          <span className="chip ml-auto">no API key needed</span>
        </div>

        {problem ? (
          <div className="panel p-8 text-center" style={{ color: "var(--muted)" }}>
            <p className="text-base" style={{ color: "var(--text)" }}>
              Nothing to draft yet
            </p>
            <p className="mt-2 text-sm">{problem}</p>
          </div>
        ) : (
          drafts.map((draft) => <DraftCard key={draft.id} draft={draft} />)
        )}
      </section>
    </div>
  );
}
