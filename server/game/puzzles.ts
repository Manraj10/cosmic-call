import type { ItemType, RoomId, SystemId } from "../../src/shared/constants";
import type { Severity, TaskControl } from "../../src/shared/protocol";
import { int, pick, type Rng } from "./rng";
import { clamp, type Sim } from "./simulation";

export interface PuzzleInstance {
  id: string;
  type: string;
  title: string;
  problem: string;
  target: string;
  howTo?: string;
  cost: string;
  risk: string;
  benefit: string;
  severity: Severity;
  assignedSystems: SystemId[];
  controlSystems: SystemId[];
  /** Numbers and local gauges for the person who actually turns the dial. Never shown to anyone else. */
  operatorInfo?: string[];
  infoBySystem: Partial<Record<SystemId, string[]>>;
  requiredRoom?: RoomId;
  requiredItem?: ItemType;
  requiredPlayers: number;
  requiresPresence: boolean;
  durationMs: number;
  control: TaskControl;
  solution: unknown;
  optimal: unknown;
  voice?: string;
  mc?: string;
  chain: string[];
}

export interface ApplyResult {
  ok: boolean;
  optimal: boolean;
  wasted: boolean;
  explanation: string;
  scoreDelta: number;
  voice?: string;
}

export const PUZZLE_HOW_TO: Record<string, string> = {
  oxygen_leak:
    "production = (crew × metabolic rate) + hull leak − scrubber recycle. One number. Extra liters steal heat and radios.",
  power_split:
    "Each slider = that station's critical kW. Sum must equal the bus. Leftover dumps as heat.",
  heater:
    "seconds = ((comfort − cabin) ÷ rise per tick) × tick + dust compensation. Then cut it.",
  solar_angle:
    "rotate = (optimal sun + magnetic bias) − current park. Past the sun is as wrong as short of it.",
  med_dose:
    "dose = mass × protocol + hypoxia adjuvant. Underdose fails. Overdose hits the liver.",
  freq_tune:
    "lock = beacon base + interference offset + plasma shift. Any other number is silence.",
  reactor_reset:
    "Multiply the two codes. Both astronauts CONFIRM that same product within 3 seconds.",
  airlock_seal:
    "Two people walk to the Airlock and hold SEAL together. One person cannot dog the hatch.",
  co2_route:
    "There is one safe junction order. Combine both clues, then commit that path — not a shortcut.",
  pattern:
    "Read the rule on the stream, then type the next number. Guessing desyncs the uplink.",
  memory_code:
    "Type the 4-digit AUTH CODE Mission Control already read aloud. It is not on this console.",
  valve_logic:
    "Colors tell the order. Numbers tell which valve is which. Open that one sequence.",
  power_surge:
    "Keep the one branch the crew named. Trip the others. Two live branches melt the inverter.",
  pressure_patch:
    "Foam = differential × puncture count. Undercharge leaks. Overcharge clogs a vent.",
};

export function howToFor(type: string, override?: string) {
  return override || PUZZLE_HOW_TO[type] || "Talk out loud. The habitat accepts one physical answer.";
}

/**
 * Operator never sees partner numbers — even if their combined role includes
 * that system (2-player hats). Leftover intel that only the operator's extra
 * hats would have held is dumped onto everyone who does NOT have the dial.
 */
export function intelFor(
  puz: PuzzleInstance,
  yourSystems: SystemId[],
  hasControl: boolean,
  crewSystems: SystemId[][],
): string[] {
  const add = (into: string[], lines?: string[]) => {
    for (const line of lines || []) {
      if (!into.includes(line)) into.push(line);
    }
  };

  if (hasControl) {
    const lines: string[] = [];
    add(lines, puz.operatorInfo);
    if (puz.controlSystems.length > 1) {
      for (const sys of yourSystems) add(lines, puz.infoBySystem[sys]);
    }
    if (!lines.length) {
      lines.push("You have the dial. Every number in the formula lives on someone else's board.");
    }
    return lines;
  }

  const intelHeld = new Set<SystemId>();
  for (const sys of crewSystems) {
    const theyControl = puz.controlSystems.some((s) => sys.includes(s));
    if (!theyControl) sys.forEach((s) => intelHeld.add(s));
  }

  const lines: string[] = [];
  for (const key of Object.keys(puz.infoBySystem) as SystemId[]) {
    const chunk = puz.infoBySystem[key];
    if (!chunk) continue;
    if (yourSystems.includes(key)) add(lines, chunk);
    else if (!intelHeld.has(key) && !puz.controlSystems.includes(key)) add(lines, chunk);
  }
  return lines.length ? lines : ["You do not have local telemetry for this. Ask the crew who does."];
}

