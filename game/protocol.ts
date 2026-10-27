/**
 * The wire protocol between the game client and the authoritative server.
 * Everything the client learns about the world arrives in a `snap` message;
 * secrets (roles, teammates, puzzles, private notices) arrive separately and are
 * only ever sent to the socket they belong to.
 */

import type { RoleId, SabotageId, TaskKindId, ZoneId, AvatarId } from "./content";

export type Team = "employees" | "imposters";
export type Phase = "lobby" | "reveal" | "playing" | "results";

export interface RoomSettings {
  /** only "hotel" is implemented; kept explicit so more maps can slot in */
  location: "hotel";
  modifiers: ModifierId[];
  matchSeconds: number;
  workQuotaPerPlayer: number;
  incidentsEnabled: boolean;
  /** 1 = relaxed, 2 = standard, 3 = chaos */
  elephantAggression: 1 | 2 | 3;
}

export type ModifierId =
  | "doubleTrouble"
  | "nightShift"
  | "rushHour"
  | "quietHours"
  | "vipVisit"
  | "tinyHotel";

export interface LobbyPlayer {
  id: string;
  nickname: string;
  avatar: AvatarId;
  ready: boolean;
  host: boolean;
  connected: boolean;
}

export interface PlayerView {
  id: string;
  nickname: string;
  avatar: AvatarId;
  x: number;
  y: number;
  /** velocity in px/s, used for client-side dead reckoning between snapshots */
  vx: number;
  vy: number;
  /** 0 = down, 1 = left, 2 = up, 3 = right */
  dir: number;
  moving: boolean;
  carrying: string | null;
  emote: string | null;
  emoteAt: number;
  tasksDone: number;
  /** temporarily unable to use sabotage abilities (arrest / vote result) */
  suspended: boolean;
  /** the sheriff has arrested this player this round (cosmetic + ability lock) */
  arrested: boolean;
  connected: boolean;
  zone: ZoneId;
}

export interface ElephantView {
  x: number;
  y: number;
  dir: number;
  state: string;
  /** human readable, shown in the HUD so players can react */
  stateLabel: string;
  stage: number;
  scale: number;
  asleep: boolean;
  moving: boolean;
  /** the elephant is currently wedged in a doorway */
  blocking: boolean;
  trunk: number;
}

export interface GuestView {
  id: string;
  label: string;
  kind: "guest" | "vip" | "manager";
  x: number;
  y: number;
  dir: number;
  moving: boolean;
  /** just saw the elephant */
  alarmed: boolean;
  /** reached by a player who calmed them down */
  soothed: boolean;
  zone: ZoneId;
}

export interface DoorView {
  id: string;
  open: boolean;
}

export interface SpillView {
  id: string;
  x: number;
  y: number;
  /** 0..1 cleaned */
  cleaned: number;
  kind: "water" | "food" | "soap";
}

export interface BaitView {
  id: string;
  x: number;
  y: number;
  /** 0..1 eaten */
  eaten: number;
}

export interface FeedEntry {
  id: number;
  text: string;
  tone: "info" | "warn" | "good" | "bad" | "elephant" | "guest";
  at: number;
  /** optional sound cue the client synthesises locally (no audio files ship) */
  sfx?: string;
}

export interface Snapshot {
  tick: number;
  phase: Phase;
  paused: boolean;
  timeLeft: number;
  /** server clock (ms) so clients can align timers without trusting their own clock */
  serverTime: number;
  work: { done: number; quota: number };
  exposure: number;
  exposureTrend: number;
  players: PlayerView[];
  elephant: ElephantView;
  guests: GuestView[];
  doors: DoorView[];
  spills: SpillView[];
  baits: BaitView[];
  dark: ZoneId[];
  blockedRoutes: string[];
  feed: FeedEntry[];
  tasksCompleted: number;
  tasksFailed: number;
}

export interface TaskInstance {
  id: string;
  kind: TaskKindId;
  stationId: string;
  stationName: string;
  room: ZoneId;
  label: string;
  requiresPlayers: number;
  /** imposters get convincing fake work that never moves the meter */
  fake: boolean;
  progress: number;
}

export interface RoleCard {
  role: RoleId;
  name: string;
  team: Team;
  winCondition: string;
  blurb: string;
  abilityName: string | null;
  abilityBlurb: string | null;
  abilityCooldown: number;
  abilityUses: number;
}

export interface PuzzleSpec {
  taskId: string;
  kind: TaskKindId;
  title: string;
  prompt: string;
  timeLimit: number;
  data: Record<string, unknown>;
}

export interface InvestigationView {
  open: boolean;
  openedBy: string;
  endsAt: number;
  votes: { from: string; fromNick: string; target: string | "skip" }[];
  /** set once the investigation has been resolved this round */
  used: boolean;
  result: string | null;
}

export interface PlayerResult {
  id: string;
  nickname: string;
  avatar: AvatarId;
  role: RoleId;
  roleName: string;
  team: Team;
  tasksDone: number;
  sabotages: number;
  arrests: number;
  playerSpotted: number;
  connected: boolean;
  wasImposter: boolean;
}

export interface ResultsPayload {
  winner: Team;
  reason: string;
  work: { done: number; quota: number };
  exposure: number;
  players: PlayerResult[];
  /** funny highlights: real logged events, phrased for the reveal screen */
  incidents: string[];
  mvp: string | null;
  elephantStage: string;
}

export type ClientMessage =
  | {
      t: "join";
      code: string | null;
      nickname: string;
      avatar: AvatarId;
      playerId?: string;
      token?: string;
    }
  | { t: "settings"; patch: Partial<RoomSettings> }
  | { t: "avatar"; avatar: AvatarId }
  | { t: "ready"; ready: boolean }
  | { t: "start" }
  | { t: "rematch" }
  | { t: "input"; seq: number; mx: number; my: number }
  | { t: "interact" }
  | { t: "taskOpen"; stationId: string }
  | { t: "taskSubmit"; taskId: string; answer: unknown }
  | { t: "taskCancel"; taskId: string; partial?: number }
  | { t: "sabotage"; kind: SabotageId; target?: string }
  | { t: "ability"; targetId?: string }
  | { t: "investigate" }
  | { t: "vote"; targetId: string | "skip" }
  | { t: "emote"; emote: string }
  | { t: "ping"; ts: number };

export type ServerMessage =
  | { t: "welcome"; playerId: string; token: string; code: string; host: boolean; resumed: boolean }
  | { t: "error"; message: string; fatal?: boolean }
  | { t: "lobby"; code: string; hostId: string; settings: RoomSettings; players: LobbyPlayer[]; you: string }
  | { t: "phase"; phase: Phase; endsAt: number; timeLeft: number }
  | { t: "role"; card: RoleCard; teammates: { id: string; nickname: string; role: RoleId }[] }
  | { t: "tasks"; tasks: TaskInstance[] }
  | { t: "puzzle"; puzzle: PuzzleSpec }
  | { t: "taskResult"; taskId: string; ok: boolean; reason?: string; needsPlayers?: number }
  | { t: "notice"; text: string; tone?: FeedEntry["tone"] }
  | { t: "ability"; name: string; cooldown: number; uses: number; readyAt: number }
  | { t: "sabotages"; cooldowns: Record<string, number>; uses: Record<string, number> }
  | { t: "investigation"; state: InvestigationView; suspects: { id: string; nickname: string; avatar: AvatarId }[] }
  | { t: "snap"; snap: Snapshot }
  | { t: "results"; results: ResultsPayload }
  | { t: "pong"; ts: number; serverTime: number }
  | { t: "kick"; reason: string };
