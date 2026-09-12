import type { RoomId, ItemType, SystemId } from "../../src/shared/constants";
import { ROOM_LABELS } from "../../src/shared/constants";
import type { HabitatPublic, SystemStatus } from "../../src/shared/protocol";

export interface WorldItem {
  id: string;
  type: ItemType;
  location: RoomId | "carried";
  carriedBy?: string;
}

export interface AstronautSim {
  id: string;
  health: number;
  suitOxygen: number;
  radiation: number;
  location: RoomId;
  movingTo: RoomId | null;
  moveStartsAt: number;
  moveEndsAt: number;
  inventory: ItemType | null;
  incapacitated: boolean;
}

export interface Sim {
  oxygen: number;
  oxygenProduction: number;
  oxygenDemand: number;
  oxygenLeak: number;
  o2KwPerLiter: number;
  co2: number;
  co2Filter: number;
  pressure: number;
  pressureLeak: number;
  generation: number;
  battery: number;
  loadLife: number;
  loadThermal: number;
  loadComms: number;
  loadMedical: number;
  loadExterior: number;
  extraLoad: number;
  temperature: number;
  heaterUntil: number;
  heaterPowerKw: number;
  coolerOn: boolean;
  comms: number;
  solarAngle: number;
  solarOptimal: number;
  solarEfficiency: number;
  radiation: number;
  dustStormUntil: number;
  solarFlareUntil: number;
  commsDownUntil: number;
  surgeUntil: number;
  now: number;
  lowestOxygen: number;
  lowestBattery: number;
  lowestTemp: number;
  closestCall: string;
  log: string[];
  chains: string[];
}

export function createSim(now: number): Sim {
  return {
    oxygen: 76,
    oxygenProduction: 18,
    oxygenDemand: 16,
    oxygenLeak: 0,
    o2KwPerLiter: 3,
    co2: 18,
    co2Filter: 92,
    pressure: 101,
    pressureLeak: 0,
    generation: 88,
    battery: 74,
    loadLife: 28,
    loadThermal: 18,
    loadComms: 10,
    loadMedical: 8,
    loadExterior: 16,
    extraLoad: 0,
    temperature: 19.4,
    heaterUntil: 0,
    heaterPowerKw: 0,
    coolerOn: false,
    comms: 90,
    solarAngle: 41,
    solarOptimal: 64,
    solarEfficiency: 0.86,
    radiation: 6,
    dustStormUntil: 0,
    solarFlareUntil: 0,
    commsDownUntil: 0,
    surgeUntil: 0,
    now,
    lowestOxygen: 76,
    lowestBattery: 74,
    lowestTemp: 19.4,
    closestCall: "Systems nominal at hatch open.",
    log: [],
    chains: [],
  };
}

export function demandKw(sim: Sim) {
  const o2 = sim.oxygenProduction * sim.o2KwPerLiter * 0.55;
  const heat = sim.now < sim.heaterUntil ? sim.heaterPowerKw : sim.coolerOn ? 12 : 6;
  const comms = sim.now < sim.commsDownUntil ? 3 : sim.loadComms;
  const med = sim.loadMedical;
  const ext = sim.loadExterior + (sim.now < sim.dustStormUntil ? 5 : 0);
  const life = Math.max(sim.loadLife, o2);
  return {
    life,
    thermal: heat,
    comms,
    medical: med,
    exterior: ext,
    extra: sim.extraLoad,
    total: life + heat + comms + med + ext + sim.extraLoad,
  };
}

export function generationKw(sim: Sim) {
  const angleErr = Math.abs(sim.solarAngle - sim.solarOptimal);
  const angleFactor = Math.max(0.18, 1 - angleErr / 78);
  const storm = sim.now < sim.dustStormUntil ? 0.38 : 1;
  const flare = sim.now < sim.solarFlareUntil ? 1.15 : 1;
  const surge = sim.now < sim.surgeUntil ? 0.55 : 1;
  return Math.max(
    8,
    118 * sim.solarEfficiency * angleFactor * storm * flare * surge,
  );
}

