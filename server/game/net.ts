import { MAX_PLAYERS } from "../../src/shared/constants";
import { handlePlayEvent } from "./handle";
import { GameRoom, makeHost, type RoomSink } from "./room";

export type Wire = { event: string; data: unknown };

export class Mailbox {
  private q = new Map<string, Wire[]>();
  private waiters = new Map<string, () => void>();

  hello() {
    const sid = crypto.randomUUID();
    this.q.set(sid, []);
    return sid;
  }

  push(sid: string, event: string, data: unknown) {
    const list = this.q.get(sid);
    if (!list) return;
    list.push({ event, data });
    const wake = this.waiters.get(sid);
    if (wake) {
      this.waiters.delete(sid);
      wake();
    }
  }

  drain(sid: string): Wire[] {
    const list = this.q.get(sid);
    if (!list) return [];
    const out = list.slice();
    this.q.set(sid, []);
    return out;
  }

  has(sid: string) {
    return this.q.has(sid);
  }

  drop(sid: string) {
    const wake = this.waiters.get(sid);
    this.waiters.delete(sid);
    this.q.delete(sid);
    if (wake) wake();
  }

  wait(sid: string, ms: number): Promise<Wire[]> {
    const cap = Math.min(12000, Math.max(0, ms));
    const ready = this.drain(sid);
    if (ready.length) return Promise.resolve(ready);
    if (!this.q.has(sid)) return Promise.resolve([]);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        if (this.waiters.get(sid) === wake) this.waiters.delete(sid);
        resolve(this.drain(sid));
      }, cap);
      const wake = () => {
        clearTimeout(timer);
        if (this.waiters.get(sid) === wake) this.waiters.delete(sid);
        resolve(this.drain(sid));
      };
      const prev = this.waiters.get(sid);
      this.waiters.set(sid, wake);
      if (prev) prev();
    });
  }

  sink(): RoomSink {
    return {
      emitTo: (socketId, event, payload) => this.push(socketId, event, payload),
    };
  }
}

export interface RoomSlot {
  mailbox: Mailbox;
  room: GameRoom | null;
  code: string;
}

export function applyClientEvent(slot: RoomSlot, sid: string, event: string, data: Record<string, unknown>) {
  const send = (e: string, payload: unknown) => slot.mailbox.push(sid, e, payload);

  if (event === "create") {
    if (slot.room) {
      send("error_msg", "Mission already exists.");
      return;
    }
    const host = makeHost(String(data.name || (data.monitor ? "Habitat Screen" : "Astronaut")), sid, data.monitor ? "monitor" : "astronaut");
    slot.room = new GameRoom(slot.mailbox.sink(), slot.code, host);
    send("joined", { playerId: host.id, token: host.token, code: slot.code });
    slot.room.broadcast();
    return;
  }

  if (event === "join") {
    if (!slot.room) {
      send("error_msg", "Unknown mission code.");
      return;
    }
    if (data.token) {
      const p = slot.room.reconnect(String(data.token), sid);
      if (p) {
        send("joined", { playerId: p.id, token: p.token, code: slot.code });
        slot.room.broadcast();
        return;
      }
    }
    if (slot.room.astronautCount() >= MAX_PLAYERS) {
      send("error_msg", "Room full.");
      return;
    }
    const p = slot.room.addPlayer(String(data.name || "Astronaut"), sid);
    if (!p) {
      send("error_msg", "Cannot join this mission.");
      return;
    }
    send("joined", { playerId: p.id, token: p.token, code: slot.code });
    slot.room.broadcast();
    return;
  }

  if (!slot.room) {
    send("error_msg", "Unknown mission code.");
    return;
  }
  const playerId = [...slot.room.players.values()].find((p) => p.socketId === sid)?.id;
  if (!playerId) return;
  handlePlayEvent(slot.room, playerId, event, data, send);
}

export function dropSession(slot: RoomSlot, sid: string) {
  slot.mailbox.drop(sid);
  if (!slot.room) return;
  slot.room.dropSocket(sid);
  slot.room.broadcast();
  if ([...slot.room.players.values()].every((p) => !p.connected) && slot.room.phase === "lobby") {
    slot.room.destroy();
    slot.room = null;
  }
}

const SYNC = /^\/sync\/([^/]+)\/(hello|poll|in|bye)$/;

export function matchSync(pathname: string) {
  const m = pathname.match(SYNC);
  if (!m) return null;
  return { code: decodeURIComponent(m[1]!).toUpperCase(), op: m[2] as "hello" | "poll" | "in" | "bye" };
}

export function readInParams(url: URL) {
  const sid = String(url.searchParams.get("sid") || "");
  const event = String(url.searchParams.get("e") || "");
  let data: Record<string, unknown> = {};
  const raw = url.searchParams.get("d");
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        data = parsed as Record<string, unknown>;
      } else {
        data = { value: parsed };
      }
    } catch {
      data = {};
    }
  }
  return { sid, event, data };
}
