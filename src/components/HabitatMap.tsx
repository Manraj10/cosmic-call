"use client";

import { ITEM_LABELS, ROOM_LABELS, ROOM_SHORT, type RoomId } from "@/shared/constants";
import type { ClientState } from "@/shared/protocol";
import { cn } from "@/lib/utils";

const LAYOUT: Record<RoomId, { x: number; y: number; w: number; h: number; fill: string; side: string }> = {
  exterior: { x: 360, y: 36, w: 280, h: 88, fill: "#4a2a1c", side: "#2a140e" },
  airlock: { x: 210, y: 132, w: 170, h: 84, fill: "#243444", side: "#121c26" },
  comms: { x: 620, y: 132, w: 170, h: 84, fill: "#1e2c48", side: "#10182c" },
  crew: { x: 390, y: 228, w: 220, h: 92, fill: "#2c3c1c", side: "#161e0e" },
  power: { x: 150, y: 348, w: 210, h: 104, fill: "#4a3414", side: "#261a08" },
  life_support: { x: 640, y: 348, w: 220, h: 104, fill: "#14443a", side: "#0a2420" },
  medical: { x: 390, y: 488, w: 220, h: 96, fill: "#3a1c40", side: "#1e0e22" },
};

const LINKS: [RoomId, RoomId][] = [
  ["exterior", "airlock"],
  ["exterior", "comms"],
  ["airlock", "crew"],
  ["airlock", "power"],
  ["comms", "crew"],
  ["comms", "life_support"],
  ["crew", "medical"],
  ["crew", "power"],
  ["crew", "life_support"],
  ["power", "medical"],
  ["life_support", "medical"],
];

function isoPts(x: number, y: number, w: number, h: number, rise = 0) {
  const skew = 36;
  const yy = y - rise;
  return [
    [x + w * 0.5, yy],
    [x + w + skew * 0.15, yy + h * 0.35],
    [x + w * 0.5, yy + h],
    [x - skew * 0.15, yy + h * 0.35],
  ] as [number, number][];
}

function poly(pts: [number, number][]) {
  return pts.map((p) => p.join(",")).join(" ");
}

function center(id: RoomId, slot: number) {
  const r = LAYOUT[id];
  return {
    x: r.x + r.w * (0.3 + (slot % 4) * 0.13),
    y: r.y + r.h * 0.52,
  };
}

function neighbors(id: RoomId): RoomId[] {
  const out: RoomId[] = [];
  for (const [a, b] of LINKS) {
    if (a === id) out.push(b);
    if (b === id) out.push(a);
  }
  return out;
}

