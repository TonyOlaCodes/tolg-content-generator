"use client";

import { useState } from "react";
import { AVATARS, roleDef } from "@/game/content";
import type { GameActions, GameStore } from "@/lib/client-state";
import { sfx } from "@/lib/audio";

export function RoleReveal({ store }: { store: GameStore }) {
  const [hidden, setHidden] = useState(false);
  if (!store.role || store.phase !== "reveal" || hidden) return null;
  const def = roleDef(store.role.role);
  const imposter = store.role.team === "imposters";
  return (
    <div className="overlay role-overlay">
      <div className={`panel role-card ${imposter ? "is-imposter" : "is-staff"}`}>
        <p className="eyebrow">{imposter ? "You are working against the hotel" : "You are hotel staff"}</p>
        <div className="role-icon">{def.icon}</div>
        <h2>{store.role.name}</h2>
        <p className="role-blurb">{store.role.blurb}</p>
        <p className="role-win">
          <strong>Your win condition:</strong> {store.role.winCondition}
        </p>
        {store.role.abilityName ? (
          <p className="role-ability">
            <strong>
              {store.role.abilityName}
              {store.role.abilityUses > 0 ? ` · ${store.role.abilityUses} use` : ""}:
            </strong>{" "}
            {store.role.abilityBlurb}
          </p>
        ) : null}
        {store.teammates.length > 0 ? (
          <div className="role-teammates">
            <p className="eyebrow">Your fellow saboteurs</p>
            {store.teammates.map((mate) => (
              <span key={mate.id} className="pill pill-bad">
                {mate.nickname}
              </span>
            ))}
          </div>
        ) : null}
        <button type="button" className="btn btn-primary btn-large" onClick={() => setHidden(true)}>
          Got it — hide this card
        </button>
        <p className="muted-line">Nobody else can see this. The shift starts in a few seconds.</p>
      </div>
    </div>
  );
}

export function Investigation({
  store,
  actions,
}: {
  store: GameStore;
  actions: GameActions;
}) {
  const investigation = store.investigation;
  if (!investigation || store.phase !== "playing") return null;
  const myVote = investigation.votes.find((vote) => vote.from === store.playerId);
  if (!investigation.open && !investigation.result) return null;
  const secondsLeft = Math.max(0, Math.round((investigation.endsAt - Date.now()) / 1000));
  return (
    <div className="overlay investigation-overlay">
      <div className="panel investigation">
        <p className="eyebrow">Staff investigation</p>
        <h2>{investigation.open ? "Who is sabotaging the shift?" : "Verdict"}</h2>
        {investigation.open ? (
          <>
            <p className="muted-line">
              Called by {store.lobby?.players.find((player) => player.id === investigation.openedBy)?.nickname ?? "a colleague"} ·
              closes in {secondsLeft}s
            </p>
            <div className="suspect-grid">
              {store.suspects.map((suspect) => {
                const avatar = AVATARS[suspect.avatar % AVATARS.length];
                const votes = investigation.votes.filter((vote) => vote.target === suspect.id).length;
                return (
                  <button
                    key={suspect.id}
                    type="button"
                    className={`suspect ${myVote?.target === suspect.id ? "is-mine" : ""}`}
                    onClick={() => {
                      sfx.play("click");
                      actions.vote(suspect.id);
                    }}
                  >
                    <span className="player-dot" style={{ background: avatar.body, borderColor: avatar.trim }} />
                    <span>{suspect.nickname}</span>
                    <span className="pill">{votes} vote{votes === 1 ? "" : "s"}</span>
                  </button>
                );
              })}
              <button
                type="button"
                className={`suspect ${myVote?.target === "skip" ? "is-mine" : ""}`}
                onClick={() => {
                  sfx.play("click");
                  actions.vote("skip");
                }}
              >
                <span className="player-dot" style={{ background: "rgba(255,255,255,0.15)" }} />
                <span>Nobody — keep working</span>
                <span className="pill">
                  {investigation.votes.filter((vote) => vote.target === "skip").length} vote(s)
                </span>
              </button>
            </div>
          </>
        ) : (
          <p className="verdict">{investigation.result}</p>
        )}
      </div>
    </div>
  );
}

export function Results({ store, actions }: { store: GameStore; actions: GameActions }) {
  if (!store.results || store.phase !== "results") return null;
  const results = store.results;
  const staffWon = results.winner === "employees";
  const me = results.players.find((player) => player.id === store.playerId);
  const iWon = me ? me.team === results.winner : false;
  return (
    <div className="overlay results-overlay">
      <div className="panel results">
        <p className="eyebrow">{iWon ? "You win" : "You lose"}</p>
        <h2 className={staffWon ? "win-staff" : "win-imposter"}>
          {staffWon ? "🏆 Hotel staff save the day" : "🐘 The elephant wins"}
        </h2>
        <p className="muted-line">{results.reason}</p>
        <div className="result-stats">
          <div>
            <p className="eyebrow">Work done</p>
            <p className="stat-value">
              {results.work.done}/{results.work.quota}
            </p>
          </div>
          <div>
            <p className="eyebrow">Exposure</p>
            <p className="stat-value">{results.exposure}%</p>
          </div>
          <div>
            <p className="eyebrow">Elephant at the end</p>
            <p className="stat-value small">{results.elephantStage}</p>
          </div>
          {results.mvp ? (
            <div>
              <p className="eyebrow">MVP</p>
              <p className="stat-value small">{results.mvp}</p>
            </div>
          ) : null}
        </div>

        <div className="result-table">
          {results.players.map((player) => {
            const avatar = AVATARS[player.avatar % AVATARS.length];
            return (
              <div key={player.id} className={`result-row ${player.wasImposter ? "is-imposter" : ""}`}>
                <span className="player-dot" style={{ background: avatar.body, borderColor: avatar.trim }} />
                <span className="result-name">{player.nickname}</span>
                <span className="pill">{player.roleName}</span>
                <span className="result-numbers">
                  {player.tasksDone} jobs · {player.sabotages} sabotages · spotted {player.playerSpotted}×
                </span>
              </div>
            );
          })}
        </div>

        {results.incidents.length > 0 ? (
          <div className="result-incidents">
            <p className="eyebrow">What actually happened</p>
            <ul>
              {results.incidents.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <button
          type="button"
          className="btn btn-primary btn-large"
          disabled={!store.host}
          onClick={() => {
            sfx.play("ding");
            actions.rematch();
          }}
        >
          {store.host ? "Play again" : "Waiting for the host to restart"}
        </button>
      </div>
    </div>
  );
}

export function PauseBanner({ store }: { store: GameStore }) {
  if (!store.snapshot?.paused) return null;
  return (
    <div className="pause-banner">
      ⏸ Paused — waiting for players to reconnect. The shift resumes automatically.
    </div>
  );
}

export function RotateHint() {
  return (
    <div className="rotate-hint">
      <div className="rotate-icon">📱</div>
      <p>Turn your phone sideways — the hotel is wider than it is tall.</p>
    </div>
  );
}

export function Toasts({ store }: { store: GameStore }) {
  return (
    <div className="toast-stack">
      {store.toasts.map((toast) => (
        <div key={toast.id} className={`toast tone-${toast.tone ?? "info"}`}>
          {toast.text}
        </div>
      ))}
    </div>
  );
}
