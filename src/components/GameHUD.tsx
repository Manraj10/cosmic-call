"use client";

import { HabitatMap } from "@/components/HabitatMap";
import { TaskPanel } from "@/components/TaskPanel";
import { Button } from "@/components/ui/button";
import { ITEM_LABELS, ROOM_LABELS, SYSTEM_LABELS, type RoomId, type SystemId } from "@/shared/constants";
import type { ClientState } from "@/shared/protocol";
import { formatEta, haptic } from "@/lib/utils";
import { useMemo, useState } from "react";

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
  const [tab, setTab] = useState<"map" | "task" | "crew">("map");
  const myTasks = useMemo(
    () => state.tasks.filter((t) => t.assignedToYou || t.youHaveControl || t.availableInfo.length),
    [state.tasks],
  );
  const focus = myTasks.find((t) => t.assignedToYou) || myTasks[0];
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

      <div className="relative z-10 hidden flex-1 grid-cols-[220px_minmax(0,1fr)_minmax(280px,380px)] gap-3 overflow-hidden p-3 lg:grid">
        <aside className="glass flex flex-col gap-2 overflow-y-auto rounded-xl p-3">
          <Sys k="LIFE SUPPORT" v={state.habitat.oxygen} />
          <Sys k="POWER" v={state.habitat.power} />
          <Sys k="THERMAL" v={state.habitat.thermal} />
          <Sys k="COMMS" v={state.habitat.comms} />
          <div className="mt-2 font-mono text-[10px] tracking-[0.3em] text-amber-300">EMERGENCIES</div>
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
        <HabitatMap state={state} onMove={move} onPickup={onPickup} clockSkew={clockSkew} />
        <aside className="flex flex-col gap-3 overflow-y-auto">
          <YouPanel you={you} gauges={state.gauges} onDrop={onDrop} />
          {focus && (
            <TaskPanel
              task={focus}
              onUpdate={(p) => onUpdate(focus.id, p)}
              onConfirm={(p) => onConfirm(focus.id, p)}
              onHold={(h) => onHold(focus.id, h)}
            />
          )}
          <ReviveRow state={state} youId={state.you} onRevive={onRevive} />
        </aside>
      </div>

      <div className="relative z-10 flex flex-1 flex-col overflow-hidden lg:hidden">
        <div className="flex gap-1 px-2 pt-2">
          {(["map", "task", "crew"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`h-11 flex-1 rounded-md font-display text-xs tracking-widest ${
                tab === t ? "bg-orange-500 text-black" : "bg-white/5 text-white/70"
              }`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {tab === "map" && (
            <div className="flex h-full min-h-[360px] flex-col gap-2">
              <div className="grid grid-cols-2 gap-1">
                <Sys k="LIFE SUPPORT" v={state.habitat.oxygen} compact />
                <Sys k="POWER" v={state.habitat.power} compact />
                <Sys k="THERMAL" v={state.habitat.thermal} compact />
                <Sys k="COMMS" v={state.habitat.comms} compact />
              </div>
              <div className="min-h-[280px] flex-1">
                <HabitatMap state={state} onMove={move} onPickup={onPickup} clockSkew={clockSkew} />
              </div>
            </div>
          )}
          {tab === "task" && (
            <div className="space-y-3">
              <YouPanel you={you} gauges={state.gauges} onDrop={onDrop} />
              {state.hasCommsIntel && state.missionControl && (
                <div className="rounded border border-orange-400/30 bg-orange-400/10 p-2 text-sm text-orange-100">
                  {state.missionControl}
                </div>
              )}
              {focus ? (
                <TaskPanel
                  task={focus}
                  onUpdate={(p) => onUpdate(focus.id, p)}
                  onConfirm={(p) => onConfirm(focus.id, p)}
                  onHold={(h) => onHold(focus.id, h)}
                />
              ) : (
                <div className="glass p-4 text-sm text-white/60">No active procedure on your board. Help someone else.</div>
              )}
            </div>
          )}
          {tab === "crew" && (
            <CrewList state={state} youId={state.you} onRevive={onRevive} />
          )}
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
}: {
  you: ClientState["players"][number] | undefined;
  gauges: Record<string, string>;
  onDrop: () => void;
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
      <div className="mt-2 grid grid-cols-2 gap-1">
        {Object.entries(gauges).map(([k, v]) => (
          <div key={k} className="rounded bg-black/30 px-2 py-1">
            <div className="font-mono text-[9px] text-cyan-300/60">{k}</div>
            <div className="font-display text-sm tabular-nums">{v}</div>
          </div>
        ))}
      </div>
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
