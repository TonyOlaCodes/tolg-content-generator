/**
 * The incident engine: 12 hotel events that keep every round unpredictable.
 * Incidents are selected with weights, per-incident cooldowns and a match-time
 * gate, and the gap between them shrinks as the match runs on. Everything here
 * changes real state (spawns, doors, dark zones, spills, guidance) rather than
 * just printing text.
 */

import { INCIDENT_FIRST_AT, INCIDENT_INTERVAL } from "../game/config";
import { INCIDENTS, ROOMS, STATIONS, type IncidentDef, type ZoneId } from "../game/content";
import { forceElephantState } from "./elephant";
import { spawnGuest } from "./guests";
import type { Room } from "./room";

export function incidentInterval(room: Room, elapsed: number): number {
  const base = Math.max(11, INCIDENT_INTERVAL - elapsed / 22);
  const factor = room.settings.modifiers.includes("doubleTrouble") ? 0.55 : 1;
  return base * factor;
}

export function incidentTick(room: Room): void {
  if (!room.settings.incidentsEnabled) return;
  const now = room.now();
  if (now < room.nextIncidentAt) return;
  room.nextIncidentAt = now + incidentInterval(room, room.elapsed) * 1000;
  fireIncident(room);
}

export function fireIncident(room: Room, forcedId?: string): IncidentDef | null {
  const now = room.now();
  if (forcedId) {
    const def = INCIDENTS.find((entry) => entry.id === forcedId);
    if (!def) return null;
    room.incidentHistory.set(def.id, now);
    applyIncident(room, def.id);
    return def;
  }
  const candidates = INCIDENTS.filter((def) => {
    if (room.elapsed < def.minTime) return false;
    const last = room.incidentHistory.get(def.id);
    return last === undefined || now - last > def.cooldown * 1000;
  });
  if (candidates.length === 0) return null;
  const picked = room.rng.weighted(candidates, (def) => def.weight);
  if (!picked) return null;
  room.incidentHistory.set(picked.id, now);
  applyIncident(room, picked.id);
  return picked;
}

export function applyIncident(room: Room, id: string): void {
  switch (id) {
    case "vipArrives": {
      spawnGuest(room, "vip");
      break;
    }
    case "stealsCake": {
      const cake = STATIONS.find((s) => s.kind === "cake");
      room.addFeed("🎂 The elephant has taken the cake. There is frosting on the ceiling.", "elephant", "munch");
      room.disruptMeal();
      if (cake) {
        room.spawnSpill(
          (cake.x + 0.5) * 32,
          (cake.y + 1.6) * 32,
          "food",
        );
        room.elephant.x = (cake.x + 0.5) * 32;
        room.elephant.y = (cake.y + 1.8) * 32;
      }
      break;
    }
    case "managerReroute": {
      room.rerouteGuests();
      room.addFeed("🗺 The Manager changed the inspection route. Nobody was consulted.", "warn", "whoosh");
      break;
    }
    case "cartRolls": {
      const cart = STATIONS.find((s) => s.kind === "cart") ?? STATIONS[0];
      const x = (cart.x + 0.5) * 32;
      const y = (cart.y + 0.5) * 32;
      room.addFeed("🧳 A luggage cart is loose in the corridor!", "warn", "crash");
      room.raiseNoise(x, y, 14, 9000);
      room.applyExposure(2.5);
      room.raiseExposureAround(x, y, 1.5);
      break;
    }
    case "powerFlicker": {
      const zone = room.rng.pick(ROOMS.map((entry) => entry.id));
      room.setDark(zone, 20_000);
      room.addFeed(`🔌 The lights went out in the ${room.zoneName(zone)}.`, "warn", "bang");
      break;
    }
    case "elephantNaps": {
      forceElephantState(room, "sleep");
      break;
    }
    case "noisyGuest": {
      const guest = spawnGuest(room, "guest");
      if (guest) {
        room.complaints.push({ guestId: guest.id, x: guest.x, y: guest.y, at: room.now() });
        room.addFeed(
          `😤 ${guest.name} is loudly complaining. Someone should go and be diplomatic.`,
          "warn",
          "ding",
        );
      }
      break;
    }
    case "pipeLeak": {
      const room_2 = room.rng.pick(["laundry", "corridor", "dining"] as ZoneId[]);
      const definition = ROOMS.find((entry) => entry.id === room_2) ?? ROOMS[0];
      room.spawnSpill(
        (definition.x + room.rng.int(1, Math.max(1, definition.w - 1)) + 0.5) * 32,
        (definition.y + room.rng.int(1, Math.max(1, definition.h - 1)) + 0.5) * 32,
        "water",
      );
      room.addFeed(`🚿 A pipe is leaking in the ${room.zoneName(room_2)}.`, "warn", "splash");
      break;
    }
    case "doubleBooked": {
      const guests = room.guests.filter((guest) => !guest.leaving);
      if (guests.length >= 2) {
        const room_2 = room.rng.pick(ROOMS.map((entry) => entry.id));
        const tile = { x: ROOMS.find((entry) => entry.id === room_2)?.x ?? 20, y: 13 };
        guests.slice(0, 2).forEach((guest) => {
          guest.investigate = { x: tile.x * 32, y: tile.y * 32, until: room.now() + 18_000 };
          guest.path = [];
        });
        room.addFeed("📑 Two bookings just landed in the same room. Both guests are looking for it.", "warn", "ding");
      } else {
        room.addFeed("📑 The bookings system double-booked a room. Nobody is around to notice.", "warn");
      }
      break;
    }
    case "doorAjar": {
      const door = room.doors.find((entry) => entry.id.startsWith("door"));
      if (door) {
        door.open = true;
        room.addFeed(`🚪 A guest left the ${room.doorName(door.id)} wide open.`, "warn", "whoosh");
        room.forceDoorOpenUntil(door.id, room.now() + 25_000);
      }
      break;
    }
    case "hungryElephant": {
      room.elephant.hunger = 1;
      forceElephantState(room, "seekFood");
      room.addFeed("🍽 The elephant is extremely hungry now, and unusually direct about it.", "elephant", "munch");
      break;
    }
    case "machineBreak": {
      const machines = STATIONS.filter(
        (s) => s.kind === "washer" || s.kind === "vending" || s.kind === "powerbox",
      );
      const machine = room.rng.pick(machines);
      if (machine) {
        room.breakStation(machine.id, 22_000);
        room.addFeed(`⚙️ Something in the ${room.zoneName(machine.room)} just stopped working.`, "warn", "bang");
      }
      break;
    }
    default:
      break;
  }
}

export function incidentsForClient(): { id: string; name: string; icon: string; blurb: string }[] {
  return INCIDENTS.map((entry) => ({
    id: entry.id,
    name: entry.name,
    icon: entry.icon,
    blurb: entry.blurb,
  }));
}

void INCIDENT_FIRST_AT;
