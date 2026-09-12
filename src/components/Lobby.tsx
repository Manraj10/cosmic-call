"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ClientState } from "@/shared/protocol";
import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function Landing({
  error,
  onCreate,
  onJoin,
}: {
  error: string | null;
  onCreate: (name: string) => void;
  onJoin: (name: string, code: string) => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [mode, setMode] = useState<"home" | "join">("home");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const j = q.get("join");
    if (j) {
      setCode(j.toUpperCase());
      setMode("join");
    }
  }, []);

  return (
    <div className="mars-horizon stars relative flex min-h-dvh flex-col items-center justify-center px-4">
      <div className="scanlines absolute inset-0" />
      <div className="relative z-10 w-full max-w-lg text-center">
        <div className="font-mono text-[11px] tracking-[0.5em] text-orange-300/80">MARS HABITAT PROTOCOL</div>
        <h1 className="font-display mt-3 text-4xl leading-tight text-white sm:text-5xl">
          DON&apos;T KILL
          <br />
          THE ASTRONAUT
        </h1>
        <p className="mt-4 text-sm text-cyan-100/70 sm:text-base">
          A 2–4 player co-op Mars survival game. Rescue in 7 minutes. Nobody has the whole picture.
        </p>
        <div className="glass mt-8 space-y-4 rounded-2xl p-5 text-left">
          <label className="block">
            <div className="mb-1 font-mono text-[10px] tracking-[0.3em] text-cyan-300/70">CALLSIGN</div>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="SHAINA" maxLength={18} />
          </label>
          {mode === "join" && (
            <label className="block">
              <div className="mb-1 font-mono text-[10px] tracking-[0.3em] text-cyan-300/70">MISSION CODE</div>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="MARS42"
                maxLength={8}
                className="tracking-[0.4em]"
              />
            </label>
          )}
          {error && <div className="rounded bg-red-500/20 px-3 py-2 text-sm text-red-200">{error}</div>}
          {mode === "home" ? (
            <div className="grid gap-3">
              <Button size="xl" className="w-full" onClick={() => onCreate(name || "Astronaut")}>
                CREATE MISSION
              </Button>
              <Button size="lg" variant="ghost" className="w-full" onClick={() => setMode("join")}>
                JOIN MISSION
              </Button>
            </div>
          ) : (
            <div className="grid gap-3">
              <Button size="xl" variant="cyan" className="w-full" onClick={() => onJoin(name || "Astronaut", code)}>
                BOARD HABITAT
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setMode("home")}>
                BACK
              </Button>
            </div>
          )}
        </div>
        <p className="mt-6 font-mono text-[11px] text-white/40">TALK OUT LOUD. THE HABITAT IS LISTENING TO THE PHYSICS, NOT YOUR FEELINGS.</p>
      </div>
    </div>
  );
}

export function Lobby({
  state,
  onStart,
}: {
  state: ClientState;
  onStart: () => void;
}) {
  const [qr, setQr] = useState<string>("");
  useEffect(() => {
    const url = `${window.location.origin}?join=${state.roomCode}`;
    QRCode.toDataURL(url, { margin: 1, width: 220, color: { dark: "#081018", light: "#d6f7ff" } }).then(setQr);
  }, [state.roomCode]);

  const slots = [0, 1, 2, 3];
  return (
    <div className="mars-horizon stars min-h-dvh px-4 py-8">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="glass rounded-2xl p-6">
          <div className="font-mono text-[11px] tracking-[0.4em] text-orange-300">MISSION LOBBY</div>
          <h2 className="font-display mt-2 text-3xl">ARES HABITAT</h2>
          <p className="mt-2 text-sm text-cyan-100/70">Need 2–4 astronauts. One person cannot run this habitat.</p>
          <div className="mt-6 rounded-xl border border-cyan-400/20 bg-black/30 p-5 text-center">
            <div className="font-mono text-[10px] tracking-[0.4em] text-cyan-300/70">ROOM CODE</div>
            <div className="font-display mt-2 text-5xl tracking-[0.25em] text-orange-300">{state.roomCode}</div>
            {qr && <img src={qr} alt="Join QR" className="mx-auto mt-4 rounded-lg" width={180} height={180} />}
            <div className="mt-2 font-mono text-[11px] text-white/40">Scan to board from a phone</div>
          </div>
        </div>
        <div className="glass rounded-2xl p-6">
          <div className="font-mono text-[11px] tracking-[0.4em] text-cyan-300">CREW</div>
          <ul className="mt-4 space-y-3">
            {slots.map((i) => {
              const p = state.players[i];
              return (
                <li
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/25 px-3 py-3"
                >
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full font-display"
                    style={{ background: p?.color || "#123", color: "#041018" }}
                  >
                    {p ? String(i + 1).padStart(2, "0") : "○"}
                  </span>
                  <div className="flex-1">
                    <div className="font-medium">{p ? p.name : "Waiting…"}</div>
                    <div className="font-mono text-[10px] text-white/40">
                      {p ? (p.connected ? "LINKED" : "SIGNAL LOST") : "EMPTY SUIT"}
                    </div>
                  </div>
                  {p && <span className="text-cyan-300">✓</span>}
                </li>
              );
            })}
          </ul>
          {state.roomFull && (
            <div className="mt-4 text-center font-display tracking-[0.3em] text-orange-300">ROOM FULL</div>
          )}
          {state.youAreHost ? (
            <Button size="xl" className="mt-6 w-full" disabled={!state.canStart} onClick={onStart}>
              START MISSION
            </Button>
          ) : (
            <div className="mt-6 text-center text-sm text-white/60">Waiting for {state.hostName} to start.</div>
          )}
          {!state.canStart && (
            <p className="mt-3 text-center text-xs text-amber-200/80">A mission cannot start with only one player.</p>
          )}
        </div>
      </div>
    </div>
  );
}
