"use client";

import { useEffect, useMemo, useState } from "react";
import "./fuel.css";
import { loadState, saveState, applySeed, newId, EMPTY_STATE, type FuelState, type Refuel } from "@/fuel/store";
import { solveRefuel, estimatedReach, driveMetrics, fullToFullIntervals, confidenceFor, type RefuelField } from "@/fuel/calc";

type Tab = "dashboard" | "refuel" | "drives" | "analytics" | "history";
const TABS: Array<{ id: Tab; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "refuel", label: "Refuel" },
  { id: "drives", label: "Drives" },
  { id: "analytics", label: "Analytics" },
  { id: "history", label: "History" },
];

const eur = (n: number) => new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR" }).format(n);
const km = (n: number) => `${Math.round(n).toLocaleString("en-IE")} km`;

export default function FuelApp({ onBack }: { onBack: () => void }) {
  const [state, setState] = useState<FuelState>(EMPTY_STATE);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("dashboard");

  // Load and seed once on mount. applySeed is idempotent via seedVersion.
  useEffect(() => {
    const seeded = applySeed(loadState());
    setState(seeded);
    saveState(seeded);
    setReady(true);
  }, []);

  const commit = (next: FuelState) => {
    setState(next);
    saveState(next);
  };

  if (!ready) return <div className="fuel-body"><p className="fuel-muted">Loading…</p></div>;

  return (
    <div className="fuel">
      <header className="fuel-top">
        <button type="button" className="fuel-back" onClick={onBack}>← Apps</button>
        <h1 className="fuel-title">Fuel Tracker</h1>
        <span className="fuel-spacer" />
      </header>
      <nav className="fuel-tabs" aria-label="Fuel Tracker sections">
        {TABS.map((t) => (
          <button key={t.id} type="button" className={`fuel-tab${tab === t.id ? " is-active" : ""}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      <div className="fuel-body">
        {tab === "dashboard" && <Dashboard state={state} onGoRefuel={() => setTab("refuel")} onGoDrives={() => setTab("drives")} />}
        {tab === "refuel" && <RefuelForm state={state} onSave={(r) => commit({ ...state, refuels: [...state.refuels, r] })} />}
        {tab === "drives" && <Drives state={state} onChange={commit} />}
        {tab === "analytics" && <Analytics state={state} />}
        {tab === "history" && <History state={state} />}
      </div>
    </div>
  );
}

function Dashboard({ state, onGoRefuel, onGoDrives }: { state: FuelState; onGoRefuel: () => void; onGoDrives: () => void }) {
  const latest = useMemo(() => {
    const withOdo = state.readings.slice().sort((a, b) => b.odometerKm - a.odometerKm)[0];
    return withOdo ?? null;
  }, [state.readings]);

  const totalSpend = state.refuels.reduce((s, r) => s + (r.total ?? 0), 0);
  const fulls = fullToFullIntervals(
    state.refuels
      .filter((r) => r.odometerKm !== null && r.litres !== null && r.total !== null)
      .sort((a, b) => (a.odometerKm ?? 0) - (b.odometerKm ?? 0))
      .map((r) => ({ id: r.id, odometerKm: r.odometerKm!, litres: r.litres!, total: r.total!, full: r.full })),
  );
  const conf = confidenceFor(fulls.length);
  const openDrive = state.drives.find((d) => d.endedAt === null);

  return (
    <div className="fuel-stack">
      <section className="fuel-card fuel-hero">
        <p className="fuel-muted">Odometer</p>
        <p className="fuel-big">{latest ? km(latest.odometerKm) : "No readings yet"}</p>
        {latest && (
          <>
            <p className="fuel-muted">Estimated range {km(latest.rangeKm)} · estimated total reach {km(estimatedReach(latest.odometerKm, latest.rangeKm))}</p>
            <div className="fuel-range" role="img" aria-label={`Estimated range ${latest.rangeKm} km`}>
              <div className="fuel-range-fill" style={{ width: `${Math.min(100, (latest.rangeKm / 600) * 100)}%` }} />
            </div>
          </>
        )}
      </section>

      <section className="fuel-grid">
        <Stat label="Total spend" value={eur(totalSpend)} />
        <Stat label="Refuels" value={String(state.refuels.length)} />
        <Stat label="Average L/100 km" value={fulls.length ? `${(fulls.reduce((s, i) => s + i.l100km, 0) / fulls.length).toFixed(1)}` : "—"} hint={conf.label} />
        <Stat label="Cost per km" value={fulls.length ? `${(fulls.reduce((s, i) => s + i.costPerKm, 0) / fulls.length * 100).toFixed(1)} c` : "—"} hint={conf.label} />
      </section>

      {openDrive && <p className="fuel-card">Drive in progress since {new Date(openDrive.startedAt).toLocaleTimeString()}</p>}

      <section className="fuel-actions">
        <button type="button" className="fuel-cta" onClick={onGoRefuel}>+ Add Fuel</button>
        <button type="button" className="fuel-cta is-secondary" onClick={onGoDrives}>Start Drive</button>
      </section>
    </div>
  );
}

function Drives({ state, onChange }: { state: FuelState; onChange: (s: FuelState) => void }) {
  const [odo, setOdo] = useState("");
  const [range, setRange] = useState("");
  const [endOdo, setEndOdo] = useState("");
  const [endRange, setEndRange] = useState("");
  const open = state.drives.find((d) => d.endedAt === null);
  const closed = state.drives.filter((d) => d.endedAt !== null).sort((a, b) => (b.endedAt ?? "").localeCompare(a.endedAt ?? ""));

  const start = () => {
    const o = Number(odo);
    const r = Number(range);
    if (!Number.isFinite(o) || !Number.isFinite(r) || odo === "" || range === "" || o < 0 || r < 0) return;
    onChange({
      ...state,
      drives: [...state.drives, { id: newId("dv"), startedAt: new Date().toISOString(), endedAt: null, startOdometerKm: o, startRangeKm: r, endOdometerKm: null, endRangeKm: null, startLocation: "", endLocation: "", purpose: "", notes: "", corrected: false }],
    });
    setOdo("");
    setRange("");
  };

  const end = () => {
    if (!open) return;
    const o = Number(endOdo);
    const r = Number(endRange);
    // Reject readings that would make the drive go backwards in odometer.
    if (endOdo === "" || endRange === "" || !Number.isFinite(o) || !Number.isFinite(r) || o < open.startOdometerKm || r < 0) return;
    onChange({
      ...state,
      drives: state.drives.map((d) => (d.id === open.id ? { ...d, endedAt: new Date().toISOString(), endOdometerKm: o, endRangeKm: r } : d)),
    });
    setEndOdo("");
    setEndRange("");
  };

  return (
    <div className="fuel-stack">
      {open ? (
        <section className="fuel-card fuel-form">
          <p className="fuel-muted">Drive in progress since {new Date(open.startedAt).toLocaleString()}</p>
          <p>Start: {km(open.startOdometerKm)} · range {km(open.startRangeKm)}</p>
          <label className="fuel-field"><span>End odometer (km)</span><input inputMode="numeric" value={endOdo} onChange={(e) => setEndOdo(e.target.value)} /></label>
          <label className="fuel-field"><span>End estimated range (km)</span><input inputMode="numeric" value={endRange} onChange={(e) => setEndRange(e.target.value)} /></label>
          <button type="button" className="fuel-cta" onClick={end}>End drive</button>
        </section>
      ) : (
        <section className="fuel-card fuel-form">
          <label className="fuel-field"><span>Start odometer (km)</span><input inputMode="numeric" value={odo} onChange={(e) => setOdo(e.target.value)} /></label>
          <label className="fuel-field"><span>Start estimated range (km)</span><input inputMode="numeric" value={range} onChange={(e) => setRange(e.target.value)} /></label>
          <button type="button" className="fuel-cta" onClick={start}>Start drive</button>
        </section>
      )}
      {closed.map((d) => {
        const m = driveMetrics({ odometerKm: d.startOdometerKm, rangeKm: d.startRangeKm }, { odometerKm: d.endOdometerKm ?? 0, rangeKm: d.endRangeKm ?? 0 });
        return (
          <article key={d.id} className="fuel-card">
            <p className="fuel-muted">{new Date(d.startedAt).toLocaleString()}</p>
            <p className="fuel-value">{km(m.distanceKm)}</p>
            <p className="fuel-note">Range used {km(m.rangeConsumedKm)} · total range Δ {km(m.totalRangeChangeKm)}</p>
          </article>
        );
      })}
    </div>
  );
}

function Analytics({ state }: { state: FuelState }) {
  const rows = state.stations.map((s) => {
    const refuels = state.refuels.filter((r) => r.stationId === s.id);
    const spend = refuels.reduce((sum, r) => sum + (r.total ?? 0), 0);
    const litres = refuels.reduce((sum, r) => sum + (r.litres ?? 0), 0);
    return { name: s.name, count: refuels.length, spend, avgPrice: litres > 0 ? spend / litres : null };
  });
  const cheapest = rows.filter((r) => r.avgPrice !== null).sort((a, b) => (a.avgPrice ?? 0) - (b.avgPrice ?? 0))[0];
  return (
    <div className="fuel-stack">
      <section className="fuel-card">
        <p className="fuel-muted">Cheapest average price per litre</p>
        <p className="fuel-value">{cheapest ? `${cheapest.name} · ${cheapest.avgPrice!.toFixed(3)} €/L` : "No priced refuels yet"}</p>
      </section>
      {rows.map((r) => (
        <div key={r.name} className="fuel-card fuel-stat">
          <p className="fuel-muted">{r.name} · {r.count} refuel{r.count === 1 ? "" : "s"}</p>
          <p className="fuel-value">{eur(r.spend)}</p>
          <p className="fuel-note">{r.avgPrice !== null ? `Average ${r.avgPrice.toFixed(3)} €/L` : "No litres recorded"}</p>
        </div>
      ))}
    </div>
  );
}

function History({ state }: { state: FuelState }) {
  const items = [
    ...state.refuels.map((r) => ({ key: r.id, at: r.dateTime ?? "", label: `Fuel · ${state.stations.find((s) => s.id === r.stationId)?.name ?? "Station"}`, detail: `${eur(r.total ?? 0)}${r.litres !== null ? ` · ${r.litres.toFixed(2)} L` : ""}${r.dateNote ? ` · ${r.dateNote}` : ""}`, source: r.source })),
    ...state.readings.map((r) => ({ key: r.id, at: r.dateTime ?? "", label: "Odometer reading", detail: `${km(r.odometerKm)} · range ${km(r.rangeKm)}${r.dateNote ? ` · ${r.dateNote}` : ""}`, source: r.source })),
    ...state.drives.flatMap((d) => [
      { key: `${d.id}-s`, at: d.startedAt, label: "Drive started", detail: `${km(d.startOdometerKm)} · range ${km(d.startRangeKm)}`, source: "manual" as const },
      ...(d.endedAt ? [{ key: `${d.id}-e`, at: d.endedAt, label: "Drive completed", detail: `${km(d.endOdometerKm ?? 0)} · range ${km(d.endRangeKm ?? 0)}`, source: "manual" as const }] : []),
    ]),
  ].sort((a, b) => (b.at || "").localeCompare(a.at || ""));
  return (
    <div className="fuel-stack">
      {items.map((i) => (
        <div key={i.key} className="fuel-card fuel-stat">
          <p className="fuel-muted">{i.label}{i.source === "seed" ? " · imported from Apple Notes" : ""}</p>
          <p className="fuel-value">{i.detail}</p>
        </div>
      ))}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="fuel-card fuel-stat">
      <p className="fuel-muted">{label}</p>
      <p className="fuel-value">{value}</p>
      {hint && <p className="fuel-note">{hint}</p>}
    </div>
  );
}

type Draft = { station: string; total: string; price: string; litres: string; odometer: string; full: boolean; notes: string };
const EMPTY_DRAFT: Draft = { station: "Emo", total: "", price: "", litres: "", odometer: "", full: false, notes: "" };

function RefuelForm({ state, onSave }: { state: FuelState; onSave: (r: Refuel) => void }) {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [last, setLast] = useState<[RefuelField, RefuelField] | null>(null);
  const [saved, setSaved] = useState(false);

  // Three-way calculator. The edited field stays fixed; the third is derived from the two most recent inputs.
  const setField = (field: RefuelField, value: string) => {
    const key = field;
    const next: Draft = { ...draft, [key]: value };
    const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));
    const other = last && last[0] !== field ? last[0] : last?.[1] !== field ? last?.[1] : undefined;
    const kept: RefuelField = other ?? (field === "total" ? "price" : "total");
    const solved = solveRefuel({ total: num(next.total), price: num(next.price), litres: num(next.litres) }, field, kept);
    setDraft({
      ...next,
      total: field === "total" ? value : solved.total?.toString() ?? next.total,
      price: field === "price" ? value : solved.price?.toString() ?? next.price,
      litres: field === "litres" ? value : solved.litres?.toString() ?? next.litres,
    });
    setLast([field, kept]);
  };

  const save = () => {
    const total = Number(draft.total.replace(",", "."));
    const price = Number(draft.price.replace(",", "."));
    const litres = Number(draft.litres.replace(",", "."));
    const odometerKm = draft.odometer === "" ? null : Number(draft.odometer);
    if (!(total > 0) || !(litres > 0)) return;
    const stationId = state.stations.find((s) => s.name === draft.station)?.id ?? state.stations[0]?.id ?? "";
    onSave({
      id: newId("rf"),
      stationId,
      dateTime: new Date().toISOString(),
      dateNote: null,
      fuelType: "Diesel",
      total,
      price: Number.isFinite(price) ? price : null,
      litres,
      odometerKm,
      rangeBeforeKm: null,
      rangeAfterKm: null,
      full: draft.full,
      notes: draft.notes,
      verified: true,
      source: "manual",
      corrected: false,
    });
    setDraft(EMPTY_DRAFT);
    setLast(null);
    setSaved(true);
  };

  return (
    <div className="fuel-stack">
      <section className="fuel-card fuel-form">
        <label className="fuel-field">
          <span>Total (€)</span>
          <input inputMode="decimal" value={draft.total} onChange={(e) => setField("total", e.target.value)} />
        </label>
        <label className="fuel-field">
          <span>Price per litre (€)</span>
          <input inputMode="decimal" value={draft.price} onChange={(e) => setField("price", e.target.value)} />
        </label>
        <label className="fuel-field">
          <span>Litres</span>
          <input inputMode="decimal" value={draft.litres} onChange={(e) => setField("litres", e.target.value)} />
        </label>
        <label className="fuel-field">
          <span>Odometer (km)</span>
          <input inputMode="numeric" value={draft.odometer} onChange={(e) => setDraft({ ...draft, odometer: e.target.value })} />
        </label>
        <label className="fuel-field">
          <span>Station</span>
          <select value={draft.station} onChange={(e) => setDraft({ ...draft, station: e.target.value })}>
            {state.stations.map((s) => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="fuel-check">
          <input type="checkbox" checked={draft.full} onChange={(e) => setDraft({ ...draft, full: e.target.checked })} />
          <span>Full tank</span>
        </label>
        <button type="button" className="fuel-cta" onClick={save}>Save refuel</button>
        {saved && <p className="fuel-note">Saved.</p>}
      </section>
    </div>
  );
}
