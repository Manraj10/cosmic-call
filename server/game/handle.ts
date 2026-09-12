import type { RoomId } from "../../src/shared/constants";
import type { GameRoom } from "./room";

export function handlePlayEvent(
  room: GameRoom,
  playerId: string,
  event: string,
  data: Record<string, unknown> | undefined,
  send: (event: string, payload: unknown) => void,
) {
  switch (event) {
    case "start": {
      const err = room.start(playerId);
      if (err) send("error_msg", err);
      break;
    }
    case "ready":
      room.ready(playerId);
      break;
    case "tutorial":
      room.tutorial(playerId, String(data?.optionId || ""));
      break;
    case "move":
      room.move(playerId, data?.room as RoomId);
      break;
    case "pickup":
      room.pickup(playerId, String(data?.itemId || ""));
      break;
    case "drop":
      room.drop(playerId);
      break;
    case "trade":
      room.trade(playerId, String(data?.targetId || ""));
      break;
    case "task_update":
      room.taskUpdate(playerId, String(data?.taskId || ""), data?.payload);
      break;
    case "task_confirm":
      room.taskConfirm(
        playerId,
        String(data?.taskId || ""),
        data?.payload !== undefined ? data.payload : data?.value,
      );
      break;
    case "hold":
      room.hold(playerId, String(data?.taskId || ""), Boolean(data?.holding));
      break;
    case "revive":
      room.revive(playerId, String(data?.targetId || ""));
      break;
    case "play_again":
      room.playAgain(playerId);
      break;
    default:
      break;
  }
}
