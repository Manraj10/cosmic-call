import {
  ITEM_HOME,
  ITEM_LABELS,
  ITEMS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  MISSION_MS,
  ROOM_LABELS,
  SCORE_START,
  SUIT_COLORS,
  TICK_MS,
  makeRoomCode,
  type ItemType,
  type RoomId,
  type SystemId,
} from "../../src/shared/constants";
import type {
  ClientState,
  EndState,
  ItemPublic,
  PlayerPublic,
  TaskControl,
  TaskView,
  TimelineEvent,
  TutorialView,
} from "../../src/shared/protocol";
import { environmentalAt, planMission } from "./director";
import { fallbackRecap, grokLine, grokRecap } from "./grok";
import { applyPuzzle, createPuzzle, type PuzzleInstance } from "./puzzles";
import { mulberry32, pick, type Rng } from "./rng";
import { maxUrgentTasks, roleCard, ROLE_DEFS, rolesForCount, timerScale } from "./roles";
import {
  createSim,
  currentRoom,
  habitatPublic,
  moveDuration,
  note,
  systemGauges,
  tickSim,
  unrecoverable,
  type AstronautSim,
  type Sim,
  type WorldItem,
} from "./simulation";

export function makeCode() {
  return makeRoomCode();
}

export function newId() {
  return crypto.randomUUID();
}

