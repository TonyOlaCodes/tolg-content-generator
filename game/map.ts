/**
 * The hotel's static geometry, shared by the server (collision, line of sight,
 * pathfinding) and the client (rendering). Built from the data in content.ts so
 * the layout can be edited without touching simulation code.
 */

import { MAP_H, MAP_W, PLAYER_RADIUS } from "./config";
import {
  ARCHWAYS,
  DOORS,
  ROOMS,
  STATIONS,
  type DoorDef,
  type StationDef,
  type ZoneId,
} from "./content";

export const FLOOR = 0;
export const WALL = 1;
/** a door tile: solid unless that door is open */
export const DOOR_TILE = 2;

export function tileIndex(tx: number, ty: number): number {
  return ty * MAP_W + tx;
}

export interface DoorState {
  id: string;
  open: boolean;
}

export class GameMap {
  readonly tiles = new Uint8Array(MAP_W * MAP_H);
  /** tile -> door index, -1 when the tile is not a door */
  readonly doorAt = new Int16Array(MAP_W * MAP_H).fill(-1);
  readonly doorDefs: DoorDef[] = DOORS;
  readonly stations: StationDef[] = STATIONS;

  constructor() {
    // border walls, with the front doors punched through on the east edge
    for (let tx = 0; tx < MAP_W; tx += 1) {
      this.tiles[tileIndex(tx, 0)] = WALL;
      this.tiles[tileIndex(tx, MAP_H - 1)] = WALL;
    }
    for (let ty = 0; ty < MAP_H; ty += 1) {
      this.tiles[tileIndex(0, ty)] = WALL;
      this.tiles[tileIndex(MAP_W - 1, ty)] = WALL;
    }

    // wall rings around the walled rooms only; open zones (corridor, lobby) are
    // part of the hall and must stay passable end to end
    for (const room of ROOMS) {
      if (room.open) continue;
      for (let tx = room.x - 1; tx <= room.x + room.w; tx += 1) {
        this.setWall(tx, room.y - 1);
        this.setWall(tx, room.y + room.h);
      }
      for (let ty = room.y - 1; ty <= room.y + room.h; ty += 1) {
        this.setWall(room.x - 1, ty);
        this.setWall(room.x + room.w, ty);
      }
    }

    // open archways
    for (const arch of ARCHWAYS) {
      for (const [tx, ty] of arch.tiles) {
        if (this.inBounds(tx, ty)) this.tiles[tileIndex(tx, ty)] = FLOOR;
      }
    }

    // closable doors: marked as door tiles, blocked while shut
    this.doorDefs.forEach((door, index) => {
      for (const [tx, ty] of door.tiles) {
        if (!this.inBounds(tx, ty)) continue;
        this.tiles[tileIndex(tx, ty)] = DOOR_TILE;
        this.doorAt[tileIndex(tx, ty)] = index;
      }
    });

    // gap tiles the elephant likes to wedge itself into (and where it can trap a route)
    this.doorwayTiles = [
      ...ARCHWAYS.flatMap((arch) => arch.tiles.map(([x, y]) => ({ x, y }))),
      ...this.doorDefs.flatMap((door) => door.tiles.map(([x, y]) => ({ x, y }))),
    ];

    // solid furniture blocks movement but never becomes a wall tile
    this.solidStations = this.stations.filter((s) => s.solid);
  }

  readonly solidStations: StationDef[];
  readonly doorwayTiles: { x: number; y: number }[];

  private setWall(tx: number, ty: number): void {
    if (!this.inBounds(tx, ty)) return;
    this.tiles[tileIndex(tx, ty)] = WALL;
  }

  inBounds(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < MAP_W && ty < MAP_H;
  }

  /** true when a player-sized body can occupy this tile center */
  walkable(tx: number, ty: number, doors: DoorState[]): boolean {
    if (!this.inBounds(tx, ty)) return false;
    const tile = this.tiles[tileIndex(tx, ty)];
    if (tile === WALL) return false;
    if (tile === DOOR_TILE) {
      const index = this.doorAt[tileIndex(tx, ty)];
      const door = doors[index];
      if (!door || !door.open) return false;
    }
    return !this.furnitureBlocks(tx, ty);
  }

  furnitureBlocks(tx: number, ty: number): boolean {
    for (const station of this.solidStations) {
      if (tx >= station.x && tx < station.x + station.w && ty >= station.y && ty < station.y + station.h) {
        return true;
      }
    }
    return false;
  }

