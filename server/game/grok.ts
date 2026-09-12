import type { ClientState, EndState } from "../../src/shared/protocol";

const LINE_SYSTEM =
  "You are Mission Control for a cooperative Mars habitat game. Write ONE short radio transmission (max 22 words). Urgent, cinematic, NASA-flavored. No questions. No chatbot. Never judge math answers. Never mention being an AI.";

const RECAP_SYSTEM =
  "You write a tiny post-mission debrief for a co-op Mars game. Return exactly 4 lines prefixed BEST:, ERROR:, CLOSE:, TEAM:. Fun, short, specific. Never mention being an AI. Do not invent player names that were not provided.";

const WORKERS_AI_MODEL = "@cf/meta/llama-3.1-8b-instruct";
const GROK_MODEL = process.env.GROK_MODEL || "grok-3";
const GEMINI_MODELS = ["gemini-2.0-flash", "gemini-1.5-flash"];

export type WorkersAi = {
  run(
    model: string,
    inputs: {
      messages: { role: string; content: string }[];
      max_tokens?: number;
      temperature?: number;
    },
  ): Promise<unknown>;
};

export type RadioSecrets = {
  ai?: WorkersAi | null;
  cloudflareAccountId?: string;
  cloudflareApiToken?: string;
  xaiApiKey?: string;
  grokApiKey?: string;
  geminiApiKey?: string;
  googleApiKey?: string;
};

let radio: RadioSecrets = {};

export function bindRadio(next: RadioSecrets) {
  radio = { ...radio, ...next };
}

function env(name: string) {
  try {
    return (typeof process !== "undefined" && process.env && process.env[name]) || "";
  } catch {
    return "";
  }
}

function grokKey() {
  return radio.xaiApiKey || radio.grokApiKey || env("XAI_API_KEY") || env("GROK_API_KEY") || env("xai_api_key") || "";
}

function geminiKey() {
  return radio.geminiApiKey || radio.googleApiKey || env("GEMINI_API_KEY") || env("GOOGLE_API_KEY") || "";
}

function cfAccount() {
  return radio.cloudflareAccountId || env("CLOUDFLARE_ACCOUNT_ID") || "";
}

function cfToken() {
  return radio.cloudflareApiToken || env("CLOUDFLARE_API_TOKEN") || env("CLOUDFLARE_AUTH_TOKEN") || "";
}

function clipLine(text: string, maxWords = 24) {
  const clean = text
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return "";
  const words = clean.split(" ");
  if (words.length <= maxWords) return clean;
  return words.slice(0, maxWords).join(" ");
}

function readText(data: unknown): string | null {
  if (!data) return null;
  if (typeof data === "string") {
    const t = data.trim();
    return t || null;
  }
  if (typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  if (typeof row.response === "string" && row.response.trim()) return row.response.trim();
  if (row.result) {
    const nested = readText(row.result);
    if (nested) return nested;
  }
  const choices = row.choices;
  if (Array.isArray(choices) && choices[0] && typeof choices[0] === "object") {
    const msg = (choices[0] as { message?: { content?: unknown } }).message;
    if (typeof msg?.content === "string" && msg.content.trim()) return msg.content.trim();
  }
  const candidates = row.candidates;
  if (Array.isArray(candidates) && candidates[0] && typeof candidates[0] === "object") {
    const parts = (candidates[0] as { content?: { parts?: { text?: string }[] } }).content?.parts;
    const text = parts?.map((p) => p.text || "").join("").trim();
    if (text) return text;
  }
  return null;
}

async function workersBindingChat(system: string, user: string, max: number): Promise<string | null> {
  const ai = radio.ai;
  if (!ai) return null;
  try {
    const out = await ai.run(WORKERS_AI_MODEL, {
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.85,
      max_tokens: max,
    });
    return readText(out);
  } catch {
    return null;
  }
}

async function workersRestChat(system: string, user: string, max: number): Promise<string | null> {
  const account = cfAccount();
  const token = cfToken();
  if (!account || !token) return null;
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${WORKERS_AI_MODEL}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.85,
          max_tokens: max,
        }),
      },
    );
    if (!res.ok) return null;
    return readText(await res.json());
  } catch {
    return null;
  }
}