export function boardCopy(type: string, systems: SystemId[], hasControl: boolean) {
  const has = (s: SystemId) => systems.includes(s);
  switch (type) {
    case "oxygen_leak":
      if (has("life_support") && hasControl) {
        return {
          job: "YOU run the O₂ generator. Nobody else can turn this dial.",
          ask: "You have crew count and recycle. Ask Thermal for metabolic rate, Exterior for the leak. production = (crew × rate) + leak − recycle.",
        };
      }
      if (has("thermal")) {
        return {
          job: "You do not set oxygen. You have metabolic rate.",
          ask: "When Life Support asks, read the L/min per person. Do not do their arithmetic for them.",
        };
      }
      if (has("exterior")) {
        return {
          job: "You do not set oxygen. You have the hull leak.",
          ask: "Read them the leak L/min. Do not let them 'add extra for safety.'",
        };
      }
      if (has("power")) {
        return {
          job: "You do not set oxygen. You are the wattage check.",
          ask: "Tell Life Support what each extra L/min costs in kW. Extra oxygen steals heat and radios.",
        };
      }
      return {
        job: "You cannot run this console.",
        ask: "If someone asks you for rate, leak, or kW cost, point them at Thermal / hull / Power.",
      };
    case "power_split":
      if (has("power") && hasControl) {
        return {
          job: "YOU allocate the bus. Five branches. Exact numbers — leftover dumps as heat.",
          ask: "Ask every other station for their CRITICAL kW. Set each slider to that. Total must equal the available bus.",
        };
      }
      return {
        job: "You do not touch the reactor board. You have ONE critical draw.",
        ask: "When Power asks, read ONLY your station's kW. Do not invent a surplus.",
      };
    case "heater":
      if (has("thermal") && hasControl) {
        return {
          job: "YOU set heater duration.",
          ask: "You have cabin temp and rise rate. Ask Life Support for comfort °C and Exterior for dust compensation. Then cut it.",
        };
      }
      if (has("life_support")) {
        return {
          job: "You do not run the heater. You have the target temperature.",
          ask: "Tell Thermal the crew comfort °C. Warmer than that is metabolic waste.",
        };
      }
      if (has("exterior")) {
        return {
          job: "You do not run the heater. You have dust compensation.",
          ask: "Read Thermal the extra seconds the storm adds. Zero means a clear sky.",
        };
      }
      return { job: "You cannot run this console.", ask: "Point Thermal at Life Support and Exterior." };
    case "solar_angle":
      if (has("exterior") && hasControl) {
        return {
          job: "YOU slew the arrays. Walk outside with a repair kit.",
          ask: "Ask Power for the optimal sun angle and Comms for magnetic bias. rotate = (optimal + bias) − current.",
        };
      }
      if (has("power")) {
        return {
          job: "You do not go outside. You have the optimal sun angle.",
          ask: "Read Exterior the degrees. Do not add a fudge factor.",
        };
      }
      if (has("comms")) {
        return {
          job: "You do not go outside. You have the magnetic bias.",
          ask: "Read Exterior the signed degrees. Negative means subtract.",
        };
      }
      return {
        job: "You cannot run this console.",
        ask: "Point Exterior at Power (sun) and Comms (bias).",
      };
    case "med_dose":
      if (has("medical") && hasControl) {
        return {
          job: "YOU push the syringe. Walk to Medical with a kit.",
          ask: "You have patient mass. Ask Comms for mg/kg and Life Support for the hypoxia adjuvant. dose = mass × protocol + adjuvant.",
        };
      }
      if (has("comms")) {
        return {
          job: "You do not inject anyone. You have the protocol.",
          ask: "Read Medical the mg/kg number. Underdose fails. Overdose hits the liver.",
        };
      }
      if (has("life_support")) {
        return {
          job: "You do not inject anyone. You have the hypoxia adjuvant.",
          ask: "Read Medical the extra milligrams. It can be zero.",
        };
      }
      return { job: "You cannot run this console.", ask: "Point Medical at Comms and Life Support." };
    case "freq_tune":
      if (has("comms") && hasControl) {
        return {
          job: "YOU tune the receiver.",
          ask: "You have the interference offset. Ask Exterior for the beacon and Power for plasma shift. lock = base + offset + shift.",
        };
      }
      if (has("exterior")) {
        return {
          job: "You do not touch the receiver. You have the base beacon.",
          ask: "Read Comms the GHz etched on the high-gain.",
        };
      }
      if (has("power")) {
        return {
          job: "You do not touch the receiver. You have the plasma shift.",
          ask: "Read Comms the GHz the storm is shoving the carrier.",
        };
      }
      return {
        job: "You cannot run this console.",
        ask: "Point Comms at Exterior (beacon) and Power (plasma).",
      };
    case "reactor_reset":
      if (hasControl) {
        return {
          job: "YOU are one of two confirmations. Both must enter ALPHA × BETA within 3 seconds.",
          ask: "You have one code. Get the other from your counterpart. Same product. Confirm together.",
        };
      }
      return { job: "Stay clear of the reactor board.", ask: "The two operators need silence and a product." };
    case "airlock_seal":
      return {
        job: "This hatch needs TWO people. Walk to the Airlock.",
        ask: "Grab a crewmate. Hold SEAL together. One person cannot dog it.",
      };
    case "co2_route":
      if (has("life_support") && hasControl) {
        return {
          job: "YOU commit the filter path. Need a repair kit in Life Support.",
          ask: "You have one clue. Power has the other. Combine them — there is one safe order.",
        };
      }
      return {
        job: "You do not commit the path. You have half the map.",
        ask: "Read Life Support your clue. Do not guess the rest.",
      };
    case "memory_code":
      if (has("thermal") && hasControl) {
        return {
          job: "YOU type the auth code in Crew.",
          ask: "It is not on this console. Ask Comms — they heard Mission Control earlier.",
        };
      }
      if (has("comms")) {
        return {
          job: "You do not type it. You were supposed to remember the AUTH CODE.",
          ask: "Read Thermal the 4 digits. If you weren't listening, the habitat is in trouble.",
        };
      }
      return { job: "You cannot run this console.", ask: "Ask Comms for the AUTH CODE." };
    case "valve_logic":
      if (has("life_support") && hasControl) {
        return {
          job: "YOU open the valves. Need coolant in Life Support.",
          ask: "You see colors. Power sees numbers. Map color order onto valve numbers.",
        };
      }
      return {
        job: "You do not touch the valves. You have the number map.",
        ask: "When Life Support names a color, tell them which valve number it is.",
      };
    case "power_surge":
      if (has("power") && hasControl) {
        return {
          job: "YOU shed branches. Keep exactly one alive. Need a fuse.",
          ask: "Ask the crew which branch MUST stay. Trip the others.",
        };
      }
      return {
        job: "You do not shed the bus. You know if YOUR branch must live.",
        ask: "If your card says KEEP, shout it. If it can brown out, say so.",
      };
    case "pressure_patch":
      if (has("exterior") && hasControl) {
        return {
          job: "YOU set foam charge at the Airlock. Need an oxygen canister.",
          ask: "You have puncture count. Ask Life Support for kPa differential. Foam = differential × holes.",
        };
      }
      return {
        job: "You do not spray foam. You have the pressure differential.",
        ask: "Read Exterior the kPa per site.",
      };
    case "pattern":
      if (hasControl) {
        return {
          job: "YOU type the next handshake symbol on the reactor keypad.",
          ask: "Comms can see the stream. Get the rule from them, then enter one number.",
        };
      }
      return {
        job: "You cannot type it. You can see the stream.",
        ask: "Tell Power the rule and the next number. They have the keypad.",
      };
    default:
      return {
        job: hasControl ? "YOU run this console." : "You cannot turn this dial.",
        ask: "Talk. Someone else is holding a number you do not have.",
      };
  }
}

export function durationFor(severity: Severity, scale: number) {
  const base =
    severity === "critical" ? 18000 : severity === "urgent" ? 32000 : 52000;
  return Math.round(base * scale);
}

export function createPuzzle(
  type: string,
  rng: Rng,
  sim: Sim,
  scale: number,
  id: string,
): PuzzleInstance {
  switch (type) {
    case "oxygen_leak":
      return oxygenLeak(rng, sim, scale, id);
    case "power_split":
      return powerSplit(rng, scale, id);
    case "heater":
      return heater(rng, sim, scale, id);
    case "solar_angle":
      return solarAngle(rng, sim, scale, id);
    case "med_dose":
      return medDose(rng, scale, id);
    case "freq_tune":
      return freqTune(rng, scale, id);
    case "reactor_reset":
      return reactorReset(rng, scale, id);
    case "airlock_seal":
      return airlockSeal(scale, id);
    case "co2_route":
      return co2Route(rng, scale, id);
    case "pattern":
      return patternPuzzle(rng, scale, id);
    case "memory_code":
      return memoryCode(rng, scale, id);
    case "valve_logic":
      return valveLogic(rng, scale, id);
    case "power_surge":
      return powerSurge(rng, scale, id);
    case "pressure_patch":
      return pressurePatch(rng, scale, id);
    default:
      return oxygenLeak(rng, sim, scale, id);
  }
}