function pathRooms(from: RoomId, to: RoomId): RoomId[] {
  if (from === to) return [from];
  const q: RoomId[][] = [[from]];
  const seen = new Set<RoomId>([from]);
  while (q.length) {
    const cur = q.shift()!;
    const last = cur[cur.length - 1]!;
    for (const n of neighbors(last)) {
      if (seen.has(n)) continue;
      const next = [...cur, n];
      if (n === to) return next;
      seen.add(n);
      q.push(next);
    }
  }
  return [from, to];
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function walkPos(from: RoomId, to: RoomId, t: number, slot: number) {
  const path = pathRooms(from, to);
  if (path.length <= 1) return center(from, slot);
  const segs = path.length - 1;
  const x = Math.max(0, Math.min(0.999, t)) * segs;
  const i = Math.min(segs - 1, Math.floor(x));
  const lt = x - i;
  const p0 = center(path[i]!, slot);
  const p1 = center(path[i + 1]!, slot);
  return { x: lerp(p0.x, p1.x, lt), y: lerp(p0.y, p1.y, lt) };
}

export function HabitatMap({
  state,
  onMove,
  onPickup,
  clockSkew = 0,
  interactive = true,
}: {
  state: ClientState;
  onMove: (room: RoomId) => void;
  onPickup: (itemId: string) => void;
  clockSkew?: number;
  interactive?: boolean;
}) {
  const h = state.habitat;
  const you = state.players.find((p) => p.id === state.you);
  const now = Date.now() + clockSkew;
  const rooms = Object.keys(LAYOUT) as RoomId[];

  return (
    <div className="flex h-full min-h-[320px] flex-col">
      <div
        className={cn(
          "relative min-h-[280px] flex-1 overflow-hidden rounded-xl border border-cyan-400/25",
          h.emergencyLights && "flicker",
        )}
        style={{
          background: h.solarFlare
            ? "radial-gradient(ellipse at 50% 0%, #ffcc88, #2a1008 55%, #07040a)"
            : "radial-gradient(ellipse at 50% 120%, #c44a1a 0%, #14080c 42%, #07040c 70%)",
          filter: h.lightsDim && !h.emergencyLights ? "brightness(0.78)" : undefined,
        }}
      >
        {h.dustStorm && (
          <div className="dust-move pointer-events-none absolute inset-0 z-20 bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2280%22 height=%2280%22><circle cx=%222%22 cy=%222%22 r=%221%22 fill=%22%23d4a574%22 opacity=%220.5%22/></svg>')] opacity-50" />
        )}
        {h.frost && (
          <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-b from-cyan-100/15 to-transparent mix-blend-screen" />
        )}
        {h.heat && (
          <div className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-orange-500/20 to-transparent" />
        )}

        <svg viewBox="0 0 1000 640" className="h-full w-full">
          <defs>
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="deck" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7ee7ff" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#7ee7ff" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <text x="500" y="20" textAnchor="middle" fill="#f6c19b" fontSize="12" letterSpacing="5">
            ARES HABITAT  ·  SOL 147
          </text>

          {LINKS.map(([a, b]) => {
            const ca = center(a, 1);
            const cb = center(b, 1);
            return (
              <line
                key={`${a}-${b}`}
                x1={ca.x}
                y1={ca.y}
                x2={cb.x}
                y2={cb.y}
                stroke="#7ee7ff44"
                strokeWidth="10"
                strokeLinecap="round"
              />
            );
          })}

          {you?.movingTo && (
            <polyline
              fill="none"
              stroke="#ffb020"
              strokeWidth="3"
              strokeDasharray="8 7"
              opacity="0.85"
              points={pathRooms(you.location, you.movingTo)
                .map((id) => {
                  const c = center(id, you.slot);
                  return `${c.x},${c.y}`;
                })
                .join(" ")}
            />
          )}

          {rooms.map((id) => {
            const r = LAYOUT[id];
            const rise = 16;
            const top = isoPts(r.x, r.y, r.w, r.h, rise);
            const base = isoPts(r.x, r.y, r.w, r.h, 0);
            const selected = you?.location === id;
            const dest = you?.movingTo === id;
            const statusColor = selected ? "#7ee7ff" : dest ? "#ffb020" : "#7ee7ff66";
            const glitch = id === "comms" && h.commsGlitch;
            return (
              <g
                key={id}
                className={cn(interactive && "cursor-pointer", glitch && "glitch")}
                onClick={() => {
                  if (interactive) onMove(id);
                }}
              >
                <polygon points={poly([base[3]!, base[2]!, top[2]!, top[3]!])} fill={r.side} />
                <polygon points={poly([base[1]!, base[2]!, top[2]!, top[1]!])} fill={r.side} opacity="0.7" />
                <polygon
                  points={poly(top)}
                  fill={r.fill}
                  stroke={statusColor}
                  strokeWidth={selected || dest ? 3.2 : 1.5}
                />
                <polygon points={poly(top)} fill="url(#deck)" />
                {id === "exterior" && (
                  <g>
                    <rect
                      x={r.x + 70}
                      y={r.y + 18}
                      width="22"
                      height="48"
                      fill="#1a3040"
                      stroke="#7ee7ff"
                      transform={`rotate(${h.solarAngle - 45} ${r.x + 110} ${r.y + 42})`}
                    />
                    <rect
                      x={r.x + 128}
                      y={r.y + 18}
                      width="22"
                      height="48"
                      fill="#1a3040"
                      stroke="#7ee7ff"
                      transform={`rotate(${h.solarAngle - 45} ${r.x + 168} ${r.y + 42})`}
                    />
                  </g>
                )}
                <text
                  x={r.x + r.w / 2}
                  y={r.y + r.h * 0.38}
                  textAnchor="middle"
                  fill="#e8f6ff"
                  fontSize="14"
                  fontWeight="700"
                  letterSpacing="1.2"
                >
                  {ROOM_LABELS[id].toUpperCase()}
                </text>
                {selected && (
                  <text
                    x={r.x + r.w / 2}
                    y={r.y + r.h * 0.55}
                    textAnchor="middle"
                    fill="#ffb020"
                    fontSize="9"
                    letterSpacing="2"
                  >
                    YOU ARE HERE
                  </text>
                )}
                {dest && !selected && (
                  <text
                    x={r.x + r.w / 2}
                    y={r.y + r.h * 0.55}
                    textAnchor="middle"
                    fill="#ffb020"
                    fontSize="9"
                    letterSpacing="2"
                  >
                    WALKING HERE
                  </text>
                )}
                {state.items
                  .filter((it) => it.location === id)
                  .map((it, i) => (
                    <g
                      key={it.id}
                      style={{ pointerEvents: interactive ? "auto" : "none" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (interactive) onPickup(it.id);
                      }}
                    >
                      <rect
                        x={r.x + 28 + i * 40}
                        y={r.y + r.h - 22}
                        width="34"
                        height="16"
                        rx="3"
                        fill="#ffb020"
                        stroke="#fff"
                      />
                      <title>{ITEM_LABELS[it.type]}</title>
                    </g>
                  ))}
              </g>
            );
          })}

          {state.players.map((p) => {
            const moving = Boolean(p.movingTo && p.moveEndsAt > now);
            const dur = Math.max(1, p.moveEndsAt - p.moveStartsAt);
            const t = moving ? Math.max(0, Math.min(1, (now - p.moveStartsAt) / dur)) : 1;
            const pos = moving && p.movingTo ? walkPos(p.location, p.movingTo, t, p.slot) : center(p.location, p.slot);
            const mine = p.id === state.you;
            return (
              <g
                key={p.id}
                className={moving ? "walk" : "bob"}
                filter="url(#glow)"
                style={{ pointerEvents: "none" }}
              >
                <ellipse cx={pos.x} cy={pos.y + 18} rx="12" ry="5" fill="#0008" />
                {mine && (
                  <circle cx={pos.x} cy={pos.y} r="22" fill="none" stroke="#ffb020" strokeWidth="2" opacity="0.7" />
                )}
                <rect
                  x={pos.x - 7}
                  y={pos.y - 6}
                  width="14"
                  height="18"
                  rx="4"
                  fill={p.color}
                  opacity={p.incapacitated ? 0.4 : 1}
                />
                <circle cx={pos.x} cy={pos.y - 14} r="8" fill="#dceaf4" />
                <ellipse cx={pos.x} cy={pos.y - 14} rx="5" ry="3.4" fill="#123" />
                <text
                  x={pos.x}
                  y={pos.y + 32}
                  textAnchor="middle"
                  fill={mine ? "#ffb020" : "#fff"}
                  fontSize="11"
                  fontWeight="700"
                >
                  {p.name}
                </text>
                {p.incapacitated && (
                  <text x={pos.x} y={pos.y - 28} textAnchor="middle" fill="#ff3b4e" fontSize="10">
                    DOWN
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {interactive && (
        <div className="mt-2 flex flex-wrap gap-1">
          {rooms.map((id) => {
            const here = you?.location === id;
            const dest = you?.movingTo === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onMove(id)}
                className={cn(
                  "h-10 min-w-[3.2rem] flex-1 rounded-md border px-2 font-display text-[11px] tracking-widest",
                  here
                    ? "border-cyan-300 bg-cyan-400 text-black"
                    : dest
                      ? "border-amber-400 bg-amber-400/20 text-amber-100"
                      : "border-cyan-400/25 bg-black/40 text-cyan-100",
                )}
              >
                {ROOM_SHORT[id]}
              </button>
            );
          })}
        </div>
      )}
      <div className="mt-1 font-mono text-[10px] tracking-[0.25em] text-cyan-200/60">
        {interactive
          ? you?.movingTo
            ? `WALKING ${ROOM_LABELS[you.location].toUpperCase()} → ${ROOM_LABELS[you.movingTo].toUpperCase()}`
            : "TAP A MODULE (OR THE CHIPS) TO WALK THERE"
          : "HABITAT MONITOR — CREW WALKS FROM THEIR DEVICES"}
      </div>
    </div>
  );
}
