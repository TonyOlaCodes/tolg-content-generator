import type { AirQuality, CurrentWeather, DailyPoint, Forecast, HourlyPoint, Place } from "./types";

/**
 * Server-side Open-Meteo client. Runs only on the server (route handlers), so any
 * future API key stays out of the browser bundle.
 * Docs: https://open-meteo.com/en/docs · https://open-meteo.com/en/docs/geocoding-api
 *       https://open-meteo.com/en/docs/air-quality-api
 */

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const AIR_QUALITY_URL = "https://air-quality-api.open-meteo.com/v1/air-quality";

const TIMEOUT_MS = 8000;
const FORECAST_TTL_MS = 15 * 60 * 1000;
const AIR_TTL_MS = 30 * 60 * 1000;
const GEO_TTL_MS = 24 * 60 * 60 * 1000;

export class WeatherApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly kind: "timeout" | "rate-limit" | "upstream" | "invalid-response" | "network",
  ) {
    super(message);
  }
}

type CacheEntry<T> = { value: T; expires: number };
const cache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

/** Deduplicates concurrent identical requests and caches results for `ttl` ms. */
async function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expires > Date.now()) return hit.value;
  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) return pending;
  const promise = load()
    .then((value) => {
      cache.set(key, { value, expires: Date.now() + ttl });
      return value;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

async function getJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal, headers: { accept: "application/json" } });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new WeatherApiError("The weather service took too long to respond.", 504, "timeout");
    }
    throw new WeatherApiError("Could not reach the weather service.", 503, "network");
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 429) {
    throw new WeatherApiError("The weather service is busy. Try again in a minute.", 429, "rate-limit");
  }
  if (!response.ok) {
    throw new WeatherApiError("The weather service returned an error.", 502, "upstream");
  }
  try {
    return await response.json();
  } catch {
    throw new WeatherApiError("The weather service sent an unreadable response.", 502, "invalid-response");
  }
}

// ---- validation helpers: never let undefined/NaN reach the UI ----------------

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null;
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const numArr = (v: unknown, len: number): (number | null)[] =>
  Array.from({ length: len }, (_, i) => (Array.isArray(v) ? num(v[i]) : null));
const strArr = (v: unknown, len: number): (string | null)[] =>
  Array.from({ length: len }, (_, i) => (Array.isArray(v) ? str(v[i]) : null));

function invalid(what: string): never {
  throw new WeatherApiError(`Unexpected ${what} data from the weather service.`, 502, "invalid-response");
}

// ---- geocoding ------------------------------------------------------------------

export async function searchPlaces(query: string, count = 8): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = `${GEOCODING_URL}?name=${encodeURIComponent(q)}&count=${count}&language=en&format=json`;
  return cached(url, GEO_TTL_MS, async () => {
    const data = await getJson(url);
    if (!isObj(data)) invalid("geocoding");
    // Open-Meteo omits `results` entirely when nothing matches.
    if (data.results === undefined) return [];
    if (!Array.isArray(data.results)) invalid("geocoding");
    const places: Place[] = [];
    for (const raw of data.results) {
      if (!isObj(raw)) continue;
      const id = num(raw.id);
      const name = str(raw.name);
      const latitude = num(raw.latitude);
      const longitude = num(raw.longitude);
      if (id === null || !name || latitude === null || longitude === null) continue;
      places.push({
        id,
        name,
        latitude,
        longitude,
        country: str(raw.country),
        countryCode: str(raw.country_code),
        admin1: str(raw.admin1),
        timezone: str(raw.timezone),
      });
    }
    return places;
  });
}

// ---- forecast ---------------------------------------------------------------------

const CURRENT_FIELDS = [
  "temperature_2m",
  "apparent_temperature",
  "is_day",
  "precipitation",
  "weather_code",
  "cloud_cover",
  "pressure_msl",
  "relative_humidity_2m",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
].join(",");

const HOURLY_FIELDS = [
  "temperature_2m",
  "apparent_temperature",
  "precipitation_probability",
  "precipitation",
  "weather_code",
  "relative_humidity_2m",
  "wind_speed_10m",
  "uv_index",
  "visibility",
  "dew_point_2m",
].join(",");

const DAILY_FIELDS = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "sunrise",
  "sunset",
  "uv_index_max",
  "precipitation_sum",
  "precipitation_probability_max",
  "wind_speed_10m_max",
].join(",");

function parseCurrent(raw: unknown): CurrentWeather {
  if (!isObj(raw)) invalid("current weather");
  const time = str(raw.time);
  if (!time) invalid("current weather");
  const isDayRaw = num(raw.is_day);
  return {
    time,
    temperature: num(raw.temperature_2m),
    apparentTemperature: num(raw.apparent_temperature),
    isDay: isDayRaw === null ? null : isDayRaw === 1,
    weatherCode: num(raw.weather_code),
    humidity: num(raw.relative_humidity_2m),
    cloudCover: num(raw.cloud_cover),
    precipitation: num(raw.precipitation),
    windSpeed: num(raw.wind_speed_10m),
    windDirection: num(raw.wind_direction_10m),
    windGusts: num(raw.wind_gusts_10m),
    pressure: num(raw.pressure_msl),
  };
}

