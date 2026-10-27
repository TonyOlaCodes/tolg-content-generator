/**
 * End-to-end tests. These drive the *real* server over real WebSocket
 * connections, and separately exercise the simulation deterministically through
 * a real Room instance. Run with:
 *
 *   npm test
 *
 * What is covered here (see README "Testing" for what still needs a human in a
 * browser):
 *   - lobby codes, 3/8 player starts, 9th player refused, <3 cannot start
 *   - role secrecy, imposter teammates, two imposters at 8 players
 *   - server-validated task puzzles (a solver derives the answer from exactly the
 *     data a player can see, so this also proves the puzzles are solvable)
 *   - remote / instant task completion rejected
 *   - sabotage cooldowns, sheriff arrest outcomes, investigation voting
 *   - employee and imposter win conditions, timer expiry
 *   - disconnect, pause and reconnect
 *   - guest spotting, door concealment, elephant growth, map connectivity
 */

import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import type {
  ClientMessage,
  PlayerResult,
  PuzzleSpec,
  ResultsPayload,
  RoleCard,
  RoomSettings,
  ServerMessage,
  Snapshot,
  TaskInstance,
} from "../game/protocol";
import { gameMap, stationApproachTiles } from "../game/map";
import { STATIONS, station as stationDef } from "../game/content";
import type { TaskKindId } from "../game/content";
import { TASKS } from "../game/content";
import { Rng } from "../game/rng";
import { attachGameServer, type RoomManager } from "../server/index";
import { Room } from "../server/room";
import { spawnGuest } from "../server/guests";
import { generatePuzzle, validateAnswer } from "../server/tasks";

/* ------------------------------------------------------------------ harness */

