"use client";

import { ITEM_LABELS, ROOM_LABELS } from "@/shared/constants";
import type { TaskControl, TaskView } from "@/shared/protocol";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

export function TaskPanel({
  task,
  onUpdate,
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

      <Block label="PROBLEM" text={task.problem} />
      <Block label="TARGET" text={task.target} />
      <div>
        <div className="font-mono text-[10px] tracking-[0.25em] text-cyan-300/70">AVAILABLE INFORMATION</div>
        <ul className="mt-1 space-y-1 text-sm text-cyan-50">
          {task.availableInfo.map((l) => (
            <li key={l} className="rounded bg-cyan-400/5 px-2 py-1">
              {l}
            </li>
          ))}
        </ul>
      </div>
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

      <Control
        control={task.control}
        disabled={blocked}
        onUpdate={onUpdate}
        onConfirm={onConfirm}
        onHold={onHold}
      />
    </div>
  );
}

function Block({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <div className="font-mono text-[10px] tracking-[0.25em] text-orange-300/80">{label}</div>
      <p className="text-sm leading-snug text-white/90">{text}</p>
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
  disabled,
  onUpdate,
  onConfirm,
  onHold,
}: {
  control: TaskControl;
  disabled: boolean;
  onUpdate: (payload: unknown) => void;
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
        disabled={disabled}
        onLive={(v) => onUpdate(v)}
        onGo={(v) => onConfirm(v)}
      />
    );
  }
  if (control.kind === "sliders") {
    const sum = control.sliders.reduce((a, s) => a + s.value, 0);
    return (
      <div className="space-y-2">
        {control.sliders.map((s) => (
          <label key={s.id} className="block">
            <div className="mb-1 flex justify-between font-mono text-xs">
              <span>{s.label}</span>
              <span>
                {s.value} {control.unit}
              </span>
            </div>
            <input
              type="range"
              min={s.min}
              max={s.max}
              value={s.value}
              disabled={disabled}
              onChange={(e) =>
                onUpdate({
                  ...Object.fromEntries(control.sliders.map((x) => [x.id, x.value])),
                  [s.id]: Number(e.target.value),
                })
              }
              className="w-full"
            />
          </label>
        ))}
        <div className={cn("font-display text-lg", sum === control.available ? "text-cyan-300" : "text-amber-300")}>
          {control.totalLabel}: {sum} / {control.available} {control.unit}
        </div>
        <Button disabled={disabled} className="w-full" onClick={() => onConfirm(
          Object.fromEntries(control.sliders.map((x) => [x.id, x.value])),
        )}>
          CONFIRM ALLOCATION
        </Button>
      </div>
    );
  }
  if (control.kind === "buttons") {
    return (
      <div className="grid gap-2">
        {control.options.map((o) => (
          <Button key={o.id} disabled={disabled} variant="ghost" className="h-14 w-full" onClick={() => onConfirm(o.id)}>
            {o.label}
          </Button>
        ))}
      </div>
    );
  }
  if (control.kind === "routing") {
    return (
      <Router nodes={control.nodes} selected={control.selected} disabled={disabled} onUpdate={onUpdate} onConfirm={onConfirm} />
    );
  }
  if (control.kind === "sequence") {
    return (
      <Sequencer control={control} disabled={disabled} onUpdate={onUpdate} onConfirm={onConfirm} />
    );
  }
  if (control.kind === "hold") {
    return (
      <button
        disabled={disabled}
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
        disabled={disabled}
        confirmLabel="CONFIRM"
        onLive={(v) => onUpdate({ value: v })}
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
        disabled={disabled}
        onLive={(v) => onUpdate(v)}
        onGo={(v) => onConfirm(v)}
      />
    );
  }
  if (control.kind === "code") {
    return (
      <CodePad digits={control.digits} value={control.value} disabled={disabled} onUpdate={onUpdate} onConfirm={onConfirm} />
    );
  }
  return null;
}

