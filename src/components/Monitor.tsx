"use client";

import { HabitatMap } from "@/components/HabitatMap";
import { Button } from "@/components/ui/button";
import { ROOM_LABELS } from "@/shared/constants";
import type { ClientState } from "@/shared/protocol";
import { formatEta } from "@/lib/utils";

export function HabitatMonitor({
  state,
  clockSkew,
}: {
  state: ClientState;
  clockSkew: number;
}) {
  const eta = formatEta(state.rescueEtaMs);
  const phaseLabel =
    state.phase === "role_intro"
      ? "CREW READING BOARDS"
      : state.phase === "tutorial"
        ? "TRAINING PULSE"
        : state.phase === "countdown"
          ? "COUNTDOWN"
          : "LIVE HABITAT";

  return (
    <div className="mars-horizon flex h-dvh flex-col">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-cyan-400/15 bg-black/50 px-3 py-2">
        <div>
          <div className="font-display text-sm text-cyan-200">HABITAT MONITOR</div>
          <div className="font-mono text-[10px] tracking-[0.3em] text-white/50">NOT A CREW SEAT · {phaseLabel}</div>
        </div>
        <div className="text-center">
          <div className="font-mono text-[10px] tracking-[0.35em] text-orange-300">RESCUE ETA</div>
          <div className="font-display text-4xl tabular-nums text-white sm:text-5xl">{eta}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] tracking-[0.3em] text-cyan-300/70">ROOM</div>
          <div className="font-display text-2xl tracking-[0.2em] text-orange-300">{state.roomCode}</div>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 gap-3 overflow-hidden p-3 lg:grid-cols-[minmax(0,1fr)_280px]">
        <HabitatMap state={state} onMove={() => {}} onPickup={() => {}} clockSkew={clockSkew} interactive={false} />
        <aside className="glass flex flex-col gap-3 overflow-y-auto rounded-xl p-3">
          <TankBar label="O₂ TANK" pct={state.habitat.oxygenPct} warn={42} crit={22} />
          <TankBar label="BATTERY" pct={state.habitat.batteryPct} warn={28} crit={12} />
          <div className="grid grid-cols-2 gap-1">
            <MonSys k="LIFE SUPPORT" v={state.habitat.oxygen} />
            <MonSys k="POWER" v={state.habitat.power} />
            <MonSys k="THERMAL" v={state.habitat.thermal} />
            <MonSys k="COMMS" v={state.habitat.comms} />
            <MonSys k="MEDICAL" v={state.habitat.medical} />
            <MonSys k="EXTERIOR" v={state.habitat.exterior} />
          </div>
          <div className="font-mono text-[10px] text-white/50">CABIN {state.habitat.tempC.toFixed(0)}°C</div>
          <div className="font-mono text-[10px] tracking-[0.3em] text-cyan-300">CREW · {state.playerCount}</div>
          <ul className="space-y-2">
            {state.players.map((p) => (
              <li key={p.id} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ background: p.color }} />
                  <span className="font-medium">{p.name}</span>
                </div>
                <div className="font-mono text-[10px] text-white/50">
                  {p.roleTitle} · {ROOM_LABELS[p.location]}
                  {p.movingTo ? ` → ${ROOM_LABELS[p.movingTo]}` : ""} · HP {p.health}%
                </div>
              </li>
            ))}
          </ul>
          <div className="font-mono text-[10px] tracking-[0.3em] text-amber-300">FAILURE</div>
          {state.incident && (
            <div className="rounded border border-orange-400/30 bg-orange-400/10 p-2 text-xs text-orange-50">
              <div className="font-display text-sm text-orange-200">{state.incident.title}</div>
              <p className="mt-1">{state.incident.cause}</p>
              {state.incident.pulse && <p className="mt-1 text-amber-100">{state.incident.pulse}</p>}
            </div>
          )}
          {state.emergencies.length === 0 && !state.incident && <div className="text-xs text-white/40">Quiet — for now.</div>}
          {state.tasks.filter((t) => !t.expired).map((t) => (
            <div key={t.id} className="rounded border border-amber-400/30 bg-amber-400/10 p-2 text-xs text-amber-50">
              <div className="font-display text-sm">{t.title}</div>
              <p className="mt-1 text-white/80">{t.sameHole || t.trade}</p>
            </div>
          ))}
          {state.youAreHost && state.phase === "lobby" && (
            <Button size="lg" className="mt-auto w-full" disabled={!state.canStart}>
              Waiting for 2 astronauts
            </Button>
          )}
        </aside>
      </div>
    </div>
  );
}

function TankBar({ label, pct, warn, crit }: { label: string; pct: number; warn: number; crit: number }) {
  const color = pct <= crit ? "#ff3b4e" : pct <= warn ? "#ffb020" : "#7ee7ff";
  return (
    <div>
      <div className="flex justify-between font-mono text-[9px] tracking-widest text-white/50">
        <span>{label}</span>
        <span style={{ color }}>{pct.toFixed(0)}%</span>
      </div>
      <div className="mt-1 h-4 overflow-hidden rounded-sm bg-black/50 ring-1 ring-white/10">
        <div className="h-full" style={{ width: `${Math.max(2, Math.min(100, pct))}%`, background: color }} />
      </div>
    </div>
  );
}

function MonSys({ k, v }: { k: string; v: string }) {
  const color =
    v === "CRITICAL" ? "text-red-400" : v === "WARNING" ? "text-amber-300" : v === "OFFLINE" ? "text-white/40" : "text-cyan-300";
  return (
    <div className="rounded bg-black/30 px-2 py-1">
      <div className="font-mono text-[9px] tracking-widest text-white/45">{k}</div>
      <div className={`font-display text-sm ${color}`}>{v}</div>
    </div>
  );
}
