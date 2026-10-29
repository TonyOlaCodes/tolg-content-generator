"use client";

export type AppId = "elephant" | "pullup";

const APPS: Array<{
  id: AppId;
  title: string;
  subtitle: string;
  blurb: string;
  tags: string[];
  accent: string;
  icon: string;
}> = [
  {
    id: "elephant",
    title: "Elephant in the Room",
    subtitle: "Social deduction",
    blurb: "Hide an enormous elephant from hotel guests while someone sabotages the shift.",
    tags: ["3–8 players", "6 minutes", "Realtime"],
    accent: "#ffd166",
    icon: "🐘",
  },
  {
    id: "pullup",
    title: "Pull Up Analysis",
    subtitle: "AI video analysis",
    blurb: "Upload a real pull-up video for MediaPipe pose tracking, rep detection, and export.",
    tags: ["Upload video", "Pose CV", "Export"],
    accent: "#2ec4b6",
    icon: "🏋️",
  },
];

export default function AppChooser({ onChoose }: { onChoose: (id: AppId) => void }) {
  return (
    <div className="chooser-shell">
      <header className="chooser-header">
        <p className="chooser-kicker">Start screen</p>
        <h1 className="chooser-title">Choose an application</h1>
        <p className="chooser-sub">Open either the hotel game or the pull-up analysis overlay.</p>
      </header>

      <div className="chooser-grid">
        {APPS.map((app) => (
          <button
            key={app.id}
            type="button"
            className="chooser-card"
            style={{ ["--chooser-accent" as string]: app.accent }}
            onClick={() => onChoose(app.id)}
          >
            <span className="chooser-icon" aria-hidden>
              {app.icon}
            </span>
            <span className="chooser-card-body">
              <span className="chooser-card-subtitle">{app.subtitle}</span>
              <span className="chooser-card-title">{app.title}</span>
              <span className="chooser-card-blurb">{app.blurb}</span>
              <span className="chooser-tags">
                {app.tags.map((tag) => (
                  <span key={tag} className="chooser-tag">
                    {tag}
                  </span>
                ))}
              </span>
            </span>
            <span className="chooser-open">Open →</span>
          </button>
        ))}
      </div>
    </div>
  );
}
