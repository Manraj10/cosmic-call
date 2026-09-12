import { DurableObject } from "cloudflare:workers";
import { bindRadio, type WorkersAi } from "../server/game/grok";
import {
  applyClientEvent,
  dropSession,
  Mailbox,
  matchSync,
  readInParams,
  type RoomSlot,
} from "../server/game/net";
import { radioVoiceResponse } from "../server/game/voice";

export interface Env {
  ROOMS: DurableObjectNamespace<GameRoomDO>;
  ASSETS: Fetcher;
  AI: WorkersAi;
  ELEVENLABS_API_KEY?: string;
  ELEVENLABS_VOICE_ID?: string;
  XAI_API_KEY?: string;
  GROK_API_KEY?: string;
  GEMINI_API_KEY?: string;
  GOOGLE_API_KEY?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function waitMs(url: URL) {
  return Math.min(10000, Math.max(0, Number(url.searchParams.get("wait") || 8000)));
}

function wireRadio(env: Env) {
  bindRadio({
    ai: env.AI,
    xaiApiKey: env.XAI_API_KEY,
    grokApiKey: env.GROK_API_KEY,
    geminiApiKey: env.GEMINI_API_KEY,
    googleApiKey: env.GOOGLE_API_KEY,
    cloudflareAccountId: env.CLOUDFLARE_ACCOUNT_ID,
    cloudflareApiToken: env.CLOUDFLARE_API_TOKEN,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    wireRadio(env);
    const url = new URL(request.url);
    if (url.pathname === "/radio/voice") {
      return radioVoiceResponse(String(url.searchParams.get("t") || url.searchParams.get("text") || ""), {
        apiKey: env.ELEVENLABS_API_KEY,
        voiceId: env.ELEVENLABS_VOICE_ID,
      });
    }
    const sync = matchSync(url.pathname);
    if (sync) {
      if (sync.op === "voice") {
        return radioVoiceResponse(String(url.searchParams.get("t") || url.searchParams.get("text") || ""), {
          apiKey: env.ELEVENLABS_API_KEY,
          voiceId: env.ELEVENLABS_VOICE_ID,
        });
      }
      return env.ROOMS.get(env.ROOMS.idFromName(sync.code)).fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};

export class GameRoomDO extends DurableObject<Env> {
  slot: RoomSlot = { mailbox: new Mailbox(), room: null, code: "" };

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    wireRadio(env);
  }

  async fetch(request: Request) {
    wireRadio(this.env);
    const url = new URL(request.url);
    const sync = matchSync(url.pathname);
    if (!sync) return json({ error: "not found" }, 404);
    this.slot.code = sync.code;

    if (sync.op === "hello") {
      const sid = this.slot.mailbox.hello();
      return json({ sid });
    }
    if (sync.op === "poll") {
      const sid = String(url.searchParams.get("sid") || "");
      if (!this.slot.mailbox.has(sid)) return json({ error: "no session" }, 400);
      const messages = await this.slot.mailbox.wait(sid, waitMs(url));
      return json({ messages });
    }
    if (sync.op === "in") {
      const { sid, event, data } = readInParams(url);
      if (!this.slot.mailbox.has(sid)) return json({ error: "no session" }, 400);
      applyClientEvent(this.slot, sid, event, data);
      return json({ ok: true, messages: this.slot.mailbox.drain(sid) });
    }
    if (sync.op === "bye") {
      const sid = String(url.searchParams.get("sid") || "");
      dropSession(this.slot, sid);
      return json({ ok: true });
    }
    if (sync.op === "voice") {
      return radioVoiceResponse(String(url.searchParams.get("t") || url.searchParams.get("text") || ""), {
        apiKey: this.env.ELEVENLABS_API_KEY,
        voiceId: this.env.ELEVENLABS_VOICE_ID,
      });
    }
    return json({ error: "bad op" }, 400);
  }
}
