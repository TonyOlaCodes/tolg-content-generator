import assert from "node:assert/strict";
import {
  solveRefuel,
  driveMetrics,
  fullToFullIntervals,
  estimatedReach,
  confidenceFor,
} from "../fuel/calc";

// Calculator: Total = Price × Litres
{
  const r = solveRefuel({ total: 50, price: 2.119, litres: null }, "price", "total");
  assert.equal(r.litres, 23.6);
  const r2 = solveRefuel({ total: 50, price: null, litres: 25 }, "litres", "total");
  assert.equal(r2.price, 2);
  const r3 = solveRefuel({ total: null, price: 2.129, litres: 23.58 }, "litres", "price");
  assert.equal(r3.total, 50.2);
  // editing litres keeps total fixed and derives price
  const r4 = solveRefuel({ total: 50, price: 2.119, litres: 25 }, "litres", "total");
  assert.equal(r4.price, 2);
  assert.equal(r4.total, 50);
}

// Drive metrics
{
  const m = driveMetrics({ odometerKm: 395511, rangeKm: 554 }, { odometerKm: 395570, rangeKm: 494 });
  assert.equal(m.distanceKm, 59);
  assert.equal(m.rangeConsumedKm, 60);
  assert.equal(m.totalRangeChangeKm, 395570 + 494 - (395511 + 554));
  const up = driveMetrics({ odometerKm: 100, rangeKm: 200 }, { odometerKm: 120, rangeKm: 230 });
  assert.equal(up.rangeConsumedKm, -30);
  assert.equal(up.rangeEfficiency, null);
}

// Reach
assert.equal(estimatedReach(394021, 465), 394486);

// Full-to-full intervals: partial refuel between two fulls is included
{
  const iv = fullToFullIntervals([
    { id: "a", odometerKm: 1000, litres: 30, total: 60, full: true },
    { id: "b", odometerKm: 1200, litres: 10, total: 20, full: false },
    { id: "c", odometerKm: 1400, litres: 25, total: 50, full: true },
    { id: "d", odometerKm: 1400, litres: 25, total: 50, full: true },
  ]);
  assert.equal(iv.length, 1, "zero-distance interval must be excluded");
  assert.equal(iv[0].litres, 35);
  assert.equal(iv[0].distanceKm, 400);
  assert.equal(iv[0].l100km, 8.75);
}
{
  const iv = fullToFullIntervals([
    { id: "a", odometerKm: 1000, litres: 30, total: 60, full: true },
    { id: "c", odometerKm: 1400, litres: 25, total: 50, full: true },
    { id: "d", odometerKm: 1400, litres: 25, total: 50, full: true },
  ]);
  assert.equal(iv.length, 1, "zero-distance interval must be excluded");
}

// Confidence wording
assert.equal(confidenceFor(0).level, "none");
assert.equal(confidenceFor(2).level, "limited");
assert.equal(confidenceFor(3).label, "Based on 3 valid full-to-full intervals");

console.log("fuel tests passed");
