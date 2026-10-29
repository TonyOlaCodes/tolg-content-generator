import type { ExerciseDefinition } from "./types";

/** Full library. Only `status: "ready"` exercises run real analyzers. */
export const EXERCISE_LIBRARY: ExerciseDefinition[] = [
  // Priority ready set
  {
    id: "bench_press",
    name: "Barbell Bench Press",
    category: "powerlifting",
    kind: "rep",
    status: "ready",
    blurb: "Bar path, press velocity, elbow angles, pause detection.",
    cameraHint: "side",
    effortFocus: ["chest", "triceps", "front delts"],
    gaugeLabel: "BAR HEIGHT",
    graphTitle: "BAR HEIGHT",
    graphSubtitle: "0% = lockout · 100% = deepest press",
  },
  {
    id: "deadlift",
    name: "Conventional Deadlift",
    category: "powerlifting",
    kind: "rep",
    status: "ready",
    blurb: "Bar trajectory, hip/shoulder timing, sticking-point region.",
    cameraHint: "side",
    effortFocus: ["glutes", "hamstrings", "back"],
    gaugeLabel: "BAR HEIGHT",
    graphTitle: "BAR HEIGHT",
    graphSubtitle: "0% = floor · 100% = lockout",
  },
  {
    id: "squat",
    name: "High-Bar Squat",
    category: "powerlifting",
    kind: "rep",
    status: "ready",
    blurb: "Depth estimate, hip/knee angles, ascent velocity.",
    cameraHint: "side",
    effortFocus: ["quads", "glutes", "adductors"],
    gaugeLabel: "DEPTH",
    graphTitle: "HIP DEPTH",
    graphSubtitle: "0% = stand · 100% = deepest squat",
  },
  {
    id: "pull_up",
    name: "Pull-Up",
    category: "calisthenics",
    kind: "rep",
    status: "ready",
    blurb: "Chin vs bar, lockout, shoulder-height graph, sway.",
    cameraHint: "front",
    effortFocus: ["lats", "upper back", "biceps"],
    gaugeLabel: "CHIN @ BAR",
    graphTitle: "SHOULDER HEIGHT",
    graphSubtitle: "0% = dead hang · 100% = best rep",
  },
  {
    id: "crunch",
    name: "Crunch",
    category: "core",
    kind: "rep",
    status: "ready",
    blurb: "Torso flexion angle, rep tempo, ROM consistency.",
    cameraHint: "side",
    effortFocus: ["abs"],
    gaugeLabel: "FLEXION",
    graphTitle: "TORSO FLEXION",
    graphSubtitle: "0% = extended · 100% = peak crunch",
  },

  // Planned — visible in menu, no fake analysis
  planned("paused_bench", "Paused Bench Press", "powerlifting", "rep"),
  planned("incline_bench", "Incline Bench Press", "powerlifting", "rep"),
  planned("sumo_deadlift", "Sumo Deadlift", "powerlifting", "rep"),
  planned("romanian_deadlift", "Romanian Deadlift", "powerlifting", "rep"),
  planned("low_bar_squat", "Low-Bar Squat", "powerlifting", "rep"),
  planned("front_squat", "Front Squat", "powerlifting", "rep"),
  planned("ohp", "Overhead Press", "powerlifting", "rep"),
  planned("db_bench", "Dumbbell Bench Press", "bodybuilding", "rep"),
  planned("incline_db", "Incline Dumbbell Press", "bodybuilding", "rep"),
  planned("chest_fly", "Chest Fly", "bodybuilding", "rep"),
  planned("barbell_row", "Barbell Row", "bodybuilding", "rep"),
  planned("db_row", "Dumbbell Row", "bodybuilding", "rep"),
  planned("lat_pulldown", "Lat Pulldown", "bodybuilding", "rep"),
  planned("seated_row", "Seated Cable Row", "bodybuilding", "rep"),
  planned("bicep_curl", "Bicep Curl", "bodybuilding", "rep"),
  planned("hammer_curl", "Hammer Curl", "bodybuilding", "rep"),
  planned("tricep_pushdown", "Tricep Pushdown", "bodybuilding", "rep"),
  planned("lateral_raise", "Lateral Raise", "bodybuilding", "rep"),
  planned("front_raise", "Front Raise", "bodybuilding", "rep"),
  planned("leg_press", "Leg Press", "bodybuilding", "rep"),
  planned("leg_extension", "Leg Extension", "bodybuilding", "rep"),
  planned("leg_curl", "Leg Curl", "bodybuilding", "rep"),
  planned("hip_thrust", "Hip Thrust", "bodybuilding", "rep"),
  planned("bulgarian_ss", "Bulgarian Split Squat", "bodybuilding", "rep"),
  planned("lunge", "Lunges", "bodybuilding", "rep"),
  planned("calf_raise", "Calf Raises", "bodybuilding", "rep"),
  planned("chin_up", "Chin-Up", "calisthenics", "rep"),
  planned("weighted_pull_up", "Weighted Pull-Up", "calisthenics", "rep"),
  planned("dip", "Dips", "calisthenics", "rep"),
  planned("weighted_dip", "Weighted Dips", "calisthenics", "rep"),
  planned("push_up", "Push-Up", "calisthenics", "rep"),
  planned("diamond_push_up", "Diamond Push-Up", "calisthenics", "rep"),
  planned("pike_push_up", "Pike Push-Up", "calisthenics", "rep"),
  planned("muscle_up", "Muscle-Up", "calisthenics", "rep"),
  planned("sit_up", "Sit-Up", "core", "rep"),
  planned("hanging_leg_raise", "Hanging Leg Raises", "core", "rep"),
  planned("hanging_knee_raise", "Hanging Knee Raises", "core", "rep"),
  planned("lying_leg_raise", "Lying Leg Raises", "core", "rep"),
  planned("reverse_crunch", "Reverse Crunches", "core", "rep"),
  planned("russian_twist", "Russian Twists", "core", "alternating"),
  planned("bicycle_crunch", "Bicycle Crunches", "core", "alternating"),
  planned("mountain_climber", "Mountain Climbers", "core", "alternating"),
  planned("plank", "Plank", "core", "hold"),
  planned("side_plank", "Side Plank", "core", "hold"),
  planned("ab_wheel", "Ab Wheel Rollouts", "core", "rep"),
  planned("flutter_kick", "Flutter Kicks", "core", "alternating"),
  planned("cable_crunch", "Cable Crunches", "core", "rep"),
];

function planned(
  id: string,
  name: string,
  category: ExerciseDefinition["category"],
  kind: ExerciseDefinition["kind"],
): ExerciseDefinition {
  return {
    id,
    name,
    category,
    kind,
    status: "planned",
    blurb: "Listed in the library — analysis engine not implemented yet.",
    cameraHint: "any",
    effortFocus: [],
    gaugeLabel: "SIGNAL",
    graphTitle: "MOVEMENT",
    graphSubtitle: "Coming soon",
  };
}

export function getExercise(id: string): ExerciseDefinition | undefined {
  return EXERCISE_LIBRARY.find((e) => e.id === id);
}

export function readyExercises(): ExerciseDefinition[] {
  return EXERCISE_LIBRARY.filter((e) => e.status === "ready");
}

export function exercisesByCategory(): Record<string, ExerciseDefinition[]> {
  const out: Record<string, ExerciseDefinition[]> = {};
  for (const e of EXERCISE_LIBRARY) {
    (out[e.category] ??= []).push(e);
  }
  return out;
}
