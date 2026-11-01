"use client";

import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useForecast } from "@/weather/useForecast";
import { FALLBACK_PLACE, loadRecent, loadSaved, loadSelected, loadUnits, placeKey, pushRecent, saveRecent, saveSaved, saveSelected } from "@/weather/storage";
import { describeWeatherCode, isWetCode } from "@/weather/codes";
import {
  formatPercent,
  formatPrecip,
  formatVisibility,
  formatWind,
  windDirectionLabel,
} from "@/weather/units";
import type { Forecast, Place, Units } from "@/weather/types";
import { DEFAULT_UNITS } from "@/weather/types";
import "./weather.css";

type Section = "today" | "hourly" | "forecast" | "saved";
const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: "today", label: "Today", icon: "◉" },
  { id: "hourly", label: "Hourly", icon: "◷" },
  { id: "forecast", label: "16 Days", icon: "▦" },
  { id: "saved", label: "Places", icon: "⌖" },
];

/** Temperatures are always shown in Celsius. */
function tempParts(celsius: number | null): { primary: string } {
  if (celsius === null || !Number.isFinite(celsius)) return { primary: "—" };
  return { primary: `${Math.round(celsius)}°C` };
}

function TempPair({ celsius, className }: { celsius: number | null; className?: string }) {
  const { primary } = tempParts(celsius);
  return <span className={className}>{primary}</span>;
}

