"use client";

import { HabitatMap } from "@/components/HabitatMap";
import { TaskPanel } from "@/components/TaskPanel";
import { Button } from "@/components/ui/button";
import { ITEM_LABELS, ROOM_LABELS, SYSTEM_LABELS, type RoomId, type SystemId } from "@/shared/constants";
import type { ClientState } from "@/shared/protocol";
import { formatEta, haptic } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";

const STATUS_COLOR = {
  STABLE: "text-cyan-300",
  WARNING: "text-amber-300",
  CRITICAL: "text-red-400 crit-pulse",
  OFFLINE: "text-white/40",
};

export function GameHUD({
  state,
  onMove,
  onPickup,
  onDrop,
  onUpdate,
  onConfirm,
  onHold,
  onRevive,
  clockSkew = 0,
}: {
  state: ClientState;
  onMove: (room: RoomId) => void;
  onPickup: (id: string) => void;
  onDrop: () => void;
  onUpdate: (taskId: string, payload: unknown) => void;
  onConfirm: (taskId: string, payload: unknown) => void;
  onHold: (taskId: string, holding: boolean) => void;
  onRevive: (id: string) => void;
  clockSkew?: number;
}) {
  const you = state.players.find((p) => p.id === state.you);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [crewOpen, setCrewOpen] = useState(false);
  const myTasks = useMemo(
    () => state.tasks.filter((t) => t.assignedToYou || t.youHaveControl || t.availableInfo.length),
    [state.tasks],
  );
  const focus =
    myTasks.find((t) => t.id === focusId) ||
    myTasks.find((t) => t.youHaveControl && t.youInRoom) ||
    myTasks.find((t) => t.youHaveControl) ||
    myTasks[0];
  const atConsole = Boolean(focus?.youHaveControl && focus.youInRoom);
  const prevLoc = useRef(you?.location);
  useEffect(() => {
    const loc = you?.location;
    if (loc && loc !== prevLoc.current) {
      const at = myTasks.find((t) => t.youHaveControl && t.requiredRoom === loc);
      if (at) setFocusId(at.id);
    }
    prevLoc.current = loc;
  }, [you?.location, myTasks]);
  const floorItems = state.items.filter((it) => it.location === you?.location);
  const eta = formatEta(state.rescueEtaMs);
  const late = state.rescueEtaMs < 120000;
  const frantic = state.intensity > 0.62;

  const move = (room: RoomId) => {
    haptic(12);
    onMove(room);
  };

  return (
    <div className="mars-horizon vignette relative flex h-dvh flex-col">
      {frantic && <div className="siren-wash pointer-events-none absolute inset-0 z-[1]" />}
      <header className="relative z-10 grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-cyan-400/15 bg-black/40 px-3 py-2">
        <div className="min-w-0">
          <div className="truncate font-display text-sm text-white">{you?.name}</div>
          <div className="truncate font-mono text-[10px] tracking-widest text-cyan-300/80">
            {you?.roleTitle} · TAP MAP TO WALK
          </div>
        </div>
        <div className="text-center">
          <div className="font-mono text-[10px] tracking-[0.35em] text-orange-300">RESCUE ETA</div>
          <div
            className={`font-display text-3xl tabular-nums sm:text-4xl ${
              late ? "text-red-400 crit-pulse" : frantic ? "text-amber-300" : "text-white"
            }`}
          >
            {eta}
          </div>
        </div>
        <div className="text-right font-mono text-[10px] text-white/50">
          SCORE {state.score.toLocaleString()}
        </div>
      </header>

      <div
        className={`relative z-10 hidden flex-1 gap-3 overflow-hidden p-3 lg:grid ${
          atConsole
            ? "grid-cols-[180px_minmax(240px,0.7fr)_minmax(340px,1.15fr)]"
            : "grid-cols-[220px_minmax(0,1fr)_minmax(280px,380px)]"
        }`}
      >
        <aside className="glass flex flex-col gap-2 overflow-y-auto rounded-xl p-3">
          <Tank label="O₂ TANK" pct={state.habitat.oxygenPct} warn={42} crit={22} />
          <Tank label="BATTERY" pct={state.habitat.batteryPct} warn={28} crit={12} />
          <Sys k="LIFE SUPPORT" v={state.habitat.oxygen} />
          <Sys k="POWER" v={state.habitat.power} />
          <Sys k="THERMAL" v={state.habitat.thermal} />
          <Sys k="COMMS" v={state.habitat.comms} />
          <div className="font-mono text-[10px] text-white/45">CABIN {state.habitat.tempC.toFixed(0)}°C</div>
          {state.incident && (
            <div className="rounded border border-orange-400/30 bg-orange-400/10 p-2">
              <div className="font-mono text-[9px] tracking-widest text-orange-300">{state.incident.title}</div>
              <p className="mt-1 text-xs text-orange-50">{state.incident.cause || state.incident.pulse}</p>
              {state.incident.cause && state.incident.pulse && (
                <p className="mt-1 text-[11px] text-amber-100">{state.incident.pulse}</p>
              )}
            </div>
          )}
          <div className="mt-2 font-mono text-[10px] tracking-[0.3em] text-amber-300">LIVE FAILURE</div>
          {state.emergencies.length === 0 && <div className="text-xs text-white/40">None yet. Talk anyway.</div>}
          {state.emergencies.map((e) => (
            <div key={e.id} className="rounded bg-red-500/10 px-2 py-1 text-xs text-red-200">
              {e.title}
            </div>
          ))}
          {state.hasCommsIntel && state.missionControl && (
            <div className="mt-auto rounded border border-orange-400/30 bg-orange-400/10 p-2 text-xs text-orange-100">
              <div className="font-mono text-[9px] tracking-widest">MISSION CONTROL</div>
              {state.missionControl}
            </div>
          )}
        </aside>
        <div className="flex min-h-0 flex-col">
          {atConsole && you && (
            <div className="mb-2 rounded-md border border-cyan-300/40 bg-cyan-400/10 px-3 py-2 font-display text-sm tracking-widest text-cyan-100">
              CONSOLE OPEN · {ROOM_LABELS[you.location].toUpperCase()}
            </div>
          )}
          <HabitatMap state={state} onMove={move} onPickup={onPickup} clockSkew={clockSkew} />
        </div>
        <aside className="flex flex-col gap-3 overflow-y-auto">
          <YouPanel you={you} gauges={state.gauges} onDrop={onDrop} />
          {floorItems.length > 0 && (
            <div className="space-y-1">
              {floorItems.map((it) => (
                <Button key={it.id} className="h-12 w-full" variant="warn" onClick={() => onPickup(it.id)}>
                  TAP TO GRAB {ITEM_LABELS[it.type].toUpperCase()}
                </Button>
              ))}
            </div>
          )}
          {myTasks.length === 0 && (
            <div className="glass p-4 text-sm text-white/60">No procedure on your board. Help the other station.</div>
          )}
          {myTasks.map((task) => (
            <TaskPanel
              key={task.id}
              task={task}
              onUpdate={(p) => onUpdate(task.id, p)}
              onConfirm={(p) => onConfirm(task.id, p)}
              onHold={(h) => onHold(task.id, h)}
              onWalk={task.requiredRoom ? () => move(task.requiredRoom!) : undefined}
            />
          ))}
          <ReviveRow state={state} youId={state.you} onRevive={onRevive} />
        </aside>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="grid shrink-0 grid-cols-4 gap-1 px-2 pt-2">
          <Sys k="O2" v={state.habitat.oxygen} compact />
          <Sys k="PWR" v={state.habitat.power} compact />
          <Sys k="HEAT" v={state.habitat.thermal} compact />
          <Sys k="COM" v={state.habitat.comms} compact />
        </div>
        {state.incident && (
          <div className="mx-2 mt-2 shrink-0 rounded-md border border-orange-400/35 bg-orange-400/10 px-2 py-1.5">
            <div className="font-mono text-[9px] tracking-[0.28em] text-orange-300">{state.incident.title}</div>
            <p className="text-[11px] leading-snug text-orange-50">
              {state.incident.pulse || state.incident.cause}
            </p>
          </div>
        )}
        <div className={`min-h-[168px] shrink-0 px-2 pt-2 ${atConsole ? "h-[28vh]" : "h-[36vh]"}`}>
          <HabitatMap
            state={state}
            onMove={move}
            onPickup={onPickup}
            clockSkew={clockSkew}
            compact
          />
        </div>
        <div className="mt-1 flex shrink-0 gap-1 overflow-x-auto px-2">
          {state.players
            .filter((p) => p.kind !== "monitor")
            .map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setCrewOpen((o) => !o)}
                className="flex items-center gap-1 rounded-full border border-white/15 bg-black/40 px-2 py-1"
              >
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />
                <span className="font-mono text-[10px] text-white/80">
                  {p.name}
                  {p.incapacitated ? " DOWN" : ""}
                </span>
              </button>
            ))}
        </div>
        {crewOpen && (
          <div className="shrink-0 px-2 pt-1">
            <CrewList state={state} youId={state.you} onRevive={onRevive} />
          </div>
        )}
        {myTasks.length > 1 && (
          <div className="mt-1 flex shrink-0 gap-1 overflow-x-auto px-2">
            {myTasks.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setFocusId(t.id)}
                className={`h-9 shrink-0 rounded-md px-3 font-display text-[10px] tracking-widest ${
                  focus?.id === t.id ? "bg-orange-500 text-black" : "bg-white/10 text-white/80"
                }`}
              >
                {t.youHaveControl ? "DIAL" : "SAY"} · {t.title}
              </button>
            ))}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <YouPanel you={you} gauges={state.gauges} onDrop={onDrop} compact />
          {floorItems.length > 0 &&
            floorItems.map((it) => (
              <Button key={it.id} className="mt-2 h-12 w-full" variant="warn" onClick={() => onPickup(it.id)}>
                TAP TO GRAB {ITEM_LABELS[it.type].toUpperCase()}
              </Button>
            ))}
          {focus ? (
            <div className="mt-2">
              <TaskPanel
                task={focus}
                compact
                onUpdate={(p) => onUpdate(focus.id, p)}
                onConfirm={(p) => onConfirm(focus.id, p)}
                onHold={(h) => onHold(focus.id, h)}
                onWalk={focus.requiredRoom ? () => move(focus.requiredRoom!) : undefined}
              />
            </div>
          ) : (
            <div className="glass mt-2 p-4 text-sm text-white/60">No procedure on your board. Help the other station.</div>
          )}
          <ReviveRow state={state} youId={state.you} onRevive={onRevive} />
        </div>
      </div>

      <footer className="hidden border-t border-cyan-400/15 bg-black/50 px-3 py-2 lg:block">
        <div className="flex gap-4 overflow-x-auto font-mono text-[11px] text-white/55">
          {state.timeline.map((t) => (
            <span key={t.id} className={t.tone === "crit" ? "text-red-300" : t.tone === "ok" ? "text-cyan-300" : ""}>
              {t.text}
            </span>
          ))}
        </div>
      </footer>
    </div>
  );
}

