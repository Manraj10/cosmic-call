import { applyCascadeRipple, stampIncident } from "../server/game/cascade";
import { GameRoom, makeHost } from "../server/game/room";
import { createSim } from "../server/game/simulation";
import { createPuzzle, intelFor } from "../server/game/puzzles";
import type { SystemId } from "../src/shared/constants";

const rng = () => 0.42;
const sim = createSim(0);
const two: SystemId[][] = [
  ["life_support", "medical", "comms"],
  ["power", "thermal", "exterior"],
];

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

function run(type: string, a: SystemId[], b: SystemId[]) {
  const p = createPuzzle(type, rng, sim, 1, "t");
  const aCtrl = p.controlSystems.some((s) => a.includes(s));
  const bCtrl = p.controlSystems.some((s) => b.includes(s));
  const ia = intelFor(p, a, aCtrl, two);
  const ib = intelFor(p, b, bCtrl, two);
  return { p, aCtrl, bCtrl, ia, ib };
}

const o2 = run("oxygen_leak", two[0]!, two[1]!);
assert(o2.aCtrl && !o2.bCtrl, "LS should hold the O2 dial");
assert(o2.ia.some((l) => /^CREW /.test(l)), "operator sees crew");
assert(!o2.ia.some((l) => /^LEAK |^RATE /.test(l)), "operator must not see leak or rate");
assert(o2.ib.some((l) => /^LEAK /.test(l)), "partner sees leak");
assert(o2.ib.some((l) => /^RATE /.test(l)), "partner sees rate");
assert(!o2.ib.some((l) => /^CREW /.test(l)), "partner must not see crew count");

const med = run("med_dose", two[0]!, two[1]!);
assert(med.aCtrl && !med.bCtrl, "Medical (on A) holds the syringe");
assert(med.ia.some((l) => /^MASS /.test(l)), "operator sees mass");
assert(!med.ia.some((l) => /^PROTOCOL |^ADJUVANT /.test(l)), "operator must not see protocol or adjuvant numbers");
assert(med.ib.some((l) => /^PROTOCOL /.test(l)), "partner receives leftover protocol");
assert(med.ib.some((l) => /^ADJUVANT /.test(l)), "partner receives leftover adjuvant");

const split = run("power_split", two[0]!, two[1]!);
assert(!split.aCtrl && split.bCtrl, "Power (on B) holds the bus");
assert(split.ib.some((l) => /^BUS /.test(l)), "operator sees bus");
assert(!split.ib.some((l) => /^LIFE SUPPORT |^THERMAL |^COMMS |^MEDICAL |^EXTERIOR /.test(l)), "operator must not see station draws");
assert(split.ia.filter((l) => /^(LIFE SUPPORT|THERMAL|COMMS|MEDICAL|EXTERIOR) /.test(l)).length >= 5, "intel player gets all five draws");

console.log("intel split ok");

const o2p = createPuzzle("oxygen_leak", rng, sim, 1, "o2");
const heat = createPuzzle("heater", rng, sim, 1, "ht");
stampIncident(o2p);
stampIncident(heat);
assert(o2p.incidentId === heat.incidentId, "O2 and heater share a hull-breach incident");
assert(o2p.incidentTitle === "HULL BREACH", "incident titled hull breach");
const rip = applyCascadeRipple(o2p, { optimal: false, wasted: true }, [heat]);
assert(Number(heat.solution) > 0 && /THERMAL/.test(rip.pulse), "O2 overshoot must change the heater number");
assert(rip.tightenMs > 0, "partner timer should tighten after a wasted solve");
console.log("cascade ripple ok");

{
  const sink = { emitTo() {} };
  const host = makeHost("Alpha", "s1");
  const room = new GameRoom(sink, "TRD1", host);
  const bravo = room.addPlayer("Bravo", "s2");
  if (!bravo) throw new Error("bravo missing");
  room.phase = "playing";
  const kit = room.items.find((i) => i.type === "repair_kit");
  if (!kit) throw new Error("no kit");
  kit.location = "carried";
  kit.carriedBy = host.id;
  host.astro.inventory = "repair_kit";
  host.astro.location = "crew";
  bravo.astro.location = "crew";
  room.trade(host.id, bravo.id);
  assert(bravo.astro.inventory === "repair_kit", "bravo received kit");
  assert(host.astro.inventory === null, "alpha hands empty after handoff");
  const cell = room.items.find((i) => i.type === "battery_cell");
  if (!cell) throw new Error("no cell");
  cell.location = "carried";
  cell.carriedBy = host.id;
  host.astro.inventory = "battery_cell";
  room.trade(host.id, bravo.id);
  assert(String(bravo.astro.inventory) === "battery_cell", "swap gave cell to bravo");
  assert(String(host.astro.inventory) === "repair_kit", "swap returned kit to alpha");
  room.destroy();
  console.log("kit trade ok");
}
