"use client";

import { useState } from "react";
import "./launcher/launcher.css";
import "./launcher/tiles.css";
import { AppBadge, AppTile } from "./launcher/AppIcon";
import { CATEGORIES, appById, matchesQuery, readyApps, type AppId, type Category } from "./launcher/apps";
import { useLauncherPrefs } from "./launcher/useLauncherPrefs";
import WeatherWidget from "./launcher/WeatherWidget";

export type { AppId };

const ALL = "All" as const;

function greetingFor(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function AppChooser({ onChoose }: { onChoose: (id: AppId) => void }) {
  const { prefs, toggleFavourite, moveFavourite, recordRecent, setWidgetsOpen } = useLauncherPrefs();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Category | typeof ALL>(ALL);

  const ready = readyApps();
  const now = new Date();
  const dateLabel = now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  const open = (id: AppId) => {
    recordRecent(id);
    onChoose(id);
  };

  const filtered = ready.filter(
    (app) => (category === ALL || app.category === category) && matchesQuery(app, query),
  );

  const searching = query.trim().length > 0;
  const favouriteApps = prefs.favourites
    .map((id) => appById(id))
    .filter((app): app is NonNullable<typeof app> => !!app && app.status === "ready");
  const recentApps = prefs.recents
    .map((id) => appById(id))
    .filter((app): app is NonNullable<typeof app> => !!app && app.status === "ready" && !prefs.favourites.includes(app.id));

  const showWidgets = appById("weather")?.status === "ready";

  return (
    <div className="launcher">
      <header className="launcher-header">
        <p className="launcher-date">{dateLabel}</p>
        <h1 className="launcher-greeting">{greetingFor(now.getHours())}</h1>
      </header>

      <div className="launcher-search">
        <svg viewBox="0 0 24 24" aria-hidden focusable="false" className="launcher-search-icon">
          <circle cx={11} cy={11} r={6.5} fill="none" stroke="currentColor" strokeWidth={2} />
          <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
        </svg>
        <input
          type="search"
          className="launcher-search-input"
          placeholder="Search apps"
          aria-label="Search apps"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
        />
        {searching ? (
          <button type="button" className="launcher-search-clear" onClick={() => setQuery("")} aria-label="Clear search">
            ×
          </button>
        ) : null}
      </div>

      {showWidgets && !searching ? (
        <section className="launcher-widgets" aria-label="Widgets">
          <div className="launcher-section-head">
            <span>Today</span>
            <button
              type="button"
              className="launcher-link"
              aria-expanded={prefs.widgetsOpen}
              onClick={() => setWidgetsOpen(!prefs.widgetsOpen)}
            >
              {prefs.widgetsOpen ? "Hide" : "Show"}
            </button>
          </div>
          {prefs.widgetsOpen ? (
            <div className="launcher-widget-row">
              <WeatherWidget onOpen={() => open("weather")} />
            </div>
          ) : null}
        </section>
      ) : null}

      {!searching && favouriteApps.length > 0 ? (
        <section className="launcher-section" aria-label="Favourites">
          <h2 className="launcher-section-title">Favourites</h2>
          <ul className="launcher-fav-list">
            {favouriteApps.map((app, index) => (
              <li key={app.id} className="launcher-fav-item">
                <button type="button" className="launcher-fav-open" onClick={() => open(app.id)}>
                  <AppBadge app={app} />
                  <span className="launcher-fav-name">{app.title}</span>
                </button>
                <span className="launcher-fav-controls">
                  <button
                    type="button"
                    className="launcher-icon-btn"
                    onClick={() => moveFavourite(app.id, -1)}
                    disabled={index === 0}
                    aria-label={`Move ${app.title} up`}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="launcher-icon-btn"
                    onClick={() => moveFavourite(app.id, 1)}
                    disabled={index === favouriteApps.length - 1}
                    aria-label={`Move ${app.title} down`}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="launcher-icon-btn"
                    onClick={() => toggleFavourite(app.id)}
                    aria-label={`Unpin ${app.title}`}
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!searching && recentApps.length > 0 ? (
        <section className="launcher-section" aria-label="Recently opened">
          <h2 className="launcher-section-title">Recent</h2>
          <div className="launcher-recent-row">
            {recentApps.map((app) => (
              <button key={app.id} type="button" className="launcher-recent-chip" onClick={() => open(app.id)}>
                <AppBadge app={app} />
                <span>{app.title}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="launcher-chips" role="tablist" aria-label="Categories">
        {[ALL, ...CATEGORIES].map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={category === c}
            className={`launcher-chip${category === c ? " is-active" : ""}`}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div className="launcher-grid" role="list">
          {filtered.map((app) => (
            <div key={app.id} role="listitem">
              <AppTile
                app={app}
                pinned={prefs.favourites.includes(app.id)}
                onOpen={open}
                onLongPress={toggleFavourite}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="launcher-empty">
          <p className="launcher-empty-title">{searching ? `No apps match “${query.trim()}”` : "No apps in this category"}</p>
          <p className="launcher-empty-sub">
            {searching ? "Try a different name or category." : "New mini-apps appear here automatically."}
          </p>
        </div>
      )}

      {!searching && filtered.length > 0 ? (
        <p className="launcher-hint">Long-press an app to pin it to Favourites.</p>
      ) : null}
    </div>
  );
}
