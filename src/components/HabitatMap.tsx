"use client";

import { ITEM_LABELS, ROOM_LABELS, type RoomId } from "@/shared/constants";
import type { ClientState } from "@/shared/protocol";
import { cn } from "@/lib/utils";

const LAYOUT: Record<RoomId, { x: number; y: number; w: number; h: number; fill: string }> = {
  exterior: { x: 360, y: 28, w: 280, h: 92, fill: "#3a2218" },
  airlock: { x: 210, y: 130, w: 170, h: 88, fill: "#1c2a36" },
  comms: { x: 620, y: 130, w: 170, h: 88, fill: "#1a2438" },
  crew: { x: 390, y: 230, w: 220, h: 96, fill: "#243018" },
  power: { x: 150, y: 350, w: 210, h: 110, fill: "#3a2a10" },
  life_support: { x: 640, y: 350, w: 220, h: 110, fill: "#10362e" },
  medical: { x: 390, y: 490, w: 220, h: 100, fill: "#2a1830" },
};

function iso(x: number, y: number, w: number, h: number) {
  const skew = 38;
  return [
    [x + w * 0.5, y],
    [x + w + skew * 0.15, y + h * 0.35],
    [x + w * 0.5, y + h],
    [x - skew * 0.15, y + h * 0.35],
  ]
    .map((p) => p.join(","))
    .join(" ");
}

export function HabitatMap({
  state,
  onMove,
  onPickup,
}: {
  state: ClientState;
  onMove: (room: RoomId) => void;
  onPickup: (itemId: string) => void;
}) {
  const h = state.habitat;
  const you = state.players.find((p) => p.id === state.you);

  return (
    <div
      className={cn(
        "relative h-full min-h-[320px] overflow-hidden rounded-xl border border-cyan-400/20",
        h.emergencyLights && "flicker",
      )}
      style={{
        background: h.solarFlare
          ? "radial-gradient(ellipse at 50% 0%, #ffcc88, #2a1008 55%, #07040a)"
          : "radial-gradient(ellipse at 50% 120%, #c44a1a 0%, #14080c 42%, #07040c 70%)",
        filter: h.lightsDim && !h.emergencyLights ? "brightness(0.72)" : undefined,
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
      {h.debris && (
        <div className="pointer-events-none absolute inset-0 z-10 opacity-40 mix-blend-screen">
          <div className="absolute left-1/3 top-1/4 h-1 w-1 rounded-full bg-white bob" />
          <div className="absolute left-2/3 top-1/2 h-1.5 w-1.5 rounded-full bg-cyan-100 bob" />
        </div>
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
        </defs>
        <text x="500" y="22" textAnchor="middle" fill="#f6c19b" fontSize="11" letterSpacing="6">
          ARES HABITAT  ·  SOL 147
        </text>

        {(Object.keys(LAYOUT) as RoomId[]).map((id) => {
          const r = LAYOUT[id];
          const pts = iso(r.x, r.y, r.w, r.h);
          const selected = you?.location === id;
          const statusColor =
            id === "power" && h.emergencyLights
              ? "#ff3b4e"
              : selected
                ? "#7ee7ff"
                : "#7ee7ff55";
          const glitch = id === "comms" && h.commsGlitch;
          return (
            <g
              key={id}
              className={cn("cursor-pointer", glitch && "glitch")}
              onClick={() => onMove(id)}
            >
              <polygon
                points={pts}
                fill={r.fill}
                stroke={statusColor}
                strokeWidth={selected ? 3 : 1.4}
                opacity={h.lightsDim ? 0.85 : 1}
              />
              <polygon
                points={pts}
                fill={h.emergencyLights ? "#ff3b4e22" : "#7ee7ff10"}
              />
              {id === "exterior" && (
                <g>
                  <rect
                    x={r.x + 70}
                    y={r.y + 28}
                    width="22"
                    height="48"
                    fill="#1a3040"
                    stroke="#7ee7ff"
                    transform={`rotate(${h.solarAngle - 45} ${r.x + 110} ${r.y + 52})`}
                  />
                  <rect
                    x={r.x + 128}
                    y={r.y + 28}
                    width="22"
                    height="48"
                    fill="#1a3040"
                    stroke="#7ee7ff"
                    transform={`rotate(${h.solarAngle - 45} ${r.x + 168} ${r.y + 52})`}
                  />
                </g>
              )}
              <text
                x={r.x + r.w / 2}
                y={r.y + r.h * 0.48}
                textAnchor="middle"
                fill="#e8f6ff"
                fontSize="13"
                fontWeight="700"
                letterSpacing="1.5"
              >
                {ROOM_LABELS[id].toUpperCase()}
              </text>
              {state.items
                .filter((it) => it.location === id)
                .map((it, i) => (
                  <g
                    key={it.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPickup(it.id);
                    }}
                  >
                    <rect
                      x={r.x + 24 + i * 36}
                      y={r.y + r.h - 28}
                      width="28"
                      height="14"
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

        {state.players.map((p, i) => {
          const loc = p.movingTo && p.moveEndsAt > Date.now() ? lerpRoom(p.location, p.movingTo, progress(p)) : p.location;
          const r = LAYOUT[loc];
          const px = r.x + r.w * (0.32 + (i % 4) * 0.12);
          const py = r.y + r.h * 0.62;
          return (
            <g key={p.id} className="bob" filter="url(#glow)">
              <ellipse cx={px} cy={py + 16} rx="10" ry="4" fill="#0008" />
              <rect x={px - 6} y={py - 6} width="12" height="16" rx="4" fill={p.color} opacity={p.incapacitated ? 0.4 : 1} />
              <circle cx={px} cy={py - 12} r="7" fill="#dceaf4" />
              <ellipse cx={px} cy={py - 12} rx="4.5" ry="3.2" fill="#123" />
              <text
                x={px}
                y={py + 28}
                textAnchor="middle"
                fill={p.id === state.you ? "#ffb020" : "#fff"}
                fontSize="10"
                fontWeight="700"
              >
                {p.name}
              </text>
              {p.incapacitated && (
                <text x={px} y={py - 24} textAnchor="middle" fill="#ff3b4e" fontSize="9">
                  DOWN
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="pointer-events-none absolute bottom-2 left-3 font-mono text-[10px] tracking-[0.3em] text-cyan-200/50">
        TAP A MODULE TO MOVE
      </div>
    </div>
  );
}

function progress(p: { moveStartsAt: number; moveEndsAt: number }) {
  const now = Date.now();
  return Math.max(0, Math.min(1, (now - p.moveStartsAt) / Math.max(1, p.moveEndsAt - p.moveStartsAt)));
}

function lerpRoom(a: RoomId, b: RoomId, t: number): RoomId {
  return t > 0.5 ? b : a;
}
