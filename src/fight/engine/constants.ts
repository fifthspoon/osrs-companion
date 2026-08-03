// The heartbeat. Everything in OSRS quantizes to this.
export const TICK_MS = 600;

// --- Grid (OSRS movement is tile-quantized) ---
export const TILE = 28; // px per tile
export const GRID_W = 20;
export const GRID_H = 18;
export const PLAYER_RUN_TILES = 2; // tiles/tick running
export const PLAYER_WALK_TILES = 1; // tiles/tick walking
export const MELEE_RANGE = 1; // chebyshev adjacency

// --- Jad (TzTok-Jad) --- (wiki-confirmed)
export const JAD_HP = 250;
export const JAD_SIZE = 5; // 5x5 tiles
export const JAD_ATTACK_SPEED = 8; // ticks between attacks (4.8s)
export const JAD_MAX_HIT_MAGIC = 95;
export const JAD_MAX_HIT_RANGE = 97;
export const JAD_MAX_HIT_MELEE = 97; // only when you're adjacent, and it's INSTANT
export const JAD_FIRST_ATTACK_DELAY = 5; // grace ticks before the first attack
// Defensive profile for the player's hit-chance roll (all Jad def bonuses = +0).
export const JAD_DEFENCE_LEVEL = 480;
export const JAD_RANGED_DEF_BONUS = 0;

// --- Yt-HurKot healers --- (wiki-confirmed)
export const JAD_HEALER_COUNT = 4;
export const JAD_HEALER_HP = 60;
export const JAD_HEALER_SPAWN_HP = 125; // Jad <= this -> healers spawn
export const HEALER_HEAL = 5; // HP restored to Jad per heal (wiki-confirmed)
export const HEALER_ATTACK_SPEED = 4; // ticks between heal/attack
export const HEALER_MAX_HIT = 14; // melee vs player when aggro'd + adjacent
export const HEALER_WALK_TILES = 1; // slower than a running player -> kiteable

// Reaction window presets, in ticks between telegraph and hit. The wiki does
// NOT quantify the real window (only qualitative tells), so this is a training
// dial, deliberately tunable BELOW real difficulty. Overtrain here, and the
// real Fight Caves feels slow. Lower = harder. Default is harder than real.
// (Melee ignores this. it's instant, which is the whole proximity trap.)
export const REACTION_PRESETS = {
  learning: 4, // 2.4s, warmup
  standard: 3, // 1.8s
  hard: 2, // 1.2s, harder than real. the default
  brutal: 1, // 0.6s, near frame-perfect, telegraph barely shows
} as const;
export type ReactionPreset = keyof typeof REACTION_PRESETS;
export const DEFAULT_REACTION: ReactionPreset = "hard";

// Overhead prayer drains 1 point every N ticks while active (approximation).
export const PRAYER_DRAIN_TICKS = 3;
export const PLAYER_MAX_PRAYER = 99;

// --- Rendering (canvas pixel space) ---
export const ARENA = { x: 20, y: 20, w: GRID_W * TILE, h: GRID_H * TILE };
export const CANVAS_W = 900;
export const CANVAS_H = ARENA.y * 2 + ARENA.h;
