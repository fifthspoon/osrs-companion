export type Overhead = "none" | "magic" | "range" | "melee";
export type AttackStyle = "magic" | "range" | "melee";

export interface Vec {
  x: number;
  y: number;
}

export interface Player {
  hp: number;
  maxHp: number;
  prayer: number;
  maxPrayer: number;
  overhead: Overhead;
  pos: Vec;
  prevPos: Vec;
  attackSpeed: number;
  attackCd: number;
  maxHit: number;
  hitChance: number; // vs Jad specifically
  targetId: number | null; // npc we're attacking
  moveTarget: Vec | null; // tile we're walking to
  running: boolean;
  alive: boolean;
}

export interface Npc {
  id: number;
  kind: "jad" | "healer";
  hp: number;
  maxHp: number;
  pos: Vec; // top-left tile
  prevPos: Vec;
  size: number; // tile footprint (5 = Jad, 1 = healer)
  attackSpeed: number;
  attackCd: number;
  windup: { style: AttackStyle; landsOn: number } | null;
  target: "jad" | "player" | null; // healer intent
  aggro: boolean; // healer pulled onto the player
}

export interface Projectile {
  id: number;
  style: AttackStyle;
  from: Vec;
  to: Vec;
  firedOn: number;
  landsOn: number;
}

export interface PlayerInput {
  setPrayer?: Overhead;
  click?: Vec; // a clicked tile: attack an NPC there, else walk to it
  toggleRun?: boolean;
}

export interface GameState {
  tick: number;
  player: Player;
  npcs: Npc[];
  projectiles: Projectile[];
  seed: number; // deterministic RNG state, carried through the run
  over: boolean;
  result: "win" | "dead" | null;
  healersSpawned: boolean;
  log: string[];
  stats: { blocked: number; mispray: number; attacks: number };
  config: { magicDelay: number; rangeDelay: number };
}
