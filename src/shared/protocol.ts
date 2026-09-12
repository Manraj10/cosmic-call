import type { ItemType, RoomId, SystemId } from "./constants";

export type Phase =
  | "lobby"
  | "role_intro"
  | "tutorial"
  | "countdown"
  | "playing"
  | "ended";

export type SystemStatus = "STABLE" | "WARNING" | "CRITICAL" | "OFFLINE";
export type Severity = "routine" | "urgent" | "critical";
export type Tone = "info" | "warn" | "crit" | "ok";

export type RoleId =
  | "life_support"
  | "power"
  | "thermal_exterior"
  | "comms_medical"
  | "life_support_medical"
  | "power_thermal"
  | "comms_exterior"
  | "life_support_medical_comms"
  | "power_thermal_exterior";

export interface PlayerPublic {
  id: string;
  name: string;
  color: string;
  avatar: number;
  slot: number;
  roleId: RoleId | null;
  roleTitle: string;
  responsibilities: SystemId[];
  health: number;
  suitOxygen: number;
  radiation: number;
  location: RoomId;
  movingTo: RoomId | null;
  moveStartsAt: number;
  moveEndsAt: number;
  inventory: ItemType | null;
  incapacitated: boolean;
  ready: boolean;
  connected: boolean;
  tutorialDone: boolean;
}

export interface HabitatPublic {
  oxygen: SystemStatus;
  power: SystemStatus;
  thermal: SystemStatus;
  comms: SystemStatus;
  medical: SystemStatus;
  exterior: SystemStatus;
  dustStorm: boolean;
  solarFlare: boolean;
  pressureLeak: boolean;
  lightsDim: boolean;
  emergencyLights: boolean;
  frost: boolean;
  heat: boolean;
  commsGlitch: boolean;
  debris: boolean;
  solarAngle: number;
  solarOptimal: number;
}

export interface EmergencyPublic {
  id: string;
  title: string;
  severity: Severity;
}

export interface TimelineEvent {
  id: string;
  atMs: number;
  text: string;
  tone: Tone;
}

export interface ItemPublic {
  id: string;
  type: ItemType;
  location: RoomId | "carried";
  carriedBy?: string;
}

export type ControlKind =
  | "stepper"
  | "sliders"
  | "buttons"
  | "sequence"
  | "hold"
  | "routing"
  | "dual_confirm"
  | "pattern"
  | "code";

export interface StepperControl {
  kind: "stepper";
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
}

export interface SlidersControl {
  kind: "sliders";
  totalLabel: string;
  available: number;
  unit: string;
  sliders: { id: string; label: string; min: number; max: number; value: number }[];
}

export interface ButtonsControl {
  kind: "buttons";
  options: { id: string; label: string }[];
}

export interface SequenceControl {
  kind: "sequence";
  slots: string[];
  options: { id: string; label: string }[];
}

export interface HoldControl {
  kind: "hold";
  label: string;
  requiredPlayers: number;
  holding: string[];
  progress: number;
}

export interface RoutingControl {
  kind: "routing";
  nodes: { id: string; label: string }[];
  selected: string[];
}

export interface DualConfirmControl {
  kind: "dual_confirm";
  prompt: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  value: number;
  confirmed: string[];
}

export interface PatternControl {
  kind: "pattern";
  prompt: string;
  min: number;
  max: number;
  value: number;
}

export interface CodeControl {
  kind: "code";
  digits: number;
  value: string;
}

export type TaskControl =
  | StepperControl
  | SlidersControl
  | ButtonsControl
  | SequenceControl
  | HoldControl
  | RoutingControl
  | DualConfirmControl
  | PatternControl
  | CodeControl;

export interface TaskView {
  id: string;
  type: string;
  title: string;
  problem: string;
  target: string;
  availableInfo: string[];
  cost: string;
  risk: string;
  benefit: string;
  timerMs: number;
  severity: Severity;
  assignedToYou: boolean;
  youHaveControl: boolean;
  requiresPresence: boolean;
  requiredRoom?: RoomId;
  requiredItem?: ItemType;
  requiredPlayers: number;
  playersInRoom: string[];
  youInRoom: boolean;
  youHaveItem: boolean;
  control: TaskControl;
  waitingOn: string;
  expired: boolean;
}

export interface RoleCard {
  slot: number;
  title: string;
  primary: string;
  controls: string[];
  depends: string;
  warning: string;
}

export interface TutorialView {
  problem: string;
  target: string;
  info: string[];
  options: { id: string; label: string }[];
  done: boolean;
  correct?: boolean;
  explanation?: string;
}

export interface EndState {
  outcome: "perfect" | "partial" | "failure";
  title: string;
  subtitle: string;
  primaryFailure?: string;
  chain: string[];
  score: number;
  stats: {
    optimalSolutions: number;
    incorrectSolutions: number;
    emergenciesSurvived: number;
    lowestOxygen: number;
    lowestPower: number;
    astronautsRevived: number;
    survivors: number;
    crew: number;
  };
  recap: {
    bestMove: string;
    criticalError: string;
    closestCall: string;
    teamwork: string;
  };
  players: { name: string; survived: boolean; health: number }[];
}

export interface ClientState {
  roomCode: string;
  phase: Phase;
  phaseEndsAt: number | null;
  rescueEtaMs: number;
  elapsedMs: number;
  score: number;
  players: PlayerPublic[];
  you: string;
  youAreHost: boolean;
  hostName: string;
  habitat: HabitatPublic;
  emergencies: EmergencyPublic[];
  timeline: TimelineEvent[];
  items: ItemPublic[];
  missionControl: string | null;
  hasCommsIntel: boolean;
  gauges: Record<string, string>;
  tasks: TaskView[];
  tutorial: TutorialView | null;
  roleCard: RoleCard | null;
  end: EndState | null;
  voiceLine: { id: string; text: string } | null;
  canStart: boolean;
  roomFull: boolean;
  playerCount: number;
  intensity: number;
}

export type ClientEvent =
  | { type: "create"; name: string }
  | { type: "join"; code: string; name: string; token?: string }
  | { type: "start" }
  | { type: "ready" }
  | { type: "tutorial"; optionId: string }
  | { type: "move"; room: RoomId }
  | { type: "pickup"; itemId: string }
  | { type: "drop" }
  | { type: "task_update"; taskId: string; payload: unknown }
  | { type: "task_confirm"; taskId: string; payload: unknown }
  | { type: "hold"; taskId: string; holding: boolean }
  | { type: "revive"; targetId: string }
  | { type: "play_again" };
