import type {
  AIAnalysis,
  AssociationNode,
  FreestyleSessionConfig,
  PracticeModeId,
  SkillKey,
  TranscriptSegment,
  UserProfile,
} from "@/lib/types";

export interface AnalyzeFreestyleInput {
  transcript: string;
  segments?: TranscriptSegment[];
  session: Partial<FreestyleSessionConfig> & { prompts?: string[]; durationSec?: number };
  profile?: Pick<UserProfile, "skills" | "focusSkills" | "struggles">;
  recordingId: string;
}

export interface GenerateExerciseInput {
  skill?: SkillKey;
  difficulty?: string;
  mode?: PracticeModeId;
}

export interface CoachInput {
  message: string;
  history?: { role: "user" | "assistant"; content: string }[];
  profileSummary?: string;
  recentContext?: string;
}

export interface SectionImproveInput {
  section: string;
  surrounding: string;
  transcript: string;
}

export interface AIProvider {
  analyzeFreestyle(input: AnalyzeFreestyleInput): Promise<AIAnalysis>;
  generateExercise(input: GenerateExerciseInput): Promise<{ title: string; steps: string[]; mode: PracticeModeId }>;
  generateAssociations(subject: string): Promise<AssociationNode[]>;
  evaluateWordplay(line: string, word?: string): Promise<{ score: number; notes: string[]; uncertain: boolean }>;
  coach(input: CoachInput): Promise<string>;
  improveSection(input: SectionImproveInput): Promise<string>;
}
