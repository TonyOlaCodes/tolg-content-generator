"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  addWater,
  addWeight,
  deleteHighlight,
  deleteWater,
  deleteWeight,
  mergeChanges,
  saveHighlight,
  setDayMetric,
  setDayMetrics,
  updateWater,
  type Result,
} from "@/daily/actions";
import { weightsForDate, waterTotalForDate } from "@/daily/logic";
import { dayLabel } from "@/daily/date";
import { formatDuration, formatWater, formatWeight, kgToUnit, unitToKg } from "@/daily/format";
import { METRIC_META, type Highlight } from "@/daily/model";
import { ProgressBar, ProgressRing } from "./charts";
import { shrinkPhoto } from "./photo";
import { parseDecimal, parseWhole, uiCtx, type DailyApi } from "./api";

/* ------------------------------------------------------------- primitives */

function SheetShell({
  title,
  kicker,
  onClose,
  children,
  footer,
}: {
  title: string;
  kicker: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="daily-sheet-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="daily-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="daily-sheet-grip" aria-hidden />
        <header className="daily-sheet-head">
          <div className="daily-sheet-title">
            <p className="daily-sheet-kicker">{kicker}</p>
            <h2>{title}</h2>
          </div>
          <button type="button" className="daily-icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        <div className="daily-sheet-body">{children}</div>
        {footer ? <div className="daily-sheet-foot">{footer}</div> : null}
      </div>
    </div>
  );
}

function useSaving() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const run = async (task: () => Promise<string | null>): Promise<boolean> => {
    setBusy(true);
    setError(null);
    const message = await task();
    setBusy(false);
    if (message) {
      setError(message);
      return false;
    }
    return true;
  };
  return { error, setError, busy, run };
}

function ErrorLine({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="daily-error" role="alert">
      {message}
    </p>
  );
}

function NumberField({
  label,
  value,
  onChange,
  suffix,
  inputMode = "numeric",
  placeholder,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  inputMode?: "numeric" | "decimal";
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="daily-field">
      <span>{label}</span>
      <span className="daily-input-wrap">
        <input
          className="daily-input"
          type="text"
          inputMode={inputMode}
          enterKeyHint="done"
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholder}
          value={value}
          autoFocus={autoFocus}
          onChange={(event) => onChange(event.target.value)}
        />
        {suffix ? <em className="daily-input-suffix">{suffix}</em> : null}
      </span>
    </label>
  );
}

function MetricHeader({ metric, value, sub, percent }: { metric: keyof typeof METRIC_META; value: string; sub: string; percent?: number | null }) {
  const meta = METRIC_META[metric];
  return (
    <div className="daily-sheet-metric">
      <ProgressRing percent={percent ?? null} color={meta.ring} size={78} stroke={8}>
        <span className="daily-ring-value-text">{value}</span>
      </ProgressRing>
      <div>
        <p className="daily-sheet-kicker">{meta.label}</p>
        <p className="daily-sheet-sub">{sub}</p>
      </div>
    </div>
  );
}

