import assert from "node:assert/strict";
import {
  addWater,
  addWeight,
  applyChangeLocally,
  deleteHighlight,
  deleteWater,
  deleteWeight,
  invertChange,
  mergeChanges,
  saveHighlight,
  saveSettings,
  setDayMetric,
  setDayMetrics,
  updateWater,
  updateWeight,
  type Ctx,
  type Result,
} from "../daily/actions";
import {
  bucketSeries,
  buildInsights,
  currentStreak,
  dayMetrics,
  goalStats,
  latestWeight,
  monthAverage,
  periodDates,
  periodStart,
  seriesForMetric,
  waterTotalForDate,
  weekAverage,
  weightStats,
} from "../daily/logic";
import { addDays, daysBetween, eachDay, monthGrid, parseDateKey, startOfWeek, timeToMinutes, toDateKey, todayKey } from "../daily/date";
import { exportSnapshot, validateBackup } from "../daily/backup";
import { DEFAULT_SETTINGS, LIMITS, emptySnapshot, visibleMetrics, type Snapshot } from "../daily/model";
import { formatDuration, formatWater, formatWeightChange, kgToUnit } from "../daily/format";

let counter = 0;
const TODAY = "2026-11-01";
const ctx: Ctx = { today: TODAY, now: "2026-11-01T09:00:00.000Z", newId: () => `id-${++counter}` };

function must(result: Result) {
  assert.ok(result.ok, result.ok ? "" : result.error);
  return result.change;
}

function apply(snapshot: Snapshot, result: Result): Snapshot {
  return applyChangeLocally(snapshot, must(result));
}

// ---------------------------------------------------------------- date keys
assert.equal(daysBetween("2026-10-28", "2026-11-01"), 4);
assert.equal(addDays("2026-10-31", 1), "2026-11-01");
assert.equal(addDays("2026-03-01", -1), "2026-02-28", "month boundary");
assert.equal(addDays("2028-03-01", -1), "2028-02-29", "leap year");
assert.equal(parseDateKey("2026-02-31"), null, "impossible dates are rejected");
assert.equal(parseDateKey("2026-11-01")?.getDate(), 1);
assert.equal(startOfWeek("2026-11-01"), "2026-10-26", "weeks start on Monday");
assert.equal(timeToMinutes("31:00"), null);
assert.equal(toDateKey(new Date(2026, 10, 1, 23, 30)), "2026-11-01", "day keys use local parts, not UTC");
assert.equal(eachDay("2026-10-30", "2026-11-01").length, 3);
assert.equal(monthGrid("2026-11")[0], null, "November 2026 starts on a Sunday, so Monday-first grid has 6 blanks");
assert.equal(monthGrid("2026-11").filter(Boolean).length, 30);
assert.equal(todayKey(new Date(2026, 10, 1, 0, 5)), "2026-11-01");

// ------------------------------------------------------- day entry lifecycle
let snap = emptySnapshot();

// Only steps: partial days are valid and other metrics stay missing, not zero.
snap = apply(snap, setDayMetric(snap, TODAY, "steps", 7450, ctx));
const view = dayMetrics(snap, TODAY);
assert.equal(view.steps, 7450);
assert.equal(view.calories, null);
assert.equal(view.sleepMinutes, null);
assert.equal(view.waterMl, null, "no water entry is missing data, not 0 ml");
assert.equal(view.weightKg, null);
assert.equal(view.hasData, true);
assert.equal(snap.days.length, 1);

// Replace the steps total rather than adding a second record.
snap = apply(snap, setDayMetric(snap, TODAY, "steps", 8100, ctx));
assert.equal(snap.days.length, 1);
assert.equal(snap.days[0].steps, 8100);

// Calories total for the same day, separately editable.
snap = apply(snap, setDayMetric(snap, TODAY, "calories", 3450, ctx));
assert.equal(snap.days.length, 1);
assert.equal(snap.days[0].calories, 3450);

