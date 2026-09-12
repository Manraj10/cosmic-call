"use client";

import { EndScreen } from "@/components/EndScreen";
import { GameHUD } from "@/components/GameHUD";
import { Landing, Lobby } from "@/components/Lobby";
import { Countdown, RoleIntro, Tutorial } from "@/components/RoleIntro";
import { habitatAudio } from "@/lib/audio";
import { getSocket } from "@/lib/socket";
import { haptic } from "@/lib/utils";
import type { RoomId } from "@/shared/constants";
import type { ClientState } from "@/shared/protocol";
import { useEffect, useRef, useState } from "react";

const KEY = "dka-session";

export function GameApp() {
  const [state, setState] = useState<ClientState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const audioOn = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const s = getSocket();
    const onState = (st: ClientState) => {
      setState(st);
      setError(null);
      if (st.voiceLine) habitatAudio.speak(st.voiceLine.text);
      if (st.phase === "playing") {
        const you = st.players.find((p) => p.id === st.you);
        habitatAudio.setIntensity(st.intensity, st.habitat.dustStorm, (you?.health ?? 100) < 35);
      }
    };
    s.on("state", onState);
    s.on("joined", (j: { playerId: string; token: string; code: string }) => {
      sessionStorage.setItem(KEY, JSON.stringify(j));
    });
    s.on("error_msg", (m: string) => {
      setError(m);
      if (/unknown mission/i.test(m)) sessionStorage.removeItem(KEY);
    });
    s.on("toast", (t: { text: string }) => {
      setToast(t.text);
      haptic([12, 30, 12]);
      habitatAudio.warn();
      setTimeout(() => setToast(null), 3200);
    });
    s.connect();

    try {
      const saved = sessionStorage.getItem(KEY);
      const q = new URLSearchParams(window.location.search).get("join");
      if (saved) {
        const j = JSON.parse(saved) as { playerId: string; token: string; code: string };
        if (j.code && j.token && (!q || q.toUpperCase() === j.code)) {
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
      s.off("state", onState);
      window.removeEventListener("pointerdown", arm);
    };
  }, []);

  const emit = (ev: string, body?: unknown) => {
    habitatAudio.click();
    getSocket().emit(ev, body);
  };

  if (!state) {
    return (
      <Landing
        error={error}
        onCreate={(name) => emit("create", { name })}
        onJoin={(name, code) => emit("join", { name, code, token: readToken() })}
      />
    );
  }

  return (
    <>
      {state.phase === "lobby" && <Lobby state={state} onStart={() => emit("start")} />}
      {state.phase === "role_intro" && <RoleIntro state={state} onReady={() => emit("ready")} />}
      {state.phase === "tutorial" && <Tutorial state={state} onPick={(optionId) => emit("tutorial", { optionId })} />}
      {state.phase === "countdown" && <Countdown state={state} />}
      {state.phase === "playing" && (
        <GameHUD
          state={state}
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
      {error && state.phase === "lobby" && (
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
