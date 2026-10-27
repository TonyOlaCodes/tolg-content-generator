/**
 * The elephant. Personality first: a weighted state machine that wanders, raids
 * food, naps on beds, blocks doorways, knocks luggage over, interrupts whoever
 * is working and follows the most active player.
 *
 * Fairness rules baked in:
 *  - every state has a hard timeout, so the elephant can never permanently hold a
 *    route or a station hostage,
 *  - a stuck detector forces a new decision when it stops making progress,
 *  - interrupting a player only costs them time - tasks can always be retried.
 */

import {
  ELEPHANT_BLOCK_TIMEOUT,
  ELEPHANT_SLEEP_MAX,
  ELEPHANT_SLEEP_MIN,
  ELEPHANT_STAGES,
} from "../game/config";
import { FOOD_ROOMS, ROOMS, STATIONS, type StationDef, type ZoneId } from "../game/content";
import { gameMap } from "../game/map";
import type { ElephantRuntime, ElephantStateId, ServerPlayer } from "./state";
import type { Room } from "./room";

const STATE_LABELS: Record<ElephantStateId, string> = {
  wander: "Wandering the hotel",
  seekFood: "Looking for food",
  raidFood: "Raiding the dining room",
  sleep: "Asleep on the job",
  block: "Parked in a doorway",
  luggage: "Poking at luggage",
  interrupt: "Interrupting someone's work",
  follow: "Following someone interesting",
  bait: "Chasing the smell of food",
  calm: "Calm, for now",
  trumpet: "Making a noise about it",
};

export function stateLabel(state: ElephantStateId): string {
  return STATE_LABELS[state] ?? "Being an elephant";
}

export function createElephant(): ElephantRuntime {
  return {
    x: 20.5 * 32,
    y: 13.5 * 32,
    dir: 1,
    moving: false,
    state: "wander",
    stateUntil: 0,
    path: [],
    targetTile: null,
    asleep: false,
    blocking: false,
    calmUntil: 0,
    hunger: 0.3,
    stage: 0,
    scale: ELEPHANT_STAGES[0].scale,
    speed: ELEPHANT_STAGES[0].speed,
    sight: ELEPHANT_STAGES[0].sight,
    trunk: 0,
    ears: 0,
    stuckSince: 0,
    lastTile: { x: 20, y: 13 },
    desired: null,
    baitId: null,
    interruptCooldown: {},
    blockedAnchor: null,
  };
}

function stageFor(exposure: number): number {
  let stage = 0;
  ELEPHANT_STAGES.forEach((entry, index) => {
    if (exposure >= entry.at) stage = index;
  });
  return stage;
}

function tileOf(x: number, y: number): { x: number; y: number } {
  return { x: Math.floor(x / 32), y: Math.floor(y / 32) };
}

function randomTileInRoom(room: Room, zone: ZoneId): { x: number; y: number } {
  const definition = ROOMS.find((entry) => entry.id === zone) ?? ROOMS[3];
  return {
    x: definition.x + room.rng.int(0, Math.max(0, definition.w - 1)),
    y: definition.y + room.rng.int(0, Math.max(0, definition.h - 1)),
  };
}

/** force a behaviour from outside (incidents, sabotage control) */
export function forceElephantState(room: Room, state: ElephantStateId): void {
  enterState(room, state, room.now());
}

