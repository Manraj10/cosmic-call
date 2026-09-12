import { int, type Rng } from "./rng";
import type { Sim } from "./simulation";
import { note } from "./simulation";

export interface Planned {
  atMs: number;
  type: string;
}

const CORE = [
  "oxygen_leak",
  "solar_angle",
  "freq_tune",
  "heater",
  "co2_route",
  "med_dose",
  "power_split",
  "reactor_reset",
  "pressure_patch",
  "airlock_seal",
  "pattern",
  "power_surge",
  "valve_logic",
  "memory_code",
] as const;

export function planMission(rng: Rng, playerCount: number): Planned[] {
  const pairs: [(typeof CORE)[number], (typeof CORE)[number]][] = [
    ["oxygen_leak", "heater"],
    ["power_split", "freq_tune"],
    ["med_dose", "solar_angle"],
    ["co2_route", "pressure_patch"],
    ["valve_logic", "power_surge"],
    ["reactor_reset", "airlock_seal"],
    ["memory_code", "pattern"],
  ];
  const span = 7 * 60 * 1000;
  const start = 14000;
  const gap = playerCount <= 2 ? 52000 : playerCount === 3 ? 42000 : 34000;
  const out: Planned[] = [];
  let t = start;
  for (const [a, b] of pairs) {
    if (t > span - 28000) break;
    out.push({ atMs: t, type: a });
    out.push({ atMs: t + 2500, type: b });
    t += int(rng, Math.floor(gap * 0.85), Math.floor(gap * 1.15));
  }
  const mem = out.find((e) => e.type === "memory_code");
  if (mem && mem.atMs < 90000) mem.atMs = 110000 + int(rng, 0, 40000);
  out.sort((a, b) => a.atMs - b.atMs);
  return out;
}

export function environmentalAt(elapsed: number, sim: Sim, rng: Rng, spawned: Set<string>) {
  const events: { type: string; title: string; voice: string; apply: () => void }[] = [];
  if (elapsed > 70000 && !spawned.has("dust") && (sim.solarEfficiency > 0.5 || sim.battery < 60)) {
    spawned.add("dust");
    events.push({
      type: "dust_storm",
      title: "DUST STORM",
      voice: "Dust storm on the ridge. Solar generation will fall. Temperature will fall. Comms will get noisy.",
      apply: () => {
        sim.dustStormUntil = sim.now + 95000;
        sim.solarEfficiency = Math.min(sim.solarEfficiency, 0.48);
        sim.comms = Math.min(sim.comms, 55);
        note(sim, "Dust storm");
        note(sim, "Solar output -60%");
      },
    });
  }
  if (elapsed > 210000 && !spawned.has("flare") && (sim.comms < 70 || sim.radiation > 8)) {
    spawned.add("flare");
    events.push({
      type: "solar_flare",
      title: "SOLAR FLARE",
      voice: "Solar flare inbound. Get off the exterior. Radiation is climbing.",
      apply: () => {
        sim.solarFlareUntil = sim.now + 50000;
        note(sim, "Solar flare");
        note(sim, "Radiation climbing");
      },
    });
  }
  if (sim.temperature > 28 && sim.battery < 40 && !spawned.has("heat_surge")) {
    spawned.add("heat_surge");
    events.push({
      type: "power_surge",
      title: "POWER SURGE",
      voice: "Cooling is overworking the bus. Surge likely.",
      apply: () => {
        sim.surgeUntil = sim.now + 35000;
        note(sim, "Cooling overworked");
        note(sim, "Battery stressed");
        note(sim, "Power surge");
      },
    });
  }
  if (sim.oxygen < 35 && sim.oxygenLeak === 0 && !spawned.has("secondary_leak") && elapsed > 120000) {
    spawned.add("secondary_leak");
    events.push({
      type: "oxygen_leak",
      title: "SECONDARY O₂ LEAK",
      voice: "Secondary leak. Life support, you already know this dance.",
      apply: () => {
        sim.oxygenLeak = Math.max(sim.oxygenLeak, 3);
        note(sim, "Secondary oxygen leak");
      },
    });
  }
  if (sim.battery < 22 && sim.now < sim.dustStormUntil && !spawned.has("brownout_chain")) {
    spawned.add("brownout_chain");
    note(sim, "Battery depleted under storm load");
  }
  void rng;
  return events;
}