export function statusOf(
  value: number,
  warn: number,
  crit: number,
  invert = false,
): SystemStatus {
  if (invert) {
    if (value >= crit) return "CRITICAL";
    if (value >= warn) return "WARNING";
    return "STABLE";
  }
  if (value <= crit) return "CRITICAL";
  if (value <= warn) return "WARNING";
  return "STABLE";
}

export function habitatPublic(sim: Sim): HabitatPublic {
  const d = demandKw(sim);
  const gen = generationKw(sim);
  const powerHeadroom = gen + (sim.battery > 8 ? 12 : 0) - d.total;
  const tempStatus =
    sim.temperature < 12 || sim.temperature > 31
      ? "CRITICAL"
      : sim.temperature < 16 || sim.temperature > 26
        ? "WARNING"
        : "STABLE";
  const powerStatus =
    sim.battery < 12 || powerHeadroom < -25
      ? "CRITICAL"
      : sim.battery < 28 || powerHeadroom < -5
        ? "WARNING"
        : "STABLE";
  return {
    oxygen: statusOf(sim.oxygen, 42, 22),
    power: powerStatus,
    thermal: tempStatus,
    comms: sim.now < sim.commsDownUntil ? "CRITICAL" : statusOf(sim.comms, 45, 22),
    medical: statusOf(
      100 - Math.max(0, sim.co2 - 40) - Math.max(0, 18 - sim.temperature) * 2,
      55,
      30,
    ),
    exterior: sim.now < sim.dustStormUntil ? "CRITICAL" : statusOf(sim.solarEfficiency * 100, 50, 28),
    dustStorm: sim.now < sim.dustStormUntil,
    solarFlare: sim.now < sim.solarFlareUntil,
    pressureLeak: sim.pressureLeak > 0 || sim.pressure < 90,
    lightsDim: gen < 55 || sim.battery < 35,
    emergencyLights: gen < 32 || sim.battery < 14,
    frost: sim.temperature < 14,
    heat: sim.temperature > 27,
    commsGlitch: sim.now < sim.commsDownUntil || sim.comms < 40,
    debris: sim.pressureLeak > 0,
    solarAngle: sim.solarAngle,
    solarOptimal: sim.solarOptimal,
  };
}

export function note(sim: Sim, line: string) {
  sim.log.push(line);
  if (sim.log.length > 40) sim.log.shift();
  sim.chains.push(line);
  if (sim.chains.length > 24) sim.chains.shift();
}