function oxygenLeak(rng: Rng, sim: Sim, scale: number, id: string): PuzzleInstance {
  const crew = pick(rng, [3, 4]);
  const rate = pick(rng, [4, 5, 6]);
  const leak = int(rng, 4, 7);
  const recycle = int(rng, 1, 3);
  const demand = crew * rate;
  const required = demand + leak - recycle;
  const current = Math.max(10, required - int(rng, 3, 6));
  const kw = sim.o2KwPerLiter;
  sim.oxygenDemand = demand - recycle;
  sim.oxygenLeak = leak;
  sim.oxygenProduction = current;
  return {
    id,
    type: "oxygen_leak",
    title: "OXYGEN LEAK",
    problem: "Hull microfracture. Crew is burning oxygen and a hole is hissing. The generator is behind — and flooding the cabin is not safer.",
    target: "production = (crew × metabolic rate) + hull leak − scrubber recycle. That sum is the only legal setting.",
    howTo: PUZZLE_HOW_TO.oxygen_leak,
    cost: `Each extra L/min costs ${kw} kW that heaters and comms also need.`,
    risk: "Too low: people suffocate. Too high: you ‘fix’ air and brown out the habitat.",
    benefit: "Matching the hole stops the fall without wasting power.",
    severity: "urgent",
    assignedSystems: ["life_support"],
    controlSystems: ["life_support"],
    operatorInfo: [
      `Crew on board: ${crew}`,
      `Scrubber recycle: ${recycle} L/min returned`,
      `Current production: ${current} L/min`,
      "Formula: production = (crew × metabolic rate) + hull leak − recycle",
      "You cannot see metabolic rate or the hull leak from this module.",
    ],
    infoBySystem: {
      thermal: [`Metabolic rate: ${rate} L/min per person`],
      exterior: [`Hull leak measured: ${leak} L/min`],
      power: [
        `Each extra L/min of O₂ generation costs ${kw} kW`,
        `Current generation: ${sim.generation.toFixed(0)} kW — do not overshoot.`,
      ],
    },
    requiredRoom: "life_support",
    requiresPresence: true,
    requiredPlayers: 1,
    durationMs: durationFor("urgent", scale),
    control: {
      kind: "stepper",
      label: "O₂ generator",
      unit: "L/min",
      min: 10,
      max: 40,
      step: 1,
      value: current,
    },
    solution: required,
    optimal: required,
    voice: "Habitat oxygen is falling. Life support, you are missing two numbers. Ask.",
    mc: "LIFE SUPPORT: four terms. Crew and recycle are on your board. Rate and leak are not.",
    chain: ["Oxygen leak detected", "Hull telemetry isolated from the generator"],
  };
}

function powerSplit(rng: Rng, scale: number, id: string): PuzzleInstance {
  const ls = pick(rng, [26, 28, 30, 32]);
  const th = pick(rng, [16, 18, 20, 22]);
  const com = pick(rng, [8, 10, 12]);
  const med = pick(rng, [8, 10, 12]);
  const ext = pick(rng, [16, 18, 20, 22]);
  const available = ls + th + com + med + ext;
  return {
    id,
    type: "power_split",
    title: "POWER DISTRIBUTION",
    problem: `Bus available is ${available} kW. Each critical load has exactly one legal draw. Extra kW dump as heat.`,
    target: "Set every branch to its reported critical requirement. Total must equal the bus — no leftovers, no shorts.",
    howTo: PUZZLE_HOW_TO.power_split,
    cost: "Every kW assigned is removed from the battery-charging surplus.",
    risk: "Underfeeding a branch brownouts that system. Overfeeding trips thermal alarms.",
    benefit: "Exact allocation keeps every critical system alive.",
    severity: "urgent",
    assignedSystems: ["power"],
    controlSystems: ["power"],
    operatorInfo: [
      `Available bus: ${available} kW`,
      "Formula: each slider = that station's critical kW. Sum must equal the bus.",
      "You cannot see any station's draw from this board.",
    ],
    infoBySystem: {
      life_support: [`Life Support critical requirement: ${ls} kW`],
      thermal: [`Thermal critical requirement: ${th} kW`],
      comms: [`Communications critical requirement: ${com} kW`],
      medical: [`Medical critical requirement: ${med} kW`],
      exterior: [`Exterior / arrays critical requirement: ${ext} kW`],
    },
    requiredRoom: "power",
    requiresPresence: true,
    requiredPlayers: 1,
    durationMs: durationFor("urgent", scale),
    control: {
      kind: "sliders",
      totalLabel: "Allocated",
      available,
      unit: "kW",
      sliders: [
        { id: "life_support", label: "Life Support", min: 0, max: available, value: 0 },
        { id: "thermal", label: "Thermal", min: 0, max: available, value: 0 },
        { id: "comms", label: "Comms", min: 0, max: available, value: 0 },
        { id: "medical", label: "Medical", min: 0, max: available, value: 0 },
        { id: "exterior", label: "Exterior", min: 0, max: available, value: 0 },
      ],
    },
    solution: { life_support: ls, thermal: th, comms: com, medical: med, exterior: ext, available },
    optimal: { life_support: ls, thermal: th, comms: com, medical: med, exterior: ext },
    voice: "Power bus is unconstrained. Distribute exactly. No leftovers.",
    chain: ["Power distribution required"],
  };
}

function heater(rng: Rng, sim: Sim, scale: number, id: string): PuzzleInstance {
  const current = int(rng, 8, 13);
  const target = 20;
  const rate = 2;
  const every = 10;
  const dust = pick(rng, [0, 10, 20]);
  const delta = target - current;
  const seconds = (delta / rate) * every + dust;
  sim.temperature = current;
  return {
    id,
    type: "heater",
    title: "TEMPERATURE DROP",
    problem: "Cabin is below crew comfort. Dust on the radiators adds time. Overshooting cooks them and drains the battery.",
    target: "seconds = ((comfort − cabin) ÷ rise per tick) × tick + dust compensation. Then cut the heater.",
    howTo: PUZZLE_HOW_TO.heater,
    cost: "Heater draws 22 kW for the entire duration.",
    risk: "Short run: hypothermia. Long run: wasted power and overshoot.",
    benefit: "Exact duration reaches comfort as the heater cuts out.",
    severity: "urgent",
    assignedSystems: ["thermal"],
    controlSystems: ["thermal"],
    operatorInfo: [
      `Cabin now: ${current}°C`,
      `Heater rate: +${rate}°C every ${every} seconds`,
      "Formula: seconds = ((comfort − cabin) ÷ 2) × 10 + dust compensation",
      "You cannot see the comfort target or the dust compensation.",
    ],
    infoBySystem: {
      life_support: [`Crew comfort target: ${target}°C`, "Do not overshoot — metabolic O₂ demand rises with heat."],
      exterior: [`Dust compensation: +${dust} seconds (radiators fouled)`],
      power: ["Heater draw while active: 22 kW"],
    },
    requiredRoom: "crew",
    requiresPresence: true,
    requiredPlayers: 1,
    durationMs: durationFor("urgent", scale),
    control: {
      kind: "stepper",
      label: "Heater duration",
      unit: "sec",
      min: 10,
      max: 90,
      step: 10,
      value: 10,
    },
    solution: seconds,
    optimal: seconds,
    voice: "Cabin temperature is below crew comfort. Thermal, do the math before you cook us.",
    chain: [`Cabin ${current}°C`, "Heating demand increased"],
  };
}

