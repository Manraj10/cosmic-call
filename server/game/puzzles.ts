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
    "There is one right number: crew use + leak. Set the generator there. Cranking it higher is not safer — extra O₂ steals kilowatts from heat and radios, and the tank does not need a surplus if you cover the hole.",
  power_split:
    "Ask every station for their critical draw. Set each slider to that number. The total must equal the bus — leftover power dumps as heat, and a shorted branch brownouts.",
  heater:
    "Gap ÷ rate = how long to run. Hit the cabin target and stop. Extra seconds cook the crew and drain the battery.",
  solar_angle:
    "Rotate by (optimal − current). One angle. Past the sun is as bad as short of it.",
  med_dose:
    "Dose = mass × protocol. Underdose fails. Overdose wrecks the liver. Only the product is legal.",
  freq_tune:
    "Lock to base frequency + interference offset. Any other number is silence.",
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
  const consumption = int(rng, 14, 18);
  const leak = int(rng, 4, 7);
  const current = consumption - int(rng, 0, 2);
  const required = consumption + leak;
  const kw = sim.o2KwPerLiter;
  const extra = Math.max(0, required - current);
  sim.oxygenDemand = consumption;
  sim.oxygenLeak = leak;
  sim.oxygenProduction = current;
  return {
    id,
    type: "oxygen_leak",
    title: "OXYGEN LEAK",
    problem: `Hull microfracture. Crew is burning oxygen and a leak is hissing out a hole. Generator is behind.`,
    target: "Set production to crew use + leak. That sum is the only legal setting — not max, not “a little extra.”",
    howTo: PUZZLE_HOW_TO.oxygen_leak,
    cost: `Each extra L/min costs ${kw} kW that heaters and comms also need.`,
    risk: "Too low: people suffocate. Too high: you ‘fix’ air and brown out the habitat.",
    benefit: "Matching the hole stops the fall without wasting power.",
    severity: "urgent",
    assignedSystems: ["life_support"],
    controlSystems: ["life_support"],
    infoBySystem: {
      life_support: [
        `Crew consumption: ${consumption} L/min`,
        `Leak: ${leak} L/min`,
        `Current production: ${current} L/min`,
      ],
      power: [
        `Each additional L/min oxygen generation requires ${kw} kW`,
        `Raising output by ${extra} L/min would cost ${extra * kw} kW`,
        `Current generation: ${sim.generation.toFixed(0)} kW`,
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
      max: 36,
      step: 1,
      value: current,
    },
    solution: required,
    optimal: required,
    voice: "Habitat oxygen is falling. Life support, check your generator math.",
    mc: "LIFE SUPPORT: hull leak confirmed. Demand plus leak is your target.",
    chain: ["Oxygen leak detected", `Leak ${leak} L/min`],
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
    infoBySystem: {
      power: [`Available bus: ${available} kW`, "Ask each station for their critical draw."],
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
  const delta = target - current;
  const seconds = (delta / rate) * every;
  sim.temperature = current;
  return {
    id,
    type: "heater",
    title: "TEMPERATURE DROP",
    problem: `Cabin is ${current}°C. Crew comfort is ${target}°C — not warmer.`,
    target: `Gap ÷ rate = run time. Close ${delta}°C at +${rate}°C every ${every}s, then cut the heater.`,
    howTo: PUZZLE_HOW_TO.heater,
    cost: "Heater draws 22 kW for the entire duration.",
    risk: "Short run: hypothermia. Long run: wasted power and overshoot.",
    benefit: "Exact duration reaches 20°C as the heater cuts out.",
    severity: "urgent",
    assignedSystems: ["thermal"],
    controlSystems: ["thermal"],
    infoBySystem: {
      thermal: [`Cabin: ${current}°C`, `Heater rate: +${rate}°C every ${every} seconds`],
      life_support: [`Crew comfort target: ${target}°C`, "Do not overshoot — metabolic O₂ demand rises with heat."],
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
  const delta = pick(rng, [18, 21, 24, 25, 27, 30]);
  const current = optimal - delta;
  sim.solarOptimal = optimal;
  sim.solarAngle = current;
  sim.solarEfficiency = 0.58;
  return {
    id,
    type: "solar_angle",
    title: "SOLAR PANEL ALIGNMENT",
    problem: `Arrays sit at ${current}°. Sun is elsewhere. Generation is down.`,
    target: "Rotate by (optimal sun angle − current park angle). One number. Past the sun is as wrong as short of it.",
    howTo: PUZZLE_HOW_TO.solar_angle,
    cost: "Actuators draw 6 kW during the slew.",
    risk: "Wrong angle reduces efficiency further. Over-rotation past the sun wastes the move.",
    benefit: "Correct angle restores solar generation.",
    severity: "routine",
    assignedSystems: ["exterior"],
    controlSystems: ["exterior"],
    infoBySystem: {
      exterior: [`Current angle: ${current}°`, "You can slew the array from the exterior catwalk."],
      power: [`Telemetry: optimal sun angle is ${optimal}°`],
      comms: [`Mission Control ephemeris: solar vector ${optimal}°`],
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
    solution: delta,
    optimal: delta,
    voice: "Solar output is off-peak. Someone has to go outside and slew the arrays.",
    chain: ["Solar panels off-angle", "Power generation decreased"],
  };
}

function medDose(rng: Rng, scale: number, id: string): PuzzleInstance {
  const mass = pick(rng, [58, 62, 65, 70, 74, 81, 88]);
  const mgkg = pick(rng, [1.5, 2, 2.5, 3]);
  const dose = mass * mgkg;
  const name = pick(rng, ["HALO", "VEGA", "ION", "NOVA"]);
  return {
    id,
    type: "med_dose",
    title: "MEDICAL EMERGENCY",
    problem: `Astronaut ${name} is hypoxic. Protocol is weight-based — one milligram off is harm.`,
    target: "Push mass × protocol. Underdose fails. Overdose hits the liver. Only the product is legal.",
    howTo: PUZZLE_HOW_TO.med_dose,
    cost: "Treatment occupies Medical bus for 20 seconds.",
    risk: "Wrong milligrams injure the patient. Delay lets health keep falling.",
    benefit: "Exact dose stabilizes the astronaut.",
    severity: "critical",
    assignedSystems: ["medical"],
    controlSystems: ["medical"],
    infoBySystem: {
      medical: [`Patient mass: ${mass} kg`, "Syringe is graduated in milligrams."],
      comms: [`MISSION CONTROL PROTOCOL: ${mgkg} mg/kg antirad-oxygenate`],
      life_support: [`Clinic note: dose = mass × protocol. Protocol is on the comms channel.`],
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
    voice: "Medical emergency. Dose is mass times protocol. Protocol is on the comms board.",
    mc: `MEDICAL PROTOCOL ${mgkg} mg/kg. Confirm patient mass before you push.`,
    chain: ["Medical emergency", "Treatment will draw medical power"],
  };
}

function freqTune(rng: Rng, scale: number, id: string): PuzzleInstance {
  const base = Math.round((7.2 + rng() * 1.8) * 10) / 10;
  const offset = Math.round((0.2 + rng() * 0.5) * 10) / 10;
  const target = Math.round((base + offset) * 10) / 10;
  return {
    id,
    type: "freq_tune",
    title: "COMMUNICATION FAILURE",
    problem: "Uplink dropped. Plasma is shoving the carrier. One frequency locks Earth; every other number is silence.",
    target: "Tune to base beacon + interference offset. Add the two numbers you collect. Do not sweep at random.",
    cost: "Transmitter draws 4 kW while sweeping.",
    risk: "Wrong lock loses Mission Control warnings until retuned.",
    benefit: "Correct lock restores intel and flare forecasts.",
    severity: "urgent",
    assignedSystems: ["comms"],
    controlSystems: ["comms"],
    infoBySystem: {
      comms: [`Atmospheric interference offset: +${offset.toFixed(1)} GHz`],
      exterior: [`Beacon etched on the high-gain: ${base.toFixed(1)} GHz`],
      power: [`Last locked carrier was ${base.toFixed(1)} GHz before the drop.`],
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
    infoBySystem: {
      life_support: [p.clueB, "Install the repair kit, then route."],
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
    problem: `Handshake stream: ${seq.join(" · ")} · ?`,
    target: "Read the rule on the stream, then enter the next number. Guessing desyncs the uplink.",
    cost: "Failed handshake adds 8 seconds of comms noise.",
    risk: "A wrong next-symbol desyncs encryption for a full minute.",
    benefit: "Correct symbol restores a clean uplink burst.",
    severity: "routine",
    assignedSystems: ["comms"],
    controlSystems: ["power"],
    infoBySystem: {
      comms: [`Stream: ${seq.join(" · ")}`, `Pattern family: ${rule}`],
      power: ["The reactor console is the only keypad that can inject the next handshake symbol."],
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
    infoBySystem: {
      thermal: ["Override console is in Crew. The code is not stored locally."],
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
    infoBySystem: {
      life_support: [`Painted order: ${order.join(" then ")}`, "You see colors, not numbers."],
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
    infoBySystem: {
      power: ["You can trip branches from the reactor board. You do not know which must stay."],
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
    problem: `${holes} puncture sites at ${psi} kPa differential each.`,
    target: "Foam = differential × puncture count. Undercharge leaks. Overcharge clogs a vent and raises CO₂.",
    cost: "Foam cartridge is single-use.",
    risk: "Undercharge fails to seal. Overcharge clogs a vent and raises CO₂.",
    benefit: "Exact charge seals all punctures.",
    severity: "urgent",
    assignedSystems: ["exterior"],
    controlSystems: ["exterior"],
    infoBySystem: {
      exterior: [`Puncture sites: ${holes}`],
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
