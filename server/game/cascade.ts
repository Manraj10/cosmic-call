import type { PuzzleInstance } from "./puzzles";

export interface IncidentDef {
  id: string;
  title: string;
  cause: string;
  types: [string, string];
  voice: string;
  sameHole: string;
}

export const INCIDENTS: IncidentDef[] = [
  {
    id: "hull_breach",
    title: "HULL BREACH",
    cause: "One hole in the skin. Air is leaving through it. Heat is leaving through it.",
    types: ["oxygen_leak", "heater"],
    voice: "Hull breach. Same hole is bleeding air and heat. If Life Support overshoots, the heater dies.",
    sameHole: "Same hole. Extra O2 watts come off the heater. Extra heat steals O2.",
  },
  {
    id: "storm_bus",
    title: "DUST STORM BROWN-OUT",
    cause: "Dust cut the arrays. The bus cannot feed every station and the uplink at once.",
    types: ["power_split", "freq_tune"],
    voice: "Brown-out. Power has the bus. Comms has the lock. Starve either and the other goes blind.",
    sameHole: "One bus. kW you dump as heat shoves the plasma. A missed lock leaves Power without Earth.",
  },
  {
    id: "medevac_sun",
    title: "HYPOXIA UNDER A DEAD SUN",
    cause: "Someone is crashing while the panels are parked. Treatment draws the same dying bus the arrays need.",
    types: ["med_dose", "solar_angle"],
    voice: "Medical emergency under a dead sun. The syringe and the slew share one battery.",
    sameHole: "Medical bus and array motors share the battery. Overdose browns the slew. A missed sun starves the syringe.",
  },
  {
    id: "atmo_wound",
    title: "CABIN WOUND",
    cause: "CO2 is pooling because the same punctures that need foam also jammed the scrubber loop.",
    types: ["co2_route", "pressure_patch"],
    voice: "Cabin wound. Scrubber path and foam charge are the same leak. Do not steal the kit from each other.",
    sameHole: "Same punctures. The kit in the CO2 loop is the kit Pressure cannot hold.",
  },
  {
    id: "coolant_surge",
    title: "COOLANT SURGE",
    cause: "A valve sequence and a live branch are fighting over the same coolant loop.",
    types: ["valve_logic", "power_surge"],
    voice: "Coolant surge. Thermal's valve order and Power's trip share the loop. A wrong branch cooks the valves.",
    sameHole: "Coolant you spend on valves is coolant the surge cannot dump. The branch you keep alive browns the other station.",
  },
  {
    id: "hatch_scram",
    title: "HATCH SCRAM",
    cause: "Reactor tripped and the hatch hydraulics died together. Two bodies, two consoles, one minute.",
    types: ["reactor_reset", "airlock_seal"],
    voice: "Hatch scram. Dual-confirm the reactor AND dog the airlock. One person cannot do both.",
    sameHole: "Two people at the hatch means the reactor board is empty. A desync dump cooks the people sealing.",
  },
  {
    id: "auth_desync",
    title: "AUTH DESYNC",
    cause: "The uplink handshake and the keypad are one lock. Memory is on Comms. The keys are on Power.",
    types: ["memory_code", "pattern"],
    voice: "Auth desync. Comms heard the code. Power has the keypad. Guessing either desyncs both.",
    sameHole: "The code lives in Comms' memory. The next number is on the Power stream. They are one lock.",
  },
];

export const PUZZLE_TITLE: Record<string, string> = {
  oxygen_leak: "OXYGEN LEAK",
  heater: "TEMPERATURE DROP",
  power_split: "POWER DISTRIBUTION",
  freq_tune: "COMMUNICATION FAILURE",
  med_dose: "MEDICAL EMERGENCY",
  solar_angle: "SOLAR PANEL ALIGNMENT",
  co2_route: "CO2 FILTER",
  pressure_patch: "PRESSURE PATCH",
  valve_logic: "VALVE SEQUENCE",
  power_surge: "POWER SURGE",
  reactor_reset: "REACTOR RESET",
  airlock_seal: "AIRLOCK SEAL",
  memory_code: "AUTH CODE",
  pattern: "UPLINK PATTERN",
};