function timeOfEntry(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function numberInput(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/* ----------------------------------------------------------------- steps */

export function StepsSheet({ api, onClose }: { api: DailyApi; onClose: () => void }) {
  const date = api.selected;
  const day = api.snap.days.find((d) => d.date === date) ?? null;
  const [value, setValue] = useState(day?.steps !== null && day?.steps !== undefined ? String(day.steps) : "");
  const { error, setError, busy, run } = useSaving();
  const goalValue = api.settings.stepGoal;

  const save = async () => {
    const trimmed = value.trim();
    let next: number | null = null;
    if (trimmed) {
      const parsed = parseWhole(trimmed);
      if (parsed === null) return setError("Enter steps as a whole number, or leave it blank to clear the entry.");
      next = parsed;
    }
    const result = setDayMetric(api.snap, date, "steps", next, uiCtx(api.today));
    const ok = await run(() => api.commit(result, next === null ? "Steps entry cleared" : "Steps saved"));
    if (ok) onClose();
  };

  const hasEntry = day?.steps !== null && day?.steps !== undefined;
  const percent = hasEntry && goalValue > 0 ? (day!.steps! / goalValue) * 100 : null;

  return (
    <SheetShell
      title="Steps"
      kicker={dayLabel(date, api.today)}
      onClose={onClose}
      footer={
        <>
          <ErrorLine message={error} />
          <div className="daily-sheet-actions">
            {hasEntry ? (
              <button
                type="button"
                className="daily-btn-ghost"
                disabled={busy}
                onClick={async () => {
                  setValue("");
                  const result = setDayMetric(api.snap, date, "steps", null, uiCtx(api.today));
                  const ok = await run(() => api.commit(result, "Steps entry cleared"));
                  if (ok) onClose();
                }}
              >
                Remove entry
              </button>
            ) : null}
            <button type="button" className="daily-btn-primary" disabled={busy} onClick={() => void save()}>
              Save steps
            </button>
          </div>
        </>
      }
    >
      <MetricHeader
        metric="steps"
        value={hasEntry ? day!.steps!.toLocaleString() : "—"}
        sub={percent !== null ? `${Math.round(percent)}% of ${goalValue.toLocaleString()} goal` : "No goal comparison yet"}
        percent={percent}
      />
      <NumberField
        label="Total steps for this day"
        value={value}
        onChange={setValue}
        inputMode="numeric"
        placeholder="e.g. 7450"
      />
      <p className="daily-hint">
        Leave blank and save to mark this day as not recorded. Zero is kept as a real value. Your step goal is changed in Settings.
      </p>
    </SheetShell>
  );
}

/* -------------------------------------------------------------- calories */

export function CaloriesSheet({ api, onClose }: { api: DailyApi; onClose: () => void }) {
  const date = api.selected;
  const day = api.snap.days.find((d) => d.date === date) ?? null;
  const [value, setValue] = useState(day?.calories !== null && day?.calories !== undefined ? String(day.calories) : "");
  const { error, setError, busy, run } = useSaving();

  const save = async () => {
    const trimmed = value.trim();
    let next: number | null = null;
    if (trimmed) {
      const parsed = parseWhole(trimmed);
      if (parsed === null) return setError("Enter calories as a whole number, or leave it blank to clear the entry.");
      next = parsed;
    }
    const result = setDayMetric(api.snap, date, "calories", next, uiCtx(api.today));
    const ok = await run(() => api.commit(result, next === null ? "Calories entry cleared" : "Calories saved"));
    if (ok) onClose();
  };

  const hasEntry = day?.calories !== null && day?.calories !== undefined;
  const goalValue = api.settings.calorieGoal;
  const percent = hasEntry && goalValue ? (day!.calories! / goalValue) * 100 : null;

  return (
    <SheetShell
      title="Calories"
      kicker={dayLabel(date, api.today)}
      onClose={onClose}
      footer={
        <>
          <ErrorLine message={error} />
          <div className="daily-sheet-actions">
            {hasEntry ? (
              <button
                type="button"
                className="daily-btn-ghost"
                disabled={busy}
                onClick={async () => {
                  const result = setDayMetric(api.snap, date, "calories", null, uiCtx(api.today));
                  const ok = await run(() => api.commit(result, "Calories entry cleared"));
                  if (ok) onClose();
                }}
              >
                Remove entry
              </button>
            ) : null}
            <button type="button" className="daily-btn-primary" disabled={busy} onClick={() => void save()}>
              Save calories
            </button>
          </div>
        </>
      }
    >
      <MetricHeader
        metric="calories"
        value={hasEntry ? day!.calories!.toLocaleString() : "—"}
        sub={
          goalValue === null
            ? "No daily goal set — optional"
            : percent !== null
              ? `${Math.round(percent)}% of ${goalValue.toLocaleString()} kcal goal`
              : `Goal ${goalValue.toLocaleString()} kcal`
        }
        percent={percent}
      />
      <NumberField
        label="Total calories for this day"
        value={value}
        onChange={setValue}
        inputMode="numeric"
        placeholder="e.g. 3450"
      />
      <p className="daily-hint">
        One total per day. This app is not a food diary and has nothing to do with Groceries &amp; Pantry. Your calorie goal is changed in
        Settings.
      </p>
    </SheetShell>
  );
}

/* ----------------------------------------------------------------- sleep */

export function SleepSheet({ api, onClose }: { api: DailyApi; onClose: () => void }) {
  const date = api.selected;
  const day = api.snap.days.find((d) => d.date === date) ?? null;
  const [hours, setHours] = useState(day?.sleepMinutes != null ? String(Math.floor(day.sleepMinutes / 60)) : "");
  const [minutes, setMinutes] = useState(day?.sleepMinutes != null ? String(day.sleepMinutes % 60) : "");
  const { error, setError, busy, run } = useSaving();

  const totalMinutes = (() => {
    const h = hours.trim() ? parseWhole(hours) : 0;
    const m = minutes.trim() ? parseWhole(minutes) : 0;
    if (h === null || m === null) return null;
    return h * 60 + m;
  })();

  const save = async () => {
    const h = hours.trim() ? parseWhole(hours) : 0;
    const m = minutes.trim() ? parseWhole(minutes) : 0;
    if (h === null || m === null) return setError("Enter sleep as whole hours and minutes.");
    if (m > 59) return setError("Minutes must be between 0 and 59.");
    const blank = !hours.trim() && !minutes.trim();
    const next = blank ? null : h * 60 + m;
    const result = setDayMetric(api.snap, date, "sleepMinutes", next, uiCtx(api.today));
    const ok = await run(() => api.commit(result, next === null ? "Sleep entry cleared" : "Sleep saved"));
    if (ok) onClose();
  };

  const hasEntry = day?.sleepMinutes !== null && day?.sleepMinutes !== undefined;

  return (
    <SheetShell
      title="Sleep"
      kicker={dayLabel(date, api.today)}
      onClose={onClose}
      footer={
        <>
          <ErrorLine message={error} />
          <div className="daily-sheet-actions">
            {hasEntry ? (
              <button
                type="button"
                className="daily-btn-ghost"
                disabled={busy}
                onClick={async () => {
                  setHours("");
                  setMinutes("");
                  const result = setDayMetric(api.snap, date, "sleepMinutes", null, uiCtx(api.today));
                  const ok = await run(() => api.commit(result, "Sleep entry cleared"));
                  if (ok) onClose();
                }}
              >
                Remove entry
              </button>
            ) : null}
            <button type="button" className="daily-btn-primary" disabled={busy} onClick={() => void save()}>
              Save sleep
            </button>
          </div>
        </>
      }
    >
      <MetricHeader
        metric="sleep"
        value={hasEntry ? formatDuration(day!.sleepMinutes!) : "—"}
        sub={totalMinutes !== null && totalMinutes > 0 ? `${(totalMinutes / 60).toFixed(1)} hours logged` : "No bedtime or wake time needed"}
        percent={null}
      />
      <div className="daily-grid2">
        <NumberField label="Hours" value={hours} onChange={setHours} suffix="h" placeholder="7" />
        <NumberField label="Minutes" value={minutes} onChange={setMinutes} suffix="m" placeholder="15" />
      </div>
      <p className="daily-hint">Total time slept is enough. Bedtimes and wake-up times are never required.</p>
    </SheetShell>
  );
}

/* ----------------------------------------------------------------- water */

export function WaterSheet({ api, onClose }: { api: DailyApi; onClose: () => void }) {
  const date = api.selected;
  const total = waterTotalForDate(api.snap, date);
  const goal = api.settings.waterGoalMl;
  const entries = api.snap.water
    .filter((w) => w.date === date)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  const [custom, setCustom] = useState("");
  const [customUnit, setCustomUnit] = useState<"ml" | "L">("ml");
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);
  const { error, setError, busy, run } = useSaving();

  const add = async (ml: number) => {
    if (ml <= 0) return setError("Enter an amount above zero.");
    const result = addWater(api.snap, { date, ml }, uiCtx(api.today));
    await run(() => api.commit(result, `Added ${formatWater(ml)}`));
  };

  const percent = goal > 0 ? ((total ?? 0) / goal) * 100 : null;

  return (
    <SheetShell
      title="Water"
      kicker={dayLabel(date, api.today)}
      onClose={onClose}
      footer={
        <>
          <ErrorLine message={error} />
          <button type="button" className="daily-btn-primary" disabled={busy} onClick={onClose}>
            Done
          </button>
        </>
      }
    >
      <div className="daily-water-head">
        <div>
          <p className="daily-sheet-kicker">Today</p>
          <p className="daily-water-value">
            {total === null ? "—" : formatWater(total)}
            <span> / {formatWater(goal)}</span>
          </p>
        </div>
        <p className="daily-water-percent">{percent === null ? "No entries yet" : `${Math.round(percent)}%`}</p>
      </div>
      <ProgressBar percent={percent} color={METRIC_META.water.ring} label="Water progress" />

      <div className="daily-quick-row">
        {[250, 500, 1000].map((ml) => (
          <button key={ml} type="button" className="daily-quick" disabled={busy} onClick={() => void add(ml)}>
            +{ml >= 1000 ? `${ml / 1000} L` : `${ml} ml`}
          </button>
        ))}
      </div>
      <div className="daily-grid2">
        <NumberField
          label="Custom amount"
          value={custom}
          onChange={setCustom}
          inputMode={customUnit === "L" ? "decimal" : "numeric"}
          suffix={customUnit}
          placeholder={customUnit === "L" ? "e.g. 0.5" : "e.g. 330"}
        />
        <div className="daily-field daily-field-action">
          <span>&nbsp;</span>
          <button
            type="button"
            className="daily-btn-ghost"
            disabled={busy}
            onClick={() => {
              const parsed = parseDecimal(custom);
              if (parsed === null) return setError(`Enter an amount in ${customUnit === "L" ? "litres" : "millilitres"}.`);
              const ml = customUnit === "L" ? Math.round(parsed * 1000) : Math.round(parsed);
              setCustom("");
              void add(ml);
            }}
          >
            Add
          </button>
        </div>
      </div>
      <button
        type="button"
        className="daily-link"
        onClick={() => {
          setCustom("");
          setError(null);
          setCustomUnit((unit) => (unit === "ml" ? "L" : "ml"));
        }}
      >
        {customUnit === "ml" ? "Enter litres instead" : "Enter millilitres instead"}
      </button>

      <div className="daily-block">
        <p className="daily-block-title">Entries today</p>
        {entries.length === 0 ? (
          <p className="daily-hint">No water logged for this day yet. A day with no entry stays missing, not zero.</p>
        ) : (
          <ul className="daily-list">
            {entries.map((entry) => (
              <li key={entry.id} className="daily-list-row">
                {editing?.id === entry.id ? (
                  <>
                    <input
                      className="daily-input daily-input-inline"
                      type="text"
                      inputMode="numeric"
                      value={editing.value}
                      onChange={(event) => setEditing({ id: entry.id, value: event.target.value })}
                      aria-label="Edit water amount in millilitres"
                    />
                    <button
                      type="button"
                      className="daily-link"
                      disabled={busy}
                      onClick={() => {
                        const parsed = parseWhole(editing.value);
                        if (parsed === null) return setError("Enter an amount in millilitres.");
                        const result = updateWater(api.snap, entry.id, parsed);
                        void run(async () => {
                          const message = await api.commit(result, "Water entry updated");
                          if (!message) setEditing(null);
                          return message;
                        });
                      }}
                    >
                      Save
                    </button>
                    <button type="button" className="daily-link" onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span className="daily-list-main">
                      <strong>{formatWater(entry.ml)}</strong>
                      <em>{timeOfEntry(entry.createdAt)}</em>
                    </span>
                    <button
                      type="button"
                      className="daily-link"
                      onClick={() => setEditing({ id: entry.id, value: String(entry.ml) })}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="daily-link is-danger"
                      disabled={busy}
                      onClick={() => void run(() => api.commit(deleteWater(api.snap, entry.id), "Water entry removed"))}
                      aria-label={`Delete ${formatWater(entry.ml)} entry`}
                    >
                      Delete
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="daily-hint">Your daily water goal is changed in Settings.</p>
    </SheetShell>
  );
}

/* ---------------------------------------------------------------- weight */

export function WeightSheet({ api, onClose }: { api: DailyApi; onClose: () => void }) {
  const date = api.selected;
  const unit = api.settings.weightUnit;
  const existing = weightsForDate(api.snap, date)[0] ?? null;
  const [value, setValue] = useState(existing ? numberInput(kgToUnit(existing.kg, unit)) : "");
  const { error, setError, busy, run } = useSaving();

  const submit = async () => {
    const parsed = parseDecimal(value);
    if (parsed === null) return setError(`Enter a weight in ${unit}.`);
    const result = addWeight(api.snap, { date, kg: unitToKg(parsed, unit) }, uiCtx(api.today));
    const ok = await run(() => api.commit(result, existing ? "Weigh-in updated" : "Weigh-in saved"));
    if (ok) onClose();
  };

  const remove = async () => {
    if (!existing) return;
    const ok = await run(() => api.commit(deleteWeight(api.snap, existing.id), "Weigh-in removed"));
    if (ok) onClose();
  };

  return (
    <SheetShell
      title="Bodyweight"
      kicker={dayLabel(date, api.today)}
      onClose={onClose}
      footer={
        <>
          <ErrorLine message={error} />
          <div className="daily-sheet-actions">
            {existing ? (
              <button type="button" className="daily-btn-ghost" disabled={busy} onClick={() => void remove()}>
                Remove
              </button>
            ) : null}
            <button type="button" className="daily-btn-primary" disabled={busy} onClick={() => void submit()}>
              {existing ? "Update weigh-in" : "Save weigh-in"}
            </button>
          </div>
        </>
      }
    >
      <p className="daily-hint">One weigh-in per day. Weigh whenever you like — there is no daily requirement.</p>
      <p className="daily-hint">
        {api.settings.weightGoalKg === null
          ? "No weight goal set. Add one in Settings."
          : `Goal ${formatWeight(api.settings.weightGoalKg, unit)} — change it in Settings.`}
      </p>
      <NumberField
        label={`Weight (${unit})`}
        value={value}
        onChange={setValue}
        inputMode="decimal"
        placeholder={unit === "kg" ? "78.2" : "172.4"}
      />
      {existing ? (
        <p className="daily-hint">
          Currently {formatWeight(existing.kg, unit)}. Saving replaces this day&apos;s weigh-in; Remove clears it.
        </p>
      ) : null}
    </SheetShell>
  );
}

/* ------------------------------------------------------------- quick log */

export function QuickLogSheet({ api, onClose }: { api: DailyApi; onClose: () => void }) {
  const date = api.selected;
  const day = api.snap.days.find((d) => d.date === date) ?? null;
  const unit = api.settings.weightUnit;
  const dayWeight = weightsForDate(api.snap, date)[0] ?? null;
  const [steps, setSteps] = useState(day?.steps != null ? String(day.steps) : "");
  const [calories, setCalories] = useState(day?.calories != null ? String(day.calories) : "");
  const [hours, setHours] = useState(day?.sleepMinutes != null ? String(Math.floor(day.sleepMinutes / 60)) : "");
  const [minutes, setMinutes] = useState(day?.sleepMinutes != null ? String(day.sleepMinutes % 60) : "");
  const [water, setWater] = useState("");
  const [weight, setWeight] = useState(dayWeight ? numberInput(kgToUnit(dayWeight.kg, unit)) : "");
  const { error, setError, busy, run } = useSaving();

  const save = async () => {
    const results: Result[] = [];
    const patch: { steps?: number; calories?: number; sleepMinutes?: number } = {};

    if (steps.trim()) {
      const parsed = parseWhole(steps);
      if (parsed === null) return setError("Steps must be a whole number.");
      patch.steps = parsed;
    }
    if (calories.trim()) {
      const parsed = parseWhole(calories);
      if (parsed === null) return setError("Calories must be a whole number.");
      patch.calories = parsed;
    }
    if (hours.trim() || minutes.trim()) {
      const h = hours.trim() ? parseWhole(hours) : 0;
      const m = minutes.trim() ? parseWhole(minutes) : 0;
      if (h === null || m === null) return setError("Sleep must use whole hours and minutes.");
      if (m > 59) return setError("Sleep minutes must be between 0 and 59.");
      patch.sleepMinutes = h * 60 + m;
    }
    if (Object.keys(patch).length) results.push(setDayMetrics(api.snap, date, patch, uiCtx(api.today)));

    if (water.trim()) {
      const ml = parseWhole(water);
      if (ml === null || ml <= 0) return setError("Water must be a whole number of millilitres above zero.");
      results.push(addWater(api.snap, { date, ml }, uiCtx(api.today)));
    }
    if (weight.trim()) {
      const parsed = parseDecimal(weight);
      if (parsed === null) return setError(`Weight must be a number in ${unit}.`);
      results.push(addWeight(api.snap, { date, kg: unitToKg(parsed, unit) }, uiCtx(api.today)));
    }

    if (results.length === 0) return setError("Enter at least one value to save.");
    const merged = mergeChanges(results);
    const ok = await run(() => api.commit(merged, "Day saved"));
    if (ok) onClose();
  };

  return (
    <SheetShell
      title="Log this day"
      kicker={dayLabel(date, api.today)}
      onClose={onClose}
      footer={
        <>
          <ErrorLine message={error} />
          <button type="button" className="daily-btn-primary" disabled={busy} onClick={() => void save()}>
            Save all
          </button>
        </>
      }
    >
      <p className="daily-hint">
        Fill in only what you have. Blank rows are left untouched, and you can still edit each metric on its own card.
      </p>
      <div className="daily-grid2">
        <NumberField label="Steps" value={steps} onChange={setSteps} inputMode="numeric" placeholder="—" />
        <NumberField label="Calories" value={calories} onChange={setCalories} inputMode="numeric" suffix="kcal" placeholder="—" />
      </div>
      <div className="daily-grid2">
        <NumberField label="Sleep hours" value={hours} onChange={setHours} suffix="h" placeholder="—" />
        <NumberField label="Sleep minutes" value={minutes} onChange={setMinutes} suffix="m" placeholder="—" />
      </div>
      <div className="daily-grid2">
        <NumberField label="Add water" value={water} onChange={setWater} suffix="ml" placeholder="e.g. 500" />
        <NumberField
          label={`Weight (${unit})`}
          value={weight}
          onChange={setWeight}
          inputMode="decimal"
          placeholder="—"
        />
      </div>
      <p className="daily-hint">One weigh-in per day — saving a new weight replaces that day&apos;s value.</p>
    </SheetShell>
  );
}

/* -------------------------------------------------------------- highlight */

export function HighlightSheet({
  api,
  highlight,
  onClose,
}: {
  api: DailyApi;
  highlight: Highlight | null;
  onClose: () => void;
}) {
  const date = highlight?.date ?? api.selected;
  const [title, setTitle] = useState(highlight?.title ?? "");
  const [description, setDescription] = useState(highlight?.description ?? "");
  const [tags, setTags] = useState(highlight?.tags.join(", ") ?? "");
  const [photo, setPhoto] = useState<string | null>(highlight?.photo ?? null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { error, setError, busy, run } = useSaving();

  const save = async () => {
    const result = saveHighlight(
      api.snap,
      {
        id: highlight?.id,
        date,
        title,
        description,
        tags: tags.split(","),
        photo,
      },
      uiCtx(api.today),
    );
    const ok = await run(() => api.commit(result, highlight ? "Highlight updated" : "Highlight saved"));
    if (ok) onClose();
  };

  return (
    <SheetShell
      title={highlight ? "Edit highlight" : "Add highlight"}
      kicker={dayLabel(date, api.today)}
      onClose={onClose}
      footer={
        <>
          <ErrorLine message={error} />
          <div className="daily-sheet-actions">
            {highlight ? (
              <button
                type="button"
                className="daily-btn-ghost is-danger"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm("Delete this highlight? The photo will be removed too.")) return;
                  void run(async () => {
                    const message = await api.commit(deleteHighlight(api.snap, highlight.id), "Highlight deleted");
                    if (!message) onClose();
                    return message;
                  });
                }}
              >
                Delete
              </button>
            ) : null}
            <button type="button" className="daily-btn-primary" disabled={busy} onClick={() => void save()}>
              {highlight ? "Save changes" : "Save highlight"}
            </button>
          </div>
        </>
      }
    >
      <p className="daily-hint">
        Optional and always your choice — for a milestone or a memorable day. There are no daily notes or prompts.
      </p>
      <label className="daily-field">
        <span>Title</span>
        <span className="daily-input-wrap">
          <input
            className="daily-input"
            type="text"
            maxLength={80}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. First 10k run"
          />
        </span>
      </label>
      <label className="daily-field">
        <span>Description (optional)</span>
        <span className="daily-input-wrap">
          <textarea
            className="daily-input daily-textarea"
            maxLength={500}
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="A short note, if you want one."
          />
        </span>
      </label>
      <label className="daily-field">
        <span>Tags (optional, comma separated)</span>
        <span className="daily-input-wrap">
          <input
            className="daily-input"
            type="text"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="running, milestone"
          />
        </span>
      </label>
      <div className="daily-field">
        <span>Photo (optional)</span>
        {photo ? (
          <div className="daily-photo-preview">
            {/* Local data URL only; never uploaded. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="Highlight photo preview" />
            <button type="button" className="daily-link is-danger" onClick={() => setPhoto(null)}>
              Remove photo
            </button>
          </div>
        ) : (
          <button type="button" className="daily-btn-ghost" disabled={photoBusy} onClick={() => fileRef.current?.click()}>
            {photoBusy ? "Processing…" : "Choose a photo"}
          </button>
        )}
        <input
          ref={fileRef}
          className="daily-sr-only"
          type="file"
          accept="image/*"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            setPhotoBusy(true);
            setError(null);
            try {
              setPhoto(await shrinkPhoto(file));
            } catch (photoError) {
              setError(photoError instanceof Error ? photoError.message : "That photo could not be read.");
            } finally {
              setPhotoBusy(false);
            }
          }}
        />
        <p className="daily-hint">Photos are downsized and kept in this device&apos;s storage only.</p>
      </div>
    </SheetShell>
  );
}
