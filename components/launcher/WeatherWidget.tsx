"use client";

import { useEffect, useState } from "react";
import { describeWeatherCode } from "@/weather/codes";
import { FALLBACK_PLACE, loadSelected, loadUnits } from "@/weather/storage";
import type { Place, Units } from "@/weather/types";
import { DEFAULT_UNITS } from "@/weather/types";
import { formatTemp } from "@/weather/units";
import { useForecast } from "@/weather/useForecast";

/** Live weather for the last place chosen in the Weather app. Shows only fetched data. */
export default function WeatherWidget({ onOpen }: { onOpen: () => void }) {
  const [place, setPlace] = useState<Place | null>(null);
  const [units, setUnits] = useState<Units>(DEFAULT_UNITS);

  useEffect(() => {
    setPlace(loadSelected() ?? FALLBACK_PLACE);
    setUnits(loadUnits());
  }, []);

  const state = useForecast(place, 0);

  const forecast = state.status === "ready" || state.status === "loading" ? state.forecast : null;
  let body: React.ReactNode;
  if (forecast) {
    const current = forecast.current;
    const condition = describeWeatherCode(current.weatherCode, current.isDay);
    body = (
      <>
        <span className="widget-value">{formatTemp(current.temperature, units)}</span>
        <span className="widget-caption">
          {condition.label}
          {place ? ` · ${place.name}` : ""}
        </span>
      </>
    );
  } else if (state.status === "error") {
    body = <span className="widget-caption">{state.message}</span>;
  } else {
    body = <span className="widget-caption">Loading weather…</span>;
  }

  return (
    <button type="button" className="widget-card" onClick={onOpen} aria-label="Open Weather">
      <span className="widget-label">Weather</span>
      {body}
    </button>
  );
}