/** Formats an Open-Meteo local ISO time ("2026-10-31T14:00") without touching the device time zone. */
function localClock(iso: string | null, clock: Units["clock"]): string {
  if (!iso) return "—";
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return "—";
  const h = Number(m[1]);
  const min = m[2];
  if (clock === "24h") return `${String(h).padStart(2, "0")}:${min}`;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${min} ${suffix}`;
}

function localDayLabel(iso: string): string {
  const [y, mo, d] = iso.split("-").map(Number);
  if (!y || !mo || !d) return iso;
  return new Date(Date.UTC(y, mo - 1, d)).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
}

function localDateLabel(iso: string): string {
  const [y, mo, d] = iso.split("-").map(Number);
  if (!y || !mo || !d) return iso;
  return new Date(Date.UTC(y, mo - 1, d)).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** Favourite chip: place name with that place's current weather emoji and temperature. */
function FavChip({ place }: { place: Place }) {
  const state = useForecast(place, 0);
  const forecast = state.status === "ready" || state.status === "loading" || state.status === "error" ? state.forecast : null;
  const cond = forecast ? describeWeatherCode(forecast.current.weatherCode, forecast.current.isDay) : null;
  return (
    <>
      {place.name}
      {cond && forecast ? (
        <span className="wx-fav-wx">
          <span role="img" aria-label={cond.label}>{cond.icon}</span> {Math.round(forecast.current.temperature ?? 0)}°
        </span>
      ) : null}
    </>
  );
}

function placeLabel(p: Place): string {
  return [p.name, p.admin1, p.country].filter(Boolean).join(", ");
}

/** Plain-language summary built only from real hourly precipitation probabilities. */
function rainSummary(forecast: Forecast): string {
  const next = forecast.hourly.slice(0, 24);
  const wet = next.filter((h) => (h.precipitationProbability ?? 0) >= 50);
  if (wet.length === 0) {
    const known = next.filter((h) => h.precipitationProbability !== null);
    if (known.length === 0) return "Rain probability is unavailable for this location.";
    return "No significant rain is forecast in the next 24 hours.";
  }
  const first = wet[0];
  const hour = localClock(first.time, "24h");
  return `Rain is likely from around ${hour} (${wet.length} of the next 24 hours at 50% or higher).`;
}

export default function WeatherApp({ onBack }: { onBack: () => void }) {
  const [section, setSection] = useState<Section>("today");
  const [units, setUnits] = useState<Units>(DEFAULT_UNITS);
  const [saved, setSaved] = useState<Place[]>([]);
  const [recent, setRecent] = useState<Place[]>([]);
  const [selected, setSelected] = useState<Place>(FALLBACK_PLACE);
  const [ready, setReady] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [openHour, setOpenHour] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  // Load local preferences only after mount, so server rendering never touches storage.
  useEffect(() => {
    setUnits(loadUnits());
    setSaved(loadSaved());
    setRecent(loadRecent());
    const sel = loadSelected();
    if (sel) setSelected(sel);
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) saveSelected(selected);
  }, [selected, ready]);

  const weather = useForecast(ready ? selected : null, refreshToken);

  const choosePlace = useCallback((place: Place) => {
    setSelected(place);
    setRecent((list) => {
      const next = pushRecent(list, place);
      saveRecent(next);
      return next;
    });
    setOpenDay(null);
    setOpenHour(null);
    setSearchOpen(false);
    setSection("today");
  }, []);

  const isSaved = saved.some((p) => placeKey(p) === placeKey(selected));
  const toggleSaved = useCallback(() => {
    setSaved((list) => {
      const exists = list.some((p) => placeKey(p) === placeKey(selected));
      const next = exists ? list.filter((p) => placeKey(p) !== placeKey(selected)) : [...list, selected];
      saveSaved(next);
      return next;
    });
  }, [selected]);

  const forecast = weather.status === "idle" ? null : weather.forecast;
  const background = forecast ? describeWeatherCode(forecast.current.weatherCode, forecast.current.isDay).kind : "unknown";

  return (
    <main className="wx" data-wx={background}>
      <header className="wx-top">
        <button type="button" className="wx-back" onClick={onBack} aria-label="Back to all apps">
          ‹ Apps
        </button>
        <h1 className="wx-title">Weather</h1>
        <button type="button" className="wx-back" aria-label="Search places" aria-expanded={searchOpen} onClick={() => setSearchOpen((o) => !o)}>
          ⌕
        </button>
      </header>

      {searchOpen ? (
        <div className="wx-body-search">
          <LocationSearch onChoose={(p) => { choosePlace(p); setSearchOpen(false); }} />
        </div>
      ) : null}

      {saved.length > 0 ? (
        <div className="wx-favs" role="list" aria-label="Favourite places">
          {saved.map((p) => (
            <button
              key={placeKey(p)}
              type="button"
              role="listitem"
              className={`wx-fav ${placeKey(p) === placeKey(selected) ? "is-active" : ""}`}
              onClick={() => choosePlace(p)}
            >
              <FavChip place={p} />
            </button>
          ))}
        </div>
      ) : null}

      <nav className="wx-nav" aria-label="Weather sections">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`wx-nav-btn ${section === s.id ? "is-active" : ""}`}
            aria-current={section === s.id ? "page" : undefined}
            onClick={() => setSection(s.id)}
          >
            <span className="wx-nav-icon" aria-hidden="true">{s.icon}</span>
            {s.label}
          </button>
        ))}
      </nav>

      <section className="wx-body wx-body-pad" aria-live="polite">
        {weather.status === "loading" && !forecast ? (
          <p className="wx-note" role="status">Loading the forecast for {selected.name}…</p>
        ) : null}

        {weather.status === "error" && !forecast ? (
          <div className="wx-card wx-error" role="alert">
            <p>{weather.message}</p>
            <button type="button" className="wx-btn" onClick={() => setRefreshToken((n) => n + 1)}>
              Try again
            </button>
          </div>
        ) : null}

        {weather.status === "ready" && weather.stale ? (
          <p className="wx-note wx-stale" role="status">
            Showing saved weather. It may be out of date.
          </p>
        ) : null}

        {forecast ? (
          <>
            <div className="wx-meta">
              <span>
                Updated {localClock(forecast.current.time, units.clock)} local time ·{" "}
                {new Date(forecast.fetchedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              <button type="button" className="wx-link" onClick={() => setRefreshToken((n) => n + 1)}>
                Refresh
              </button>
            </div>
          </>
        ) : null}

        {section === "today" && forecast ? (
          <TodayView forecast={forecast} place={selected} units={units} isSaved={isSaved} onToggleSaved={toggleSaved} openDay={openDay} setOpenDay={setOpenDay} />
        ) : null}
        {section === "hourly" && forecast ? (
          <HourlyView forecast={forecast} units={units} openHour={openHour} setOpenHour={setOpenHour} />
        ) : null}
        {section === "forecast" && forecast ? (
          <ForecastView forecast={forecast} units={units} openDay={openDay} setOpenDay={setOpenDay} />
        ) : null}
        {section === "saved" ? (
          <PlacesView
            saved={saved}
            recent={recent}
            current={selected}
            onChoose={choosePlace}
            onRemove={(p) =>
              setSaved((list) => {
                const next = list.filter((x) => placeKey(x) !== placeKey(p));
                saveSaved(next);
                return next;
              })
            }
            onMove={(index, dir) =>
              setSaved((list) => {
                const j = index + dir;
                if (j < 0 || j >= list.length) return list;
                const next = [...list];
                [next[index], next[j]] = [next[j], next[index]];
                saveSaved(next);
                return next;
              })
            }
          />
        ) : null}
      </section>
    </main>
  );
}

function TodayView({
  forecast,
  place,
  units,
  isSaved,
  onToggleSaved,
  openDay,
  setOpenDay,
}: {
  forecast: Forecast;
  place: Place;
  units: Units;
  isSaved: boolean;
  onToggleSaved: () => void;
  openDay: string | null;
  setOpenDay: (d: string | null) => void;
}) {
  const c = forecast.current;
  const cond = describeWeatherCode(c.weatherCode, c.isDay);
  const today = forecast.daily[0];
  const wet = isWetCode(c.weatherCode) || (c.precipitation ?? 0) > 0;
  const nowHour = c.time.slice(0, 13);
  const pop = forecast.hourly.find((h) => h.time.slice(0, 13) === nowHour)?.precipitationProbability ?? null;
  const sun = today ? { rise: today.sunrise, set: today.sunset } : null;

  return (
    <div className={`wx-stack ${wet ? "is-wet" : ""}`}>
      <div className="wx-hero wx-card">
        <div className="wx-hero-top">
          <div>
            <h2 className="wx-hero-place">{place.name}</h2>
            <p className="wx-clock">
              {[place.admin1, place.country].filter(Boolean).join(", ")} · {localClock(c.time, units.clock)}
            </p>
          </div>
          <button type="button" className="wx-save" aria-pressed={isSaved} onClick={onToggleSaved}>
            {isSaved ? "★" : "☆"}
          </button>
        </div>
        <div className="wx-hero-main">
          <div>
            <p className="wx-hero-temp">
              <TempPair celsius={c.temperature} />
            </p>
            <p className="wx-hero-cond">{cond.label}</p>
            <p className="wx-hero-hl">
              H <TempPair celsius={today?.temperatureMax ?? null} /> · L{" "}
              <TempPair celsius={today?.temperatureMin ?? null} />
            </p>
            <p className="wx-hero-hl">
              Feels like <TempPair celsius={c.apparentTemperature} />
            </p>
          </div>
          <span className="wx-hero-icon" role="img" aria-label={cond.label}>
            {cond.icon}
          </span>
        </div>
      </div>

      <div className="wx-card">
        <h3>Rain</h3>
        <p>{rainSummary(forecast)}</p>
        <dl className="wx-grid">
          <Stat label="Rain chance now" value={formatPercent(pop)} />
          <Stat label="Precipitation now" value={formatPrecip(c.precipitation, units)} />
          <Stat label="Rain chance today (max)" value={formatPercent(today?.precipitationProbabilityMax ?? null)} />
          <Stat label="Total today" value={formatPrecip(today?.precipitationSum ?? null, units)} />
        </dl>
      </div>

      <div className="wx-card">
        <h3>Conditions</h3>
        <dl className="wx-grid">
          <Stat label="Humidity" value={formatPercent(c.humidity)} />
          <Stat label="Wind" value={`${formatWind(c.windSpeed, units)} ${windDirectionLabel(c.windDirection)}`.trim()} />
          <Stat label="Gusts" value={formatWind(c.windGusts, units)} />
          <Stat label="Cloud cover" value={formatPercent(c.cloudCover)} />
          <Stat label="Visibility" value={formatVisibility(forecast.hourly.find((h) => h.time.slice(0, 13) === nowHour)?.visibility ?? null)} />
        </dl>
      </div>

      <div className="wx-card">
        <h3>Sun</h3>
        <dl className="wx-grid">
          <Stat label="Sunrise" value={sun ? localClock(sun.rise, units.clock) : "—"} />
          <Stat label="Sunset" value={sun ? localClock(sun.set, units.clock) : "—"} />
        </dl>
      </div>

      <div className="wx-card">
        <h3>Days</h3>
        <ul className="wx-days">
          {forecast.daily.slice(0, 10).map((d) => {
            const dc = describeWeatherCode(d.weatherCode, true);
            const open = openDay === d.date;
            return (
              <li key={d.date}>
                <button type="button" className="wx-day" aria-expanded={open} onClick={() => setOpenDay(open ? null : d.date)}>
                  <span className="wx-day-date">{localDayLabel(d.date)} {localDateLabel(d.date)}</span>
                  <span role="img" aria-label={dc.label}>{dc.icon}</span>
                  <span className="wx-day-range">
                    {tempParts(d.temperatureMax).primary} / {tempParts(d.temperatureMin).primary}
                  </span>
                </button>
                {open ? (
                  <dl className="wx-grid wx-day-detail">
                    <Stat label="Condition" value={dc.label} />
                    <Stat label="Rain chance" value={formatPercent(d.precipitationProbabilityMax)} />
                    <Stat label="Precipitation" value={formatPrecip(d.precipitationSum, units)} />
                    <Stat label="Max wind" value={formatWind(d.windSpeedMax, units)} />
                    <Stat label="Sunrise / sunset" value={`${localClock(d.sunrise, units.clock)} / ${localClock(d.sunset, units.clock)}`} />
                  </dl>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <p className="wx-disclaimer">
        Forecasts are model estimates and can change. Weather data by{" "}
        <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo.com</a>{" "}
        (<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>).
      </p>
    </div>
  );
}

function HourlyView({
  forecast,
  units,
  openHour,
  setOpenHour,
}: {
  forecast: Forecast;
  units: Units;
  openHour: string | null;
  setOpenHour: (t: string | null) => void;
}) {
  const nowKey = forecast.current.time.slice(0, 13);
  const start = Math.max(0, forecast.hourly.findIndex((h) => h.time.slice(0, 13) === nowKey));
  const hours = forecast.hourly.slice(start, start + 48);
  if (hours.length === 0) {
    return <p className="wx-note">No hourly forecast is available for this location.</p>;
  }
  const selectedHour = hours.find((h) => h.time === openHour) ?? null;
  return (
    <div className="wx-stack">
      <div className="wx-card">
        <div className="wx-chart-label"><span>Temperature</span><span>next {hours.length}h</span></div>
        <LineChart values={hours.map((h) => h.temperature)} format={(v) => `${Math.round(v)}°`} />
        <div className="wx-chart-label"><span>Rain chance</span><span>%</span></div>
        <BarChart values={hours.map((h) => h.precipitationProbability)} />
      </div>
      <ul className="wx-strip wx-card" aria-label="Next 48 hours">
        {hours.map((h) => {
          const cond = describeWeatherCode(h.weatherCode, isDayHour(h.time, forecast));
          const open = openHour === h.time;
          const tp = tempParts(h.temperature);
          return (
            <li key={h.time}>
              <button type="button" className={`wx-hcell ${open ? "is-selected" : ""}`} aria-pressed={open} onClick={() => setOpenHour(open ? null : h.time)}>
                <span>{localClock(h.time, units.clock)}</span>
                <span className="wx-hcell-icon" role="img" aria-label={cond.label}>{cond.icon}</span>
                <span className="wx-hcell-temp">{tp.primary}</span>
                <span className="wx-hcell-pop">{h.precipitationProbability === null ? "" : formatPercent(h.precipitationProbability)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {selectedHour ? (
        <div className="wx-card">
          <h3>{localClock(selectedHour.time, units.clock)} · {localDateLabel(selectedHour.time.slice(0, 10))}</h3>
          <dl className="wx-hour-detail">
            <Stat label="Feels like" value={tempParts(selectedHour.apparentTemperature).primary} />
            <Stat label="Precipitation" value={formatPrecip(selectedHour.precipitation, units)} />
            <Stat label="Wind" value={formatWind(selectedHour.windSpeed, units)} />
            <Stat label="Humidity" value={formatPercent(selectedHour.humidity)} />
            <Stat label="Visibility" value={formatVisibility(selectedHour.visibility)} />
          </dl>
        </div>
      ) : null}
    </div>
  );
}

/** Simple SVG line chart. Missing values break the line instead of being drawn as zero. */
function LineChart({ values, format }: { values: (number | null)[]; format: (v: number) => string }) {
  const nums = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (nums.length < 2) return <p className="wx-sub">Not enough data for a chart.</p>;
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  const span = hi - lo || 1;
  const w = 100;
  const h = 60;
  const pts = values.map((v, i) => (v === null ? null : { x: (i / (values.length - 1)) * w, y: h - ((v - lo) / span) * (h - 8) - 4 }));
  const d = pts.reduce((acc, p) => (p ? `${acc}${acc.endsWith("M") || acc === "" ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)} ` : acc), "");
  const first = values.find((v) => v !== null);
  const last = [...values].reverse().find((v) => v !== null);
  return (
    <svg className="wx-chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={`Temperature from ${first === undefined || first === null ? "—" : tempParts(first).primary} to ${last === undefined || last === null ? "—" : tempParts(last).primary}; low ${format(lo)}, high ${format(hi)}`}>
      <path d={d} fill="none" stroke="#ffd166" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  );
}

/** Simple SVG bar chart for precipitation probability (0–100%). */
function BarChart({ values }: { values: (number | null)[] }) {
  const w = 100;
  const h = 40;
  const bw = w / Math.max(values.length, 1);
  return (
    <svg className="wx-chart" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Rain chance by hour" style={{ height: 52 }}>
      {values.map((v, i) =>
        v === null ? null : (
          <rect key={i} x={i * bw + bw * 0.15} y={h - (v / 100) * h} width={bw * 0.7} height={(v / 100) * h} rx="1" fill="#7cc7ff" opacity={0.85} />
        ),
      )}
    </svg>
  );
}

/** Hour is "day" when its time falls between the day's sunrise and sunset. */
function isDayHour(time: string, forecast: Forecast): boolean {
  const date = time.slice(0, 10);
  const day = forecast.daily.find((d) => d.date === date);
  if (!day || !day.sunrise || !day.sunset) return true;
  const t = time.slice(11, 16);
  return t >= day.sunrise.slice(11, 16) && t < day.sunset.slice(11, 16);
}

function ForecastView({
  forecast,
  units,
  openDay,
  setOpenDay,
}: {
  forecast: Forecast;
  units: Units;
  openDay: string | null;
  setOpenDay: (d: string | null) => void;
}) {
  const days = forecast.daily;
  const lows = days.map((d) => d.temperatureMin).filter((v): v is number => v !== null);
  const highs = days.map((d) => d.temperatureMax).filter((v): v is number => v !== null);
  const min = lows.length ? Math.min(...lows) : 0;
  const max = highs.length ? Math.max(...highs) : 0;
  const span = max - min || 1;
  if (days.length === 0) {
    return <p className="wx-note">No daily forecast is available for this location.</p>;
  }
  return (
    <div className="wx-stack">
      <p className="wx-sub">Forecast for up to 16 days. Later days are less certain.</p>
      <ul className="wx-days wx-card">
        {days.map((d) => {
          const cond = describeWeatherCode(d.weatherCode, true);
          const open = openDay === d.date;
          const hasRange = d.temperatureMin !== null && d.temperatureMax !== null;
          const lo = d.temperatureMin ?? min;
          const hi = d.temperatureMax ?? max;
          const left = ((lo - min) / span) * 100;
          const width = ((hi - lo) / span) * 100;
          return (
            <li key={d.date}>
              <button type="button" className="wx-day wx-drow" aria-expanded={open} onClick={() => setOpenDay(open ? null : d.date)}>
                <span className="wx-day-name">
                  {localDayLabel(d.date)} <small>{localDateLabel(d.date)}</small>
                </span>
                <span className="wx-drow-icon" role="img" aria-label={cond.label}>{cond.icon}</span>
                <span className="wx-range-track" aria-hidden="true">
                  {hasRange ? <span className="wx-range-fill" style={{ left: `${left}%`, width: `${Math.max(width, 4)}%` }} /> : null}
                </span>
                <span className="wx-drow-hl">
                  <TempPair celsius={d.temperatureMax} /> <small>/ <TempPair celsius={d.temperatureMin} /></small>
                </span>
              </button>
              {open ? (
                <dl className="wx-grid wx-day-detail">
                  <Stat label="Condition" value={cond.label} />
                  <Stat label="Rain chance" value={formatPercent(d.precipitationProbabilityMax)} />
                  <Stat label="Precipitation" value={formatPrecip(d.precipitationSum, units)} />
                  <Stat label="Max wind" value={formatWind(d.windSpeedMax, units)} />
                  <Stat label="Sunrise / sunset" value={`${localClock(d.sunrise, units.clock)} / ${localClock(d.sunset, units.clock)}`} />
                </dl>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PlacesView({
  saved,
  recent,
  current,
  onChoose,
  onRemove,
  onMove,
}: {
  saved: Place[];
  recent: Place[];
  current: Place;
  onChoose: (p: Place) => void;
  onRemove: (p: Place) => void;
  onMove: (index: number, dir: -1 | 1) => void;
}) {
  return (
    <div className="wx-stack">
      <LocationSearch onChoose={onChoose} />
      <div className="wx-card">
        <h3>Saved places</h3>
        {saved.length === 0 ? (
          <p className="wx-sub">No saved places yet. Use Save on the Today screen to add one.</p>
        ) : (
          <ul className="wx-list">
            {saved.map((p, i) => (
              <li key={placeKey(p)} className={placeKey(p) === placeKey(current) ? "is-current" : ""}>
                <button type="button" className="wx-list-main" onClick={() => onChoose(p)}>
                  {placeLabel(p)}
                </button>
                <span className="wx-list-actions">
                  <button type="button" aria-label={`Move ${p.name} up`} disabled={i === 0} onClick={() => onMove(i, -1)}>↑</button>
                  <button type="button" aria-label={`Move ${p.name} down`} disabled={i === saved.length - 1} onClick={() => onMove(i, 1)}>↓</button>
                  <button type="button" aria-label={`Remove ${p.name}`} onClick={() => onRemove(p)}>✕</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      {recent.length > 0 ? (
        <div className="wx-card">
          <h3>Recent</h3>
          <ul className="wx-list">
            {recent.map((p) => (
              <li key={placeKey(p)}>
                <button type="button" className="wx-list-main" onClick={() => onChoose(p)}>
                  {placeLabel(p)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="wx-sub">Showing °C for all places.</p>
    </div>
  );
}

/** Debounced Open-Meteo place search; the server route caches and validates results. */
function LocationSearch({ onChoose }: { onChoose: (p: Place) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Place[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setError(null);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = window.setTimeout(() => {
      fetch(`/api/weather/search?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then(async (r) => {
          const body = (await r.json().catch(() => null)) as { places?: Place[]; error?: string } | null;
          if (!r.ok || !body || !Array.isArray(body.places)) {
            throw new Error(body?.error ?? "Search is unavailable right now.");
          }
          setResults(body.places);
          setError(null);
          setActive(-1);
        })
        .catch((e: unknown) => {
          if (controller.signal.aborted) return;
          setResults(null);
          setError(e instanceof Error ? e.message : "Search is unavailable right now.");
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const choose = (p: Place) => {
    setQuery("");
    setResults(null);
    onChoose(p);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!results || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === "Escape") {
      setQuery("");
    }
  };

  return (
    <div className="wx-card">
      <label htmlFor="wx-search" className="wx-label">Search any city, town or postcode</label>
      <input
        id="wx-search"
        ref={inputRef}
        className="wx-input"
        type="search"
        value={query}
        placeholder="e.g. Lagos, Reykjavík, 10001"
        autoComplete="off"
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={onKey}
        role="combobox"
        aria-expanded={Boolean(results && results.length)}
        aria-controls="wx-results"
        aria-activedescendant={active >= 0 ? `wx-opt-${active}` : undefined}
      />
      {loading ? <p className="wx-sub" role="status">Searching…</p> : null}
      {error ? <p className="wx-error-text" role="alert">{error}</p> : null}
      {results && results.length === 0 ? <p className="wx-sub">No places match “{query.trim()}”. Try a different spelling.</p> : null}
      {results && results.length > 0 ? (
        <ul id="wx-results" role="listbox" className="wx-list">
          {results.map((p, i) => (
            <li key={`${p.id}-${i}`}>
              <button
                id={`wx-opt-${i}`}
                type="button"
                role="option"
                aria-selected={i === active}
                className={`wx-list-main ${i === active ? "is-active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(p)}
              >
                <strong>{p.name}</strong>
                <span className="wx-sub">{[p.admin1, p.country].filter(Boolean).join(", ")}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="wx-stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
