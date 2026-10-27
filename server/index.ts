/**
 * Networking: the WebSocket endpoint, room registry and connection lifecycle.
 * The same handler is mounted both by the standalone game server and by the
 * all-in-one Next.js server (see main.ts), so the client always talks to /ws on
 * whatever origin is serving the page.
 */

import { randomUUID } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { MAX_ROOMS, MIN_PLAYERS, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } from "../game/config";
import type { ClientMessage } from "../game/protocol";
import { Room } from "./room";

const MAX_MESSAGE_BYTES = 4096;
const MESSAGES_PER_SECOND = 90;

export class RoomManager {
  readonly rooms = new Map<string, Room>();

  createRoom(): Room {
    let code = "";
    do {
      code = Array.from(
        { length: ROOM_CODE_LENGTH },
        () => ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)],
      ).join("");
    } while (this.rooms.has(code));
    const room = new Room(code);
    if (this.rooms.size >= MAX_ROOMS) {
      // shed the emptiest room rather than refusing service outright
      const victim = [...this.rooms.values()].sort((a, b) => a.connectedCount() - b.connectedCount())[0];
      if (victim) {
        victim.broadcast({ t: "kick", reason: "Server capacity reached. Please start a new lobby." });
        victim.destroy();
        this.rooms.delete(victim.code);
      }
    }
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.trim().toUpperCase());
  }

  findRoomByPlayer(playerId: string, token: string): Room | undefined {
    for (const room of this.rooms.values()) {
      const player = room.findReconnect(playerId, token);
      if (player) return room;
    }
    return undefined;
  }

  sweep(): void {
    for (const [code, room] of this.rooms.entries()) {
      if (room.isIdle()) {
        room.destroy();
        this.rooms.delete(code);
      }
    }
  }

  stats(): { rooms: number; players: number; playing: number } {
    let players = 0;
    let playing = 0;
    for (const room of this.rooms.values()) {
      players += room.connectedCount();
      if (room.phase === "playing") playing += 1;
    }
    return { rooms: this.rooms.size, players, playing };
  }
}

interface PendingSocket {
  socket: WebSocket;
  timer: ReturnType<typeof setTimeout>;
  messages: number;
  windowStart: number;
}

export interface GameServerOptions {
  /** path the client connects to; defaults to /ws */
  path?: string;
}

