/**
 * The authoritative room. One instance per match: it owns players, roles, the
 * assignment of work, every sabotage and ability, the exposure/work meters, the
 * investigation vote and the win conditions. Clients only ever send *intents*
 * (`input`, `interact`, `taskSubmit`, ...); everything here validates them.
 */

import { randomUUID } from "node:crypto";
import {
  ABILITY_RANGE,
  ACTIVE_TASKS_PER_PLAYER,
  ELEPHANT_STAGES,
  EMOTE_SECONDS,
  EXPOSURE_DECAY,
  EXPOSURE_DECAY_GRACE,
  INTERACT_RANGE,
  MAX_PLAYERS,
  MIN_PLAYERS,
  NOISE_EXPOSURE,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  RESULTS_SECONDS,
  ROLE_REVEAL_SECONDS,
  SHERIFF_CORRECT_SUSPEND,
  SHERIFF_WRONG_EXPOSURE,
  SNAPSHOT_TICKS,
  TICK_MS,
  VOTE_CORRECT_SUSPEND,
  VOTE_SECONDS,
  VOTE_WRONG_EXPOSURE,
  ABANDON_AFTER_PAUSE_SECONDS,
  PAUSE_BELOW_PLAYERS,
  RECONNECT_WINDOW_MS,
} from "../game/config";
import {
  AVATARS,
  COOP_TASK_KINDS,
  DOORS,
  GUEST_ROUTE,
  PLAYER_SPAWNS,
  ROOMS,
  ROLES,
  SABOTAGES,
  STATIONS,
  TASKS,
  roleDef,
  sabotageDef,
  roomById,
  station as stationDef,
  taskDef,
  type RoleId,
  type SabotageId,
  type TaskKindId,
  type ZoneId,
} from "../game/content";
import { gameMap, stationApproachTiles } from "../game/map";
import { Rng } from "../game/rng";
import type {
  ClientMessage,
  FeedEntry,
  LobbyPlayer,
  PlayerResult,
  PlayerView,
  ResultsPayload,
  RoleCard,
  RoomSettings,
  ServerMessage,
  Snapshot,
  Team,
  InvestigationView,
} from "../game/protocol";
import { createElephant, elephantTick, forceElephantState, stateLabel } from "./elephant";
import { guestTick, soothGuestNear, spawnGuest } from "./guests";
import { incidentTick } from "./incidents";
import { generatePuzzle, validateAnswer } from "./tasks";
import {
  DEFAULT_SETTINGS,
  type Bait,
  type EvidenceEvent,
  type Guest,
  type ServerPlayer,
  type ServerTask,
  type Spill,
  type StationRuntime,
} from "./state";

interface Highlight {
  text: string;
  weight: number;
}

export class Room {
  readonly code: string;
  readonly rng: Rng;
  readonly players = new Map<string, ServerPlayer>();
  readonly order: string[] = [];
  hostId = "";
  settings: RoomSettings = { ...DEFAULT_SETTINGS, modifiers: [] };
  phase: "lobby" | "reveal" | "playing" | "results" = "lobby";
  phaseEndsAt = 0;
  paused = false;
  pausedSince = 0;
  tickCount = 0;
  elapsed = 0;
  timeLeft = 0;
  work = { done: 0, quota: 0 };
  exposure = 0;
  lastSightingAt = 0;
  exposureTrend = 0;
  doors = DOORS.map((door) => ({ id: door.id, open: door.startsOpen }));
  doorForce = new Map<string, number>();
  dark = new Map<ZoneId, number>();
  blockedRoutes: string[] = [];
  spills: Spill[] = [];
  baits: Bait[] = [];
  feed: FeedEntry[] = [];
  nextFeedId = 1;
  guests: Guest[] = [];
  nextGuestId = 1;
  complaints: { guestId: string; x: number; y: number; at: number }[] = [];
  elephant = createElephant();
  stations = new Map<string, StationRuntime>();
  incidentHistory = new Map<string, number>();
  nextIncidentAt = 0;
  nextGuestAt = 0;
  investigation = { open: false, openedBy: "", endsAt: 0, used: false, result: null as string | null };
  votes = new Map<string, string | "skip">();
  evidence: EvidenceEvent[] = [];
  highlights: Highlight[] = [];
  results: ResultsPayload | null = null;
  guestRoute = GUEST_ROUTE.map((entry) => ({ ...entry }));
  lastActivity = Date.now();
  private interval: ReturnType<typeof setInterval> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(code: string, seed = Date.now() >>> 0) {
    this.code = code;
    this.rng = new Rng(seed);
    for (const definition of STATIONS) {
      this.stations.set(definition.id, {
        id: definition.id,
        tampered: false,
        brokenUntil: 0,
        lastTouchedBy: null,
        lastTouchedAt: 0,
      });
    }
    this.interval = setInterval(() => this.tick(), TICK_MS);
  }

  now(): number {
    return Date.now();
  }

  destroy(): void {
    if (this.interval) clearInterval(this.interval);
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.interval = null;
  }

  /* ------------------------------------------------------------------ lobby */

  get playerList(): ServerPlayer[] {
    return this.order.map((id) => this.players.get(id)).filter((value): value is ServerPlayer => Boolean(value));
  }

  get connectedPlayers(): ServerPlayer[] {
    return this.playerList.filter((player) => player.connected);
  }

  connectedCount(): number {
    return this.connectedPlayers.length;
  }

  isIdle(): boolean {
    const now = this.now();
    return this.playerList.every(
      (player) => !player.connected && now - player.disconnectedAt > RECONNECT_WINDOW_MS,
    );
  }

  addPlayer(nickname: string, avatar: number): ServerPlayer | null {
    if (this.connectedCount() >= MAX_PLAYERS || this.players.size >= MAX_PLAYERS) return null;
    const id = randomUUID();
    const spawn = PLAYER_SPAWNS[this.players.size % PLAYER_SPAWNS.length];
    const player: ServerPlayer = {
      id,
      token: randomUUID(),
      nickname,
      avatar: this.clampAvatar(avatar),
      socket: null,
      connected: true,
      host: this.players.size === 0,
      ready: false,
      x: spawn[0] * 32 + 16,
      y: spawn[1] * 32 + 16,
      vx: 0,
      vy: 0,
      dir: 0,
      moving: false,
      input: { mx: 0, my: 0 },
      inputSeq: 0,
      role: "ordinary",
      team: "employees",
      tasks: [],
      completedTasks: 0,
      fakeTasksDone: 0,
      carrying: null,
      emote: null,
      emoteAt: 0,
      suspendedUntil: 0,
      arrestedUntil: 0,
      abilityReadyAt: 0,
      abilityUses: 0,
      sabotageReadyAt: 0,
      sabotageReady: {},
      sabotageUses: {},
      activeTaskId: null,
      taskOpenedAt: 0,
      fastSubmits: 0,
      slippedUntil: 0,
      sabotages: 0,
      arrests: 0,
      spottedByGuests: 0,
      disconnectedAt: 0,
      gone: false,
      votedFor: null,
      zone: gameMap.zoneAt(spawn[0], spawn[1]),
      lastMoveAt: this.now(),
    };
    this.players.set(id, player);
    this.order.push(id);
    if (!this.hostId) this.hostId = id;
    this.lastActivity = this.now();
    return player;
  }

  private clampAvatar(avatar: number): number {
    if (!Number.isFinite(avatar)) return 0;
    const index = Math.floor(avatar) % AVATARS.length;
    return index < 0 ? index + AVATARS.length : index;
  }

  findReconnect(playerId: string, token: string): ServerPlayer | null {
    const player = this.players.get(playerId);
    if (!player) return null;
    if (player.token !== token) return null;
    if (player.connected && player.socket) return null;
    return player;
  }

  attach(player: ServerPlayer, socket: ServerPlayer["socket"]): void {
    if (player.socket && player.socket !== socket) {
      try {
        player.socket.close(4001, "Replaced by a new connection");
      } catch {
        /* ignore */
      }
    }
    player.socket = socket;
    player.connected = true;
    player.disconnectedAt = 0;
    this.lastActivity = this.now();
    if (this.phase === "playing") this.evaluatePause();
  }

  markDisconnected(player: ServerPlayer): void {
    player.socket = null;
    player.connected = false;
    player.input = { mx: 0, my: 0 };
    player.disconnectedAt = this.now();
    this.votes.delete(player.id);
    player.votedFor = null;
    if (this.phase === "playing") this.evaluatePause();
    if (this.phase === "lobby") {
      this.broadcastLobby();
    }
    this.lastActivity = this.now();
  }

  removePlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player) return;
    this.players.delete(playerId);
    const index = this.order.indexOf(playerId);
    if (index >= 0) this.order.splice(index, 1);
    if (this.hostId === playerId) {
      this.hostId = this.playerList.find((entry) => entry.connected)?.id ?? this.order[0] ?? "";
    }
    if (this.phase === "lobby") this.broadcastLobby();
  }

  lobbyView(): { code: string; hostId: string; settings: RoomSettings; players: LobbyPlayer[] } {
    return {
      code: this.code,
      hostId: this.hostId,
      settings: this.settings,
      players: this.playerList.map((player) => ({
        id: player.id,
        nickname: player.nickname,
        avatar: player.avatar,
        ready: player.ready,
        host: player.id === this.hostId,
        connected: player.connected,
      })),
    };
  }

  broadcastLobby(): void {
    const view = this.lobbyView();
    for (const player of this.connectedPlayers) {
      this.send(player, { t: "lobby", ...view, you: player.id });
    }
  }

  /* ------------------------------------------------------- messaging helpers */

  send(player: ServerPlayer, message: ServerMessage): void {
    if (!player.socket || player.socket.readyState !== 1) return;
    try {
      player.socket.send(JSON.stringify(message));
    } catch {
      /* socket died; the close handler cleans up */
    }
  }

  broadcast(message: ServerMessage, exceptId?: string): void {
    for (const player of this.connectedPlayers) {
      if (player.id === exceptId) continue;
      this.send(player, message);
    }
  }

  notifyPlayers(text: string, tone: FeedEntry["tone"] = "info"): void {
    this.broadcast({ t: "notice", text, tone });
  }

  notify(player: ServerPlayer, text: string, tone: FeedEntry["tone"] = "info"): void {
    this.send(player, { t: "notice", text, tone });
  }

  addFeed(text: string, tone: FeedEntry["tone"] = "info", sfx?: string): void {
    this.feed.push({ id: this.nextFeedId++, text, tone, at: this.now(), sfx });
    if (this.feed.length > 60) this.feed.splice(0, this.feed.length - 60);
  }

  logEvidence(text: string, players: string[], sabotage: SabotageId | null = null): void {
    this.evidence.push({ at: this.now(), text, players, sabotage });
    if (this.evidence.length > 80) this.evidence.shift();
  }

  private highlight(text: string, weight: number): void {
    this.highlights.push({ text, weight });
    if (this.highlights.length > 40) this.highlights.shift();
  }

  zoneName(zone: ZoneId): string {
    return roomById(zone).name;
  }

  doorName(doorId: string): string {
    return DOORS.find((door) => door.id === doorId)?.name ?? "door";
  }

  stationName(stationId: string): string {
    return stationDef(stationId)?.name ?? "equipment";
  }

  /* -------------------------------------------------------------- match flow */

  startMatch(player: ServerPlayer): void {
    if (this.phase !== "lobby") {
      this.notify(player, "A match is already running.", "warn");
      return;
    }
    if (player.id !== this.hostId) {
      this.notify(player, "Only the host can start the match.", "warn");
      return;
    }
    const count = this.connectedCount();
    if (count < MIN_PLAYERS) {
      this.notify(player, `You need at least ${MIN_PLAYERS} players. Currently ${count}.`, "warn");
      return;
    }
    this.resetWorld();
    this.assignRoles();
    this.work.quota = Math.max(6, Math.round(this.settings.workQuotaPerPlayer * count));
    for (const member of this.playerList) {
      this.assignTasks(member);
      this.send(member, { t: "tasks", tasks: member.tasks });
    }
    this.phase = "reveal";
    this.phaseEndsAt = this.now() + ROLE_REVEAL_SECONDS * 1000;
    this.broadcastPhase();
    this.addFeed("🔔 The shift begins. Keep the elephant out of sight.", "info", "ding");
    this.broadcastLobby();
  }

  /** internal: the reveal timer expiring starts the shift (public so tests can drive it) */
  beginPlaying(): void {
    this.phase = "playing";
    this.phaseEndsAt = this.now() + this.settings.matchSeconds * 1000;
    this.elapsed = 0;
    this.timeLeft = this.settings.matchSeconds;
    this.nextIncidentAt = this.now() + 22_000;
    this.nextGuestAt = this.now() + 2500;
    this.lastSightingAt = 0;
    this.broadcastPhase();
    this.addFeed("🏨 Guests are arriving. Work the rooms, watch the corridor.", "info", "ding");
    if (this.settings.modifiers.includes("nightShift")) {
      for (const room of ROOMS) this.setDark(room.id, this.settings.matchSeconds * 1000);
      this.addFeed("🌙 Night shift: the hotel is dark from the start.", "warn", "bang");
    }
    if (this.settings.modifiers.includes("vipVisit")) {
      spawnGuest(this, "vip");
    }
    if (this.settings.modifiers.includes("tinyHotel")) {
      this.applyTinyHotel();
    }
  }

  private applyTinyHotel(): void {
    // cone off two doorway routes; the elephant and players must go around
    const candidates = gameMap.doorwayTiles.slice(0, 4);
    const chosen = this.rng.shuffle(candidates).slice(0, 2);
    const ids = chosen.map((tile) => `${tile.x},${tile.y}`);
    this.blockedRoutes = ids;
    this.addFeed("🚧 Two routes are coned off for maintenance.", "warn", "whoosh");
  }

  resetWorld(): void {
    const now = this.now();
    this.paused = false;
    this.elapsed = 0;
    this.timeLeft = this.settings.matchSeconds;
    this.work = { done: 0, quota: this.work.quota };
    this.exposure = 0;
    this.lastSightingAt = 0;
    this.exposureTrend = 0;
    this.doors = DOORS.map((door) => ({ id: door.id, open: door.startsOpen }));
    this.doorForce.clear();
    this.dark.clear();
    this.blockedRoutes = [];
    this.spills = [];
    this.baits = [];
    this.feed = [];
    this.guests = [];
    this.complaints = [];
    this.elephant = createElephant();
    this.incidentHistory.clear();
    this.investigation = { open: false, openedBy: "", endsAt: 0, used: false, result: null };
    this.votes.clear();
    this.evidence = [];
    this.highlights = [];
    this.results = null;
    this.guestRoute = GUEST_ROUTE.map((entry) => ({ ...entry }));
    for (const runtime of this.stations.values()) {
      runtime.tampered = false;
      runtime.brokenUntil = 0;
      runtime.lastTouchedBy = null;
      runtime.lastTouchedAt = 0;
    }
    this.playerList.forEach((player, index) => {
      const spawn = PLAYER_SPAWNS[index % PLAYER_SPAWNS.length];
      player.x = spawn[0] * 32 + 16;
      player.y = spawn[1] * 32 + 16;
      player.vx = 0;
      player.vy = 0;
      player.input = { mx: 0, my: 0 };
      player.tasks = [];
      player.completedTasks = 0;
      player.fakeTasksDone = 0;
      player.activeTaskId = null;
      player.abilityReadyAt = 0;
      player.abilityUses = 0;
      player.sabotageReadyAt = 0;
      player.sabotageReady = {};
      player.sabotageUses = {};
      player.suspendedUntil = 0;
      player.arrestedUntil = 0;
      player.slippedUntil = 0;
      player.sabotages = 0;
      player.arrests = 0;
      player.spottedByGuests = 0;
      player.votedFor = null;
      player.emote = null;
      player.emoteAt = 0;
      player.ready = false;
    });
    this.lastActivity = now;
  }

  private assignRoles(): void {
    const members = this.rng.shuffle(this.connectedPlayers);
    const count = members.length;
    const imposterCount = count >= 7 ? 2 : 1;
    const imposters = members.slice(0, imposterCount);
    const employees = members.slice(imposterCount);
    const pool: RoleId[] = ["sheriff", "detective", "mechanic", "whisperer", "janitor", "manager"];
    const employeeCount = employees.length;
    let specialCount = Math.max(0, Math.round(employeeCount * 0.6));
    if (employeeCount >= 3) specialCount = Math.min(specialCount, employeeCount - 1);
    specialCount = Math.min(specialCount, pool.length);
    // the sheriff always shows up when there are at least two employees: the
    // arrest - and the spectacular wrong arrest - is core to the game's comedy
    const specials: RoleId[] = ["sheriff"];
    if (specialCount > 1) {
      const rest = this.rng.shuffle(pool.filter((role) => role !== "sheriff"));
      specials.push(...rest.slice(0, specialCount - 1));
    }
    employees.forEach((player, index) => {
      player.role = index < specials.length ? specials[index] : "ordinary";
    });
    imposters.forEach((player) => {
      player.role = "imposter";
    });

    // pass 1: settle every role and team *before* anyone is told anything, so
    // teammate lists are complete no matter what order players joined in
    for (const player of this.playerList) {
      const def = roleDef(player.role);
      player.team = def.team;
      player.abilityUses = def.uses;
      player.abilityReadyAt = 0;
      player.sabotageReadyAt = 0;
      player.sabotageReady = {};
      player.sabotageUses = {};
      for (const sabotage of SABOTAGES) player.sabotageUses[sabotage.id] = sabotage.uses;
    }

    // pass 2: hand out the private cards
    for (const player of this.playerList) {
      const def = roleDef(player.role);
      const card: RoleCard = {
        role: def.id,
        name: def.name,
        team: def.team,
        winCondition:
          def.team === "employees"
            ? "Fill the Work Progress meter to 100% before the shift ends."
            : "Get the Exposure meter to 100%, or simply run out the clock.",
        blurb: def.blurb,
        abilityName: def.abilityName,
        abilityBlurb: def.abilityBlurb,
        abilityCooldown: def.cooldown,
        abilityUses: def.uses,
      };
      const teammates =
        def.team === "imposters"
          ? this.playerList
              .filter((other) => other.team === "imposters" && other.id !== player.id)
              .map((other) => ({ id: other.id, nickname: other.nickname, role: other.role }))
          : [];
      this.send(player, { t: "role", card, teammates });
      if (def.team === "imposters") this.sendSabotages(player);
      this.sendAbility(player);
      this.send(player, { t: "tasks", tasks: player.tasks });
    }
  }

  private sendAbility(player: ServerPlayer): void {
    const def = roleDef(player.role);
    if (!def.abilityName) return;
    this.send(player, {
      t: "ability",
      name: def.abilityName,
      cooldown: def.cooldown,
      uses: player.abilityUses,
      readyAt: player.abilityReadyAt,
    });
  }

  sendSabotages(player: ServerPlayer): void {
    if (player.team !== "imposters") return;
    const cooldowns: Record<string, number> = {};
    const uses: Record<string, number> = {};
    for (const sabotage of SABOTAGES) {
      cooldowns[sabotage.id] = player.sabotageReady[sabotage.id] ?? 0;
      uses[sabotage.id] = player.sabotageUses[sabotage.id] ?? sabotage.uses;
    }
    this.send(player, { t: "sabotages", cooldowns, uses });
  }

  private broadcastPhase(): void {
    this.broadcast({
      t: "phase",
      phase: this.phase,
      endsAt: this.phaseEndsAt,
      timeLeft: this.timeLeft,
    });
  }

  rematch(player: ServerPlayer): void {
    if (player.id !== this.hostId) {
      this.notify(player, "Only the host can start the next round.", "warn");
      return;
    }
    if (this.connectedCount() < MIN_PLAYERS) {
      this.notify(player, `You need at least ${MIN_PLAYERS} players for another round.`, "warn");
      return;
    }
    this.resetWorld();
    this.phase = "lobby";
    this.phaseEndsAt = 0;
    this.results = null;
    for (const member of this.playerList) member.ready = false;
    this.broadcastLobby();
    this.broadcastPhase();
    this.addFeed("🔄 Back to the lobby. Change the settings or go again.", "info", "ding");
  }

  private finish(winner: Team, reason: string): void {
    if (this.phase === "results") return;
    this.phase = "results";
    this.phaseEndsAt = this.now() + RESULTS_SECONDS * 1000;
    this.paused = false;
    for (const player of this.playerList) player.activeTaskId = null;
    const results = this.buildResults(winner, reason);
    this.results = results;
    this.broadcast({ t: "results", results });
    this.broadcastPhase();
  }

  private buildResults(winner: Team, reason: string): ResultsPayload {
    const players: PlayerResult[] = this.playerList.map((player) => {
      const def = roleDef(player.role);
      return {
        id: player.id,
        nickname: player.nickname,
        avatar: player.avatar,
        role: player.role,
        roleName: def.name,
        team: player.team,
        tasksDone: player.completedTasks,
        sabotages: player.sabotages,
        arrests: player.arrests,
        playerSpotted: player.spottedByGuests,
        connected: player.connected,
        wasImposter: player.team === "imposters",
      };
    });
    const employees = players.filter((entry) => entry.team === "employees");
    const imposters = players.filter((entry) => entry.team === "imposters");
    const mvpSource =
      winner === "employees"
        ? employees.sort((a, b) => b.tasksDone - a.tasksDone)[0]
        : imposters.sort((a, b) => b.sabotages - a.sabotages)[0];
    const incidentLines = this.highlights
      .slice()
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 8)
      .map((entry) => entry.text);
    if (incidentLines.length < 4) {
      for (const extra of this.evidence.slice(-6)) {
        if (incidentLines.length >= 6) break;
        incidentLines.push(`📝 ${extra.text}`);
      }
    }
    return {
      winner,
      reason,
      work: { ...this.work },
      exposure: Math.round(this.exposure),
      players,
      incidents: incidentLines,
      mvp: mvpSource ? mvpSource.nickname : null,
      elephantStage: ELEPHANT_STAGES[this.elephant.stage].label,
    };
  }

  /* ------------------------------------------------------------------- tasks */

  stationBusyFor(stationId: string, playerId: string): boolean {
    for (const player of this.playerList) {
      if (player.id === playerId) continue;
      if (player.activeTaskId && player.tasks.some((task) => task.id === player.activeTaskId && task.stationId === stationId)) {
        return true;
      }
    }
    return false;
  }

  assignTasks(player: ServerPlayer): void {
    if (player.team !== "employees" && player.team !== "imposters") return;
    let guard = 0;
    while (player.tasks.length < ACTIVE_TASKS_PER_PLAYER && guard < 24) {
      guard += 1;
      const candidates = STATIONS.filter((definition) => definition.tasks.length > 0);
      const weighted = candidates.map((definition) => {
        const distance = Math.hypot(
          (definition.x + definition.w / 2) * 32 - player.x,
          (definition.y + definition.h / 2) * 32 - player.y,
        );
        const elephantDistance = Math.hypot(
          (definition.x + definition.w / 2) * 32 - this.elephant.x,
          (definition.y + definition.h / 2) * 32 - this.elephant.y,
        );
        // prefer jobs away from the elephant and spread work across the hotel
        const sameRoom = definition.room === player.zone ? 0.6 : 1;
        return Math.max(
          0.1,
          sameRoom * (elephantDistance > 6 * 32 ? 1.4 : 0.7) * (distance > 12 * 32 ? 1.1 : 1),
        );
      });
      const scored = candidates.map((entry, index) => ({ entry, weight: weighted[index] ?? 1 }));
      const target = this.rng.weighted(scored, (item) => item.weight)?.entry ?? this.rng.pick(candidates);
      const kind: TaskKindId = this.rng.pick(target.tasks);
      const isImposter = player.team === "imposters";
      // cooperative variants exist so that a job sometimes needs a second pair
      // of hands standing at the same station
      const coopChance = COOP_TASK_KINDS.includes(kind) ? 0.3 : 0;
      const requiresPlayers = this.rng.chance(coopChance) ? 2 : 1;
      const taskId = randomUUID();
      const def = taskDef(kind);
      const generated = generatePuzzle(
        this.rng,
        kind,
        taskId,
        this.zoneName(target.room),
      );
      const task: ServerTask = {
        id: taskId,
        kind,
        stationId: target.id,
        stationName: target.name,
        room: target.room,
        label: def.name,
        requiresPlayers,
        fake: isImposter,
        progress: 0,
        solution: generated.solution,
        spec: generated.spec,
        spillId: null,
        participants: [],
        attempts: 0,
        openedAt: 0,
      };
      player.tasks.push(task);
      if (kind === "cleanSpill") {
        const spill = this.spawnSpill(
          (target.x + this.rng.int(-2, 2) + 0.5) * 32,
          (target.y + target.h + this.rng.int(1, 2) + 0.5) * 32,
          "soap",
        );
        task.spillId = spill.id;
      }
    }
  }

  private completeTask(player: ServerPlayer, task: ServerTask): void {
    const def = taskDef(task.kind);
    player.activeTaskId = null;
    player.tasks = player.tasks.filter((entry) => entry.id !== task.id);
    if (task.fake) {
      player.fakeTasksDone += 1;
      this.logEvidence(`Someone finished a ${def.name.toLowerCase()} at the ${task.stationName}.`, [player.id]);
    } else {
      player.completedTasks += 1;
      this.work.done += def.reward;
      this.logEvidence(`${player.nickname} finished ${def.name.toLowerCase()} at the ${task.stationName}.`, [player.id]);
      this.notify(player, `✅ ${def.name} done. +${def.reward} work.`, "good");
      if (task.spillId) {
        const spill = this.spills.find((entry) => entry.id === task.spillId);
        if (spill) spill.cleaned = 1;
      }
    }
    this.assignTasks(player);
    this.send(player, { t: "tasks", tasks: player.tasks });
    if (!task.fake && this.work.done >= this.work.quota) {
      this.addFeed("🏆 Work progress hit 100%. The hotel is somehow presentable.", "good", "win");
      this.finish("employees", "Every job on the list was finished.");
    }
  }

  interruptTask(player: ServerPlayer, reason: string): void {
    const task = player.tasks.find((entry) => entry.id === player.activeTaskId);
    player.activeTaskId = null;
    if (task) {
      this.send(player, { t: "taskResult", taskId: task.id, ok: false, reason });
    }
    this.notify(player, `💥 ${reason}`, "warn");
  }

  /* ------------------------------------------------- tasks: open and submit */

  private openTaskForStation(player: ServerPlayer, stationId: string): void {
    const definition = stationDef(stationId);
    if (!definition || !definition.interactive) {
      this.notify(player, "Nothing to do there.", "warn");
      return;
    }
    const runtime = this.stations.get(stationId);
    const now = this.now();
    if (runtime && runtime.brokenUntil > now) {
      this.notify(player, `The ${definition.name} is out of order.`, "warn");
      return;
    }
    if (runtime && runtime.tampered === "looseWheel") {
      this.triggerTrolleyCrash(player, stationId);
      return;
    }
    const task = player.tasks.find((entry) => entry.stationId === stationId);
    if (!task) {
      this.notify(player, `You have no job at the ${definition.name}.`, "warn");
      return;
    }
    this.openTask(player, task);
  }

  private openTask(player: ServerPlayer, task: ServerTask): void {
    const now = this.now();
    if (task.requiresPlayers > 1 && player.team === "employees") {
      const helpers = this.connectedPlayers.filter(
        (other) => other.id !== player.id && this.nearStation(other, task.stationId, 2.2),
      );
      if (helpers.length === 0) {
        this.send(player, {
          t: "taskResult",
          taskId: task.id,
          ok: false,
          reason: "This one needs two pairs of hands. Bring somebody.",
          needsPlayers: 2,
        });
        this.notify(player, "🤝 This job needs a second person standing here.", "warn");
        return;
      }
      task.participants = [player.id, helpers[0].id];
      this.send(helpers[0], { t: "puzzle", puzzle: task.spec });
    }
    player.activeTaskId = task.id;
    player.taskOpenedAt = now;
    task.openedAt = now;
    task.attempts = 0;
    player.fastSubmits = 0;
    this.send(player, { t: "puzzle", puzzle: task.spec });
  }

  private openSpillTask(player: ServerPlayer, spill: Spill): void {
    const taskId = randomUUID();
    const generated = generatePuzzle(this.rng, "cleanSpill", taskId, this.zoneName(gameMap.zoneAt(Math.floor(spill.x / 32), Math.floor(spill.y / 32))));
    const existing = player.tasks.find((entry) => entry.kind === "cleanSpill");
    const task: ServerTask = existing ?? {
      id: taskId,
      kind: "cleanSpill",
      stationId: `spill:${spill.id}`,
      stationName: "Spill",
      room: gameMap.zoneAt(Math.floor(spill.x / 32), Math.floor(spill.y / 32)),
      label: "Clean the Spill",
      requiresPlayers: 1,
      fake: player.team === "imposters",
      progress: 0,
      solution: generated.solution,
      spec: generated.spec,
      spillId: spill.id,
      participants: [],
      attempts: 0,
      openedAt: 0,
    };
    if (!existing) player.tasks.push(task);
    this.openTask(player, task);
  }

  submitTask(player: ServerPlayer, taskId: string, answer: unknown): void {
    const task = player.tasks.find((entry) => entry.id === taskId);
    const now = this.now();
    if (!task) {
      this.send(player, { t: "taskResult", taskId, ok: false, reason: "That job is not yours." });
      return;
    }
    if (player.activeTaskId !== taskId) {
      this.send(player, { t: "taskResult", taskId, ok: false, reason: "You are not doing that job right now." });
      return;
    }
    if (task.requiresPlayers > 1) {
      const present = this.connectedPlayers.filter((other) => this.nearStation(other, task.stationId, 2.4));
      if (present.length < 2) {
        this.send(player, {
          t: "taskResult",
          taskId,
          ok: false,
          reason: "Your partner wandered off. Get them back here.",
          needsPlayers: 2,
        });
        return;
      }
    } else if (!this.nearStation(player, task.stationId, 2.4) && !task.stationId.startsWith("spill:")) {
      this.send(player, { t: "taskResult", taskId, ok: false, reason: "You are not at the job site." });
      player.activeTaskId = null;
      return;
    }
    const elapsedMs = now - task.openedAt;
    const minimum = Math.min(2500, taskDef(task.kind).seconds * 320);
    if (elapsedMs < minimum) {
      task.attempts += 1;
      this.send(player, {
        t: "taskResult",
        taskId,
        ok: false,
        reason: "That was suspiciously fast. Do it properly.",
      });
      this.notify(player, "⏱ That was too fast to count as work.", "warn");
      return;
    }
    const verdict = validateAnswer(task.kind, task.solution, answer);
    if (!verdict.ok) {
      task.attempts += 1;
      this.send(player, { t: "taskResult", taskId, ok: false, reason: verdict.reason });
      if (task.attempts >= 4) {
        player.activeTaskId = null;
        this.notify(player, "😬 Too many mistakes. Find another job.", "warn");
      }
      return;
    }
    const runtime = this.stations.get(task.stationId);
    if (runtime && !task.stationId.startsWith("spill:")) {
      runtime.lastTouchedBy = player.id;
      runtime.lastTouchedAt = now;
    }
    if (task.stationId.startsWith("spill:")) {
      const spill = this.spills.find((entry) => entry.id === task.spillId);
      if (spill) {
        spill.cleaned = 1;
      } else {
        this.spills = this.spills.filter((entry) => entry.id !== task.spillId);
      }
      player.activeTaskId = null;
      player.tasks = player.tasks.filter((entry) => entry.id !== task.id);
      this.send(player, { t: "taskResult", taskId, ok: true });
      this.notify(player, "🧽 Spill cleaned. Nobody slipped on your watch.", "good");
      if (player.team === "employees") {
        player.completedTasks += 1;
        this.work.done += 1;
        this.assignTasks(player);
        this.send(player, { t: "tasks", tasks: player.tasks });
        if (this.work.done >= this.work.quota) this.finish("employees", "Every job on the list was finished.");
      }
      return;
    }
    this.send(player, { t: "taskResult", taskId, ok: true });
    this.completeTask(player, task);
  }

  cancelTask(player: ServerPlayer, taskId: string): void {
    if (player.activeTaskId === taskId) player.activeTaskId = null;
  }

  nearStation(player: ServerPlayer, stationId: string, range = INTERACT_RANGE): boolean {
    if (stationId.startsWith("spill:")) return true;
    const definition = stationDef(stationId);
    if (!definition) return false;
    const centerX = (definition.x + definition.w / 2) * 32;
    const centerY = (definition.y + definition.h / 2) * 32;
    const width = definition.w * 32 + range * 32 * 2;
    const height = definition.h * 32 + range * 32 * 2;
    return Math.abs(player.x - centerX) < width / 2 && Math.abs(player.y - centerY) < height / 2;
  }

  private nearestInteractiveStation(player: ServerPlayer): { id: string; distance: number } | null {
    let best: { id: string; distance: number } | null = null;
    for (const definition of STATIONS) {
      if (!definition.interactive) continue;
      const centerX = (definition.x + definition.w / 2) * 32;
      const centerY = (definition.y + definition.h / 2) * 32;
      const distance =
        Math.max(
          Math.abs(player.x - centerX) - (definition.w * 32) / 2,
          Math.abs(player.y - centerY) - (definition.h * 32) / 2,
        ) / 32;
      if (distance > INTERACT_RANGE) continue;
      if (!best || distance < best.distance) best = { id: definition.id, distance };
    }
    return best;
  }

  /* -------------------------------------------------------------- interaction */

  handleInteract(player: ServerPlayer): void {
    const now = this.now();
    if (this.phase !== "playing") return;
    if (now < player.slippedUntil) {
      this.notify(player, "You are still on the floor. Give it a second.", "warn");
      return;
    }

    // 1. soothing a complaining guest
    const guest = soothGuestNear(this, player.x, player.y);
    if (guest) return;

    // 2. a spill underfoot
    const spill = this.spills.find(
      (entry) => entry.cleaned < 1 && Math.hypot(entry.x - player.x, entry.y - player.y) < 1.2 * 32,
    );
    if (spill) {
      this.openSpillTask(player, spill);
      return;
    }

    // 3. doors (the single most useful hiding tool in the game)
    const door = DOORS.find((definition) =>
      definition.tiles.some(([tx, ty]) => {
        const dx = (tx + 0.5) * 32 - player.x;
        const dy = (ty + 0.5) * 32 - player.y;
        return Math.hypot(dx, dy) < 1.4 * 32;
      }),
    );
    if (door) {
      const state = this.doors.find((entry) => entry.id === door.id);
      const forced = (this.doorForce.get(door.id) ?? 0) > now;
      if (!state) return;
      if (forced) {
        this.notify(player, `${door.name} is jammed open. Someone should look at that.`, "warn");
        return;
      }
      state.open = !state.open;
      this.addFeed(
        state.open ? `🚪 ${player.nickname} opened the ${door.name}.` : `🚪 ${player.nickname} closed the ${door.name}.`,
        "info",
        "whoosh",
      );
      this.logEvidence(
        `${player.nickname} ${state.open ? "opened" : "closed"} the ${door.name}.`,
        [player.id],
      );
      return;
    }

    // 4. a station
    const nearest = this.nearestInteractiveStation(player);
    if (!nearest) {
      this.notify(player, "Nothing to interact with here.", "warn");
      return;
    }
    this.openTaskForStation(player, nearest.id);
  }

  triggerTrolleyCrash(player: ServerPlayer, stationId: string): void {
    const runtime = this.stations.get(stationId);
    if (!runtime) return;
    // remember who planted it before the tamper flag is cleared: the reveal screen
    // puts the real culprit next to the person who took the blame
    const tamperer = runtime.lastTouchedBy ? this.players.get(runtime.lastTouchedBy) ?? null : null;
    runtime.tampered = false;
    runtime.brokenUntil = this.now() + 20_000;
    const name = this.stationName(stationId);
    this.addFeed(`🛒 The ${name} tipped over the moment ${player.nickname} touched it.`, "bad", "crash");
    this.raiseNoise(player.x, player.y, 12, 8000);
    this.applyExposure(4);
    this.raiseExposureAround(player.x, player.y, 2);
    this.spawnSpill(player.x + 18, player.y, "water");
    const others = this.connectedPlayers
      .filter((other) => other.id !== player.id && Math.hypot(other.x - player.x, other.y - player.y) < 6 * 32)
      .map((other) => other.id);
    this.logEvidence(
      `${name} overturned. ${player.nickname} was pushing it.${
        others.length > 0 ? ` ${this.players.get(others[0])?.nickname} was seen nearby earlier.` : ""
      }`,
      [player.id, ...others],
      "looseWheel",
    );
    this.highlight(
      `🛒 ${player.nickname} knocked over the ${name} and took the blame — ${tamperer ? tamperer.nickname : "someone"} had loosened the wheel earlier.`,
      9,
    );
  }

  /* --------------------------------------------------------------- abilities */

  useAbility(player: ServerPlayer, targetId?: string): void {
    const def = roleDef(player.role);
    if (!def.abilityName) {
      this.notify(player, "You have no special ability.", "warn");
      return;
    }
    const now = this.now();
    if (now < player.abilityReadyAt) {
      this.notify(player, `${def.abilityName} is recharging (${Math.ceil((player.abilityReadyAt - now) / 1000)}s).`, "warn");
      return;
    }
    if (def.uses > 0 && player.abilityUses <= 0) {
      this.notify(player, `${def.abilityName} has already been used this round.`, "warn");
      return;
    }

    switch (player.role) {
      case "sheriff": {
        const target = targetId
          ? this.players.get(targetId)
          : this.connectedPlayers
              .filter((other) => other.id !== player.id)
              .sort(
                (a, b) =>
                  Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y),
              )[0];
        if (!target || target.id === player.id) {
          this.notify(player, "Nobody in reach to arrest.", "warn");
          return;
        }
        if (Math.hypot(target.x - player.x, target.y - player.y) > ABILITY_RANGE * 32) {
          this.notify(player, `${target.nickname} is too far away. Get closer.`, "warn");
          return;
        }
        target.arrestedUntil = now + 15_000;
        player.arrests += 1;
        if (target.team === "imposters") {
          target.suspendedUntil = now + SHERIFF_CORRECT_SUSPEND * 1000;
          this.addFeed(
            `🚔 ${player.nickname} arrested ${target.nickname}. Their equipment mysteriously stopped working.`,
            "good",
            "arrest",
          );
          this.highlight(
            `🚔 ${player.nickname} arrested ${target.nickname}, who was secretly a Saboteur. Their tools went offline for ${SHERIFF_CORRECT_SUSPEND}s.`,
            9,
          );
        } else {
          this.applyExposure(SHERIFF_WRONG_EXPOSURE);
          this.addFeed(
            `🚨 ${player.nickname} arrested ${target.nickname} in front of three guests. It was a scene. (+${SHERIFF_WRONG_EXPOSURE}% exposure)`,
            "bad",
            "arrest",
          );
          this.highlight(
            `🚨 ${player.nickname} arrested ${target.nickname}, who was completely innocent. The guests are still talking about it.`,
            10,
          );
          this.raiseNoise(player.x, player.y, 16, 12_000);
        }
        this.logEvidence(`${player.nickname} arrested ${target.nickname}.`, [player.id, target.id]);
        break;
      }
      case "detective": {
        const nearest = this.nearestSuspiciousObject(player);
        if (!nearest) {
          this.notify(player, "Nothing tampered with nearby. Look around the hotel.", "warn");
          return;
        }
        const runtime = this.stations.get(nearest);
        const clueOwner = runtime?.lastTouchedBy ?? null;
        const owner = clueOwner ? this.players.get(clueOwner) : null;
        const nearby = this.connectedPlayers.filter(
          (other) =>
            other.id !== player.id &&
            Math.hypot(other.x - player.x, other.y - player.y) < 8 * 32 &&
            other.id !== clueOwner,
        );
        const decoy = nearby.length > 0 ? nearby[0] : null;
        this.notify(
          player,
          `🔎 ${this.stationName(nearest)}: last handled by ${owner ? owner.nickname : "someone wearing gloves"}${
            decoy ? `, and ${decoy.nickname} was in the area around that time.` : ", nobody else was close."
          }`,
          "info",
        );
        this.logEvidence(
          `The Detective inspected the ${this.stationName(nearest)}.`,
          [player.id, ...(owner ? [owner.id] : []), ...(decoy ? [decoy.id] : [])],
        );
        break;
      }
      case "mechanic": {
        const nearest = this.nearestSuspiciousObject(player, true);
        if (!nearest) {
          this.notify(player, "No equipment within reach to diagnose.", "warn");
          return;
        }
        const runtime = this.stations.get(nearest);
        if (!runtime) return;
        const tampered = runtime.brokenUntil > now || runtime.tampered !== false;
        runtime.brokenUntil = 0;
        runtime.tampered = false;
        this.notify(
          player,
          tampered
            ? `🔧 ${this.stationName(nearest)} was tampered with. Fixed.`
            : `🔧 ${this.stationName(nearest)} looks fine. Repaired anyway.`,
          "good",
        );
        this.logEvidence(`${player.nickname} inspected the ${this.stationName(nearest)}.`, [player.id]);
        break;
      }
      case "whisperer": {
        const distance = Math.hypot(this.elephant.x - player.x, this.elephant.y - player.y);
        if (distance > ABILITY_RANGE * 32) {
          this.notify(player, "You need to be closer to the elephant.", "warn");
          return;
        }
        this.elephant.calmUntil = now + 22_000;
        this.elephant.asleep = false;
        this.elephant.blocking = false;
        forceElephantState(this, "calm");
        this.addFeed(`🧘 ${player.nickname} calmed the elephant down.`, "good", "ding");
        this.highlight(`🧘 ${player.nickname} walked up to an enormous elephant and calmed it with vibes alone.`, 7);
        break;
      }
      case "janitor": {
        const cleaned = this.spills.filter(
          (spill) => spill.cleaned < 1 && Math.hypot(spill.x - player.x, spill.y - player.y) < 7 * 32,
        );
        if (cleaned.length === 0) {
          this.notify(player, "No spills nearby to deep clean.", "warn");
          return;
        }
        cleaned.forEach((spill) => {
          spill.cleaned = 1;
        });
        this.notify(player, `🧹 Deep cleaned ${cleaned.length} spill${cleaned.length === 1 ? "" : "s"}.`, "good");
        this.addFeed(`🧹 ${player.nickname} erased every trace of the mess nearby. Suspiciously thorough.`, "warn");
        this.logEvidence(`${player.nickname} deep cleaned ${cleaned.length} spill(s).`, [player.id]);
        break;
      }
      case "manager": {
        this.emergencyInspection(player);
        break;
      }
      default:
        return;
    }

    if (def.uses > 0) player.abilityUses -= 1;
    player.abilityReadyAt = now + def.cooldown * 1000;
    this.sendAbility(player);
  }

  private nearestSuspiciousObject(player: ServerPlayer, allowClean = false): string | null {
    let best: { id: string; distance: number } | null = null;
    const now = this.now();
    for (const definition of STATIONS) {
      if (!definition.interactive) continue;
      const runtime = this.stations.get(definition.id);
      const suspicious = runtime
        ? runtime.tampered !== false || runtime.brokenUntil > now || (allowClean && runtime.lastTouchedAt > now - 60_000)
        : false;
      if (!suspicious && !allowClean) continue;
      const centerX = (definition.x + definition.w / 2) * 32;
      const centerY = (definition.y + definition.h / 2) * 32;
      const distance = Math.hypot(centerX - player.x, centerY - player.y) / 32;
      if (distance > 3.5) continue;
      if (!best || distance < best.distance) best = { id: definition.id, distance };
    }
    return best?.id ?? null;
  }

  emergencyInspection(player: ServerPlayer): void {
    const now = this.now();
    for (const guest of this.guests) {
      guest.investigate = { x: player.x, y: player.y, until: now + 15_000 };
      guest.path = [];
      guest.sight += 0;
    }
    this.addFeed("📣 Emergency inspection called. Every guest is heading to one spot.", "warn", "alarm");
    this.highlight(`📣 ${player.nickname} called an emergency inspection and every guest converged on them.`, 6);
  }

  /* ---------------------------------------------------------------- sabotage */

  useSabotage(player: ServerPlayer, kind: SabotageId, target?: string): void {
    if (player.team !== "imposters") {
      this.notify(player, "You have no sabotage tools.", "warn");
      return;
    }
    const def = sabotageDef(kind);
    const now = this.now();
    if (this.phase !== "playing") return;
    if (now < player.suspendedUntil) {
      this.notify(
        player,
        `Your tools are offline for another ${Math.ceil((player.suspendedUntil - now) / 1000)}s.`,
        "warn",
      );
      return;
    }
    if (now < player.sabotageReadyAt) {
      this.notify(player, "You are still resetting your equipment.", "warn");
      return;
    }
    if (now < (player.sabotageReady[kind] ?? 0)) {
      this.notify(player, `${def.name} is on cooldown.`, "warn");
      return;
    }
    if ((player.sabotageUses[kind] ?? def.uses) <= 0) {
      this.notify(player, `You are out of ${def.name}.`, "warn");
      return;
    }

    const succeed = (detail: string): void => {
      player.sabotageUses[kind] = (player.sabotageUses[kind] ?? def.uses) - 1;
      player.sabotageReadyAt = now + 6500;
      player.sabotageReady[kind] = now + def.cooldown * 1000;
      player.sabotages += 1;
      this.sendSabotages(player);
      this.highlight(`${detail}`, 8);
    };

    switch (kind) {
      case "looseWheel": {
        const stationId = target ?? this.nearestSabotageTarget(player);
        if (!stationId) {
          this.notify(player, "Get closer to a trolley or cart first.", "warn");
          return;
        }
        const runtime = this.stations.get(stationId);
        if (!runtime) return;
        runtime.tampered = "looseWheel";
        runtime.lastTouchedBy = player.id;
        runtime.lastTouchedAt = now;
        this.notify(player, "🛒 Wheel loosened. Now walk away and look busy.", "good");
        this.logEvidence(`Someone was crouching next to the ${this.stationName(stationId)}.`, [player.id]);
        succeed(
          `${player.nickname} loosened a wheel on the ${this.stationName(stationId)} - whoever touches it next takes the blame.`,
        );
        break;
      }
      case "elephantBait": {
        this.spawnBait(player.x + this.rng.int(-24, 24), player.y + this.rng.int(-24, 24));
        this.notify(player, "🍰 Bait placed. The elephant will find it eventually.", "good");
        this.logEvidence(`Someone left food lying around near the ${this.zoneName(player.zone)}.`, [player.id]);
        succeed(`${player.nickname} planted elephant bait in the ${this.zoneName(player.zone)}.`);
        break;
      }
      case "wrongRoom": {
        const guest = this.rng.pick(this.guests.filter((entry) => !entry.leaving));
        if (!guest) {
          this.notify(player, "No guests are inside to redirect yet.", "warn");
          return;
        }
        const zone = this.rng.pick(ROOMS.map((entry) => entry.id));
        const definition = roomById(zone);
        guest.investigate = {
          x: (definition.x + definition.w / 2) * 32,
          y: (definition.y + definition.h / 2) * 32,
          until: now + 18_000,
        };
        guest.path = [];
        this.notify(player, `🔀 ${guest.name} has been sent to the ${definition.name}.`, "good");
        succeed(`${player.nickname} redirected ${guest.name} to the ${definition.name} with a booking error.`);
        break;
      }
      case "powerOutage": {
        const zone = player.zone === "corridor" ? this.rng.pick(ROOMS.map((entry) => entry.id)) : player.zone;
        this.setDark(zone, 24_000);
        this.notify(player, `💡 Lights out in the ${this.zoneName(zone)}.`, "good");
        succeed(`${player.nickname} cut the power to the ${this.zoneName(zone)}.`);
        break;
      }
      case "supplySwap": {
        const stationId = target ?? this.nearestSabotageTarget(player);
        if (!stationId) {
          this.notify(player, "Get closer to some supplies first.", "warn");
          return;
        }
        const runtime = this.stations.get(stationId);
        if (!runtime) return;
        runtime.brokenUntil = now + 26_000;
        runtime.lastTouchedBy = player.id;
        runtime.lastTouchedAt = now;
        this.notify(player, "📦 Supplies hidden. Someone is going to have a long walk.", "good");
        this.logEvidence(`The supplies at the ${this.stationName(stationId)} went missing.`, [player.id]);
        succeed(`${player.nickname} hid the supplies at the ${this.stationName(stationId)} for 26 seconds.`);
        break;
      }
      case "fakeSpill": {
        this.spawnSpill(player.x + this.rng.int(-20, 20), player.y + this.rng.int(-20, 20), "water");
        this.notify(player, "💧 Spill created. Watch somebody slip on it.", "good");
        this.logEvidence(`A spill appeared near the ${this.zoneName(player.zone)}.`, [player.id]);
        succeed(`${player.nickname} created a fake spill in the ${this.zoneName(player.zone)}.`);
        break;
      }
      case "openDoor": {
        const front = this.doors.find((entry) => entry.id === "frontDoors");
        if (!front) return;
        front.open = true;
        this.forceDoorOpenUntil("frontDoors", now + 30_000);
        this.notify(player, "🚪 Front doors propped open. Guests can see straight in.", "good");
        succeed(`${player.nickname} jammed the front doors open for 30 seconds.`);
        break;
      }
      default:
        return;
    }
  }

  private nearestSabotageTarget(player: ServerPlayer, range = 3.2): string | null {
    let best: { id: string; distance: number } | null = null;
    for (const definition of STATIONS) {
      if (!definition.sabotageTarget) continue;
      const centerX = (definition.x + definition.w / 2) * 32;
      const centerY = (definition.y + definition.h / 2) * 32;
      const distance = Math.hypot(centerX - player.x, centerY - player.y) / 32;
      if (distance > range) continue;
      if (!best || distance < best.distance) best = { id: definition.id, distance };
    }
    return best?.id ?? null;
  }

  /* ----------------------------------------------------------- investigation */

  requestInvestigation(player: ServerPlayer): void {
    if (this.phase !== "playing") return;
    if (this.investigation.used) {
      this.notify(player, "The staff investigation has already been used this round.", "warn");
      return;
    }
    this.investigation = {
      open: true,
      openedBy: player.id,
      endsAt: this.now() + VOTE_SECONDS * 1000,
      used: true,
      result: null,
    };
    this.votes.clear();
    this.addFeed(`🔍 ${player.nickname} called a staff investigation. Everyone votes now.`, "warn", "alarm");
    this.highlight(`🔍 ${player.nickname} forced a staff investigation mid-shift.`, 5);
    this.broadcastInvestigation();
  }

  castVote(player: ServerPlayer, target: string | "skip"): void {
    if (!this.investigation.open) return;
    if (target !== "skip" && !this.players.has(target)) return;
    this.votes.set(player.id, target);
    player.votedFor = target;
    this.broadcastInvestigation();
    if (this.votes.size >= this.connectedCount()) this.resolveInvestigation();
  }

  private broadcastInvestigation(): void {
    const suspects = this.connectedPlayers.map((entry) => ({
      id: entry.id,
      nickname: entry.nickname,
      avatar: entry.avatar,
    }));
    for (const player of this.connectedPlayers) {
      const state: InvestigationView = {
        open: this.investigation.open,
        openedBy: this.investigation.openedBy,
        endsAt: this.investigation.endsAt,
        used: this.investigation.used,
        result: this.investigation.result,
        votes: [...this.votes.entries()].map(([from, target]) => ({
          from,
          fromNick: this.players.get(from)?.nickname ?? "Someone",
          target,
        })),
      };
      this.send(player, {
        t: "investigation",
        state,
        suspects: suspects.filter((entry) => entry.id !== player.id),
      });
    }
  }

  resolveInvestigation(): void {
    if (!this.investigation.open) return;
    const tally = new Map<string, number>();
    for (const target of this.votes.values()) {
      tally.set(target, (tally.get(target) ?? 0) + 1);
    }
    let winner: string | "skip" | null = null;
    let winnerVotes = 0;
    let tied = false;
    for (const [target, count] of tally.entries()) {
      if (count > winnerVotes) {
        winner = target;
        winnerVotes = count;
        tied = false;
      } else if (count === winnerVotes) {
        tied = true;
      }
    }
    this.investigation.open = false;
    if (!winner || winner === "skip" || tied) {
      this.investigation.result = "The staff could not agree on anybody. Nothing happened.";
      this.addFeed("🔍 The investigation ended in a shrug. Nobody was accused.", "info");
      this.broadcastInvestigation();
      return;
    }
    const target = this.players.get(winner);
    if (!target) {
      this.investigation.result = "The suspect had already left the building.";
      this.broadcastInvestigation();
      return;
    }
    if (target.team === "imposters") {
      target.suspendedUntil = Math.max(target.suspendedUntil, this.now() + VOTE_CORRECT_SUSPEND * 1000);
      this.investigation.result = `${target.nickname} was found to be handling equipment they should not have. Their tools are locked out.`;
      this.addFeed(
        `⚖️ Staff investigation: ${target.nickname} is under review. Their equipment has been seized.`,
        "good",
        "arrest",
      );
      this.highlight(
        `⚖️ The staff voted for ${target.nickname} and nailed a Saboteur. Tools seized for ${VOTE_CORRECT_SUSPEND}s.`,
        9,
      );
    } else {
      this.applyExposure(VOTE_WRONG_EXPOSURE);
      this.investigation.result = `${target.nickname} turned out to be innocent. Everyone watched the argument instead of the corridor.`;
      this.addFeed(
        `⚖️ Staff investigation: ${target.nickname} was innocent. The argument was very public. (+${VOTE_WRONG_EXPOSURE}% exposure)`,
        "bad",
      );
      this.highlight(
        `⚖️ The staff voted to investigate ${target.nickname}, who was innocent. The elephant used the argument as cover.`,
        8,
      );
    }
    this.logEvidence(`A staff investigation targeted ${target.nickname}.`, [target.id]);
    this.broadcastInvestigation();
  }

  /* ------------------------------------------------------------ world effects */

  applyExposure(amount: number): void {
    this.exposure = Math.min(100, Math.max(0, this.exposure + amount));
  }

  raiseExposureAround(x: number, y: number, tiles: number): void {
    const nearby = this.guests.filter((guest) => Math.hypot(guest.x - x, guest.y - y) < tiles * 32);
    if (nearby.length > 0) this.applyExposure(2 * nearby.length);
  }

  spawnSpill(x: number, y: number, kind: Spill["kind"]): Spill {
    const spill: Spill = {
      id: `s${randomUUID().slice(0, 8)}`,
      x,
      y,
      kind,
      cleaned: 0,
      createdAt: this.now(),
    };
    this.spills.push(spill);
    if (this.spills.length > 8) this.spills.shift();
    return spill;
  }

  spawnBait(x: number, y: number): Bait {
    const bait: Bait = { id: `b${randomUUID().slice(0, 8)}`, x, y, eaten: 0, createdAt: this.now() };
    this.baits.push(bait);
    if (this.baits.length > 4) this.baits.shift();
    return bait;
  }

  setDark(zone: ZoneId, durationMs: number): void {
    this.dark.set(zone, this.now() + durationMs);
  }

  darkZones(now: number): ZoneId[] {
    return [...this.dark.entries()].filter(([, until]) => until > now).map(([zone]) => zone);
  }

  breakStation(stationId: string, durationMs: number): void {
    const runtime = this.stations.get(stationId);
    if (!runtime) return;
    runtime.brokenUntil = this.now() + durationMs;
  }

  forceDoorOpenUntil(doorId: string, until: number): void {
    this.doorForce.set(doorId, until);
  }

  raiseNoise(x: number, y: number, radiusTiles: number, durationMs: number): void {
    const now = this.now();
    for (const guest of this.guests) {
      if (Math.hypot(guest.x - x, guest.y - y) < radiusTiles * 32) {
        guest.investigate = { x, y, until: now + durationMs };
        guest.path = [];
      }
    }
    if (this.settings.modifiers.includes("quietHours")) this.applyExposure(NOISE_EXPOSURE);
  }

  disruptMeal(): void {
    for (const player of this.playerList) {
      const task = player.tasks.find((entry) => entry.kind === "serveMeals" && entry.id === player.activeTaskId);
      if (task) {
        this.interruptTask(player, "The elephant ate the meal you were plating.");
      }
    }
  }

  rerouteGuests(): void {
    this.guestRoute = this.rng.shuffle(this.guestRoute);
    for (const guest of this.guests) {
      guest.path = [];
      guest.step = this.rng.int(0, this.guestRoute.length - 1);
    }
  }

  hiddenElephant(): boolean {
    const tileX = Math.floor(this.elephant.x / 32);
    const tileY = Math.floor(this.elephant.y / 32);
    const zone = gameMap.roomAt(tileX, tileY);
    if (!zone) return false;
    const guestInside = this.guests.some(
      (guest) => !guest.leaving && gameMap.roomAt(Math.floor(guest.x / 32), Math.floor(guest.y / 32)) === zone,
    );
    if (guestInside) return false;
    const doors = DOORS.filter((door) => door.room === zone);
    if (doors.length === 0) return false;
    return doors.every((door) => !(this.doors.find((entry) => entry.id === door.id)?.open ?? false));
  }

  /* ------------------------------------------------------------------ ticking */

  private tick(): void {
    const now = this.now();
    const dt = TICK_MS / 1000;
    this.tickCount += 1;

    if (this.phase === "reveal" && now >= this.phaseEndsAt) {
      this.beginPlaying();
    }

    if (this.phase === "playing") {
      if (this.paused) {
        if (now - this.pausedSince > ABANDON_AFTER_PAUSE_SECONDS * 1000) {
          this.broadcast({ t: "notice", text: "Match ended: too many players left the hotel.", tone: "bad" });
          this.finish("imposters", "The shift collapsed: too many players left.");
        }
      } else {
        this.elapsed += dt;
        this.timeLeft = Math.max(0, this.settings.matchSeconds - this.elapsed);
        this.updatePlayers(dt, now);
        elephantTick(this, dt);
        const guestResult = guestTick(this, dt);
        this.applySightings(guestResult.sightings, guestResult.exposurePerSecond);
        this.updateExposure(dt, now, guestResult.exposurePerSecond);
        this.updateWorldEntities(dt, now);
        this.updateGuestArrivals(dt, now);
        incidentTick(this);
        this.updateInvestigation(now);
        if (this.timeLeft <= 0) {
          this.addFeed("⏰ The shift is over and the work is not finished.", "bad", "lose");
          this.finish("imposters", "Time ran out with the Work Progress meter unfinished.");
        }
      }
    }

    if (this.phase === "results" && now >= this.phaseEndsAt) {
      // hold on the results screen until the host starts another round
      this.phaseEndsAt = now + 60_000;
    }

    if (this.tickCount % SNAPSHOT_TICKS === 0) this.broadcastSnapshot(now, dt * SNAPSHOT_TICKS);

    if (this.isIdle()) {
      this.destroy();
    } else {
      this.cleanupGone(now);
    }
  }

  private cleanupGone(now: number): void {
    for (const player of [...this.playerList]) {
      if (player.connected) continue;
      if (now - player.disconnectedAt > RECONNECT_WINDOW_MS && this.phase === "lobby") {
        this.removePlayer(player.id);
      }
    }
  }

  private updatePlayers(dt: number, now: number): void {
    const elephantRadius = 11 * this.elephant.scale + PLAYER_RADIUS;
    for (const player of this.connectedPlayers) {
      const magnitude = Math.hypot(player.input.mx, player.input.my);
      const speed = PLAYER_SPEED * 32;
      if (now < player.slippedUntil) {
        player.vx = 0;
        player.vy = 0;
        player.moving = false;
        continue;
      }
      if (magnitude > 0.05) {
        const mx = player.input.mx / Math.max(1, magnitude);
        const my = player.input.my / Math.max(1, magnitude);
        player.vx = mx * speed;
        player.vy = my * speed;
        const moved = gameMap.moveCircle(
          { x: player.x, y: player.y },
          player.vx * dt,
          player.vy * dt,
          this.doors,
          (x, y) => {
            if (this.blockedRoutes.length === 0) {
              return Math.hypot(x - this.elephant.x, y - this.elephant.y) < elephantRadius;
            }
            return Math.hypot(x - this.elephant.x, y - this.elephant.y) < elephantRadius;
          },
        );
        player.x = Math.min(40 * 32 - 8, Math.max(8, moved.x));
        player.y = Math.min(28 * 32 - 8, Math.max(8, moved.y));
        player.moving = true;
        player.dir = Math.abs(player.vx) > Math.abs(player.vy) ? (player.vx > 0 ? 3 : 1) : player.vy > 0 ? 0 : 2;
        player.lastMoveAt = now;
      } else {
        player.vx = 0;
        player.vy = 0;
        player.moving = false;
      }
      player.zone = gameMap.zoneAt(Math.floor(player.x / 32), Math.floor(player.y / 32));

      // slipping: a real, funny cost for ignoring spills
      if (player.moving && now > player.slippedUntil + 4000) {
        const spill = this.spills.find(
          (entry) => entry.cleaned < 1 && Math.hypot(entry.x - player.x, entry.y - player.y) < 14,
        );
        if (spill && this.rng.chance(0.02)) {
          player.slippedUntil = now + 1800;
          const zone = this.zoneName(player.zone);
          this.addFeed(`🤕 ${player.nickname} slipped on the wet floor in the ${zone}.`, "warn", "splat");
          this.logEvidence(`${player.nickname} slipped in the ${zone}.`, [player.id]);
        }
      }
    }
  }

  private applySightings(sightings: { guestId: string; witnessId: string | null }[], rate: number): void {
    if (sightings.length === 0 || rate <= 0) return;
    this.lastSightingAt = this.now();
    const now = this.now();
    for (const sighting of sightings) {
      const guest = this.guests.find((entry) => entry.id === sighting.guestId);
      if (!guest) continue;
      if (now - guest.lastCountedAt < 4000) continue;
      guest.lastCountedAt = now;
      if (sighting.witnessId) {
        const witness = this.players.get(sighting.witnessId);
        if (witness) witness.spottedByGuests += 1;
      }
    }
  }

  private updateExposure(dt: number, now: number, rate: number): void {
    // the win check comes first: a meter that is already full cannot be decayed
    // out of a victory on the same tick
    if (this.exposure >= 100) {
      this.addFeed("🐘 The elephant is now the only thing anyone can see.", "bad", "grow");
      this.finish("imposters", "Exposure hit 100% - nobody can pretend not to notice it.");
      return;
    }
    const previous = this.exposure;
    if (rate > 0) {
      this.exposure = Math.min(100, this.exposure + rate * dt);
    } else if (now - this.lastSightingAt > EXPOSURE_DECAY_GRACE * 1000) {
      this.exposure = Math.max(0, this.exposure - EXPOSURE_DECAY * dt);
    }
    this.exposureTrend = (this.exposure - previous) / dt;
    if (this.exposure >= 100) {
      this.addFeed("🐘 The elephant is now the only thing anyone can see.", "bad", "grow");
      this.finish("imposters", "Exposure hit 100% - nobody can pretend not to notice it.");
    }
  }

  private updateWorldEntities(dt: number, now: number): void {
    this.baits = this.baits.filter((bait) => now - bait.createdAt < 45_000 && bait.eaten < 1);
    this.spills = this.spills.filter((spill) => now - spill.createdAt < 240_000);
    for (const [doorId, until] of [...this.doorForce.entries()]) {
      if (until <= now) {
        this.doorForce.delete(doorId);
        const front = this.doors.find((entry) => entry.id === doorId);
        if (front && doorId === "frontDoors") {
          front.open = true;
        }
      }
    }
    this.complaints = this.complaints.filter((entry) => now - entry.at < 60_000);
    void dt;
  }

  private updateGuestArrivals(dt: number, now: number): void {
    void dt;
    if (now < this.nextGuestAt) return;
    const rush = this.settings.modifiers.includes("rushHour") ? 2 : 1;
    const maxGuests = Math.round((3 + this.connectedCount() / 2) * rush);
    const interval = (this.settings.modifiers.includes("rushHour") ? 7 : 13) * 1000;
    this.nextGuestAt = now + interval;
    if (this.guests.filter((guest) => !guest.leaving).length >= maxGuests) return;
    const kind = this.settings.modifiers.includes("vipVisit") && this.rng.chance(0.15) ? "vip" : "guest";
    spawnGuest(this, kind);
  }

  private updateInvestigation(now: number): void {
    if (this.investigation.open && now >= this.investigation.endsAt) {
      this.resolveInvestigation();
    }
  }

  private evaluatePause(): void {
    if (this.phase !== "playing") return;
    const enough = this.connectedCount() >= PAUSE_BELOW_PLAYERS;
    if (!enough && !this.paused) {
      this.paused = true;
      this.pausedSince = this.now();
      this.addFeed("⏸ The shift is paused: too many players are disconnected.", "warn");
      this.broadcast({ t: "notice", text: "Match paused - waiting for players to reconnect.", tone: "warn" });
    } else if (enough && this.paused) {
      this.paused = false;
      this.addFeed("▶️ Everybody is back. The shift continues.", "good", "ding");
    }
  }

  /* -------------------------------------------------------------- networking */

  handleMessage(player: ServerPlayer, message: ClientMessage, socketReady: boolean): void {
    if (!socketReady) return;
    this.lastActivity = this.now();
    switch (message.t) {
      case "input": {
        if (this.phase !== "playing") return;
        const mx = Number(message.mx);
        const my = Number(message.my);
        if (!Number.isFinite(mx) || !Number.isFinite(my)) return;
        const magnitude = Math.hypot(mx, my);
        if (magnitude > 1.5) return; // obviously forged input
        player.input = { mx: Math.max(-1, Math.min(1, mx)), my: Math.max(-1, Math.min(1, my)) };
        player.inputSeq = Number(message.seq) || player.inputSeq;
        return;
      }
      case "interact":
        this.handleInteract(player);
        return;
      case "taskOpen":
        this.openTaskForStation(player, String(message.stationId));
        return;
      case "taskSubmit":
        this.submitTask(player, String(message.taskId), message.answer);
        return;
      case "taskCancel":
        this.cancelTask(player, String(message.taskId));
        return;
      case "sabotage":
        this.useSabotage(player, message.kind, message.target);
        return;
      case "ability":
        this.useAbility(player, message.targetId);
        return;
      case "investigate":
        this.requestInvestigation(player);
        return;
      case "vote":
        this.castVote(player, message.targetId);
        return;
      case "emote": {
        if (this.phase !== "playing" && this.phase !== "lobby") return;
        player.emote = String(message.emote).slice(0, 4);
        player.emoteAt = this.now();
        return;
      }
      case "settings": {
        if (player.id !== this.hostId) {
          this.notify(player, "Only the host can change the settings.", "warn");
          return;
        }
        if (this.phase !== "lobby") return;
        const patch = message.patch ?? {};
        const next: RoomSettings = { ...this.settings };
        if (patch.matchSeconds !== undefined) {
          next.matchSeconds = Math.min(900, Math.max(180, Math.round(patch.matchSeconds)));
        }
        if (patch.workQuotaPerPlayer !== undefined) {
          next.workQuotaPerPlayer = Math.min(24, Math.max(4, Math.round(patch.workQuotaPerPlayer)));
        }
        if (patch.modifiers !== undefined) {
          next.modifiers = patch.modifiers
            .filter((id): id is RoomSettings["modifiers"][number] => typeof id === "string")
            .slice(0, 2);
        }
        if (patch.incidentsEnabled !== undefined) next.incidentsEnabled = Boolean(patch.incidentsEnabled);
        if (patch.elephantAggression !== undefined) {
          const aggression = Math.round(Number(patch.elephantAggression));
          next.elephantAggression = aggression <= 1 ? 1 : aggression >= 3 ? 3 : 2;
        }
        this.settings = next;
        this.broadcastLobby();
        return;
      }
      case "avatar": {
        player.avatar = this.clampAvatar(Number(message.avatar));
        this.broadcastLobby();
        return;
      }
      case "ready": {
        player.ready = Boolean(message.ready);
        this.broadcastLobby();
        return;
      }
      case "start":
        this.startMatch(player);
        return;
      case "rematch":
        this.rematch(player);
        return;
      default:
        return;
    }
  }

  buildSnapshot(now: number): Snapshot {
    const players: PlayerView[] = this.playerList.map((player) => ({
      id: player.id,
      nickname: player.nickname,
      avatar: player.avatar,
      x: Math.round(player.x * 10) / 10,
      y: Math.round(player.y * 10) / 10,
      vx: Math.round(player.vx),
      vy: Math.round(player.vy),
      dir: player.dir,
      moving: player.moving,
      carrying: player.carrying,
      emote: now - player.emoteAt < EMOTE_SECONDS * 1000 ? player.emote : null,
      emoteAt: player.emoteAt,
      tasksDone: player.completedTasks,
      suspended: player.suspendedUntil > now,
      arrested: player.arrestedUntil > now,
      connected: player.connected,
      zone: player.zone,
    }));
    return {
      tick: this.tickCount,
      phase: this.phase,
      paused: this.paused,
      timeLeft: Math.round(this.timeLeft * 10) / 10,
      serverTime: now,
      work: { ...this.work },
      exposure: Math.round(this.exposure * 10) / 10,
      exposureTrend: Math.round(this.exposureTrend * 100) / 100,
      players,
      elephant: {
        x: Math.round(this.elephant.x * 10) / 10,
        y: Math.round(this.elephant.y * 10) / 10,
        dir: this.elephant.dir,
        state: this.elephant.state,
        stateLabel: stateLabel(this.elephant.state),
        stage: this.elephant.stage,
        scale: this.elephant.scale,
        asleep: this.elephant.asleep,
        moving: this.elephant.moving,
        blocking: this.elephant.blocking,
        trunk: Math.round(this.elephant.trunk * 100) / 100,
      },
      guests: this.guests.map((guest) => ({
        id: guest.id,
        label: guest.name,
        kind: guest.kind,
        x: Math.round(guest.x * 10) / 10,
        y: Math.round(guest.y * 10) / 10,
        dir: guest.dir,
        moving: guest.moving,
        alarmed: guest.alarmed,
        soothed: guest.soothedUntil > now,
        zone: gameMap.zoneAt(Math.floor(guest.x / 32), Math.floor(guest.y / 32)),
      })),
      doors: this.doors.map((door) => ({ id: door.id, open: door.open })),
      spills: this.spills
        .filter((spill) => spill.cleaned < 1)
        .map((spill) => ({
          id: spill.id,
          x: Math.round(spill.x),
          y: Math.round(spill.y),
          cleaned: spill.cleaned,
          kind: spill.kind,
        })),
      baits: this.baits.map((bait) => ({
        id: bait.id,
        x: Math.round(bait.x),
        y: Math.round(bait.y),
        eaten: bait.eaten,
      })),
      dark: this.darkZones(now),
      blockedRoutes: this.blockedRoutes,
      feed: this.feed.slice(-14),
      tasksCompleted: this.work.done,
      tasksFailed: 0,
    };
  }

  private broadcastSnapshot(now: number, dt: number): void {
    const snap = this.buildSnapshot(now);
    for (const player of this.connectedPlayers) {
      this.send(player, { t: "snap", snap });
    }
    void dt;
  }

  /** used by tests and by the client on reconnect */
  snapshotNow(): Snapshot {
    return this.buildSnapshot(this.now());
  }

  cooldownReport(player: ServerPlayer): Record<string, number> {
    const now = this.now();
    const report: Record<string, number> = {
      sabotageGlobal: Math.max(0, Math.round((player.sabotageReadyAt - now) / 1000)),
      suspended: Math.max(0, Math.round((player.suspendedUntil - now) / 1000)),
    };
    for (const sabotage of SABOTAGES) {
      report[sabotage.id] = Math.max(0, Math.round(((player.sabotageReady[sabotage.id] ?? 0) - now) / 1000));
    }
    return report;
  }

  taskListFor(player: ServerPlayer): ServerTask[] {
    return player.tasks;
  }

  availableStations(): string[] {
    return STATIONS.map((definition) => definition.id);
  }

  approachTilesFor(stationId: string): { x: number; y: number }[] {
    const definition = stationDef(stationId);
    if (!definition) return [];
    return stationApproachTiles(definition, this.doors);
  }

  /** dev/test helper: place a player somewhere legitimately walkable */
  teleport(player: ServerPlayer, tx: number, ty: number): boolean {
    if (!gameMap.walkable(Math.round(tx), Math.round(ty), this.doors)) return false;
    player.x = tx * 32 + 16;
    player.y = ty * 32 + 16;
    player.zone = gameMap.zoneAt(Math.round(tx), Math.round(ty));
    return true;
  }

  allTaskKinds(): TaskKindId[] {
    return TASKS.map((task) => task.id);
  }

  allRoleIds(): RoleId[] {
    return ROLES.map((role) => role.id);
  }
}
