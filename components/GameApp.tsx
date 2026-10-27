"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import GameCanvas from "./GameCanvas";
import GameHud from "./GameHud";
import Lobby from "./Lobby";
import Menu from "./Menu";
import Minigame from "./Minigames";
import { Investigation, PauseBanner, Results, RoleReveal, RotateHint, Toasts } from "./Overlays";
import { useGame } from "@/lib/client-state";
import { sfx } from "@/lib/audio";

export default function GameApp({ initialCode }: { initialCode?: string }) {
  const { store, actions } = useGame();
  const [nearby, setNearby] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [landscape, setLandscape] = useState(true);
  const autoJoined = useRef(false);

  useEffect(() => {
    setMuted(sfx.muted);
  }, []);

  useEffect(() => {
    const check = (): void => setLandscape(window.innerWidth >= window.innerHeight);
    check();
    window.addEventListener("resize", check);
    window.addEventListener("orientationchange", check);
    return () => {
      window.removeEventListener("resize", check);
      window.removeEventListener("orientationchange", check);
    };
  }, []);

  // a shared /join/CODE link drops you straight in, if we already know your name
  useEffect(() => {
    if (!initialCode || autoJoined.current) return;
    if (store.lobby || store.status === "connecting") return;
    const nickname = store.profile.nickname;
    if (!nickname) return;
    autoJoined.current = true;
    actions.joinLobby(initialCode, nickname, store.profile.avatar ?? 0);
  }, [actions, initialCode, store.lobby, store.profile.avatar, store.profile.nickname, store.status]);

  const handleNearby = useCallback((label: string | null) => setNearby(label), []);

  const inMatch = store.phase === "reveal" || store.phase === "playing" || store.phase === "results";
  const showGame = Boolean(store.lobby) && inMatch;
  const showLobby = Boolean(store.lobby) && !inMatch;
  const isPortrait = !landscape && showGame;

  return (
    <main className={`app-shell ${showGame ? "is-game" : ""}`}>
      {isPortrait ? <RotateHint /> : null}

      {!store.lobby ? (
        <Menu store={store} actions={actions} initialCode={initialCode} />
      ) : showLobby ? (
        <Lobby store={store} actions={actions} />
      ) : (
        <div className="game-shell">
          <GameCanvas store={store} actions={actions} onNearbyChange={handleNearby} />
          <GameHud store={store} actions={actions} nearby={nearby} />
          <button
            type="button"
            className="sound-toggle"
            onClick={() => {
              const next = !muted;
              setMuted(next);
              sfx.setMuted(next);
              if (!next) sfx.play("click");
            }}
          >
            {muted ? "🔇" : "🔊"}
          </button>
          <button type="button" className="leave-button" onClick={() => actions.leave()}>
            Leave hotel
          </button>
        </div>
      )}

      <RoleReveal store={store} />
      {store.puzzle && store.phase === "playing" ? (
        <Minigame
          puzzle={store.puzzle}
          feedback={store.feedback}
          onSubmit={(taskId, answer) => actions.submitTask(taskId, answer)}
          onCancel={(taskId) => {
            actions.cancelTask(taskId);
            actions.dismissPuzzle();
          }}
        />
      ) : null}
      <Investigation store={store} actions={actions} />
      <Results store={store} actions={actions} />
      <PauseBanner store={store} />
      <Toasts store={store} />

      {store.error && store.lobby ? <div className="error-banner">{store.error}</div> : null}
    </main>
  );
}