// A recorded zero is preserved and is not the same as no entry.
snap = apply(snap, setDayMetric(snap, TODAY, "calories", 0, ctx));
assert.equal(snap.days[0].calories, 0);
assert.equal(dayMetrics(snap, TODAY).calories, 0);

// Clearing one metric keeps the others.
snap = apply(snap, setDayMetric(snap, TODAY, "calories", null, ctx));
assert.equal(snap.days[0].calories, null);
assert.equal(snap.days[0].steps, 8100);

// Past dates can be edited; future dates are refused.
snap = apply(snap, setDayMetric(snap, "2026-10-30", "steps", 12_000, ctx));
assert.equal(snap.days.length, 2);
assert.equal(setDayMetric(snap, "2026-11-02", "steps", 100, ctx).ok, false);
assert.equal(setDayMetric(snap, "not-a-date", "steps", 100, ctx).ok, false);
assert.equal(setDayMetric(snap, TODAY, "steps", -1, ctx).ok, false);
assert.equal(setDayMetric(snap, TODAY, "steps", LIMITS.steps.max + 1, ctx).ok, false);
assert.equal(setDayMetric(snap, TODAY, "steps", 10.5, ctx).ok, false);

// Sleep is stored as whole minutes.
snap = apply(snap, setDayMetric(snap, TODAY, "sleepMinutes", 435, ctx));
assert.equal(dayMetrics(snap, TODAY).sleepMinutes, 435);
assert.equal(formatDuration(435), "7h 15m");
assert.equal(formatDuration(45), "45m");
assert.equal(formatDuration(480), "8h");
assert.equal(setDayMetric(snap, TODAY, "sleepMinutes", 1441, ctx).ok, false);

// Clearing the last metric removes the day row entirely.
const emptyDay = apply(snap, setDayMetric(snap, "2026-10-30", "steps", null, ctx));
assert.equal(emptyDay.days.some((d) => d.date === "2026-10-30"), false);
assert.equal(dayMetrics(emptyDay, "2026-10-30").steps, null);
assert.ok(setDayMetric(emptyDay, "2026-10-30", "steps", 5000, ctx).ok, "the day can be recreated");

// ------------------------------------------------------------------- water
let waterSnap = emptySnapshot();
waterSnap = apply(waterSnap, addWater(waterSnap, { date: TODAY, ml: 250 }, ctx));
const firstWaterId = waterSnap.water[0].id;
waterSnap = apply(waterSnap, addWater(waterSnap, { date: TODAY, ml: 500 }, ctx));
waterSnap = apply(waterSnap, addWater(waterSnap, { date: "2026-10-31", ml: 750 }, ctx));
assert.equal(waterTotalForDate(waterSnap, TODAY), 750);
assert.equal(waterTotalForDate(waterSnap, "2026-10-31"), 750);
assert.equal(waterTotalForDate(waterSnap, "2026-10-29"), null);
assert.equal(waterSnap.water.length, 3, "each quick-add is its own entry");

// Editing one entry recalculates the day total.
waterSnap = apply(waterSnap, updateWater(waterSnap, firstWaterId, 300));
assert.equal(waterTotalForDate(waterSnap, TODAY), 800);
assert.equal(updateWater(waterSnap, firstWaterId, 0).ok, false);

// Undoing a quick add restores the exact previous records.
waterSnap = apply(waterSnap, addWater(waterSnap, { date: TODAY, ml: 500 }, ctx));
assert.equal(waterTotalForDate(waterSnap, TODAY), 1300);
const undoAdd = must(addWater(waterSnap, { date: TODAY, ml: 500 }, ctx));
const afterAdd = applyChangeLocally(waterSnap, undoAdd);
assert.equal(waterTotalForDate(afterAdd, TODAY), 1800);
const undo = invertChange(waterSnap, undoAdd);
const restored = applyChangeLocally(afterAdd, undo);
assert.equal(waterTotalForDate(restored, TODAY), 1300);
assert.equal(restored.water.length, waterSnap.water.length);

