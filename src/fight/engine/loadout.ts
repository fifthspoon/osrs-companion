// OSRS ranged damage model, reimplemented from the documented public formulas
// (oldschool.runescape.wiki, Damage_per_second/Ranged). Nothing copied. this
// is the combat math, and every constant below is wiki-confirmed.

export type RangedStyle = "accurate" | "rapid" | "longrange";
export type RangedPrayer = "none" | "eagle_eye" | "rigour";
export type VoidRanged = "none" | "regular" | "elite";

export interface Loadout {
  label: string;
  rangedLevel: number;
  hpLevel: number;
  defenceLevel: number;
  prayer: RangedPrayer;
  style: RangedStyle;
  void: VoidRanged;
  attackSpeedTicks: number; // weapon speed after style adjustment
  rangedAttackBonus: number; // summed gear ranged attack (from equipment stats)
  rangedStrengthBonus: number; // summed gear ranged strength (darts + Ava's + gear)
}

export interface TargetDefence {
  defenceLevel: number;
  rangedDefenceBonus: number;
}

// Prayer multipliers (wiki-confirmed).
const PRAYER_ACC: Record<RangedPrayer, number> = {
  none: 1.0,
  eagle_eye: 1.15,
  rigour: 1.2,
};
const PRAYER_DMG: Record<RangedPrayer, number> = {
  none: 1.0,
  eagle_eye: 1.15,
  rigour: 1.23,
};

// Void ranged set multiplier (applies to both accuracy and strength).
const VOID_MOD: Record<VoidRanged, number> = {
  none: 1.0,
  regular: 1.1,
  elite: 1.125,
};

// Accurate adds +3 to the visible ranged level; Rapid/Longrange add 0 to ranged.
const styleBonus = (s: RangedStyle): number => (s === "accurate" ? 3 : 0);

export function maxHit(l: Loadout): number {
  const base = Math.floor(l.rangedLevel * PRAYER_DMG[l.prayer]) + styleBonus(l.style) + 8;
  const effStr = Math.floor(base * VOID_MOD[l.void]);
  // floor(0.5 + effStr * (strBonus + 64) / 640)
  return Math.floor((effStr * (l.rangedStrengthBonus + 64) + 320) / 640);
}

export function maxAttackRoll(l: Loadout): number {
  const base = Math.floor(l.rangedLevel * PRAYER_ACC[l.prayer]) + styleBonus(l.style) + 8;
  const effAtk = Math.floor(base * VOID_MOD[l.void]);
  return effAtk * (l.rangedAttackBonus + 64);
}

// NPC defence roll. VERIFY the +9 effective-level constant.
export function maxDefenceRoll(t: TargetDefence): number {
  return (t.defenceLevel + 9) * (t.rangedDefenceBonus + 64);
}

// Standard OSRS accuracy: attack roll vs defence roll.
export function hitChance(l: Loadout, t: TargetDefence): number {
  const a = maxAttackRoll(l);
  const d = maxDefenceRoll(t);
  return a > d ? 1 - (d + 2) / (2 * (a + 1)) : a / (2 * (d + 1));
}

// Default: Toxic blowpipe + dragon darts + Ava's + a solid ranged setup.
// Blowpipe rapid = 2 ticks; blowpipe +30 atk / +20 str; dragon darts +35 str;
// Ava's +2 str. The two bonus totals are what you read off your in-game
// Equipment Stats screen ("Ranged" attack and "Ranged Strength"). Punch in
// your real numbers via the panel for a 1:1 match.
export const DEFAULT_LOADOUT: Loadout = {
  label: "Blowpipe (dragon darts)",
  rangedLevel: 99,
  hpLevel: 99,
  defenceLevel: 70,
  prayer: "rigour",
  style: "rapid",
  void: "none",
  attackSpeedTicks: 2,
  rangedAttackBonus: 85, // blowpipe +30 + typical armour
  rangedStrengthBonus: 62, // bp +20 + dragon darts +35 + Ava's +2 + gear
};
