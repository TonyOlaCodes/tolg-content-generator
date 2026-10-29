"use client";

import { useState } from "react";

export type ExportSettings = {
  aspect: "source" | "9:16";
  includeAudio: boolean;
  heatmap: boolean;
  appendSummary: boolean;
};

export default function ExportPanel({
  onCancel,
  onStart,
}: {
  onCancel: () => void;
  onStart: (settings: ExportSettings) => void;
}) {
  const [aspect, setAspect] = useState<"source" | "9:16">("9:16");
  const [includeAudio, setIncludeAudio] = useState(true);
  const [heatmap, setHeatmap] = useState(true);
  const [appendSummary, setAppendSummary] = useState(true);

  return (
    <div className="pu-summary" role="dialog" aria-label="Export options">
      <div className="pu-summary-card">
        <div className="pu-summary-top">
          <h2>EXPORT VIDEO</h2>
          <button type="button" className="pu-icon-btn" onClick={onCancel} aria-label="Close">
            ✕
          </button>
        </div>
        <p className="pu-summary-by">
          Burns skeleton, HUD, graph and optional summary into a playable file. Format depends on
          your browser (MP4 when supported, otherwise WebM).
        </p>

        <label className="pu-field">
          Aspect
          <select value={aspect} onChange={(e) => setAspect(e.target.value as "source" | "9:16")}>
            <option value="9:16">9:16 portrait (letterboxed)</option>
            <option value="source">Match source</option>
          </select>
        </label>

        <label className="pu-check">
          <input
            type="checkbox"
            checked={includeAudio}
            onChange={(e) => setIncludeAudio(e.target.checked)}
          />
          Include source audio when available
        </label>
        <label className="pu-check">
          <input type="checkbox" checked={heatmap} onChange={(e) => setHeatmap(e.target.checked)} />
          Estimated effort heatmap
        </label>
        <label className="pu-check">
          <input
            type="checkbox"
            checked={appendSummary}
            onChange={(e) => setAppendSummary(e.target.checked)}
          />
          Append set-summary card at the end
        </label>

        <div className="pu-summary-actions" style={{ marginTop: "0.85rem" }}>
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="is-accent"
            onClick={() => onStart({ aspect, includeAudio, heatmap, appendSummary })}
          >
            Start export
          </button>
        </div>
      </div>
    </div>
  );
}