// Deleting a water entry is also undoable.
waterSnap = apply(waterSnap, deleteWater(waterSnap, firstWaterId));
assert.equal(waterTotalForDate(waterSnap, TODAY), 1000);
assert.ok(addWater(waterSnap, { date: TODAY, ml: 0 }, ctx).ok === false);
assert.equal(formatWater(250), "250 ml");
assert.equal(formatWater(3000), "3 L");

// ------------------------------------------------------------------ weight
let weightSnap = emptySnapshot();
// Two weigh-ins on the same day, with times, both kept.
weightSnap = apply(weightSnap, addWeight(weightSnap, { date: TODAY, kg: 78.4, time: "07:15" }, ctx));
const morningId = weightSnap.weights[0].id;
weightSnap = apply(weightSnap, addWeight(weightSnap, { date: TODAY, kg: 78.2, time: "19:40" }, ctx));
assert.equal(weightSnap.weights.length, 2, "multiple weigh-ins per day are preserved");
assert.equal(latestWeight(weightSnap)?.kg, 78.2, "the latest time wins");
assert.equal(dayMetrics(weightSnap, TODAY).weightCount, 2);

// A later weigh-in on a previous day, and a missing day in between.
weightSnap = apply(weightSnap, addWeight(weightSnap, { date: "2026-10-25", kg: 79.0, time: "08:00" }, ctx));
weightSnap = apply(weightSnap, addWeight(weightSnap, { date: "2026-10-20", kg: 79.6, time: null }, ctx));
assert.equal(latestWeight(weightSnap)?.kg, 78.2);
assert.equal(dayMetrics(weightSnap, "2026-10-31").weightKg, null, "a missing weigh-in is not zero");

// Update a measurement's value, keeping the same record.
weightSnap = apply(weightSnap, updateWeight(weightSnap, morningId, { kg: 78.45, time: "07:30" }));
assert.equal(weightSnap.weights.find((w) => w.id === morningId)?.kg, 78.45);
assert.equal(weightSnap.weights.length, 4);
assert.equal(updateWeight(weightSnap, morningId, { kg: 500, time: null }).ok, false);
assert.equal(updateWeight(weightSnap, morningId, { kg: 78, time: "7:30" }).ok, false);

// Weight trend: change over the period uses real measurements only.
const stats = weightStats(weightSnap, "2026-10-20", TODAY);
assert.equal(stats.count, 4);
assert.equal(stats.changeKg !== null ? Math.round(stats.changeKg * 100) / 100 : null, -1.4);
assert.equal(stats.daily.length, 3, "only days with a weigh-in appear in the daily series");
assert.equal(stats.smoothed.length, 3);
assert.equal(stats.weekly.length, 2, "two Monday-based weeks");
assert.equal(stats.monthly.length, 2, "October and November");
// Weekly average (w/c 26 Oct) uses both Nov 1 measurements and the Oct 25 one? Oct 25 is the earlier week.
const weekOfNov1 = stats.weekly.find((w) => w.key === "2026-10-26");
assert.ok(weekOfNov1);
assert.equal(Math.round(weekOfNov1.kg * 100) / 100, 78.33, "average of 78.2 and 78.45 (two real measurements)");
assert.equal(weekOfNov1.count, 2);
assert.equal(formatWeightChange(0.8, "kg"), "+0.8 kg");
assert.equal(Math.round(kgToUnit(100, "lb") * 10) / 10, 220.5);

// Deleting a single weigh-in is undoable.
const deleteResult = must(deleteWeight(weightSnap, morningId));
const afterDelete = applyChangeLocally(weightSnap, deleteResult);
assert.equal(afterDelete.weights.length, 3);
assert.equal(applyChangeLocally(afterDelete, invertChange(weightSnap, deleteResult)).weights.length, 4);

