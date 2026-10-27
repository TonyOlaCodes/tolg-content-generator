"use client";

import { useEffect, useMemo, useState } from "react";
import { AVATARS, EMOTES, MODIFIERS, ROLES, SABOTAGES, TASKS } from "@/game/content";
import type { GameActions, GameStore } from "@/lib/client-state";
import { randomNickname } from "@/lib/net";
import { sfx } from "@/lib/audio";

export default function Menu({
  store,
  actions,
  initialCode,
}: {
  store: GameStore;
  actions: GameActions;
  initialCode?: string;
}) {
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState(0);
  const [code, setCode] = useState(initialCode ?? "");
  const [tab, setTab] = useState<"create" | "join">(initialCode ? "join" : "create");
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    setNickname(store.profile.nickname || randomNickname());
    setAvatar(store.profile.avatar ?? 0);
  }, [store.profile.avatar, store.profile.nickname]);

  const trimmed = nickname.trim();
  const canGo = trimmed.length >= 2 && (tab === "create" || code.trim().length >= 4);

  const start = (): void => {
    sfx.unlock();
    if (!canGo) return;
    if (tab === "create") actions.createLobby(trimmed, avatar);
    else actions.joinLobby(code, trimmed, avatar);
  };

  const avatars = useMemo(() => AVATARS, []);

  return (
    <div className="menu-shell">
      <div className="menu-title">
        <div className="menu-elephant" aria-hidden>
          <span className="menu-elephant-trunk" />
        </div>
        <h1>
          Elephant
          <span> in the Room</span>
        </h1>
        <p className="tagline">
          Everyone has a job. Someone is sabotaging it. Nobody talks about the elephant.
        </p>
      </div>

      <div className="menu-grid">
        <section className="panel menu-card">
          <div className="menu-tabs">
            <button
              type="button"
              className={`menu-tab ${tab === "create" ? "is-active" : ""}`}
              onClick={() => setTab("create")}
            >
              Create lobby
            </button>
            <button
              type="button"
              className={`menu-tab ${tab === "join" ? "is-active" : ""}`}
              onClick={() => setTab("join")}
            >
              Join with code
            </button>
          </div>

          <label className="field-row">
            <span>Your name</span>
            <input
              className="field"
              value={nickname}
              maxLength={16}
              placeholder="Front Desk Legend"
              onChange={(event) => setNickname(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") start();
              }}
            />
          </label>

          <div className="field-row">
            <span>Uniform colour</span>
            <div className="avatar-grid">
              {avatars.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  aria-label={entry.name}
                  title={entry.name}
                  className={`avatar-swatch ${avatar === entry.id ? "is-active" : ""}`}
                  style={{ background: entry.body, borderColor: entry.trim }}
                  onClick={() => {
                    setAvatar(entry.id);
                    sfx.play("click");
                  }}
                />
              ))}
            </div>
          </div>

          {tab === "join" ? (
            <label className="field-row">
              <span>Lobby code</span>
              <input
                className="field code-field"
                value={code}
                maxLength={6}
                placeholder="ABC123"
                onChange={(event) => setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") start();
                }}
              />
            </label>
          ) : null}

          <button type="button" className="btn btn-primary btn-large" disabled={!canGo} onClick={start}>
            {tab === "create" ? "Open the hotel 🐘" : "Clock in 🕒"}
          </button>

          {store.error ? <p className="error-line">{store.error}</p> : null}
          {store.status === "reconnecting" ? (
            <p className="muted-line">Reconnecting to the hotel…</p>
          ) : null}

          <button type="button" className="btn btn-ghost" onClick={() => setShowRules((value) => !value)}>
            {showRules ? "Hide rules" : "How do you play?"}
          </button>
        </section>

        <section className="panel menu-card menu-info">
          <h2>3–8 players · 6 minutes · one elephant</h2>
          <ul className="rule-list">
            <li>
              <strong>Staff</strong> fill the Work Progress meter by finishing real jobs around the hotel.
            </li>
            <li>
              <strong>Saboteurs</strong> hide among you with fake jobs and seven sabotage tools. They win if
              guests fully notice the elephant, or if the shift just runs out.
            </li>
            <li>
              <strong>Guests</strong> walk an inspection route. If one sees the elephant, exposure climbs and
              the elephant grows.
            </li>
            <li>
              Close doors, stand in the way, calm it or lure it with food — the elephant is hard to hide, but
              never impossible.
            </li>
          </ul>
          <div className="menu-family">
            {["🛏 Make the bed", "🧽 Clean the spill", "🧺 Sort laundry", "🧳 Deliver luggage"].map((label) => (
              <span key={label} className="pill">
                {label}
              </span>
            ))}
            <span className="pill">+ {TASKS.length - 4} more jobs</span>
          </div>
          <div className="menu-family">
            {EMOTES.slice(0, 6).map((emote) => (
              <span key={emote} className="pill emote-pill">
                {emote}
              </span>
            ))}
          </div>
        </section>
      </div>

      {showRules ? (
        <section className="panel rules-panel">
          <h2>The full briefing</h2>
          <div className="rules-columns">
            <div>
              <h3>Roles on staff</h3>
              <ul className="rule-list">
                {ROLES.filter((role) => role.team === "employees").map((role) => (
                  <li key={role.id}>
                    <strong>
                      {role.icon} {role.name}
                    </strong>{" "}
                    — {role.blurb}
                    {role.abilityName ? <em> Ability: {role.abilityName}.</em> : null}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Sabotage tools</h3>
              <ul className="rule-list">
                {SABOTAGES.map((sabotage) => (
                  <li key={sabotage.id}>
                    <strong>
                      {sabotage.icon} {sabotage.name}
                    </strong>{" "}
                    — {sabotage.blurb}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Round modifiers (host picks up to two)</h3>
              <ul className="rule-list">
                {MODIFIERS.map((modifier) => (
                  <li key={modifier.id}>
                    <strong>
                      {modifier.icon} {modifier.name}
                    </strong>{" "}
                    — {modifier.blurb}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3>Controls</h3>
              <ul className="rule-list">
                <li>
                  <strong>Phone</strong> — hold the left half of the screen to steer, tap <em>Use</em> to
                  interact, play in landscape.
                </li>
                <li>
                  <strong>Desktop</strong> — WASD or arrow keys to move, <em>E</em> or <em>space</em> to
                  interact, <em>Q</em> for your ability.
                </li>
                <li>Tasks open their own little minigame - finish it and the work meter moves.</li>
              </ul>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
