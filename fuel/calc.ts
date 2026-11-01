/**
 * Pure fuel calculations. No React, no storage, no I/O.
 * Estimated range (the car's own display) is never treated as measured fuel.
 */

export type RefuelField = "total" | "price" | "litres";

export interface RefuelAmounts {
  total: number | null;
  price: number | null;
  litres: number | null;
}

const round = (value: number, digits: number) => {
  const f = 10 ** digits;
  return Math.round((value + Number.EPSILON) * f) / f;
};

const isPositive = (v: number | null): v is number =>
  v !== null && Number.isFinite(v) && v > 0;

const ALL_FIELDS: RefuelField[] = ["total", "price", "litres"];

/**
 * Three-way calculator: Total = Price × Litres.
 * `edited` is the field the user just typed. `other` is the second field the
 * user specified most recently. Both stay fixed; the third is derived.
 */
export function solveRefuel(
  current: RefuelAmounts,
  edited: RefuelField,
  other: RefuelField,
): RefuelAmounts {
  const next = { ...current };
  const target = ALL_FIELDS.find((f) => f !== edited && f !== other)!;

  if (target === "total" && isPositive(next.price) && isPositive(next.litres)) {
    next.total = round(next.price * next.litres, 2);
  } else if (target === "price" && isPositive(next.total) && isPositive(next.litres)) {
    next.price = round(next.total / next.litres, 4);
  } else if (target === "litres" && isPositive(next.total) && isPositive(next.price)) {
    next.litres = round(next.total / next.price, 2);
  }
  return next;
}

/** Estimated total reach = odometer + estimated remaining range (sum only). */
export function estimatedReach(odometerKm: number, rangeKm: number): number {
  return odometerKm + rangeKm;
}

export interface DriveMetrics {
  distanceKm: number;
  rangeConsumedKm: number;
  /** Distance ÷ range consumed. Null when no range was consumed. */
  rangeEfficiency: number | null;
  /** Change in (odometer + estimated range). Diagnostic, not fuel. */
  totalRangeChangeKm: number;
}

export function driveMetrics(
  start: { odometerKm: number; rangeKm: number },
  end: { odometerKm: number; rangeKm: number },
): DriveMetrics {
  const distanceKm = end.odometerKm - start.odometerKm;
  const rangeConsumedKm = start.rangeKm - end.rangeKm;
  return {
    distanceKm,
    rangeConsumedKm,
    rangeEfficiency: rangeConsumedKm > 0 ? round(distanceKm / rangeConsumedKm, 3) : null,
    totalRangeChangeKm: end.odometerKm + end.rangeKm - (start.odometerKm + start.rangeKm),
  };
}

export interface FullRefuel {
  id: string;
  odometerKm: number;
  litres: number;
  total: number;
  full: boolean;
}

export interface Interval {
  fromId: string;
  toId: string;
  distanceKm: number;
  /** Litres added after the first full tank, up to and including the second full tank. */
  litres: number;
  cost: number;
  l100km: number;
  costPerKm: number;
}

/**
 * Measured consumption uses only valid consecutive full-to-full intervals.
 * Refuels between the two full tanks (partial ones) contribute their litres
 * and cost. An interval is invalid if odometer does not increase.
 * `refuels` must be sorted by odometer ascending.
 */
export function fullToFullIntervals(refuels: FullRefuel[]): Interval[] {
  const fulls = refuels.map((r, i) => ({ r, i })).filter(({ r }) => r.full);
  const out: Interval[] = [];
  for (let k = 0; k + 1 < fulls.length; k++) {
    const a = fulls[k];
    const b = fulls[k + 1];
    const distanceKm = b.r.odometerKm - a.r.odometerKm;
    if (distanceKm <= 0) continue;
    const between = refuels.slice(a.i + 1, b.i + 1);
    const litres = between.reduce((s, r) => s + r.litres, 0);
    const cost = between.reduce((s, r) => s + r.total, 0);
    if (litres <= 0) continue;
    out.push({
      fromId: a.r.id,
      toId: b.r.id,
      distanceKm,
      litres: round(litres, 2),
      cost: round(cost, 2),
      l100km: round((litres / distanceKm) * 100, 2),
      costPerKm: round(cost / distanceKm, 4),
    });
  }
  return out;
}

export function confidenceFor(validIntervals: number): { label: string; level: "none" | "limited" | "good" } {
  if (validIntervals === 0) return { label: "No verified intervals yet", level: "none" };
  if (validIntervals < 3) {
    return {
      label: `Limited data · based on ${validIntervals} valid full-to-full interval${validIntervals === 1 ? "" : "s"}`,
      level: "limited",
    };
  }
  return { label: `Based on ${validIntervals} valid full-to-full intervals`, level: "good" };
}
