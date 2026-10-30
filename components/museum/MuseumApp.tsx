"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import "./museum.css";
import Arrival from "./Arrival";
import Hud from "./Hud";
import { getArtifact } from "@/lib/museum/artifacts";
import { getExhibit } from "@/lib/museum/exhibits";
import { CURATOR_LINES, ENDING_COPY } from "@/lib/museum/narrative";
import { museumAudio } from "@/lib/museum/audio";
import { useMuseum } from "@/lib/museum/store";
import type { ExhibitId } from "@/lib/museum/types";
import {
  StarForge,
  Garden,
  OceanAbove,
  CityRemembers,
  Mirrors,
  Clock,
  Orchestra,
  PocketUniverse,
  WeatherMachine,
  Library,
  ZeroG,
  Forbidden,
} from "./exhibits";

const Atrium = dynamic(() => import("./Atrium"), {
  ssr: false,
  loading: () => (
    <div className="im-stage" style={{ display: "grid", placeItems: "center" }}>
      <p className="im-serif" style={{ opacity: 0.7 }}>
        Materialising atrium…
      </p>
    </div>
  ),
});

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const fn = () => setReduced(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return reduced;
}

function ExhibitHost({
  id,
  seed,
  reduced,
}: {
  id: ExhibitId;
  seed: string;
  reduced: boolean;
}) {
  const s = useMuseum();
  const art = getExhibit(id)?.artifactId;
  const collect = () => {
    if (!art) return;
    const def = getArtifact(art);
    s.collectArtifact(art, def ? { id: `got-${art}`, title: def.name, body: def.description } : undefined);
  };
  const back = () => s.returnAtrium();
  const common = { onBack: back, onCollect: collect, seed, reducedMotion: reduced };

  switch (id) {
    case "star_forge":
      return <StarForge {...common} />;
    case "garden":
      return <Garden {...common} />;
    case "ocean":
      return <OceanAbove {...common} />;
    case "city":
      return <CityRemembers {...common} />;
    case "mirrors":
      return (
        <Mirrors
          {...common}
          onSecret={() => {
            s.unlockAchievement("mirror_whisper");
            s.setCuratorMessage(CURATOR_LINES.mirror_whisper);
          }}
        />
      );
    case "clock":
      return <Clock {...common} />;
    case "orchestra":
      return (
        <Orchestra
          {...common}
          onChord={() => {
            s.unlockAchievement("orchestra_chord");
          }}
        />
      );
    case "pocket":
      return <PocketUniverse {...common} />;
    case "weather":
      return <WeatherMachine {...common} />;
    case "library":
      return (
        <Library
          {...common}
          onClue={(clue) =>
            s.addClue(clue, {
              id: clue,
              title: "Unwritten margin",
              body: `A clue surfaces: ${clue.replace("origin:", "")}.`,
            })
          }
        />
      );
    case "zerog":
      return <ZeroG {...common} />;
    case "forbidden":
      return (
        <Forbidden
          {...common}
          unlocked={s.canEnterForbidden()}
          artifacts={s.artifacts.length}
          onEnding={(ending) => s.completeEnding(ending)}
        />
      );
    default:
      return null;
  }
}

export default function MuseumApp({ onBack }: { onBack: () => void }) {
  const s = useMuseum();
  const reduced = useReducedMotion();
  const [typed, setTyped] = useState("");

  useEffect(() => {
    s.init();
    // konami-ish: type VOID
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape" && s.photoMode) s.togglePhotoMode();
      if (e.key.length === 1) {
        setTyped((prev) => {
          const next = (prev + e.key.toLowerCase()).slice(-8);
          if (next.endsWith("void")) {
            s.unlockAchievement("konami_void");
            s.setCuratorMessage("You named the absence. The void answers with a colder light.");
            museumAudio.tone({ freq: 40, duration: 1.2, type: "sine", gain: 0.09 });
          }
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (s.phase === "exhibit") museumAudio.startAmbient("exhibit");
    if (s.phase === "atrium") museumAudio.startAmbient("void");
  }, [s.phase]);

  // achievement hooks when collecting certain artifacts
  useEffect(() => {
    if (s.artifacts.includes("stolen_hour")) s.unlockAchievement("clock_solved");
    if (s.artifacts.includes("ember_core")) s.unlockAchievement("star_collapse");
    if (s.artifacts.includes("seed_of_never")) s.unlockAchievement("garden_bloom");
    if (s.artifacts.includes("storm_needle")) s.unlockAchievement("weather_eclipse");
  }, [s.artifacts, s]);

  const endingCopy = useMemo(
    () => (s.ending ? ENDING_COPY[s.ending] : null),
    [s.ending],
  );

  const enter = (): void => {
    s.ensureAudio();
    s.setPhase("atrium");
    s.setCuratorMessage(CURATOR_LINES.welcome);
  };

  return (
    <div className="im-root" data-seed={s.seed} data-typed={typed}>
      {s.phase === "arrival" ? (
        <Arrival
          muted={s.muted}
          onToggleMute={() => {
            s.ensureAudio();
            s.setMuted(!s.muted);
          }}
          onEnter={enter}
          onSkip={enter}
        />
      ) : null}

      {s.phase === "atrium" ? <Atrium /> : null}

      {s.phase === "exhibit" && s.currentExhibit ? (
        <div className="im-stage">
          <ExhibitHost id={s.currentExhibit} seed={s.seed} reduced={reduced} />
        </div>
      ) : null}

      {s.phase === "finale" && endingCopy ? (
        <div className="im-finale" role="dialog" aria-label="Finale">
          <p className="im-logo">The Impossible Museum</p>
          <h1>{endingCopy.title}</h1>
          <p>{endingCopy.body}</p>
          <p>{endingCopy.epilogue}</p>
          <div style={{ display: "flex", gap: "0.6rem", justifyContent: "center", flexWrap: "wrap", marginTop: "1.2rem" }}>
            <button type="button" className="im-btn primary" onClick={() => s.setPhase("atrium")}>
              Return to atrium
            </button>
            <button type="button" className="im-btn ghost" onClick={() => s.softReset()}>
              New visitation
            </button>
            <button type="button" className="im-btn ghost" onClick={onBack}>
              Exit to apps
            </button>
          </div>
        </div>
      ) : null}

      {s.phase !== "arrival" ? <Hud onBackApps={onBack} /> : null}
    </div>
  );
}
