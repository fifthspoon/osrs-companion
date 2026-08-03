import type { AttackStyle } from "./types";
import { nextRandom } from "./rng";

// One OSRS-style hit: an accuracy roll, then a uniform damage roll 0..maxHit.
export function rollDamage(
  maxHit: number,
  hitChance: number,
  seed: number,
): { damage: number; seed: number } {
  const acc = nextRandom(seed);
  if (acc.value >= hitChance) return { damage: 0, seed: acc.seed };
  const dmg = nextRandom(acc.seed);
  return { damage: Math.floor(dmg.value * (maxHit + 1)), seed: dmg.seed };
}

// Jad picks magic or range at random each attack.
export function pickStyle(seed: number): { style: AttackStyle; seed: number } {
  const r = nextRandom(seed);
  return { style: r.value < 0.5 ? "magic" : "range", seed: r.seed };
}
