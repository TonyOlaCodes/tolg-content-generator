"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { sampleFrame, SET_DURATION, type LiveFrame } from "@/lib/pullup-sim";
import PullUpCanvas from "./PullUpCanvas";
import ShoulderGraph from "./ShoulderGraph";
import SetSummary from "./SetSummary";

function formatClock(sec: number): string {
  const s = Math.min(Math.max(0, sec), SET_DURATION);
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function phaseClass(phase: LiveFrame["phase"]): string {
  if (phase === "PULL") return "is-pull";
  if (phase === "LOWER") return "is-lower";
  if (phase === "HANDS ON BAR") return "is-hands";
  return "is-hang";
}

export default function PullUpApp({ onBack }: { onBack: () => void }) {
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [t, setT] = useState(0);
  const lastRef = useRef<number | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = (now: number): void => {
      if (lastRef.current == null) lastRef.current = now;
      const dt = (now - lastRef.current) / 1000;
      lastRef.current = now;
      if (playing) {
        setT((prev) => {
          const next = prev + dt * speed;
          if (next >= SET_DURATION + 1.2) return SET_DURATION + 1.2;
          return next;
        });
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed]);

  const frame = useMemo(() => sampleFrame(t), [t]);

  const replay = (): void => {
    lastRef.current = null;
    setT(0);
    setPlaying(true);
  };

  const fatigueHot = frame.fatiguePct >= 20;

  return (
    <div className="pullup-shell">
      <div className="pullup-stage">
        <PullUpCanvas frame={frame} />

        {/* Top chrome */}
        <header className="pullup-topbar">
          <button type="button" className="pullup-back" onClick={onBack} aria-label="Back to apps">
            ←
          </button>
          <div className="pullup-user">
            <span className="pullup-avatar" aria-hidden />
            <span className="pullup-username">_tonyola</span>
            <span className="pullup-ago">3w ago</span>
          </div>
          <span className="pullup-cam" aria-hidden>
            ⌂
          </span>
        </header>

        {/* Left live metrics */}
        {!frame.showSummary ? (
          <div className="pullup-left">
            <div className="pullup-reps-card">
              <div className="pullup-reps-num">{frame.reps}</div>
              <div className="pullup-reps-label">REPS</div>
            </div>
            <div className={`pullup-phase ${phaseClass(frame.phase)}`}>{frame.phase}</div>
            <div className="pullup-metrics">
              <div>
                <span>ELBOW</span>
                <strong>{frame.elbow}°</strong>
              </div>
              <div>
                <span>SPEED</span>
                <strong>{frame.speed.toFixed(2)} m/s</strong>
              </div>
              <div>
                <span>ENERGY (rough)</span>
                <strong>{frame.energyKcal.toFixed(1)} kcal</strong>
              </div>
              <div>
                <span>FATIGUE (speed loss)</span>
                <strong className={fatigueHot ? "is-warn" : ""}>{frame.fatiguePct} %</strong>
              </div>
            </div>

            {frame.currentRepDetail ? (
              <div className="pullup-rep-detail">
                <div className="pullup-rep-detail-head">
                  <strong>REP {Math.max(1, frame.reps || 1)}</strong>
                  {frame.currentRepDetail.lockOut ? (
                    <span className="pullup-lockout">FULL LOCK-OUT</span>
                  ) : null}
                </div>
                <div className="pullup-rep-detail-grid">
                  <span>up {frame.currentRepDetail.upSec.toFixed(1)} s</span>
                  <span>down {frame.currentRepDetail.downSec.toFixed(1)} s</span>
                  <span>peak {frame.currentRepDetail.peakSpeed.toFixed(2)} m/s</span>
                  <span>≈ {frame.currentRepDetail.kcal.toFixed(2)} kcal</span>
                  <span>effort ×{frame.currentRepDetail.effort.toFixed(1)}</span>
                  <span>{frame.currentRepDetail.watts} W</span>
                  <span>sway {frame.currentRepDetail.swayCm} cm</span>
                  <span>elbow gap {frame.currentRepDetail.elbowGap}°</span>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Right gauges + social */}
        <aside className="pullup-right">
          <div className="pullup-social">
            <div className="pullup-social-item">
              <span>♡</span>
              <small>7,487</small>
            </div>
            <div className="pullup-social-item">
              <span>💬</span>
              <small>122</small>
            </div>
            <div className="pullup-social-item">
              <span>↺</span>
              <small>130</small>
            </div>
            <div className="pullup-social-item">
              <span>➤</span>
              <small>5,749</small>
            </div>
          </div>

          <div className="pullup-chin-gauge" aria-label="Chin at bar">
            <span className="pullup-chin-label">CHIN @ BAR</span>
            <div className="pullup-chin-track">
              <div
                className="pullup-chin-fill"
                style={{ height: `${Math.min(100, frame.chinProgress * 100)}%` }}
              />
              <div
                className="pullup-chin-thumb"
                style={{ bottom: `${Math.min(100, frame.chinProgress * 100)}%` }}
              />
            </div>
          </div>

          <div className="pullup-heat-legend">
            <span>MUSCLE HEAT</span>
            <div className="pullup-heat-bar" />
          </div>

          {frame.efficiencyLive != null && frame.efficiencyLabel ? (
            <div
              className={`pullup-efficiency ${
                frame.efficiencyLabel.includes("ABOVE")
                  ? "is-good"
                  : frame.efficiencyLabel.includes("SHORT")
                    ? "is-bad"
                    : "is-warn"
              }`}
            >
              <div className="pullup-efficiency-icon">
                {frame.efficiencyLabel.includes("ABOVE")
                  ? "✓"
                  : frame.efficiencyLabel.includes("SHORT")
                    ? "✕"
                    : "~"}
              </div>
              <div className="pullup-efficiency-label">{frame.efficiencyLabel}</div>
              <div className="pullup-efficiency-score">efficiency {frame.efficiencyLive}/100</div>
            </div>
          ) : null}
        </aside>

        {/* Bottom graph + caption */}
        <footer className="pullup-bottom">
          <ShoulderGraph frame={frame} />
          <div className="pullup-caption">
            <div className="pullup-caption-user">
              <span className="pullup-avatar sm" aria-hidden />
              <div>
                <div className="pullup-caption-name">
                  dyeallpies <span className="pullup-follow">Follow</span>
                </div>
                <div className="pullup-caption-ai">AI content</div>
              </div>
            </div>
            <p className="pullup-caption-text">Pull Up Analysis by Fable and DyeAllPies …</p>
          </div>
          <div className="pullup-seek">
            <div className="pullup-seek-bar">
              <div
                className="pullup-seek-fill"
                style={{ width: `${Math.min(100, (Math.min(t, SET_DURATION) / SET_DURATION) * 100)}%` }}
              />
            </div>
            <span className="pullup-seek-time">
              {formatClock(t)} / {formatClock(SET_DURATION)}
            </span>
          </div>
          <div className="pullup-controls">
            <button type="button" onClick={() => setPlaying((p) => !p)}>
              {playing ? "Pause" : "Play"}
            </button>
            <button
              type="button"
              onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 0.5 : 1))}
            >
              {speed}×
            </button>
            <button
              type="button"
              onClick={() => {
                lastRef.current = null;
                setT(SET_DURATION + 0.5);
                setPlaying(false);
              }}
            >
              Summary
            </button>
            <button type="button" onClick={replay}>
              Restart
            </button>
            <button type="button" onClick={onBack}>
              Apps
            </button>
          </div>
          <div className="pullup-reply">
            <span>Reply to _tonyola…</span>
            <span className="pullup-reply-emojis">❤️ 😂 😮</span>
          </div>
        </footer>

        {frame.showSummary ? <SetSummary /> : null}
      </div>
    </div>
  );
}
