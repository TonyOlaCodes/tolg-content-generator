"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import type { AppEntry, AppId, Glyph } from "./apps";

const LONG_PRESS_MS = 500;

function GlyphSvg({ glyph }: { glyph: Glyph }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (glyph) {
    case "weather":
      return (
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <circle cx={9} cy={8.5} r={3} {...common} />
          <path d="M9 2.8v1M3.3 8.5h1M4.8 4.3l.7.7M13.2 4.3l-.7.7" {...common} strokeWidth={1.4} />
          <path d="M8.5 19.5h9.5a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.6 1.3 2.8 2.8 0 0 0 .1 5.7Z" {...common} />
        </svg>
      );
    case "fuel":
      return (
        <svg viewBox="0 0 24 24" aria-hidden focusable="false">
          <rect x={4.5} y={4} width={9.5} height={16.5} rx={1.6} {...common} />
          <path d="M8 8h2.5M14 9h2a1.5 1.5 0 0 1 1.5 1.5V16a1.4 1.4 0 0 0 2.8 0V8.5l-2-2" {...common} />
          <path d="M4.5 20.5h9.5" {...common} />
        </svg>
      );
  }
}

/** Rounded-square icon with the app's name beneath. Long-press pins or unpins it. */
export function AppTile({
  app,
  pinned,
  onOpen,
  onLongPress,
}: {
  app: AppEntry;
  pinned: boolean;
  onOpen: (id: AppId) => void;
  onLongPress: (id: AppId) => void;
}) {
  const timer = useRef<number | null>(null);
  const fired = useRef(false);

  const clearTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  useEffect(() => clearTimer, []);

  const style = {
    "--tile-from": app.gradient[0],
    "--tile-to": app.gradient[1],
  } as CSSProperties;

  return (
    <button
      type="button"
      className="app-tile"
      style={style}
      aria-label={pinned ? `${app.title}, pinned` : app.title}
      title={`${app.title}. Long-press to ${pinned ? "unpin" : "pin"}.`}
      onPointerDown={() => {
        fired.current = false;
        clearTimer();
        timer.current = window.setTimeout(() => {
          timer.current = null;
          fired.current = true;
          if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(12);
          onLongPress(app.id);
        }, LONG_PRESS_MS);
      }}
      onPointerUp={clearTimer}
      onPointerLeave={clearTimer}
      onPointerCancel={clearTimer}
      onContextMenu={(event) => event.preventDefault()}
      onClick={() => {
        if (fired.current) {
          fired.current = false;
          return;
        }
        onOpen(app.id);
      }}
    >
      <span className="app-tile-icon-wrap">
        <span className="app-tile-icon">
          <GlyphSvg glyph={app.glyph} />
        </span>
        {pinned ? <span className="app-tile-pin" aria-hidden>★</span> : null}
      </span>
      <span className="app-tile-name">{app.title}</span>
    </button>
  );
}

/** Compact icon used in lists such as the favourites panel. */
export function AppBadge({ app }: { app: AppEntry }) {
  return (
    <span
      className="app-badge"
      aria-hidden
      style={{ "--tile-from": app.gradient[0], "--tile-to": app.gradient[1] } as CSSProperties}
    >
      <GlyphSvg glyph={app.glyph} />
    </span>
  );
}
