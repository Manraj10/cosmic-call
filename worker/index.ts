import { DurableObject } from "cloudflare:workers";
import {
  applyClientEvent,
  dropSession,
  Mailbox,
  matchSync,
  readInParams,
  type RoomSlot,
} from "../server/game/net";

export interface Env {
  ROOMS: DurableObjectNamespace<GameRoomDO>;
  ASSETS: Fetcher;
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const sync = matchSync(url.pathname);
    if (sync) {
      return env.ROOMS.get(env.ROOMS.idFromName(sync.code)).fetch(request);
    }
    return env.ASSETS.fetch(request);
  },
};

export class GameRoomDO extends DurableObject<Env> {
  slot: RoomSlot = { mailbox: new Mailbox(), room: null, code: "" };

  async fetch(request: Request) {
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
    return json({ error: "bad op" }, 400);
  }
}
