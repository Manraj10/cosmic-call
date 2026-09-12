import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { parse, type UrlWithParsedQuery } from "node:url";
import next from "next";
import {
  applyClientEvent,
  dropSession,
  Mailbox,
  matchSync,
  readInParams,
  type RoomSlot,
} from "./game/net";
import { makeCode } from "./game/room";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT || 43221);
const hostname = "0.0.0.0";

const hubs = new Map<string, RoomSlot>();

function hub(code: string): RoomSlot {
  let slot = hubs.get(code);
  if (!slot) {
    slot = { mailbox: new Mailbox(), room: null, code };
    hubs.set(code, slot);
  }
  return slot;
}

function json(res: import("node:http").ServerResponse, data: unknown, status = 200) {
  if (res.headersSent) return;
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}

async function handleReq(
  req: IncomingMessage,
  res: ServerResponse,
  handle: (req: IncomingMessage, res: ServerResponse, parsed: UrlWithParsedQuery) => Promise<void> | void,
) {
  const parsed = parse(req.url || "/", true);
  const path = parsed.pathname || "/";
  if (path === "/api/create" && req.method === "POST") {
    json(res, { code: makeCode() });
    return;
  }
  const sync = matchSync(path);
  if (sync) {
    const slot = hub(sync.code);
    const url = new URL(req.url || "/", "http://local");
    if (sync.op === "hello") {
      json(res, { sid: slot.mailbox.hello() });
      return;
    }
    if (sync.op === "poll") {
      const sid = String(url.searchParams.get("sid") || "");
      if (!slot.mailbox.has(sid)) {
        json(res, { error: "no session" }, 400);
        return;
      }
      const wait = Math.min(10000, Math.max(0, Number(url.searchParams.get("wait") || 8000)));
      const messages = await slot.mailbox.wait(sid, wait);
      json(res, { messages });
      return;
    }
    if (sync.op === "in") {
      const { sid, event, data } = readInParams(url);
      if (!slot.mailbox.has(sid)) {
        json(res, { error: "no session" }, 400);
        return;
      }
      applyClientEvent(slot, sid, event, data);
      json(res, { ok: true, messages: slot.mailbox.drain(sid) });
      return;
    }
    if (sync.op === "bye") {
      dropSession(slot, String(url.searchParams.get("sid") || ""));
      json(res, { ok: true });
      return;
    }
  }
  await handle(req, res, parsed);
}

async function main() {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare();

  const httpServer = createServer((req, res) => {
    void handleReq(req, res, handle).catch((err) => {
      console.error(err);
      json(res, { error: "radio" }, 500);
    });
  });

  httpServer.listen(port, hostname, () => {
    console.log(`DON'T KILL THE ASTRONAUT  →  http://127.0.0.1:${port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
