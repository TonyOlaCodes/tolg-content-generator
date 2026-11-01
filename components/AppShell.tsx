"use client";

import { useCallback, useState } from "react";
import AppChooser, { type AppId } from "./AppChooser";
import WeatherApp from "@/app/weather/WeatherApp";
import FuelApp from "@/app/fuel/FuelApp";
import MoneyApp from "@/app/money/MoneyApp";
import GroceriesApp from "@/app/groceries/GroceriesApp";

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

  return (
    <main className="app-shell is-fuel">
      <FuelApp onBack={backToChooser} />
    </main>
  );
}
