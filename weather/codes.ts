/**
 * WMO weather interpretation codes, as documented by Open-Meteo:
 * https://open-meteo.com/en/docs (WMO Weather interpretation codes, WW).
 */
export type ConditionKind =
  | "clear"
  | "partly-cloudy"
  | "cloudy"
  | "fog"
  | "drizzle"
  | "rain"
  | "freezing-rain"
  | "snow"
  | "showers"
  | "snow-showers"
  | "thunderstorm"
  | "unknown";

export type Condition = {
  kind: ConditionKind;
  label: string;
  icon: string;
};

const TABLE: Record<number, { kind: ConditionKind; label: string }> = {
  0: { kind: "clear", label: "Clear sky" },
  1: { kind: "clear", label: "Mainly clear" },
  2: { kind: "partly-cloudy", label: "Partly cloudy" },
  3: { kind: "cloudy", label: "Overcast" },
  45: { kind: "fog", label: "Fog" },
  48: { kind: "fog", label: "Depositing rime fog" },
  51: { kind: "drizzle", label: "Light drizzle" },
  53: { kind: "drizzle", label: "Moderate drizzle" },
  55: { kind: "drizzle", label: "Dense drizzle" },
  56: { kind: "freezing-rain", label: "Light freezing drizzle" },
  57: { kind: "freezing-rain", label: "Dense freezing drizzle" },
  61: { kind: "rain", label: "Slight rain" },
  63: { kind: "rain", label: "Moderate rain" },
  65: { kind: "rain", label: "Heavy rain" },
  66: { kind: "freezing-rain", label: "Light freezing rain" },
  67: { kind: "freezing-rain", label: "Heavy freezing rain" },
  71: { kind: "snow", label: "Slight snow fall" },
  73: { kind: "snow", label: "Moderate snow fall" },
  75: { kind: "snow", label: "Heavy snow fall" },
  77: { kind: "snow", label: "Snow grains" },
  80: { kind: "showers", label: "Slight rain showers" },
  81: { kind: "showers", label: "Moderate rain showers" },
  82: { kind: "showers", label: "Violent rain showers" },
  85: { kind: "snow-showers", label: "Slight snow showers" },
  86: { kind: "snow-showers", label: "Heavy snow showers" },
  95: { kind: "thunderstorm", label: "Thunderstorm" },
  96: { kind: "thunderstorm", label: "Thunderstorm with slight hail" },
  99: { kind: "thunderstorm", label: "Thunderstorm with heavy hail" },
};

const ICONS: Record<ConditionKind, { day: string; night: string }> = {
  clear: { day: "☀️", night: "🌙" },
  "partly-cloudy": { day: "⛅", night: "☁️" },
  cloudy: { day: "☁️", night: "☁️" },
  fog: { day: "🌫️", night: "🌫️" },
  drizzle: { day: "🌦️", night: "🌧️" },
  rain: { day: "🌧️", night: "🌧️" },
  "freezing-rain": { day: "🌨️", night: "🌨️" },
  snow: { day: "🌨️", night: "🌨️" },
  showers: { day: "🌦️", night: "🌧️" },
  "snow-showers": { day: "🌨️", night: "🌨️" },
  thunderstorm: { day: "⛈️", night: "⛈️" },
  unknown: { day: "❔", night: "❔" },
};

export function describeWeatherCode(code: number | null, isDay: boolean | null): Condition {
  if (code === null || !(code in TABLE)) {
    return { kind: "unknown", label: "Conditions unavailable", icon: ICONS.unknown.day };
  }
  const entry = TABLE[code];
  const night = isDay === false;
  return {
    kind: entry.kind,
    label: entry.label,
    icon: night ? ICONS[entry.kind].night : ICONS[entry.kind].day,
  };
}

/** Whether a code means precipitation is falling (used for backgrounds and rain copy). */
export function isWetCode(code: number | null): boolean {
  if (code === null) return false;
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;
}

export function isSnowCode(code: number | null): boolean {
  if (code === null) return false;
  return (code >= 71 && code <= 77) || code === 85 || code === 86;
}
