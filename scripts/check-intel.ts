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
assert(o2.ia.some((l) => /Crew on board/.test(l)), "operator sees crew");
assert(!o2.ia.some((l) => /Hull leak|Metabolic rate/.test(l)), "operator must not see leak or rate");
assert(o2.ib.some((l) => /Hull leak/.test(l)), "partner sees leak");
assert(o2.ib.some((l) => /Metabolic rate/.test(l)), "partner sees rate");
assert(!o2.ib.some((l) => /Crew on board/.test(l)), "partner must not see crew count");

const med = run("med_dose", two[0]!, two[1]!);
assert(med.aCtrl && !med.bCtrl, "Medical (on A) holds the syringe");
assert(med.ia.some((l) => /Patient mass/.test(l)), "operator sees mass");
assert(!med.ia.some((l) => /MISSION CONTROL PROTOCOL|Hypoxia adjuvant:/.test(l)), "operator must not see protocol or adjuvant numbers");
assert(med.ib.some((l) => /MISSION CONTROL PROTOCOL/.test(l)), "partner receives leftover protocol");
assert(med.ib.some((l) => /Hypoxia adjuvant:/.test(l)), "partner receives leftover adjuvant");

const split = run("power_split", two[0]!, two[1]!);
assert(!split.aCtrl && split.bCtrl, "Power (on B) holds the bus");
assert(split.ib.some((l) => /Available bus/.test(l)), "operator sees bus");
assert(!split.ib.some((l) => /critical requirement/.test(l)), "operator must not see station draws");
assert(split.ia.filter((l) => /critical requirement/.test(l)).length >= 5, "intel player gets all five draws");

console.log("intel split ok");
