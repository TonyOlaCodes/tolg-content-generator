"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import AppChooser, { type AppId } from "./AppChooser";

// Each mini-app is its own chunk: opening the launcher no longer downloads all of them.
const WeatherApp = dynamic(() => import("@/app/weather/WeatherApp"), { ssr: false });
const FuelApp = dynamic(() => import("@/app/fuel/FuelApp"), { ssr: false });
const MoneyApp = dynamic(() => import("@/app/money/MoneyApp"), { ssr: false });
const GroceriesApp = dynamic(() => import("@/app/groceries/GroceriesApp"), { ssr: false });
const NotesApp = dynamic(() => import("@/app/notes/NotesApp"), { ssr: false });
const DailyApp = dynamic(() => import("@/app/daily/DailyApp"), { ssr: false });

export default function AppShell() {
  const [app, setApp] = useState<AppId | null>(null);

  const backToChooser = useCallback(() => setApp(null), []);

  if (!app) {
    return (
      <main className="app-shell">
        <AppChooser onChoose={setApp} />
      </main>
    );
  }

  if (app === "weather") {
    return (
      <main className="app-shell is-weather">
        <WeatherApp onBack={backToChooser} />
      </main>
    );
  }

  if (app === "money") {
    return (
      <main className="app-shell is-money">
        <MoneyApp onBack={backToChooser} />
      </main>
    );
  }

  if (app === "groceries") {
    return (
      <main className="app-shell is-groceries">
        <GroceriesApp onBack={backToChooser} />
      </main>
    );
  }

  if (app === "notes") {
    return (
      <main className="app-shell is-notes">
        <NotesApp onBack={backToChooser} />
      </main>
    );
  }

  if (app === "daily") {
    return (
      <main className="app-shell is-daily">
        <DailyApp onBack={backToChooser} />
      </main>
    );
  }

  return (
    <main className="app-shell is-fuel">
      <FuelApp onBack={backToChooser} />
    </main>
  );
}
