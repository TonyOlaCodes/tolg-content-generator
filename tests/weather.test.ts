/**
 * Weather unit tests. Pure logic only, no network. Run with:
 *
 *   npx tsx tests/weather.test.ts
 */

import assert from "node:assert/strict";
import { describeWeatherCode, isWetCode, isSnowCode } from "../weather/codes";
import { formatTemp, formatWind, formatPrecip, formatVisibility, windDirectionLabel } from "../weather/units";
import { DEFAULT_UNITS, type Units } from "../weather/types";

const F: Units = { ...DEFAULT_UNITS, temperature: "fahrenheit", wind: "mph", precipitation: "inch" };
let passed = 0;

function test(name: string, fn: () => void) {
  fn();
  passed++;
  console.log(`ok - ${name}`);
}

test("Celsius is shown as-is, Fahrenheit converts", () => {
  assert.equal(formatTemp(0, DEFAULT_UNITS), "0°");
  assert.equal(formatTemp(-10, DEFAULT_UNITS), "-10°");
  assert.equal(formatTemp(100, F), "212°");
  assert.equal(formatTemp(-40, F), "-40°");
});

test("missing and non-finite temperatures never render as NaN", () => {
  assert.equal(formatTemp(null, DEFAULT_UNITS), "—");
  assert.equal(formatTemp(Number.NaN, F), "—");
  assert.equal(formatWind(Number.POSITIVE_INFINITY, DEFAULT_UNITS), "—");
});

test("wind converts km/h to mph and labels correctly", () => {
  assert.equal(formatWind(100, DEFAULT_UNITS), "100 km/h");
  assert.equal(formatWind(100, F), "62 mph");
});

test("precipitation converts mm to inches", () => {
  assert.equal(formatPrecip(2.54, F), "0.10 in");
  assert.equal(formatPrecip(2.5, DEFAULT_UNITS), "2.5 mm");
  assert.equal(formatPrecip(null, F), "—");
});

test("visibility switches between metres and kilometres", () => {
  assert.equal(formatVisibility(800), "800 m");
  assert.equal(formatVisibility(9500), "9.5 km");
  assert.equal(formatVisibility(24000), "24 km");
});

test("wind direction labels wrap around 360 degrees", () => {
  assert.equal(windDirectionLabel(0), "N");
  assert.equal(windDirectionLabel(359), "N");
  assert.equal(windDirectionLabel(90), "E");
  assert.equal(windDirectionLabel(225), "SW");
  assert.equal(windDirectionLabel(null), "");
});

test("WMO codes map to labels with day and night icons", () => {
  assert.equal(describeWeatherCode(0, true).label, "Clear sky");
  assert.equal(describeWeatherCode(0, true).icon, "☀️");
  assert.equal(describeWeatherCode(0, false).icon, "🌙");
  assert.equal(describeWeatherCode(95, true).kind, "thunderstorm");
  assert.equal(describeWeatherCode(61, true).kind, "rain");
});

test("unknown or missing WMO codes are reported as unavailable", () => {
  assert.equal(describeWeatherCode(null, true).kind, "unknown");
  assert.equal(describeWeatherCode(42, true).label, "Conditions unavailable");
});

test("wet and snow flags follow the WMO code groups", () => {
  assert.equal(isWetCode(63), true);
  assert.equal(isWetCode(81), true);
  assert.equal(isWetCode(3), false);
  assert.equal(isWetCode(null), false);
  assert.equal(isSnowCode(73), true);
  assert.equal(isSnowCode(61), false);
});

console.log(`\n${passed} weather unit tests passed`);
