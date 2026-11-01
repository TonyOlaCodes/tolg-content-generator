import { SEED_PURCHASES, SEED_VERSION } from "./seed";

/**
 * Local-only persistence. There is no account and no server sync.
 * Every read is validated; a corrupted value is discarded, not partially used.
 */

const KEY = "fuel.state.v1";

export interface Vehicle {
  nickname: string;
  make: string;
  year: number;
  engine: string;
  fuelType: string;
  currency: "EUR";
  distanceUnit: "km";
  consumptionUnit: "L/100km";
  tankCapacityL: number | null;
  referenceL100km: number | null;
  monthlyBudget: number | null;
}

export interface Station {
  id: string;
  name: string;
  branch: string;
}

export interface Refuel {
  id: string;
  stationId: string;
  dateTime: string | null;
  dateNote: string | null;
  fuelType: string;
  total: number | null;
  price: number | null;
  litres: number | null;
  odometerKm: number | null;
  rangeBeforeKm: number | null;
  rangeAfterKm: number | null;
  full: boolean;
  notes: string;
  verified: boolean;
  source: "manual" | "seed";
  corrected: boolean;
}

export interface Reading {
  id: string;
  dateTime: string | null;
  dateNote: string | null;
  odometerKm: number;
  rangeKm: number;
  note: string;
  source: "manual" | "seed";
  refuelId: string | null;
}

export interface Drive {
  id: string;
  startedAt: string;
  endedAt: string | null;
  startOdometerKm: number;
  startRangeKm: number;
  endOdometerKm: number | null;
  endRangeKm: number | null;
  startLocation: string;
  endLocation: string;
  purpose: string;
  notes: string;
  corrected: boolean;
}

export interface FuelState {
  version: 1;
  seedVersion: number | null;
  vehicle: Vehicle;
  stations: Station[];
  refuels: Refuel[];
  readings: Reading[];
  drives: Drive[];
}

export const DEFAULT_VEHICLE: Vehicle = {
  nickname: "Yaris",
  make: "Toyota Yaris",
  year: 2008,
  engine: "1.4 D-4D",
  fuelType: "Diesel",
  currency: "EUR",
  distanceUnit: "km",
  consumptionUnit: "L/100km",
  tankCapacityL: null,
  referenceL100km: null,
  monthlyBudget: null,
};

export const EMPTY_STATE: FuelState = {
  version: 1,
  seedVersion: null,
  vehicle: DEFAULT_VEHICLE,
  stations: [],
  refuels: [],
  readings: [],
  drives: [],
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const isStrOrNull = (v: unknown): v is string | null => v === null || typeof v === "string";
const isNumOrNull = (v: unknown): v is number | null => v === null || isNum(v);

/** Validates a parsed state. Returns null when the shape is wrong. */
export function parseState(raw: unknown): FuelState | null {
  if (!isObj(raw) || raw.version !== 1) return null;
  if (!Array.isArray(raw.stations) || !Array.isArray(raw.refuels)) return null;
  if (!Array.isArray(raw.readings) || !Array.isArray(raw.drives)) return null;
  if (!isObj(raw.vehicle)) return null;
  const v = raw.vehicle;
  const vehicle: Vehicle = {
    ...DEFAULT_VEHICLE,
    nickname: typeof v.nickname === "string" ? v.nickname : DEFAULT_VEHICLE.nickname,
    tankCapacityL: isNumOrNull(v.tankCapacityL) ? v.tankCapacityL : null,
    referenceL100km: isNumOrNull(v.referenceL100km) ? v.referenceL100km : null,
    monthlyBudget: isNumOrNull(v.monthlyBudget) ? v.monthlyBudget : null,
  };
  const stations = raw.stations.filter(
    (s): s is Station => isObj(s) && typeof s.id === "string" && typeof s.name === "string" && typeof s.branch === "string",
  );
  const refuels = raw.refuels.filter(
    (r): r is Refuel =>
      isObj(r) &&
      typeof r.id === "string" &&
      typeof r.stationId === "string" &&
      isStrOrNull(r.dateTime) &&
      isNumOrNull(r.total) &&
      isNumOrNull(r.price) &&
      isNumOrNull(r.litres) &&
      isNumOrNull(r.odometerKm) &&
      typeof r.full === "boolean",
  );
  const readings = raw.readings.filter(
    (r): r is Reading =>
      isObj(r) && typeof r.id === "string" && isNum(r.odometerKm) && isNum(r.rangeKm) && isStrOrNull(r.dateTime),
  );
  const drives = raw.drives.filter(
    (d): d is Drive =>
      isObj(d) &&
      typeof d.id === "string" &&
      typeof d.startedAt === "string" &&
      isNum(d.startOdometerKm) &&
      isNum(d.startRangeKm),
  );
  return {
    version: 1,
    seedVersion: isNum(raw.seedVersion) ? raw.seedVersion : null,
    vehicle,
    stations,
    refuels,
    readings,
    drives,
  };
}

export function loadState(): FuelState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY_STATE;
    return parseState(JSON.parse(raw)) ?? EMPTY_STATE;
  } catch {
    return EMPTY_STATE;
  }
}

export function saveState(state: FuelState): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

let counter = 0;
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * One-time import of the Apple Notes records. Keyed by SEED_VERSION so a
 * refresh or restart never duplicates the records.
 */
export function applySeed(state: FuelState): FuelState {
  if (state.seedVersion !== null && state.seedVersion >= SEED_VERSION) return state;
  const stations = [...state.stations];
  const stationId = (name: string) => {
    const existing = stations.find((s) => s.name === name && s.branch === "");
    if (existing) return existing.id;
    const s: Station = { id: newId("st"), name, branch: "" };
    stations.push(s);
    return s.id;
  };
  const refuels = [...state.refuels];
  const readings = [...state.readings];
  for (const purchase of SEED_PURCHASES) {
    const sid = stationId(purchase.station);
    const hasPurchase = purchase.total !== null || purchase.price !== null || purchase.litres !== null;
    const refuelId = hasPurchase ? newId("rf") : null;
    // Derive the missing third value (Total = Price × Litres) for display; the recorded values are kept.
    const total = purchase.total;
    const price = purchase.price ?? (total !== null && purchase.litres ? Math.round((total / purchase.litres) * 10000) / 10000 : null);
    const litres = purchase.litres ?? (total !== null && price ? Math.round((total / price) * 100) / 100 : null);
    if (refuelId) {
      refuels.push({
        id: refuelId,
        stationId: sid,
        dateTime: null,
        dateNote: purchase.date,
        fuelType: "Diesel",
        total,
        price,
        litres,
        odometerKm: null,
        rangeBeforeKm: null,
        rangeAfterKm: null,
        full: false,
        notes: purchase.note ?? "",
        verified: false,
        source: "seed",
        corrected: false,
      });
    }
    for (const r of purchase.readings) {
      readings.push({
        id: newId("rd"),
        dateTime: null,
        dateNote: r.date,
        odometerKm: r.odometerKm,
        rangeKm: r.rangeKm,
        note: [r.note, purchase.station].filter(Boolean).join(" · "),
        source: "seed",
        refuelId,
      });
    }
  }
  return { ...state, seedVersion: SEED_VERSION, stations, refuels, readings };
}