// ------------------------------------------------------- averages and goals
const averagesSnap = emptySnapshot();
let av = averagesSnap;
av = apply(av, setDayMetric(av, "2026-10-26", "steps", 5000, ctx));
av = apply(av, setDayMetric(av, "2026-10-28", "steps", 7000, ctx));
av = apply(av, setDayMetric(av, "2026-11-01", "steps", 9000, ctx));
av = apply(av, setDayMetric(av, "2026-10-29", "calories", 2100, ctx));
av = apply(av, setDayMetric(av, "2026-10-30", "calories", 2500, ctx));
av = apply(av, setDayMetric(av, "2026-10-31", "calories", 0, ctx));
assert.equal(weekAverage(av, TODAY, "steps"), 7000, "weekly average ignores unlogged days");
assert.equal(monthAverage(av, TODAY, "steps"), 9000, "November average uses only November");
assert.equal(monthAverage(av, TODAY, "calories"), null, "no November calories yet");
const calorieSeries = seriesForMetric(av, ["2026-10-29", "2026-10-30", "2026-10-31", TODAY], "calories");
assert.equal(goalStats(calorieSeries, 2400).loggedDays, 3);
assert.equal(goalStats(calorieSeries, 2400).goalDays, 1, "a recorded zero is below goal, and a missing day is not counted");
assert.equal(Math.round((goalStats(calorieSeries, 2400).rate ?? 0) * 10) / 10, 33.3);

// Averages across a deliberate gap: two values, not four.
const gapSeries = seriesForMetric(av, ["2026-10-01", "2026-10-02", "2026-10-03"], "steps");
assert.equal(goalStats(gapSeries, 10_000).loggedDays, 0);
assert.equal(goalStats(gapSeries, 10_000).rate, null);

// Steps goal from settings is used by insights and completion.
const goalSnap = apply(av, saveSettings(av, { stepGoal: 8000 }));
assert.equal(goalSnap.settings.stepGoal, 8000);
assert.equal(saveSettings(goalSnap, { stepGoal: 10 }).ok, false);
assert.equal(saveSettings(goalSnap, { waterGoalMl: 0 }).ok, false);
assert.equal(saveSettings(goalSnap, { calorieGoal: 100 }).ok, false);
assert.equal(saveSettings(goalSnap, { weightUnit: "lb" }).ok, true);
assert.equal(saveSettings(goalSnap, { chartPeriod: 30 }).ok, true);
assert.equal(saveSettings(goalSnap, { chartPeriod: 12 as never }).ok, false);
assert.equal(saveSettings(goalSnap, { hiddenMetrics: ["steps", "weight", "calories", "sleep", "water"] }).ok, false);
const ordered = apply(goalSnap, saveSettings(goalSnap, { metricOrder: ["water", "steps"] }));
assert.deepEqual(ordered.settings.metricOrder, ["water", "steps", "weight", "calories", "sleep"], "missing metrics are appended");
assert.deepEqual(visibleMetrics({ ...DEFAULT_SETTINGS, hiddenMetrics: ["water"] }), ["steps", "weight", "calories", "sleep"]);
assert.equal(saveSettings(goalSnap, { calorieGoal: null }).ok, true, "calorie goal stays optional");
const weightGoalSet = apply(goalSnap, saveSettings(goalSnap, { weightGoalKg: 75.5 }));
assert.equal(weightGoalSet.settings.weightGoalKg, 75.5, "weight goal is stored in kilograms");
assert.equal(saveSettings(weightGoalSet, { weightGoalKg: 5 }).ok, false, "impossible weight goals are rejected");
assert.equal(saveSettings(weightGoalSet, { weightGoalKg: 401 }).ok, false);
assert.equal(saveSettings(weightGoalSet, { weightGoalKg: null }).ok, true, "weight goal stays optional");

