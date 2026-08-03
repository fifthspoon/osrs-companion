export type Overhead = "none" | "magic" | "range" | "melee";
export type AttackStyle = "magic" | "range" | "melee";

// All positions are TILE coordinates. Multi-tile NPCs (Jad) store their
// top-left tile; `size` gives the square footprint.
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
  // Jad's telegraphed attack (magic/range). Melee is instant, never telegraphed.
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

// A player action, applied at the START of the next tick, never instantly.
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
  // Per-run tuning. Reaction window (ticks from telegraph to hit) lives here so
  // it's configurable per fight. the whole difficulty of the drill.
  config: { magicDelay: number; rangeDelay: number };
}