export function incidentForType(type: string): IncidentDef | undefined {
  return INCIDENTS.find((i) => i.types.includes(type));
}

export function stampIncident(p: PuzzleInstance): PuzzleInstance {
  const inc = incidentForType(p.type);
  if (!inc) return p;
  const partner = inc.types[0] === p.type ? inc.types[1] : inc.types[0];
  p.incidentId = inc.id;
  p.incidentTitle = inc.title;
  p.incidentCause = inc.cause;
  p.partnerType = partner;
  p.partnerTitle = PUZZLE_TITLE[partner] || partner;
  p.sameHole = inc.sameHole;
  return p;
}

export function worksheet(type: string, hasControl: boolean): string[] {
  if (!hasControl) {
    switch (type) {
      case "oxygen_leak":
        return ["Life Support has the dial.", "Read your number. Do not do their arithmetic."];
      case "heater":
        return ["Thermal has the dial.", "Read comfort or dust. Do not add 'a little extra'."];
      case "power_split":
        return ["Power has the bus.", "Read ONLY your station's kW."];
      case "freq_tune":
        return ["Comms has the receiver.", "Read your offset. Do not sweep for them."];
      case "med_dose":
        return ["Medical has the syringe.", "Read protocol or adjuvant. One milligram off is harm."];
      case "solar_angle":
        return ["Exterior has the slew.", "Read sun or bias. Past the sun is as wrong as short."];
      default:
        return ["You do not have this dial.", "When they ask, read the number on your board."];
    }
  }
  switch (type) {
    case "oxygen_leak":
      return [
        "YOU HAVE crew and recycle. ASK Thermal for RATE. ASK hull for LEAK.",
        "Set (crew x rate) + leak - recycle. Extra liters kill the heater.",
      ];
    case "heater":
      return [
        "YOU HAVE cabin and rise rate. ASK Life Support for comfort C. ASK hull for dust seconds.",
        "Then cut it. Extra heat steals O2 production.",
      ];
    case "power_split":
      return [
        "ASK every station for their critical kW. Set each slider to that.",
        "Sum must equal the bus. Leftover dumps as heat and shoves Comms' plasma.",
      ];
    case "freq_tune":
      return [
        "YOU add beacon + interference + plasma.",
        "A miss leaves Power flying blind.",
      ];
    case "med_dose":
      return [
        "YOU HAVE mass. ASK Comms for protocol mg/kg. ASK Life Support for adjuvant.",
        "Overdose browns the solar slew.",
      ];
    case "solar_angle":
      return [
        "Rotate (optimal sun + bias) - current park.",
        "A miss starves Medical's bus.",
      ];
    case "co2_route":
      return ["Combine both clues. Commit that path — not a shortcut."];
    case "pressure_patch":
      return ["Foam = differential x punctures. Undercharge leaks. Overcharge clogs a vent."];
    case "valve_logic":
      return ["Colors are order. Numbers are which valve. Open that sequence."];
    case "power_surge":
      return ["Keep the one branch the crew named. Trip the others."];
    case "reactor_reset":
      return ["Multiply the two codes. Both CONFIRM the same product."];
    case "airlock_seal":
      return ["Two people walk here and hold SEAL together."];
    case "memory_code":
      return ["Type the AUTH CODE Mission Control already read. It is not on this pad."];
    case "pattern":
      return ["Read the rule, type the next number. Guessing desyncs the uplink."];
    default:
      return ["Talk out loud. The habitat accepts one physical answer."];
  }
}

export function shoutLabel(type: string): string {
  switch (type) {
    case "oxygen_leak":
      return "TELL LIFE SUPPORT";
    case "heater":
      return "TELL THERMAL";
    case "power_split":
      return "TELL POWER";
    case "freq_tune":
      return "TELL COMMS";
    case "med_dose":
      return "TELL MEDICAL";
    case "solar_angle":
      return "TELL EXTERIOR";
    case "memory_code":
      return "TELL POWER (they have the pad)";
    case "pattern":
      return "TELL THE KEYPAD";
    default:
      return "READ OUT LOUD";
  }
}

