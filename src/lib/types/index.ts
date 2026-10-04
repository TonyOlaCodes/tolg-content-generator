export type Difficulty = "beginner" | "intermediate" | "advanced" | "elite" | "endless";

export type SkillKey =
  | "rhyming"
  | "flow"
  | "wordplay"
  | "references"
  | "creativity"
  | "vocabulary"
  | "continuity"
  | "punchlines"
  | "recovery"
  | "endurance";

export type PracticeModeId =
  | "random_word"
  | "object"
  | "image"
  | "person"
  | "association_lab"
  | "connection_game"
  | "double_meaning"
  | "reference_lab"
  | "rhyme_chain"
  | "multisyllabic"
  | "punchline_builder"
  | "topic_switch"
  | "survival_60"
  | "endurance"
  | "no_filler"
  | "story"
  | "surroundings"
  | "rapid_association"
  | "recovery"
  | "reference_chain"
  | "blind"
  | "free";

export type BeatCategory =
  | "trap"
  | "boom_bap"
  | "melodic"
  | "dark"
  | "soul"
  | "lofi"
  | "upbeat"
  | "slow"
  | "experimental";

export type ReferenceCategory =
  | "people"
  | "athletes"
  | "basketball"
  | "football"
  | "boxing"
  | "rappers"
  | "music"
  | "actors"
  | "movies"
  | "tv"
  | "anime"
  | "video_games"
  | "brands"
  | "cars"
  | "technology"
  | "countries"
  | "cities"
  | "history"
  | "science"
  | "mythology"
  | "food"
  | "objects"
  | "slang"
  | "internet";

export interface SkillScore {
  skill: SkillKey;
  score: number;
  xp: number;
}

export interface UserSettings {
  trainingGoal: string;
  preferredGenres: BeatCategory[];
  preferredBpm: number;
  promptFrequencySec: number;
  difficulty: Difficulty;
  explicitLanguage: boolean;
  dailyTrainingMinutes: 15 | 30 | 60;
  countdownSec: number;
  aiFeedback: boolean;
  livePrompts: boolean;
  distractionFree: boolean;
  lastBeatId: string | null;
}

export interface UserProfile {
  id: string;
  displayName: string;
  experience: "beginner" | "some" | "good" | "advanced";
  struggles: string[];
  focusSkills: SkillKey[];
  onboarded: boolean;
  level: number;
  xp: number;
  streak: number;
  lastPracticeDate: string | null;
  freestylesRecorded: number;
  minutesFreestyled: number;
  longestFreestyleSec: number;
  overallRating: number;
  skills: Record<SkillKey, number>;
  skillXp: Record<SkillKey, number>;
  settings: UserSettings;
  unlockedAchievements: string[];
  createdAt: string;
}

export interface Beat {
  id: string;
  title: string;
  category: BeatCategory;
  bpm: number;
  key?: string;
  durationSec: number;
  style: string;
  src: string;
  isCustom?: boolean;
}

export interface Prompt {
  id: string;
  type: "word" | "object" | "person" | "image" | "topic" | "rhyme" | "story";
  value: string;
  meta?: Record<string, string | string[] | number>;
}

export interface TranscriptSegment {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  confidence?: number;
}

export interface RecordingMeta {
  id: string;
  createdAt: string;
  durationSec: number;
  beatId: string | null;
  beatTitle: string | null;
  mode: PracticeModeId;
  difficulty: Difficulty;
  prompts: string[];
  attemptGroupId?: string;
  attemptNumber?: number;
  blobKey: string;
  transcript?: TranscriptSegment[];
  analysisId?: string;
  title?: string;
}

export interface FreestyleSessionConfig {
  beatId: string | null;
  durationSec: number | null;
  mode: PracticeModeId;
  promptFrequencySec: number;
  difficulty: Difficulty;
  aiFeedback: boolean;
  livePrompts: boolean;
  distractionFree: boolean;
  customPrompts?: string[];
}

export interface AssociationNode {
  id: string;
  label: string;
  children?: AssociationNode[];
  route?: string;
}

export interface ReferenceEntry {
  id: string;
  name: string;
  category: ReferenceCategory;
  shortDescription: string;
  knownFor: string[];
  aliases: string[];
  importantNumbers: string[];
  people: string[];
  places: string[];
  objects: string[];
  events: string[];
  associatedWords: string[];
  literalMeanings: string[];
  homophones: string[];
  wordplayRoutes: string[];
  associationTree: AssociationNode[];
}

export interface WordEntry {
  id: string;
  word: string;
  definitions: string[];
  alternateMeanings: string[];
  homophones: string[];
  phrases: string[];
  idioms: string[];
  rhymes: string[];
  slantRhymes: string[];
  associatedConcepts: string[];
  opposites: string[];
  popCulture: string[];
}

export interface LessonStep {
  id: string;
  title: string;
  body: string;
  interactive?: {
    type: "rhyme_family" | "association_tree" | "double_meaning" | "bridge" | "quiz";
    payload: Record<string, unknown>;
  };
}

export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  summary: string;
  durationMin: number;
  xpReward: number;
  skills: SkillKey[];
  steps: LessonStep[];
}

export interface LessonModule {
  id: string;
  number: number;
  title: string;
  description: string;
  lessonIds: string[];
}

export interface ExerciseDefinition {
  id: PracticeModeId;
  title: string;
  subtitle: string;
  description: string;
  durationMin: number;
  skills: SkillKey[];
  icon: string;
  featured?: boolean;
}

export interface AIAnalysis {
  id: string;
  recordingId: string;
  createdAt: string;
  overallScore: number;
  maxScore: number;
  skills: Record<SkillKey | "promptUsage", number>;
  bestMoments: { text: string; reason: string; startMs?: number; endMs?: number }[];
  bestBar?: string;
  bestReference?: string;
  bestRhymeChain?: string;
  bestTransition?: string;
  cleverReferences: string[];
  doubleMeanings: { phrase: string; meanings: string[]; confidence: "high" | "medium" | "uncertain" }[];
  rhymeChains: string[][];
  repeatedWords: { word: string; count: number }[];
  fillerPhrases: { phrase: string; count: number }[];
  missedOpportunities: { from: string; route: string[]; idea: string }[];
  suggestedAssociations: string[];
  recommendedDrills: { mode: PracticeModeId; title: string; reason: string }[];
  highlights: {
    start: number;
    end: number;
    kind: "rhyme" | "reference" | "wordplay" | "filler" | "callback" | "prompt";
    label: string;
    explanation: string;
  }[];
  summary: string;
  uncertainNotes: string[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export interface DailyChallenge {
  id: string;
  date: string;
  title: string;
  description: string;
  mode: PracticeModeId;
  targetSec: number;
  xpReward: number;
  completed: boolean;
}

export interface DailySessionItem {
  mode: PracticeModeId;
  title: string;
  detail: string;
  durationMin: number;
  rounds?: number;
}

export interface ProgressPoint {
  date: string;
  overall: number;
  skills: Partial<Record<SkillKey, number>>;
  durationSec: number;
  fillerRate: number;
  uniqueVocab: number;
  promptSuccess: number;
}

export interface UserVocabulary {
  wordCounts: Record<string, number>;
  referenceCounts: Record<string, number>;
  associationEdges: { from: string; to: string; count: number }[];
}

export interface CoachMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface TrainingSessionPlan {
  id: string;
  title: string;
  totalMin: number;
  items: DailySessionItem[];
  focusSkill?: SkillKey;
}