function solarAngle(rng: Rng, sim: Sim, scale: number, id: string): PuzzleInstance {
  const optimal = int(rng, 58, 72);
  const park = pick(rng, [18, 21, 24, 25, 27, 30]);
  const bias = pick(rng, [-4, -2, 0, 3, 5]);
  const current = optimal - park;
  const rotate = park + bias;
  sim.solarOptimal = optimal + bias;
  sim.solarAngle = current;
  sim.solarEfficiency = 0.58;
  return {
    id,
    type: "solar_angle",
    title: "SOLAR PANEL ALIGNMENT",
    problem: "Arrays are parked off the sun. Magnetic bias from the storm shoves the true vector. Generation is down.",
    target: "rotate = (optimal sun + magnetic bias) − current park. One number. Past the sun is as wrong as short of it.",
    howTo: PUZZLE_HOW_TO.solar_angle,
    cost: "Actuators draw 6 kW during the slew.",
    risk: "Wrong angle reduces efficiency further. Over-rotation past the sun wastes the move.",
    benefit: "Correct angle restores solar generation.",
    severity: "routine",
    assignedSystems: ["exterior"],
    controlSystems: ["exterior"],
    operatorInfo: [
      `Current park angle: ${current}°`,
      "Formula: rotate = (optimal sun + magnetic bias) − current",
      "You can slew from the exterior catwalk. You cannot see optimal or bias.",
    ],
    infoBySystem: {
      power: [`Telemetry: optimal sun angle is ${optimal}°`],
      comms: [`Magnetic storm bias: ${bias > 0 ? "+" : ""}${bias}°`],
    },
    requiredRoom: "exterior",
    requiredItem: "repair_kit",
    requiresPresence: true,
    requiredPlayers: 1,
    durationMs: durationFor("routine", scale),
    control: {
      kind: "stepper",
      label: "Rotate array",
      unit: "°",
      min: -40,
      max: 40,
      step: 1,
      value: 0,
    },
    solution: rotate,
    optimal: rotate,
    voice: "Solar output is off-peak. Someone has to go outside. Two numbers are not on that board.",
    chain: ["Solar panels off-angle", "Power generation decreased"],
  };
}

function medDose(rng: Rng, scale: number, id: string): PuzzleInstance {
  const mass = pick(rng, [58, 62, 65, 70, 74, 81, 88]);
  const mgkg = pick(rng, [1.5, 2, 2.5, 3]);
  const adjuvant = pick(rng, [0, 5, 10, 15]);
  const dose = mass * mgkg + adjuvant;
  const name = pick(rng, ["HALO", "VEGA", "ION", "NOVA"]);
  return {
    id,
    type: "med_dose",
    title: "MEDICAL EMERGENCY",
    problem: `Astronaut ${name} is hypoxic. Protocol is weight-based, then a hypoxia adjuvant. One milligram off is harm.`,
    target: "dose = mass × protocol + hypoxia adjuvant. Underdose fails. Overdose hits the liver.",
    howTo: PUZZLE_HOW_TO.med_dose,
    cost: "Treatment occupies Medical bus for 20 seconds.",
    risk: "Wrong milligrams injure the patient. Delay lets health keep falling.",
    benefit: "Exact dose stabilizes the astronaut.",
    severity: "critical",
    assignedSystems: ["medical"],
    controlSystems: ["medical"],
    operatorInfo: [
      `Patient mass: ${mass} kg`,
      "Formula: dose = mass × protocol + hypoxia adjuvant",
      "Syringe is graduated in milligrams. You cannot see protocol or adjuvant.",
    ],
    infoBySystem: {
      comms: [`MISSION CONTROL PROTOCOL: ${mgkg} mg/kg antirad-oxygenate`],
      life_support: [`Hypoxia adjuvant: +${adjuvant} mg (can be zero)`],
    },
    requiredRoom: "medical",
    requiredItem: "medical_kit",
    requiresPresence: true,
    requiredPlayers: 1,
    durationMs: durationFor("critical", scale),
    control: {
      kind: "stepper",
      label: "Dose",
      unit: "mg",
      min: 40,
      max: 320,
      step: mgkg === 1.5 || mgkg === 2.5 ? 0.5 : 1,
      value: 80,
    },
    solution: dose,
    optimal: dose,
    voice: "Medical emergency. Mass is on Medical. Protocol and adjuvant are not.",
    mc: "MEDICAL: do not push from memory. Protocol is on Comms. Adjuvant is on Life Support.",
    chain: ["Medical emergency", "Treatment will draw medical power"],
  };
}

function freqTune(rng: Rng, scale: number, id: string): PuzzleInstance {
  const base = Math.round((7.2 + rng() * 1.6) * 10) / 10;
  const offset = Math.round((0.2 + rng() * 0.4) * 10) / 10;
  const shift = pick(rng, [0, 0.1, 0.2, 0.3]);
  const target = Math.round((base + offset + shift) * 10) / 10;
  return {
    id,
    type: "freq_tune",
    title: "COMMUNICATION FAILURE",
    problem: "Uplink dropped. Plasma is shoving the carrier. One frequency locks Earth; every other number is silence.",
    target: "lock = beacon base + interference offset + plasma shift. Add the three numbers. Do not sweep at random.",
    cost: "Transmitter draws 4 kW while sweeping.",
    risk: "Wrong lock loses Mission Control warnings until retuned.",
    benefit: "Correct lock restores intel and flare forecasts.",
    severity: "urgent",
    assignedSystems: ["comms"],
    controlSystems: ["comms"],
    operatorInfo: [
      `Atmospheric interference offset: +${offset.toFixed(1)} GHz`,
      "Formula: lock = beacon base + offset + plasma shift",
      "You cannot see the beacon or the plasma shift from this rack.",
    ],
    infoBySystem: {
      exterior: [`Beacon etched on the high-gain: ${base.toFixed(1)} GHz`],
      power: [`Plasma shift this sol: +${shift.toFixed(1)} GHz`],
    },
    requiredRoom: "comms",
    requiresPresence: true,
    requiredPlayers: 1,
    durationMs: durationFor("urgent", scale),
    control: {
      kind: "stepper",
      label: "Receiver",
      unit: "GHz",
      min: 7,
      max: 10,
      step: 0.1,
      value: 8,
    },
    solution: target,
    optimal: target,
    voice: "Communications is blind. Tune the offset. Someone else has the base frequency.",
    chain: ["Communication failure", "Mission Control intel unavailable"],
  };
}

