/**
 * Task puzzles. The server both *generates* the puzzle and *validates* the
 * submitted answer, so a client cannot complete a job it was never assigned,
 * from the wrong place, instantly, or with a wrong answer.
 *
 * Trust note (documented in the README): every puzzle here is visible
 * information, so a modified client could solve it honestly-but-automatically.
 * What the server does guarantee is that the job is assigned to you, you were
 * at the right station, time actually passed, and the answer was correct.
 */

import type { TaskKindId, ZoneId } from "../game/content";
import type { PuzzleSpec } from "../game/protocol";
import { taskDef } from "../game/content";
import { Rng } from "../game/rng";

export interface GeneratedPuzzle {
  spec: PuzzleSpec;
  solution: unknown;
}

interface Slot {
  id: string;
  label: string;
  glyph: string;
}

/**
 * Bed labels are deliberately identical to the slot labels below: a player must be
 * able to solve the puzzle from what they can see, so the two lists are kept in
 * lockstep (they used to drift, which made the task impossible).
 */
const BED_ITEMS: Slot[] = [
  { id: "sheet", label: "Bottom sheet", glyph: "🧻" },
  { id: "duvet", label: "Duvet", glyph: "🛌" },
  { id: "pillow", label: "Pillow", glyph: "🛏" },
  { id: "teddy", label: "Teddy", glyph: "🧸" },
];

/** labels for the four drop zones, exactly matching BED_ITEMS */
const BED_SLOT_LABELS = ["Bottom sheet", "Duvet", "Pillow", "Teddy"];

const LAUNDRY_COLORS = [
  { color: "white", label: "Whites", glyph: "👕" },
  { color: "dark", label: "Darks", glyph: "👖" },
  { color: "red", label: "Reds", glyph: "🧣" },
];

const SHELF_ITEMS: { id: string; label: string; glyph: string }[] = [
  { id: "shampoo", label: "Shampoo", glyph: "🧴" },
  { id: "soap", label: "Soap", glyph: "🧼" },
  { id: "towels", label: "Towels", glyph: "🧺" },
  { id: "coffee", label: "Coffee", glyph: "☕" },
  { id: "biscuits", label: "Biscuits", glyph: "🍪" },
];

const DISHES = [
  { dish: "Fish and chips", glyph: "🐟" },
  { dish: "Tomato soup", glyph: "🍅" },
  { dish: "Club sandwich", glyph: "🥪" },
  { dish: "Fruit salad", glyph: "🍇" },
  { dish: "Birthday cake", glyph: "🎂" },
];

const GUEST_NAMES = [
  "Mrs. Pemberton",
  "Mr. Ashcroft",
  "Chef Laurent",
  "Coach Barlow",
  "Lady Fitzgerald",
  "Dr. Nkemdirim",
];

const ROOM_LABELS = ["Room 101", "Room 102", "Reception"];
const KEY_CODES = ["412", "908", "077", "531", "264"];