function Tank({ label, pct, warn, crit }: { label: string; pct: number; warn: number; crit: number }) {
  const color = pct <= crit ? "#ff3b4e" : pct <= warn ? "#ffb020" : "#7ee7ff";
  return (
    <div>
      <div className="flex justify-between font-mono text-[9px] tracking-widest text-white/50">
        <span>{label}</span>
        <span style={{ color }}>{pct.toFixed(0)}%</span>
      </div>
      <div className="mt-1 h-3 overflow-hidden rounded-sm bg-black/50 ring-1 ring-white/10">
        <div className="h-full transition-all" style={{ width: `${Math.max(2, Math.min(100, pct))}%`, background: color }} />
      </div>
    </div>
  );
}

function Sys({ k, v, compact }: { k: string; v: keyof typeof STATUS_COLOR | string; compact?: boolean }) {
  const color = STATUS_COLOR[v as keyof typeof STATUS_COLOR] || "text-white";
  return (
    <div className={`rounded bg-black/30 px-2 ${compact ? "py-1" : "py-2"}`}>
      <div className="font-mono text-[9px] tracking-widest text-white/45">{k}</div>
      <div className={`font-display ${compact ? "text-sm" : "text-lg"} ${color}`}>{String(v)}</div>
    </div>
  );
}

