import type { ClientState, EndState } from "../../src/shared/protocol";

const MODEL = process.env.GROK_MODEL || "grok-3";

function key() {
  return process.env.XAI_API_KEY || process.env.GROK_API_KEY || process.env.xai_api_key || "";
}

async function chat(system: string, user: string, max = 120): Promise<string | null> {
  const k = key();
  if (!k) return null;
  try {
    const res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${k}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.85,
        max_tokens: max,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

export async function grokLine(kind: string, facts: string): Promise<string | null> {
  return chat(
    "You are Mission Control for a cooperative Mars habitat game. Write ONE short radio transmission (max 22 words). Urgent, cinematic, NASA-flavored. No questions. No chatbot. Never judge math answers. Never mention being an AI.",
    `Kind: ${kind}\nFacts: ${facts}`,
    70,
  );
}

export async function grokRecap(state: ClientState, end: EndState): Promise<EndState["recap"]> {
  const fallback = fallbackRecap(end);
  const text = await chat(
    "You write a tiny post-mission debrief for a co-op Mars game. Return exactly 4 lines prefixed BEST:, ERROR:, CLOSE:, TEAM:. Fun, short, specific. Never mention being an AI. Do not invent player names that were not provided.",
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
