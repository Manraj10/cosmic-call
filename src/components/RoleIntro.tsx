"use client";

import { Button } from "@/components/ui/button";
import type { ClientState } from "@/shared/protocol";

export function RoleIntro({ state, onReady }: { state: ClientState; onReady: () => void }) {
  const card = state.roleCard;
  const you = state.players.find((p) => p.id === state.you);
  const remain = state.phaseEndsAt ? Math.max(0, Math.ceil((state.phaseEndsAt - Date.now()) / 1000)) : 15;
  if (!card) return null;
  return (
    <div className="mars-horizon flex min-h-dvh items-center justify-center px-4">
      <div className="glass w-full max-w-lg rounded-2xl p-6">
        <div className="font-mono text-[11px] tracking-[0.4em] text-orange-300">CREW ASSIGNMENT</div>
        <h2 className="font-display mt-3 text-3xl">YOU ARE ASTRONAUT {String(card.slot).padStart(2, "0")}</h2>
        <div className="mt-2 font-display text-xl text-cyan-300">PRIMARY SYSTEM: {card.primary}</div>
        <div className="mt-5">
          <div className="font-mono text-[10px] tracking-[0.3em] text-cyan-300/70">YOU CONTROL</div>
          <ul className="mt-2 space-y-1">
            {card.controls.map((c) => (
              <li key={c} className="text-white">
                ✓ {c}
              </li>
            ))}
          </ul>
        </div>
        <p className="mt-5 text-sm text-white/80">YOUR TEAM DEPENDS ON YOU TO: {card.depends}</p>
        <p className="mt-3 text-sm font-semibold text-amber-300">BUT: {card.warning}</p>
        <p className="mt-4 rounded-md border border-orange-400/25 bg-orange-400/10 px-3 py-2 text-xs text-orange-50">
          Failures come as one hole with two consoles. If you overshoot, their number changes — it is the same wound, not a second game.
        </p>
        <p className="mt-2 rounded-md border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-50">
          Phone: map stays up. Walk with WALK TO or tap a module. Shout the big numbers. Confirm only in that room.
        </p>
        <div className="mt-6 flex items-center justify-between">
          <div className="font-mono text-cyan-200/60">{you?.name}</div>
          <div className="font-display text-2xl text-white">{remain}s</div>
        </div>
        <Button size="xl" className="mt-4 w-full" onClick={onReady} disabled={you?.ready}>
          {you?.ready ? "READY — WAITING ON CREW" : "READY"}
        </Button>
      </div>
    </div>
  );
}

export function Tutorial({
  state,
  onPick,
}: {
  state: ClientState;
  onPick: (id: string) => void;
}) {
  const t = state.tutorial;
  if (!t) return null;
  const remain = state.phaseEndsAt ? Math.max(0, Math.ceil((state.phaseEndsAt - Date.now()) / 1000)) : 28;
  return (
    <div className="mars-horizon flex min-h-dvh items-center justify-center px-4">
      <div className="glass w-full max-w-lg rounded-2xl p-6">
        <div className="font-mono text-[11px] tracking-[0.4em] text-cyan-300">TRAINING PULSE · {remain}s</div>
        <h2 className="font-display mt-2 text-3xl">TUTORIAL</h2>
        <p className="mt-3 text-white/85">{t.problem}</p>
        <p className="mt-2 text-sm text-cyan-100">{t.target}</p>
        <ul className="mt-3 space-y-1 text-sm text-amber-100">
          {t.info.map((i) => (
            <li key={i} className="rounded bg-black/30 px-2 py-1">
              {i}
            </li>
          ))}
        </ul>
        {t.done ? (
          <div className="mt-6 rounded-lg border border-cyan-400/40 bg-cyan-400/10 p-4 font-display text-xl text-cyan-200">
            ✓ THAT&apos;S THE ONLY SAFE NUMBER
            <div className="mt-1 font-sans text-sm font-normal text-white/80">{t.explanation}</div>
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            {t.options.map((o) => (
              <Button
                key={o.id}
                size="lg"
                variant={o.id === "match" ? "cyan" : "ghost"}
                className="h-auto whitespace-normal py-3 text-left"
                onClick={() => onPick(o.id)}
              >
                {o.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Countdown({ state }: { state: ClientState }) {
  const remain = state.phaseEndsAt ? Math.max(0, Math.ceil((state.phaseEndsAt - Date.now()) / 1000)) : 3;
  const n = remain >= 4 ? "3" : remain === 0 ? "SURVIVE." : String(remain);
  return (
    <div className="mars-horizon flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <div className="font-mono tracking-[0.5em] text-orange-300">ARES HABITAT</div>
      <div className="mt-2 text-sm text-white/60">MARS — SOL 147</div>
      <div className="mt-8 font-mono text-xs tracking-[0.4em] text-cyan-300">RESCUE VEHICLE IN</div>
      <div className="font-display text-6xl text-white">07:00</div>
      <div className="font-display mt-10 text-7xl text-orange-400">{n}</div>
    </div>
  );
}
