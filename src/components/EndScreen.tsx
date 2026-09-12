"use client";

import { MlhTrustBadge, SponsorCredits } from "@/components/mlh";
import { Button } from "@/components/ui/button";
import type { ClientState } from "@/shared/protocol";

export function EndScreen({ state, onAgain }: { state: ClientState; onAgain: () => void }) {
  const end = state.end;
  if (!end) return null;
  const ok = end.outcome !== "failure";
  return (
    <div className="mars-horizon min-h-dvh overflow-y-auto px-4 py-8 pr-[88px] sm:pr-16">
      <MlhTrustBadge />
      <div className="mx-auto max-w-3xl">
        <div className="font-mono text-[11px] tracking-[0.4em] text-orange-300">MISSION DEBRIEF</div>
        <h1 className="font-display mt-2 text-4xl sm:text-5xl">{end.title}</h1>
        <p className="mt-2 text-xl text-cyan-200">{end.subtitle}</p>
        {!ok && end.primaryFailure && (
          <div className="mt-4 font-display text-2xl text-red-400">PRIMARY FAILURE: {end.primaryFailure}</div>
        )}
        <div className="glass mt-6 rounded-2xl p-6">
          <div className="font-mono text-[10px] tracking-[0.3em] text-cyan-300">MISSION SCORE</div>
          <div className="font-display text-6xl text-orange-300">{end.score.toLocaleString()}</div>
          <dl className="mt-6 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <Stat k="Optimal Solutions" v={end.stats.optimalSolutions} />
            <Stat k="Incorrect Solutions" v={end.stats.incorrectSolutions} />
            <Stat k="Emergencies Survived" v={end.stats.emergenciesSurvived} />
            <Stat k="Lowest Oxygen" v={`${end.stats.lowestOxygen}%`} />
            <Stat k="Lowest Power" v={`${end.stats.lowestPower}%`} />
            <Stat k="Astronauts Revived" v={end.stats.astronautsRevived} />
          </dl>
        </div>
        <div className="glass mt-4 rounded-2xl p-6">
          <div className="font-mono text-[10px] tracking-[0.3em] text-amber-300">CAUSAL CHAIN</div>
          <ol className="mt-3 space-y-1">
            {end.chain.map((c, i) => (
              <li key={i} className="text-sm text-white/85">
                {c}
                {i < end.chain.length - 1 && <div className="pl-2 text-orange-400/70">↓</div>}
              </li>
            ))}
          </ol>
        </div>
        <div className="glass mt-4 space-y-3 rounded-2xl p-6">
          <Line k="BEST MOVE" v={end.recap.bestMove} />
          <Line k="CRITICAL ERROR" v={end.recap.criticalError} />
          <Line k="CLOSEST CALL" v={end.recap.closestCall} />
          <Line k="TEAMWORK MOMENT" v={end.recap.teamwork} />
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {end.players.map((p) => (
            <li key={p.name} className="glass rounded-lg px-4 py-3">
              <span className="font-medium">{p.name}</span>
              <span className={p.survived ? "ml-2 text-cyan-300" : "ml-2 text-red-400"}>
                {p.survived ? `SURVIVED ${p.health}%` : "INCAPACITATED"}
              </span>
            </li>
          ))}
        </ul>
        {state.youAreHost ? (
          <Button size="xl" className="mt-8 w-full" onClick={onAgain}>
            PLAY AGAIN
          </Button>
        ) : (
          <p className="mt-8 text-center text-white/60">Waiting for mission lead to restart.</p>
        )}
        <SponsorCredits className="mt-8 border-t border-white/10 pt-5" />
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="rounded-md bg-black/30 p-3">
      <div className="font-mono text-[10px] tracking-widest text-white/45">{k}</div>
      <div className="font-display text-2xl">{v}</div>
    </div>
  );
}
function Line({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] tracking-[0.3em] text-orange-300">{k}</div>
      <p className="text-sm text-white/85">{v}</p>
    </div>
  );
}