export function generatePuzzle(
  rng: Rng,
  kind: TaskKindId,
  taskId: string,
  roomLabel: string,
): GeneratedPuzzle {
  const def = taskDef(kind);
  const base: Omit<PuzzleSpec, "data" | "prompt"> = {
    taskId,
    kind,
    title: def.name,
    timeLimit: Math.round(def.seconds * 2.2),
  };

  switch (kind) {
    case "makeBed": {
      const slots: Slot[] = BED_SLOT_LABELS.map((label, index) => ({
        id: `s${index}`,
        label,
        glyph: ["🟦", "🟪", "⬜", "🧸"][index],
      }));
      const items = [...BED_ITEMS, { id: "pillow2", label: "Spare pillow", glyph: "⬜" }];
      const solution: Record<string, string> = {};
      BED_ITEMS.forEach((item, index) => {
        solution[item.id] = `s${index}`;
      });
      return {
        spec: {
          ...base,
          prompt: `Make the bed in ${roomLabel}.`,
          data: { slots, items: rng.shuffle(items) },
        },
        solution,
      };
    }
    case "cleanSpill": {
      const count = rng.int(5, 7);
      const spots = Array.from({ length: count }, (_, index) => ({
        id: `d${index}`,
        x: rng.int(12, 88),
        y: rng.int(18, 82),
        size: rng.int(12, 20),
      }));
      return {
        spec: {
          ...base,
          prompt: `Mop the spill in ${roomLabel}.`,
          data: { spots },
        },
        solution: spots.map((spot) => spot.id),
      };
    }
    case "sortLaundry": {
      const count = rng.int(5, 6);
      const perBasket: Record<string, number> = {};
      const items: { id: string; color: string; label: string; glyph: string }[] = [];
      const solution: Record<string, string> = {};
      for (let i = 0; i < count; i += 1) {
        const colorIndex = i % LAUNDRY_COLORS.length;
        const color = LAUNDRY_COLORS[colorIndex];
        const id = `l${i}`;
        perBasket[color.color] = (perBasket[color.color] ?? 0) + 1;
        items.push({ id, color: color.color, label: `${color.color} item ${perBasket[color.color]}`, glyph: color.glyph });
        solution[id] = `b${colorIndex}`;
      }
      return {
        spec: {
          ...base,
          prompt: "Sort the laundry into the right baskets.",
          data: {
            items: rng.shuffle(items),
            baskets: LAUNDRY_COLORS.map((color, index) => ({
              id: `b${index}`,
              color: color.color,
              label: color.label,
              glyph: color.glyph,
              capacity: 2,
            })),
          },
        },
        solution,
      };
    }
    case "deliverLuggage": {
      const count = rng.int(3, 4);
      const rooms = rng.shuffle(ROOM_LABELS).slice(0, count);
      const solution: Record<string, string> = {};
      const bags = rooms.map((room, index) => {
        const id = `g${index}`;
        solution[id] = `r${index}`;
        return { id, tag: room, glyph: "🧳", heavy: index === 0 };
      });
      return {
        spec: {
          ...base,
          prompt: "Deliver each bag to the room on its tag.",
          data: {
            bags: rng.shuffle(bags),
            rooms: rng.shuffle(rooms.map((room, index) => ({ id: `r${index}`, label: room }))),
          },
        },
        solution,
      };
    }
    case "restockSupplies": {
      const count = rng.int(4, 5);
      const chosen = rng.shuffle(SHELF_ITEMS).slice(0, count);
      return {
        spec: {
          ...base,
          prompt: "Restock the shelf in the order on the checklist.",
          data: {
            checklist: chosen.map((item) => item.label),
            slots: chosen.map((_, index) => ({ id: `s${index}`, index })),
            items: rng.shuffle(chosen),
          },
        },
        solution: chosen.map((item) => item.id),
      };
    }
    case "serveMeals": {
      const count = rng.int(3, 4);
      const dishes = rng.shuffle(DISHES).slice(0, count);
      const orders = dishes.map((dish, index) => ({
        id: `o${index}`,
        guest: GUEST_NAMES[index % GUEST_NAMES.length],
        dish: dish.dish,
        glyph: "🧾",
      }));
      const plates = rng.shuffle(
        dishes.map((dish, index) => ({ id: `p${index}`, dish: dish.dish, glyph: dish.glyph })),
      );
      const solution: Record<string, string> = {};
      orders.forEach((order) => {
        const plate = plates.find((candidate) => candidate.dish === order.dish);
        if (plate) solution[order.id] = plate.id;
      });
      return {
        spec: {
          ...base,
          prompt: "Match every order to the right plate.",
          data: { orders, plates },
        },
        solution,
      };
    }
    case "fixCircuit": {
      /**
       * Build a grid that is guaranteed solvable. The route is constructed by
       * sweeping left to right and only ever moving vertically *inside* the column
       * it is in, so it can never revisit a cell and can never skip one. Every
       * cell the route does not use is completely dead (a pipe with no arms,
       * which no rotation can connect), so the route is the only way through.
       */
      const w = 3;
      const h = 3;
      const startY = rng.int(0, h - 1);
      const endX = w - 1;
      const endY = rng.int(0, h - 1);
      const startX = 0;
      const path: { x: number; y: number }[] = [{ x: startX, y: startY }];
      let row = startY;
      for (let column = 0; column < w; column += 1) {
        const target = column === w - 1 ? endY : rng.chance(0.65) ? rng.int(0, h - 1) : row;
        while (row !== target) {
          row += Math.sign(target - row);
          path.push({ x: column, y: row });
        }
        if (column < w - 1) path.push({ x: column + 1, y: row });
      }
      /** pattern the route needs at a cell, read from the route order itself */
      const connectionFor = (index: number): ConnectionTuple => {
        const cell = path[index];
        const previous = path[index - 1];
        const next = path[index + 1];
        const has = (x: number, y: number): boolean =>
          Boolean(
            (previous && previous.x === x && previous.y === y) ||
              (next && next.x === x && next.y === y),
          );
        return [has(cell.x, cell.y - 1), has(cell.x + 1, cell.y), has(cell.x, cell.y + 1), has(cell.x - 1, cell.y)];
      };;
      const cells: CircuitCell[] = [];
      for (let y = 0; y < h; y += 1) {
        for (let x = 0; x < w; x += 1) {
          const id = `c${x}${y}`;
          const pathIndex = path.findIndex((step) => step.x === x && step.y === y);
          if (pathIndex === -1) {
            // a dead cell: no arms in any rotation, so it can never be part of a route
            cells.push({ id, x, y, kind: "elbow", rotation: rng.int(0, 3), base: [false, false, false, false] });
            continue;
          }
          const connections = connectionFor(pathIndex);
          const isSource = x === startX && y === startY;
          const isOutlet = x === endX && y === endY;
          const kind: CircuitCellKind = isSource
            ? "source"
            : isOutlet
              ? "outlet"
              : (connections[0] && connections[2]) || (connections[1] && connections[3])
                ? "straight"
                : "elbow";
          const canonical = encodeConnections(kind, connections);
          // `base` is the connection tuple at rotation 0; the renderer rotates it
          // clockwise by the player's chosen rotation. Source and outlet are fixed.
          cells.push({
            id,
            x,
            y,
            kind,
            rotation: isSource || isOutlet ? 0 : rng.int(0, 3),
            base: canonical.base,
          });
        }
      }
      const solution = { w, h, source: { x: startX, y: startY }, outlet: { x: endX, y: endY }, cells };
      return {
        spec: {
          ...base,
          prompt: "Rotate the pipes until the power flows through.",
          data: { w, h, source: { x: startX, y: startY }, outlet: { x: endX, y: endY }, cells },
        },
        solution,
      };
    }
    case "checkInGuests": {
      const count = rng.int(3, 3);
      const codes = rng.shuffle(KEY_CODES).slice(0, count);
      const bookings = codes.map((code, index) => ({
        id: `k${index}`,
        name: GUEST_NAMES[index % GUEST_NAMES.length],
        nights: `${rng.int(1, 4)} nights`,
        keyCode: code,
      }));
      const rooms = rng.shuffle(
        ROOM_LABELS.map((label, index) => ({
          id: `r${index}`,
          label,
          keyCode: codes[index % codes.length],
        })),
      );
      const solution: Record<string, string> = {};
      bookings.forEach((booking) => {
        const room = rooms.find((candidate) => candidate.keyCode === booking.keyCode);
        if (room) solution[booking.id] = room.id;
      });
      return {
        spec: {
          ...base,
          prompt: "Match each booking to the room with its key code.",
          data: { bookings: rng.shuffle(bookings), rooms },
        },
        solution,
      };
    }
    default: {
      const fallback: GeneratedPuzzle = {
        spec: { ...base, prompt: "Finish the job.", data: {} },
        solution: null,
      };
      return fallback;
    }
  }
}

