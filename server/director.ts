/**
 * Mission Control's writing hand.
 *
 * Everything in here is flavour. The engine grades the round, the bus decides
 * what is signed, and a model is never asked a question whose answer changes
 * the game — it is handed the numbers after the fact and asked to read them out
 * like a flight director. That split is deliberate: a model in the scoring path
 * is a model that can lose you a round on stage.
 *
 * Four providers, tried in order, and a written line at the end so the game is
 * identical with zero keys set. Every call is wrapped in a timeout because the
 * one thing worse than no radio line is a demo that waits for one.
 */

type Provider = { name: string; run: (prompt: string) => Promise<string | null> }

/** Nothing on this path is allowed to hold the round up. */
const BUDGET_MS = 2500

async function withTimeout<T>(p: Promise<T>): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      p,
      new Promise<null>((res) => {
        timer = setTimeout(() => res(null), BUDGET_MS)
      }),
    ])
  } catch {
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

function firstLine(text: string | null | undefined): string | null {
  if (!text) return null
  const line = text.trim().split('\n')[0]?.replace(/^["']|["']$/g, '').trim()
  return line && line.length > 3 ? line.slice(0, 240) : null
}

/** Anything that speaks the OpenAI chat-completions shape. */
function openAiish(
  name: string,
  url: string | undefined,
  key: string | undefined,
  model: string,
): Provider {
  return {
    name,
    run: async (prompt) => {
      if (!key || !url) return null
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          max_tokens: 90,
          messages: [
            { role: 'system', content: SYSTEM },
            { role: 'user', content: prompt },
          ],
        }),
      })
      if (!r.ok) return null
      const j = (await r.json()) as { choices?: { message?: { content?: string } }[] }
      return firstLine(j.choices?.[0]?.message?.content)
    },
  }
}

function gemini(): Provider {
  return {
    name: 'gemini',
    run: async (prompt) => {
      const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
      if (!key) return null
      const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM }] },
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 90, temperature: 0.9 },
          }),
        },
      )
      if (!r.ok) return null
      const j = (await r.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[]
      }
      return firstLine(j.candidates?.[0]?.content?.parts?.[0]?.text)
    },
  }
}

const SYSTEM = [
  'You are Mission Control for a Mars habitat, talking to a crew over a radio.',
  'One or two sentences, under 30 words. Flat, dry, professional. No exclamation marks.',
  'Never use the words: delve, leverage, seamless, robust, journey, testament.',
  'You are reading a report, not congratulating anyone. Do not offer advice.',
].join(' ')

function providers(): Provider[] {
  return [
    // IFM's K2 models, OpenAI-compatible.
    openAiish(
      'ifm-k2',
      process.env.IFM_BASE_URL || 'https://api.lfm.ifm.org/v1/chat/completions',
      process.env.IFM_API_KEY,
      process.env.IFM_MODEL || 'k2-chat',
    ),
    gemini(),
    openAiish(
      'grok',
      'https://api.x.ai/v1/chat/completions',
      process.env.XAI_API_KEY || process.env.GROK_API_KEY,
      process.env.XAI_MODEL || 'grok-3-mini',
    ),
  ]
}

export interface DebriefFacts {
  won: boolean
  delivered: number
  forged: number
  replays: number
  obeyedUnsealed: number
  stolenFrom: string | null
  timeToRevoke: number | null
  falseRevokes: number
}

/**
 * The after-action line on the debrief screen. Written from the incident report
 * the engine already produced, so the model is describing a result rather than
 * deciding one.
 */
export async function debriefLine(f: DebriefFacts): Promise<{ text: string; by: string }> {
  const prompt = [
    `Outcome: ${f.won ? 'habitat survived' : 'habitat lost'}.`,
    `${f.delivered} orders reached the operator. ${f.forged} were forged by an intruder on the comms bus.`,
    `${f.replays} were replays of real orders.`,
    `The operator executed ${f.obeyedUnsealed} orders that carried no valid signature.`,
    f.stolenFrom
      ? `The intruder stole ${f.stolenFrom}'s signing key; the crew ${
          f.timeToRevoke == null ? 'never rotated it' : `rotated it after ${f.timeToRevoke} seconds`
        }.`
      : 'No signing key was compromised.',
    f.falseRevokes ? `${f.falseRevokes} clean keys were rotated on a wrong guess.` : '',
    'Give the crew one flat sentence about how that went.',
  ]
    .filter(Boolean)
    .join(' ')

  for (const p of providers()) {
    const out = await withTimeout(p.run(prompt))
    if (out) return { text: out, by: p.name }
  }
  return { text: written(f), by: 'hab' }
}

/** With no keys set this is what everyone hears, and it is not a downgrade. */
function written(f: DebriefFacts): string {
  if (f.obeyedUnsealed > 0) {
    return `${f.obeyedUnsealed} unsigned order${f.obeyedUnsealed > 1 ? 's' : ''} moved that habitat. Whoever was on the glass was reading the picture and not the seal.`
  }
  if (f.stolenFrom && f.timeToRevoke == null) {
    return `Nothing unsigned got through, but ${f.stolenFrom.toUpperCase()}'s key was live on the bus at shutdown. Rotate it before the next run.`
  }
  if (f.stolenFrom) {
    return `Key compromise caught and rotated in ${f.timeToRevoke}s. That is the number that matters.`
  }
  return f.won
    ? 'Clean board. Every order that moved that habitat was one of yours.'
    : 'The bus stayed honest. You lost it on the air, not on the radio.'
}