// ---------------------------------------------------------------- insights
const noData = emptySnapshot();
assert.deepEqual(buildInsights(noData, 30, TODAY), [], "no insights are invented without data");

const insightSnap = apply(
  apply(
    apply(
      apply(apply(av, setDayMetric(av, "2026-10-27", "sleepMinutes", 450, ctx)), setDayMetric(av, "2026-10-28", "sleepMinutes", 430, ctx)),
      setDayMetric(av, "2026-10-26", "sleepMinutes", 410, ctx),
    ),
    addWater(av, { date: "2026-10-26", ml: 3000 }, ctx),
  ),
  addWeight(av, { date: "2026-10-05", kg: 80, time: null }, ctx),
);
const insightWeightSnap = apply(insightSnap, addWeight(insightSnap, { date: "2026-10-28", kg: 79.2, time: null }, ctx));
const insights = buildInsights(insightWeightSnap, 30, TODAY);
const text = insights.map((i) => i.text).join(" ");
assert.match(text, /Average steps since your first entry: 7,000/, "averages use recorded days only");
assert.match(text, /Weight decreased by 0\.8 kg since your first entry/, "weight change is computed from measurements");
assert.match(text, /Average sleep since your first entry: 7h 10m/, "sleep insight uses recorded nights");
assert.match(text, /Average water since your first entry: 3 L/, "water insight");
assert.doesNotMatch(text, /over the last 30 days/, "the range does not pretend to cover days before the first entry");
assert.doesNotMatch(text, /zero|0 kcal/, "missing calorie days never appear as zero");
assert.ok(buildInsights(emptySnapshot(), 0, TODAY).length === 0);

// -------------------------------------------- analytics start at first log
// A brand-new tracker with one entry must report one day, not thirty empty days.
const fresh = emptySnapshot();
const freshOne = apply(fresh, setDayMetric(fresh, "2026-10-31", "steps", 5000, ctx));
assert.deepEqual(periodDates(freshOne, 30, TODAY), ["2026-10-31", TODAY], "range is clamped to the first logged day");
assert.equal(periodStart(freshOne, 365, TODAY), "2026-10-31");
const freshInsights = buildInsights(freshOne, 30, TODAY);
const freshText = freshInsights.map((i) => i.text).join(" ");
assert.match(freshText, /Average steps since your first entry: 5,000/, "the average is the one real day");
assert.doesNotMatch(freshText, /167/, "the single value is never divided across empty days");

// Highlights alone do not start a metrics range.
const highlightOnly = applyHighlight(emptySnapshot(), "2026-09-01");
assert.deepEqual(periodDates(highlightOnly, 7, TODAY), [TODAY], "a highlight is not a metric for analytics");
assert.deepEqual(buildInsights(highlightOnly, 7, TODAY), []);

// Once history exceeds the window, the normal rolling window is used.
const older = apply(av, setDayMetric(av, "2026-09-01", "steps", 1000, ctx));
assert.equal(periodDates(older, 7, TODAY).length, 7, "a 7-day window still ends at today");
assert.match(buildInsights(older, 7, TODAY).map((i) => i.text).join(" "), /Average steps over the last 7 days/, "enough history keeps the rolling label");

function applyHighlight(snapshot: Snapshot, date: string): Snapshot {
  const result = saveHighlight(snapshot, { date, title: "Milestone", description: "", tags: [], photo: null }, ctx);
  return apply(snapshot, result);
}

// --------------------------------------------------------------- highlights
let highlightSnap = emptySnapshot();
const highlightResult = saveHighlight(
  highlightSnap,
  { date: "2026-10-27", title: "First 10k run", description: "Felt great.", tags: ["running", "Running", " milestone "], photo: "data:image/jpeg;base64,AAAA" },
  ctx,
);
assert.ok(highlightResult.ok);
highlightSnap = applyChangeLocally(highlightSnap, highlightResult.change);
assert.equal(highlightSnap.highlights.length, 1);
assert.deepEqual(highlightSnap.highlights[0].tags, ["running", "milestone"], "tags are trimmed and de-duplicated");
const highlightId = highlightSnap.highlights[0].id;