export function elephantTick(room: Room, dt: number): void {
  const e = room.elephant;
  const now = room.now();

  // growth is driven by the exposure meter
  const stage = stageFor(room.exposure);
  if (stage > e.stage) {
    e.stage = stage;
    const preset = ELEPHANT_STAGES[stage];
    e.scale = preset.scale;
    e.speed = preset.speed;
    e.sight = preset.sight;
    room.addFeed(`🐘 The elephant has grown. It is now "${preset.label}".`, "elephant", "grow");
  }

  e.trunk += dt * (e.moving ? 3.2 : 1.4);
  e.ears += dt * 2.2;
  e.hunger = Math.min(1, e.hunger + dt * 0.012);

  if (e.asleep) {
    e.moving = false;
    if (now >= e.stateUntil) {
      e.asleep = false;
      room.addFeed("😴 The elephant woke up and is looking for somewhere to be.", "elephant");
      enterState(room, "wander", now);
    }
    return;
  }

  if (e.calmUntil > now && e.state !== "calm") {
    e.state = "calm";
    e.stateUntil = e.calmUntil;
    e.path = [];
    e.targetTile = null;
    e.blocking = false;
  }

  // bait overrides idle behaviour
  const bait = room.baits.find((item) => item.eaten < 1);
  if (bait) {
    const distance = Math.hypot(bait.x - e.x, bait.y - e.y);
    if (distance < 12 * 32 && !["interrupt", "sleep", "block", "calm"].includes(e.state)) {
      if (e.state !== "bait" || e.baitId !== bait.id) {
        e.state = "bait";
        e.baitId = bait.id;
        e.blocking = false;
        const tile = tileOf(bait.x, bait.y);
        e.targetTile = tile;
        e.path = gameMap.findPath(tileOf(e.x, e.y), tile, room.doors) ?? [];
        e.stateUntil = now + 15_000;
      }
    }
  }

  if (now >= e.stateUntil) {
    enterState(room, "wander", now);
  }

  if (e.path.length > 0) {
    const node = e.path[0];
    const targetX = node.x * 32 + 16;
    const targetY = node.y * 32 + 16;
    const dx = targetX - e.x;
    const dy = targetY - e.y;
    const distance = Math.hypot(dx, dy);
    const step = e.speed * 32 * dt;
    if (distance <= step || distance === 0) {
      e.x = targetX;
      e.y = targetY;
      e.path.shift();
    } else {
      e.x += (dx / distance) * step;
      e.y += (dy / distance) * step;
    }
    e.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 1) : dy > 0 ? 0 : 2;
    e.moving = true;
  } else {
    e.moving = false;
    const roamingStates: ElephantStateId[] = [
      "wander",
      "seekFood",
      "sleep",
      "block",
      "luggage",
      "interrupt",
      "follow",
      "bait",
    ];
    if (roamingStates.includes(e.state) && now < e.stateUntil) {
      onArrive(room, now);
    }
  }

  // stuck detector: force a new decision if the elephant stops making progress
  const tile = tileOf(e.x, e.y);
  if (tile.x !== e.lastTile.x || tile.y !== e.lastTile.y) {
    e.lastTile = tile;
    e.stuckSince = now;
  } else if (now - e.stuckSince > 14_000 && !e.blocking && !e.asleep && e.state !== "raidFood") {
    e.stuckSince = now;
    if (e.state === "block") {
      e.blocking = false;
    }
    enterState(room, "wander", now);
  }
}

function enterState(room: Room, state: ElephantStateId, now: number): void {
  const e = room.elephant;
  e.state = state;
  e.blocking = false;
  e.asleep = false;
  e.baitId = null;
  e.desired = null;
  e.path = [];
  e.targetTile = null;

  const aggression = room.settings.elephantAggression;
  const stage = e.stage;

  switch (state) {
    case "seekFood":
    case "raidFood": {
      const zone = room.rng.pick(FOOD_ROOMS);
      const tile = randomTileInRoom(room, zone);
      e.state = "seekFood";
      e.targetTile = tile;
      e.path = gameMap.findPath(tileOf(e.x, e.y), tile, room.doors) ?? [];
      e.stateUntil = now + room.rng.int(9000, 16000);
      room.addFeed("🐘 The elephant is heading for the dining room.", "elephant");
      break;
    }
    case "sleep": {
      const beds: StationDef[] = STATIONS.filter((s) => s.kind === "bed");
      const bedTiles = beds.map((s) => ({ x: s.x + Math.floor(s.w / 2), y: s.y + s.h }));
      const doorway = gameMap.doorwayTiles;
      const tile = room.rng.pick(room.rng.shuffle([...bedTiles, ...doorway]));
      e.targetTile = tile;
      e.path = gameMap.findPath(tileOf(e.x, e.y), tile, room.doors) ?? [];
      e.desired = "sleep";
      e.stateUntil = now + 14_000;
      break;
    }
    case "block": {
      const candidates = [...gameMap.doorwayTiles].filter((tile) =>
        gameMap.elephantWalkable(tile.x, tile.y, room.doors),
      );
      if (candidates.length === 0) {
        enterState(room, "wander", now);
        return;
      }
      const tile = room.rng.pick(candidates);
      e.targetTile = tile;
      e.blockedAnchor = tile;
      e.path = gameMap.findPath(tileOf(e.x, e.y), tile, room.doors) ?? [];
      e.stateUntil = now + ELEPHANT_BLOCK_TIMEOUT * 1000;
      break;
    }
    case "luggage": {
      const targets: StationDef[] = STATIONS.filter(
        (s) => s.kind === "rack" || s.kind === "cart" || s.kind === "trolley",
      );
      if (targets.length === 0) {
        enterState(room, "wander", now);
        return;
      }
      const target = room.rng.pick(targets);
      e.targetTile = { x: target.x + Math.floor(target.w / 2), y: target.y + target.h };
      e.path = gameMap.findPath(tileOf(e.x, e.y), e.targetTile, room.doors) ?? [];
      e.stateUntil = now + 12_000;
      break;
    }
    case "interrupt": {
      const busy = room.connectedPlayers.find(
        (player: ServerPlayer) =>
          player.activeTaskId !== null &&
          player.team === "employees" &&
          now - (e.interruptCooldown[player.id] ?? 0) > 15_000,
      );
      if (!busy) {
        enterState(room, "wander", now);
        return;
      }
      const playerTile = tileOf(busy.x, busy.y);
      e.targetTile = playerTile;
      e.path = gameMap.findPath(tileOf(e.x, e.y), playerTile, room.doors) ?? [];
      e.stateUntil = now + 13_000;
      break;
    }
    case "follow": {
      const active = room.connectedPlayers
        .slice()
        .sort((a, b) => b.completedTasks + b.fakeTasksDone - (a.completedTasks + a.fakeTasksDone))[0];
      if (!active) {
        enterState(room, "wander", now);
        return;
      }
      e.targetTile = tileOf(active.x, active.y);
      e.path = gameMap.findPath(tileOf(e.x, e.y), e.targetTile, room.doors) ?? [];
      e.stateUntil = now + room.rng.int(8000, 13000);
      room.addFeed(`🐘 The elephant is following ${active.nickname}.`, "elephant");
      break;
    }
    case "trumpet": {
      e.stateUntil = now + 3000;
      room.addFeed("📣 The elephant trumpeted. Somewhere. Probably everywhere.", "elephant", "trumpet");
      room.raiseNoise(e.x, e.y, 9, 6000);
      room.applyExposure(room.settings.modifiers.includes("quietHours") ? 6 : 3);
      break;
    }
    case "calm": {
      e.stateUntil = now + 10_000;
      break;
    }
    default: {
      // wander: aim at a random room, weighted so the corridor stays its home turf
      const zones: ZoneId[] = ROOMS.map((entry) => entry.id);
      const weighted: ZoneId[] = [];
      zones.forEach((zone) => {
        const weight = zone === "corridor" ? 3 : 1;
        for (let i = 0; i < weight; i += 1) weighted.push(zone);
      });
      const tile = randomTileInRoom(room, room.rng.pick(weighted));
      e.targetTile = tile;
      e.path = gameMap.findPath(tileOf(e.x, e.y), tile, room.doors) ?? [];
      e.stateUntil = now + room.rng.int(7000, 14000) - aggression * 500 + stage * 500;
      break;
    }
  }
}