  /** true when the *rendered* elephant body can stand here (it ignores tables) */
  elephantWalkable(tx: number, ty: number, doors: DoorState[]): boolean {
    if (!this.inBounds(tx, ty)) return false;
    const tile = this.tiles[tileIndex(tx, ty)];
    if (tile === WALL) return false;
    if (tile === DOOR_TILE) {
      const door = doors[this.doorAt[tileIndex(tx, ty)]];
      if (!door || !door.open) return false;
    }
    return true;
  }

  zoneAt(tx: number, ty: number): ZoneId {
    for (const room of ROOMS) {
      if (tx >= room.x && tx < room.x + room.w && ty >= room.y && ty < room.y + room.h) {
        return room.id;
      }
    }
    return "corridor";
  }

  /** is this world position inside a room (not the open hall)? */
  roomAt(tx: number, ty: number): ZoneId | null {
    for (const room of ROOMS) {
      if (tx >= room.x && tx < room.x + room.w && ty >= room.y && ty < room.y + room.h) {
        return room.id;
      }
    }
    return null;
  }

  /**
   * Bresenham-ish walk through the tile grid. Used by guests to decide whether a
   * giant elephant is visible; closed doors and walls stop the sight-line.
   */
  lineOfSight(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    doors: DoorState[],
    maxTiles = 24,
  ): boolean {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 8);
    if (steps <= 0) return true;
    if (Math.hypot(x1 - x0, y1 - y0) / 32 > maxTiles) return false;
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      const px = x0 + (x1 - x0) * t;
      const py = y0 + (y1 - y0) * t;
      const tx = Math.floor(px / 32);
      const ty = Math.floor(py / 32);
      if (!this.inBounds(tx, ty)) return false;
      const tile = this.tiles[tileIndex(tx, ty)];
      if (tile === WALL) return false;
      if (tile === DOOR_TILE) {
        const door = doors[this.doorAt[tileIndex(tx, ty)]];
        if (!door || !door.open) return false;
      }
    }
    return true;
  }

  /** nearest walkable tile to an arbitrary (possibly out-of-bounds) tile */
  nearestWalkable(tx: number, ty: number, doors: DoorState[]): { x: number; y: number } | null {
    if (this.walkable(tx, ty, doors)) return { x: tx, y: ty };
    for (let radius = 1; radius <= 8; radius += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
          const nx = tx + dx;
          const ny = ty + dy;
          if (this.walkable(nx, ny, doors)) return { x: nx, y: ny };
        }
      }
    }
    return null;
  }

  /** 4-directional BFS; returns tile centers from start to goal (excluding start) */
  findPath(
    start: { x: number; y: number },
    goal: { x: number; y: number },
    doors: DoorState[],
    avoid: { x: number; y: number }[] = [],
    maxNodes = 2200,
  ): { x: number; y: number }[] | null {
    const sx = Math.round(start.x);
    const sy = Math.round(start.y);
    const gx = Math.round(goal.x);
    const gy = Math.round(goal.y);
    const startNode = this.nearestWalkable(sx, sy, doors);
    const goalNode = this.nearestWalkable(gx, gy, doors);
    if (!startNode || !goalNode) return null;
    const avoidSet = new Set(avoid.map((p) => tileIndex(p.x, p.y)));
    const cameFrom = new Int32Array(MAP_W * MAP_H).fill(-1);
    const seen = new Uint8Array(MAP_W * MAP_H);
    const queue: number[] = [tileIndex(startNode.x, startNode.y)];
    seen[queue[0]] = 1;
    const goalIndex = tileIndex(goalNode.x, goalNode.y);
    let visited = 0;
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    let found = false;
    while (queue.length > 0 && visited < maxNodes) {
      const current = queue.shift() as number;
      visited += 1;
      if (current === goalIndex) {
        found = true;
        break;
      }
      const cx = current % MAP_W;
      const cy = Math.floor(current / MAP_W);
      for (const [dx, dy] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;
        const index = tileIndex(nx, ny);
        if (seen[index]) continue;
        if (!this.walkable(nx, ny, doors)) continue;
        if (avoidSet.has(index) && index !== goalIndex) continue;
        seen[index] = 1;
        cameFrom[index] = current;
        queue.push(index);
      }
    }
    if (!found && seen[goalIndex] === 0) return null;
    const path: { x: number; y: number }[] = [];
    let node = goalIndex;
    while (node !== tileIndex(startNode.x, startNode.y) && node >= 0) {
      path.push({ x: node % MAP_W, y: Math.floor(node / MAP_W) });
      node = cameFrom[node];
    }
    path.reverse();
    return path;
  }

  /** every walkable tile that is reachable from a starting tile */
  reachable(start: { x: number; y: number }, doors: DoorState[]): Set<number> {
    const origin = this.nearestWalkable(Math.round(start.x), Math.round(start.y), doors);
    const out = new Set<number>();
    if (!origin) return out;
    const queue: number[] = [tileIndex(origin.x, origin.y)];
    out.add(queue[0]);
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    while (queue.length > 0) {
      const current = queue.shift() as number;
      const cx = current % MAP_W;
      const cy = Math.floor(current / MAP_W);
      for (const [dx, dy] of dirs) {
        const nx = cx + dx;
        const ny = cy + dy;
        const index = tileIndex(nx, ny);
        if (out.has(index)) continue;
        if (!this.walkable(nx, ny, doors)) continue;
        out.add(index);
        queue.push(index);
      }
    }
    return out;
  }

  /**
   * Axis-separated movement with sliding, so players glide along walls instead of
   * sticking. `occupied` lets callers block against the elephant's footprint.
   */
  moveCircle(
    from: { x: number; y: number },
    dx: number,
    dy: number,
    doors: DoorState[],
    occupied: (x: number, y: number) => boolean = () => false,
    radius = PLAYER_RADIUS,
  ): { x: number; y: number; hit: boolean } {
    let x = from.x;
    let y = from.y;
    let hit = false;
    const tryAxis = (nx: number, ny: number): boolean => {
      if (this.solidAt(nx, ny, doors, radius) || occupied(nx, ny)) return false;
      return true;
    };
    if (dx !== 0) {
      if (tryAxis(x + dx, y)) x += dx;
      else {
        for (let step = Math.abs(dx); step >= 0; step -= 1) {
          const candidate = x + Math.sign(dx) * step;
          if (tryAxis(candidate, y)) {
            x = candidate;
            break;
          }
        }
        hit = true;
      }
    }
    if (dy !== 0) {
      if (tryAxis(x, y + dy)) y += dy;
      else {
        for (let step = Math.abs(dy); step >= 0; step -= 1) {
          const candidate = y + Math.sign(dy) * step;
          if (tryAxis(x, candidate)) {
            y = candidate;
            break;
          }
        }
        hit = true;
      }
    }
    return { x, y, hit };
  }

  /** does a body of `radius` px at this world position overlap geometry? */
  solidAt(x: number, y: number, doors: DoorState[], radius = PLAYER_RADIUS): boolean {
    const minTx = Math.floor((x - radius) / 32);
    const maxTx = Math.floor((x + radius) / 32);
    const minTy = Math.floor((y - radius) / 32);
    const maxTy = Math.floor((y + radius) / 32);
    for (let ty = minTy; ty <= maxTy; ty += 1) {
      for (let tx = minTx; tx <= maxTx; tx += 1) {
        if (this.walkable(tx, ty, doors)) continue;
        return true;
      }
    }
    return false;
  }
}

export const WORLD_W = MAP_W * 32;
export const WORLD_H = MAP_H * 32;

/** A single shared instance: the layout never changes at runtime. */
export const gameMap = new GameMap();

export function stationCenter(def: StationDef): { x: number; y: number } {
  return {
    x: (def.x + def.w / 2) * 32,
    y: (def.y + def.h / 2) * 32,
  };
}

/** tiles a player can stand on to use a station */
export function stationApproachTiles(def: StationDef, doors: DoorState[]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let ty = def.y - 1; ty <= def.y + def.h; ty += 1) {
    for (let tx = def.x - 1; tx <= def.x + def.w; tx += 1) {
      const insideFootprint = tx >= def.x && tx < def.x + def.w && ty >= def.y && ty < def.y + def.h;
      if (insideFootprint) continue;
      const onEdge = tx === def.x - 1 || tx === def.x + def.w || ty === def.y - 1 || ty === def.y + def.h;
      if (!onEdge) continue;
      if (gameMap.walkable(tx, ty, doors)) out.push({ x: tx, y: ty });
    }
  }
  return out;
}