export function tickSim(sim: Sim, crew: AstronautSim[], dtMs: number) {
  const dt = dtMs / 1000;
  sim.now += dtMs;
  const living = crew.filter((c) => !c.incapacitated).length;
  sim.oxygenDemand = 7.2 + living * 4.1;
  const netO2 = sim.oxygenProduction - sim.oxygenDemand - sim.oxygenLeak;
  sim.oxygen = clamp(sim.oxygen + netO2 * 0.045 * dt, 0, 100);

  const filter = sim.co2Filter / 100;
  sim.co2 = clamp(sim.co2 + living * 0.55 * dt - filter * 1.8 * dt, 4, 100);

  sim.pressure = clamp(sim.pressure - sim.pressureLeak * 0.55 * dt + 0.12 * dt, 20, 104);

  const gen = generationKw(sim);
  sim.generation = gen;
  const d = demandKw(sim);
  const netKw = gen - d.total;
  sim.battery = clamp(sim.battery + (netKw / 220) * dt, 0, 100);

  if (sim.battery <= 0.2) {
    sim.oxygenProduction = Math.min(sim.oxygenProduction, 8);
    sim.heaterUntil = Math.min(sim.heaterUntil, sim.now);
    sim.comms = Math.min(sim.comms, 25);
  }

  const heating = sim.now < sim.heaterUntil;
  const ambient = sim.now < sim.dustStormUntil ? -0.085 : -0.012;
  const leakCool = sim.pressureLeak > 0 ? -0.04 : 0;
  const heatRate = heating ? 0.2 : sim.coolerOn ? -0.16 : 0;
  sim.temperature = clamp(sim.temperature + (heatRate + ambient + leakCool) * dt * 1.15, -20, 55);

  if (sim.now < sim.commsDownUntil) {
    sim.comms = clamp(sim.comms - 4 * dt, 5, 100);
  } else {
    sim.comms = clamp(sim.comms + 1.4 * dt, 5, 100);
  }

  if (sim.now < sim.solarFlareUntil) {
    sim.radiation = clamp(sim.radiation + 6.5 * dt, 0, 100);
  } else {
    sim.radiation = clamp(sim.radiation - 0.8 * dt, 0, 100);
  }

  if (sim.oxygen < sim.lowestOxygen) {
    sim.lowestOxygen = sim.oxygen;
    sim.closestCall = `Oxygen reached ${sim.oxygen.toFixed(0)}% with ${Math.max(0, 7 * 60 - sim.now / 1000).toFixed(0)}s remaining.`;
  }
  if (sim.battery < sim.lowestBattery) {
    sim.lowestBattery = sim.battery;
  }
  if (sim.temperature < sim.lowestTemp) sim.lowestTemp = sim.temperature;

  for (const a of crew) {
    if (a.movingTo && sim.now >= a.moveEndsAt) {
      a.location = a.movingTo;
      a.movingTo = null;
    }

    const outside = currentRoom(a, sim.now) === "exterior";
    if (outside) {
      a.suitOxygen = clamp(a.suitOxygen - 3.4 * dt, 0, 100);
      if (sim.now < sim.solarFlareUntil) a.radiation = clamp(a.radiation + 9 * dt, 0, 100);
      if (sim.now < sim.dustStormUntil) a.radiation = clamp(a.radiation + 1.5 * dt, 0, 100);
    } else {
      a.suitOxygen = clamp(a.suitOxygen + 6 * dt, 0, 100);
      a.radiation = clamp(a.radiation - 0.35 * dt, 0, 100);
    }

    if (a.incapacitated) continue;

    let dmg = 0;
    if (sim.oxygen < 22) dmg += ((22 - sim.oxygen) / 22) * 3.2 * dt;
    if (sim.co2 > 62) dmg += ((sim.co2 - 62) / 40) * 2.4 * dt;
    if (sim.pressure < 70) dmg += ((70 - sim.pressure) / 70) * 2.2 * dt;
    if (sim.temperature < 12) dmg += (12 - sim.temperature) * 0.35 * dt;
    if (sim.temperature > 31) dmg += (sim.temperature - 31) * 0.32 * dt;
    if (a.radiation > 35) dmg += ((a.radiation - 35) / 65) * 2.1 * dt;
    if (a.suitOxygen < 8 && outside) dmg += 7 * dt;
    a.health = clamp(a.health - dmg, 0, 100);
    if (a.health <= 0) {
      a.incapacitated = true;
      a.health = 0;
      note(sim, `${a.id} incapacitated`);
    }
  }

  if (sim.battery < 20 && sim.now < sim.dustStormUntil) {
    /* cascade hook consumed by director */
  }
}

export function currentRoom(a: AstronautSim, now: number): RoomId {
  if (!a.movingTo || now >= a.moveEndsAt) return a.location;
  const t = (now - a.moveStartsAt) / Math.max(1, a.moveEndsAt - a.moveStartsAt);
  return t > 0.55 ? a.movingTo : a.location;
}