export function applyCascadeRipple(
  done: PuzzleInstance,
  result: { optimal: boolean; wasted: boolean },
  live: PuzzleInstance[],
): { pulse: string; tightenMs: number } {
  const partner = live.find((p) => p.incidentId && p.incidentId === done.incidentId && p.id !== done.id);
  const tighten = result.wasted && partner ? 8000 : 0;

  if (done.type === "oxygen_leak" && partner?.type === "heater") {
    if (result.wasted) {
      const next = Number(partner.solution) + 10;
      partner.solution = next;
      partner.optimal = next;
      return {
        pulse: `Life Support flooded O2. The hole dumped more heat. THERMAL's heater is now ${next}s — their first number is stale.`,
        tightenMs: tighten,
      };
    }
    if (result.optimal) {
      return {
        pulse: "O2 matched. Spare watts are back on the bus — Thermal can heat without brownout.",
        tightenMs: 0,
      };
    }
  }

  if (done.type === "heater" && partner?.type === "oxygen_leak") {
    if (result.wasted) {
      const next = Number(partner.solution) + 2;
      partner.solution = next;
      partner.optimal = next;
      return {
        pulse: `Heater overran and stole generator watts. LIFE SUPPORT now needs ${next} L/min.`,
        tightenMs: tighten,
      };
    }
    if (result.optimal) {
      return {
        pulse: "Heater timed. Watts returned to the O2 generator.",
        tightenMs: 0,
      };
    }
  }

  if (done.type === "power_split" && partner?.type === "freq_tune" && result.wasted) {
    const next = Math.round((Number(partner.solution) + 0.2) * 10) / 10;
    partner.solution = next;
    partner.optimal = next;
    return {
      pulse: `Bus dump shoved plasma. COMMS lock is now ${next.toFixed(1)} GHz — the number they had is stale.`,
      tightenMs: tighten,
    };
  }

  if (done.type === "freq_tune" && partner?.type === "power_split" && !result.optimal) {
    return {
      pulse: "Comms missed the lock. Power is flying without Mission Control.",
      tightenMs: tighten,
    };
  }

  if (done.type === "med_dose" && partner?.type === "solar_angle" && result.wasted) {
    return {
      pulse: "Overdose pulled Medical bus. Arrays brown-out — Exterior's slew just got weaker.",
      tightenMs: tighten,
    };
  }

  if (done.type === "solar_angle" && partner?.type === "med_dose" && result.wasted) {
    return {
      pulse: "Missed the sun. Battery sags — Medical is drawing a dying bus.",
      tightenMs: tighten,
    };
  }

  if (done.type === "co2_route" && partner?.type === "pressure_patch" && result.wasted) {
    const next = Number(partner.solution) + 2;
    partner.solution = next;
    partner.optimal = next;
    return {
      pulse: `Wrong scrubber path. More CO2 at the punctures. PATCH foam is now ${next}.`,
      tightenMs: tighten,
    };
  }

  if (done.type === "pressure_patch" && partner?.type === "co2_route" && result.wasted) {
    return {
      pulse: "Overcharged foam clogged a vent. The scrubber path just changed.",
      tightenMs: tighten,
    };
  }

  if (result.optimal && partner) {
    return {
      pulse: `${done.incidentTitle || "Incident"}: ${done.title} is clear. ${partner.title} is still live on the same failure.`,
      tightenMs: 0,
    };
  }
  if (result.wasted && partner) {
    return {
      pulse: `${done.title} scarred the habitat. ${partner.title} just got harder — same failure, not a new one.`,
      tightenMs: tighten,
    };
  }
  if (result.optimal) {
    return { pulse: `${done.incidentTitle || done.title} holding.`, tightenMs: 0 };
  }
  return { pulse: `${done.title} left a scar on the habitat.`, tightenMs: 0 };
}