export function newToken() {
  const a = new Uint8Array(12);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

export interface RoomSink {
  emitTo(socketId: string, event: string, payload: unknown): void;
}

export interface Player {
  id: string;
  token: string;
  name: string;
  color: string;
  avatar: number;
  slot: number;
  socketId: string | null;
  roleId: ReturnType<typeof rolesForCount>[number] | null;
  ready: boolean;
  tutorialDone: boolean;
  connected: boolean;
  astro: AstronautSim;
}

interface InternalTask {
  puzzle: PuzzleInstance;
  createdAt: number;
  deadlineAt: number;
  resolved: boolean;
  failed: boolean;
  control: TaskControl;
  hold: Map<string, number>;
  confirms: Map<string, { at: number; value: number }>;
}

export function makeHost(name: string, socketId: string): Player {
  const id = newId();
  return {
    id,
    token: newToken(),
    name: (name || "Astronaut").trim().slice(0, 18) || "Astronaut",
    color: SUIT_COLORS[0]!,
    avatar: 0,
    slot: 0,
    socketId,
    roleId: null,
    ready: false,
    tutorialDone: false,
    connected: true,
    astro: {
      id,
      name: (name || "Astronaut").trim().slice(0, 18) || "Astronaut",
      health: 100,
      suitOxygen: 100,
      radiation: 0,
      location: "crew",
      movingTo: null,
      moveStartsAt: 0,
      moveEndsAt: 0,
      inventory: null,
      incapacitated: false,
    },
  };
}

export class GameRoom {
  code: string;
  sink: RoomSink;
  hostId: string;
  players = new Map<string, Player>();
  phase: ClientState["phase"] = "lobby";
  phaseEndsAt: number | null = null;
  startedAt = 0;
  sim: Sim = createSim(Date.now());
  items: WorldItem[] = [];
  tasks: InternalTask[] = [];
  timeline: TimelineEvent[] = [];
  score = SCORE_START;
  seed: number;
  rng: Rng;
  plan: { atMs: number; type: string }[] = [];
  planIndex = 0;
  envSpawned = new Set<string>();
  voice: { id: string; text: string } | null = null;
  missionControl: string | null = null;
  earlyAuth: string | null = null;
  stats = {
    optimalSolutions: 0,
    incorrectSolutions: 0,
    emergenciesSurvived: 0,
    astronautsRevived: 0,
  };
  end: EndState | null = null;
  tickTimer: ReturnType<typeof setInterval> | null = null;
  lastBroadcast = 0;
  memoryWhispered = false;

  constructor(sink: RoomSink, code: string, host: Player) {
    this.sink = sink;
    this.code = code;
    this.hostId = host.id;
    this.seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    this.rng = mulberry32(this.seed);
    this.players.set(host.id, host);
    this.bootItems();
    this.tickTimer = setInterval(() => this.tick(), TICK_MS);
  }

  destroy() {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;
  }

  bootItems() {
    this.items = ITEMS.map((type) => ({
      id: `item_${type}`,
      type,
      location: ITEM_HOME[type],
    }));
  }

  addPlayer(name: string, socketId: string): Player | null {
    if (this.players.size >= MAX_PLAYERS) return null;
    if (this.phase !== "lobby") return null;
    const slot = this.nextSlot();
    const id = newId();
    const p: Player = {
      id,
      token: newToken(),
      name: name.slice(0, 18),
      color: SUIT_COLORS[slot]!,
      avatar: slot,
      slot,
      socketId,
      roleId: null,
      ready: false,
      tutorialDone: false,
      connected: true,
      astro: {
        id,
        name: name.slice(0, 18),
        health: 100,
        suitOxygen: 100,
        radiation: 0,
        location: "crew",
        movingTo: null,
        moveStartsAt: 0,
        moveEndsAt: 0,
        inventory: null,
        incapacitated: false,
      },
    };
    this.players.set(id, p);
    this.push("info", `${p.name} boarded.`);
    return p;
  }

  reconnect(token: string, socketId: string) {
    for (const p of this.players.values()) {
      if (p.token === token) {
        p.socketId = socketId;
        p.connected = true;
        return p;
      }
    }
    return null;
  }

  nextSlot() {
    const used = new Set([...this.players.values()].map((p) => p.slot));
    for (let i = 0; i < 4; i++) if (!used.has(i)) return i;
    return this.players.size;
  }

  dropSocket(socketId: string) {
    for (const p of this.players.values()) {
      if (p.socketId === socketId) {
        p.connected = false;
        p.socketId = null;
        this.push("warn", `${p.name} lost signal.`);
      }
    }
  }

  start(byId: string) {
    if (byId !== this.hostId) return "Only the mission lead can start.";
    if (this.phase !== "lobby") return "Mission already underway.";
    if (this.players.size < MIN_PLAYERS) return "Need at least 2 astronauts.";
    const roles = rolesForCount(this.players.size);
    const ordered = [...this.players.values()].sort((a, b) => a.slot - b.slot);
    ordered.forEach((p, i) => {
      p.roleId = roles[i]!;
      p.ready = false;
      p.tutorialDone = false;
      p.astro.location = spawnRoom(p.roleId);
    });
    this.phase = "role_intro";
    this.phaseEndsAt = Date.now() + 15000;
    this.speak("Ares Habitat, this is Mission Control. Check your boards. You do not have the whole picture.");
    this.broadcast();
    return null;
  }

  ready(id: string) {
    const p = this.players.get(id);
    if (!p) return;
    p.ready = true;
    if (this.phase === "role_intro") {
      const all = [...this.players.values()].every((x) => x.ready);
      if (all) this.enterTutorial();
    }
  }

  enterTutorial() {
    this.phase = "tutorial";
    this.phaseEndsAt = Date.now() + 28000;
    for (const p of this.players.values()) p.tutorialDone = false;
    this.speak("Training pulse. Fifty kilowatts on the bus. You need sixty. Use the emergency battery.");
    this.broadcast();
  }

  tutorial(id: string, optionId: string) {
    const p = this.players.get(id);
    if (!p || this.phase !== "tutorial") return;
    if (optionId === "battery") {
      p.tutorialDone = true;
      this.score += 20;
    }
    if ([...this.players.values()].every((x) => x.tutorialDone)) this.enterCountdown();
    this.broadcast();
  }

  enterCountdown() {
    this.phase = "countdown";
    this.phaseEndsAt = Date.now() + 4500;
    this.speak("Ares Habitat. Mars. Sol 147. Rescue vehicle in seven minutes. Survive.");
    this.broadcast();
  }

  beginPlay() {
    this.phase = "playing";
    this.startedAt = Date.now();
    this.phaseEndsAt = this.startedAt + MISSION_MS;
    this.sim = createSim(Date.now());
    this.plan = planMission(this.rng, this.players.size);
    this.planIndex = 0;
    this.envSpawned.clear();
    this.earlyAuth = String(1000 + Math.floor(this.rng() * 9000));
    this.push("ok", "Fifteen seconds of quiet. It will not last.");
    this.speak("You have a few seconds of stability. Use them. Talk.");
    this.broadcast();
  }

  move(id: string, room: RoomId) {
    const p = this.players.get(id);
    if (!p || this.phase !== "playing") return;
    if (p.astro.incapacitated) return;
    if (p.astro.movingTo) return;
    if (p.astro.location === room) return;
    const now = Date.now();
    const dur = moveDuration(p.astro.location, room, this.players.size);
    p.astro.movingTo = room;
    p.astro.moveStartsAt = now;
    p.astro.moveEndsAt = now + dur;
    this.sim.now = now;
  }

  pickup(id: string, itemId: string) {
    const p = this.players.get(id);
    if (!p || this.phase !== "playing" || p.astro.incapacitated) return;
    const item = this.items.find((i) => i.id === itemId);
    if (!item || item.location === "carried") return;
    const loc = currentRoom(p.astro, Date.now());
    if (item.location !== loc) {
      this.whisper(p, `The ${ITEM_LABELS[item.type]} is in ${ROOM_LABELS[item.location as RoomId]}.`);
      return;
    }
    if (p.astro.inventory) {
      this.whisper(p, `Hands full — drop the ${ITEM_LABELS[p.astro.inventory]} first.`);
      return;
    }
    item.location = "carried";
    item.carriedBy = p.id;
    p.astro.inventory = item.type;
    this.push("info", `${p.name} grabbed ${ITEM_LABELS[item.type]}.`);
  }

  drop(id: string) {
    const p = this.players.get(id);
    if (!p || !p.astro.inventory) return;
    const item = this.items.find((i) => i.carriedBy === p.id);
    const loc = currentRoom(p.astro, Date.now());
    if (item) {
      item.location = loc;
      item.carriedBy = undefined;
    }
    this.push("info", `${p.name} dropped ${ITEM_LABELS[p.astro.inventory]} in ${ROOM_LABELS[loc]}.`);
    p.astro.inventory = null;
  }

  revive(id: string, targetId: string) {
    const p = this.players.get(id);
    const t = this.players.get(targetId);
    if (!p || !t || this.phase !== "playing") return;
    if (p.astro.incapacitated || !t.astro.incapacitated) return;
    if (p.astro.inventory !== "medical_kit") {
      this.whisper(p, "You need a Medical Kit to revive.");
      return;
    }
    const now = Date.now();
    if (currentRoom(p.astro, now) !== currentRoom(t.astro, now)) {
      this.whisper(p, "Get next to them.");
      return;
    }
    t.astro.incapacitated = false;
    t.astro.health = 42;
    this.stats.astronautsRevived += 1;
    this.score += 250;
    this.push("ok", `${p.name} revived ${t.name}.`);
    this.speak(`${t.name} is back. Do not make a habit of this.`);
  }

  taskUpdate(id: string, taskId: string, payload: unknown) {
    const t = this.tasks.find((x) => x.puzzle.id === taskId && !x.resolved);
    if (!t) return;
    t.control = mergeControl(t.control, payload);
    this.broadcast();
  }

  hold(id: string, taskId: string, holding: boolean) {
    const t = this.tasks.find((x) => x.puzzle.id === taskId && !x.resolved);
    const p = this.players.get(id);
    if (!t || !p || t.puzzle.type !== "airlock_seal") return;
    const now = Date.now();
    if (currentRoom(p.astro, now) !== "airlock") return;
    if (holding) t.hold.set(id, now);
    else t.hold.delete(id);
  }

  taskConfirm(id: string, taskId: string, payload: unknown) {
    const t = this.tasks.find((x) => x.puzzle.id === taskId && !x.resolved);
    const p = this.players.get(id);
    if (!t || !p || this.phase !== "playing") return;
    const puzzle = t.puzzle;
    const now = Date.now();
    const loc = currentRoom(p.astro, now);

    if (puzzle.requiresPresence && puzzle.requiredRoom && loc !== puzzle.requiredRoom) {
      this.whisper(p, `You must be in ${ROOM_LABELS[puzzle.requiredRoom]}.`);
      return;
    }
    if (puzzle.requiredItem && p.astro.inventory !== puzzle.requiredItem) {
      this.whisper(p, `Need ${ITEM_LABELS[puzzle.requiredItem]} in hand.`);
      return;
    }
    if (puzzle.requiredPlayers >= 2 && puzzle.type === "airlock_seal") {
      return;
    }

    if (puzzle.type === "reactor_reset") {
      const value = Number((payload as { value?: number })?.value ?? (t.control as { value?: number }).value ?? 0);
      t.confirms.set(id, { at: now, value });
      const recent = [...t.confirms.values()].filter((c) => now - c.at <= 3000);
      if (recent.length < 2) {
        this.whisper(p, "Waiting for the other astronaut to CONFIRM within 3 seconds.");
        this.broadcast();
        return;
      }
      const values = new Set(recent.map((c) => c.value));
      const used = consumeItem(this, p, puzzle.requiredItem);
      const result = applyPuzzle(puzzle, { value, confirms: values.size === 1 ? 2 : 0 }, this.sim);
      this.finishTask(t, result, used);
      return;
    }

    const used = consumeItem(this, p, puzzle.requiredItem);
    const result = applyPuzzle(puzzle, extractPayload(t.control, payload), this.sim);
    this.finishTask(t, result, used);
  }

  finishTask(t: InternalTask, result: { ok: boolean; optimal: boolean; wasted: boolean; explanation: string; scoreDelta: number; voice?: string }, used: boolean) {
    if (!result.ok) {
      this.push("warn", result.explanation);
      this.broadcast();
      return;
    }
    t.resolved = true;
    this.score = Math.max(0, this.score + result.scoreDelta);
    if (result.optimal) this.stats.optimalSolutions += 1;
    else this.stats.incorrectSolutions += 1;
    if (result.optimal) this.stats.emergenciesSurvived += 1;
    this.push(result.optimal ? "ok" : "warn", result.explanation);
    if (result.voice) this.speak(result.voice);
    if (used) {
      /* item consumed */
    }
    note(this.sim, result.explanation);
  }

  tick() {
    const now = Date.now();
    if (this.phase === "role_intro" && this.phaseEndsAt && now >= this.phaseEndsAt) {
      this.enterTutorial();
      return;
    }
    if (this.phase === "tutorial" && this.phaseEndsAt && now >= this.phaseEndsAt) {
      this.enterCountdown();
      return;
    }
    if (this.phase === "countdown" && this.phaseEndsAt && now >= this.phaseEndsAt) {
      this.beginPlay();
      return;
    }
    if (this.phase !== "playing") {
      if (now - this.lastBroadcast > 400) this.broadcast();
      return;
    }

    this.sim.now = now;
    const crew = [...this.players.values()].map((p) => p.astro);
    tickSim(this.sim, crew, TICK_MS);
    for (const p of this.players.values()) {
      if (p.astro.movingTo && now >= p.astro.moveEndsAt) {
        p.astro.location = p.astro.movingTo;
        p.astro.movingTo = null;
      }
    }

    this.tickHolds(now);
    this.maybeSpawn(now);
    this.expireTasks(now);

    const fail = unrecoverable(this.sim, crew);
    if (fail) {
      this.conclude("failure", fail);
      return;
    }
    if (now >= this.startedAt + MISSION_MS) {
      const survivors = crew.filter((c) => !c.incapacitated).length;
      this.conclude(survivors === crew.length ? "perfect" : survivors > 0 ? "partial" : "failure", survivors ? undefined : "CREW INCAPACITATED");
      return;
    }

    if (now - this.lastBroadcast > 180) this.broadcast();
  }

  tickHolds(now: number) {
    for (const t of this.tasks) {
      if (t.resolved || t.puzzle.type !== "airlock_seal") continue;
      for (const [pid, at] of t.hold) {
        if (now - at > 400) t.hold.delete(pid);
      }
      const present = [...this.players.values()].filter(
        (p) => currentRoom(p.astro, now) === "airlock" && t.hold.has(p.id),
      );
      if (t.control.kind === "hold") {
        t.control.holding = present.map((p) => p.name);
        if (present.length >= 2) {
          t.control.progress = Math.min(1, t.control.progress + TICK_MS / 3000);
          if (t.control.progress >= 1) {
            const result = applyPuzzle(t.puzzle, true, this.sim);
            this.finishTask(t, result, false);
          }
        } else {
          t.control.progress = Math.max(0, t.control.progress - TICK_MS / 1800);
        }
      }
    }
  }

  maybeSpawn(now: number) {
    const elapsed = now - this.startedAt;
    if (elapsed < 15000) return;

    if (!this.memoryWhispered && elapsed > 18000) {
      this.memoryWhispered = true;
      this.missionControl = `AUTH CODE ${this.earlyAuth} — Communications, remember this. You will need it.`;
      this.speak(`Communications, auth code ${this.earlyAuth!.split("").join(" ")}. Do not lose it.`);
      this.push("info", "Mission Control whispered an auth code to Communications.");
    }

    const scale = timerScale(this.players.size);
    const cap = maxUrgentTasks(this.players.size);
    const activeUrgent = this.tasks.filter(
      (t) => !t.resolved && (t.puzzle.severity === "urgent" || t.puzzle.severity === "critical"),
    ).length;

    while (this.planIndex < this.plan.length && elapsed >= this.plan[this.planIndex]!.atMs) {
      const spec = this.plan[this.planIndex]!;
      this.planIndex += 1;
      if (activeUrgent >= cap && (spec.type !== "airlock_seal" && spec.type !== "reactor_reset")) {
        continue;
      }
      this.spawnType(spec.type, scale);
    }

    for (const ev of environmentalAt(elapsed, this.sim, this.rng, this.envSpawned)) {
      ev.apply();
      this.push("crit", ev.title);
      this.speak(ev.voice);
      if (ev.type === "dust_storm") {
        this.sim.commsDownUntil = Math.max(this.sim.commsDownUntil, now + 25000);
      }
      if (ev.type === "power_surge" && !this.tasks.some((t) => t.puzzle.type === "power_surge" && !t.resolved)) {
        this.spawnType("power_surge", scale);
      }
      if (ev.type === "oxygen_leak" && !this.tasks.some((t) => t.puzzle.type === "oxygen_leak" && !t.resolved)) {
        this.spawnType("oxygen_leak", scale);
      }
      void grokLine(ev.type, ev.title).then((line) => {
        if (line) this.speak(line);
      });
    }
  }

  spawnType(type: string, scale: number) {
    let puzzle = createPuzzle(type, this.rng, this.sim, scale, newId());
    if (type === "memory_code" && this.earlyAuth) {
      puzzle = createPuzzle(type, this.rng, this.sim, scale, newId());
      puzzle.solution = this.earlyAuth;
      puzzle.optimal = this.earlyAuth;
      if (puzzle.infoBySystem.comms) {
        puzzle.infoBySystem.comms = [`If you were listening: AUTH CODE ${this.earlyAuth}`];
      }
    }
    if (type === "oxygen_leak") {
      this.sim.oxygenLeak = Math.max(this.sim.oxygenLeak, 4);
      note(this.sim, "Oxygen leak");
    }
    if (type === "co2_route") {
      this.sim.co2Filter = Math.min(this.sim.co2Filter, 42);
      note(this.sim, "CO₂ filter failure");
    }
    if (type === "valve_logic" || type === "airlock_seal" || type === "pressure_patch") {
      this.sim.pressureLeak = Math.max(this.sim.pressureLeak, 1.6);
      note(this.sim, "Pressure leak");
    }
    if (type === "med_dose") {
      const victim = pick(this.rng, [...this.players.values()]);
      victim.astro.health = Math.min(victim.astro.health, 62);
    }
    const now = Date.now();
    this.tasks.push({
      puzzle,
      createdAt: now,
      deadlineAt: now + puzzle.durationMs,
      resolved: false,
      failed: false,
      control: puzzle.control,
      hold: new Map(),
      confirms: new Map(),
    });
    this.push(puzzle.severity === "critical" ? "crit" : "warn", puzzle.title);
    if (puzzle.voice) this.speak(puzzle.voice);
    if (puzzle.mc) this.missionControl = puzzle.mc;
    for (const c of puzzle.chain) note(this.sim, c);
  }

  expireTasks(now: number) {
    for (const t of this.tasks) {
      if (t.resolved || t.failed || now < t.deadlineAt) continue;
      t.failed = true;
      this.score = Math.max(0, this.score - 160);
      this.push("crit", `${t.puzzle.title} window closed — conditions worsening.`);
      if (t.puzzle.type === "oxygen_leak") this.sim.oxygenLeak += 1.5;
      if (t.puzzle.type === "co2_route") this.sim.co2Filter = Math.max(10, this.sim.co2Filter - 20);
      if (t.puzzle.type === "heater") this.sim.temperature -= 1.5;
      if (t.puzzle.type === "freq_tune") this.sim.commsDownUntil = now + 20000;
      if (t.puzzle.type === "airlock_seal") this.sim.pressureLeak += 0.8;
    }
  }

  conclude(outcome: EndState["outcome"], primary?: string) {
    if (this.phase === "ended") return;
    this.phase = "ended";
    this.phaseEndsAt = null;
    const crew = [...this.players.values()];
    const survivors = crew.filter((p) => !p.astro.incapacitated).length;
    if (outcome === "perfect") this.score += 1500;
    else if (outcome === "partial") this.score += 400;
    const chain = this.sim.chains.slice(-8);
    const end: EndState = {
      outcome,
      title: outcome === "failure" ? "MISSION FAILED" : "RESCUE SUCCESSFUL",
      subtitle:
        outcome === "failure"
          ? primary || "HABITAT LOST"
          : `${survivors} / ${crew.length} ASTRONAUTS SURVIVED`,
      primaryFailure: primary,
      chain: chain.length ? chain : ["Rescue vehicle docked."],
      score: Math.round(this.score),
      stats: {
        optimalSolutions: this.stats.optimalSolutions,
        incorrectSolutions: this.stats.incorrectSolutions,
        emergenciesSurvived: this.stats.emergenciesSurvived,
        lowestOxygen: Math.round(this.sim.lowestOxygen),
        lowestPower: Math.round(this.sim.lowestBattery),
        astronautsRevived: this.stats.astronautsRevived,
        survivors,
        crew: crew.length,
      },
      recap: fallbackRecap({
        outcome,
        title: "",
        subtitle: "",
        chain,
        score: this.score,
        stats: {
          optimalSolutions: this.stats.optimalSolutions,
          incorrectSolutions: this.stats.incorrectSolutions,
          emergenciesSurvived: this.stats.emergenciesSurvived,
          lowestOxygen: Math.round(this.sim.lowestOxygen),
          lowestPower: Math.round(this.sim.lowestBattery),
          astronautsRevived: this.stats.astronautsRevived,
          survivors,
          crew: crew.length,
        },
        recap: { bestMove: "", criticalError: "", closestCall: "", teamwork: "" },
        players: crew.map((p) => ({
          name: p.name,
          survived: !p.astro.incapacitated,
          health: Math.round(p.astro.health),
        })),
      }),
      players: crew.map((p) => ({
        name: p.name,
        survived: !p.astro.incapacitated,
        health: Math.round(p.astro.health),
      })),
    };
    end.recap.closestCall = this.sim.closestCall;
    this.end = end;
    this.speak(outcome === "failure" ? "Rescue abort. Habitat is lost." : "Rescue vehicle on final. You made it.");
    this.broadcast();
    grokRecap(this.view(crew[0]!.id), end).then((recap) => {
      if (this.end) this.end.recap = recap;
      this.broadcast();
    });
  }

  playAgain(id: string) {
    if (id !== this.hostId) return;
    this.phase = "lobby";
    this.end = null;
    this.score = SCORE_START;
    this.tasks = [];
    this.timeline = [];
    this.bootItems();
    this.stats = { optimalSolutions: 0, incorrectSolutions: 0, emergenciesSurvived: 0, astronautsRevived: 0 };
    this.seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    this.rng = mulberry32(this.seed);
    this.plan = [];
    this.planIndex = 0;
    this.envSpawned.clear();
    this.memoryWhispered = false;
    this.missionControl = null;
    this.sim = createSim(Date.now());
    for (const p of this.players.values()) {
      p.ready = false;
      p.tutorialDone = false;
      p.roleId = null;
      p.astro = {
        ...p.astro,
        name: p.name,
        health: 100,
        suitOxygen: 100,
        radiation: 0,
        location: "crew",
        movingTo: null,
        inventory: null,
        incapacitated: false,
      };
    }
    this.push("info", "New mission briefing. Same crew.");
    this.broadcast();
  }

  whisper(p: Player, text: string) {
    if (!p.socketId) return;
    this.sink.emitTo(p.socketId, "toast", { text, tone: "warn" });
  }

  push(tone: TimelineEvent["tone"], text: string) {
    this.timeline.unshift({
      id: newId(),
      atMs: Date.now(),
      text,
      tone,
    });
    this.timeline = this.timeline.slice(0, 14);
  }

  speak(text: string) {
    this.voice = { id: newId(), text };
    void grokLine("mission_control", text).then((line) => {
      if (line) this.voice = { id: newId(), text: line };
    });
  }

  view(forId: string): ClientState {
    const you = this.players.get(forId);
    const systems = you?.roleId ? ROLE_DEFS[you.roleId].systems : [];
    const now = Date.now();
    const rescueEtaMs =
      this.phase === "playing"
        ? Math.max(0, this.startedAt + MISSION_MS - now)
        : this.phase === "ended"
          ? 0
          : MISSION_MS;
    const players: PlayerPublic[] = [...this.players.values()]
      .sort((a, b) => a.slot - b.slot)
      .map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        avatar: p.avatar,
        slot: p.slot,
        roleId: p.roleId,
        roleTitle: p.roleId ? ROLE_DEFS[p.roleId].title : "Unassigned",
        responsibilities: p.roleId ? ROLE_DEFS[p.roleId].systems : [],
        health: Math.round(p.astro.health),
        suitOxygen: Math.round(p.astro.suitOxygen),
        radiation: Math.round(p.astro.radiation),
        location: currentRoom(p.astro, now),
        movingTo: p.astro.movingTo,
        moveStartsAt: p.astro.moveStartsAt,
        moveEndsAt: p.astro.moveEndsAt,
        inventory: p.astro.inventory,
        incapacitated: p.astro.incapacitated,
        ready: p.ready,
        connected: p.connected,
        tutorialDone: p.tutorialDone,
      }));

    const items: ItemPublic[] = this.items.map((i) => ({
      id: i.id,
      type: i.type,
      location: i.location,
      carriedBy: i.carriedBy,
    }));

    const hab = habitatPublic(this.sim);
    const emergencies = this.tasks
      .filter((t) => !t.resolved)
      .map((t) => ({
        id: t.puzzle.id,
        title: t.puzzle.title,
        severity: t.puzzle.severity,
      }));

    const hasComms = systems.includes("comms");
    const gauges = this.phase === "playing" || this.phase === "ended" ? systemGauges(this.sim, systems) : {};

    const tasks: TaskView[] = this.tasks
      .filter((t) => !t.resolved)
      .map((t) => taskView(t, you, systems, now, this.players));

    return {
      roomCode: this.code,
      phase: this.phase,
      phaseEndsAt: this.phaseEndsAt,
      rescueEtaMs,
      elapsedMs: this.phase === "playing" ? now - this.startedAt : 0,
      score: Math.round(this.score),
      players,
      you: forId,
      youAreHost: forId === this.hostId,
      hostName: this.players.get(this.hostId)?.name || "Lead",
      habitat: hab,
      emergencies,
      timeline: this.timeline,
      items,
      missionControl: hasComms ? this.missionControl : null,
      hasCommsIntel: hasComms,
      gauges,
      tasks,
      tutorial: this.phase === "tutorial" ? tutorialView(you) : null,
      roleCard: you?.roleId ? roleCard(you.roleId, you.slot + 1) : null,
      end: this.end,
      voiceLine: this.voice,
      canStart: this.phase === "lobby" && this.players.size >= MIN_PLAYERS,
      roomFull: this.players.size >= MAX_PLAYERS,
      playerCount: this.players.size,
      intensity: hab.emergencyLights ? 1 : hab.lightsDim ? 0.55 : 0.2,
    };
  }

  broadcast() {
    this.lastBroadcast = Date.now();
    for (const p of this.players.values()) {
      if (!p.socketId) continue;
      this.sink.emitTo(p.socketId, "state", this.view(p.id));
    }
  }
}

