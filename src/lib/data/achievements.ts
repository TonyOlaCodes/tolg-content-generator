import type { Achievement } from "@/lib/types";

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first_freestyle", title: "First Freestyle", description: "Record your first session.", icon: "mic" },
  { id: "10_min", title: "10 Minutes Recorded", description: "Accumulate 10 minutes of freestyle.", icon: "clock" },
  { id: "100_min", title: "100 Minutes Recorded", description: "Accumulate 100 minutes of freestyle.", icon: "clock" },
  { id: "5_min_run", title: "5 Minute Freestyle", description: "Complete a continuous 5-minute freestyle.", icon: "flame" },
  { id: "10_min_run", title: "10 Minute Freestyle", description: "Complete a continuous 10-minute freestyle.", icon: "flame" },
  { id: "refs_50", title: "50 References Used", description: "Use 50 reference concepts across sessions.", icon: "book" },
  { id: "refs_100", title: "100 References Used", description: "Use 100 reference concepts.", icon: "book" },
  { id: "refs_1000", title: "1000 References Used", description: "Use 1000 reference concepts.", icon: "book" },
  { id: "rhyme_20", title: "20 Word Rhyme Chain", description: "Extend a rhyme family to 20 entries.", icon: "repeat" },
  { id: "no_filler", title: "No Filler", description: "Finish a session with minimal detected filler.", icon: "ban" },
  { id: "association_machine", title: "Association Machine", description: "List 12+ associations in one Association Lab round.", icon: "git-branch" },
  { id: "punchline_streak", title: "Punchline Streak", description: "Complete 5 Punchline Builder rounds in a day.", icon: "zap" },
  { id: "seven_day", title: "Seven Day Streak", description: "Train seven days in a row.", icon: "calendar" },
];
