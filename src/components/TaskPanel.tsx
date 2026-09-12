"use client";

import { ITEM_LABELS, ROOM_LABELS } from "@/shared/constants";
import type { TaskControl, TaskView } from "@/shared/protocol";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";

export function TaskPanel({
  task,
  onUpdate: _onUpdate,
  onConfirm,
  onHold,
}: {
  task: TaskView;
  onUpdate: (payload: unknown) => void;
  onConfirm: (payload: unknown) => void;
  onHold: (holding: boolean) => void;
}) {
  const secs = Math.ceil(task.timerMs / 1000);
  const blocked = Boolean(task.waitingOn) || !task.youHaveControl;

  return (
    <div
      className={cn(
        "glass flex flex-col gap-3 rounded-xl p-3 sm:p-4",
        task.severity === "critical" && "border-red-500/50 crit-pulse",
        task.severity === "urgent" && "border-amber-400/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-display text-[10px] tracking-[0.35em] text-amber-300">
            {task.severity.toUpperCase()} TASK
          </div>
          <h3 className="font-display text-xl text-white sm:text-2xl">⚠ {task.title}</h3>
        </div>
        <div
          className={cn(
            "font-display text-3xl tabular-nums",
            secs <= 12 ? "text-red-400" : "text-cyan-200",
          )}
        >
          {secs}s
        </div>
      </div>

      <Block label="YOUR JOB" text={task.yourJob} accent />
      <Block label="ASK THE CREW" text={task.askCrew} />
      {!task.youHaveControl && (
        <div className="rounded-md border border-cyan-400/25 bg-cyan-400/10 px-3 py-2 text-sm text-cyan-50">
          You do not have this dial. Your job is intel — talk. Someone else confirms.
        </div>
      )}
      <div>
        <div className="font-mono text-[10px] tracking-[0.25em] text-cyan-300/70">YOUR INTEL (ONLY YOU SEE THIS)</div>
        <ul className="mt-1 space-y-1 text-sm text-cyan-50">
          {task.availableInfo.map((l) => (
            <li key={l} className="rounded bg-cyan-400/5 px-2 py-1">
              {l}
            </li>
          ))}
        </ul>
      </div>
      {task.youHaveControl && <Block label="THE FORMULA" text={task.howTo} />}
      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <Mini k="COST" v={task.cost} />
        <Mini k="RISK" v={task.risk} />
        <Mini k="BENEFIT" v={task.benefit} />
      </div>

      {task.requiredRoom && (
        <div className="text-xs text-amber-200/90">
          Presence: {ROOM_LABELS[task.requiredRoom]}
          {task.requiredItem ? ` · Item: ${ITEM_LABELS[task.requiredItem]}` : ""}
          {task.playersInRoom.length > 0 ? ` · There: ${task.playersInRoom.join(", ")}` : ""}
        </div>
      )}

      {task.waitingOn && (
        <div className="rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
          {task.waitingOn}
        </div>
      )}

      {task.youHaveControl && (
        <Control
          key={task.id}
          control={task.control}
          confirmLocked={blocked}
          lockReason={task.waitingOn || (!task.youHaveControl ? "Not your console." : "")}
          onConfirm={onConfirm}
          onHold={onHold}
        />
      )}
    </div>
  );
}

function Block({ label, text, accent }: { label: string; text: string; accent?: boolean }) {
  return (
    <div>
      <div className={`font-mono text-[10px] tracking-[0.25em] ${accent ? "text-cyan-300" : "text-orange-300/80"}`}>
        {label}
      </div>
      <p className={`text-sm leading-snug ${accent ? "text-cyan-50" : "text-white/90"}`}>{text}</p>
    </div>
  );
}

function Mini({ k, v }: { k: string; v: string }) {
  return (
    <div className="rounded-md bg-black/30 p-2">
      <div className="font-mono text-[9px] tracking-[0.2em] text-cyan-400/70">{k}</div>
      <div className="mt-1 text-[11px] leading-snug text-white/80">{v}</div>
    </div>
  );
}

function Control({
  control,
  confirmLocked,
  lockReason,
  onConfirm,
  onHold,
}: {
  control: TaskControl;
  confirmLocked: boolean;
  lockReason: string;
  onConfirm: (payload: unknown) => void;
  onHold: (holding: boolean) => void;
}) {
  if (control.kind === "stepper") {
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
        onGo={(v) => onConfirm(v)}
      />
    );
  }
  if (control.kind === "sliders") {
    return (
      <SliderBoard
        control={control}
        confirmLocked={confirmLocked}
        lockReason={lockReason}
        onGo={(v) => onConfirm(v)}
      />
    );
  }
  if (control.kind === "buttons") {
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
  }
  if (control.kind === "routing") {
    return (
      <Router
        nodes={control.nodes}
        selected={control.selected}
        confirmLocked={confirmLocked}
        lockReason={lockReason}
        onConfirm={onConfirm}
      />
    );
  }
  if (control.kind === "sequence") {
    return (
      <Sequencer control={control} confirmLocked={confirmLocked} lockReason={lockReason} onConfirm={onConfirm} />
    );
  }
  if (control.kind === "hold") {
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
  }
  if (control.kind === "dual_confirm") {
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
        onGo={(v) => onConfirm({ value: v })}
      />
    );
  }
  if (control.kind === "pattern") {
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
        onGo={(v) => onConfirm(v)}
      />
    );
  }
  if (control.kind === "code") {
    return (
      <CodePad
        digits={control.digits}
        value={control.value}
        confirmLocked={confirmLocked}
        lockReason={lockReason}
        onConfirm={onConfirm}
      />
    );
  }
  return null;
}

