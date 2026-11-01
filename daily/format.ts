import type { WeightUnit } from "./model";

const numberFmt = new Intl.NumberFormat("en-IE");
const oneDecimalFmt = new Intl.NumberFormat("en-IE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const twoDecimalFmt = new Intl.NumberFormat("en-IE", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function formatInt(value: number): string {
  return numberFmt.format(Math.round(value));
}

export function formatCalories(value: number): string {
  return `${formatInt(value)} kcal`;
}

export function formatSteps(value: number): string {
  return `${formatInt(value)} steps`;
}

/** Whole minutes as "7h 15m" (or "45m" / "8h"). */
export function formatDuration(totalMinutes: number): string {
  const minutes = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatHoursDecimal(totalMinutes: number): string {
  return `${oneDecimalFmt.format(totalMinutes / 60)} h`;
}

export function minutesToInput(totalMinutes: number | null): { hours: string; minutes: string } {
  if (totalMinutes === null) return { hours: "", minutes: "" };
  return { hours: String(Math.floor(totalMinutes / 60)), minutes: String(totalMinutes % 60) };
}

/** Millilitres below one litre stay in millilitres so small sips stay precise. */
export function formatWater(ml: number): string {
  if (ml < 1_000) return `${formatInt(ml)} ml`;
  return `${(ml / 1_000).toFixed(2).replace(/\.?0+$/, "")} L`;
}

export function formatLitres(ml: number): string {
  return `${(ml / 1_000).toFixed(1)} L`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

export function kgToUnit(kg: number, unit: WeightUnit): number {
  return unit === "lb" ? kg * 2.2046226218 : kg;
}

export function unitToKg(value: number, unit: WeightUnit): number {
  return unit === "lb" ? value / 2.2046226218 : value;
}

export function formatWeight(kg: number, unit: WeightUnit): string {
  const value = kgToUnit(kg, unit);
  return `${twoDecimalFmt.format(value)} ${unit}`;
}

export function formatWeightChange(deltaKg: number, unit: WeightUnit): string {
  const value = kgToUnit(deltaKg, unit);
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${twoDecimalFmt.format(Math.abs(value))} ${unit}`;
}

export function formatSleep(value: number): string {
  return formatDuration(value);
}