export function attachGameServer(
  server: HttpServer,
  options: GameServerOptions = {},
): { manager: RoomManager; wss: WebSocketServer } {
  const manager = new RoomManager();
  const path = options.path ?? "/ws";
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
  const pending = new Map<WebSocket, PendingSocket>();
  const bound = new Map<WebSocket, { room: Room; playerId: string }>();

  const sweepTimer = setInterval(() => manager.sweep(), 60_000);
  sweepTimer.unref?.();

  wss.on("connection", (socket: WebSocket) => {
    const rate: PendingSocket = {
      socket,
      timer: setTimeout(() => {
        if (!bound.has(socket)) socket.close(4008, "No join message");
      }, 15_000),
      messages: 0,
      windowStart: Date.now(),
    };
    rate.timer.unref?.();
    pending.set(socket, rate);

    socket.on("message", (raw) => {
      const entry = pending.get(socket);
      const now = Date.now();
      if (entry) {
        if (now - entry.windowStart > 1000) {
          entry.windowStart = now;
          entry.messages = 0;
        }
        entry.messages += 1;
        if (entry.messages > MESSAGES_PER_SECOND) {
          socket.close(4009, "Slow down");
          return;
        }
      }
      let message: ClientMessage;
      try {
        message = JSON.parse(String(raw)) as ClientMessage;
      } catch {
        return;
      }
      if (!message || typeof message !== "object" || typeof message.t !== "string") return;

      if (message.t === "ping") {
        socket.send(JSON.stringify({ t: "pong", ts: message.ts, serverTime: Date.now() }));
        return;
      }

      const existing = bound.get(socket);
      if (existing) {
        const room = manager.rooms.get(existing.room.code);
        const player = room?.players.get(existing.playerId);
        if (!room || !player) {
          socket.close(4004, "Lobby closed");
          return;
        }
        room.handleMessage(player, message, socket.readyState === 1);
        return;
      }

      if (message.t !== "join") {
        socket.send(JSON.stringify({ t: "error", message: "Send a join message first." }));
        return;
      }
      handleJoin(message);
    });

    const handleJoin = (message: Extract<ClientMessage, { t: "join" }>): void => {
      const nickname = (message.nickname || "Guest").toString().slice(0, 16).trim() || "Guest";
      const avatar = Number(message.avatar) || 0;

      // reconnect path: a player id plus its secret token
      if (message.playerId && message.token) {
        const room = message.code ? manager.getRoom(String(message.code)) : undefined;
        const candidate = room ?? manager.findRoomByPlayer(message.playerId, message.token);
        const player = candidate?.findReconnect(message.playerId, message.token);
        if (candidate && player) {
          candidate.attach(player, socket);
          const entry = pending.get(socket);
          if (entry) {
            clearTimeout(entry.timer);
            pending.delete(socket);
          }
          bound.set(socket, { room: candidate, playerId: player.id });
          socket.send(
            JSON.stringify({
              t: "welcome",
              playerId: player.id,
              token: player.token,
              code: candidate.code,
              host: candidate.hostId === player.id,
              resumed: true,
            }),
          );
          candidate.broadcastLobby();
          candidate.send(player, { t: "snap", snap: candidate.snapshotNow() });
          if (candidate.phase !== "lobby") {
            candidate.notify(player, "Reconnected. Your role and jobs are intact.", "good");
          }
          return;
        }
      }

      let room = message.code ? manager.getRoom(String(message.code)) : undefined;
      if (!room) {
        if (message.code && String(message.code).trim().length > 0) {
          socket.send(JSON.stringify({ t: "error", message: "That lobby code does not exist.", fatal: true }));
          return;
        }
        room = manager.createRoom();
      }
      if (room.phase !== "lobby") {
        socket.send(
          JSON.stringify({ t: "error", message: "That match has already started.", fatal: true }),
        );
        return;
      }
      const player = room.addPlayer(nickname, avatar);
      if (!player) {
        socket.send(JSON.stringify({ t: "error", message: "That lobby is full (8 players).", fatal: true }));
        return;
      }
      room.attach(player, socket);
      const entry = pending.get(socket);
      if (entry) {
        clearTimeout(entry.timer);
        pending.delete(socket);
      }
      bound.set(socket, { room, playerId: player.id });
      socket.send(
        JSON.stringify({
          t: "welcome",
          playerId: player.id,
          token: player.token,
          code: room.code,
          host: room.hostId === player.id,
          resumed: false,
        }),
      );
      room.broadcastLobby();
      room.notify(player, `Welcome to ${room.code}. ${MIN_PLAYERS} players minimum to start.`, "good");
    };

    socket.on("close", () => {
      const entry = pending.get(socket);
      if (entry) {
        clearTimeout(entry.timer);
        pending.delete(socket);
      }
      const link = bound.get(socket);
      bound.delete(socket);
      if (!link) return;
      const room = manager.rooms.get(link.room.code);
      const player = room?.players.get(link.playerId);
      if (!room || !player) return;
      if (player.socket === socket) room.markDisconnected(player);
    });

    socket.on("error", () => {
      socket.close();
    });
  });

  server.on("upgrade", (request, socket, head) => {
    let pathname = "/";
    try {
      pathname = new URL(request.url ?? "/", "http://localhost").pathname;
    } catch {
      pathname = "/";
    }
    if (pathname !== path) return; // let Next.js handle its own upgrades (HMR)
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  return { manager, wss };
}

export function newRoomId(): string {
  return randomUUID();
}