export type ConnectionTuple = [boolean, boolean, boolean, boolean];
export type CircuitCellKind = "straight" | "elbow" | "tee" | "source" | "outlet";

/** connection order is [up, right, down, left] */
export interface CircuitCell {
  id: string;
  x: number;
  y: number;
  kind: CircuitCellKind;
  /** player-controlled rotation for this cell (0-3) */
  rotation: number;
  /** connections at rotation 0 */
  base: ConnectionTuple;
}

/**
 * A pipe cell is described by the connection tuple it has at rotation 0.
 * Rotating it clockwise cycles [up, right, down, left] -> [left, up, right, down].
 * The generator picks a canonical base whose rotation matches the wanted shape
 * so the player has to turn pipes until everything lines up.
 */
function encodeConnections(
  kind: CircuitCellKind,
  target: ConnectionTuple,
): { rotation: number; base: ConnectionTuple } {
  if (kind === "source" || kind === "outlet") {
    return { rotation: 0, base: target };
  }
  const bases: ConnectionTuple[] =
    kind === "straight"
      ? [
          [true, false, true, false],
          [true, false, true, false],
          [false, true, false, true],
          [false, true, false, true],
        ]
      : kind === "tee"
        ? [
            [true, true, true, false],
            [true, true, true, false],
            [true, true, true, false],
            [true, true, true, false],
          ]
        : [
            [true, true, false, false],
            [true, true, false, false],
            [true, true, false, false],
            [true, true, false, false],
          ];
  const base = bases[0];
  for (let rotation = 0; rotation < 4; rotation += 1) {
    const candidate = rotateConnections(base, rotation);
    if (candidate.every((value, index) => value === target[index])) {
      return { rotation, base };
    }
  }
  return { rotation: 0, base };
}

/** rotate a connection tuple clockwise */
export function rotateConnections(connections: ConnectionTuple, times: number): ConnectionTuple {
  let current = connections;
  const turns = ((times % 4) + 4) % 4;
  for (let i = 0; i < turns; i += 1) {
    current = [current[3], current[0], current[1], current[2]];
  }
  return current;
}

