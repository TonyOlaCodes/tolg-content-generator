"use client";

import { useMemo, useState } from "react";
import { EMOTES, ROOMS, SABOTAGES, STATIONS, TASKS } from "@/game/content";
import { MAP_H, MAP_W, TILE } from "@/game/config";
import { roleDef } from "@/game/content";
import type { GameActions, GameStore } from "@/lib/client-state";
import { sfx } from "@/lib/audio";

const ROOM_ORDER = ROOMS;

export default function GameHud({
  store,
  actions,
  nearby,
}: {
  store: GameStore;
  actions: GameActions;
  nearby: string | null;
}) {
  const [panel, setPanel] = useState<"none" | "sabotage" | "role" | "feed">("none");
  const snapshot = store.snapshot;
  const me = snapshot?.players.find((player) => player.id === store.playerId) ?? null;
  const role = store.role ? roleDef(store.role.role) : null;
  const imposter = store.role?.team === "imposters";

  const timeLeft = snapshot?.timeLeft ?? 0;
  const minutes = Math.floor(timeLeft / 60);
  const seconds = Math.floor(timeLeft % 60);

  const taskHints = useMemo(() => {
    if (!me) return [];
    return store.tasks
      .map((task) => {
        const definition = STATIONS.find((entry) => entry.id === task.stationId);
        if (!definition) return null;
        const centerX = (definition.x + definition.w / 2) * 32;
        const centerY = (definition.y + definition.h / 2) * 32;
        const distance = Math.round(Math.hypot(centerX - me.x, centerY - me.y) / 32);
        const info = TASKS.find((entry) => entry.id === task.kind);
        return {
          id: task.id,
          label: task.label,
          station: task.stationName,
          room: definition.room,
          icon: info?.icon ?? "🧰",
          distance,
          fake: task.fake,
          requiresPlayers: task.requiresPlayers,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort((a, b) => a.distance - b.distance);
  }, [me, store.tasks]);

  const now = Date.now();
  const abilityReadyIn = store.abilityInfo ? Math.max(0, Math.ceil((store.abilityInfo.readyAt - now) / 1000)) : 0;
  const sabotageReady = (id: string): number => {
    const readyAt = store.sabotageCooldowns[id] ?? 0;
    return Math.max(0, Math.ceil((readyAt - now) / 1000));
  };

  const nearestSabotageTarget = useMemo(() => {
    if (!me) return null;
    let best: { id: string; distance: number } | null = null;
    for (const definition of STATIONS) {
      if (!definition.sabotageTarget) continue;
      const centerX = (definition.x + definition.w / 2) * 32;
      const centerY = (definition.y + definition.h / 2) * 32;
      const distance = Math.hypot(centerX - me.x, centerY - me.y);
      if (!best || distance < best.distance) best = { id: definition.id, distance };
    }
    return best && best.distance < 3.2 * 32 ? best.id : null;
  }, [me]);

  return (
    <>
      <div className="hud-top">
        <div className="meter-block">
          <div className="meter-head">
            <span>Work progress</span>
            <span>
              {snapshot?.work.done ?? 0}/{snapshot?.work.quota ?? 0}
            </span>
          </div>
          <div className="bar bar-work">
            <span
              style={{
                width: `${Math.min(100, ((snapshot?.work.done ?? 0) / Math.max(1, snapshot?.work.quota ?? 1)) * 100)}%`,
              }}
            />
          </div>
        </div>
        <div className="meter-block">
          <div className="meter-head">
            <span>Elephant exposure</span>
            <span>
              {Math.round(snapshot?.exposure ?? 0)}%
              {(snapshot?.exposureTrend ?? 0) > 0.2 ? " ▲" : (snapshot?.exposureTrend ?? 0) < -0.2 ? " ▼" : ""}
            </span>
          </div>
          <div className="bar bar-exposure">
            <span style={{ width: `${Math.min(100, snapshot?.exposure ?? 0)}%` }} />
          </div>
        </div>
        <div className="hud-clock">
          <span className={timeLeft < 45 ? "is-urgent" : ""}>
            {minutes}:{seconds.toString().padStart(2, "0")}
          </span>
          <p>{snapshot?.elephant.stateLabel ?? "The elephant is somewhere"}</p>
        </div>
      </div>

      <div className="hud-left">
        <div className="panel hud-card">
          <div className="hud-card-head">
            <span className="eyebrow">Your jobs</span>
            <span className="pill">{taskHints.length}</span>
          </div>
          <ul className="objective-list">
            {taskHints.map((task) => (
              <li key={task.id}>
                <span className="objective-icon">{task.icon}</span>
                <span className="objective-text">
                  {task.label}
                  <em>
                    {task.station} · {task.distance} tiles away
                    {task.requiresPlayers > 1 ? " · needs 2 people" : ""}
                    {task.fake ? " · looks legit" : ""}
                  </em>
                </span>
              </li>
            ))}
            {taskHints.length === 0 && store.phase === "playing" ? (
              <li className="muted-line">No jobs assigned yet…</li>
            ) : null}
          </ul>
        </div>

        {store.feed.length > 0 ? (
          <div className="panel hud-card feed-card">
            <span className="eyebrow">Hotel log</span>
            <ul className="feed-list">
              {store.feed.slice(-4).map((entry) => (
                <li key={entry.id} className={`tone-${entry.tone}`}>
                  {entry.text}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div className="hud-right">
        <div className="mini-map">
          {ROOM_ORDER.map((room) => (
            <span
              key={room.id}
              className="map-room"
              style={{
                left: `${(room.x / MAP_W) * 100}%`,
                top: `${(room.y / MAP_H) * 100}%`,
                width: `${(room.w / MAP_W) * 100}%`,
                height: `${(room.h / MAP_H) * 100}%`,
                background: room.floor,
              }}
            />
          ))}
          {snapshot?.players
            .filter((player) => player.connected)
            .map((player) => (
              <span
                key={player.id}
                className={`map-dot ${player.id === store.playerId ? "is-self" : ""}`}
                style={{ left: `${(player.x / (MAP_W * TILE)) * 100}%`, top: `${(player.y / (MAP_H * TILE)) * 100}%` }}
              />
            ))}
          {snapshot?.guests.map((guest) => (
            <span
              key={guest.id}
              className={`map-dot is-guest ${guest.alarmed ? "is-alarmed" : ""}`}
              style={{ left: `${(guest.x / (MAP_W * TILE)) * 100}%`, top: `${(guest.y / (MAP_H * TILE)) * 100}%` }}
            />
          ))}
          {snapshot ? (
            <span
              className="map-dot is-elephant"
              style={{
                left: `${(snapshot.elephant.x / (MAP_W * TILE)) * 100}%`,
                top: `${(snapshot.elephant.y / (MAP_H * TILE)) * 100}%`,
              }}
            />
          ) : null}
        </div>
        <button type="button" className="btn btn-ghost hud-mini" onClick={() => setPanel(panel === "role" ? "none" : "role")}>
          {role?.icon ?? "🧑‍💼"} Role
        </button>
        {store.investigation && !store.investigation.used ? (
          <button
            type="button"
            className="btn btn-ghost hud-mini"
            onClick={() => {
              sfx.play("click");
              actions.investigate();
            }}
          >
            🔍 Investigate
          </button>
        ) : null}
      </div>

      <div className="hud-bottom">
        <div className="emote-bar">
          {EMOTES.map((emote) => (
            <button
              key={emote}
              type="button"
              className="emote-button"
              onClick={() => {
                sfx.play("click");
                actions.emote(emote);
              }}
            >
              {emote}
            </button>
          ))}
        </div>
        <div className="hud-actions">
          {role?.abilityName ? (
            <button
              type="button"
              className="btn btn-ghost action-button"
              disabled={(store.abilityInfo?.uses ?? 0) <= 0 || abilityReadyIn > 0}
              onClick={() => {
                sfx.play("click");
                actions.useAbility();
              }}
            >
              {role.abilityName}
              {store.abilityInfo && store.abilityInfo.uses > 0 ? ` (${store.abilityInfo.uses})` : ""}
              {abilityReadyIn > 0 ? ` · ${abilityReadyIn}s` : ""}
            </button>
          ) : null}
          {imposter ? (
            <button
              type="button"
              className="btn btn-ghost action-button"
              onClick={() => setPanel(panel === "sabotage" ? "none" : "sabotage")}
            >
              😈 Sabotage
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-primary action-button action-use"
            onClick={() => {
              sfx.play("click");
              actions.interact();
            }}
          >
            {nearby ? `Use · ${nearby}` : "Use"}
          </button>
        </div>
      </div>

      {panel === "sabotage" && imposter ? (
        <div className="panel sabotage-panel">
          <div className="hud-card-head">
            <span className="eyebrow">Sabotage tools</span>
            <button type="button" className="btn btn-ghost hud-mini" onClick={() => setPanel("none")}>
              Close
            </button>
          </div>
          <p className="muted-line">
            You must be standing near the thing you are wrecking. Witnesses remember faces.
          </p>
          <div className="sabotage-grid">
            {SABOTAGES.map((sabotage) => {
              const uses = store.sabotageUses[sabotage.id] ?? sabotage.uses;
              const cooldown = sabotageReady(sabotage.id);
              const needsTarget = sabotage.target === "station" || sabotage.target === "door";
              const target =
                sabotage.target === "door"
                  ? "frontDoors"
                  : sabotage.target === "station"
                    ? nearestSabotageTarget ?? undefined
                    : undefined;
              const disabled = uses <= 0 || cooldown > 0 || (needsTarget && !target);
              return (
                <button
                  key={sabotage.id}
                  type="button"
                  className="sabotage-button"
                  disabled={disabled}
                  onClick={() => {
                    sfx.play("click");
                    actions.sabotage(sabotage.id, target);
                    setPanel("none");
                  }}
                >
                  <span className="sabotage-icon">{sabotage.icon}</span>
                  <span className="sabotage-name">{sabotage.name}</span>
                  <span className="sabotage-meta">
                    {uses <= 0 ? "used up" : cooldown > 0 ? `${cooldown}s` : needsTarget && !target ? "get closer" : `${uses} left`}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {panel === "role" && store.role ? (
        <div className="panel role-panel">
          <span className="eyebrow">Your secret role</span>
          <h3>
            {role?.icon} {store.role.name}
          </h3>
          <p>{store.role.blurb}</p>
          <p className="muted-line">{store.role.winCondition}</p>
          {store.role.abilityName ? (
            <p>
              <strong>{store.role.abilityName}:</strong> {store.role.abilityBlurb}
            </p>
          ) : null}
          {store.teammates.length > 0 ? (
            <p>
              <strong>Fellow saboteurs:</strong> {store.teammates.map((mate) => mate.nickname).join(", ")}
            </p>
          ) : null}
          <button type="button" className="btn btn-ghost hud-mini" onClick={() => setPanel("none")}>
            Hide
          </button>
        </div>
      ) : null}
    </>
  );
}
