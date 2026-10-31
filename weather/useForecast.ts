"use client";

import { useEffect, useState } from "react";
import type { Forecast, Place } from "./types";
import { placeKey } from "./storage";

export type ForecastState =
  | { status: "idle" }
  | { status: "loading"; forecast: Forecast | null }
  | { status: "ready"; forecast: Forecast; stale: boolean }
  | { status: "error"; message: string; forecast: Forecast | null };

const sessionCache = new Map<string, Forecast>();
const LAST_KEY = "weather.lastForecast.v1";

function readLast(key: string): Forecast | null {
  try {
    const raw = window.localStorage.getItem(LAST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { key: string; forecast: Forecast };
    return parsed.key === key && parsed.forecast && Array.isArray(parsed.forecast.hourly) ? parsed.forecast : null;
  } catch {
    return null;
  }
}

function writeLast(key: string, forecast: Forecast): void {
  try {
    window.localStorage.setItem(LAST_KEY, JSON.stringify({ key, forecast }));
  } catch {
    // storage full: offline fallback is a best-effort extra
  }
}

/** Fetches the forecast for `place`, cancelling any request for a previous place. */
export function useForecast(place: Place | null, refreshToken: number): ForecastState {
  const [state, setState] = useState<ForecastState>({ status: "idle" });

  useEffect(() => {
    if (!place) {
      setState({ status: "idle" });
      return;
    }
    const key = placeKey(place);
    const controller = new AbortController();
    const cachedNow = refreshToken === 0 ? sessionCache.get(key) : undefined;
    if (cachedNow) {
      setState({ status: "ready", forecast: cachedNow, stale: false });
      return () => controller.abort();
    }

    setState({ status: "loading", forecast: sessionCache.get(key) ?? null });
    const url = `/api/weather/forecast?lat=${place.latitude}&lon=${place.longitude}`;

    fetch(url, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok || !body || typeof body !== "object" || !("hourly" in body)) {
          const message =
            body && typeof body === "object" && "error" in body && typeof body.error === "string"
              ? body.error
              : "Weather is unavailable right now.";
          throw new Error(message);
        }
        const forecast = body as Forecast;
        sessionCache.set(key, forecast);
        writeLast(key, forecast);
        setState({ status: "ready", forecast, stale: false });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const fallback = sessionCache.get(key) ?? readLast(key);
        const offline = typeof navigator !== "undefined" && !navigator.onLine;
        const message = offline
          ? "You appear to be offline."
          : error instanceof Error
            ? error.message
            : "Weather is unavailable right now.";
        if (fallback) {
          setState({ status: "ready", forecast: fallback, stale: true });
        } else {
          setState({ status: "error", message, forecast: null });
        }
      });

    return () => controller.abort();
  }, [place, refreshToken]);

  return state;
}
