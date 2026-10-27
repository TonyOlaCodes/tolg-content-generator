"use client";

/**
 * Procedural art. Every pixel of the game is drawn with the canvas API - the
 * static hotel is baked once into an offscreen layer and blitted per frame,
 * which keeps phones happy, and there are no image assets to ship or license.
 */

import { MAP_H, MAP_W, TILE } from "@/game/config";
import { ARCHWAYS, AVATARS, DOORS, ROOMS, STATIONS, type StationDef } from "@/game/content";
import type { DoorView, ElephantView, GuestView, PlayerView, SpillView, BaitView } from "@/game/protocol";

export const WORLD_W = MAP_W * TILE;
export const WORLD_H = MAP_H * TILE;

function rounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  const r = Math.min(radius, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function shade(color: string, amount: number): string {
  const hex = color.replace("#", "");
  const value = parseInt(hex.length === 3 ? hex.replace(/(.)/g, "$1$1") : hex, 16);
  const r = Math.max(0, Math.min(255, ((value >> 16) & 255) + amount));
  const g = Math.max(0, Math.min(255, ((value >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (value & 255) + amount));
  return `rgb(${r},${g},${b})`;
}

/* ------------------------------------------------------------ static layer */

export function buildStaticLayer(): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = WORLD_W;
  canvas.height = WORLD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // base floor for the whole hall
  ctx.fillStyle = "#f3d9a4";
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);
  ctx.strokeStyle = "rgba(0,0,0,0.05)";
  ctx.lineWidth = 1;
  for (let tx = 0; tx <= MAP_W; tx += 1) {
    ctx.beginPath();
    ctx.moveTo(tx * TILE, 0);
    ctx.lineTo(tx * TILE, WORLD_H);
    ctx.stroke();
  }
  for (let ty = 0; ty <= MAP_H; ty += 1) {
    ctx.beginPath();
    ctx.moveTo(0, ty * TILE);
    ctx.lineTo(WORLD_W, ty * TILE);
    ctx.stroke();
  }

  // room floors
  for (const room of ROOMS) {
    const x = room.x * TILE;
    const y = room.y * TILE;
    const w = room.w * TILE;
    const h = room.h * TILE;
    ctx.fillStyle = room.floor;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = room.floorAlt;
    for (let ty = 0; ty < room.h; ty += 1) {
      for (let tx = 0; tx < room.w; tx += 1) {
        if ((tx + ty) % 2 === 0) ctx.fillRect((room.x + tx) * TILE, (room.y + ty) * TILE, TILE, TILE);
      }
    }
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 6, y + 6, w - 12, h - 12);
  }

  // walls: outer border plus every room ring
  const wallTiles: { x: number; y: number }[] = [];
  for (let tx = 0; tx < MAP_W; tx += 1) {
    wallTiles.push({ x: tx, y: 0 });
    wallTiles.push({ x: tx, y: MAP_H - 1 });
  }
  for (let ty = 0; ty < MAP_H; ty += 1) {
    wallTiles.push({ x: 0, y: ty });
    wallTiles.push({ x: MAP_W - 1, y: ty });
  }
  for (const room of ROOMS) {
    if (room.open) continue; // the corridor and lobby are open hall, not walled rooms
    for (let tx = room.x - 1; tx <= room.x + room.w; tx += 1) {
      wallTiles.push({ x: tx, y: room.y - 1 });
      wallTiles.push({ x: tx, y: room.y + room.h });
    }
    for (let ty = room.y - 1; ty <= room.y + room.h; ty += 1) {
      wallTiles.push({ x: room.x - 1, y: ty });
      wallTiles.push({ x: room.x + room.w, y: ty });
    }
  }
  // punch out archways and doors (doors are drawn dynamically)
  const archwayTiles = new Set(
    ARCHWAYS.flatMap((arch) => arch.tiles.map(([x, y]) => `${x},${y}`)),
  );
  const doorTiles = new Set(
    DOORS.flatMap((door) => door.tiles.map(([x, y]) => `${x},${y}`)),
  );
  const roomFor = (x: number, y: number) =>
    ROOMS.find((room) => !room.open && room.x - 1 <= x && x <= room.x + room.w && room.y - 1 <= y && y <= room.y + room.h);
  for (const tile of wallTiles) {
    const key = `${tile.x},${tile.y}`;
    if (archwayTiles.has(key) || doorTiles.has(key)) continue;
    const room = roomFor(tile.x, tile.y);
    const wallColor = room?.wall ?? "#8a6a45";
    const topColor = room?.wallTop ?? "#a8845c";
    ctx.fillStyle = wallColor;
    rounded(ctx, tile.x * TILE, tile.y * TILE, TILE, TILE, 5);
    ctx.fill();
    ctx.fillStyle = topColor;
    rounded(ctx, tile.x * TILE + 2, tile.y * TILE + 2, TILE - 4, TILE * 0.42, 4);
    ctx.fill();
  }

  // soften the open hall so the walled rooms read as rooms
  for (const room of ROOMS) {
    if (!room.open) continue;
    ctx.fillStyle = "rgba(255,255,255,0.16)";
    ctx.fillRect(room.x * TILE, room.y * TILE, room.w * TILE, room.h * TILE);
  }

  // room nameplates
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const room of ROOMS) {
    const centerX = (room.x + room.w / 2) * TILE;
    const top = room.y * TILE + 6;
    ctx.font = "bold 11px ui-sans-serif, system-ui, sans-serif";
    const label = room.name.toUpperCase();
    const width = ctx.measureText(label).width + 14;
    ctx.fillStyle = "rgba(20,16,12,0.68)";
    rounded(ctx, centerX - width / 2, top, width, 18, 9);
    ctx.fill();
    ctx.fillStyle = "#fff7ea";
    ctx.fillText(label, centerX, top + 10);
  }

  // furniture
  for (const station of STATIONS) drawStation(ctx, station);

  return canvas;
}

