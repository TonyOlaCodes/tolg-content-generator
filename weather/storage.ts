import { DEFAULT_UNITS, type Place, type Units } from "./types";

/**
 * Local persistence only. No account, no server storage, and no analytics.
 * Every read is validated, so a corrupted value falls back to defaults.
 */

const KEYS = {
  saved: "weather.savedPlaces.v1",
  recent: "weather.recentSearches.v1",
  units: "weather.units.v1",
  selected: "weather.selectedPlace.v1",
} as const;

export const FALLBACK_PLACE: Place = {
  id: 2963436,
  name: "Kildare",
  latitude: 53.15611,
  longitude: -6.91444,
  country: "Ireland",
  countryCode: "IE",
  admin1: "Leinster",
  timezone: "Europe/Dublin",
};

function read<T>(key: string, parse: (value: unknown) => T | null): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return parse(JSON.parse(raw));
  } catch {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // storage unavailable, nothing to clean up
    }
    return null;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota or private mode: the app keeps working without persistence
  }
}

function isPlace(v: unknown): v is Place {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.id === "number" &&
    typeof p.name === "string" &&
    typeof p.latitude === "number" &&
    typeof p.longitude === "number" &&
    Number.isFinite(p.latitude) &&
    Number.isFinite(p.longitude) &&
    p.latitude >= -90 &&
    p.latitude <= 90 &&
    p.longitude >= -180 &&
    p.longitude <= 180
  );
}

function asPlaceList(v: unknown): Place[] | null {
  return Array.isArray(v) ? v.filter(isPlace) : null;
}

/** A place is identified by its coordinates, so two cities with the same name stay distinct. */
export function placeKey(p: Pick<Place, "latitude" | "longitude">): string {
  return `${p.latitude.toFixed(3)},${p.longitude.toFixed(3)}`;
}

export const loadSaved = (): Place[] => read(KEYS.saved, asPlaceList) ?? [];
export const saveSaved = (places: Place[]): void => write(KEYS.saved, places);

export const loadRecent = (): Place[] => read(KEYS.recent, asPlaceList) ?? [];
export const saveRecent = (places: Place[]): void => write(KEYS.recent, places.slice(0, 6));

export const loadSelected = (): Place | null => read(KEYS.selected, (v) => (isPlace(v) ? v : null));
export const saveSelected = (place: Place): void => write(KEYS.selected, place);

export function loadUnits(): Units {
  return (
    read(KEYS.units, (v) => {
      if (typeof v !== "object" || v === null) return null;
      const u = v as Record<string, unknown>;
      return {
        temperature: u.temperature === "fahrenheit" ? "fahrenheit" : "celsius",
        wind: u.wind === "mph" ? "mph" : "kmh",
        precipitation: u.precipitation === "inch" ? "inch" : "mm",
        clock: u.clock === "12h" ? "12h" : "24h",
      } satisfies Units;
    }) ?? DEFAULT_UNITS
  );
}
export const saveUnits = (units: Units): void => write(KEYS.units, units);

/** Keeps the most recent entry first and removes duplicates by coordinates. */
export function pushRecent(list: Place[], place: Place): Place[] {
  const key = placeKey(place);
  return [place, ...list.filter((p) => placeKey(p) !== key)].slice(0, 6);
}

export function clearWeatherStorage(): void {
  if (typeof window === "undefined") return;
  for (const key of [KEYS.recent, KEYS.saved, KEYS.selected]) {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}
