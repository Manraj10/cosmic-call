"use client";

import { ITEM_LABELS, ROOM_LABELS } from "@/shared/constants";
import type { TaskControl, TaskView } from "@/shared/protocol";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

export function TaskPanel({
  task,
  onUpdate,
  onConfirm,
  onHold,
  onWalk,
  compact = false,
}: {
  task: TaskView;
  onUpdate: (payload: unknown) => void;
  onConfirm: (payload: unknown) => void;
  onHold: (holding: boolean) => void;
  onWalk?: () => void;
  compact?: boolean;
}) {
  const secs = Math.ceil(task.timerMs / 1000);
  const walkLock = Boolean(task.youHaveControl && task.requiredRoom && !task.youInRoom);
  const blocked = !task.youHaveControl || Boolean(task.waitingOn && !walkLock);
  const late = task.expired || secs <= 0;

  return (
    <div
      className={cn(
        "glass flex flex-col gap-2 rounded-xl p-3 sm:gap-3 sm:p-4",
        task.youInRoom && task.youHaveControl && "border-cyan-300/50",
        task.severity === "critical" && "border-red-500/50 crit-pulse",
        task.severity === "urgent" && !task.youInRoom && "border-amber-400/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] tracking-[0.28em] text-orange-300">{task.incidentTitle}</div>
          <h3 className="font-display text-xl text-white sm:text-2xl">{task.title}</h3>
          <div className="font-display text-[10px] tracking-[0.35em] text-amber-300">
            {late ? "LATE" : task.youHaveControl ? "SET THIS NUMBER" : "SAY THIS NUMBER"}
          </div>
        </div>
        <div
          className={cn(
            "font-display text-3xl tabular-nums",
            late ? "text-red-400" : secs <= 12 ? "text-red-400" : "text-cyan-200",
          )}
        >
          {late ? "LATE" : `${secs}s`}
        </div>
      </div>

      {!compact && task.sameHole && (
        <p className="text-[11px] leading-snug text-orange-100/80">{task.sameHole}</p>
      )}
      {task.cascadePulse && (
        <p className="rounded border border-amber-400/35 bg-amber-400/10 px-2 py-1.5 text-xs text-amber-50">
          {task.cascadePulse}
        </p>
      )}

      {task.youHaveControl && (
        <TaskControlBoard
          key={task.id}
          control={task.control}
          confirmLocked={blocked}
          lockReason={walkLock ? "" : task.waitingOn || ""}
          onUpdate={onUpdate}
          onConfirm={onConfirm}
          onHold={onHold}
        />
      )}

      {walkLock && onWalk && (
        <Button className="h-14 w-full text-base" variant="warn" onClick={onWalk}>
          WALK TO {task.requiredRoom ? ROOM_LABELS[task.requiredRoom].toUpperCase() : "CONSOLE"}
        </Button>
      )}

      {task.youHaveControl ? (
        <div>
          <div className="font-mono text-[10px] tracking-[0.25em] text-cyan-300/70">YOUR PIECES</div>
          <ul className="mt-1 flex flex-wrap gap-1">
            {task.availableInfo.map((l) => (
              <li key={l} className="rounded bg-cyan-400/10 px-2 py-1.5 font-display text-lg text-white">
                {l}
              </li>
            ))}
          </ul>
          {task.worksheet[0] && (
            <p className="mt-2 font-mono text-[11px] text-cyan-100/70">{task.worksheet[0]}</p>
          )}
        </div>
      ) : (
        <div>
          <div className="font-mono text-[10px] tracking-[0.25em] text-amber-300">{task.shoutLabel}</div>
          <ul className="mt-1 space-y-2">
            {task.availableInfo.map((l) => (
              <li
                key={l}
                className="rounded-lg border border-amber-400/40 bg-amber-400/15 px-3 py-4 text-center font-display text-3xl text-white"
              >
                {l}
              </li>
            ))}
          </ul>
        </div>
      )}

      {task.requiredItem && (
        <div className="text-xs text-amber-200/90">
          {task.youHaveItem ? `Holding ${ITEM_LABELS[task.requiredItem]}` : `Need ${ITEM_LABELS[task.requiredItem]} — grab it or trade`}
        </div>
      )}

      {task.waitingOn && !walkLock && (
        <div className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
          {task.waitingOn}
        </div>
      )}
    </div>
  );
}

function TaskControlBoard({
  control,
  confirmLocked,
  lockReason,
  onUpdate,
  onConfirm,
  onHold,
}: {
  control: TaskControl;
  confirmLocked: boolean;
  lockReason: string;
  onUpdate: (payload: unknown) => void;
  onConfirm: (payload: unknown) => void;
  onHold: (holding: boolean) => void;
}) {
  switch (control.kind) {
    case "stepper":
      return (
        <Stepper
          label={control.label}
          unit={control.unit}
          min={control.min}
          max={control.max}
          step={control.step}
          value={control.value}
          confirmLocked={confirmLocked}
          lockReason={lockReason}
          onLive={onUpdate}
          onGo={(v) => onConfirm(v)}
        />
      );
    case "sliders":
      return (
        <SliderBoard
          control={control}
          confirmLocked={confirmLocked}
          lockReason={lockReason}
          onLive={onUpdate}
          onGo={(v) => onConfirm(v)}
        />
      );
    case "buttons":
      return (
        <div className="grid gap-2">
          {lockReason && confirmLocked && <LockNote text={lockReason} />}
          {control.options.map((o) => (
            <Button key={o.id} disabled={confirmLocked} variant="ghost" className="h-14 w-full" onClick={() => onConfirm(o.id)}>
              {o.label}
            </Button>
          ))}
        </div>
      );
    case "routing":
      return (
        <Router
          nodes={control.nodes}
          selected={control.selected}
          confirmLocked={confirmLocked}
          lockReason={lockReason}
          onConfirm={onConfirm}
        />
      );
    case "sequence":
      return (
        <Sequencer control={control} confirmLocked={confirmLocked} lockReason={lockReason} onConfirm={onConfirm} />
      );
    case "hold":
      return (
        <div>
          {lockReason && confirmLocked && <LockNote text={lockReason} />}
          <button
            disabled={confirmLocked}
            className="h-20 w-full rounded-xl bg-gradient-to-b from-orange-400 to-red-600 font-display text-2xl text-black shadow-[0_0_30px_rgba(255,80,20,0.45)] active:scale-[0.99]"
            onPointerDown={() => onHold(true)}
            onPointerUp={() => onHold(false)}
            onPointerLeave={() => onHold(false)}
            onPointerCancel={() => onHold(false)}
          >
            {control.label}
            <div className="mt-1 h-2 overflow-hidden rounded bg-black/30">
              <div className="h-full bg-white" style={{ width: `${control.progress * 100}%` }} />
            </div>
            <div className="font-mono text-xs">
              Holding: {control.holding.length ? control.holding.join(", ") : "none"}
            </div>
          </button>
        </div>
      );
    case "dual_confirm":
      return (
        <Stepper
          label={control.prompt}
          unit={control.unit || ""}
          min={control.min ?? 0}
          max={control.max ?? 99}
          step={control.step ?? 1}
          value={control.value}
          confirmLocked={confirmLocked}
          lockReason={lockReason}
          confirmLabel="CONFIRM"
          onLive={onUpdate}
          onGo={(v) => onConfirm({ value: v })}
        />
      );
    case "pattern":
      return (
        <Stepper
          label={control.prompt}
          unit=""
          min={control.min}
          max={control.max}
          step={1}
          value={control.value}
          confirmLocked={confirmLocked}
          lockReason={lockReason}
          onLive={onUpdate}
          onGo={(v) => onConfirm(v)}
        />
      );
    case "code":
      return (
        <CodePad
          digits={control.digits}
          value={control.value}
          confirmLocked={confirmLocked}
          lockReason={lockReason}
          onConfirm={onConfirm}
        />
      );
    default:
      return null;
  }
}

function LockNote({ text }: { text: string }) {
  return (
    <div className="mb-2 rounded-md border border-amber-400/40 bg-amber-400/15 px-3 py-2 text-sm text-amber-100">
      {text}
    </div>
  );
}

function Stepper({
  label,
  unit,
  min,
  max,
  step,
  value,
  confirmLocked,
  lockReason,
  confirmLabel = "CONFIRM",
  onLive,
  onGo,
}: {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
  confirmLocked: boolean;
  lockReason: string;
  confirmLabel?: string;
  onLive?: (v: number) => void;
  onGo: (v: number) => void;
}) {
  const decimals = step < 1 ? (String(step).split(".")[1]?.length ?? 1) : 0;
  const clampV = (n: number) => {
    const snapped = Math.round(n / step) * step;
    const bounded = Math.max(min, Math.min(max, snapped));
    return Number(bounded.toFixed(decimals));
  };
  const [v, setV] = useState(() => clampV(value));
  const vRef = useRef(v);
  vRef.current = v;
  const holdRef = useRef<number | null>(null);
  const delayRef = useRef<number | null>(null);
  const repeating = useRef(false);

  const bump = (d: number) => {
    setV((cur) => {
      const next = clampV(cur + d);
      onLive?.(next);
      return next;
    });
  };

  const stopHold = () => {
    if (delayRef.current) {
      window.clearTimeout(delayRef.current);
      delayRef.current = null;
    }
    if (holdRef.current) {
      window.clearInterval(holdRef.current);
      holdRef.current = null;
    }
  };
  const startHold = (d: number) => {
    stopHold();
    repeating.current = false;
    delayRef.current = window.setTimeout(() => {
      repeating.current = true;
      bump(d);
      holdRef.current = window.setInterval(() => bump(d), 110);
    }, 320);
  };
  useEffect(() => {
    return () => stopHold();
  }, []);

  return (
    <div className="space-y-3">
      <div className="font-mono text-xs tracking-widest text-cyan-200/70">{label}</div>
      {confirmLocked && lockReason && <LockNote text={lockReason} />}
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="h-20 w-20 shrink-0 touch-manipulation rounded-lg border-2 border-cyan-300/60 bg-cyan-400/15 font-display text-4xl text-white active:scale-95"
          onClick={() => {
            if (repeating.current) {
              repeating.current = false;
              return;
            }
            bump(-step);
          }}
          onPointerDown={(e) => {
            if (e.pointerType === "mouse" && e.button !== 0) return;
            startHold(-step);
          }}
          onPointerUp={stopHold}
          onPointerCancel={stopHold}
          onLostPointerCapture={stopHold}
        >
          -
        </button>
        <div className="flex-1 text-center">
          <input
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={step}
            value={v}
            onChange={(e) => {
              const next = clampV(Number(e.target.value));
              setV(next);
              onLive?.(next);
            }}
            className="w-full bg-transparent text-center font-display text-5xl text-white tabular-nums outline-none"
          />
          <div className="font-mono text-xs tracking-widest text-cyan-300">{unit}</div>
        </div>
        <button
          type="button"
          className="h-20 w-20 shrink-0 touch-manipulation rounded-lg border-2 border-cyan-300/60 bg-cyan-400/15 font-display text-4xl text-white active:scale-95"
          onClick={() => {
            if (repeating.current) {
              repeating.current = false;
              return;
            }
            bump(step);
          }}
          onPointerDown={(e) => {
            if (e.pointerType === "mouse" && e.button !== 0) return;
            startHold(step);
          }}
          onPointerUp={stopHold}
          onPointerCancel={stopHold}
          onLostPointerCapture={stopHold}
        >
          +
        </button>
      </div>
      <Button className="h-16 w-full text-lg" disabled={confirmLocked} onClick={() => onGo(vRef.current)}>
        {confirmLabel} {v}
        {unit ? ` ${unit}` : ""}
      </Button>
    </div>
  );
}

function SliderBoard({
  control,
  confirmLocked,
  lockReason,
  onLive,
  onGo,
}: {
  control: Extract<TaskControl, { kind: "sliders" }>;
  confirmLocked: boolean;
  lockReason: string;
  onLive?: (v: Record<string, number>) => void;
  onGo: (v: Record<string, number>) => void;
}) {
  const [vals, setVals] = useState(() => Object.fromEntries(control.sliders.map((s) => [s.id, s.value])));
  const sum = control.sliders.reduce((a, s) => a + (vals[s.id] ?? s.value), 0);
  const setOne = (id: string, n: number) => {
    setVals((cur) => {
      const next = { ...cur, [id]: n };
      onLive?.(next);
      return next;
    });
  };
  return (
    <div className="space-y-2">
      {confirmLocked && lockReason && <LockNote text={lockReason} />}
      {control.sliders.map((s) => (
        <label key={s.id} className="block">
          <div className="mb-1 flex justify-between font-mono text-xs">
            <span>{s.label}</span>
            <span className="font-display text-lg text-white">
              {vals[s.id] ?? s.value} {control.unit}
            </span>
          </div>
          <input
            type="range"
            min={s.min}
            max={s.max}
            value={vals[s.id] ?? s.value}
            onChange={(e) => setOne(s.id, Number(e.target.value))}
            className="w-full"
          />
        </label>
      ))}
      <div className={cn("font-display text-lg", sum === control.available ? "text-cyan-300" : "text-amber-300")}>
        {sum} / {control.available} {control.unit}
      </div>
      <Button
        disabled={confirmLocked}
        className="w-full"
        onClick={() => onGo(Object.fromEntries(control.sliders.map((s) => [s.id, vals[s.id] ?? s.value])))}
      >
        CONFIRM {sum} {control.unit}
      </Button>
    </div>
  );
}

function Router({
  nodes,
  selected,
  confirmLocked,
  lockReason,
  onConfirm,
}: {
  nodes: { id: string; label: string }[];
  selected: string[];
  confirmLocked: boolean;
  lockReason: string;
  onConfirm: (p: unknown) => void;
}) {
  const [sel, setSel] = useState(selected);
  const tap = (id: string) => {
    setSel((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };
  return (
    <div>
      {confirmLocked && lockReason && <LockNote text={lockReason} />}
      <div className="mb-3 flex flex-wrap gap-2">
        {nodes.map((n) => (
          <button
            key={n.id}
            type="button"
            onPointerDown={() => tap(n.id)}
            className={cn(
              "h-14 min-w-14 rounded-lg border px-4 font-display text-xl",
              sel.includes(n.id) ? "border-orange-400 bg-orange-400 text-black" : "border-cyan-400/30 bg-black/40",
            )}
          >
            {n.label}
          </button>
        ))}
      </div>
      <div className="mb-2 font-mono text-sm text-cyan-200">PATH: {sel.join(" → ") || "—"}</div>
      <Button className="w-full" disabled={confirmLocked || sel.length < 2} onClick={() => onConfirm(sel)}>
        COMMIT ROUTE
      </Button>
    </div>
  );
}

function Sequencer({
  control,
  confirmLocked,
  lockReason,
  onConfirm,
}: {
  control: Extract<TaskControl, { kind: "sequence" }>;
  confirmLocked: boolean;
  lockReason: string;
  onConfirm: (p: unknown) => void;
}) {
  const [order, setOrder] = useState<string[]>([]);
  const tap = (id: string) => {
    setOrder((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id].slice(0, control.slots.length),
    );
  };
  return (
    <div>
      {confirmLocked && lockReason && <LockNote text={lockReason} />}
      <div className="mb-2 font-mono text-xs text-cyan-300">Order: {order.join(" → ") || "—"}</div>
      <div className="grid grid-cols-3 gap-2">
        {control.options.map((o) => (
          <Button key={o.id} variant={order.includes(o.id) ? "default" : "ghost"} onClick={() => tap(o.id)}>
            {o.label}
          </Button>
        ))}
      </div>
      <Button className="mt-3 w-full" disabled={confirmLocked || order.length !== control.slots.length} onClick={() => onConfirm(order)}>
        OPEN SEQUENCE
      </Button>
    </div>
  );
}

function CodePad({
  digits,
  confirmLocked,
  lockReason,
  onConfirm,
}: {
  digits: number;
  value: string;
  confirmLocked: boolean;
  lockReason: string;
  onConfirm: (p: unknown) => void;
}) {
  const [v, setV] = useState("");
  const add = (d: string) => setV((cur) => (cur + d).slice(0, digits));
  return (
    <div>
      {confirmLocked && lockReason && <LockNote text={lockReason} />}
      <div className="mb-2 text-center font-display text-4xl tracking-[0.4em] text-white">{v.padEnd(digits, "_")}</div>
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLR", "0", "OK"].map((k) => (
          <Button
            key={k}
            variant={k === "OK" ? "cyan" : "ghost"}
            disabled={k === "OK" && confirmLocked}
            className="h-14"
            onClick={() => {
              if (k === "CLR") setV("");
              else if (k === "OK") onConfirm(v);
              else add(k);
            }}
          >
            {k}
          </Button>
        ))}
      </div>
    </div>
  );
}
