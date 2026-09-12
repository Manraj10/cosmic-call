import type { Server, Socket } from "socket.io";
import type { RoomId } from "../src/shared/constants";
import { MAX_PLAYERS } from "../src/shared/constants";
import { GameRoom, makeCode } from "./game/room";
import { randomBytes, randomUUID } from "node:crypto";
import { SUIT_COLORS } from "../src/shared/constants";

const rooms = new Map<string, GameRoom>();

function uniqueCode() {
  for (let i = 0; i < 20; i++) {
    const c = makeCode();
    if (!rooms.has(c)) return c;
  }
  return `MARS${Math.floor(100 + Math.random() * 900)}`;
}

export function attachGame(io: Server) {
  io.on("connection", (socket: Socket) => {
    socket.on("create", (body: { name?: string }) => {
      const name = (body?.name || "Astronaut").trim().slice(0, 18) || "Astronaut";
      const code = uniqueCode();
      const id = randomUUID();
      const host = {
        id,
        token: randomBytes(12).toString("hex"),
        name,
        color: SUIT_COLORS[0]!,
        avatar: 0,
        slot: 0,
        socketId: socket.id,
        roleId: null,
        ready: false,
        tutorialDone: false,
        connected: true,
        astro: {
          id,
          health: 100,
          suitOxygen: 100,
          radiation: 0,
          location: "crew" as const,
          movingTo: null,
          moveStartsAt: 0,
          moveEndsAt: 0,
          inventory: null,
          incapacitated: false,
        },
      };
      const room = new GameRoom(io, code, host);
      rooms.set(code, room);
      socket.data.playerId = id;
      socket.data.code = code;
      socket.join(code);
      socket.emit("joined", { playerId: id, token: host.token, code });
      room.broadcast();
    });

    socket.on("join", (body: { code?: string; name?: string; token?: string }) => {
      const code = (body?.code || "").replace(/\s/g, "").toUpperCase();
      const room = rooms.get(code);
      if (!room) {
        socket.emit("error_msg", "Unknown mission code.");
        return;
      }
      if (body?.token) {
        const p = room.reconnect(body.token, socket.id);
        if (p) {
          socket.data.playerId = p.id;
          socket.data.code = code;
          socket.join(code);
          socket.emit("joined", { playerId: p.id, token: p.token, code });
          room.broadcast();
          return;
        }
      }
      if (room.players.size >= MAX_PLAYERS) {
        socket.emit("error_msg", "Room full.");
        return;
      }
      const name = (body?.name || "Astronaut").trim().slice(0, 18) || "Astronaut";
      const p = room.addPlayer(name, socket.id);
      if (!p) {
        socket.emit("error_msg", "Cannot join this mission.");
        return;
      }
      socket.data.playerId = p.id;
      socket.data.code = code;
      socket.join(code);
      socket.emit("joined", { playerId: p.id, token: p.token, code });
      room.broadcast();
    });

    socket.on("start", () => {
      const room = rooms.get(socket.data.code);
      if (!room) return;
      const err = room.start(socket.data.playerId);
      if (err) socket.emit("error_msg", err);
    });
    socket.on("ready", () => rooms.get(socket.data.code)?.ready(socket.data.playerId));
    socket.on("tutorial", (body: { optionId: string }) =>
      rooms.get(socket.data.code)?.tutorial(socket.data.playerId, body?.optionId),
    );
    socket.on("move", (body: { room: RoomId }) =>
      rooms.get(socket.data.code)?.move(socket.data.playerId, body.room),
    );
    socket.on("pickup", (body: { itemId: string }) =>
      rooms.get(socket.data.code)?.pickup(socket.data.playerId, body.itemId),
    );
    socket.on("drop", () => rooms.get(socket.data.code)?.drop(socket.data.playerId));
    socket.on("task_update", (body: { taskId: string; payload: unknown }) =>
      rooms.get(socket.data.code)?.taskUpdate(socket.data.playerId, body.taskId, body.payload),
    );
    socket.on("task_confirm", (body: { taskId: string; payload: unknown }) =>
      rooms.get(socket.data.code)?.taskConfirm(socket.data.playerId, body.taskId, body.payload),
    );
    socket.on("hold", (body: { taskId: string; holding: boolean }) =>
      rooms.get(socket.data.code)?.hold(socket.data.playerId, body.taskId, body.holding),
    );
    socket.on("revive", (body: { targetId: string }) =>
      rooms.get(socket.data.code)?.revive(socket.data.playerId, body.targetId),
    );
    socket.on("play_again", () => rooms.get(socket.data.code)?.playAgain(socket.data.playerId));

    socket.on("disconnect", () => {
      const room = rooms.get(socket.data.code);
      if (!room) return;
      room.dropSocket(socket.id);
      room.broadcast();
      if ([...room.players.values()].every((p) => !p.connected) && room.phase === "lobby") {
        room.destroy();
        rooms.delete(room.code);
      }
    });
  });
}
