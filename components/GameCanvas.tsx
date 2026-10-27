"use client";

import { useEffect, useRef, useState } from "react";
import { MAP_H, MAP_W, PLAYER_SPEED, TILE } from "@/game/config";
import { STATIONS } from "@/game/content";
import { gameMap } from "@/game/map";
import type { Snapshot } from "@/game/protocol";
import type { GameActions, GameStore } from "@/lib/client-state";
import {
  WORLD_H,
  WORLD_W,
  buildStaticLayer,
  drawBait,
  drawBlockedRoutes,
  drawDark,
  drawDoors,
  drawElephant,
  drawGuest,
  drawPlayer,
  drawSpill,
} from "@/lib/art";

interface Buffer {
  prev: Snapshot | null;
  curr: Snapshot | null;
  prevAt: number;
  currAt: number;
}

const KEY_VECTORS: Record<string, [number, number]> = {
  w: [0, -1],
  arrowup: [0, -1],
  s: [0, 1],
  arrowdown: [0, 1],
  a: [-1, 0],
  arrowleft: [-1, 0],
  d: [1, 0],
  arrowright: [1, 0],
};

export default function GameCanvas({
  store,
  actions,
  onNearbyChange,
}: {
  store: GameStore;
  actions: GameActions;
  onNearbyChange?: (label: string | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const staticRef = useRef<HTMLCanvasElement | null>(null);
  const buffer = useRef<Buffer>({ prev: null, curr: null, prevAt: 0, currAt: 0 });
  const storeRef = useRef(store);
  const actionsRef = useRef(actions);
  const keys = useRef(new Set<string>());
  const stick = useRef({ active: false, originX: 0, originY: 0, dx: 0, dy: 0, pointerId: -1 });
  const predicted = useRef({ x: 0, y: 0, ready: false });
  const seq = useRef(0);
  const lastNearby = useRef<string | null>(null);
  const [stickUi, setStickUi] = useState<{ active: boolean; x: number; y: number; dx: number; dy: number }>({
    active: false,
    x: 0,
    y: 0,
    dx: 0,
    dy: 0,
  });

  storeRef.current = store;
  actionsRef.current = actions;

  // keep the newest two snapshots for interpolation
  useEffect(() => {
    const snap = store.snapshot;
    if (!snap) return;
    const target = buffer.current;
    if (!target.curr || target.curr.tick !== snap.tick) {
      target.prev = target.curr;
      target.prevAt = target.currAt;
      target.curr = snap;
      target.currAt = performance.now();
    }
  }, [store.snapshot]);

  useEffect(() => {
    staticRef.current = buildStaticLayer();
  }, []);

  // input: keyboard
  useEffect(() => {
    const down = (event: KeyboardEvent): void => {
      const key = event.key.toLowerCase();
      if (KEY_VECTORS[key]) {
        keys.current.add(key);
        event.preventDefault();
      }
      if (key === "e" || key === " ") {
        actionsRef.current.interact();
        event.preventDefault();
      }
      if (key === "q") actionsRef.current.useAbility();
    };
    const up = (event: KeyboardEvent): void => {
      keys.current.delete(event.key.toLowerCase());
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  // input: send the movement intent at 20Hz
  useEffect(() => {
    const timer = setInterval(() => {
      let mx = 0;
      let my = 0;
      for (const key of keys.current) {
        const vector = KEY_VECTORS[key];
        if (vector) {
          mx += vector[0];
          my += vector[1];
        }
      }
      const stickState = stick.current;
      if (stickState.active) {
        const length = Math.hypot(stickState.dx, stickState.dy);
        if (length > 4) {
          const clamped = Math.min(1, length / 56);
          mx += (stickState.dx / length) * clamped;
          my += (stickState.dy / length) * clamped;
        }
      }
      mx = Math.max(-1, Math.min(1, mx));
      my = Math.max(-1, Math.min(1, my));
      actionsRef.current.sendInput(mx, my, seq.current++);
    }, 50);
    return () => clearInterval(timer);
  }, []);

  // render loop
  useEffect(() => {
    let frame = 0;
    const render = (): void => {
      frame = requestAnimationFrame(render);
      const canvas = canvasRef.current;
      const staticLayer = staticRef.current;
      if (!canvas || !staticLayer) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const current = storeRef.current;
      const now = performance.now();
      const snap = buffer.current.curr;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
      }

      if (!snap) {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.fillStyle = "#0b0a12";
        ctx.fillRect(0, 0, width, height);
        return;
      }

      // interpolate the authoritative state, then add local prediction for self
      const alpha = Math.max(0, Math.min(1, (now - buffer.current.currAt) / 110));
      const prev = buffer.current.prev ?? snap;
      const lerp = (from: number, to: number): number => from + (to - from) * alpha;
      const self = snap.players.find((player) => player.id === current.playerId);
      const doors = snap.doors;

      if (self) {
        if (!predicted.current.ready) {
          predicted.current = { x: self.x, y: self.y, ready: true };
        }
        // predicted local movement (feels instant) reconciled toward the server
        let mx = 0;
        let my = 0;
        for (const key of keys.current) {
          const vector = KEY_VECTORS[key];
          if (vector) {
            mx += vector[0];
            my += vector[1];
          }
        }
        const stickState = stick.current;
        if (stickState.active) {
          const length = Math.hypot(stickState.dx, stickState.dy);
          if (length > 4) {
            const clamped = Math.min(1, length / 56);
            mx += (stickState.dx / length) * clamped;
            my += (stickState.dy / length) * clamped;
          }
        }
        const magnitude = Math.hypot(mx, my);
        if (magnitude > 0.05 && !self.suspended) {
          const speed = PLAYER_SPEED * 32 * (1 / 60);
          const step = gameMap.moveCircle(
            predicted.current,
            (mx / Math.max(1, magnitude)) * speed,
            (my / Math.max(1, magnitude)) * speed,
            doors,
          );
          predicted.current.x = step.x;
          predicted.current.y = step.y;
        }
        const authoritative = { x: lerp(prev.players.find((p) => p.id === self.id)?.x ?? self.x, self.x) };
        predicted.current.x += (authoritative.x - predicted.current.x) * 0.12;
        const authoritativeY = lerp(prev.players.find((p) => p.id === self.id)?.y ?? self.y, self.y);
        predicted.current.y += (authoritativeY - predicted.current.y) * 0.12;
      }

      const focusX = predicted.current.ready ? predicted.current.x : (self?.x ?? WORLD_W / 2);
      const focusY = predicted.current.ready ? predicted.current.y : (self?.y ?? WORLD_H / 2);
      const zoom = Math.max(0.62, Math.min(1.7, Math.min(width / (TILE * 19), height / (TILE * 12))));

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = "#141019";
      ctx.fillRect(0, 0, width, height);

      const offsetX = Math.max(
        Math.min(width / 2 - focusX * zoom, 0),
        Math.min(0, width - WORLD_W * zoom),
      );
      const offsetY = Math.max(
        Math.min(height / 2 - focusY * zoom, 0),
        Math.min(0, height - WORLD_H * zoom),
      );

      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(zoom, zoom);
      ctx.drawImage(staticLayer, 0, 0);
      drawBlockedRoutes(ctx, snap.blockedRoutes);
      for (const bait of snap.baits) drawBait(ctx, bait, now);
      for (const spill of snap.spills) drawSpill(ctx, spill);
      drawDoors(ctx, snap.doors, []);
      drawDark(
        ctx,
        snap.dark,
        snap.players.filter((player) => player.connected).map((player) => ({ x: player.x, y: player.y })),
      );

      // task markers so you can see where your jobs are
      const myTasks = current.tasks;
      for (const task of myTasks) {
        const definition = STATIONS.find((entry) => entry.id === task.stationId);
        if (!definition) continue;
        const cx = (definition.x + definition.w / 2) * TILE;
        const cy = (definition.y + definition.h / 2) * TILE;
        const pulse = 16 + Math.sin(now / 260) * 4;
        ctx.strokeStyle = task.fake ? "rgba(255,138,216,0.75)" : "rgba(77,212,255,0.85)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = "bold 12px ui-sans-serif, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.beginPath();
        ctx.arc(cx, cy - 34, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.fillText("!", cx, cy - 30);
      }

      for (const guest of snap.guests) drawGuest(ctx, guest, now);
      drawElephant(ctx, snap.elephant, now);
      for (const player of snap.players) {
        if (self && player.id === self.id) {
          drawPlayer(ctx, { ...player, x: predicted.current.x, y: predicted.current.y }, true, now);
        } else {
          const previous = prev.players.find((entry) => entry.id === player.id);
          drawPlayer(
            ctx,
            {
              ...player,
              x: previous ? lerp(previous.x, player.x) : player.x,
              y: previous ? lerp(previous.y, player.y) : player.y,
            },
            false,
            now,
          );
        }
      }
      ctx.restore();

      // nearby interaction hint for the HUD
      if (self) {
        let label: string | null = null;
        let best = 2.1;
        for (const definition of STATIONS) {
          if (!definition.interactive) continue;
          const cx = (definition.x + definition.w / 2) * 32;
          const cy = (definition.y + definition.h / 2) * 32;
          const distance =
            Math.max(
              Math.abs(self.x - cx) - (definition.w * 32) / 2,
              Math.abs(self.y - cy) - (definition.h * 32) / 2,
            ) / 32;
          if (distance < best) {
            best = distance;
            const hasTask = myTasks.some((task) => task.stationId === definition.id);
            label = hasTask ? `${definition.name} — Use to work` : definition.name;
          }
        }
        if (label !== lastNearby.current) {
          lastNearby.current = label;
          onNearbyChange?.(label);
        }
      }
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [onNearbyChange]);

  // touch joystick on the left half of the play area
  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    if (x > rect.width * 0.55) return;
    stick.current = {
      active: true,
      originX: event.clientX,
      originY: event.clientY,
      dx: 0,
      dy: 0,
      pointerId: event.pointerId,
    };
    setStickUi({ active: true, x: event.clientX - rect.left, y: event.clientY - rect.top, dx: 0, dy: 0 });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const state = stick.current;
    if (!state.active || state.pointerId !== event.pointerId) return;
    const dx = event.clientX - state.originX;
    const dy = event.clientY - state.originY;
    const length = Math.hypot(dx, dy);
    const limit = 56;
    const scaled = length > limit ? { x: (dx / length) * limit, y: (dy / length) * limit } : { x: dx, y: dy };
    state.dx = scaled.x;
    state.dy = scaled.y;
    const rect = event.currentTarget.getBoundingClientRect();
    setStickUi({
      active: true,
      x: state.originX - rect.left,
      y: state.originY - rect.top,
      dx: scaled.x,
      dy: scaled.y,
    });
  };

  const endPointer = (event: React.PointerEvent<HTMLDivElement>): void => {
    const state = stick.current;
    if (!state.active || state.pointerId !== event.pointerId) return;
    stick.current = { active: false, originX: 0, originY: 0, dx: 0, dy: 0, pointerId: -1 };
    setStickUi({ active: false, x: 0, y: 0, dx: 0, dy: 0 });
  };

  return (
    <div
      className="game-surface"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPointer}
      onPointerCancel={endPointer}
      onContextMenu={(event) => event.preventDefault()}
    >
      <canvas ref={canvasRef} className="game-canvas" />
      {stickUi.active ? (
        <div className="joystick" style={{ left: stickUi.x, top: stickUi.y }}>
          <div
            className="joystick-knob"
            style={{ transform: `translate(calc(-50% + ${stickUi.dx}px), calc(-50% + ${stickUi.dy}px))` }}
          />
        </div>
      ) : null}
      <div className="map-legend">
        {MAP_W}×{MAP_H} tiles · {store.snapshot?.players.filter((player) => player.connected).length ?? 0} staff
        in the building
      </div>
    </div>
  );
}