function reactorReset(rng: Rng, scale: number, id: string): PuzzleInstance {
  const alpha = int(rng, 3, 9);
  const beta = int(rng, 3, 9);
  return {
    id,
    type: "reactor_reset",
    title: "REACTOR RESET",
    problem: "Watchdog tripped. The reactor wants a handshake, not a guess.",
    target: "Multiply ALPHA × BETA. Both astronauts type that product and CONFIRM within 3 seconds of each other.",
    cost: "Reset dumps 8% battery into the igniter.",
    risk: "Desynced confirms abort. Wrong product overheats the bus.",
    benefit: "Synced correct product clears the surge and restores generation.",
    severity: "critical",
    assignedSystems: ["power", "life_support"],
    controlSystems: ["power", "life_support"],
    operatorInfo: [
      "Formula: type ALPHA × BETA. You have one factor. Get the other out loud. Confirm together.",
    ],
    infoBySystem: {
      power: [`ALPHA CODE: ${alpha}`],
      life_support: [`BETA CODE: ${beta}`],
      thermal: ["Reactor terminal is in Power. Both operators must confirm together."],
    },
    requiredRoom: "power",
    requiresPresence: true,
    requiredPlayers: 2,
    durationMs: durationFor("critical", scale),
    control: {
      kind: "dual_confirm",
      prompt: "ALPHA × BETA",
      unit: "",
      min: 1,
      max: 99,
      step: 1,
      value: 0,
      confirmed: [],
    },
    solution: alpha * beta,
    optimal: alpha * beta,
    voice: "Reactor watchdog. Two astronauts. Product of your codes. Confirm together.",
    chain: ["Reactor watchdog trip"],
  };
}

function airlockSeal(scale: number, id: string): PuzzleInstance {
  return {
    id,
    type: "airlock_seal",
    title: "MANUAL AIRLOCK SEAL",
    problem: "Inner hatch hydraulics failed. Software cannot close it. Pressure is leaving through the lock.",
    target: "Two astronauts walk to AIRLOCK and hold SEAL together for 3 seconds. One person cannot dog the hatch.",
    cost: "None, besides the time you are not at your stations.",
    risk: "If only one holds, the hatch yawns back open and pressure keeps falling.",
    benefit: "A dual seal stops the leak immediately.",
    severity: "critical",
    assignedSystems: ["life_support", "exterior", "thermal", "power"],
    controlSystems: ["life_support", "exterior", "thermal", "power", "comms", "medical"],
    operatorInfo: ["Two people must hold SEAL together. Walk to the Airlock. One person cannot dog the hatch."],
    infoBySystem: {
      life_support: ["Pressure will not hold until two people dog the hatch."],
      exterior: ["Airlock is the only manual override."],
    },
    requiredRoom: "airlock",
    requiresPresence: true,
    requiredPlayers: 2,
    durationMs: durationFor("critical", scale),
    control: {
      kind: "hold",
      label: "HOLD TO SEAL",
      requiredPlayers: 2,
      holding: [],
      progress: 0,
    },
    solution: true,
    optimal: true,
    voice: "Airlock seal requires two astronauts. Move. Now.",
    chain: ["Airlock hydraulics failed", "Pressure leak ongoing until dual seal"],
  };
}

function co2Route(rng: Rng, scale: number, id: string): PuzzleInstance {
  const paths = [
    { nodes: ["A", "C", "D"], clueA: "Skip burned junction B.", clueB: "Path must finish at scrubber D." },
    { nodes: ["B", "A", "D"], clueA: "Start at the bypass B.", clueB: "Never enter C — toxin trap." },
    { nodes: ["A", "B", "C"], clueA: "Inlet is A, then the spare B.", clueB: "C is the live scrubber. Stop there." },
  ];
  const p = pick(rng, paths);
  return {
    id,
    type: "co2_route",
    title: "CO₂ FILTER FAILURE",
    problem: "Primary scrubber packed. CO₂ is climbing. There is one safe junction order — shortcuts dump gas into the bay.",
    target: "Combine both clues, tap that path, then commit. Wrong order is not 'close enough'.",
    cost: "Reroute needs a Repair Kit installed in Life Support.",
    risk: "Wrong path dumps CO₂ back into the crew bay.",
    benefit: "Correct route restores filter efficiency.",
    severity: "urgent",
    assignedSystems: ["life_support"],
    controlSystems: ["life_support"],
    operatorInfo: [p.clueB, "Install the repair kit, then route. You have one clue — Power has the other."],
    infoBySystem: {
      power: [p.clueA, "Electrical interlock will reject a live burned junction."],
    },
    requiredRoom: "life_support",
    requiredItem: "repair_kit",
    requiresPresence: true,
    requiredPlayers: 1,
    durationMs: durationFor("urgent", scale),
    control: {
      kind: "routing",
      nodes: [
        { id: "A", label: "A" },
        { id: "B", label: "B" },
        { id: "C", label: "C" },
        { id: "D", label: "D" },
      ],
      selected: [],
    },
    solution: p.nodes,
    optimal: p.nodes,
    voice: "CO₂ is climbing. Filter loop must be rerouted with a repair kit.",
    chain: ["CO₂ filter failure", "Carbon dioxide accumulating"],
  };
}

function patternPuzzle(rng: Rng, scale: number, id: string): PuzzleInstance {
  const kind = pick(rng, ["double", "tri", "plus"]);
  let seq: number[] = [];
  let next = 0;
  let rule = "";
  if (kind === "double") {
    const start = pick(rng, [2, 3, 4]);
    seq = [start, start * 2, start * 4, start * 8];
    next = start * 16;
    rule = "each step doubles";
  } else if (kind === "tri") {
    const start = pick(rng, [2, 3, 5]);
    seq = [start, start + 3, start + 7, start + 12];
    next = start + 18;
    rule = "+3, +4, +5, +6";
  } else {
    seq = [4, 7, 13, 22];
    next = 36;
    rule = "sum of the previous two, plus 2, then plus 3… wait — each is sum of the two before plus 2";
    seq = [4, 7, 13, 22];
    next = 37;
    rule = "each term = sum of the previous two + 2";
  }
  return {
    id,
    type: "pattern",
    title: "UPLINK HANDSHAKE",
    problem: "Handshake desynced. The stream is on Comms. The keypad is on Power. Guessing burns the uplink.",
    target: "Read the rule on the stream, then enter the next number. Guessing desyncs the uplink.",
    cost: "Failed handshake adds 8 seconds of comms noise.",
    risk: "A wrong next-symbol desyncs encryption for a full minute.",
    benefit: "Correct symbol restores a clean uplink burst.",
    severity: "routine",
    assignedSystems: ["comms"],
    controlSystems: ["power"],
    operatorInfo: ["The reactor console is the only keypad that can inject the next handshake symbol. Ask Comms for the stream and the rule."],
    infoBySystem: {
      comms: [`Stream: ${seq.join(" · ")}`, `Pattern family: ${rule}`],
    },
    requiredRoom: "power",
    requiresPresence: true,
    requiredPlayers: 1,
    durationMs: durationFor("routine", scale),
    control: {
      kind: "pattern",
      prompt: "Next symbol",
      min: 0,
      max: 80,
      value: 0,
    },
    solution: next,
    optimal: next,
    voice: "Handshake pattern incoming. Comms can see it. Power has the keypad.",
    chain: ["Handshake desync"],
  };
}