function drawStation(ctx: CanvasRenderingContext2D, station: StationDef): void {
  const x = station.x * TILE;
  const y = station.y * TILE;
  const w = station.w * TILE;
  const h = station.h * TILE;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  rounded(ctx, x + 3, y + 6, w - 6, h - 6, 8);
  ctx.fill();

  switch (station.kind) {
    case "desk":
      ctx.fillStyle = "#8b5e34";
      rounded(ctx, x, y, w, h, 8);
      ctx.fill();
      ctx.fillStyle = "#b07d4a";
      rounded(ctx, x + 3, y + 2, w - 6, h * 0.5, 6);
      ctx.fill();
      ctx.fillStyle = "#f7e9d3";
      ctx.fillRect(x + 12, y + 8, 18, 12);
      ctx.fillStyle = "#4b3621";
      ctx.fillRect(x + 40, y + 8, 22, 12);
      break;
    case "bed":
      ctx.fillStyle = "#d9c2a3";
      rounded(ctx, x, y, w, h, 10);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      rounded(ctx, x + 4, y + 20, w - 8, h - 26, 8);
      ctx.fill();
      ctx.fillStyle = "#f1f3f5";
      rounded(ctx, x + 10, y + 6, w - 20, 18, 8);
      ctx.fill();
      break;
    case "shelf":
    case "rack":
      ctx.fillStyle = "#a1785a";
      rounded(ctx, x, y, w, h, 6);
      ctx.fill();
      ctx.fillStyle = "#6b4b32";
      ctx.fillRect(x + 3, y + 6, w - 6, 4);
      ctx.fillRect(x + 3, y + h - 12, w - 6, 4);
      for (let i = 0; i < 3; i += 1) {
        ctx.fillStyle = ["#ffd166", "#63e6be", "#ff8ad8"][i % 3];
        ctx.fillRect(x + 6 + i * 8, y + 12, 6, 10);
      }
      break;
    case "washer":
      ctx.fillStyle = "#e9ecef";
      rounded(ctx, x, y, w, h, 6);
      ctx.fill();
      ctx.fillStyle = "#4dabf7";
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2 + 2, w * 0.32, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "table":
      ctx.fillStyle = "#f8f9fa";
      rounded(ctx, x, y, w, h, 12);
      ctx.fill();
      ctx.fillStyle = "#e0e0e0";
      rounded(ctx, x + 6, y + 6, w - 12, h - 12, 8);
      ctx.fill();
      ctx.fillStyle = "#ffd8a8";
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, 9, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "cake":
      ctx.fillStyle = "#ffe3e3";
      rounded(ctx, x, y, w, h, 6);
      ctx.fill();
      ctx.fillStyle = "#ff8787";
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, w * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2 - 4, 3, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "vending":
      ctx.fillStyle = "#495057";
      rounded(ctx, x, y, w, h, 6);
      ctx.fill();
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(x + 5, y + 5, w - 10, h * 0.5);
      ctx.fillStyle = "#212529";
      ctx.fillRect(x + 5, y + h * 0.68, w - 10, 5);
      break;
    case "powerbox":
      ctx.fillStyle = "#868e96";
      rounded(ctx, x, y, w, h, 5);
      ctx.fill();
      ctx.fillStyle = "#ffd43b";
      ctx.beginPath();
      ctx.moveTo(x + w / 2 + 3, y + 5);
      ctx.lineTo(x + w / 2 - 5, y + h / 2);
      ctx.lineTo(x + w / 2 + 2, y + h / 2);
      ctx.lineTo(x + w / 2 - 3, y + h - 5);
      ctx.lineTo(x + w / 2 + 6, y + h / 2 - 2);
      ctx.closePath();
      ctx.fill();
      break;
    case "trolley":
    case "cart":
      ctx.fillStyle = "#adb5bd";
      rounded(ctx, x, y, w, h, 6);
      ctx.fill();
      ctx.fillStyle = "#f8f9fa";
      rounded(ctx, x + 4, y + 4, w - 8, h * 0.45, 4);
      ctx.fill();
      ctx.fillStyle = "#343a40";
      ctx.beginPath();
      ctx.arc(x + 6, y + h - 3, 3.5, 0, Math.PI * 2);
      ctx.arc(x + w - 6, y + h - 3, 3.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "seat":
      ctx.fillStyle = "#3aa07d";
      rounded(ctx, x, y, w, h, 8);
      ctx.fill();
      ctx.fillStyle = "#63e6be";
      rounded(ctx, x + 4, y + 4, w - 8, h * 0.5, 6);
      ctx.fill();
      break;
    case "plant":
      ctx.fillStyle = "#a4713c";
      rounded(ctx, x + 8, y + h - 14, w - 16, 12, 3);
      ctx.fill();
      ctx.fillStyle = "#2f9e44";
      ctx.beginPath();
      ctx.arc(x + w / 2, y + 8, 10, 0, Math.PI * 2);
      ctx.arc(x + 6, y + 16, 7, 0, Math.PI * 2);
      ctx.arc(x + w - 6, y + 16, 7, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "bin":
      ctx.fillStyle = "#868e96";
      rounded(ctx, x + 4, y + 4, w - 8, h - 8, 4);
      ctx.fill();
      ctx.fillStyle = "#495057";
      ctx.fillRect(x + 4, y + 4, w - 8, 4);
      break;
    case "bucket":
      ctx.fillStyle = "#4dabf7";
      rounded(ctx, x + 5, y + 8, w - 10, h - 12, 5);
      ctx.fill();
      break;
    case "lamp":
      ctx.fillStyle = "#f1f3f5";
      rounded(ctx, x + 6, y + 2, w - 12, h - 6, 6);
      ctx.fill();
      ctx.fillStyle = "#ffd43b";
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    case "plate":
      ctx.fillStyle = "#f8f9fa";
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.arc(x + 8 + i * 8, y + h / 2, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    default:
      ctx.fillStyle = "#b197fc";
      rounded(ctx, x, y, w, h, 6);
      ctx.fill();
      break;
  }
  ctx.restore();
}

/* ----------------------------------------------------------------- entities */

export function drawDoors(
  ctx: CanvasRenderingContext2D,
  doors: DoorView[],
  forcedOpen: string[] = [],
): void {
  for (const definition of DOORS) {
    const state = doors.find((entry) => entry.id === definition.id);
    const open = state?.open ?? true;
    for (const [tx, ty] of definition.tiles) {
      const x = tx * TILE;
      const y = ty * TILE;
      if (open) {
        ctx.fillStyle = "rgba(120,80,40,0.25)";
        ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = definition.lockable ? "#8b5e34" : "#a1785a";
        ctx.fillRect(x + (tx === definition.tiles[0][0] ? 1 : TILE - 7), y + 2, 6, TILE - 4);
      } else {
        ctx.fillStyle = "#8b5e34";
        rounded(ctx, x + 2, y + 2, TILE - 4, TILE - 4, 4);
        ctx.fill();
        ctx.fillStyle = "#ffe066";
        ctx.beginPath();
        ctx.arc(x + TILE / 2, y + TILE / 2, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (forcedOpen.includes(definition.id)) {
        ctx.strokeStyle = "#ff6b6b";
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
      }
    }
  }
}

export function drawSpill(ctx: CanvasRenderingContext2D, spill: SpillView): void {
  const palette: Record<string, [string, string]> = {
    water: ["#74c0fc", "#4dabf7"],
    food: ["#ffd8a8", "#ffa94d"],
    soap: ["#b2f2bb", "#69db7c"],
  };
  const [inner, outer] = palette[spill.kind] ?? palette.water;
  const radius = 16 + Math.sin(spill.x * 0.2) * 3;
  ctx.save();
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = outer;
  ctx.beginPath();
  ctx.ellipse(spill.x, spill.y, radius, radius * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.ellipse(spill.x - 2, spill.y - 2, radius * 0.7, radius * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawBait(ctx: CanvasRenderingContext2D, bait: BaitView, now: number): void {
  ctx.save();
  ctx.fillStyle = "#f8f9fa";
  ctx.beginPath();
  ctx.ellipse(bait.x, bait.y + 2, 14, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f783ac";
  ctx.beginPath();
  ctx.arc(bait.x, bait.y - 2, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(bait.x, bait.y - 16 + Math.sin(now / 300) * 2, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawBlockedRoutes(
  ctx: CanvasRenderingContext2D,
  routes: string[],
): void {
  for (const route of routes) {
    const [tx, ty] = route.split(",").map(Number);
    const x = tx * TILE;
    const y = ty * TILE;
    ctx.save();
    ctx.fillStyle = "#ff922b";
    ctx.beginPath();
    ctx.moveTo(x + TILE / 2, y + 4);
    ctx.lineTo(x + TILE - 5, y + TILE - 5);
    ctx.lineTo(x + 5, y + TILE - 5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillRect(x + TILE / 2 - 5, y + TILE * 0.45, 10, 4);
    ctx.restore();
  }
}

export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  player: PlayerView,
  isSelf: boolean,
  now: number,
): void {
  const avatar = AVATARS[player.avatar % AVATARS.length];
  const bob = player.moving ? Math.sin(now / 90) * 1.6 : Math.sin(now / 420) * 0.7;
  const facing = player.dir === 3 ? 1 : player.dir === 1 ? -1 : 0;
  ctx.save();
  ctx.translate(player.x, player.y + bob);

  // shadow
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  ctx.beginPath();
  ctx.ellipse(0, 12, 11, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // legs
  ctx.fillStyle = avatar.trim;
  const legSwing = player.moving ? Math.sin(now / 80) * 3 : 0;
  ctx.fillRect(-7, 8 + legSwing * 0.2, 5, 8);
  ctx.fillRect(2, 8 - legSwing * 0.2, 5, 8);

  // body
  ctx.fillStyle = avatar.body;
  rounded(ctx, -10, -8, 20, 20, 8);
  ctx.fill();
  ctx.fillStyle = avatar.trim;
  rounded(ctx, -10, 4, 20, 6, 3);
  ctx.fill();

  // head
  ctx.fillStyle = avatar.skin;
  ctx.beginPath();
  ctx.arc(0, -14, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2b2b2b";
  ctx.beginPath();
  ctx.arc(-3 + facing, -15, 1.6, 0, Math.PI * 2);
  ctx.arc(3 + facing, -15, 1.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#2b2b2b";
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, -10 + bob * 0.2, 2.5, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  if (isSelf) {
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 12, 13, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // name
  ctx.font = "bold 11px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  const labelWidth = ctx.measureText(player.nickname).width + 10;
  rounded(ctx, -labelWidth / 2, -42, labelWidth, 15, 7);
  ctx.fill();
  ctx.fillStyle = "#fff8ee";
  ctx.fillText(player.nickname, 0, -31);

  if (player.tasksDone > 0) {
    ctx.font = "bold 10px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = "#ffd166";
    ctx.fillText(`✓${player.tasksDone}`, 0, -46);
  }
  if (player.arrested) {
    ctx.font = "16px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("🚔", 14, -20);
  } else if (player.suspended) {
    ctx.font = "16px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("🚫", 14, -20);
  }
  if (!player.connected) {
    ctx.globalAlpha = 0.45;
    ctx.font = "14px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("💤", -16, -20);
    ctx.globalAlpha = 1;
  }
  if (player.emote) {
    ctx.font = "18px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = "#fff";
    rounded(ctx, 8, -74, 30, 28, 10);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.fillText(player.emote, 23, -55);
  }
  ctx.restore();
}

export function drawGuest(ctx: CanvasRenderingContext2D, guest: GuestView, now: number): void {
  const palette =
    guest.kind === "vip"
      ? { body: "#e599f7", trim: "#862e9c", hat: true }
      : guest.kind === "manager"
        ? { body: "#4dabf7", trim: "#1864ab", hat: false }
        : { body: "#ced4da", trim: "#868e96", hat: false };
  const bob = guest.moving ? Math.sin(now / 100 + guest.x) * 1.4 : Math.sin(now / 500) * 0.6;
  ctx.save();
  ctx.translate(guest.x, guest.y + bob);
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  ctx.beginPath();
  ctx.ellipse(0, 11, 10, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = palette.trim;
  ctx.fillRect(-6, 7, 4, 7);
  ctx.fillRect(2, 7, 4, 7);
  ctx.fillStyle = palette.body;
  rounded(ctx, -9, -7, 18, 18, 7);
  ctx.fill();
  ctx.fillStyle = "#ffe3c2";
  ctx.beginPath();
  ctx.arc(0, -13, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#3b3b3b";
  ctx.beginPath();
  ctx.arc(-3, -14, 1.5, 0, Math.PI * 2);
  ctx.arc(3, -14, 1.5, 0, Math.PI * 2);
  ctx.fill();
  if (guest.kind === "vip") {
    ctx.fillStyle = "#ffd43b";
    ctx.beginPath();
    ctx.moveTo(-8, -20);
    ctx.lineTo(-4, -26);
    ctx.lineTo(0, -20);
    ctx.lineTo(4, -26);
    ctx.lineTo(8, -20);
    ctx.closePath();
    ctx.fill();
  }
  if (guest.kind === "manager") {
    ctx.fillStyle = "#f8f9fa";
    ctx.fillRect(10, -4, 9, 12);
    ctx.fillStyle = "#212529";
    ctx.fillRect(11, -1, 7, 1.5);
    ctx.fillRect(11, 3, 7, 1.5);
  }
  ctx.font = "bold 10px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  const width = ctx.measureText(guest.label).width + 8;
  rounded(ctx, -width / 2, -38, width, 13, 6);
  ctx.fill();
  ctx.fillStyle = guest.alarmed ? "#ffd8d8" : "#ffffff";
  ctx.fillText(guest.label, 0, -28);
  if (guest.alarmed) {
    ctx.font = "18px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("❗", 12, -22);
  } else if (guest.soothed) {
    ctx.font = "16px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("🙂", 12, -22);
  }
  ctx.restore();
}

export function drawElephant(
  ctx: CanvasRenderingContext2D,
  elephant: ElephantView,
  now: number,
): void {
  const scale = elephant.scale;
  const bob = elephant.moving ? Math.sin(now / 130) * 3 : Math.sin(now / 600) * 1.2;
  ctx.save();
  ctx.translate(elephant.x, elephant.y + bob);
  ctx.scale(scale, scale);

  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(0, 22, 30, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // legs
  ctx.fillStyle = "#8d8f95";
  const stride = elephant.moving ? Math.sin(now / 140) * 4 : 0;
  rounded(ctx, -20, 8 + stride * 0.3, 12, 20, 5);
  ctx.fill();
  rounded(ctx, 8, 8 - stride * 0.3, 12, 20, 5);
  ctx.fill();

  // tail
  ctx.strokeStyle = "#7d7f85";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-22, -2);
  ctx.quadraticCurveTo(-32, 2 + Math.sin(now / 200) * 4, -28, 10 + Math.sin(now / 200) * 5);
  ctx.stroke();

  // body
  ctx.fillStyle = "#a4a6ac";
  rounded(ctx, -24, -18, 48, 40, 18);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  rounded(ctx, -18, -14, 34, 16, 12);
  ctx.fill();

  // ears: driven by the clock so they idle-flap even between snapshots
  const earFlap = Math.sin(now / 320) * 0.16;
  ctx.save();
  ctx.translate(20, -12);
  ctx.rotate(-0.2 + earFlap);
  ctx.fillStyle = "#9a9ca2";
  ctx.beginPath();
  ctx.ellipse(0, 0, 15, 19, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#c9a9a4";
  ctx.beginPath();
  ctx.ellipse(2, 1, 9, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // head
  ctx.fillStyle = "#b0b2b8";
  ctx.beginPath();
  ctx.arc(20, -10, 15, 0, Math.PI * 2);
  ctx.fill();

  // trunk
  ctx.strokeStyle = "#a4a6ac";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  const trunkWave = Math.sin(elephant.trunk) * 8;
  ctx.moveTo(30, -6);
  ctx.quadraticCurveTo(38, 8, 34 + trunkWave * 0.4, 20);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(33, 2);
  ctx.quadraticCurveTo(38, 10, 34 + trunkWave * 0.4, 19);
  ctx.stroke();

  // eyes
  ctx.fillStyle = "#2b2b2b";
  ctx.beginPath();
  ctx.arc(22, -14, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(22.8, -14.8, 0.9, 0, Math.PI * 2);
  ctx.fill();

  if (elephant.asleep) {
    ctx.font = "bold 16px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (let i = 0; i < 3; i += 1) {
      ctx.globalAlpha = 0.7 - i * 0.2;
      ctx.fillText("z", 26 + i * 9, -30 - i * 12 - Math.sin(now / 400 + i) * 3);
    }
    ctx.globalAlpha = 1;
  }
  if (elephant.blocking) {
    ctx.strokeStyle = "rgba(255,146,43,0.8)";
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();

  // state label under the elephant so players can read its mood
  ctx.save();
  ctx.font = "bold 11px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  const text = `${elephant.stateLabel}`;
  const width = ctx.measureText(text).width + 14;
  ctx.fillStyle = "rgba(20,16,12,0.6)";
  rounded(ctx, elephant.x - width / 2, elephant.y + 26 * scale, width, 16, 8);
  ctx.fill();
  ctx.fillStyle = "#ffe8cc";
  ctx.fillText(text, elephant.x, elephant.y + 26 * scale + 11);
  ctx.restore();
}

export function drawDark(
  ctx: CanvasRenderingContext2D,
  dark: string[],
  players: { x: number; y: number }[],
): void {
  if (dark.length === 0) return;
  ctx.save();
  ctx.fillStyle = "rgba(8,8,20,0.72)";
  for (const zone of dark) {
    const room = ROOMS.find((entry) => entry.id === zone);
    if (!room) continue;
    ctx.fillRect(room.x * TILE, room.y * TILE, room.w * TILE, room.h * TILE);
  }
  // torches around players so nobody is completely blind
  ctx.globalCompositeOperation = "destination-out";
  for (const player of players) {
    const gradient = ctx.createRadialGradient(player.x, player.y, 10, player.x, player.y, 96);
    gradient.addColorStop(0, "rgba(0,0,0,1)");
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(player.x, player.y, 96, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.restore();
}

export { shade };
