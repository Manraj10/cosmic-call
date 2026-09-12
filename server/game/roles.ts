import type { RoleId, RoleCard } from "../../src/shared/protocol";
import type { SystemId } from "../../src/shared/constants";

export interface RoleDef {
  id: RoleId;
  title: string;
  primary: string;
  systems: SystemId[];
  controls: string[];
  depends: string;
  warning: string;
}

export const ROLE_DEFS: Record<RoleId, RoleDef> = {
  life_support: {
    id: "life_support",
    title: "Life Support",
    primary: "LIFE SUPPORT",
    systems: ["life_support"],
    controls: ["Oxygen production", "CO₂ scrubbers", "Cabin pressure"],
    depends: "Keep the crew breathing. Tap LIFE SUPPORT to walk there before you touch the generator.",
    warning: "Raising O₂ is not automatically safer — extra liters steal power. Match demand + leak.",
  },
  power: {
    id: "power",
    title: "Power",
    primary: "POWER",
    systems: ["power"],
    controls: ["Battery", "Power distribution", "Emergency generator"],
    depends: "Keep critical systems powered. Walk to POWER / REACTOR to run the board.",
    warning: "You will never have enough watts for everyone. Exact allocation, not max.",
  },
  thermal_exterior: {
    id: "thermal_exterior",
    title: "Thermal + Exterior",
    primary: "THERMAL + EXTERIOR",
    systems: ["thermal", "exterior"],
    controls: ["Heaters", "Coolant", "Solar array", "EVA repairs"],
    depends: "Hold cabin temperature and keep the arrays alive.",
    warning: "Going outside costs suit oxygen. Dust will lie to your instruments.",
  },
  comms_medical: {
    id: "comms_medical",
    title: "Communications + Medical",
    primary: "COMMS + MEDICAL",
    systems: ["comms", "medical"],
    controls: ["Receiver tuning", "Mission Control intel", "Medication", "Trauma response"],
    depends: "Warn the crew before disasters arrive. Keep them conscious.",
    warning: "Nobody else automatically hears Mission Control. If you stay quiet, they die uninformed.",
  },
  life_support_medical: {
    id: "life_support_medical",
    title: "Life Support + Medical",
    primary: "LIFE SUPPORT + MEDICAL",
    systems: ["life_support", "medical"],
    controls: ["Oxygen", "CO₂", "Pressure", "Medication"],
    depends: "Atmosphere and crew physiology are yours.",
    warning: "You still cannot see spare kilowatts or solar angles.",
  },
  power_thermal: {
    id: "power_thermal",
    title: "Power + Thermal",
    primary: "POWER + THERMAL",
    systems: ["power", "thermal"],
    controls: ["Battery", "Distribution", "Heaters", "Coolant"],
    depends: "Every extra degree and extra liter costs you watts.",
    warning: "You will be begged for power you do not have.",
  },
  comms_exterior: {
    id: "comms_exterior",
    title: "Communications + Exterior",
    primary: "COMMS + EXTERIOR",
    systems: ["comms", "exterior"],
    controls: ["Receiver", "Mission Control", "Solar array", "Airlock assist"],
    depends: "You are the eyes outside and the voice from Earth.",
    warning: "EVA without a buddy is how people become statistics.",
  },
  life_support_medical_comms: {
    id: "life_support_medical_comms",
    title: "Life Support + Medical + Comms",
    primary: "LIFE SUPPORT + MEDICAL + COMMS",
    systems: ["life_support", "medical", "comms"],
    controls: ["Atmosphere", "Crew health", "Mission Control", "Receiver"],
    depends: "You hold the crew's body and Earth's voice.",
    warning: "You still cannot run the reactor or the solar farm from here.",
  },
  power_thermal_exterior: {
    id: "power_thermal_exterior",
    title: "Power + Thermal + Exterior",
    primary: "POWER + THERMAL + EXTERIOR",
    systems: ["power", "thermal", "exterior"],
    controls: ["Reactor", "Battery", "Heat", "Solar array", "EVA"],
    depends: "You keep the habitat's muscles firing.",
    warning: "You will not see crew oxygen demand or Mission Control warnings unless someone tells you.",
  },
};

export function rolesForCount(count: number): RoleId[] {
  if (count <= 2) {
    return ["life_support_medical_comms", "power_thermal_exterior"];
  }
  if (count === 3) {
    return ["life_support_medical", "power_thermal", "comms_exterior"];
  }
  return ["life_support", "power", "thermal_exterior", "comms_medical"];
}

export function roleCard(id: RoleId, slot: number): RoleCard {
  const d = ROLE_DEFS[id];
  return {
    slot,
    title: d.title,
    primary: d.primary,
    controls: d.controls,
    depends: d.depends,
    warning: d.warning,
  };
}

export function maxUrgentTasks(playerCount: number) {
  return playerCount <= 2 ? 2 : playerCount === 3 ? 3 : 4;
}

export function timerScale(playerCount: number) {
  if (playerCount <= 2) return 1.28;
  if (playerCount === 3) return 1.1;
  return 1;
}

export function movementScale(playerCount: number) {
  return playerCount <= 2 ? 0.7 : 1;
}
