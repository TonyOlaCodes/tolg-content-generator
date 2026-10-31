import type { Units } from "./types";

/** Open-Meteo returns Celsius, km/h and mm by default; convert only for display. */
export function formatTemp(celsius: number | null, units: Units): string {
  if (celsius === null || !Number.isFinite(celsius)) return "—";
  const value = units.temperature === "fahrenheit" ? (celsius * 9) / 5 + 32 : celsius;
  return `${Math.round(value)}°`;
}

export function formatWind(kmh: number | null, units: Units): string {
  if (kmh === null || !Number.isFinite(kmh)) return "—";
  const value = units.wind === "mph" ? kmh * 0.621371 : kmh;
  return `${Math.round(value)} ${units.wind === "mph" ? "mph" : "km/h"}`;
}

export function formatPrecip(mm: number | null, units: Units): string {
  if (mm === null || !Number.isFinite(mm)) return "—";
  if (units.precipitation === "inch") {
    return `${(mm / 25.4).toFixed(2)} in`;
  }
  return `${mm.toFixed(1)} mm`;
}

export function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${Math.round(value)}%`;
}

export function formatPressure(hpa: number | null): string {
  if (hpa === null || !Number.isFinite(hpa)) return "—";
  return `${Math.round(hpa)} hPa`;
}

export function formatVisibility(meters: number | null): string {
  if (meters === null || !Number.isFinite(meters)) return "—";
  return meters >= 1000 ? `${(meters / 1000).toFixed(meters >= 10000 ? 0 : 1)} km` : `${Math.round(meters)} m`;
}

export function formatUv(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toFixed(value < 10 ? 1 : 0);
}

export function windDirectionLabel(degrees: number | null): string {
  if (degrees === null || !Number.isFinite(degrees)) return "";
  const points = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  return points[Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16];
}

/**
 * Converts a Celsius value without rounding, for charts that need the raw scale
 * in the user's chosen unit.
 */
export function toDisplayTemp(celsius: number, units: Units): number {
  return units.temperature === "fahrenheit" ? (celsius * 9) / 5 + 32 : celsius;
}

export function toDisplayWind(kmh: number, units: Units): number {
  return units.wind === "mph" ? kmh * 0.621371 : kmh;
}

export function toDisplayPrecip(mm: number, units: Units): number {
  return units.precipitation === "inch" ? mm / 25.4 : mm;
}
