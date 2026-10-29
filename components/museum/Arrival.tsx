"use client";

import { useEffect, useState } from "react";
import { ARRIVAL_LINES, CURATOR_LINES } from "@/lib/museum/narrative";

export default function Arrival({
  onEnter,
  onSkip,
  muted,
  onToggleMute,
}: {
  onEnter: () => void;
  onSkip: () => void;
  muted: boolean;
  onToggleMute: () => void;
}) {
  const [line, setLine] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setLine(1), 2200),
      window.setTimeout(() => setLine(2), 4200),
      window.setTimeout(() => setReady(true), 5200),
    ];
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  return (
    <div className="im-arrival" role="dialog" aria-label="Arrival at The Impossible Museum">
      <div className="im-arrival-void" aria-hidden />
      <div className="im-building" aria-hidden>
        <div className="im-building-spire" />
        <div className="im-building-body" />
      </div>
      <div className="im-arrival-copy">
        <p className="im-logo">The Impossible Museum</p>
        <p className="im-transmission" key={line}>
          {ARRIVAL_LINES[Math.min(line, ARRIVAL_LINES.length - 1)]}
        </p>
        <p className="im-serif" style={{ opacity: ready ? 0.75 : 0, transition: "opacity 0.6s", marginTop: "0.75rem" }}>
          {CURATOR_LINES.welcome}
        </p>
        <div className="im-arrival-actions">
          <button type="button" className="im-btn primary" onClick={onEnter}>
            Enter the atrium
          </button>
          <button type="button" className="im-btn ghost" onClick={onToggleMute}>
            Audio {muted ? "off" : "on"}
          </button>
          <button type="button" className="im-btn ghost" onClick={onSkip}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