function Stepper({
  label,
  unit,
  min,
  max,
  step,
  value,
  disabled,
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
  disabled: boolean;
  confirmLabel?: string;
  onLive: (v: number) => void;
  onGo: (v: number) => void;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const bump = (d: number) => {
    const n = Math.max(min, Math.min(max, Math.round((v + d) / step) * step));
    const rounded = Number(n.toFixed(step < 1 ? 1 : 0));
    setV(rounded);
    onLive(rounded);
  };
  return (
    <div className="space-y-3">
      <div className="font-mono text-xs tracking-widest text-cyan-200/70">{label}</div>
      <div className="flex items-center gap-3">
        <Button variant="ghost" className="h-16 w-16 text-3xl" disabled={disabled} onClick={() => bump(-step)}>
          −
        </Button>
        <div className="flex-1 text-center">
          <div className="font-display text-4xl text-white tabular-nums">
            {v}
            <span className="ml-2 text-base text-cyan-300">{unit}</span>
          </div>
        </div>
        <Button variant="ghost" className="h-16 w-16 text-3xl" disabled={disabled} onClick={() => bump(step)}>
          +
        </Button>
      </div>
      <Button className="h-16 w-full text-lg" disabled={disabled} onClick={() => onGo(v)}>
        {confirmLabel}
      </Button>
    </div>
  );
}

function Router({
  nodes,
  selected,
  disabled,
  onUpdate,
  onConfirm,
}: {
  nodes: { id: string; label: string }[];
  selected: string[];
  disabled: boolean;
  onUpdate: (p: unknown) => void;
  onConfirm: (p: unknown) => void;
}) {
  const [sel, setSel] = useState(selected);
  useEffect(() => setSel(selected), [selected]);
  const tap = (id: string) => {
    const next = sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id];
    setSel(next);
    onUpdate(next);
  };
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {nodes.map((n) => (
          <button
            key={n.id}
            disabled={disabled}
            onClick={() => tap(n.id)}
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
      <Button className="w-full" disabled={disabled || sel.length < 2} onClick={() => onConfirm(sel)}>
        COMMIT ROUTE
      </Button>
    </div>
  );
}

function Sequencer({
  control,
  disabled,
  onUpdate,
  onConfirm,
}: {
  control: Extract<TaskControl, { kind: "sequence" }>;
  disabled: boolean;
  onUpdate: (p: unknown) => void;
  onConfirm: (p: unknown) => void;
}) {
  const [order, setOrder] = useState<string[]>([]);
  const tap = (id: string) => {
    const next = order.includes(id) ? order.filter((x) => x !== id) : [...order, id].slice(0, control.slots.length);
    setOrder(next);
    onUpdate(next);
  };
  return (
    <div>
      <div className="mb-2 font-mono text-xs text-cyan-300">Order: {order.join(" → ") || "—"}</div>
      <div className="grid grid-cols-3 gap-2">
        {control.options.map((o) => (
          <Button key={o.id} variant={order.includes(o.id) ? "default" : "ghost"} disabled={disabled} onClick={() => tap(o.id)}>
            {o.label}
          </Button>
        ))}
      </div>
      <Button className="mt-3 w-full" disabled={disabled || order.length !== control.slots.length} onClick={() => onConfirm(order)}>
        OPEN SEQUENCE
      </Button>
    </div>
  );
}

function CodePad({
  digits,
  value,
  disabled,
  onUpdate,
  onConfirm,
}: {
  digits: number;
  value: string;
  disabled: boolean;
  onUpdate: (p: unknown) => void;
  onConfirm: (p: unknown) => void;
}) {
  const [v, setV] = useState(value);
  const add = (d: string) => {
    const n = (v + d).slice(0, digits);
    setV(n);
    onUpdate(n);
  };
  return (
    <div>
      <div className="mb-2 text-center font-display text-4xl tracking-[0.4em] text-white">{v.padEnd(digits, "_")}</div>
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLR", "0", "OK"].map((k) => (
          <Button
            key={k}
            variant={k === "OK" ? "cyan" : "ghost"}
            disabled={disabled}
            className="h-14"
            onClick={() => {
              if (k === "CLR") {
                setV("");
                onUpdate("");
              } else if (k === "OK") onConfirm(v);
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