function YouPanel({
  you,
  gauges,
  onDrop,
  compact,
}: {
  you: ClientState["players"][number] | undefined;
  gauges: Record<string, string>;
  onDrop: () => void;
  compact?: boolean;
}) {
  if (!you) return null;
  return (
    <div className="glass rounded-xl p-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Meter label="HEALTH" v={you.health} warn={40} />
        <Meter label="SUIT O₂" v={you.suitOxygen} warn={35} />
        <Meter label="RAD" v={you.radiation} invert warn={30} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="text-white/70">
          {ROOM_LABELS[you.location]}
          {you.movingTo ? ` → walking to ${ROOM_LABELS[you.movingTo]}` : " · tap a module to walk"}
        </span>
        <span className="text-amber-200">
          {you.inventory ? ITEM_LABELS[you.inventory] : "EMPTY HANDS"}
        </span>
      </div>
      {you.inventory && (
        <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={onDrop}>
          DROP {ITEM_LABELS[you.inventory]}
        </Button>
      )}
      {!compact && (
        <div className="mt-2 grid grid-cols-2 gap-1">
          {Object.entries(gauges).map(([k, v]) => (
            <div key={k} className="rounded bg-black/30 px-2 py-1">
              <div className="font-mono text-[9px] text-cyan-300/60">{k}</div>
              <div className="font-display text-sm tabular-nums">{v}</div>
            </div>
          ))}
        </div>
      )}
      {compact && Object.keys(gauges).length > 0 && (
        <div className="mt-2 flex gap-1 overflow-x-auto">
          {Object.entries(gauges).map(([k, v]) => (
            <div key={k} className="shrink-0 rounded bg-black/30 px-2 py-1">
              <div className="font-mono text-[9px] text-cyan-300/60">{k}</div>
              <div className="font-display text-sm tabular-nums">{v}</div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-2 font-mono text-[9px] tracking-widest text-white/35">
        {you.responsibilities.map((s) => SYSTEM_LABELS[s as SystemId]).join(" · ")}
      </div>
    </div>
  );
}

function Meter({ label, v, warn, invert }: { label: string; v: number; warn: number; invert?: boolean }) {
  const bad = invert ? v >= warn : v <= warn;
  const width = Math.max(0, Math.min(100, invert ? 100 - v : v));
  return (
    <div>
      <div className="font-mono text-[9px] text-white/40">{label}</div>
      <div className={`font-display text-lg ${bad ? "text-red-400" : "text-cyan-200"}`}>{v}%</div>
      <div className="meter-bar mt-1">
        <span style={{ width: `${width}%`, background: bad ? "#ff3b4e" : "#7ee7ff" }} />
      </div>
    </div>
  );
}

function CrewList({
  state,
  youId,
  onRevive,
}: {
  state: ClientState;
  youId: string;
  onRevive: (id: string) => void;
}) {
  return (
    <ul className="space-y-2">
      {state.players.map((p) => (
        <li key={p.id} className="glass flex items-center gap-3 rounded-xl p-3">
          <span className="h-8 w-8 rounded-full" style={{ background: p.color }} />
          <div className="flex-1">
            <div className="font-medium">
              {p.name} {p.id === youId ? "(you)" : ""}
            </div>
            <div className="font-mono text-[10px] text-white/50">
              {p.roleTitle} · {ROOM_LABELS[p.location]} · HP {p.health}%
              {p.inventory ? ` · ${ITEM_LABELS[p.inventory]}` : ""}
            </div>
          </div>
          {p.incapacitated && p.id !== youId && (
            <Button size="sm" variant="danger" onClick={() => onRevive(p.id)}>
              REVIVE
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

function ReviveRow({
  state,
  youId,
  onRevive,
}: {
  state: ClientState;
  youId: string;
  onRevive: (id: string) => void;
}) {
  const down = state.players.filter((p) => p.incapacitated && p.id !== youId);
  if (!down.length) return null;
  return (
    <div className="space-y-2">
      {down.map((p) => (
        <Button key={p.id} variant="danger" className="w-full" onClick={() => onRevive(p.id)}>
          REVIVE {p.name}
        </Button>
      ))}
    </div>
  );
}
