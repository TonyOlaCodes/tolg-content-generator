"use client";

import { useCallback, useState } from "react";
import { UserButton } from "@clerk/nextjs";
import AppChooser, { type AppId } from "./AppChooser";
import WeatherApp from "@/app/weather/WeatherApp";
import FuelApp from "@/app/fuel/FuelApp";
import MoneyApp from "@/app/money/MoneyApp";
import GroceriesApp from "@/app/groceries/GroceriesApp";
import NotesApp from "@/app/notes/NotesApp";
import DailyApp from "@/app/daily/DailyApp";

export default function AppShell() {
  const [app, setApp] = useState<AppId | null>(null);

  const backToChooser = useCallback(() => setApp(null), []);

  const account = (
    <div className="account-bar">
      <UserButton />
    </div>
  );

  if (!app) {
    return (
      <main className="app-shell">
        {account}
        <AppChooser onChoose={setApp} />
      </main>
    );
  }

  if (app === "weather") {
    return (
      <main className="app-shell is-weather">
        {account}
        <WeatherApp onBack={backToChooser} />
      </main>
    );
  }

  if (app === "money") {
    return (
      <main className="app-shell is-money">
        {account}
        <MoneyApp onBack={backToChooser} />
      </main>
    );
  }

  if (app === "groceries") {
    return (
      <main className="app-shell is-groceries">
        {account}
        <GroceriesApp onBack={backToChooser} />
      </main>
    );
  }

  if (app === "notes") {
    return (
      <main className="app-shell is-notes">
        {account}
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
      {account}
      <FuelApp onBack={backToChooser} />
    </main>
  );
}