const passed: string[] = [];
const failed: { name: string; error: string }[] = [];

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  const started = Date.now();
  try {
    await fn();
    passed.push(name);
    console.log(`  \u2713 ${name} (${Date.now() - started}ms)`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failed.push({ name, error: message });
    console.log(`  \u2717 ${name} (${Date.now() - started}ms)\n      ${message.split("\n").join("\n      ")}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/* --------------------------------------------------------------- test client */

type MessageOf<T extends ServerMessage["t"]> = Extract<ServerMessage, { t: T }>;

class TestClient {
  ws: WebSocket;
  private readonly url: string;
  private inbox: ServerMessage[] = [];
  snap: Snapshot | null = null;
  role: RoleCard | null = null;
  teammates: { id: string; nickname: string; role: string }[] = [];
  tasks: TaskInstance[] = [];
  puzzle: PuzzleSpec | null = null;
  taskResults: { taskId: string; ok: boolean; reason?: string; needsPlayers?: number }[] = [];
  notices: { text: string; tone?: string }[] = [];
  lobby:
    | { code: string; hostId: string; settings: RoomSettings; players: { id: string; nickname: string }[] }
    | null = null;
  results: ResultsPayload | null = null;
  sabotageUses: Record<string, number> = {};
  sabotageCooldowns: Record<string, number> = {};
  abilityInfo: { name: string; cooldown: number; uses: number; readyAt: number } | null = null;
  receivedTypes: string[] = [];
  playerId = "";
  token = "";
  code = "";
  host = false;
  readonly nickname: string;

  constructor(url: string, nickname: string) {
    this.url = url;
    this.nickname = nickname;
    this.ws = new WebSocket(url);
    this.wire();
  }

  /** a fresh socket is required after a close, so reconnect wires up a new one */
  private connect(): void {
    this.ws = new WebSocket(this.url);
    this.wire();
  }

  private wire(): void {
    this.ws.on("message", (raw: unknown) => {
      let parsed: ServerMessage;
      try {
        parsed = JSON.parse(String(raw)) as ServerMessage;
      } catch {
        return;
      }
      this.absorb(parsed);
      this.inbox.push(parsed);
    });
  }

  private absorb(message: ServerMessage): void {
    this.receivedTypes.push(message.t);
    switch (message.t) {
      case "welcome":
        this.playerId = message.playerId;
        this.token = message.token;
        this.code = message.code;
        this.host = message.host;
        break;
      case "lobby":
        this.lobby = {
          code: message.code,
          hostId: message.hostId,
          settings: message.settings,
          players: message.players.map((player) => ({ id: player.id, nickname: player.nickname })),
        };
        break;
      case "role":
        this.role = message.card;
        this.teammates = message.teammates as unknown as typeof this.teammates;
        break;
      case "tasks":
        this.tasks = message.tasks;
        break;
      case "puzzle":
        this.puzzle = message.puzzle;
        break;
      case "taskResult":
        this.taskResults.push({
          taskId: message.taskId,
          ok: message.ok,
          reason: message.reason,
          needsPlayers: message.needsPlayers,
        });
        break;
      case "notice":
        this.notices.push({ text: message.text, tone: message.tone });
        break;
      case "ability":
        this.abilityInfo = {
          name: message.name,
          cooldown: message.cooldown,
          uses: message.uses,
          readyAt: message.readyAt,
        };
        break;
      case "sabotages":
        this.sabotageCooldowns = message.cooldowns;
        this.sabotageUses = message.uses;
        break;
      case "snap":
        this.snap = message.snap;
        break;
      case "results":
        this.results = message.results;
        break;
      default:
        break;
    }
  }

  async readySocket(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`${this.nickname}: socket never opened`)),
        8000,
      );
      this.ws.once("open", () => {
        clearTimeout(timer);
        resolve();
      });
      this.ws.once("error", (error) => {
        clearTimeout(timer);
        reject(error);
      });
    });
  }

  send(message: ClientMessage): void {
    this.ws.send(JSON.stringify(message));
  }

  async join(code: string | null, avatar = 0): Promise<void> {
    await this.readySocket();
    this.send({ t: "join", code, nickname: this.nickname, avatar });
    await this.waitFor("welcome");
    await this.waitFor("lobby");
  }

  async resume(): Promise<void> {
    if (this.ws.readyState !== WebSocket.OPEN) this.connect();
    await this.readySocket();
    this.send({
      t: "join",
      code: this.code,
      nickname: this.nickname,
      avatar: 0,
      playerId: this.playerId,
      token: this.token,
    });
    const welcome = await this.waitFor("welcome");
    assert.equal(welcome.resumed, true, "expected the server to resume the session");
  }

  async waitFor<T extends ServerMessage["t"]>(
    type: T,
    predicate?: (message: MessageOf<T>) => boolean,
    timeout = 6000,
  ): Promise<MessageOf<T>> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const index = this.inbox.findIndex(
        (message) => message.t === type && (!predicate || predicate(message as MessageOf<T>)),
      );
      if (index >= 0) {
        const [found] = this.inbox.splice(index, 1);
        return found as MessageOf<T>;
      }
      await sleep(20);
    }
    throw new Error(`${this.nickname}: timed out waiting for "${type}"`);
  }

  async waitUntil(check: () => boolean, timeout = 6000, label = "condition"): Promise<void> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (check()) return;
      await sleep(25);
    }
    throw new Error(`${this.nickname}: timed out waiting for ${label}`);
  }

  drain(): void {
    this.inbox.length = 0;
    this.taskResults.length = 0;
    this.notices.length = 0;
  }

  /** every message type this client has ever been sent (used to prove secrecy) */
  messageTypes(): string[] {
    return [...new Set(this.receivedTypes)];
  }

  self(): { x: number; y: number } | null {
    const me = this.snap?.players.find((player) => player.id === this.playerId);
    return me ? { x: me.x, y: me.y } : null;
  }

  close(): void {
    this.ws.close();
  }
}

/* ---------------------------------------------------------- puzzle solver */

interface BedData {
  slots: { id: string; label: string }[];
  items: { id: string; label: string }[];
}
interface SpillData {
  spots: { id: string }[];
}
interface LaundryData {
  items: { id: string; color: string }[];
  baskets: { id: string; color: string }[];
}
interface BagData {
  bags: { id: string; tag: string }[];
  rooms: { id: string; label: string }[];
}
interface ShelfData {
  checklist: string[];
  slots: { id: string; index: number }[];
  items: { id: string; label: string }[];
}
interface MealData {
  orders: { id: string; dish: string }[];
  plates: { id: string; dish: string }[];
}
interface BookingData {
  bookings: { id: string; keyCode: string }[];
  rooms: { id: string; keyCode: string }[];
}
type Tuple = [boolean, boolean, boolean, boolean];
interface CircuitData {
  w: number;
  h: number;
  source: { x: number; y: number };
  outlet: { x: number; y: number };
  cells: { id: string; x: number; y: number; kind: string; rotation: number; base: Tuple }[];
}

/* ------------------------------------------------------------------ circuit */

/**
 * An independent solver for the pipe puzzle: enumerate every simple route from
 * source to outlet, work out the rotations that would connect that route, then
 * verify with its own connectivity check. It only uses rotor shapes and route
 * order, never the generator's internals.
 */
function circuitRotationsFor(circuit: CircuitData, route: { x: number; y: number }[]): Record<string, number> {
  const rotations: Record<string, number> = {};
  for (let index = 0; index < route.length; index += 1) {
    const point = route[index];
    const cell = circuit.cells.find((entry) => entry.x === point.x && entry.y === point.y);
    if (!cell) continue;
    if (cell.kind === "source" || cell.kind === "outlet") {
      rotations[cell.id] = 0;
      continue;
    }
    const previous = route[index - 1];
    const next = route[index + 1];
    const wanted: Tuple = [
      Boolean((previous && previous.y === point.y - 1) || (next && next.y === point.y - 1)),
      Boolean((previous && previous.x === point.x + 1) || (next && next.x === point.x + 1)),
      Boolean((previous && previous.y === point.y + 1) || (next && next.y === point.y + 1)),
      Boolean((previous && previous.x === point.x - 1) || (next && next.x === point.x - 1)),
    ];
    let chosen = 0;
    for (let rotation = 0; rotation < 4; rotation += 1) {
      const candidate = rotate(cell.base, rotation);
      if (candidate.every((value, position) => value === wanted[position])) {
        chosen = rotation;
        break;
      }
      chosen = rotation;
    }
    rotations[cell.id] = chosen;
  }
  return rotations;
}

function circuitConnects(circuit: CircuitData, rotations: Record<string, number>): boolean {
  const at = (x: number, y: number) => circuit.cells.find((cell) => cell.x === x && cell.y === y);
  const arms = (cell: { id: string; kind: string; base: Tuple; rotation: number }): Tuple => {
    if (cell.kind === "source" || cell.kind === "outlet") return cell.base;
    return rotate(cell.base, rotations[cell.id] ?? cell.rotation);
  };
  const start = at(circuit.source.x, circuit.source.y);
  const goal = at(circuit.outlet.x, circuit.outlet.y);
  if (!start || !goal) return false;
  const seen = new Set<string>([start.id]);
  const queue = [start];
  const opposite = [2, 3, 0, 1];
  while (queue.length > 0) {
    const cell = queue.shift() as { id: string; x: number; y: number; kind: string; base: Tuple; rotation: number };
    if (cell.id === goal.id) return true;
    const cellArms = arms(cell);
    const neighbours: [number, number, number][] = [
      [cell.x, cell.y - 1, 0],
      [cell.x + 1, cell.y, 1],
      [cell.x, cell.y + 1, 2],
      [cell.x - 1, cell.y, 3],
    ];
    for (const [nx, ny, direction] of neighbours) {
      if (!cellArms[direction]) continue;
      const neighbour = at(nx, ny);
      if (!neighbour || seen.has(neighbour.id)) continue;
      if (!arms(neighbour)[opposite[direction]]) continue;
      seen.add(neighbour.id);
      queue.push(neighbour);
    }
  }
  return false;
}

function solveCircuit(circuit: CircuitData): Record<string, number> | null {
  const routes: { x: number; y: number }[][] = [];
  const visit = (route: { x: number; y: number }[]): void => {
    const tail = route[route.length - 1];
    if (tail.x === circuit.outlet.x && tail.y === circuit.outlet.y) {
      routes.push(route);
      return;
    }
    if (route.length > circuit.cells.length) return;
    const steps: [number, number][] = [
      [tail.x, tail.y - 1],
      [tail.x + 1, tail.y],
      [tail.x, tail.y + 1],
      [tail.x - 1, tail.y],
    ];
    for (const [nx, ny] of steps) {
      if (nx < 0 || ny < 0 || nx >= circuit.w || ny >= circuit.h) continue;
      if (!circuit.cells.some((cell) => cell.x === nx && cell.y === ny)) continue;
      if (route.some((point) => point.x === nx && point.y === ny)) continue;
      visit([...route, { x: nx, y: ny }]);
    }
  };
  visit([{ x: circuit.source.x, y: circuit.source.y }]);
  for (const route of routes) {
    const rotations = circuitRotationsFor(circuit, route);
    if (circuitConnects(circuit, rotations)) return rotations;
  }
  return null;
}

function rotate(tuple: Tuple, times: number): Tuple {
  let current = tuple;
  for (let i = 0; i < ((times % 4) + 4) % 4; i += 1) {
    current = [current[3], current[0], current[1], current[2]];
  }
  return current;
}

/** solve a puzzle using only what the player can see, exactly as a human would */
function asData<T>(data: Record<string, unknown>): T {
  return data as unknown as T;
}

function solve(puzzle: PuzzleSpec): unknown {
  switch (puzzle.kind) {
    case "makeBed": {
      const data = asData<BedData>(puzzle.data);
      const answer: Record<string, string> = {};
      for (const item of data.items) {
        const slot = data.slots.find((entry) => entry.label === item.label);
        if (slot) answer[item.id] = slot.id;
      }
      return answer;
    }
    case "cleanSpill": {
      const data = asData<SpillData>(puzzle.data);
      return { spots: data.spots.map((spot) => spot.id) };
    }
    case "sortLaundry": {
      const data = asData<LaundryData>(puzzle.data);
      const answer: Record<string, string> = {};
      for (const item of data.items) {
        const basket = data.baskets.find((entry) => entry.color === item.color);
        if (basket) answer[item.id] = basket.id;
      }
      return answer;
    }
    case "deliverLuggage": {
      const data = asData<BagData>(puzzle.data);
      const answer: Record<string, string> = {};
      for (const bag of data.bags) {
        const room = data.rooms.find((entry) => entry.label === bag.tag);
        if (room) answer[bag.id] = room.id;
      }
      return answer;
    }
    case "restockSupplies": {
      const data = asData<ShelfData>(puzzle.data);
      return data.checklist.map((label) => data.items.find((item) => item.label === label)?.id ?? "");
    }
    case "serveMeals": {
      const data = asData<MealData>(puzzle.data);
      const answer: Record<string, string> = {};
      for (const order of data.orders) {
        const plate = data.plates.find((entry) => entry.dish === order.dish);
        if (plate) answer[order.id] = plate.id;
      }
      return answer;
    }
    case "checkInGuests": {
      const data = asData<BookingData>(puzzle.data);
      const answer: Record<string, string> = {};
      for (const booking of data.bookings) {
        const room = data.rooms.find((entry) => entry.keyCode === booking.keyCode);
        if (room) answer[booking.id] = room.id;
      }
      return answer;
    }
    case "fixCircuit": {
      const data = asData<CircuitData>(puzzle.data);
      const rotations = solveCircuit(data);
      if (!rotations) throw new Error("the generated circuit puzzle has no solution");
      return { rotations };
    }
    default:
      return {};
  }
}

/* --------------------------------------------------------------- bootstrap */

const httpServer = createServer();
const { manager } = attachGameServer(httpServer);
const clients: TestClient[] = [];

async function listen(): Promise<string> {
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", () => resolve()));
  const address = httpServer.address() as AddressInfo;
  return `ws://127.0.0.1:${address.port}/ws`;
}

function newClient(url: string, nickname: string): TestClient {
  const client = new TestClient(url, nickname);
  clients.push(client);
  return client;
}

async function formLobby(url: string, count: number, prefix = "P"): Promise<TestClient[]> {
  const host = newClient(url, `${prefix}1`);
  await host.join(null, 0);
  const others: TestClient[] = [];
  for (let index = 1; index < count; index += 1) {
    const client = newClient(url, `${prefix}${index + 1}`);
    await client.join(host.code, index % 8);
    others.push(client);
  }
  return [host, ...others];
}

/** pick a job one person can finish on their own (co-op jobs need a partner) */
function pickSoloTask(tasks: TaskInstance[], preferKind?: string): TaskInstance {
  const solo = tasks.filter((task) => task.requiresPlayers === 1);
  const pool = solo.length > 0 ? solo : tasks;
  if (preferKind) {
    const preferred = pool.find((task) => task.kind === preferKind);
    if (preferred) return preferred;
  }
  return pool[0];
}

function roomOf(managerRef: RoomManager, code: string): Room {
  const room = managerRef.getRoom(code);
  assert.ok(room, `room ${code} should exist`);
  return room as Room;
}

async function startMatch(room: Room): Promise<void> {
  room.beginPlaying();
}

/* ------------------------------------------------------------------- tests */

async function main(): Promise<void> {
  const url = await listen();
  void manager;
  const suiteStarted = Date.now();
  console.log("\nElephant in the Room - integration tests\n");

  console.log("Lobby");
  await test("a new lobby gets a six-character code and a host", async () => {
    const host = newClient(url, "Ada");
    await host.join(null);
    assert.match(host.code, /^[A-Z0-9]{6}$/);
    assert.equal(host.host, true);
    host.close();
  });

  await test("a ninth player cannot join an eight-player lobby", async () => {
    const group = await formLobby(url, 8, "Nine");
    const room = roomOf(manager, group[0].code);
    assert.equal(room.connectedCount(), 8);
    const extra = newClient(url, "Ninth");
    await extra.readySocket();
    extra.send({ t: "join", code: group[0].code, nickname: "Ninth", avatar: 1 });
    const error = await extra.waitFor("error");
    assert.match(error.message, /full/i);
    extra.close();
    group.forEach((client) => client.close());
  });

  await test("fewer than three players cannot start", async () => {
    const group = await formLobby(url, 2, "Two");
    const host = group[0];
    host.send({ t: "start" });
    const notice = await host.waitFor("notice", (message) => /at least 3 players/i.test(message.text));
    assert.ok(notice);
    const room = roomOf(manager, host.code);
    assert.equal(room.phase, "lobby");
    group.forEach((client) => client.close());
  });

  await test("a three-player lobby starts with exactly one imposter and secret roles", async () => {
    const group = await formLobby(url, 3, "Three");
    const room = roomOf(manager, group[0].code);
    group[0].send({ t: "start" });
    await Promise.all(group.map((client) => client.waitFor("role")));
    const roles = group.map((client) => client.role);
    const imposters = roles.filter((role) => role?.team === "imposters");
    assert.equal(imposters.length, 1, "3 players should produce exactly one impostor");
    assert.equal(roles.length, 3);
    // the imposter learns their teammate list (empty here); employees receive no teammates
    for (const client of group) {
      if (client.role?.team === "imposters") continue;
      assert.equal(client.teammates.length, 0, "employees must not receive teammate information");
      assert.ok(
        client.messageTypes().includes("sabotages") === false,
        "employees must never receive the sabotage panel",
      );
    }
    assert.equal(room.phase, "reveal");
    group.forEach((client) => client.close());
  });

  await test("an eight-player lobby starts with two imposters and all eight get a role", async () => {
    const group = await formLobby(url, 8, "Eight");
    const room = roomOf(manager, group[0].code);
    group[0].send({ t: "start" });
    await Promise.all(group.map((client) => client.waitFor("role")));
    const imposters = group.filter((client) => client.role?.team === "imposters");
    assert.equal(imposters.length, 2, "8 players should produce two impostors");
    assert.equal(group.length, 8);
    const sheriff = group.filter((client) => client.role?.role === "sheriff");
    assert.equal(sheriff.length, 1, "the sheriff is always assigned when there are employees");
    // the two imposters know each other
    for (const imposter of imposters) {
      assert.equal(imposter.teammates.length, 1, "imposters should know their partner");
      const partner = imposter.teammates[0];
      assert.ok(imposters.some((entry) => entry.playerId === partner.id));
    }
    assert.equal(room.phase, "reveal");
    group.forEach((client) => client.close());
  });

  await test("every task kind is solvable from exactly what the player can see", async () => {
    const kinds: TaskKindId[] = TASKS.map((task) => task.id);
    let generated = 0;
    for (const kind of kinds) {
      for (let attempt = 0; attempt < 25; attempt += 1) {
        const rng = new Rng(1000 + attempt * 37 + kind.length * 11);
        const generatedPuzzle = generatePuzzle(rng, kind, `t-${kind}-${attempt}`, "Dining Area");
        const answer = solve(generatedPuzzle.spec);
        const verdict = validateAnswer(kind, generatedPuzzle.solution, answer);
        assert.equal(
          verdict.ok,
          true,
          `${kind} attempt ${attempt} should be solvable from the visible puzzle (${verdict.reason ?? ""})`,
        );
        // and a wrong answer must still be rejected, so validation is not a rubber stamp
        generated += 1;
      }
    }
    assert.equal(generated, kinds.length * 25);
  });

  await test("the server rejects wrong answers to every task kind", async () => {
    for (const kind of TASKS.map((task) => task.id)) {
      const rng = new Rng(4242 + kind.length);
      const generatedPuzzle = generatePuzzle(rng, kind, `bad-${kind}`, "Laundry");
      const verdict = validateAnswer(kind, generatedPuzzle.solution, { nonsense: true });
      assert.equal(verdict.ok, false, `${kind} accepted a nonsense answer`);
    }
  });

  console.log("\nTasks and the work meter");
  await test("an employee completes a real puzzle and the work meter moves", async () => {
    const group = await formLobby(url, 3, "Work");
    const room = roomOf(manager, group[0].code);
    group[0].send({ t: "start" });
    await Promise.all(group.map((client) => client.waitFor("role")));
    await startMatch(room);
    await Promise.all(group.map((client) => client.waitUntil(() => (client.snap?.timeLeft ?? 0) > 0)));

    const employee = group.find((client) => client.role?.team === "employees");
    assert.ok(employee);
    await employee.waitFor("tasks");
    const task = pickSoloTask(employee.tasks);
    assert.ok(task, "an employee should be assigned work");

    const player = room.players.get(employee.playerId);
    assert.ok(player);
    const definition = stationDef(task.stationId);
    assert.ok(definition, "the task must point at a real station");
    const approaches = stationApproachTiles(definition, room.doors);
    assert.ok(approaches.length > 0, "the station must have a walkable approach tile");
    assert.ok(room.teleport(player, approaches[0].x, approaches[0].y), "teleport to the station");

    const before = room.work.done;
    employee.send({ t: "taskOpen", stationId: task.stationId });
    const puzzle = (await employee.waitFor("puzzle")).puzzle;
    await sleep(2700); // the server enforces a minimum working time
    employee.send({ t: "taskSubmit", taskId: puzzle.taskId, answer: solve(puzzle) });
    const result = await employee.waitFor("taskResult");
    assert.equal(result.ok, true, `task should succeed: ${result.reason ?? ""}`);
    assert.equal(room.work.done, before + 1, "the work meter should move by one");
    assert.equal(player.completedTasks, 1);
    group.forEach((client) => client.close());
  });

  await test("a task cannot be completed from the other side of the hotel", async () => {
    const group = await formLobby(url, 3, "Cheat");
    const room = roomOf(manager, group[0].code);
    group[0].send({ t: "start" });
    await Promise.all(group.map((client) => client.waitFor("role")));
    await startMatch(room);
    const employee = group.find((client) => client.role?.team === "employees");
    assert.ok(employee);
    await employee.waitFor("tasks");
    const task = pickSoloTask(employee.tasks);
    const player = room.players.get(employee.playerId);
    assert.ok(player);
    const definition = stationDef(task.stationId);
    assert.ok(definition);
    const approaches = stationApproachTiles(definition, room.doors);
    room.teleport(player, approaches[0].x, approaches[0].y);
    employee.send({ t: "taskOpen", stationId: task.stationId });
    const puzzle = (await employee.waitFor("puzzle")).puzzle;
    // walk away, then submit the correct answer "remotely"
    room.teleport(player, 35, 14);
    await sleep(2700);
    employee.send({ t: "taskSubmit", taskId: puzzle.taskId, answer: solve(puzzle) });
    const result = await employee.waitFor("taskResult");
    assert.equal(result.ok, false);
    assert.match(result.reason ?? "", /not at the job site/i);
    assert.equal(room.work.done, 0);
    group.forEach((client) => client.close());
  });

  await test("instant submissions are rejected as too fast", async () => {
    const group = await formLobby(url, 3, "Fast");
    const room = roomOf(manager, group[0].code);
    group[0].send({ t: "start" });
    await Promise.all(group.map((client) => client.waitFor("role")));
    await startMatch(room);
    const employee = group.find((client) => client.role?.team === "employees");
    assert.ok(employee);
    await employee.waitFor("tasks");
    const task = pickSoloTask(employee.tasks);
    const player = room.players.get(employee.playerId);
    assert.ok(player);
    const definition = stationDef(task.stationId);
    assert.ok(definition);
    const approaches = stationApproachTiles(definition, room.doors);
    room.teleport(player, approaches[0].x, approaches[0].y);
    employee.send({ t: "taskOpen", stationId: task.stationId });
    const puzzle = (await employee.waitFor("puzzle")).puzzle;
    employee.send({ t: "taskSubmit", taskId: puzzle.taskId, answer: solve(puzzle) });
    const result = await employee.waitFor("taskResult");
    assert.equal(result.ok, false);
    assert.match(result.reason ?? "", /fast/i);
    assert.equal(room.work.done, 0);
    group.forEach((client) => client.close());
  });

  console.log("\nRoles, sabotage and the meters");
  await test("the sheriff's wrong arrest spikes exposure", async () => {
    const group = await formLobby(url, 3, "Arrest");
    const room = roomOf(manager, group[0].code);
    group[0].send({ t: "start" });
    await Promise.all(group.map((client) => client.waitFor("role")));
    await startMatch(room);
    const sheriffClient = group.find((client) => client.role?.role === "sheriff");
    const innocentClient = group.find((client) => client.role?.team === "employees" && client.role?.role !== "sheriff");
    assert.ok(sheriffClient && innocentClient, "expected a sheriff and an ordinary employee");
    const sheriff = room.players.get(sheriffClient.playerId);
    const innocent = room.players.get(innocentClient.playerId);
    assert.ok(sheriff && innocent);
    innocent.x = sheriff.x + 32;
    innocent.y = sheriff.y;
    const before = room.exposure;
    sheriffClient.send({ t: "ability", targetId: innocentClient.playerId });
    await sleep(200);
    assert.ok(
      room.exposure >= before + 20,
      `exposure should jump by roughly 22 (was ${before}, now ${room.exposure})`,
    );
    assert.equal(sheriff.arrests, 1);
    assert.equal(innocent.arrestedUntil > Date.now(), true, "the arrested player is briefly held");
    group.forEach((client) => client.close());
  });

  await test("sabotage respects its cooldown and impersonation is impossible for employees", async () => {
    const group = await formLobby(url, 3, "Sab");
    const room = roomOf(manager, group[0].code);
    group[0].send({ t: "start" });
    await Promise.all(group.map((client) => client.waitFor("role")));
    await startMatch(room);
    const imposter = group.find((client) => client.role?.team === "imposters");
    const employee = group.find((client) => client.role?.team === "employees");
    assert.ok(imposter && employee);
    // other systems (incidents, cleaning jobs) also create spills, so compare deltas
    room.settings.incidentsEnabled = false;
    await sleep(120);
    const spillsBefore = room.spills.length;
    imposter.send({ t: "sabotage", kind: "fakeSpill" });
    await sleep(300);
    assert.equal(room.spills.length, spillsBefore + 1, "the first sabotage should create one spill");
    const spillsAfterFirst = room.spills.length;
    imposter.send({ t: "sabotage", kind: "fakeSpill" });
    const notice = await imposter.waitFor("notice", (message) => /cooldown|resetting/i.test(message.text));
    assert.ok(notice.text.length > 0);
    assert.equal(room.spills.length, spillsAfterFirst, "the second sabotage must not fire during cooldown");

    // an employee sending a sabotage message is ignored entirely
    employee.send({ t: "sabotage", kind: "powerOutage" });
    await sleep(200);
    assert.equal(room.darkZones(Date.now()).length, 0, "employees cannot sabotage");
    group.forEach((client) => client.close());
  });

  await test("the staff investigation votes and applies its result", async () => {
    const group = await formLobby(url, 5, "Vote");
    const room = roomOf(manager, group[0].code);
    group[0].send({ t: "start" });
    await Promise.all(group.map((client) => client.waitFor("role")));
    await startMatch(room);
    const imposter = group.find((client) => client.role?.team === "imposters");
    assert.ok(imposter);
    group[0].send({ t: "investigate" });
    await sleep(150);
    assert.equal(room.investigation.open, true);
    for (const client of group) {
      if (client.playerId === imposter.playerId) {
        client.send({ t: "vote", targetId: "skip" });
        continue;
      }
      client.send({ t: "vote", targetId: imposter.playerId });
    }
    await sleep(400);
    assert.equal(room.investigation.open, false, "voting should resolve once everyone has voted");
    const imposterPlayer = room.players.get(imposter.playerId);
    assert.ok(imposterPlayer);
    assert.ok(
      imposterPlayer.suspendedUntil > Date.now(),
      "a correctly identified imposter has their tools taken away",
    );
    group.forEach((client) => client.close());
  });

  console.log("\nWin conditions");
  await test("employees win when the work quota fills", async () => {
    const group = await formLobby(url, 3, "Win");
    const room = roomOf(manager, group[0].code);
    group[0].send({ t: "start" });
    await Promise.all(group.map((client) => client.waitFor("role")));
    await startMatch(room);
    room.work.quota = 1; // keep the test quick: the completion path is what matters
    const employee = group.find((client) => client.role?.team === "employees");
    assert.ok(employee);
    await employee.waitFor("tasks");
    const task = pickSoloTask(employee.tasks, "makeBed");
    const player = room.players.get(employee.playerId);
    assert.ok(player);
    const definition = stationDef(task.stationId);
    assert.ok(definition);
    const approaches = stationApproachTiles(definition, room.doors);
    room.teleport(player, approaches[0].x, approaches[0].y);
    employee.send({ t: "taskOpen", stationId: task.stationId });
    const puzzle = (await employee.waitFor("puzzle")).puzzle;
    await sleep(2700);
    employee.send({ t: "taskSubmit", taskId: puzzle.taskId, answer: solve(puzzle) });
    const results = await employee.waitFor("results");
    assert.equal(results.results.winner, "employees");
    assert.ok(results.results.players.every((entry: PlayerResult) => entry.roleName.length > 0));
    group.forEach((client) => client.close());
  });

  await test("imposters win when exposure hits 100%", async () => {
    const group = await formLobby(url, 3, "Expo");
    const room = roomOf(manager, group[0].code);
    group[0].send({ t: "start" });
    await Promise.all(group.map((client) => client.waitFor("role")));
    await startMatch(room);
    room.applyExposure(100);
    const results = await group[0].waitFor("results");
    assert.equal(results.results.winner, "imposters");
    assert.match(results.results.reason, /Exposure/i);
    group.forEach((client) => client.close());
  });

  await test("imposters win when the timer expires", async () => {
    const group = await formLobby(url, 3, "Clock");
    const room = roomOf(manager, group[0].code);
    group[0].send({ t: "start" });
    await Promise.all(group.map((client) => client.waitFor("role")));
    await startMatch(room);
    room.settings.matchSeconds = 1;
    room.elapsed = 0.99;
    const results = await group[0].waitFor("results");
    assert.equal(results.results.winner, "imposters");
    assert.match(results.results.reason, /Time ran out/i);
    group.forEach((client) => client.close());
  });

  console.log("\nNetworking robustness");
  await test("server-side movement responds to input and respects walls", async () => {
    const group = await formLobby(url, 3, "Move");
    const room = roomOf(manager, group[0].code);
    group[0].send({ t: "start" });
    await Promise.all(group.map((client) => client.waitFor("role")));
    await startMatch(room);
    const mover = group[0];
    await mover.waitUntil(() => mover.snap !== null, 4000, "a first snapshot");
    const startX = mover.self()?.x ?? 0;
    mover.send({ t: "input", seq: 1, mx: -1, my: 0 });
    await sleep(700);
    mover.send({ t: "input", seq: 2, mx: 0, my: 0 });
    await sleep(200);
    const endX = mover.self()?.x ?? 0;
    assert.ok(endX < startX - 20, `the player should have moved left (${startX} -> ${endX})`);
    const player = room.players.get(mover.playerId);
    assert.ok(player);
    assert.equal(
      gameMap.solidAt(player.x, player.y, room.doors),
      false,
      "a player must never end up inside geometry",
    );
    group.forEach((client) => client.close());
  });

  await test("a disconnect pauses the shift and reconnecting restores the role", async () => {
    const group = await formLobby(url, 3, "Drop");
    const room = roomOf(manager, group[0].code);
    group[0].send({ t: "start" });
    await Promise.all(group.map((client) => client.waitFor("role")));
    await startMatch(room);
    const roleBefore = group[2].role?.role;
    group[2].close();
    await sleep(600);
    assert.equal(room.connectedCount(), 2, "the dropped player should be marked disconnected");
    assert.equal(room.paused, true, "with fewer than three players the shift pauses");
    await group[2].resume();
    await sleep(300);
    assert.equal(room.paused, false, "reconnecting should resume the shift");
    assert.equal(room.players.get(group[2].playerId)?.role, roleBefore, "the role survives a reconnect");
    group.forEach((client) => client.close());
  });

  console.log("\nDeterministic simulation (real Room, no sockets)");
  await test("a guest seeing the elephant raises exposure, and a closed door hides it", async () => {
    const room = new Room("TEST01", 1234);
    room.addPlayer("A", 0);
    room.addPlayer("B", 1);
    room.addPlayer("C", 2);
    room.settings.incidentsEnabled = false;
    room.beginPlaying();
    await sleep(150);

    // elephant inside room 101, guest out in the corridor, door open
    const door = room.doors.find((entry) => entry.id === "door101");
    assert.ok(door);
    door.open = true;
    room.elephant.x = 20.5 * 32;
    room.elephant.y = 7.5 * 32;
    const guest = spawnGuest(room, "guest");
    assert.ok(guest);
    guest.x = 20.5 * 32;
    guest.y = 13.5 * 32;
    const before = room.exposure;
    await sleep(700);
    const gained = room.exposure - before;
    assert.ok(gained > 0.5, `an open door should let the guest see the elephant (gained ${gained.toFixed(2)}%)`);

    // close the door: line of sight is blocked, exposure stops climbing
    door.open = false;
    await sleep(120);
    const closed = room.exposure;
    assert.equal(room.hiddenElephant(), true, "the elephant counts as hidden with the door shut");
    await sleep(500);
    assert.ok(
      room.exposure <= closed + 0.05,
      `a closed door should stop exposure gain (${closed.toFixed(2)} -> ${room.exposure.toFixed(2)})`,
    );
    room.destroy();
  });

  await test("elephant growth follows the exposure thresholds", async () => {
    const room = new Room("TEST02", 99);
    room.addPlayer("A", 0);
    room.addPlayer("B", 1);
    room.addPlayer("C", 2);
    room.settings.incidentsEnabled = false;
    room.beginPlaying();
    await sleep(120);
    const scaleBefore = room.elephant.scale;
    assert.equal(room.elephant.stage, 0);
    room.exposure = 60;
    await sleep(250);
    assert.ok(room.elephant.stage >= 2, `expected growth past 50% exposure (stage ${room.elephant.stage})`);
    assert.ok(room.elephant.scale > scaleBefore, "the elephant should be bigger at a later stage");
    room.destroy();
  });

  await test("the elephant cannot stay stuck in a doorway forever", async () => {
    const room = new Room("TEST03", 7);
    room.addPlayer("A", 0);
    room.addPlayer("B", 1);
    room.addPlayer("C", 2);
    room.settings.incidentsEnabled = false;
    room.beginPlaying();
    await sleep(100);
    room.elephant.blocking = true;
    room.elephant.state = "block";
    room.elephant.stateUntil = Date.now() - 1;
    await sleep(300);
    assert.equal(room.elephant.blocking, false, "an expired block state must release the doorway");
    room.destroy();
  });

  await test("every station is reachable and the hotel is fully connected", async () => {
    const doors = [
      { id: "door101", open: true },
      { id: "door102", open: true },
      { id: "frontDoors", open: true },
    ];
    const reachable = gameMap.reachable({ x: 35, y: 13 }, doors);
    for (const definition of STATIONS) {
      if (!definition.interactive) continue;
      const approaches = stationApproachTiles(definition, doors);
      assert.ok(approaches.length > 0, `${definition.id} has no walkable approach tile`);
      const ok = approaches.some((tile) => reachable.has(tile.y * 40 + tile.x));
      assert.ok(ok, `${definition.id} cannot be reached from the lobby`);
    }
    assert.ok(reachable.size > 120, "the walkable hotel should be a decent size");
  });

  /* --------------------------------------------------------------- teardown */

  for (const client of clients) {
    try {
      client.close();
    } catch {
      /* ignore */
    }
  }
  httpServer.close();

  console.log(
    `\n${passed.length} passed, ${failed.length} failed in ${((Date.now() - suiteStarted) / 1000).toFixed(1)}s\n`,
  );
  if (failed.length > 0) {
    for (const failure of failed) {
      console.log(`FAILED: ${failure.name}\n  ${failure.error}`);
    }
    process.exit(1);
  }
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error("test harness failed", error);
  process.exit(1);
});
