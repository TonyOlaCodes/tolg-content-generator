export type Units = {
  temperature: "celsius" | "fahrenheit";
  wind: "kmh" | "mph";
  precipitation: "mm" | "inch";
  clock: "24h" | "12h";
};

export const DEFAULT_UNITS: Units = {
  temperature: "celsius",
  wind: "kmh",
  precipitation: "mm",
  clock: "24h",
};

export type Place = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  country: string | null;
  countryCode: string | null;
  admin1: string | null;
  timezone: string | null;
};

export type CurrentWeather = {
  time: string;
  temperature: number | null;
  apparentTemperature: number | null;
  isDay: boolean | null;
  weatherCode: number | null;
  humidity: number | null;
  cloudCover: number | null;
  precipitation: number | null;
  windSpeed: number | null;
  windDirection: number | null;
  windGusts: number | null;
  pressure: number | null;
};

export type HourlyPoint = {
  time: string;
  temperature: number | null;
  apparentTemperature: number | null;
  precipitationProbability: number | null;
  precipitation: number | null;
  weatherCode: number | null;
  humidity: number | null;
  windSpeed: number | null;
  uvIndex: number | null;
  visibility: number | null;
  dewPoint: number | null;
};

export type DailyPoint = {
  date: string;
  weatherCode: number | null;
  temperatureMax: number | null;
  temperatureMin: number | null;
  sunrise: string | null;
  sunset: string | null;
  uvIndexMax: number | null;
  precipitationSum: number | null;
  precipitationProbabilityMax: number | null;
  windSpeedMax: number | null;
};

export type AirQuality = {
  time: string;
  usAqi: number | null;
  europeanAqi: number | null;
  pm25: number | null;
  pm10: number | null;
  ozone: number | null;
  nitrogenDioxide: number | null;
};

export type Forecast = {
  timezone: string;
  utcOffsetSeconds: number;
  fetchedAt: string;
  current: CurrentWeather;
  hourly: HourlyPoint[];
  daily: DailyPoint[];
  airQuality: AirQuality | null;
};