const editedHighlight = saveHighlight(highlightSnap, { id: highlightId, date: "2026-10-27", title: "First 10k run", description: "Update", tags: [], photo: null }, ctx);
assert.ok(editedHighlight.ok);
highlightSnap = applyChangeLocally(highlightSnap, editedHighlight.change);
assert.equal(highlightSnap.highlights.length, 1, "editing a highlight does not duplicate it");
assert.equal(highlightSnap.highlights[0].description, "Update");
assert.equal(saveHighlight(highlightSnap, { date: TODAY, title: "   ", description: "", tags: [], photo: null }, ctx).ok, false);
assert.equal(saveHighlight(highlightSnap, { date: "2026-11-09", title: "Future", description: "", tags: [], photo: null }, ctx).ok, false);
assert.equal(saveHighlight(highlightSnap, { date: TODAY, title: "Bad photo", description: "", tags: [], photo: "https://example.com/x.jpg" }, ctx).ok, false);
highlightSnap = apply(highlightSnap, deleteHighlight(highlightSnap, highlightId));
assert.equal(highlightSnap.highlights.length, 0);
// Highlights never become the day's step/calorie value.
assert.equal(dayMetrics(highlightSnap, "2026-10-27").steps, null);

// ---------------------------------------------------------- save all + undo
const saveAll = mergeChanges([
  setDayMetrics(emptySnapshot(), TODAY, { steps: 4000, calories: 2000, sleepMinutes: 420 }, ctx),
  addWater(emptySnapshot(), { date: TODAY, ml: 250 }, ctx),
]);
assert.ok(saveAll.ok);
assert.equal(saveAll.change.puts.length, 2, "Save All writes one merged day record plus the water entry");
const savedAll = applyChangeLocally(emptySnapshot(), saveAll.change);
assert.equal(savedAll.days[0].steps, 4000);
assert.equal(savedAll.days[0].calories, 2000);
assert.equal(savedAll.days[0].sleepMinutes, 420);
assert.equal(savedAll.water.length, 1);

const cancelUndo = invertChange(emptySnapshot(), saveAll.change);
assert.deepEqual(cancelUndo.puts, []);
assert.deepEqual(cancelUndo.deletes, [{ store: "days", key: TODAY }, { store: "water", key: savedAll.water[0].id }]);
assert.equal(applyChangeLocally(savedAll, cancelUndo).days.length, 0);
assert.equal(applyChangeLocally(savedAll, cancelUndo).water.length, 0);

// Editing several day metrics at once keeps the unmentioned ones.
const keepCalories = applyChangeLocally(savedAll, must(setDayMetrics(savedAll, TODAY, { steps: 5000, sleepMinutes: null }, ctx)));
assert.equal(keepCalories.days[0].steps, 5000);
assert.equal(keepCalories.days[0].calories, 2000);
assert.equal(keepCalories.days[0].sleepMinutes, null);

const badMerge = mergeChanges([setDayMetric(emptySnapshot(), TODAY, "steps", 100, ctx), setDayMetric(emptySnapshot(), TODAY, "steps", -5, ctx)]);
assert.equal(badMerge.ok, false);

// --------------------------------------------------------------- calendar
assert.equal(currentStreak(av, TODAY), 5, "Oct 28–Nov 1 all have data; Oct 27 breaks the streak");
assert.equal(currentStreak(emptySnapshot(), TODAY), 0);