export function peekMemoryCode(rng: Rng) {
  return String(int(rng, 1000, 9999));
}

function memoryCode(rng: Rng, scale: number, id: string): PuzzleInstance {
  const code = peekMemoryCode(rng);
  return {
    id,
    type: "memory_code",
    title: "AUTH GATE",
    problem: "Override wants the AUTH CODE Mission Control already read aloud. It is not stored on this console.",
    target: "Type those four digits. Guessing burns the window; asking Comms is the solution.",
    cost: "Three incorrect attempts lock the gate for the rest of the storm.",
    risk: "Guessing wastes the window. The code is not written on this console.",
    benefit: "Correct code opens backup heaters.",
    severity: "urgent",
    assignedSystems: ["thermal"],
    controlSystems: ["thermal"],
    operatorInfo: ["Override console is in Crew. The AUTH CODE is not stored locally. Ask Comms — they heard Mission Control."],
    infoBySystem: {
      comms: [`If you were listening: AUTH CODE ${code}`],
      life_support: ["Ask Communications. They heard it first."],
    },
    requiredRoom: "crew",
    requiresPresence: true,
    requiredPlayers: 1,
    durationMs: durationFor("urgent", scale),
    control: { kind: "code", digits: 4, value: "" },
    solution: code,
    optimal: code,
    mc: `AUTH CODE ${code} — Communications, remember this. You will need it.`,
    voice: "Override wants the auth code from earlier. Who was listening?",
    chain: ["Auth gate locked"],
  };
}

function valveLogic(rng: Rng, scale: number, id: string): PuzzleInstance {
  const order = pick(rng, [
    ["YEL", "BLU", "RED"],
    ["RED", "YEL", "BLU"],
    ["BLU", "RED", "YEL"],
  ]);
  const map = pick(rng, [
    { YEL: "1", BLU: "2", RED: "3" },
    { YEL: "2", BLU: "3", RED: "1" },
    { YEL: "3", BLU: "1", RED: "2" },
  ]);
  const numeric = order.map((c) => map[c as keyof typeof map]);
  return {
    id,
    type: "valve_logic",
    title: "PRESSURE LEAK",
    problem: "Three manual valves. Colors are the order. Numbers are which valve. One sequence equalizes; the rest blow a gasket.",
    target: "Translate color-order into valve numbers, then open that sequence.",
    cost: "Each wrong sequence dumps 4 kPa.",
    risk: "A gasket blowout becomes unrecoverable below 28 kPa.",
    benefit: "Correct order seals the leak.",
    severity: "critical",
    assignedSystems: ["life_support"],
    controlSystems: ["life_support"],
    operatorInfo: [`Painted order: ${order.join(" then ")}`, "You see colors, not numbers. Ask Power which valve is which color."],
    infoBySystem: {
      power: [
        `Valve 1 is ${invert(map, "1")}`,
        `Valve 2 is ${invert(map, "2")}`,
        `Valve 3 is ${invert(map, "3")}`,
      ],
    },
    requiredRoom: "life_support",
    requiredItem: "coolant_cartridge",
    requiresPresence: true,
    requiredPlayers: 1,
    durationMs: durationFor("critical", scale),
    control: {
      kind: "sequence",
      slots: ["1st", "2nd", "3rd"],
      options: [
        { id: "1", label: "Valve 1" },
        { id: "2", label: "Valve 2" },
        { id: "3", label: "Valve 3" },
      ],
    },
    solution: numeric,
    optimal: numeric,
    voice: "Pressure leak. Valve colors are on life support. Numbers are on power.",
    chain: ["Pressure leak", "Cabin pressure falling"],
  };
}

function invert(map: Record<string, string>, n: string) {
  const e = Object.entries(map).find(([, v]) => v === n);
  return e ? e[0] : "?";
}

function powerSurge(rng: Rng, scale: number, id: string): PuzzleInstance {
  const keep = pick(rng, ["life_support", "thermal", "comms"] as const);
  return {
    id,
    type: "power_surge",
    title: "POWER SURGE",
    problem: "Bus overvoltage. One named branch must stay hot. Two live branches melt the inverter.",
    target: "Ask who must stay powered. Keep that one. Trip the rest. The named survivor is the only legal keep.",
    cost: "Tripped branches brown out for 20 seconds.",
    risk: "Leaving extra branches on melts the inverter. Tripping the critical one kills that system.",
    benefit: "Correct shed clears the surge.",
    severity: "urgent",
    assignedSystems: ["power"],
    controlSystems: ["power"],
    operatorInfo: ["You can trip branches from the reactor board. You do not know which must stay. Ask the crew."],
    infoBySystem: {
      life_support: keep === "life_support" ? ["KEEP LIFE SUPPORT POWERED"] : ["Life Support can brown out for 20s."],
      thermal: keep === "thermal" ? ["KEEP THERMAL POWERED"] : ["Cabin can hold temperature for 20s."],
      comms: keep === "comms" ? ["KEEP COMMS POWERED"] : ["Uplink can drop."],
    },
    requiredRoom: "power",
    requiredItem: "circuit_fuse",
    requiresPresence: true,
    requiredPlayers: 1,
    durationMs: durationFor("urgent", scale),
    control: {
      kind: "buttons",
      options: [
        { id: "life_support", label: "Keep Life Support" },
        { id: "thermal", label: "Keep Thermal" },
        { id: "comms", label: "Keep Comms" },
      ],
    },
    solution: keep,
    optimal: keep,
    voice: "Power surge. Someone knows which branch has to live. Install the fuse and shed the rest.",
    chain: ["Power surge", "Battery stressed"],
  };
}