export function validateAnswer(kind: TaskKindId, solution: unknown, answer: unknown): { ok: boolean; reason?: string } {
  const wrong = () => ({ ok: false, reason: "That is not quite right. Try again." });
  switch (kind) {
    case "makeBed": {
      const expected = solution as Record<string, string>;
      const given = (answer ?? {}) as Record<string, string>;
      for (const [item, slot] of Object.entries(expected)) {
        if (given[item] !== slot) return wrong();
      }
      return { ok: true };
    }
    case "cleanSpill": {
      const expected = solution as string[];
      const given = ((answer ?? {}) as { spots?: string[] }).spots ?? [];
      const set = new Set(given);
      for (const spot of expected) {
        if (!set.has(spot)) return { ok: false, reason: "There is still mess on the floor." };
      }
      return { ok: true };
    }
    case "sortLaundry": {
      const expected = solution as Record<string, string>;
      const given = (answer ?? {}) as Record<string, string>;
      for (const [item, basket] of Object.entries(expected)) {
        if (given[item] !== basket) return wrong();
      }
      return { ok: true };
    }
    case "deliverLuggage": {
      const expected = solution as Record<string, string>;
      const given = (answer ?? {}) as Record<string, string>;
      const required = Object.keys(expected);
      if (required.length === 0) return wrong();
      for (const bag of required) {
        if (given[bag] !== expected[bag]) return { ok: false, reason: "A guest is missing their suitcase." };
      }
      return { ok: true };
    }
    case "restockSupplies": {
      const expected = solution as string[];
      const given = (answer ?? []) as string[];
      if (!Array.isArray(given) || given.length !== expected.length) return wrong();
      for (let i = 0; i < expected.length; i += 1) {
        if (given[i] !== expected[i]) return { ok: false, reason: "The shelf does not match the checklist." };
      }
      return { ok: true };
    }
    case "serveMeals": {
      const expected = solution as Record<string, string>;
      const given = (answer ?? {}) as Record<string, string>;
      for (const [order, plate] of Object.entries(expected)) {
        if (given[order] !== plate) return { ok: false, reason: "Someone got the wrong dinner." };
      }
      return { ok: true };
    }
    case "fixCircuit": {
      const data = solution as CircuitSolution;
      const given = ((answer ?? {}) as { rotations?: Record<string, number> }).rotations ?? {};
      const idAt = (x: number, y: number) => `c${x}${y}`;
      const connectionsFor = (id: string): ConnectionTuple | null => {
        const cell = data.cells.find((candidate) => candidate.id === id);
        if (!cell) return null;
        if (cell.kind === "source" || cell.kind === "outlet") return cell.base;
        return rotateConnections(cell.base, given[id] ?? cell.rotation);
      };
      const start = idAt(data.source.x, data.source.y);
      const goal = idAt(data.outlet.x, data.outlet.y);
      const seen = new Set<string>([start]);
      const queue = [start];
      while (queue.length > 0) {
        const current = queue.shift() as string;
        if (current === goal) return { ok: true };
        const cell = data.cells.find((candidate) => candidate.id === current);
        if (!cell) continue;
        const connections = connectionsFor(current);
        if (!connections) continue;
        const neighbours: [string, number][] = [
          [idAt(cell.x, cell.y - 1), 0],
          [idAt(cell.x + 1, cell.y), 1],
          [idAt(cell.x, cell.y + 1), 2],
          [idAt(cell.x - 1, cell.y), 3],
        ];
        const opposite = [2, 3, 0, 1];
        for (const [neighbourId, direction] of neighbours) {
          if (!connections[direction]) continue;
          const neighbour = data.cells.find((candidate) => candidate.id === neighbourId);
          if (!neighbour) continue;
          const neighbourConnections = connectionsFor(neighbourId);
          if (!neighbourConnections || !neighbourConnections[opposite[direction]]) continue;
          if (seen.has(neighbourId)) continue;
          seen.add(neighbourId);
          queue.push(neighbourId);
        }
      }
      return { ok: false, reason: "The power still is not flowing." };
    }
    case "checkInGuests": {
      const expected = solution as Record<string, string>;
      const given = (answer ?? {}) as Record<string, string>;
      for (const [booking, room] of Object.entries(expected)) {
        if (given[booking] !== room) return { ok: false, reason: "That booking does not match the key code." };
      }
      return { ok: true };
    }
    default:
      return { ok: true };
  }
}

export interface CircuitSolution {
  w: number;
  h: number;
  source: { x: number; y: number };
  outlet: { x: number; y: number };
  cells: CircuitCell[];
}

export function puzzleRoomHint(room: ZoneId, name: string): string {
  return name || room;
}