const bucketDates = periodDates(av, 7, TODAY);
assert.equal(bucketDates.length, 7);
const stepSeriesRange = seriesForMetric(av, bucketDates, "steps");
const dailyBuckets = bucketSeries(stepSeriesRange, TODAY);
assert.equal(dailyBuckets.length, 7);
assert.equal(dailyBuckets[6].value, 9000);
assert.equal(dailyBuckets[4].value, null, "Oct 30 has no step entry, so that bucket is empty (not zero)");
assert.equal(dailyBuckets[4].loggedDays, 0);
const longHistory = apply(av, setDayMetric(av, "2026-08-15", "steps", 4000, ctx));
const weeklyBuckets = bucketSeries(seriesForMetric(longHistory, periodDates(longHistory, 90, TODAY), "steps"), TODAY);
assert.ok(weeklyBuckets.length >= 12);
assert.ok(weeklyBuckets.every((b) => b.value === null || Number.isFinite(b.value)));
assert.equal(periodDates(av, 0, TODAY).length, daysBetween("2026-10-26", TODAY) + 1, "all-time starts at the first record");

// ------------------------------------------------------------------ backup
snap = apply(snap, addWater(snap, { date: TODAY, ml: 500 }, ctx));
snap = apply(snap, addWeight(snap, { date: TODAY, kg: 78.2, time: "07:00" }, ctx));
snap = apply(snap, saveHighlight(snap, { date: TODAY, title: "Milestone", description: "A day", tags: ["tag"], photo: "data:image/png;base64,AAAA" }, ctx));
snap = apply(snap, saveSettings(snap, { stepGoal: 12_000, calorieGoal: 2200, waterGoalMl: 2500, weightGoalKg: 72.5, weightUnit: "lb", chartPeriod: 90 }));

const json = exportSnapshot(snap, new Date("2026-11-01T10:00:00Z"));
const parsed = validateBackup(JSON.parse(json));
assert.ok(parsed.ok, parsed.ok ? "" : parsed.error);
assert.equal(parsed.ok ? parsed.data.days.length : 0, snap.days.length);
assert.equal(parsed.ok ? parsed.data.weights.length : 0, snap.weights.length);
assert.equal(parsed.ok ? parsed.data.highlights[0].photo : null, "data:image/png;base64,AAAA", "highlight photos survive export");
assert.equal(parsed.ok ? parsed.data.settings.stepGoal : 0, 12_000);
assert.equal(parsed.ok ? parsed.data.settings.weightUnit : "", "lb");
assert.equal(parsed.ok ? parsed.data.settings.weightGoalKg : 0, 72.5, "weight goals survive export and import");

const broken = JSON.parse(json) as { data: { days: { steps?: unknown }[] } };
broken.data.days[0].steps = 999_999;
assert.equal(validateBackup(broken).ok, false, "impossible values are rejected");
assert.equal(validateBackup({ format: "detailflows-money", version: 1, data: {} }).ok, false);
assert.equal(validateBackup(null).ok, false);
const duplicateWater = JSON.parse(json) as { data: { water: { id: string }[] } };
duplicateWater.data.water = [duplicateWater.data.water[0], { ...duplicateWater.data.water[0] }];
assert.equal(validateBackup(duplicateWater).ok, false, "duplicate ids are rejected");
const badSettings = JSON.parse(json) as { data: { settings: { stepGoal: number } } };
badSettings.data.settings.stepGoal = 0;
assert.equal(validateBackup(badSettings).ok, false);
const badWeightGoal = JSON.parse(json) as { data: { settings: { weightGoalKg: number } } };
badWeightGoal.data.settings.weightGoalKg = 1;
assert.equal(validateBackup(badWeightGoal).ok, false, "impossible weight goals are rejected on import");
const futureHighlight = JSON.parse(json) as { data: { highlights: { date: string }[] } };
futureHighlight.data.highlights[0].date = "2099-01-01";
assert.equal(validateBackup(futureHighlight).ok, true, "backups may contain any valid calendar date");

// Empty backup is valid.
assert.ok(validateBackup(JSON.parse(exportSnapshot(emptySnapshot()))).ok);

console.log("daily tests passed");