function LockNote({ text }: { text: string }) {
  return (
    <div className="mb-2 rounded-md border border-amber-400/40 bg-amber-400/15 px-3 py-2 text-sm text-amber-100">
      Dial is live. {text} then CONFIRM.
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
    setV((cur) => clampV(cur + d));
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
  useEffect(() => () => stopHold(), []);

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
          −
        </button>
        <div className="flex-1 text-center">
          <input
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={step}
            value={v}
            onChange={(e) => setV(clampV(Number(e.target.value)))}
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
        {confirmLabel}
      </Button>
    </div>
  );
}

function SliderBoard({
  control,
  confirmLocked,
  lockReason,
  onGo,
}: {
  control: Extract<TaskControl, { kind: "sliders" }>;
  confirmLocked: boolean;
  lockReason: string;
  onGo: (v: Record<string, number>) => void;
}) {
  const [vals, setVals] = useState(() => Object.fromEntries(control.sliders.map((s) => [s.id, s.value])));
  const sum = control.sliders.reduce((a, s) => a + (vals[s.id] ?? s.value), 0);
  return (
    <div className="space-y-2">
      {confirmLocked && lockReason && <LockNote text={lockReason} />}
      {control.sliders.map((s) => (
        <label key={s.id} className="block">
          <div className="mb-1 flex justify-between font-mono text-xs">
            <span>{s.label}</span>
            <span>
              {vals[s.id] ?? s.value} {control.unit}
            </span>
          </div>
          <input
            type="range"
            min={s.min}
            max={s.max}
            value={vals[s.id] ?? s.value}
            onChange={(e) => setVals((cur) => ({ ...cur, [s.id]: Number(e.target.value) }))}
            className="w-full"
          />
        </label>
      ))}
      <div className={cn("font-display text-lg", sum === control.available ? "text-cyan-300" : "text-amber-300")}>
        {control.totalLabel}: {sum} / {control.available} {control.unit}
      </div>
      <Button
        disabled={confirmLocked}
        className="w-full"
        onClick={() => onGo(Object.fromEntries(control.sliders.map((s) => [s.id, vals[s.id] ?? s.value])))}
      >
        CONFIRM ALLOCATION
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
