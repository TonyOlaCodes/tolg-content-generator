"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { museumAudio } from "@/lib/museum/audio";
import { createRng } from "@/lib/museum/seeds";
import { LIBRARY_BOOKS } from "@/lib/museum/narrative";

type Props = {
  onBack: () => void;
  onCollect: () => void;
  seed: string;
  reducedMotion?: boolean;
  onClue: (clue: string) => void;
};

export default function Library({ onBack, onCollect, seed, reducedMotion, onClue }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [openedOrigin, setOpenedOrigin] = useState<Set<string>>(() => new Set());
  const [toast, setToast] = useState<string | null>(null);
  const collectedRef = useRef(false);

  const shelves = useMemo(() => {
    const rng = createRng(`library:${seed}`);
    return LIBRARY_BOOKS.map((b, i) => ({
      ...b,
      hue: 20 + Math.floor(rng() * 40) + (i % 3) * 15,
      tall: 0.78 + rng() * 0.28,
      lean: (rng() - 0.5) * 4,
    }));
  }, [seed]);

  const openBook = useCallback(
    (id: string) => {
      const book = LIBRARY_BOOKS.find((b) => b.id === id);
      if (!book) return;
      setOpenId(id);
      museumAudio.tone({ freq: 310 + id.charCodeAt(1) * 3, duration: 0.28, type: "triangle", gain: 0.05 });

      if (book.originClue) {
        onClue(book.originClue);
        setOpenedOrigin((prev) => {
          if (prev.has(book.id)) return prev;
          const next = new Set(prev);
          next.add(book.id);
          const count = next.size;
          setToast(`Origin fragment ${count}/3 recovered`);
          window.setTimeout(() => setToast(null), 2000);
          if (count >= 3 && !collectedRef.current) {
            collectedRef.current = true;
            museumAudio.chime();
            onCollect();
            window.setTimeout(() => setToast("The unwritten folio completes itself."), 400);
          }
          return next;
        });
      }
    },
    [onClue, onCollect],
  );

  const openBookData = openId ? LIBRARY_BOOKS.find((b) => b.id === openId) : null;

  return (
    <div
      className="im-exhibit"
      style={{
        background:
          "radial-gradient(ellipse at 50% 0%, rgba(212,165,116,0.18), transparent 45%), linear-gradient(180deg, #120e0a, #060504)",
      }}
    >
      <header className="im-exhibit-head">
        <h1 className="im-serif">The Library of Unwritten Books</h1>
        <p>Twelve volumes of never-history. Three remember the origin.</p>
      </header>

      <div className="im-exhibit-body" style={{ padding: "0.5rem 1rem", overflow: "auto" }}>
        {toast && <div className="im-toast">{toast}</div>}

        {openBookData ? (
          <div
            role="dialog"
            aria-label={openBookData.title}
            style={{
              maxWidth: 420,
              margin: "0.5rem auto",
              padding: "1.5rem 1.35rem",
              background: "linear-gradient(160deg, #2a2118, #14100c)",
              border: "1px solid rgba(212,180,131,0.4)",
              borderRadius: 4,
              boxShadow: reducedMotion ? "none" : "0 20px 60px rgba(0,0,0,0.55)",
              animation: reducedMotion ? undefined : "im-fadein 0.35s ease",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: "0.65rem",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
                color: "var(--im-brass)",
              }}
            >
              Volume {openBookData.id.toUpperCase()}
              {openBookData.originClue ? " · Origin" : ""}
            </p>
            <h2 className="im-serif" style={{ margin: "0.5rem 0 1rem", fontSize: "1.55rem", fontWeight: 600 }}>
              {openBookData.title}
            </h2>
            <p className="im-serif" style={{ fontSize: "1.2rem", lineHeight: 1.5, color: "#e8dfd0", fontStyle: "italic" }}>
              {openBookData.fragment}
            </p>
            {openBookData.originClue && (
              <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "var(--im-cyan)", letterSpacing: "0.06em" }}>
                Clue inscribed: {openBookData.originClue}
              </p>
            )}
            <button type="button" className="im-btn" style={{ marginTop: "1.25rem" }} onClick={() => setOpenId(null)}>
              Close volume
            </button>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(52px, 1fr))",
              gap: "0.45rem",
              alignItems: "end",
              maxWidth: 560,
              margin: "0 auto",
              minHeight: "70%",
              paddingBottom: "0.5rem",
            }}
          >
            {shelves.map((book) => {
              const isOrigin = Boolean(book.originClue);
              const done = openedOrigin.has(book.id);
              return (
                <button
                  key={book.id}
                  type="button"
                  aria-label={book.title}
                  title={book.title}
                  onClick={() => openBook(book.id)}
                  style={{
                    height: `${120 * book.tall}px`,
                    border: done
                      ? "1px solid rgba(94,234,212,0.65)"
                      : "1px solid rgba(0,0,0,0.35)",
                    borderRadius: "2px 3px 1px 1px",
                    background: `linear-gradient(90deg, hsl(${book.hue}, 35%, 22%), hsl(${book.hue}, 40%, 32%) 40%, hsl(${book.hue}, 30%, 18%))`,
                    transform: `rotate(${book.lean}deg)`,
                    cursor: "pointer",
                    padding: "0.4rem 0.15rem",
                    writingMode: "vertical-rl",
                    textOrientation: "mixed",
                    color: isOrigin ? "var(--im-brass)" : "#cfc4b0",
                    fontFamily: "Cormorant Garamond, Georgia, serif",
                    fontSize: "0.72rem",
                    letterSpacing: "0.04em",
                    boxShadow: done ? "0 0 12px rgba(94,234,212,0.35)" : "2px 4px 8px rgba(0,0,0,0.35)",
                    transition: reducedMotion ? "none" : "transform 160ms ease, box-shadow 160ms ease",
                  }}
                  onMouseEnter={(e) => {
                    if (reducedMotion) return;
                    (e.currentTarget as HTMLButtonElement).style.transform = `rotate(0deg) translateY(-6px)`;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = `rotate(${book.lean}deg)`;
                  }}
                >
                  {book.title.split(" ").slice(0, 3).join(" ")}
                </button>
              );
            })}
          </div>
        )}

        <p
          style={{
            textAlign: "center",
            marginTop: "0.75rem",
            fontSize: "0.7rem",
            letterSpacing: "0.1em",
            color: "var(--im-muted)",
            textTransform: "uppercase",
          }}
        >
          Origin books {openedOrigin.size}/3
        </p>
      </div>

      <div className="im-exhibit-controls">
        <button type="button" className="im-btn ghost" onClick={onBack}>
          Return
        </button>
        {openId && (
          <button type="button" className="im-btn" onClick={() => setOpenId(null)}>
            Shelf
          </button>
        )}
      </div>
    </div>
  );
}