function spawnRoom(roleId: string): RoomId {
  if (roleId.includes("power")) return "power";
  if (roleId.includes("life_support")) return "life_support";
  if (roleId.includes("comms")) return "comms";
  if (roleId.includes("thermal")) return "power";
  return "crew";
}

function tutorialView(you?: Player): TutorialView {
  return {
    problem: "CURRENT POWER: 50 kW. REQUIRED: 60 kW.",
    target: "Close a 10 kW gap without waiting for solar.",
    info: ["Emergency battery provides: 10 kW", "This is training. The real habitat will not be this kind."],
    options: [
      { id: "battery", label: "ACTIVATE EMERGENCY BATTERY" },
      { id: "wait", label: "WAIT FOR SUNLIGHT" },
    ],
    done: !!you?.tutorialDone,
    correct: you?.tutorialDone ? true : undefined,
    explanation: you?.tutorialDone
      ? "50 + 10 = 60 kW. Bus meets requirement."
      : undefined,
  };
}

function consumeItem(room: GameRoom, p: Player, type?: ItemType) {
  if (!type) return false;
  if (p.astro.inventory !== type) return false;
  const item = room.items.find((i) => i.carriedBy === p.id && i.type === type);
  if (item) {
    item.location = currentRoom(p.astro, Date.now());
    item.carriedBy = undefined;
  }
  p.astro.inventory = null;
  return true;
}

