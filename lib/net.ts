"use client";

/**
 * Socket plumbing: URL resolution, session persistence and a reconnecting
 * WebSocket wrapper. Same-origin by default (dev, Docker, anything serving both
 * halves); set NEXT_PUBLIC_GAME_SERVER_URL when the game server lives elsewhere.
 */

import type { ClientMessage, ServerMessage } from "@/game/protocol";

export interface Session {
  playerId: string;
  token: string;
  code: string;
  nickname: string;
  avatar: number;
}

export interface Profile {
  nickname: string;
  avatar: number;
}

const SESSION_KEY = "eitr.session.v1";
const PROFILE_KEY = "eitr.profile.v1";

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode: session simply will not survive a refresh */
  }
}

export function loadSession(): Session | null {
  return readJson<Session>(SESSION_KEY);
}

export function saveSession(session: Session): void {
  writeJson(SESSION_KEY, session);
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function loadProfile(): Profile {
  return readJson<Profile>(PROFILE_KEY) ?? { nickname: "", avatar: 0 };
}

export function saveProfile(profile: Profile): void {
  writeJson(PROFILE_KEY, profile);
}

export function randomNickname(): string {
  const names = [
    "Guest Whisperer",
    "Trolley Pilot",
    "Night Porter",
    "Cake Guard",
    "Certified Mop",
    "Bellhop #7",
    "Luggage Wrangler",
    "Linen Manager",
  ];
  const name = names[Math.floor(Math.random() * names.length)];
  return `${name} ${Math.floor(Math.random() * 90 + 10)}`;
}

export function gameSocketUrl(): string {
  const configured = process.env.NEXT_PUBLIC_GAME_SERVER_URL?.trim();
  if (configured) {
    const withProtocol = configured.replace(/^http/i, (match) =>
      match.toLowerCase() === "https" ? "wss" : "ws",
    );
    const trimmed = withProtocol.replace(/\/+$/, "");
    return trimmed.endsWith("/ws") ? trimmed : `${trimmed}/ws`;
  }
  if (typeof window === "undefined") return "";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}

export function shareUrl(code: string): string {
  if (typeof window === "undefined") return `/join/${code}`;
  return `${window.location.origin}/join/${code}`;
}

export type SocketStatus = "idle" | "connecting" | "open" | "reconnecting" | "closed";

export interface SocketHandle {
  send: (message: ClientMessage) => void;
  close: () => void;
  status: () => SocketStatus;
}

export function connectGame(options: {
  onMessage: (message: ServerMessage) => void;
  onStatus: (status: SocketStatus) => void;
  /** fresh join payload for every attempt (reconnects include the saved session) */
  join: () => ClientMessage;
  maxAttempts?: number;
}): SocketHandle {
  let socket: WebSocket | null = null;
  let attempt = 0;
  let closed = false;
  let pingTimer: ReturnType<typeof setInterval> | null = null;
  let status: SocketStatus = "idle";
  const maxAttempts = options.maxAttempts ?? 8;

  const setStatus = (next: SocketStatus): void => {
    status = next;
    options.onStatus(next);
  };

  const open = (): void => {
    if (closed) return;
    const url = gameSocketUrl();
    if (!url) {
      setStatus("closed");
      return;
    }
    setStatus(attempt === 0 ? "connecting" : "reconnecting");
    try {
      socket = new WebSocket(url);
    } catch {
      scheduleRetry();
      return;
    }
    socket.onopen = () => {
      attempt = 0;
      setStatus("open");
      socket?.send(JSON.stringify(options.join()));
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ t: "ping", ts: Date.now() } satisfies ClientMessage));
        }
      }, 15_000);
    };
    socket.onmessage = (event: MessageEvent<string>) => {
      let parsed: ServerMessage;
      try {
        parsed = JSON.parse(event.data) as ServerMessage;
      } catch {
        return;
      }
      options.onMessage(parsed);
    };
    socket.onclose = () => {
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = null;
      socket = null;
      if (closed) {
        setStatus("closed");
        return;
      }
      scheduleRetry();
    };
    socket.onerror = () => {
      socket?.close();
    };
  };

  const scheduleRetry = (): void => {
    if (closed) return;
    attempt += 1;
    if (attempt > maxAttempts) {
      setStatus("closed");
      return;
    }
    setStatus("reconnecting");
    const delay = Math.min(1200 * attempt, 6000);
    setTimeout(() => open(), delay);
  };

  open();

  return {
    send: (message: ClientMessage) => {
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
    },
    close: () => {
      closed = true;
      if (pingTimer) clearInterval(pingTimer);
      socket?.close();
    },
    status: () => status,
  };
}
