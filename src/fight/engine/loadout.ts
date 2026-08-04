
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

const VOID_MOD: Record<VoidRanged, number> = {
  none: 1.0,
  regular: 1.1,
  elite: 1.125,
};

const styleBonus = (s: RangedStyle): number => (s === "accurate" ? 3 : 0);

export function maxHit(l: Loadout): number {
  const base = Math.floor(l.rangedLevel * PRAYER_DMG[l.prayer]) + styleBonus(l.style) + 8;
  const effStr = Math.floor(base * VOID_MOD[l.void]);
  return Math.floor((effStr * (l.rangedStrengthBonus + 64) + 320) / 640);
}

export function maxAttackRoll(l: Loadout): number {
  const base = Math.floor(l.rangedLevel * PRAYER_ACC[l.prayer]) + styleBonus(l.style) + 8;
  const effAtk = Math.floor(base * VOID_MOD[l.void]);
  return effAtk * (l.rangedAttackBonus + 64);
}

export function maxDefenceRoll(t: TargetDefence): number {
  return (t.defenceLevel + 9) * (t.rangedDefenceBonus + 64);
}

export function hitChance(l: Loadout, t: TargetDefence): number {
  const a = maxAttackRoll(l);
  const d = maxDefenceRoll(t);
  return a > d ? 1 - (d + 2) / (2 * (a + 1)) : a / (2 * (d + 1));
}

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
