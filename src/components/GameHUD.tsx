"use client";

import { HabitatMap } from "@/components/HabitatMap";
import { TaskPanel } from "@/components/TaskPanel";
import { Button } from "@/components/ui/button";
import { ITEM_LABELS, ROOM_LABELS, type RoomId } from "@/shared/constants";
import type { ClientState } from "@/shared/protocol";
import { formatEta, haptic } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";

export function GameHUD({
  state,
  onMove,
  onPickup,
  onDrop,
  onTrade,
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
  onTrade: (targetId: string) => void;
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
            {you?.roleTitle}
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
        <div className="text-right">
          {you && you.health < 40 ? (
            <div className="font-display text-sm text-red-400">HURT {you.health}</div>
          ) : (
            <div className="font-mono text-[10px] text-white/40">{you?.inventory ? ITEM_LABELS[you.inventory] : "EMPTY HANDS"}</div>
          )}
        </div>
      </header>

      <div
        className={`relative z-10 hidden flex-1 gap-3 overflow-hidden p-3 lg:grid ${
          atConsole
            ? "grid-cols-[minmax(240px,0.85fr)_minmax(340px,1.15fr)]"
            : "grid-cols-[minmax(0,1fr)_minmax(280px,400px)]"
        }`}
      >
        <div className="flex min-h-0 flex-col">
          {state.incident && (
            <div className="mb-2 rounded-md border border-orange-400/35 bg-orange-400/10 px-3 py-2">
              <div className="font-mono text-[10px] tracking-[0.28em] text-orange-300">{state.incident.title}</div>
              <p className="text-xs text-orange-50">{state.incident.pulse || state.incident.cause}</p>
            </div>
          )}
          {atConsole && you && (
            <div className="mb-2 rounded-md border border-cyan-300/40 bg-cyan-400/10 px-3 py-2 font-display text-sm tracking-widest text-cyan-100">
              CONSOLE OPEN · {ROOM_LABELS[you.location].toUpperCase()}
            </div>
          )}
          <HabitatMap state={state} onMove={move} onPickup={onPickup} clockSkew={clockSkew} />
        </div>
        <aside className="flex flex-col gap-3 overflow-y-auto">
          <HandsBar
            you={you}
            players={state.players}
            floorItems={floorItems}
            onPickup={onPickup}
            onDrop={onDrop}
            onTrade={onTrade}
          />
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
            <CrewList state={state} youId={state.you} onRevive={onRevive} onTrade={onTrade} you={you} />
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
                {t.youHaveControl ? "SET" : "SAY"} · {t.title}
              </button>
            ))}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <HandsBar
            you={you}
            players={state.players}
            floorItems={floorItems}
            onPickup={onPickup}
            onDrop={onDrop}
            onTrade={onTrade}
          />
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

function HandsBar({
  you,
  players,
  floorItems,
  onPickup,
  onDrop,
  onTrade,
}: {
  you: ClientState["players"][number] | undefined;
  players: ClientState["players"];
  floorItems: ClientState["items"];
  onPickup: (id: string) => void;
  onDrop: () => void;
  onTrade: (id: string) => void;
}) {
  if (!you) return null;
  const here = players.filter(
    (p) =>
      p.id !== you.id &&
      p.kind !== "monitor" &&
      !p.incapacitated &&
      p.location === you.location &&
      !p.movingTo &&
      !you.movingTo,
  );
  return (
    <div className="glass rounded-xl p-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-white/80">
          {ROOM_LABELS[you.location]}
          {you.movingTo ? ` → ${ROOM_LABELS[you.movingTo]}` : ""}
        </span>
        <span className="font-display text-amber-200">
          {you.inventory ? ITEM_LABELS[you.inventory] : "EMPTY HANDS"}
        </span>
      </div>
      {floorItems.map((it) => (
        <Button key={it.id} className="mt-2 h-12 w-full" variant="warn" onClick={() => onPickup(it.id)}>
          GRAB {ITEM_LABELS[it.type].toUpperCase()}
        </Button>
      ))}
      {you.inventory &&
        here.map((p) => (
          <Button
            key={p.id}
            className="mt-2 h-12 w-full"
            variant="cyan"
            onClick={() => onTrade(p.id)}
          >
            {p.inventory
              ? `SWAP ${ITEM_LABELS[you.inventory!]} FOR ${ITEM_LABELS[p.inventory]} WITH ${p.name.toUpperCase()}`
              : `HAND ${ITEM_LABELS[you.inventory!]} TO ${p.name.toUpperCase()}`}
          </Button>
        ))}
      {you.inventory && (
        <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={onDrop}>
          DROP HERE
        </Button>
      )}
    </div>
  );
}

function CrewList({
  state,
  youId,
  you,
  onRevive,
  onTrade,
}: {
  state: ClientState;
  youId: string;
  you: ClientState["players"][number] | undefined;
  onRevive: (id: string) => void;
  onTrade: (id: string) => void;
}) {
  return (
    <ul className="space-y-2">
      {state.players
        .filter((p) => p.kind !== "monitor")
        .map((p) => {
          const sameRoom = you && p.location === you.location && !p.movingTo && !you.movingTo;
          return (
            <li key={p.id} className="glass flex items-center gap-3 rounded-xl p-3">
              <span className="h-8 w-8 rounded-full" style={{ background: p.color }} />
              <div className="flex-1">
                <div className="font-medium">
                  {p.name} {p.id === youId ? "(you)" : ""}
                </div>
                <div className="font-mono text-[10px] text-white/50">
                  {ROOM_LABELS[p.location]}
                  {p.inventory ? ` · ${ITEM_LABELS[p.inventory]}` : ""}
                </div>
              </div>
              {p.incapacitated && p.id !== youId && (
                <Button size="sm" variant="danger" onClick={() => onRevive(p.id)}>
                  REVIVE
                </Button>
              )}
              {p.id !== youId && you?.inventory && sameRoom && !p.incapacitated && (
                <Button size="sm" variant="cyan" onClick={() => onTrade(p.id)}>
                  {p.inventory ? "SWAP" : "HAND"}
                </Button>
              )}
            </li>
          );
        })}
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
