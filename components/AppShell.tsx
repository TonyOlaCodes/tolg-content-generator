"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import AppChooser, { type AppId } from "./AppChooser";
import GameApp from "./GameApp";
import PullUpApp from "./pullup/PullUpApp";

const MuseumApp = dynamic(() => import("./museum/MuseumApp"), {
  ssr: false,
  loading: () => (
    <main className="app-shell is-museum">
      <p style={{ color: "#d4b483", letterSpacing: "0.2em", textTransform: "uppercase", fontSize: 12 }}>
        Opening the Impossible Museum…
      </p>
    </main>
  ),
});

export default function AppShell({ initialCode }: { initialCode?: string }) {
  const [app, setApp] = useState<AppId | null>(initialCode ? "elephant" : null);

  const backToChooser = useCallback(() => setApp(null), []);

  if (!app) {
    return (
      <main className="app-shell">
        <AppChooser onChoose={setApp} />
      </main>
    );
  }

  if (app === "pullup") {
    return (
      <main className="app-shell is-pullup">
        <PullUpApp onBack={backToChooser} />
      </main>
    );
  }

  if (app === "museum") {
    return (
      <main className="app-shell is-museum">
        <MuseumApp onBack={backToChooser} />
      </main>
    );
  }

  return (
    <div className="app-with-back">
      <button type="button" className="app-back-to-chooser" onClick={backToChooser}>
        ← Apps
      </button>
      <GameApp initialCode={initialCode} />
    </div>
  );
}
