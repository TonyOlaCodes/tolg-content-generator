"use client";

import { useCallback, useState } from "react";
import AppChooser, { type AppId } from "./AppChooser";
import GameApp from "./GameApp";
import PullUpApp from "./pullup/PullUpApp";

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

  return (
    <div className="app-with-back">
      <button type="button" className="app-back-to-chooser" onClick={backToChooser}>
        ← Apps
      </button>
      <GameApp initialCode={initialCode} />
    </div>
  );
}
