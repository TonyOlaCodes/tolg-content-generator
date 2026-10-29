"use client";

import { EXHIBITS } from "@/lib/museum/exhibits";
import { ARTIFACTS, getArtifact } from "@/lib/museum/artifacts";
import { useMuseum } from "@/lib/museum/store";

export default function Hud({ onBackApps }: { onBackApps: () => void }) {
  const s = useMuseum();
  if (s.photoMode) {
    return (
      <div className="im-hud">
        <p className="im-photo-hint">Photo mode · Esc or chip to exit · capture with your device</p>
        <div className="im-topbar">
          <span />
          <button type="button" className="im-chip on" onClick={() => s.togglePhotoMode()}>
            Exit photo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="im-hud">
      <div className="im-topbar">
        <div>
          <div className="im-brand">Impossible Museum</div>
          <div style={{ fontSize: "0.65rem", color: "var(--im-muted)", marginTop: 2 }}>
            seed {s.seed} · {s.artifacts.length}/{ARTIFACTS.length} artifacts
          </div>
        </div>
        <div className="im-top-actions">
          <button type="button" className="im-chip" onClick={onBackApps}>
            Apps
          </button>
          <button type="button" className={`im-chip ${s.muted ? "" : "on"}`} onClick={() => s.setMuted(!s.muted)}>
            {s.muted ? "Muted" : "Audio"}
          </button>
          <button type="button" className="im-chip" onClick={() => s.togglePhotoMode()}>
            Photo
          </button>
          <button type="button" className="im-chip" onClick={() => s.toggleDirectory()}>
            Directory
          </button>
          <button type="button" className="im-chip" onClick={() => s.toggleInventory()}>
            Relics
          </button>
          <button type="button" className="im-chip" onClick={() => s.toggleJournal()}>
            Journal
          </button>
        </div>
      </div>

      {s.curatorMessage ? (
        <div className="im-curator" role="status">
          <strong>The Archivist</strong>
          {s.curatorMessage}
          <div style={{ marginTop: "0.55rem" }}>
            <button type="button" className="im-chip" onClick={() => s.setCuratorMessage(null)}>
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <div className="im-bottombar">
        {s.phase === "exhibit" ? (
          <button type="button" className="im-btn" onClick={() => s.returnAtrium()}>
            ← Atrium
          </button>
        ) : (
          <button type="button" className="im-btn primary" onClick={() => s.toggleDirectory()}>
            Floor directory
          </button>
        )}
        <label className="im-slider" style={{ color: "var(--im-ink)" }}>
          Vol
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(s.volume * 100)}
            onChange={(e) => s.setVolume(Number(e.target.value) / 100)}
          />
        </label>
        <select
          className="im-chip"
          value={s.quality}
          onChange={(e) => s.setQuality(e.target.value as typeof s.quality)}
          aria-label="Graphics quality"
        >
          <option value="auto">Auto</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      {s.directoryOpen ? (
        <div className="im-panel" role="dialog" aria-label="Floor directory">
          <h3>Floor directory</h3>
          <div className="im-dir-list">
            {EXHIBITS.map((ex) => {
              const locked = ex.id === "forbidden" && !s.canEnterForbidden();
              const has = s.artifacts.includes(ex.artifactId);
              return (
                <button
                  key={ex.id}
                  type="button"
                  className="im-dir-item"
                  disabled={locked}
                  onClick={() => s.enterExhibit(ex.id)}
                  style={{ borderColor: `${ex.accent}55` }}
                >
                  <strong>
                    {String(ex.number).padStart(2, "0")} · {ex.name}
                    {has ? " ✓" : ""}
                  </strong>
                  <span>{locked ? "Sealed — gather truths" : ex.subtitle}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {s.inventoryOpen ? (
        <div className="im-panel" role="dialog" aria-label="Artifact relics">
          <h3>Relic inventory</h3>
          <div className="im-inv-list">
            {ARTIFACTS.map((a) => {
              const owned = s.artifacts.includes(a.id);
              return (
                <div key={a.id} className="im-inv-item" style={{ opacity: owned ? 1 : 0.4 }}>
                  <strong>{owned ? a.name : "????"}</strong>
                  <span>{owned ? a.description : a.hint}</span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {s.journalOpen ? (
        <div className="im-panel" role="dialog" aria-label="Discovery journal">
          <h3>Discovery journal</h3>
          <div className="im-journal-list">
            {s.journal.length === 0 ? (
              <p style={{ color: "var(--im-muted)", fontSize: "0.85rem" }}>
                The pages are blank until you touch something impossible.
              </p>
            ) : (
              [...s.journal].reverse().map((j) => (
                <div key={`${j.id}-${j.at}`} className="im-journal-item">
                  <strong>{j.title}</strong>
                  <p>{j.body}</p>
                </div>
              ))
            )}
          </div>
          <p style={{ marginTop: "0.75rem", fontSize: "0.7rem", color: "var(--im-muted)" }}>
            Achievements: {s.achievements.length} · Clues: {s.clues.length}
          </p>
          <button type="button" className="im-btn ghost" style={{ marginTop: "0.5rem" }} onClick={() => s.softReset()}>
            New visitation (keeps audio prefs)
          </button>
        </div>
      ) : null}

      {/* touch unused getArtifact for tree-shaking calm */}
      <span className="sr-only">{getArtifact("ember_core")?.name}</span>
    </div>
  );
}
