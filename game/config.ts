/**
 * Shared tuning constants. The server owns the simulation, the client reads these
 * only for rendering and for input feel (camera speed, interpolation, etc.).
 * Every value here is a deliberate balance knob - see README "Tuning" section.
 */

export const TICK_HZ = 20;
export const TICK_MS = 1000 / TICK_HZ;
/** how many ticks between snapshots (20Hz sim -> 10Hz network snapshots) */
export const SNAPSHOT_TICKS = 2;

export const TILE = 32;
export const MAP_W = 40;
export const MAP_H = 28;

export const PLAYER_RADIUS = 9;
/** tiles per second */
export const PLAYER_SPEED = 3.35;
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 8;

export const MATCH_SECONDS = 360;
export const ROLE_REVEAL_SECONDS = 10;
export const LOBBY_IDLE_SECONDS = 60 * 30;
export const RESULTS_SECONDS = 75;

/** work units each player is expected to contribute over a full match */
export const WORK_QUOTA_PER_PLAYER = 12;
export const ACTIVE_TASKS_PER_PLAYER = 3;

export const INTERACT_RANGE = 1.7;
export const ABILITY_RANGE = 4.2;
export const EMOTE_SECONDS = 2.4;

/**
 * Elephant growth stages are driven by the exposure meter: at each threshold the
 * elephant gets bigger, faster and less concealable.
 */
export interface ElephantStage {
  at: number;
  scale: number;
  speed: number;
  /** tiles per second */
  sight: number;
  label: string;
}
export const ELEPHANT_STAGES: ElephantStage[] = [
  { at: 0, scale: 0.8, speed: 1.5, sight: 4.5, label: "Suspiciously Large Dog" },
  { at: 25, scale: 1.15, speed: 1.75, sight: 5.5, label: "Definitely An Elephant" },
  { at: 50, scale: 1.5, speed: 2.0, sight: 6.5, label: "Structurally Concerning" },
  { at: 75, scale: 1.9, speed: 2.35, sight: 8, label: "The Elephant In The Room" },
];

/** exposure meter gain per second, per guest that can currently see the elephant */
export const EXPOSURE_RATE = 3.0;
export const EXPOSURE_RATE_VIP = 5.0;
export const EXPOSURE_RATE_MANAGER = 4.0;
/** exposure lost per second once nobody has seen the elephant for the grace period */
export const EXPOSURE_DECAY = 0.85;
export const EXPOSURE_DECAY_GRACE = 3.5;
/** players standing between a guest and the elephant block the sight-line (crowd cover) */
export const CROWD_COVER_RADIUS = 2.2;
export const CROWD_COVER_FACTOR = 0.45;

export const NOISE_EXPOSURE = 3;
export const SHERIFF_WRONG_EXPOSURE = 22;
export const SHERIFF_CORRECT_SUSPEND = 30;
export const VOTE_WRONG_EXPOSURE = 15;
export const VOTE_CORRECT_SUSPEND = 60;
export const SUSPENDED_SABOTAGE_PENALTY = 1.6;

export const INCIDENT_INTERVAL = 26;
export const INCIDENT_FIRST_AT = 25;
/** elephant never holds a corridor hostage longer than this */
export const ELEPHANT_BLOCK_TIMEOUT = 16;
export const ELEPHANT_SLEEP_MIN = 8;
export const ELEPHANT_SLEEP_MAX = 18;

export const VOTE_SECONDS = 25;
export const RECONNECT_WINDOW_MS = 120_000;
/** if fewer than this many players stay connected the match pauses, then ends */
export const PAUSE_BELOW_PLAYERS = 3;
export const ABANDON_AFTER_PAUSE_SECONDS = 45;

export const DOOR_AUTO_CLOSE = false;

export const SERVER_PORT = Number(process.env.PORT ?? 3001);
export const MAX_ROOMS = 400;
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