function pressurePatch(rng: Rng, scale: number, id: string): PuzzleInstance {
  const psi = int(rng, 4, 9);
  const holes = int(rng, 2, 4);
  const foam = psi * holes;
  return {
    id,
    type: "pressure_patch",
    title: "HULL FOAM PATCH",
    problem: "Hull punctures mapped. Foam charge is differential × hole count. Undercharge leaks. Overcharge clogs a vent.",
    target: "Foam = differential × puncture count. Collect both numbers. Do not guess.",
    cost: "Foam cartridge is single-use.",
    risk: "Undercharge fails to seal. Overcharge clogs a vent and raises CO₂.",
    benefit: "Exact charge seals all punctures.",
    severity: "urgent",
    assignedSystems: ["exterior"],
    controlSystems: ["exterior"],
    operatorInfo: [
      `Puncture sites: ${holes}`,
      "Formula: foam = differential × puncture count",
      "You cannot see the kPa differential from the catwalk.",
    ],
    infoBySystem: {
      life_support: [`Differential per site: ${psi} kPa`],
    },
    requiredRoom: "airlock",
    requiredItem: "oxygen_canister",
    requiresPresence: true,
    requiredPlayers: 1,
    durationMs: durationFor("urgent", scale),
    control: {
      kind: "stepper",
      label: "Foam charge",
      unit: "units",
      min: 2,
      max: 40,
      step: 1,
      value: 8,
    },
    solution: foam,
    optimal: foam,
    chain: ["Hull punctures mapped"],
  };
}

function nearlyEqual(a: number, b: number, eps = 0.051) {
  return Math.abs(a - b) <= eps;
}