function onArrive(room: Room, now: number): void {
  const e = room.elephant;
  switch (e.state) {
    case "seekFood": {
      room.addFeed("🍽 The elephant is raiding the dining room.", "elephant", "munch");
      room.disruptMeal();
      e.state = "raidFood";
      e.stateUntil = now + 6000;
      break;
    }
    case "raidFood": {
      enterState(room, "wander", now);
      break;
    }
    case "sleep": {
      e.asleep = true;
      e.stateUntil = now + room.rng.int(ELEPHANT_SLEEP_MIN, ELEPHANT_SLEEP_MAX) * 1000;
      room.addFeed("😴 The elephant fell asleep. Right there. Loudly.", "elephant", "snore");
      break;
    }
    case "block": {
      if (!e.blocking) {
        e.blocking = true;
        room.addFeed("🚧 The elephant has parked itself in a doorway.", "elephant", "thud");
        room.raiseNoise(e.x, e.y, 5, 4000);
      }
      e.stateUntil = now + ELEPHANT_BLOCK_TIMEOUT * 1000;
      break;
    }
    case "luggage": {
      room.addFeed("🧳 The elephant knocked over the luggage.", "elephant", "crash");
      room.raiseNoise(e.x, e.y, 10, 8000);
      room.raiseExposureAround(e.x, e.y, 2);
      enterState(room, "wander", now);
      break;
    }
    case "interrupt": {
      const victim = room.connectedPlayers.find(
        (player) => Math.hypot(player.x - e.x, player.y - e.y) < 2.4 * 32,
      );
      if (victim && victim.activeTaskId) {
        const last = e.interruptCooldown[victim.id] ?? 0;
        if (now - last > 20_000) {
          e.interruptCooldown[victim.id] = now;
          room.interruptTask(victim, "The elephant sat on your work. You will have to start again.");
          room.addFeed(`🐘 The elephant interrupted ${victim.nickname}.`, "elephant", "thud");
        }
      }
      enterState(room, "wander", now);
      break;
    }
    case "bait": {
      const bait = room.baits.find((item) => item.id === e.baitId);
      if (bait) {
        bait.eaten = 1;
        room.addFeed("🍰 The elephant found the snack and looks very pleased with itself.", "elephant", "munch");
        room.raiseNoise(e.x, e.y, 6, 3000);
      }
      enterState(room, "wander", now);
      break;
    }
    default: {
      enterState(room, "wander", now);
    }
  }
}
