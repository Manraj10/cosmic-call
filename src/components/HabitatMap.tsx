"use client";

import { ITEM_LABELS, ITEM_SHORT, ROOM_LABELS, ROOM_SHORT, type RoomId } from "@/shared/constants";
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
            <filter id="soft">
              <feGaussianBlur stdDeviation="8" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="deck" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7ee7ff" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#ff8a3a" stopOpacity="0.04" />
            </linearGradient>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1a1028" />
              <stop offset="55%" stopColor="#3a1810" />
              <stop offset="100%" stopColor="#7a3014" />
            </linearGradient>
            <radialGradient id="sun" cx="80%" cy="12%" r="18%">
              <stop offset="0%" stopColor="#ffe7a8" stopOpacity="0.95" />
              <stop offset="40%" stopColor="#ff9a3a" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#ff6a2a" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="tube" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#7ee7ff" stopOpacity="0.15" />
              <stop offset="50%" stopColor="#7ee7ff" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#7ee7ff" stopOpacity="0.15" />
            </linearGradient>
          </defs>
          <rect width="1000" height="640" fill="url(#sky)" />
          <rect width="1000" height="640" fill="url(#sun)" />
          <circle cx="820" cy="70" r="28" fill="#ffd27a" filter="url(#soft)" opacity="0.85" />
          <ellipse cx="500" cy="640" rx="560" ry="90" fill="#4a1c0c" opacity="0.55" />
          <ellipse cx="220" cy="610" rx="180" ry="40" fill="#2a1008" opacity="0.5" />
          <ellipse cx="800" cy="620" rx="200" ry="36" fill="#3a1408" opacity="0.45" />
          {[
            [80, 40],
            [140, 90],
            [210, 30],
            [300, 70],
            [430, 25],
            [520, 80],
            [610, 35],
            [700, 95],
            [760, 20],
            [900, 55],
            [960, 110],
            [40, 160],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 1.6 : 1} fill="#fff" opacity={0.45 + (i % 5) * 0.08} />
          ))}
          <text x="500" y="22" textAnchor="middle" fill="#f6c19b" fontSize="13" letterSpacing="6">
            ARES HABITAT  ·  SOL 147
          </text>

          {LINKS.map(([a, b]) => {
            const ca = center(a, 1);
            const cb = center(b, 1);
            return (
              <g key={`${a}-${b}`}>
                <line
                  x1={ca.x}
                  y1={ca.y}
                  x2={cb.x}
                  y2={cb.y}
                  stroke="#0b1c28"
                  strokeWidth="18"
                  strokeLinecap="round"
                />
                <line
                  x1={ca.x}
                  y1={ca.y}
                  x2={cb.x}
                  y2={cb.y}
                  stroke="#7ee7ff"
                  strokeWidth="11"
                  strokeLinecap="round"
                  opacity="0.35"
                />
                <line
                  x1={ca.x}
                  y1={ca.y}
                  x2={cb.x}
                  y2={cb.y}
                  stroke="#d6fbff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  opacity="0.7"
                  strokeDasharray="6 10"
                />
              </g>
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
                <ellipse
                  cx={r.x + r.w * 0.5}
                  cy={r.y + r.h * 0.42}
                  rx={18}
                  ry={10}
                  fill={h.emergencyLights ? "#ff5a3a" : "#7ee7ff"}
                  opacity={h.emergencyLights ? 0.35 : 0.18}
                />
                <rect
                  x={r.x + r.w * 0.38}
                  y={r.y + r.h * 0.18}
                  width={r.w * 0.24}
                  height={12}
                  rx="2"
                  fill="#081018"
                  stroke="#9be7ff"
                  strokeWidth="0.8"
                  opacity="0.85"
                />
                {id === "airlock" && (
                  <g>
                    {[0, 1, 2].map((i) => (
                      <polygon
                        key={i}
                        points={`${r.x + 40 + i * 36},${r.y + 58} ${r.x + 52 + i * 36},${r.y + 48} ${r.x + 64 + i * 36},${r.y + 58}`}
                        fill="#ffb020"
                        opacity="0.8"
                      />
                    ))}
                  </g>
                )}
                {id === "comms" && (
                  <g>
                    <line x1={r.x + r.w - 28} y1={r.y + 8} x2={r.x + r.w - 8} y2={r.y - 18} stroke="#7ee7ff" strokeWidth="2" />
                    <circle cx={r.x + r.w - 8} cy={r.y - 18} r="5" fill="none" stroke="#7ee7ff" />
                  </g>
                )}
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
                      className={interactive ? "cursor-pointer" : undefined}
                      style={{ pointerEvents: interactive ? "auto" : "none" }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (interactive) onPickup(it.id);
                      }}
                    >
                      <rect
                        x={r.x + 18 + i * 72}
                        y={r.y + r.h - 28}
                        width="68"
                        height="22"
                        rx="4"
                        fill="#ffb020"
                        stroke="#fff"
                        strokeWidth="1.4"
                      />
                      <text
                        x={r.x + 52 + i * 72}
                        y={r.y + r.h - 13}
                        textAnchor="middle"
                        fill="#1a0c04"
                        fontSize="9"
                        fontWeight="800"
                      >
                        {ITEM_SHORT[it.type]}
                      </text>
                      <title>{`TAP TO GRAB ${ITEM_LABELS[it.type]}`}</title>
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
                <ellipse cx={pos.x} cy={pos.y + 22} rx="14" ry="5" fill="#0009" />
                {mine && (
                  <circle cx={pos.x} cy={pos.y} r="26" fill="none" stroke="#ffb020" strokeWidth="2" opacity="0.75" />
                )}
                <rect x={pos.x + 6} y={pos.y - 4} width="7" height="12" rx="2" fill="#234" />
                <rect
                  x={pos.x - 8}
                  y={pos.y - 6}
                  width="16"
                  height="20"
                  rx="5"
                  fill={p.color}
                  opacity={p.incapacitated ? 0.4 : 1}
                />
                <rect x={pos.x - 6} y={pos.y + 10} width="5" height="8" rx="1.5" fill={p.color} />
                <rect x={pos.x + 1} y={pos.y + 10} width="5" height="8" rx="1.5" fill={p.color} />
                <circle cx={pos.x} cy={pos.y - 16} r="10" fill="#dceaf4" />
                <ellipse cx={pos.x} cy={pos.y - 16} rx="7" ry="5" fill="#0a2030" />
                <ellipse cx={pos.x - 2} cy={pos.y - 17} rx="3" ry="2" fill="#7ee7ff" opacity="0.55" />
                <text
                  x={pos.x}
                  y={pos.y + 36}
                  textAnchor="middle"
                  fill={mine ? "#ffb020" : "#fff"}
                  fontSize="11"
                  fontWeight="700"
                >
                  {p.name}
                </text>
                {p.incapacitated && (
                  <text x={pos.x} y={pos.y - 32} textAnchor="middle" fill="#ff3b4e" fontSize="10">
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
      {interactive && you && state.items.filter((it) => it.location === you.location).length > 0 && (
        <div className="mt-2 space-y-1">
          {state.items
            .filter((it) => it.location === you.location)
            .map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => onPickup(it.id)}
                className="h-12 w-full rounded-md bg-amber-400 font-display text-sm tracking-widest text-black"
              >
                TAP TO GRAB {ITEM_LABELS[it.type].toUpperCase()}
              </button>
            ))}
        </div>
      )}
      <div className="mt-1 font-mono text-[10px] tracking-[0.25em] text-cyan-200/60">
        {interactive
          ? you?.movingTo
            ? `WALKING ${ROOM_LABELS[you.location].toUpperCase()} → ${ROOM_LABELS[you.movingTo].toUpperCase()}`
            : "YELLOW TAGS ARE KITS — TAP THE TAG OR THE GRAB BUTTON"
          : "HABITAT MONITOR — CREW WALKS FROM THEIR DEVICES"}
      </div>
    </div>
  );
}
