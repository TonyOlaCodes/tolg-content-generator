"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PuzzleSpec } from "@/game/protocol";
import type { TaskFeedback } from "@/lib/client-state";
import { sfx } from "@/lib/audio";

/* --------------------------------------------------------------- primitives */

interface Slot {
  id: string;
  label?: string;
  glyph?: string;
  color?: string;
  index?: number;
  capacity?: number;
  keyCode?: string;
  dish?: string;
}
interface Item {
  id: string;
  label?: string;
  glyph?: string;
  color?: string;
  dish?: string;
  tag?: string;
  keyCode?: string;
  guest?: string;
  nights?: string;
  heavy?: boolean;
  name?: string;
}

function shellTitle(puzzle: PuzzleSpec): string {
  return puzzle.title;
}

/** Shared two-column "put every item on the right target" interaction. */
function AssignmentGame({
  items,
  targets,
  itemLabel,
  targetLabel,
  onChange,
}: {
  items: Item[];
  targets: Slot[];
  itemLabel: (item: Item) => { title: string; glyph: string; sub?: string };
  targetLabel: (target: Slot) => { title: string; glyph: string; sub?: string };
  onChange: (answer: Record<string, string>) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const place = (targetId: string): void => {
    if (!selected) return;
    const next = { ...mapping, [selected]: targetId };
    setMapping(next);
    onChange(next);
    setSelected(null);
    sfx.play("click");
  };

  return (
    <div className="mini-columns">
      <div className="mini-col">
        <p className="mini-col-title">Items</p>
        <div className="mini-items">
          {items.map((item) => {
            const label = itemLabel(item);
            const placed = mapping[item.id]
              ? targets.find((target) => target.id === mapping[item.id])
              : null;
            return (
              <button
                key={item.id}
                type="button"
                className={`mini-item ${selected === item.id ? "is-selected" : ""} ${
                  mapping[item.id] ? "is-placed" : ""
                }`}
                onClick={() => {
                  setSelected(item.id === selected ? null : item.id);
                  sfx.play("click");
                }}
              >
                <span className="mini-glyph">{label.glyph}</span>
                <span className="mini-text">
                  {label.title}
                  {label.sub ? <em>{label.sub}</em> : null}
                </span>
                {placed ? <span className="mini-badge">{placed.label ?? "placed"}</span> : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mini-col">
        <p className="mini-col-title">{targetLabel(items[0] ?? { id: "" }).title === "" ? "" : "Put them here"}</p>
        <div className="mini-targets">
          {targets.map((target) => {
            const label = targetLabel(target);
            const count = Object.values(mapping).filter((value) => value === target.id).length;
            return (
              <button
                key={target.id}
                type="button"
                className={`mini-target ${count > 0 ? "is-filled" : ""}`}
                onClick={() => place(target.id)}
                disabled={!selected}
              >
                <span className="mini-glyph">{label.glyph}</span>
                <span className="mini-text">{label.title}</span>
                {label.sub ? <em>{label.sub}</em> : null}
                {count > 0 ? <span className="mini-badge">{count}</span> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- bodies */

function MakeBed({ data, onChange }: { data: Record<string, unknown>; onChange: (value: unknown) => void }) {
  const slots = (data.slots ?? []) as Slot[];
  const items = (data.items ?? []) as Item[];
  return (
    <div className="mini-bed">
      <AssignmentGame
        items={items}
        targets={slots}
        itemLabel={(item) => ({ title: item.label ?? "", glyph: item.glyph ?? "🟩" })}
        targetLabel={(target) => ({ title: target.label ?? "", glyph: target.glyph ?? "⬜" })}
        onChange={(mapping) => onChange(mapping)}
      />
    </div>
  );
}

function CleanSpill({ data, onChange }: { data: Record<string, unknown>; onChange: (value: unknown) => void }) {
  const spots = (data.spots ?? []) as { id: string; x: number; y: number; size: number }[];
  const [cleaned, setCleaned] = useState<string[]>([]);
  const [mop, setMop] = useState({ x: 50, y: 50 });
  const areaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    onChange({ spots: cleaned });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleaned]);

  const handleMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const rect = areaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setMop({ x, y });
    const hit = spots.filter((spot) => Math.hypot(spot.x - x, spot.y - y) < spot.size / 2 + 3).map((spot) => spot.id);
    if (hit.length > 0) {
      setCleaned((current) => {
        const merged = new Set([...current, ...hit]);
        if (merged.size !== current.length) sfx.play("splash");
        return [...merged];
      });
    }
  };

  return (
    <div className="mini-mop-wrap">
      <div
        className="mini-mop"
        ref={areaRef}
        onPointerDown={handleMove}
        onPointerMove={(event) => {
          if (event.buttons === 0 && event.pointerType === "mouse") return;
          handleMove(event);
        }}
      >
        {spots.map((spot) => (
          <span
            key={spot.id}
            className={`mini-dirt ${cleaned.includes(spot.id) ? "is-clean" : ""}`}
            style={{ left: `${spot.x}%`, top: `${spot.y}%`, width: spot.size, height: spot.size }}
          />
        ))}
        <span className="mini-mop-head" style={{ left: `${mop.x}%`, top: `${mop.y}%` }}>
          🧹
        </span>
      </div>
      <p className="muted-line">
        Drag across every patch. {cleaned.length}/{spots.length} cleaned.
      </p>
    </div>
  );
}

function SortLaundry({ data, onChange }: { data: Record<string, unknown>; onChange: (value: unknown) => void }) {
  const items = (data.items ?? []) as Item[];
  const baskets = (data.baskets ?? []) as Slot[];
  const colors: Record<string, string> = { white: "#f8f9fa", dark: "#495057", red: "#ff8787" };
  return (
    <AssignmentGame
      items={items}
      targets={baskets}
      itemLabel={(item) => ({ title: item.label ?? "Item", glyph: item.glyph ?? "👕" })}
      targetLabel={(target) => ({
        title: target.label ?? "",
        glyph: target.glyph ?? "🧺",
        sub: target.color ? `${target.capacity ?? 2} fit here` : undefined,
      })}
      onChange={(mapping) => {
        void colors;
        onChange(mapping);
      }}
    />
  );
}

function DeliverLuggage({ data, onChange }: { data: Record<string, unknown>; onChange: (value: unknown) => void }) {
  const bags = (data.bags ?? []) as Item[];
  const rooms = (data.rooms ?? []) as Slot[];
  return (
    <AssignmentGame
      items={bags}
      targets={rooms}
      itemLabel={(item) => ({ title: "Suitcase", glyph: item.glyph ?? "🧳", sub: `tag: ${item.tag ?? "?"}` })}
      targetLabel={(target) => ({ title: target.label ?? "", glyph: "🚪" })}
      onChange={(mapping) => onChange(mapping)}
    />
  );
}

function RestockSupplies({ data, onChange }: { data: Record<string, unknown>; onChange: (value: unknown) => void }) {
  const checklist = (data.checklist ?? []) as string[];
  const items = (data.items ?? []) as Item[];
  const slots = (data.slots ?? []) as Slot[];
  const [placed, setPlaced] = useState<string[]>([]);

  useEffect(() => {
    onChange(placed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed]);

  const nextLabel = checklist[placed.length];

  return (
    <div className="mini-restock">
      <div className="mini-checklist">
        {checklist.map((entry, index) => (
          <span key={entry} className={`pill ${index < placed.length ? "pill-good" : ""}`}>
            {index + 1}. {entry}
          </span>
        ))}
      </div>
      <div className="mini-columns">
        <div className="mini-col">
          <p className="mini-col-title">Items</p>
          <div className="mini-items">
            {items.map((item) => {
              const used = placed.filter((id) => id === item.id).length;
              const total = items.filter((entry) => entry.id === item.id).length;
              const isNext = nextLabel === item.label;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`mini-item ${used >= total ? "is-placed" : ""} ${isNext ? "is-hint" : ""}`}
                  disabled={used >= total}
                  onClick={() => {
                    if (!nextLabel || item.label !== nextLabel) {
                      sfx.play("bang");
                      return;
                    }
                    setPlaced((current) => [...current, item.id]);
                    sfx.play("click");
                  }}
                >
                  <span className="mini-glyph">{item.glyph}</span>
                  <span className="mini-text">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="mini-col">
          <p className="mini-col-title">Shelf</p>
          <div className="mini-targets mini-shelf">
            {slots.map((slot) => (
              <span key={slot.id} className={`mini-slot ${placed[slot.index ?? 0] ? "is-filled" : ""}`}>
                {placed[slot.index ?? 0]
                  ? items.find((item) => item.id === placed[slot.index ?? 0])?.glyph
                  : "·"}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ServeMeals({ data, onChange }: { data: Record<string, unknown>; onChange: (value: unknown) => void }) {
  const orders = (data.orders ?? []) as Item[];
  const plates = (data.plates ?? []) as Item[];
  return (
    <AssignmentGame
      items={orders}
      targets={plates}
      itemLabel={(item) => ({ title: item.dish ?? "", glyph: item.glyph ?? "🧾", sub: item.guest })}
      targetLabel={(target) => ({ title: target.dish ?? "", glyph: target.glyph ?? "🍽" })}
      onChange={(mapping) => onChange(mapping)}
    />
  );
}

type Tuple = [boolean, boolean, boolean, boolean];
interface CircuitCell {
  id: string;
  x: number;
  y: number;
  kind: string;
  rotation: number;
  base: Tuple;
}

function rotateTuple(tuple: Tuple, times: number): Tuple {
  let current = tuple;
  for (let i = 0; i < ((times % 4) + 4) % 4; i += 1) {
    current = [current[3], current[0], current[1], current[2]];
  }
  return current;
}

function FixCircuit({ data, onChange }: { data: Record<string, unknown>; onChange: (value: unknown) => void }) {
  const width = Number(data.w ?? 3);
  const height = Number(data.h ?? 3);
  const cells = (data.cells ?? []) as CircuitCell[];
  const source = (data.source ?? { x: 0, y: 1 }) as { x: number; y: number };
  const outlet = (data.outlet ?? { x: 2, y: 1 }) as { x: number; y: number };
  const [rotations, setRotations] = useState<Record<string, number>>(() =>
    Object.fromEntries(cells.map((cell) => [cell.id, cell.rotation])),
  );

  useEffect(() => {
    onChange({ rotations });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotations]);

  return (
    <div className="mini-circuit">
      <div
        className="circuit-grid"
        style={{ gridTemplateColumns: `repeat(${width}, 1fr)`, gridTemplateRows: `repeat(${height}, 1fr)` }}
      >
        {Array.from({ length: height }).map((_, y) =>
          Array.from({ length: width }).map((__, x) => {
            const cell = cells.find((entry) => entry.x === x && entry.y === y);
            if (!cell) {
              return <span key={`${x}-${y}`} className="circuit-cell is-empty" />;
            }
            const connections = rotateTuple(cell.base, rotations[cell.id] ?? 0);
            const isSource = source.x === x && source.y === y;
            const isOutlet = outlet.x === x && outlet.y === y;
            return (
              <button
                key={`${x}-${y}`}
                type="button"
                disabled={isSource || isOutlet}
                className={`circuit-cell ${isSource ? "is-source" : ""} ${isOutlet ? "is-outlet" : ""}`}
                onClick={() => {
                  setRotations((current) => ({ ...current, [cell.id]: ((current[cell.id] ?? 0) + 1) % 4 }));
                  sfx.play("click");
                }}
              >
                {connections[0] ? <span className="pipe pipe-up" /> : null}
                {connections[1] ? <span className="pipe pipe-right" /> : null}
                {connections[2] ? <span className="pipe pipe-down" /> : null}
                {connections[3] ? <span className="pipe pipe-left" /> : null}
                {isSource ? <span className="circuit-label">⚡</span> : null}
                {isOutlet ? <span className="circuit-label">🔌</span> : null}
              </button>
            );
          }),
        )}
      </div>
      <p className="muted-line">Tap a pipe to rotate it. Get power from ⚡ to 🔌.</p>
    </div>
  );
}

function CheckInGuests({ data, onChange }: { data: Record<string, unknown>; onChange: (value: unknown) => void }) {
  const bookings = (data.bookings ?? []) as Item[];
  const rooms = (data.rooms ?? []) as Slot[];
  return (
    <AssignmentGame
      items={bookings}
      targets={rooms}
      itemLabel={(item) => ({ title: item.name ?? "", glyph: "📋", sub: `${item.nights ?? ""} · key ${item.keyCode ?? "?"}` })}
      targetLabel={(target) => ({ title: target.label ?? "", glyph: "🔑", sub: `key ${target.keyCode ?? "?"}` })}
      onChange={(mapping) => onChange(mapping)}
    />
  );
}

/* -------------------------------------------------------------------- shell */

export default function Minigame({
  puzzle,
  feedback,
  onSubmit,
  onCancel,
}: {
  puzzle: PuzzleSpec;
  feedback: TaskFeedback | null;
  onSubmit: (taskId: string, answer: unknown) => void;
  onCancel: (taskId: string) => void;
}) {
  const [answer, setAnswer] = useState<unknown>(null);
  const [remaining, setRemaining] = useState(puzzle.timeLimit);
  const startedAt = useRef(Date.now());
  const lastFeedback = useRef(0);

  useEffect(() => {
    setAnswer(null);
    setRemaining(puzzle.timeLimit);
    startedAt.current = Date.now();
  }, [puzzle.taskId, puzzle.timeLimit]);

  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt.current) / 1000);
      setRemaining(Math.max(0, puzzle.timeLimit - elapsed));
    }, 500);
    return () => clearInterval(timer);
  }, [puzzle.timeLimit]);

  useEffect(() => {
    if (feedback && feedback.at > lastFeedback.current) {
      lastFeedback.current = feedback.at;
      if (!feedback.ok && feedback.reason && /fast/i.test(feedback.reason)) return;
      if (feedback.ok) onCancel(puzzle.taskId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback]);

  const hint = useMemo(() => {
    if (!feedback || feedback.ok) return null;
    return feedback.reason ?? null;
  }, [feedback]);

  const canSubmit = answer !== null && feedback?.ok !== true;

  const body = (): React.ReactNode => {
    switch (puzzle.kind) {
      case "makeBed":
        return <MakeBed data={puzzle.data} onChange={setAnswer} />;
      case "cleanSpill":
        return <CleanSpill data={puzzle.data} onChange={setAnswer} />;
      case "sortLaundry":
        return <SortLaundry data={puzzle.data} onChange={setAnswer} />;
      case "deliverLuggage":
        return <DeliverLuggage data={puzzle.data} onChange={setAnswer} />;
      case "restockSupplies":
        return <RestockSupplies data={puzzle.data} onChange={setAnswer} />;
      case "serveMeals":
        return <ServeMeals data={puzzle.data} onChange={setAnswer} />;
      case "fixCircuit":
        return <FixCircuit data={puzzle.data} onChange={setAnswer} />;
      case "checkInGuests":
        return <CheckInGuests data={puzzle.data} onChange={setAnswer} />;
      default:
        return <p className="muted-line">Nothing to do here.</p>;
    }
  };

  return (
    <div className="overlay mini-overlay">
      <div className={`panel minigame ${hint ? "is-shaking" : ""}`} key={hint ?? "ok"}>
        <header className="mini-header">
          <div>
            <p className="eyebrow">Task</p>
            <h2>{shellTitle(puzzle)}</h2>
            <p className="muted-line">{puzzle.prompt}</p>
          </div>
          <div className="mini-timer">
            <span className={remaining < 8 ? "is-urgent" : ""}>{remaining}s</span>
            <div className="bar">
              <span style={{ width: `${(remaining / puzzle.timeLimit) * 100}%` }} />
            </div>
          </div>
        </header>

        {body()}

        {hint ? <p className="error-line">{hint}</p> : null}

        <footer className="mini-footer">
          <button type="button" className="btn btn-ghost" onClick={() => onCancel(puzzle.taskId)}>
            Leave it
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canSubmit}
            onClick={() => onSubmit(puzzle.taskId, answer)}
          >
            Finish the job
          </button>
        </footer>
      </div>
    </div>
  );
}