export function applyPuzzle(p: PuzzleInstance, payload: unknown, sim: Sim): ApplyResult {
  switch (p.type) {
    case "oxygen_leak": {
      const v = Number(payload);
      const need = Number(p.solution);
      sim.oxygenProduction = v;
      if (nearlyEqual(v, need, 0.1)) {
        sim.oxygenLeak = Math.max(0, sim.oxygenLeak - 2);
        return {
          ok: true,
          optimal: true,
          wasted: false,
          explanation: `Production ${v} L/min equals demand + leak (${need}). Tank stabilizes.`,
          scoreDelta: 80,
          voice: "Oxygen generator matched. Tank is holding.",
        };
      }
      if (v < need) {
        return {
          ok: true,
          optimal: false,
          wasted: false,
          explanation: `Generator at ${v} L/min. You needed ${need} (crew + leak). Cabin air is still falling ${(need - v).toFixed(1)} L/min — covering the hole is the only fix, not hoping.`,
          scoreDelta: -90,
        };
      }
      sim.extraLoad += (v - need) * sim.o2KwPerLiter * 0.35;
      return {
        ok: true,
        optimal: false,
        wasted: true,
        explanation: `Generator at ${v} L/min is ${v - need} above the hole (${need}). Cabin air rises, but you just stole ${((v - need) * sim.o2KwPerLiter).toFixed(0)} kW from heat and radios for oxygen nobody needed.`,
        scoreDelta: -40,
      };
    }
    case "power_split": {
      const body = payload as Record<string, number>;
      const sol = p.solution as Record<string, number>;
      const sum = ["life_support", "thermal", "comms", "medical", "exterior"].reduce(
        (a, k) => a + Number(body[k] || 0),
        0,
      );
      const exact = ["life_support", "thermal", "comms", "medical", "exterior"].every(
        (k) => Number(body[k]) === sol[k],
      );
      sim.loadLife = Number(body.life_support || 0);
      sim.loadThermal = Number(body.thermal || 0);
      sim.loadComms = Number(body.comms || 0);
      sim.loadMedical = Number(body.medical || 0);
      sim.loadExterior = Number(body.exterior || 0);
      if (exact && sum === sol.available) {
        return {
          ok: true,
          optimal: true,
          wasted: false,
          explanation: `Allocated ${sum} kW exactly across critical branches.`,
          scoreDelta: 90,
        };
      }
      const under = ["life_support", "thermal", "comms", "medical", "exterior"].filter(
        (k) => Number(body[k] || 0) < sol[k]!,
      );
      if (sum !== sol.available) {
        sim.temperature += 0.6;
        return {
          ok: true,
          optimal: false,
          wasted: true,
          explanation: `Allocated ${sum} kW against a ${sol.available} kW bus. Difference dumps as heat.`,
          scoreDelta: -70,
        };
      }
      if (under.length) {
        return {
          ok: true,
          optimal: false,
          wasted: false,
          explanation: `Bus totals ${sum} kW but ${under.join(", ")} is under its critical feed. Those systems will brown out.`,
          scoreDelta: -80,
        };
      }
      return {
        ok: true,
        optimal: false,
        wasted: true,
        explanation: "Branches are overfed. Totals match the bus, but heat and waste rise.",
        scoreDelta: -35,
      };
    }
    case "heater": {
      const v = Number(payload);
      const need = Number(p.solution);
      sim.heaterUntil = sim.now + v * 1000;
      sim.heaterPowerKw = 22;
      if (nearlyEqual(v, need, 0.1)) {
        return {
          ok: true,
          optimal: true,
          wasted: false,
          explanation: `${v}s of heating closes the gap at 2°C / 10s. Heater will cut out at 20°C.`,
          scoreDelta: 80,
        };
      }
      if (v < need) {
        return {
          ok: true,
          optimal: false,
          wasted: false,
          explanation: `${v}s is short of the ${need}s required. Cabin will still be below 20°C when the heater stops.`,
          scoreDelta: -60,
        };
      }
      return {
        ok: true,
        optimal: false,
        wasted: true,
        explanation: `${v}s overshoots the ${need}s target. Extra ${(v - need) * 22 / 10} kW-s burned and cabin will overheat.`,
        scoreDelta: -45,
      };
    }
    case "solar_angle": {
      const v = Number(payload);
      const need = Number(p.solution);
      sim.solarAngle = clamp(sim.solarAngle + v, 0, 90);
      const err = Math.abs(v - need);
      sim.solarEfficiency = clamp(0.92 - err / 80, 0.2, 0.98);
      if (err < 0.51) {
        return {
          ok: true,
          optimal: true,
          wasted: false,
          explanation: `Array rotated ${v}°. Now facing the ${p.optimal}° sun vector.`,
          scoreDelta: 80,
        };
      }
      return {
        ok: true,
        optimal: false,
        wasted: err > 8,
        explanation: `Rotated ${v}°. Required ${need}°. Efficiency now ${(sim.solarEfficiency * 100).toFixed(0)}%.`,
        scoreDelta: -55,
      };
    }
    case "med_dose": {
      const v = Number(payload);
      const need = Number(p.solution);
      sim.loadMedical += 6;
      if (nearlyEqual(v, need, 0.51)) {
        return {
          ok: true,
          optimal: true,
          wasted: false,
          explanation: `${v} mg matches mass × protocol (${need} mg). Patient stabilizing.`,
          scoreDelta: 90,
        };
      }
      if (v < need) {
        return {
          ok: true,
          optimal: false,
          wasted: false,
          explanation: `${v} mg is below the ${need} mg protocol dose. Treatment is partial — symptoms continue.`,
          scoreDelta: -70,
        };
      }
      return {
        ok: true,
        optimal: false,
        wasted: true,
        explanation: `${v} mg exceeds ${need} mg. Overdose: hepatic stress, health penalty incoming.`,
        scoreDelta: -95,
      };
    }
    case "freq_tune": {
      const v = Number(payload);
      const need = Number(p.solution);
      if (nearlyEqual(v, need, 0.06)) {
        sim.comms = 96;
        sim.commsDownUntil = 0;
        return {
          ok: true,
          optimal: true,
          wasted: false,
          explanation: `Receiver ${v.toFixed(1)} GHz = mission ${need.toFixed(1)} GHz. Uplink locked.`,
          scoreDelta: 80,
        };
      }
      sim.comms = Math.max(12, sim.comms - 18);
      return {
        ok: true,
        optimal: false,
        wasted: true,
        explanation: `${v.toFixed(1)} GHz is not mission + offset (${need.toFixed(1)} GHz). Carrier still in the noise.`,
        scoreDelta: -60,
      };
    }
    case "reactor_reset": {
      const body = payload as { value: number; confirms: number };
      const need = Number(p.solution);
      if (body.confirms < 2) {
        return {
          ok: false,
          optimal: false,
          wasted: false,
          explanation: "Both astronauts must CONFIRM within 3 seconds.",
          scoreDelta: 0,
        };
      }
      if (nearlyEqual(body.value, need, 0.1)) {
        sim.surgeUntil = 0;
        sim.battery = clamp(sim.battery + 6, 0, 100);
        return {
          ok: true,
          optimal: true,
          wasted: false,
          explanation: `Product ${body.value} accepted. Dual confirm synchronized. Reactor reset.`,
          scoreDelta: 140,
          voice: "Reactor reset complete. Good hands.",
        };
      }
      sim.battery = clamp(sim.battery - 8, 0, 100);
      sim.temperature += 1.4;
      return {
        ok: true,
        optimal: false,
        wasted: true,
        explanation: `Entered ${body.value}. ALPHA × BETA is ${need}. Igniter dumped heat into the bus.`,
        scoreDelta: -100,
      };
    }
    case "airlock_seal": {
      sim.pressureLeak = 0;
      sim.pressure = clamp(sim.pressure + 6, 20, 104);
      return {
        ok: true,
        optimal: true,
        wasted: false,
        explanation: "Two astronauts held the hatch. Seal is dogged. Pressure leak stopped.",
        scoreDelta: 130,
        voice: "Airlock sealed. Pressure is climbing.",
      };
    }
    case "co2_route": {
      const sel = payload as string[];
      const need = p.solution as string[];
      const match = sel.length === need.length && sel.every((v, i) => v === need[i]);
      if (match) {
        sim.co2Filter = 96;
        sim.co2 = Math.max(10, sim.co2 - 18);
        return {
          ok: true,
          optimal: true,
          wasted: false,
          explanation: `Route ${sel.join("→")} matches the safe loop. Scrubber online.`,
          scoreDelta: 85,
        };
      }
      sim.co2 = clamp(sim.co2 + 12, 0, 100);
      sim.co2Filter = Math.max(20, sim.co2Filter - 18);
      return {
        ok: true,
        optimal: false,
        wasted: true,
        explanation: `Route ${sel.join("→")} is not ${need.join("→")}. CO₂ dumped back into the bay.`,
        scoreDelta: -85,
      };
    }
    case "pattern": {
      const v = Number(payload);
      const need = Number(p.solution);
      if (v === need) {
        sim.comms = clamp(sim.comms + 20, 0, 100);
        return {
          ok: true,
          optimal: true,
          wasted: false,
          explanation: `Next symbol ${v} completes the handshake.`,
          scoreDelta: 70,
        };
      }
      sim.comms = clamp(sim.comms - 14, 0, 100);
      return {
        ok: true,
        optimal: false,
        wasted: true,
        explanation: `Injected ${v}. Handshake expected ${need}. Encryption noise rising.`,
        scoreDelta: -50,
      };
    }
    case "memory_code": {
      const v = String(payload).replace(/\D/g, "");
      const need = String(p.solution);
      if (v === need) {
        sim.heaterPowerKw = Math.max(sim.heaterPowerKw, 10);
        return {
          ok: true,
          optimal: true,
          wasted: false,
          explanation: `Code ${v} accepted. Backup heaters unlocked.`,
          scoreDelta: 75,
        };
      }
      return {
        ok: true,
        optimal: false,
        wasted: true,
        explanation: `${v || "blank"} is not the Mission Control auth code. Gate stays locked.`,
        scoreDelta: -55,
      };
    }
    case "valve_logic": {
      const sel = payload as string[];
      const need = p.solution as string[];
      const match = sel.length === need.length && sel.every((v, i) => v === need[i]);
      if (match) {
        sim.pressureLeak = 0;
        sim.pressure = clamp(sim.pressure + 4, 20, 104);
        return {
          ok: true,
          optimal: true,
          wasted: false,
          explanation: `Valve order ${sel.join("→")} equalizes the loop. Leak sealed.`,
          scoreDelta: 90,
        };
      }
      sim.pressure = clamp(sim.pressure - 4, 20, 104);
      return {
        ok: true,
        optimal: false,
        wasted: true,
        explanation: `Opened ${sel.join("→")}. Safe order is ${need.join("→")}. Lost 4 kPa.`,
        scoreDelta: -80,
      };
    }
    case "power_surge": {
      const v = String(payload);
      const need = String(p.solution);
      sim.surgeUntil = 0;
      if (v === need) {
        return {
          ok: true,
          optimal: true,
          wasted: false,
          explanation: `${v.replace("_", " ")} stayed hot. Other branches shed. Surge cleared.`,
          scoreDelta: 85,
        };
      }
      sim.battery = clamp(sim.battery - 10, 0, 100);
      sim.generation *= 0.85;
      return {
        ok: true,
        optimal: false,
        wasted: true,
        explanation: `Kept ${v.replace("_", " ")}. Critical survivor was ${need.replace("_", " ")}. Inverter took the hit.`,
        scoreDelta: -75,
      };
    }
    case "pressure_patch": {
      const v = Number(payload);
      const need = Number(p.solution);
      if (v === need) {
        sim.pressureLeak = Math.max(0, sim.pressureLeak - 1.5);
        sim.pressure = clamp(sim.pressure + 5, 20, 104);
        return {
          ok: true,
          optimal: true,
          wasted: false,
          explanation: `Foam charge ${v} = differential × punctures. Hull holding.`,
          scoreDelta: 80,
        };
      }
      if (v < need) {
        return {
          ok: true,
          optimal: false,
          wasted: false,
          explanation: `Charge ${v} is below ${need}. Punctures still open.`,
          scoreDelta: -60,
        };
      }
      sim.co2 = clamp(sim.co2 + 8, 0, 100);
      return {
        ok: true,
        optimal: false,
        wasted: true,
        explanation: `Charge ${v} exceeds ${need}. Extra foam clogged a vent. CO₂ climbing.`,
        scoreDelta: -50,
      };
    }
    default:
      return {
        ok: false,
        optimal: false,
        wasted: false,
        explanation: "Unknown procedure.",
        scoreDelta: 0,
      };
  }
}