function parseHourly(raw: unknown): HourlyPoint[] {
  if (!isObj(raw) || !Array.isArray(raw.time)) invalid("hourly");
  const times = raw.time.map((t) => str(t));
  const n = times.length;
  const col = (k: string) => numArr(raw[k], n);
  const temp = col("temperature_2m");
  const apparent = col("apparent_temperature");
  const pop = col("precipitation_probability");
  const precip = col("precipitation");
  const code = col("weather_code");
  const hum = col("relative_humidity_2m");
  const wind = col("wind_speed_10m");
  const uv = col("uv_index");
  const vis = col("visibility");
  const dew = col("dew_point_2m");
  const points: HourlyPoint[] = [];
  for (let i = 0; i < n; i++) {
    const time = times[i];
    if (!time) continue;
    points.push({
      time,
      temperature: temp[i],
      apparentTemperature: apparent[i],
      precipitationProbability: pop[i],
      precipitation: precip[i],
      weatherCode: code[i],
      humidity: hum[i],
      windSpeed: wind[i],
      uvIndex: uv[i],
      visibility: vis[i],
      dewPoint: dew[i],
    });
  }
  return points;
}

function parseDaily(raw: unknown): DailyPoint[] {
  if (!isObj(raw) || !Array.isArray(raw.time)) invalid("daily");
  const dates = raw.time.map((t) => str(t));
  const n = dates.length;
  const code = numArr(raw.weather_code, n);
  const tmax = numArr(raw.temperature_2m_max, n);
  const tmin = numArr(raw.temperature_2m_min, n);
  const rise = strArr(raw.sunrise, n);
  const set = strArr(raw.sunset, n);
  const uv = numArr(raw.uv_index_max, n);
  const psum = numArr(raw.precipitation_sum, n);
  const pop = numArr(raw.precipitation_probability_max, n);
  const wind = numArr(raw.wind_speed_10m_max, n);
  const days: DailyPoint[] = [];
  for (let i = 0; i < n; i++) {
    const date = dates[i];
    if (!date) continue;
    days.push({
      date,
      weatherCode: code[i],
      temperatureMax: tmax[i],
      temperatureMin: tmin[i],
      sunrise: rise[i],
      sunset: set[i],
      uvIndexMax: uv[i],
      precipitationSum: psum[i],
      precipitationProbabilityMax: pop[i],
      windSpeedMax: wind[i],
    });
  }
  return days;
}

function parseAir(raw: unknown): AirQuality | null {
  if (!isObj(raw) || !isObj(raw.current)) return null;
  const c = raw.current;
  const time = str(c.time);
  if (!time) return null;
  return {
    time,
    usAqi: num(c.us_aqi),
    europeanAqi: num(c.european_aqi),
    pm25: num(c.pm2_5),
    pm10: num(c.pm10),
    ozone: num(c.ozone),
    nitrogenDioxide: num(c.nitrogen_dioxide),
  };
}

export async function fetchForecast(latitude: number, longitude: number): Promise<Forecast> {
  const lat = latitude.toFixed(4);
  const lon = longitude.toFixed(4);
  const forecastUrl =
    `${FORECAST_URL}?latitude=${lat}&longitude=${lon}` +
    `&current=${CURRENT_FIELDS}&hourly=${HOURLY_FIELDS}&daily=${DAILY_FIELDS}` +
    `&timezone=auto&forecast_days=16&wind_speed_unit=kmh&precipitation_unit=mm&temperature_unit=celsius`;
  const airUrl = `${AIR_QUALITY_URL}?latitude=${lat}&longitude=${lon}&current=us_aqi,european_aqi,pm2_5,pm10,ozone,nitrogen_dioxide&timezone=auto`;

  const [forecastRaw, airRaw] = await Promise.all([
    cached(forecastUrl, FORECAST_TTL_MS, () => getJson(forecastUrl)),
    // Air quality is optional: a failure here must not hide the forecast.
    cached(airUrl, AIR_TTL_MS, () => getJson(airUrl)).catch(() => null),
  ]);

  if (!isObj(forecastRaw)) invalid("forecast");
  const timezone = str(forecastRaw.timezone);
  if (!timezone) invalid("forecast");
  return {
    timezone,
    utcOffsetSeconds: num(forecastRaw.utc_offset_seconds) ?? 0,
    fetchedAt: new Date().toISOString(),
    current: parseCurrent(forecastRaw.current),
    hourly: parseHourly(forecastRaw.hourly),
    daily: parseDaily(forecastRaw.daily),
    airQuality: parseAir(airRaw),
  };
}
