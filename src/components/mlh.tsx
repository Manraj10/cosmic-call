"use client";

const BADGE_SRC = "https://s3.amazonaws.com/logged-assets/trust-badge/2026/mlh-trust-badge-2026-white.svg";
const BADGE_HREF =
  "https://mlh.io/seasons/2026/events?utm_source=na-hackathon&utm_medium=TrustBadge&utm_campaign=2026-season&utm_content=white";

export function MlhTrustBadge() {
  return (
    <a
      id="mlh-trust-badge"
      href={BADGE_HREF}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "block",
        maxWidth: 100,
        minWidth: 60,
        position: "fixed",
        right: 50,
        top: 0,
        width: "10%",
        zIndex: 10000,
      }}
    >
      <img src={BADGE_SRC} alt="Major League Hacking 2026 Hackathon Season" style={{ width: "100%" }} />
    </a>
  );
}

export function SponsorCredits({ className = "" }: { className?: string }) {
  return (
    <div className={`text-center ${className}`}>
      <p className="font-mono text-[10px] tracking-[0.28em] text-cyan-300/70">MLH SPONSOR STACK — USED IN THIS MISSION</p>
      <p className="mt-2 text-xs leading-relaxed text-cyan-100/65">
        Habitat rooms live on <a className="text-cyan-200 underline decoration-cyan-400/40" href="https://mlh.link/cloudflare" target="_blank" rel="noreferrer">Cloudflare Workers</a> and Durable Objects.
        Mission Control copy is generated with <span className="text-cyan-100">Workers AI</span> (Llama), not a pasted slogan.
        Radio voice is <a className="text-cyan-200 underline decoration-cyan-400/40" href="https://mlh.link/elevenlabs" target="_blank" rel="noreferrer">ElevenLabs</a> text-to-speech, falling back to the browser if no key is set.
      </p>
      <p className="mt-2 font-mono text-[10px] text-white/40">
        An official{" "}
        <a className="text-white/70 underline decoration-white/30" href="https://mlh.io" target="_blank" rel="noreferrer">
          Major League Hacking
        </a>{" "}
        hack. No API keys required to play.
      </p>
    </div>
  );
}
