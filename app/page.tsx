import Generator from "@/components/Generator";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8">
        <p className="chip inline-block">TOLG Content Generator</p>
        <h1 className="mt-4 text-3xl font-semibold leading-tight sm:text-[2.6rem]">
          A rough idea in,
          <br />
          <span
            style={{
              backgroundImage: "linear-gradient(100deg, var(--accent), var(--accent-2))",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            three publishable drafts out.
          </span>
        </h1>
        <p className="mt-4 max-w-2xl text-base" style={{ color: "var(--muted)" }}>
          Describe what you want to say and pick a platform. You get a hook, a body and a
          call to action sized for Instagram, LinkedIn, X, email or a blog intro — plus
          hashtag suggestions. Deterministic, offline and free: there is no API key, no
          account and no database behind it.
        </p>
      </header>

      <Generator />

      <footer className="mt-12 border-t pt-6 text-xs" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
        <p>
          Drafts are assembled from tone and platform templates, so treat them as a strong
          first pass rather than final copy. Check facts before publishing.
        </p>
      </footer>
    </main>
  );
}
