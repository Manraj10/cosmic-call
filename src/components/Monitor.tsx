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
          <div className="font-mono text-[10px] tracking-[0.3em] text-amber-300">ALARMS</div>
          {state.emergencies.length === 0 && <div className="text-xs text-white/40">Quiet — for now.</div>}
          {state.emergencies.map((e) => (
            <div key={e.id} className="rounded bg-red-500/10 px-2 py-1 text-xs text-red-200">
              {e.title}
            </div>
          ))}
          {state.tasks[0] && (
            <div className="rounded border border-amber-400/30 bg-amber-400/10 p-2 text-xs text-amber-50">
              <div className="font-display text-sm">{state.tasks[0].title}</div>
              <p className="mt-1 text-white/80">{state.tasks[0].howTo}</p>
            </div>
          )}
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
