"use client";

import { useState } from "react";
import { AVATARS, INCIDENTS, MODIFIERS } from "@/game/content";
import { MAX_PLAYERS, MIN_PLAYERS } from "@/game/config";
import type { ModifierId } from "@/game/protocol";
import type { GameActions, GameStore } from "@/lib/client-state";
import { shareUrl } from "@/lib/net";
import { sfx } from "@/lib/audio";

const MATCH_LENGTHS = [180, 300, 360, 480, 600];
const QUOTAS = [6, 9, 12, 18];

export default function Lobby({ store, actions }: { store: GameStore; actions: GameActions }) {
  const [copied, setCopied] = useState(false);
  const lobby = store.lobby;
  if (!lobby) return null;

  const me = lobby.players.find((player) => player.id === lobby.you);
  const isHost = lobby.hostId === lobby.you;
  const connected = lobby.players.filter((player) => player.connected).length;
  const canStart = isHost && connected >= MIN_PLAYERS;

  const copy = async (): Promise<void> => {
    const url = shareUrl(lobby.code);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const toggleModifier = (id: ModifierId): void => {
    const current = lobby.settings.modifiers;
    const next = current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id].slice(-2);
    sfx.play("click");
    actions.patchSettings({ modifiers: next });
  };

  return (
    <div className="lobby-shell">
      <header className="lobby-header panel">
        <div>
          <p className="eyebrow">Lobby code</p>
          <p className="lobby-code">{lobby.code}</p>
        </div>
        <div className="lobby-header-actions">
          <button type="button" className="btn btn-ghost" onClick={copy}>
            {copied ? "Link copied ✓" : "Copy invite link"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => actions.leave()}>
            Leave
          </button>
        </div>
      </header>

      <section className="panel lobby-players">
        <h2>
          In the lobby <span className="muted-line">{connected}/{MAX_PLAYERS}</span>
        </h2>
        <ul className="player-list">
          {lobby.players.map((player) => {
            const avatar = AVATARS[player.avatar % AVATARS.length];
            return (
              <li key={player.id} className={`player-chip ${player.connected ? "" : "is-away"}`}>
                <span className="player-dot" style={{ background: avatar.body, borderColor: avatar.trim }} />
                <span className="player-name">{player.nickname}</span>
                {player.id === lobby.hostId ? <span className="pill">host</span> : null}
                {player.ready ? <span className="pill pill-good">ready</span> : null}
                {!player.connected ? <span className="pill pill-warn">away</span> : null}
              </li>
            );
          })}
          {Array.from({ length: Math.max(0, MIN_PLAYERS - connected) }).map((_, index) => (
            <li key={`empty-${index}`} className="player-chip is-empty">
              <span className="player-dot" style={{ background: "rgba(255,255,255,0.1)" }} />
              <span className="player-name">Waiting for a colleague…</span>
            </li>
          ))}
        </ul>

        <div className="field-row">
          <span>Your uniform</span>
          <div className="avatar-grid">
            {AVATARS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-label={entry.name}
                title={entry.name}
                className={`avatar-swatch ${me?.avatar === entry.id ? "is-active" : ""}`}
                style={{ background: entry.body, borderColor: entry.trim }}
                onClick={() => {
                  actions.setAvatar(entry.id);
                  sfx.play("click");
                }}
              />
            ))}
          </div>
        </div>

        <div className="lobby-cta">
          <button
            type="button"
            className={`btn ${me?.ready ? "btn-ghost" : "btn-primary"}`}
            onClick={() => {
              sfx.play("click");
              actions.setReady(!me?.ready);
            }}
          >
            {me?.ready ? "Not ready" : "I am ready"}
          </button>
          <button
            type="button"
            className="btn btn-primary btn-large"
            disabled={!canStart}
            onClick={() => {
              sfx.play("ding");
              actions.start();
            }}
          >
            {isHost ? "Start the shift 🛎" : "Waiting for the host…"}
          </button>
        </div>
        {!canStart ? (
          <p className="muted-line">
            {isHost
              ? `You need at least ${MIN_PLAYERS} players. Share the code ${lobby.code} or the invite link.`
              : "The host starts the shift once three or more players are in."}
          </p>
        ) : null}
      </section>

      <section className="panel lobby-settings">
        <h2>Host settings</h2>
        {!isHost ? <p className="muted-line">Only the host can change these. Shout at them.</p> : null}
        <div className="settings-grid">
          <label className="field-row">
            <span>Shift length</span>
            <select
              className="field"
              disabled={!isHost}
              value={lobby.settings.matchSeconds}
              onChange={(event) => actions.patchSettings({ matchSeconds: Number(event.target.value) })}
            >
              {MATCH_LENGTHS.map((seconds) => (
                <option key={seconds} value={seconds}>
                  {Math.round(seconds / 60)} minutes
                </option>
              ))}
            </select>
          </label>
          <label className="field-row">
            <span>Work per player</span>
            <select
              className="field"
              disabled={!isHost}
              value={lobby.settings.workQuotaPerPlayer}
              onChange={(event) => actions.patchSettings({ workQuotaPerPlayer: Number(event.target.value) })}
            >
              {QUOTAS.map((quota) => (
                <option key={quota} value={quota}>
                  {quota} jobs
                </option>
              ))}
            </select>
          </label>
          <label className="field-row">
            <span>Elephant energy</span>
            <select
              className="field"
              disabled={!isHost}
              value={lobby.settings.elephantAggression}
              onChange={(event) =>
                actions.patchSettings({
                  elephantAggression: Number(event.target.value) as 1 | 2 | 3,
                })
              }
            >
              <option value={1}>Relaxed</option>
              <option value={2}>Standard</option>
              <option value={3}>Chaos</option>
            </select>
          </label>
          <label className="field-row">
            <span>Random incidents</span>
            <select
              className="field"
              disabled={!isHost}
              value={lobby.settings.incidentsEnabled ? "on" : "off"}
              onChange={(event) => actions.patchSettings({ incidentsEnabled: event.target.value === "on" })}
            >
              <option value="on">On ({INCIDENTS.length} possible)</option>
              <option value="off">Off (quiet night)</option>
            </select>
          </label>
        </div>

        <p className="eyebrow">Round modifiers — pick up to two</p>
        <div className="modifier-grid">
          {MODIFIERS.map((modifier) => {
            const active = lobby.settings.modifiers.includes(modifier.id);
            return (
              <button
                key={modifier.id}
                type="button"
                disabled={!isHost}
                className={`modifier ${active ? "is-active" : ""}`}
                onClick={() => toggleModifier(modifier.id)}
              >
                <span className="modifier-icon">{modifier.icon}</span>
                <span className="modifier-name">{modifier.name}</span>
                <span className="modifier-blurb">{modifier.blurb}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
