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
  onCreate: (name: string, monitor?: boolean) => void;
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
    <div className="mars-horizon stars relative flex min-h-dvh flex-col items-center justify-center px-4 py-8">
      <div className="scanlines absolute inset-0" />
      <div className="relative z-10 w-full max-w-lg text-center">
        <div className="font-mono text-[11px] tracking-[0.5em] text-orange-300/80">MARS HABITAT PROTOCOL</div>
        <h1 className="font-display mt-3 text-4xl leading-tight text-white sm:text-5xl">
          DON&apos;T KILL
          <br />
          THE ASTRONAUT
        </h1>
        <svg viewBox="0 0 320 90" className="landing-hab mx-auto mt-4 h-16 w-full max-w-sm">
          <ellipse cx="160" cy="78" rx="90" ry="10" fill="#0006" />
          <rect x="70" y="42" width="180" height="28" rx="6" fill="#1c2a38" stroke="#7ee7ff" />
          <rect x="130" y="18" width="60" height="28" rx="4" fill="#243444" stroke="#ffb020" />
          <circle cx="160" cy="32" r="8" fill="#7ee7ff" opacity="0.35" />
          <rect x="40" y="50" width="28" height="16" rx="3" fill="#4a3414" stroke="#ffb020" />
          <rect x="252" y="50" width="28" height="16" rx="3" fill="#14443a" stroke="#7ee7ff" />
        </svg>
        <p className="mt-4 text-sm text-cyan-100/70 sm:text-base">
          2–4 astronauts. Rescue in 7 minutes. Each person gets a job nobody else has — the habitat only lives if you talk.
          A computer can host the shared screen without taking a crew seat.
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
              <Button size="xl" className="w-full" onClick={() => onCreate("Habitat Screen", true)}>
                OPEN HABITAT MONITOR
              </Button>
              <p className="text-center text-xs leading-snug text-cyan-100/65">
                For a TV or laptop. Shows the map, timer, and room code. <span className="text-amber-200">Does not count as an astronaut.</span> Phones JOIN with the code — you still need 2–4 crew.
              </p>
              <Button size="lg" variant="cyan" className="w-full" onClick={() => onCreate(name || "Astronaut", false)}>
                CREATE &amp; BOARD AS ASTRONAUT
              </Button>
              <p className="text-center text-[11px] text-white/45">
                Play from this device. Occupies one of the 2–4 crew seats.
              </p>
              <Button size="lg" variant="ghost" className="w-full" onClick={() => setMode("join")}>
                JOIN MISSION
              </Button>
              <a
                href="/dont-kill-the-astronaut.zip"
                className="inline-flex h-12 w-full items-center justify-center rounded-md border border-amber-400/40 bg-amber-400/10 text-sm font-semibold tracking-wide text-amber-100 hover:bg-amber-400/20"
              >
                DOWNLOAD PROJECT ZIP
              </a>
              <p className="text-center text-[11px] text-white/45">
                Source only — unzip, then <span className="text-amber-200">git push</span> to your GitHub repo.{" "}
                <a href="/get" className="underline decoration-amber-400/50 underline-offset-2">
                  Full upload steps
                </a>
              </p>
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
        <p className="mt-6 font-mono text-[11px] text-white/40">
          TAP MODULES TO WALK. TALK OUT LOUD. THE HABITAT LISTENS TO PHYSICS, NOT FEELINGS.
        </p>
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
    <div className="mars-horizon stars flex min-h-dvh flex-col overflow-hidden">
      <div className="mx-auto grid min-h-0 w-full max-w-5xl flex-1 gap-4 overflow-y-auto px-4 py-4 pb-28 lg:grid-cols-[1.1fr_0.9fr] lg:pb-8 lg:pt-8">
        <div className="glass rounded-2xl p-4 sm:p-6">
          <div className="font-mono text-[11px] tracking-[0.4em] text-orange-300">
            {state.youAreMonitor ? "HABITAT MONITOR" : "MISSION LOBBY"}
          </div>
          <h2 className="font-display mt-2 text-2xl sm:text-3xl">ARES HABITAT</h2>
          {state.youAreMonitor ? (
            <p className="mt-2 text-sm text-cyan-100/80">
              This computer is the shared habitat screen. It is <span className="text-amber-200">not a crew seat</span>.
              Need 2–4 astronauts on phones. Then start.
            </p>
          ) : (
            <p className="mt-2 text-sm text-cyan-100/70">Need 2–4 astronauts. A TV/monitor host does not count as crew.</p>
          )}
          <div className="mt-4 rounded-xl border border-cyan-400/20 bg-black/30 p-4 text-center sm:mt-6 sm:p-5">
            <div className="font-mono text-[10px] tracking-[0.4em] text-cyan-300/70">ROOM CODE</div>
            <div className="font-display mt-2 text-4xl tracking-[0.25em] text-orange-300 sm:text-5xl">{state.roomCode}</div>
            {qr && (
              <img
                src={qr}
                alt="Join QR"
                className="mx-auto mt-3 hidden rounded-lg sm:block"
                width={180}
                height={180}
              />
            )}
            <div className="mt-2 font-mono text-[11px] text-white/40">Phones JOIN with this code</div>
          </div>
        </div>
        <div className="glass rounded-2xl p-4 sm:p-6">
          <div className="font-mono text-[11px] tracking-[0.4em] text-cyan-300">
            ASTRONAUTS · {state.playerCount} / 4
          </div>
          <ul className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
            {slots.map((i) => {
              const p = state.players[i];
              return (
                <li
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/25 px-3 py-2 sm:py-3"
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
          {state.youAreMonitor && (
            <div className="mt-4 rounded-md border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">
              Habitat screen online as {state.hostName}. Crew still need two people.
            </div>
          )}
          {state.roomFull && (
            <div className="mt-4 text-center font-display tracking-[0.3em] text-orange-300">ROOM FULL</div>
          )}
          <div className="mt-4 hidden lg:block">
            <StartControl state={state} onStart={onStart} />
          </div>
        </div>
      </div>
      <div className="sticky bottom-0 z-20 border-t border-cyan-400/20 bg-black/85 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <StartControl state={state} onStart={onStart} />
      </div>
    </div>
  );
}

function StartControl({ state, onStart }: { state: ClientState; onStart: () => void }) {
  if (state.youAreHost) {
    return (
      <>
        <Button size="xl" className="w-full" disabled={!state.canStart} onClick={onStart}>
          START MISSION
        </Button>
        {!state.canStart && (
          <p className="mt-2 text-center text-xs text-amber-200/80">
            Need at least two astronauts. The hosting computer does not count.
          </p>
        )}
      </>
    );
  }
  return <div className="text-center text-sm text-white/60">Waiting for {state.hostName} to start.</div>;
}