function extractPayload(control: TaskControl, payload: unknown): unknown {
  if (payload !== undefined && payload !== null && payload !== "") {
    if (typeof payload === "object" && !Array.isArray(payload) && control.kind !== "dual_confirm") {
      const o = payload as Record<string, unknown>;
      if ("value" in o && control.kind !== "sliders") return o.value;
      if (control.kind === "sliders") return o;
      if (control.kind === "routing" && "selected" in o) return o.selected;
      if (control.kind === "sequence" && "slots" in o) return o.slots;
    }
    return payload;
  }
  switch (control.kind) {
    case "stepper":
    case "pattern":
      return control.value;
    case "sliders": {
      const o: Record<string, number> = {};
      for (const s of control.sliders) o[s.id] = s.value;
      return o;
    }
    case "routing":
      return control.selected;
    case "sequence":
      return control.slots;
    case "code":
      return control.value;
    case "buttons":
      return payload;
    case "dual_confirm":
      return { value: control.value };
    default:
      return payload;
  }
}

function mergeControl(control: TaskControl, payload: unknown): TaskControl {
  if (payload === undefined || payload === null) return control;
  if (control.kind === "stepper" || control.kind === "pattern") {
    return { ...control, value: Number(payload) };
  }
  if (control.kind === "sliders" && typeof payload === "object") {
    const body = payload as Record<string, number>;
    return {
      ...control,
      sliders: control.sliders.map((s) => ({
        ...s,
        value: body[s.id] !== undefined ? Number(body[s.id]) : s.value,
      })),
    };
  }
  if (control.kind === "routing" && Array.isArray(payload)) {
    return { ...control, selected: payload as string[] };
  }
  if (control.kind === "sequence" && Array.isArray(payload)) {
    return { ...control, slots: payload as string[] };
  }
  if (control.kind === "code") {
    return { ...control, value: String(payload).slice(0, control.digits) };
  }
  if (control.kind === "dual_confirm") {
    return { ...control, value: Number((payload as { value?: number })?.value ?? payload) };
  }
  return control;
}

