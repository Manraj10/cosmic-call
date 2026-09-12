export const MISSION_MS = 7 * 60 * 1000;
export const MAX_PLAYERS = 4;
export const MIN_PLAYERS = 2;
export const TICK_MS = 200;
export const HOLD_SEAL_MS = 3000;
export const DUAL_CONFIRM_WINDOW_MS = 3000;
export const ROLE_INTRO_MS = 15000;
export const TUTORIAL_MS = 28000;
export const COUNTDOWN_MS = 4500;
export const STABILITY_MS = 15000;
export const SCORE_START = 10000;

export const ROOMS = [
  "life_support",
  "power",
  "medical",
  "comms",
  "airlock",
  "exterior",
  "crew",
] as const;

export type RoomId = (typeof ROOMS)[number];

export const ROOM_LABELS: Record<RoomId, string> = {
  life_support: "Life Support",
  power: "Power / Reactor",
  medical: "Medical Bay",
  comms: "Communications",
  airlock: "Airlock",
  exterior: "Exterior / Solar",
  crew: "Crew Area",
};

export const ROOM_SHORT: Record<RoomId, string> = {
  life_support: "O₂",
  power: "PWR",
  medical: "MED",
  comms: "COM",
  airlock: "LOCK",
  exterior: "EVA",
  crew: "CREW",
};

export const ITEMS = [
  "repair_kit",
  "oxygen_canister",
  "battery_cell",
  "medical_kit",
  "coolant_cartridge",
  "circuit_fuse",
] as const;

export type ItemType = (typeof ITEMS)[number];

export const ITEM_LABELS: Record<ItemType, string> = {
  repair_kit: "Repair Kit",
  oxygen_canister: "Oxygen Canister",
  battery_cell: "Battery Cell",
  medical_kit: "Medical Kit",
  coolant_cartridge: "Coolant Cartridge",
  circuit_fuse: "Circuit Fuse",
};

export const ITEM_SHORT: Record<ItemType, string> = {
  repair_kit: "KIT",
  oxygen_canister: "O2 CAN",
  battery_cell: "CELL",
  medical_kit: "MEDKIT",
  coolant_cartridge: "COOLANT",
  circuit_fuse: "FUSE",
};

export const ITEM_HOME: Record<ItemType, RoomId> = {
  repair_kit: "crew",
  oxygen_canister: "life_support",
  battery_cell: "power",
  medical_kit: "medical",
  coolant_cartridge: "power",
  circuit_fuse: "comms",
};

export const SYSTEMS = [
  "life_support",
  "power",
  "thermal",
  "comms",
  "medical",
  "exterior",
] as const;

export type SystemId = (typeof SYSTEMS)[number];

export const SYSTEM_LABELS: Record<SystemId, string> = {
  life_support: "Life Support",
  power: "Power",
  thermal: "Thermal",
  comms: "Communications",
  medical: "Medical",
  exterior: "Exterior",
};

export const SUIT_COLORS = ["#35e0c2", "#ffb020", "#ff6a3d", "#7aa8ff"] as const;

export const AVATAR_COUNT = 4;

export const ROOM_CODE_PREFIXES = ["MARS", "ARES", "DUST", "SOL", "HAB", "EVA", "ION", "NOVA"] as const;

export function makeRoomCode() {
  const p = ROOM_CODE_PREFIXES[Math.floor(Math.random() * ROOM_CODE_PREFIXES.length)]!;
  const n = String(Math.floor(10 + Math.random() * 90));
  return `${p}${n}`;
}
