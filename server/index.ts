import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import { WebSocketServer, type WebSocket } from "ws";
import { MAX_PLAYERS } from "../src/shared/constants";
import { handlePlayEvent } from "./game/handle";
import { GameRoom, makeCode, makeHost, type RoomSink } from "./game/room";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT || 43221);
const hostname = "0.0.0.0";

const rooms = new Map<string, GameRoom>();
const sockets = new Map<string, WebSocket>();

function uniqueCode() {
  for (let i = 0; i < 20; i++) {
    const c = makeCode();
    if (!rooms.has(c)) return c;
  }
  return `MARS${Math.floor(100 + Math.random() * 900)}`;
}

function sinkFor(code: string): RoomSink {
  return {
    emitTo(socketId, event, payload) {
      const ws = sockets.get(socketId);
      if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({ event, data: payload }));
      }
    },
  };
  void code;
}

function send(ws: WebSocket, event: string, data: unknown) {
  if (ws.readyState === 1) ws.send(JSON.stringify({ event, data }));
}

async function main() {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare();

  const httpServer = createServer((req, res) => {
    const parsed = parse(req.url || "/", true);
    if (parsed.pathname === "/api/create" && req.method === "POST") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ code: uniqueCode() }));
      return;
    }
    handle(req, res, parsed);
  });

  const wss = new WebSocketServer({ noServer: true });
  httpServer.on("upgrade", (req, socket, head) => {
    const parsed = parse(req.url || "/", true);
    if (parsed.pathname !== "/ws") {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  });

  wss.on("connection", (ws, req) => {
    const parsed = parse(req.url || "/", true);
    const code = String(parsed.query.room || "").replace(/\s/g, "").toUpperCase();
    const socketId = crypto.randomUUID();
    sockets.set(socketId, ws);

    ws.on("message", (buf) => {
      let msg: { event?: string; data?: Record<string, unknown> };
      try {
        msg = JSON.parse(String(buf));
      } catch {
        return;
      }
      const event = msg.event || "";
      const data = msg.data || {};

      if (event === "create") {
        if (!code) {
          send(ws, "error_msg", "Missing mission code.");
          return;
        }
        if (rooms.has(code)) {
          send(ws, "error_msg", "Mission already exists.");
          return;
        }
        const host = makeHost(String(data.name || "Astronaut"), socketId);
        const room = new GameRoom(sinkFor(code), code, host);
        rooms.set(code, room);
        send(ws, "joined", { playerId: host.id, token: host.token, code });
        room.broadcast();
        return;
      }

      const room = rooms.get(code);
      if (event === "join") {
        if (!room) {
          send(ws, "error_msg", "Unknown mission code.");
          return;
        }
        if (data.token) {
          const p = room.reconnect(String(data.token), socketId);
          if (p) {
            send(ws, "joined", { playerId: p.id, token: p.token, code });
            room.broadcast();
            return;
          }
        }
        if (room.players.size >= MAX_PLAYERS) {
          send(ws, "error_msg", "Room full.");
          return;
        }
        const p = room.addPlayer(String(data.name || "Astronaut"), socketId);
        if (!p) {
          send(ws, "error_msg", "Cannot join this mission.");
          return;
        }
        send(ws, "joined", { playerId: p.id, token: p.token, code });
        room.broadcast();
        return;
      }

      if (!room) {
        send(ws, "error_msg", "Unknown mission code.");
        return;
      }
      const playerId = [...room.players.values()].find((p) => p.socketId === socketId)?.id;
      if (!playerId) return;
      handlePlayEvent(room, playerId, event, data, (e, payload) => send(ws, e, payload));
    });

    ws.on("close", () => {
      sockets.delete(socketId);
      const room = rooms.get(code);
      if (!room) return;
      room.dropSocket(socketId);
      room.broadcast();
      if ([...room.players.values()].every((p) => !p.connected) && room.phase === "lobby") {
        room.destroy();
        rooms.delete(code);
      }
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
