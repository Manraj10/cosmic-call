import { DurableObject } from "cloudflare:workers";
import { GameRoom, makeCode, makeHost, type RoomSink } from "../server/game/room";
import { handlePlayEvent } from "../server/game/handle";
import { MAX_PLAYERS } from "../src/shared/constants";

export interface Env {
  ROOMS: DurableObjectNamespace<GameRoomDO>;
  ASSETS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return Response.json({ ok: true, service: "ares-habitat" });
    }

    if (url.pathname === "/api/create" && request.method === "POST") {
      return Response.json({ code: makeCode() });
    }

    if (url.pathname === "/ws") {
      const upgrade = (request.headers.get("Upgrade") || "").toLowerCase();
      if (upgrade !== "websocket") {
        return new Response("Expected WebSocket", { status: 426 });
      }
      const room = (url.searchParams.get("room") || "").toUpperCase();
      if (!room) return new Response("room required", { status: 400 });
      return env.ROOMS.get(env.ROOMS.idFromName(room)).fetch(request);
    }

    return env.ASSETS.fetch(request);
  },
};

export class GameRoomDO extends DurableObject<Env> {
  room: GameRoom | null = null;
  sessions = new Map<WebSocket, string>();
  code = "";

  sink(): RoomSink {
    return {
      emitTo: (socketId, event, payload) => {
        for (const [ws, id] of this.sessions) {
          if (id === socketId && ws.readyState === 1) {
            ws.send(JSON.stringify({ event, data: payload }));
          }
        }
      },
    };
  }

  send(ws: WebSocket, event: string, data: unknown) {
    if (ws.readyState === 1) ws.send(JSON.stringify({ event, data }));
  }

  async fetch(request: Request) {
    const upgrade = (request.headers.get("Upgrade") || "").toLowerCase();
    if (upgrade !== "websocket") {
      return new Response("Expected WebSocket", { status: 426 });
    }
    const url = new URL(request.url);
    this.code = (url.searchParams.get("room") || this.code || "ROOM").toUpperCase();
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    server.accept();
    const socketId = crypto.randomUUID();
    this.sessions.set(server, socketId);

    server.addEventListener("message", (ev) => {
      this.onMessage(server, socketId, String(ev.data));
    });
    server.addEventListener("close", () => this.drop(server, socketId));
    server.addEventListener("error", () => this.drop(server, socketId));

    return new Response(null, { status: 101, webSocket: client });
  }

  drop(ws: WebSocket, socketId: string) {
    this.sessions.delete(ws);
    if (!this.room) return;
    this.room.dropSocket(socketId);
    this.room.broadcast();
    if ([...this.room.players.values()].every((p) => !p.connected) && this.room.phase === "lobby") {
      this.room.destroy();
      this.room = null;
    }
  }

  onMessage(ws: WebSocket, socketId: string, raw: string) {
    let msg: { event?: string; data?: Record<string, unknown> };
    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }
    const event = msg.event || "";
    const data = msg.data || {};
    const send = (e: string, payload: unknown) => this.send(ws, e, payload);

    if (event === "create") {
      if (this.room) {
        send("error_msg", "Mission already exists.");
        return;
      }
      const host = makeHost(String(data.name || "Astronaut"), socketId);
      this.room = new GameRoom(this.sink(), this.code, host);
      send("joined", { playerId: host.id, token: host.token, code: this.code });
      this.room.broadcast();
      return;
    }

    if (event === "join") {
      if (!this.room) {
        send("error_msg", "Unknown mission code.");
        return;
      }
      if (data.token) {
        const p = this.room.reconnect(String(data.token), socketId);
        if (p) {
          send("joined", { playerId: p.id, token: p.token, code: this.code });
          this.room.broadcast();
          return;
        }
      }
      if (this.room.players.size >= MAX_PLAYERS) {
        send("error_msg", "Room full.");
        return;
      }
      const p = this.room.addPlayer(String(data.name || "Astronaut"), socketId);
      if (!p) {
        send("error_msg", "Cannot join this mission.");
        return;
      }
      send("joined", { playerId: p.id, token: p.token, code: this.code });
      this.room.broadcast();
      return;
    }

    if (!this.room) {
      send("error_msg", "Unknown mission code.");
      return;
    }
    const playerId = [...this.room.players.values()].find((p) => p.socketId === socketId)?.id;
    if (!playerId) return;
    handlePlayEvent(this.room, playerId, event, data, send);
  }
}
