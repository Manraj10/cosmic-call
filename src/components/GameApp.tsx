"use client";

import { EndScreen } from "@/components/EndScreen";
import { GameHUD } from "@/components/GameHUD";
import { Landing, Lobby } from "@/components/Lobby";
import { HabitatMonitor } from "@/components/Monitor";
import { Countdown, RoleIntro, Tutorial } from "@/components/RoleIntro";
import { habitatAudio } from "@/lib/audio";
import { getSocket } from "@/lib/socket";
import { haptic } from "@/lib/utils";
import { makeRoomCode, type RoomId } from "@/shared/constants";
import type { ClientState } from "@/shared/protocol";
import { useEffect, useRef, useState } from "react";

const KEY = "dka-session";

export function GameApp() {
  const [state, setState] = useState<ClientState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [skew, setSkew] = useState(0);
  const [, setTick] = useState(0);
  const audioOn = useRef(false);
  const bound = useRef(false);
  const pendingName = useRef("Astronaut");
  const pendingMonitor = useRef(false);

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      setTick((n) => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const s = getSocket();
    if (bound.current) return;
    bound.current = true;

    const onState = (st: unknown) => {
      const next = st as ClientState;
      setState(next);
      setError(null);
      if (typeof next.serverNow === "number") setSkew(next.serverNow - Date.now());
      if (next.voiceLine) habitatAudio.speak(next.voiceLine.text);
      if (next.phase === "playing") {
        const you = next.players.find((p) => p.id === next.you);
        habitatAudio.setIntensity(next.intensity, next.habitat.dustStorm, (you?.health ?? 100) < 35);
      }
    };
    s.on("state", onState);
    s.on("joined", (j) => {
      sessionStorage.setItem(KEY, JSON.stringify(j));
    });
    s.on("error_msg", (m) => {
      const text = String(m);
      setError(text);
      if (/unknown mission/i.test(text)) sessionStorage.removeItem(KEY);
      if (/already exists/i.test(text)) {
        const code = makeRoomCode();
        s.connect(code);
        s.emit("create", { name: pendingName.current, monitor: pendingMonitor.current });
      }
    });
    s.on("toast", (t) => {
      const body = t as { text: string };
      setToast(body.text);
      haptic([12, 30, 12]);
      habitatAudio.warn();
      setTimeout(() => setToast(null), 3200);
    });

    try {
      const saved = sessionStorage.getItem(KEY);
      const q = new URLSearchParams(window.location.search).get("join");
      if (saved) {
        const j = JSON.parse(saved) as { playerId: string; token: string; code: string };
        if (j.code && j.token && (!q || q.toUpperCase() === j.code)) {
          s.connect(j.code);
          s.emit("join", { code: j.code, name: "Astronaut", token: j.token });
        }
      }
    } catch {
      /* ignore */
    }

    const arm = () => {
      if (audioOn.current) return;
      audioOn.current = true;
      habitatAudio.ensure();
    };
    window.addEventListener("pointerdown", arm, { once: true });

    return () => {
      window.removeEventListener("pointerdown", arm);
    };
  }, []);

  const emit = (ev: string, body?: unknown) => {
    habitatAudio.click();
    getSocket().emit(ev, body);
  };

  const create = (name: string, monitor = false) => {
    habitatAudio.click();
    setError(null);
    pendingName.current = name;
    pendingMonitor.current = monitor;
    const code = makeRoomCode();
    const s = getSocket();
    s.connect(code);
    s.emit("create", { name, monitor });
  };

  const join = (name: string, code: string) => {
    habitatAudio.click();
    const s = getSocket();
    s.connect(code);
    s.emit("join", { name, code, token: readToken() });
  };

  if (!state) {
    return <Landing error={error} onCreate={create} onJoin={join} />;
  }

  return (
    <>
      {state.phase === "lobby" && <Lobby state={state} onStart={() => emit("start")} />}
      {state.youAreMonitor && state.phase !== "lobby" && state.phase !== "ended" && (
        <HabitatMonitor state={state} clockSkew={skew} />
      )}
      {!state.youAreMonitor && state.phase === "role_intro" && (
        <RoleIntro state={state} onReady={() => emit("ready")} />
      )}
      {!state.youAreMonitor && state.phase === "tutorial" && (
        <Tutorial state={state} onPick={(optionId) => emit("tutorial", { optionId })} />
      )}
      {!state.youAreMonitor && state.phase === "countdown" && <Countdown state={state} />}
      {!state.youAreMonitor && state.phase === "playing" && (
        <GameHUD
          state={state}
          clockSkew={skew}
          onMove={(room: RoomId) => emit("move", { room })}
          onPickup={(itemId) => emit("pickup", { itemId })}
          onDrop={() => emit("drop")}
          onUpdate={(taskId, payload) => emit("task_update", { taskId, payload })}
          onConfirm={(taskId, payload) => emit("task_confirm", { taskId, payload })}
          onHold={(taskId, holding) => emit("hold", { taskId, holding })}
          onRevive={(targetId) => emit("revive", { targetId })}
        />
      )}
      {state.phase === "ended" && <EndScreen state={state} onAgain={() => emit("play_again")} />}
      {toast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-amber-400/40 bg-black/80 px-4 py-2 text-sm text-amber-100 shadow-xl">
          {toast}
        </div>
      )}
      {error && (state.phase === "lobby" || !state) && (
        <div className="fixed top-4 left-1/2 z-50 -translate-x-1/2 rounded bg-red-600 px-3 py-2 text-sm">{error}</div>
      )}
    </>
  );
}

function readToken() {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return undefined;
    return (JSON.parse(raw) as { token?: string }).token;
  } catch {
    return undefined;
  }
}