export function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function distRooms(a: RoomId, b: RoomId) {
  const pos: Record<RoomId, [number, number]> = {
    exterior: [2, 0],
    airlock: [1, 1],
    comms: [3, 1],
    crew: [2, 2],
    power: [1, 3],
    life_support: [3, 3],
    medical: [2, 4],
  };
  const [x1, y1] = pos[a];
  const [x2, y2] = pos[b];
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

export function moveDuration(from: RoomId, to: RoomId, playerCount: number) {
  const hops = Math.max(1, distRooms(from, to));
  const raw = 2400 + hops * 1500;
  const scaled = raw * (playerCount <= 2 ? 0.7 : 1);
  return Math.max(playerCount <= 2 ? 2100 : 3000, Math.min(playerCount <= 2 ? 5200 : 7000, scaled));
}

export function unrecoverable(sim: Sim, crew: AstronautSim[]) {
  if (crew.length > 0 && crew.every((c) => c.incapacitated)) {
    return "CREW INCAPACITATED";
  }
  if (sim.oxygen <= 0.4 && sim.oxygenProduction < sim.oxygenDemand) {
    return "LIFE SUPPORT COLLAPSE";
  }
  if (sim.pressure <= 28) return "CABIN DECOMPRESSION";
  if (sim.temperature <= -8) return "THERMAL COLLAPSE";
  if (sim.temperature >= 46) return "HABITAT OVERHEAT";
  if (sim.battery <= 0.2 && sim.generation < 12 && sim.oxygen < 12) {
    return "TOTAL POWER LOSS";
  }
  return null;
}

export function systemGauges(sim: Sim, systems: SystemId[]): Record<string, string> {
  const d = demandKw(sim);
  const out: Record<string, string> = {};
  if (systems.includes("life_support")) {
    out["O₂ tank"] = `${sim.oxygen.toFixed(1)}%`;
    out["O₂ production"] = `${sim.oxygenProduction.toFixed(1)} L/min`;
    out["Crew demand"] = `${sim.oxygenDemand.toFixed(1)} L/min`;
    out["Leak"] = `${sim.oxygenLeak.toFixed(1)} L/min`;
    out["CO₂"] = `${sim.co2.toFixed(0)}%`;
    out["Filter"] = `${sim.co2Filter.toFixed(0)}%`;
    out["Pressure"] = `${sim.pressure.toFixed(1)} kPa`;
  }
  if (systems.includes("power")) {
    out["Generation"] = `${sim.generation.toFixed(0)} kW`;
    out["Battery"] = `${sim.battery.toFixed(1)}%`;
    out["Demand"] = `${d.total.toFixed(0)} kW`;
    out["O₂ power cost"] = `${sim.o2KwPerLiter} kW / L/min`;
    out["Headroom"] = `${(sim.generation - d.total).toFixed(0)} kW`;
  }
  if (systems.includes("thermal")) {
    out["Cabin temp"] = `${sim.temperature.toFixed(1)}°C`;
    out["Heater"] = sim.now < sim.heaterUntil ? "ON" : "OFF";
    out["Cooler"] = sim.coolerOn ? "ON" : "OFF";
  }
  if (systems.includes("comms")) {
    out["Signal"] = `${sim.comms.toFixed(0)}%`;
    out["Uplink"] = sim.now < sim.commsDownUntil ? "NOMINAL FAIL" : "LOCKED";
  }
  if (systems.includes("medical")) {
    out["Cabin radiation"] = `${sim.radiation.toFixed(0)}%`;
    out["CO₂ (clinic)"] = `${sim.co2.toFixed(0)}%`;
  }
  if (systems.includes("exterior")) {
    out["Array angle"] = `${sim.solarAngle.toFixed(0)}°`;
    out["Solar efficiency"] = `${(sim.solarEfficiency * 100).toFixed(0)}%`;
    out["Dust"] = sim.now < sim.dustStormUntil ? "STORM" : "CLEAR";
  }
  return out;
}

export function roomName(id: RoomId) {
  return ROOM_LABELS[id];
}