async function grokChat(system: string, user: string, max: number): Promise<string | null> {
  const k = grokKey();
  if (!k) return null;
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${k}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROK_MODEL,
        temperature: 0.85,
        max_tokens: max,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) return null;
    return readText(await res.json());
  } catch {
    return null;
  }
}

async function geminiChat(system: string, user: string, max: number): Promise<string | null> {
  const k = geminiKey();
  if (!k) return null;
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(k)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: system }] },
            contents: [{ role: "user", parts: [{ text: user }] }],
            generationConfig: { temperature: 0.85, maxOutputTokens: max },
          }),
        },
      );
      if (!res.ok) continue;
      const text = readText(await res.json());
      if (text) return text;
    } catch {
      /* try next model */
    }
  }
  return null;
}

async function chat(system: string, user: string, max = 120): Promise<string | null> {
  const providers = [workersBindingChat, workersRestChat, grokChat, geminiChat];
  for (const run of providers) {
    const text = await run(system, user, max);
    if (text) return text;
  }
  return null;
}

export async function grokLine(kind: string, facts: string): Promise<string | null> {
  const text = await chat(LINE_SYSTEM, `Kind: ${kind}\nFacts: ${facts}`, 70);
  const clipped = text ? clipLine(text) : "";
  return clipped || null;
}

export async function grokRecap(state: ClientState, end: EndState): Promise<EndState["recap"]> {
  const fallback = fallbackRecap(end);
  const text = await chat(
    RECAP_SYSTEM,
    JSON.stringify({
      outcome: end.outcome,
      score: end.score,
      stats: end.stats,
      chain: end.chain.slice(-8),
      players: end.players,
      closest: state.end?.recap.closestCall,
    }),
    220,
  );
  if (!text) return fallback;
  const grab = (prefix: string) => {
    const line = text.split("\n").find((l) => l.toUpperCase().startsWith(prefix));
    return line ? line.replace(/^[A-Z]+:\s*/i, "").trim() : "";
  };
  return {
    bestMove: grab("BEST") || fallback.bestMove,
    criticalError: grab("ERROR") || fallback.criticalError,
    closestCall: grab("CLOSE") || fallback.closestCall,
    teamwork: grab("TEAM") || fallback.teamwork,
  };
}

export function fallbackRecap(end: EndState): EndState["recap"] {
  if (end.outcome === "failure") {
    return {
      bestMove: "Someone kept a system alive longer than it deserved.",
      criticalError: end.primaryFailure
        ? `The chain ended in ${end.primaryFailure}.`
        : "The habitat outran the crew.",
      closestCall: `Oxygen bottomed at ${end.stats.lowestOxygen}% / battery ${end.stats.lowestPower}%.`,
      teamwork: end.stats.astronautsRevived
        ? `A revive happened. It was not enough.`
        : "The last thirty seconds needed more shouting, not more sliders.",
    };
  }
  return {
    bestMove:
      end.stats.optimalSolutions > 0
        ? `${end.stats.optimalSolutions} optimal solutions. That is why you still have a habitat.`
        : "You brute-forced survival. Ugly. Effective.",
    criticalError:
      end.stats.incorrectSolutions > 0
        ? `${end.stats.incorrectSolutions} sloppy settings still billed the battery.`
        : "Almost no wasted motion. Disgustingly professional.",
    closestCall: `Oxygen ${end.stats.lowestOxygen}% · battery ${end.stats.lowestPower}%.`,
    teamwork: end.stats.astronautsRevived
      ? `${end.stats.astronautsRevived} astronaut${end.stats.astronautsRevived > 1 ? "s" : ""} dragged back from 0%.`
      : end.outcome === "perfect"
        ? "Nobody died. Mission Control hates how rare that is."
        : "Not everyone made it. The ones who did had to listen.",
  };
}