function taskView(
  t: InternalTask,
  you: Player | undefined,
  systems: SystemId[],
  now: number,
  players: Map<string, Player>,
): TaskView {
  const puz = t.puzzle;
  const info: string[] = [];
  for (const s of systems) {
    const chunk = puz.infoBySystem[s];
    if (chunk) info.push(...chunk);
  }
  const assigned = puz.assignedSystems.some((s) => systems.includes(s));
  const control = puz.controlSystems.some((s) => systems.includes(s));
  const loc = you ? currentRoom(you.astro, now) : "crew";
  const inRoom = !puz.requiredRoom || loc === puz.requiredRoom;
  const names = [...players.values()]
    .filter((p) => puz.requiredRoom && currentRoom(p.astro, now) === puz.requiredRoom)
    .map((p) => p.name);
  let waiting = "";
  if (puz.requiresPresence && puz.requiredRoom && !inRoom) {
    waiting = `Travel to ${ROOM_LABELS[puz.requiredRoom]}`;
  } else if (puz.requiredItem && you?.astro.inventory !== puz.requiredItem) {
    waiting = `Need ${ITEM_LABELS[puz.requiredItem]}`;
  } else if (puz.requiredPlayers > 1 && names.length < puz.requiredPlayers) {
    waiting = `${puz.requiredPlayers} astronauts needed in ${puz.requiredRoom ? ROOM_LABELS[puz.requiredRoom] : "position"}`;
  }
  return {
    id: puz.id,
    type: puz.type,
    title: puz.title,
    problem: puz.problem,
    target: puz.target,
    availableInfo: info.length ? info : ["You do not have local telemetry for this. Ask the crew."],
    cost: puz.cost,
    risk: puz.risk,
    benefit: puz.benefit,
    timerMs: Math.max(0, t.deadlineAt - now),
    severity: puz.severity,
    assignedToYou: assigned,
    youHaveControl: control,
    requiresPresence: puz.requiresPresence,
    requiredRoom: puz.requiredRoom,
    requiredItem: puz.requiredItem,
    requiredPlayers: puz.requiredPlayers,
    playersInRoom: names,
    youInRoom: inRoom,
    youHaveItem: !puz.requiredItem || you?.astro.inventory === puz.requiredItem,
    control: t.control,
    waitingOn: waiting,
    expired: t.failed,
  };
}
