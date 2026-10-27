"use client";

/**
 * Client state: one hook that owns the socket, folds every server message into a
 * single store, and exposes the few actions the UI needs. Server messages are
 * the only source of truth - the client never simulates anything the server
 * decides (roles, tasks, meters, wins).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ClientMessage,
  FeedEntry,
  InvestigationView,
  LobbyPlayer,
  Phase,
  PlayerResult,
  PuzzleSpec,
  ResultsPayload,
  RoleCard,
  RoomSettings,
  ServerMessage,
  Snapshot,
  TaskInstance,
  Team,
} from "@/game/protocol";
import { sfx } from "./audio";
import {
  clearSession,
  connectGame,
  loadProfile,
  loadSession,
  saveProfile,
  saveSession,
  type Profile,
  type SocketStatus,
} from "./net";

export interface LobbyView {
  code: string;
  hostId: string;
  settings: RoomSettings;
  players: LobbyPlayer[];
  you: string;
}

export interface Toast {
  id: number;
  text: string;
  tone?: string;
}

export interface TaskFeedback {
  taskId: string;
  ok: boolean;
  reason?: string;
  needsPlayers?: number;
  at: number;
}

export interface GameStore {
  status: SocketStatus;
  error: string | null;
  code: string;
  playerId: string;
  host: boolean;
  lobby: LobbyView | null;
  phase: Phase;
  phaseEndsAt: number;
  role: RoleCard | null;
  teammates: { id: string; nickname: string; role: string }[];
  tasks: TaskInstance[];
  puzzle: PuzzleSpec | null;
  snapshot: Snapshot | null;
  feed: FeedEntry[];
  toasts: Toast[];
  feedback: TaskFeedback | null;
  results: ResultsPayload | null;
  investigation: InvestigationView | null;
  suspects: { id: string; nickname: string; avatar: number }[];
  sabotageCooldowns: Record<string, number>;
  sabotageUses: Record<string, number>;
  abilityInfo: { name: string; cooldown: number; uses: number; readyAt: number } | null;
  profile: Profile;
}

export interface GameActions {
  createLobby: (nickname: string, avatar: number) => void;
  joinLobby: (code: string, nickname: string, avatar: number) => void;
  setProfile: (profile: Profile) => void;
  setAvatar: (avatar: number) => void;
  setReady: (ready: boolean) => void;
  patchSettings: (patch: Partial<RoomSettings>) => void;
  start: () => void;
  rematch: () => void;
  sendInput: (mx: number, my: number, seq: number) => void;
  interact: () => void;
  openTask: (stationId: string) => void;
  submitTask: (taskId: string, answer: unknown) => void;
  cancelTask: (taskId: string, partial?: number) => void;
  dismissPuzzle: () => void;
  sabotage: (kind: string, target?: string) => void;
  useAbility: (targetId?: string) => void;
  investigate: () => void;
  vote: (targetId: string | "skip") => void;
  emote: (emote: string) => void;
  leave: () => void;
}

const MAX_TOASTS = 4;
const MAX_FEED = 40;

export function useGame(): { store: GameStore; actions: GameActions } {
  const [status, setStatus] = useState<SocketStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [host, setHost] = useState(false);
  const [lobby, setLobby] = useState<LobbyView | null>(null);
  const [phase, setPhase] = useState<Phase>("lobby");
  const [phaseEndsAt, setPhaseEndsAt] = useState(0);
  const [role, setRole] = useState<RoleCard | null>(null);
  const [teammates, setTeammates] = useState<{ id: string; nickname: string; role: string }[]>([]);
  const [tasks, setTasks] = useState<TaskInstance[]>([]);
  const [puzzle, setPuzzle] = useState<PuzzleSpec | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [feed, setFeed] = useState<FeedEntry[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [feedback, setFeedback] = useState<TaskFeedback | null>(null);
  const [results, setResults] = useState<ResultsPayload | null>(null);
  const [investigation, setInvestigation] = useState<InvestigationView | null>(null);
  const [suspects, setSuspects] = useState<{ id: string; nickname: string; avatar: number }[]>([]);
  const [sabotageCooldowns, setSabotageCooldowns] = useState<Record<string, number>>({});
  const [sabotageUses, setSabotageUses] = useState<Record<string, number>>({});
  const [abilityInfo, setAbilityInfo] = useState<GameStore["abilityInfo"]>(null);
  const [profile, setProfileState] = useState<Profile>({ nickname: "", avatar: 0 });

  const socketRef = useRef<ReturnType<typeof connectGame> | null>(null);
  const joinPayloadRef = useRef<ClientMessage | null>(null);
  const toastId = useRef(1);
  const seenSfx = useRef(new Set<number>());
  const seenFeed = useRef(new Set<number>());
  const lastPhase = useRef<Phase>("lobby");

  useEffect(() => {
    setProfileState(loadProfile());
  }, []);

  const pushToast = useCallback((text: string, tone?: string): void => {
    const id = toastId.current++;
    setToasts((current) => [...current.slice(-(MAX_TOASTS - 1)), { id, text, tone }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 5200);
  }, []);

  const handleMessage = useCallback(
    (message: ServerMessage): void => {
      switch (message.t) {
        case "welcome": {
          setPlayerId(message.playerId);
          setCode(message.code);
          setHost(message.host);
          setError(null);
          saveSession({
            playerId: message.playerId,
            token: message.token,
            code: message.code,
            nickname: profile.nickname,
            avatar: profile.avatar,
          });
          joinPayloadRef.current = {
            t: "join",
            code: message.code,
            nickname: profile.nickname,
            avatar: profile.avatar,
            playerId: message.playerId,
            token: message.token,
          };
          break;
        }
        case "error": {
          setError(message.message);
          if (message.fatal) {
            clearSession();
            setStatus("closed");
          }
          break;
        }
        case "lobby": {
          setLobby({
            code: message.code,
            hostId: message.hostId,
            settings: message.settings,
            players: message.players,
            you: message.you,
          });
          setCode(message.code);
          break;
        }
        case "phase": {
          setPhase(message.phase);
          setPhaseEndsAt(message.endsAt);
          if (message.phase === "playing" && lastPhase.current !== "playing") {
            sfx.play("ding");
          }
          if (message.phase === "lobby") {
            setResults(null);
            setRole(null);
            setTasks([]);
            setPuzzle(null);
          }
          lastPhase.current = message.phase;
          break;
        }
        case "role": {
          setRole(message.card);
          setTeammates(message.teammates);
          sfx.play(message.card.team === "imposters" ? "growl" : "vip");
          break;
        }
        case "tasks":
          setTasks(message.tasks);
          break;
        case "puzzle":
          setPuzzle(message.puzzle);
          sfx.play("click");
          break;
        case "taskResult": {
          setFeedback({
            taskId: message.taskId,
            ok: message.ok,
            reason: message.reason,
            needsPlayers: message.needsPlayers,
            at: Date.now(),
          });
          if (message.ok) {
            setPuzzle((current) => (current && current.taskId === message.taskId ? null : current));
            sfx.play("ding");
          } else {
            sfx.play("bang");
          }
          break;
        }
        case "notice": {
          pushToast(message.text, message.tone);
          break;
        }
        case "ability":
          setAbilityInfo({
            name: message.name,
            cooldown: message.cooldown,
            uses: message.uses,
            readyAt: message.readyAt,
          });
          break;
        case "sabotages":
          setSabotageCooldowns(message.cooldowns);
          setSabotageUses(message.uses);
          break;
        case "investigation": {
          setInvestigation(message.state);
          setSuspects(message.suspects);
          if (message.state.open && !message.state.result) sfx.play("alarm");
          break;
        }
        case "snap": {
          setSnapshot(message.snap);
          setFeed((current) => {
            const merged = [...current];
            for (const entry of message.snap.feed) {
              if (seenFeed.current.has(entry.id)) continue;
              seenFeed.current.add(entry.id);
              merged.push(entry);
              if (entry.sfx && !seenSfx.current.has(entry.id)) {
                seenSfx.current.add(entry.id);
                sfx.play(entry.sfx);
              }
            }
            return merged.slice(-MAX_FEED);
          });
          break;
        }
        case "results": {
          setResults(message.results);
          sfx.play(message.results.winner === "employees" ? "win" : "lose");
          break;
        }
        case "kick": {
          pushToast(message.reason, "bad");
          clearSession();
          break;
        }
        case "pong":
          break;
        default:
          break;
      }
    },
    [profile.avatar, profile.nickname, pushToast],
  );

  const ensureSocket = useCallback((): void => {
    if (socketRef.current) return;
    socketRef.current = connectGame({
      onMessage: handleMessage,
      onStatus: setStatus,
      join: () => joinPayloadRef.current ?? { t: "join", code: code || null, nickname: profile.nickname, avatar: profile.avatar },
    });
  }, [code, handleMessage, profile.avatar, profile.nickname]);

  // reconnect a saved session on first load (refreshing mid-match keeps your role)
  useEffect(() => {
    const session = loadSession();
    if (session) {
      setProfileState((current) => ({
        nickname: current.nickname || session.nickname,
        avatar: current.avatar,
      }));
      joinPayloadRef.current = {
        t: "join",
        code: session.code,
        nickname: session.nickname,
        avatar: session.avatar,
        playerId: session.playerId,
        token: session.token,
      };
    }
    ensureSocket();
    return () => {
      socketRef.current?.close();
      socketRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback(
    (message: ClientMessage): void => {
      ensureSocket();
      socketRef.current?.send(message);
    },
    [ensureSocket],
  );

  const actions = useMemo<GameActions>(
    () => ({
      createLobby: (nickname, avatar) => {
        const clean = nickname.trim().slice(0, 16) || "Guest";
        const nextProfile = { nickname: clean, avatar };
        setProfileState(nextProfile);
        saveProfile(nextProfile);
        sfx.unlock();
        joinPayloadRef.current = { t: "join", code: null, nickname: clean, avatar };
        clearSession();
        send({ t: "join", code: null, nickname: clean, avatar });
      },
      joinLobby: (lobbyCode, nickname, avatar) => {
        const clean = nickname.trim().slice(0, 16) || "Guest";
        const nextProfile = { nickname: clean, avatar };
        setProfileState(nextProfile);
        saveProfile(nextProfile);
        sfx.unlock();
        const upper = lobbyCode.trim().toUpperCase();
        joinPayloadRef.current = { t: "join", code: upper, nickname: clean, avatar };
        clearSession();
        send({ t: "join", code: upper, nickname: clean, avatar });
      },
      setProfile: (next) => {
        setProfileState(next);
        saveProfile(next);
        send({ t: "avatar", avatar: next.avatar });
      },
      setAvatar: (avatar) => {
        const next = { ...profile, avatar };
        setProfileState(next);
        saveProfile(next);
        send({ t: "avatar", avatar });
      },
      setReady: (ready) => send({ t: "ready", ready }),
      patchSettings: (patch) => send({ t: "settings", patch }),
      start: () => send({ t: "start" }),
      rematch: () => send({ t: "rematch" }),
      sendInput: (mx, my, seq) => send({ t: "input", seq, mx, my }),
      interact: () => send({ t: "interact" }),
      openTask: (stationId) => send({ t: "taskOpen", stationId }),
      submitTask: (taskId, answer) => send({ t: "taskSubmit", taskId, answer }),
      cancelTask: (taskId, partial) => send({ t: "taskCancel", taskId, partial }),
      dismissPuzzle: () => setPuzzle(null),
      sabotage: (kind, target) => send({ t: "sabotage", kind: kind as never, target }),
      useAbility: (targetId) => send({ t: "ability", targetId }),
      investigate: () => send({ t: "investigate" }),
      vote: (targetId) => send({ t: "vote", targetId }),
      emote: (emote) => send({ t: "emote", emote }),
      leave: () => {
        clearSession();
        socketRef.current?.close();
        socketRef.current = null;
        setLobby(null);
        setRole(null);
        setSnapshot(null);
        setResults(null);
        setPhase("lobby");
        setStatus("idle");
        ensureSocket();
      },
    }),
    [ensureSocket, profile, send],
  );

  const store: GameStore = {
    status,
    error,
    code,
    playerId,
    host,
    lobby,
    phase,
    phaseEndsAt,
    role,
    teammates,
    tasks,
    puzzle,
    snapshot,
    feed,
    toasts,
    feedback,
    results,
    investigation,
    suspects,
    sabotageCooldowns,
    sabotageUses,
    abilityInfo,
    profile,
  };

  return { store, actions };
}

export function teamLabel(team: Team): string {
  return team === "employees" ? "Hotel Staff" : "Saboteur";
}

export function sortedResults(players: PlayerResult[]): PlayerResult[] {
  return [...players].sort((a, b) => Number(b.wasImposter) - Number(a.wasImposter) || b.tasksDone - a.tasksDone);
}
