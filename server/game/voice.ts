const DEFAULT_VOICE = "JBFqnCBsd6RMkjVDRZzb";
const MAX_CHARS = 220;
const CACHE_CAP = 24;

export type VoiceSecrets = {
  apiKey?: string;
  voiceId?: string;
};

const cache = new Map<string, Uint8Array>();

function env(name: string) {
  try {
    return (typeof process !== "undefined" && process.env && process.env[name]) || "";
  } catch {
    return "";
  }
}

function clipText(raw: string) {
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_CHARS);
}

export function voiceKey(secrets: VoiceSecrets = {}) {
  return secrets.apiKey || env("ELEVENLABS_API_KEY") || "";
}

export function voiceId(secrets: VoiceSecrets = {}) {
  return secrets.voiceId || env("ELEVENLABS_VOICE_ID") || DEFAULT_VOICE;
}

export async function synthesizeMpeg(raw: string, secrets: VoiceSecrets = {}): Promise<Uint8Array | null> {
  const text = clipText(raw);
  if (!text) return null;
  const key = voiceKey(secrets);
  if (!key) return null;
  const cached = cache.get(text);
  if (cached) return cached;
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId(secrets))}`, {
      method: "POST",
      headers: {
        "xi-api-key": key,
        accept: "audio/mpeg",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_turbo_v2_5",
        voice_settings: {
          stability: 0.52,
          similarity_boost: 0.72,
          style: 0.12,
        },
      }),
    });
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (!buf.byteLength) return null;
    cache.set(text, buf);
    if (cache.size > CACHE_CAP) {
      const first = cache.keys().next().value;
      if (first) cache.delete(first);
    }
    return buf;
  } catch {
    return null;
  }
}

export async function radioVoiceResponse(text: string, secrets: VoiceSecrets = {}): Promise<Response> {
  const clip = clipText(text);
  if (!clip) return new Response("missing text", { status: 400 });
  if (!voiceKey(secrets)) return new Response("no voice", { status: 404 });
  const mpeg = await synthesizeMpeg(clip, secrets);
  if (!mpeg) return new Response("voice failed", { status: 404 });
  return new Response(mpeg, {
    status: 200,
    headers: {
      "content-type": "audio/mpeg",
      "cache-control": "public, max-age=120",
      "content-length": String(mpeg.byteLength),
    },
  });
}
