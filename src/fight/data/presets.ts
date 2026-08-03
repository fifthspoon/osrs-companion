import type { Loadout } from "../engine/loadout";

// Ranged gear progression by wealth tier, from the wiki's Fight Caves and
// Inferno equipment recommendations. Level requirements are stable game data.
// The two bonus TOTALS are estimates (aggregated across a full setup, not read
// off one item page), so always overwrite them with your real Equipment Stats
// numbers for a 1:1 damage match. Every tier is flagged accordingly in the UI.

export interface GearTier {
  wealth: string;
  reqs: string;
  gear: string[];
  note: string;
  loadout: Loadout;
}

export const GEAR_TIERS: GearTier[] = [
  {
    wealth: "Ultra-budget",
    reqs: "61-70 Ranged · 40 Def · 44 Prayer · 75 HP",
    gear: [
      "Weapon: Rune crossbow (61) + broad bolts, or Magic shortbow (50)",
      "Head: Coif (40) / blessed coif (70)",
      "Cape: Ava's accumulator (50 Ranged, Animal Magnetism)",
      "Neck: Amulet of glory or fury",
      "Body/Legs: Black d'hide (70 Ranged, 40 Def)",
      "Hands: Black d'hide vambraces (70)",
      "Feet: Ranger boots / snakeskin (40)",
      "Shield: Toktz-ket-xil or d'hide shield",
    ],
    note: "Fire Cape is doable here. Protect from Missiles carries the whole run.",
    loadout: {
      label: "Ultra-budget (rune cbow)",
      rangedLevel: 70,
      hpLevel: 75,
      defenceLevel: 40,
      prayer: "eagle_eye",
      style: "rapid",
      void: "none",
      attackSpeedTicks: 5,
      rangedAttackBonus: 100,
      rangedStrengthBonus: 22,
    },
  },
  {
    wealth: "Budget",
    reqs: "75 Ranged · 70 Def · 44 Prayer · 75 HP",
    gear: [
      "Weapon: Toxic blowpipe (75) + adamant (30) or rune darts (40)",
      "Head: Blessed coif (70) / Neitiznot faceguard (55 Def)",
      "Cape: Ava's assembler (70 Ranged, Dragon Slayer II)",
      "Neck: Amulet of fury",
      "Body/Legs: Blessed d'hide (70) or Karil's (70 Ranged, 70 Def)",
      "Hands: Blessed vambraces (70) / Barrows gloves",
      "Feet: Blessed boots (70)",
      "Ring: Archers ring / Ring of suffering (i)",
    ],
    note: "The standard Fire Cape setup. Eagle Eye at 44 Prayer is plenty.",
    loadout: {
      label: "Budget (blowpipe + rune darts)",
      rangedLevel: 75,
      hpLevel: 75,
      defenceLevel: 70,
      prayer: "eagle_eye",
      style: "rapid",
      void: "none",
      attackSpeedTicks: 2,
      rangedAttackBonus: 128,
      rangedStrengthBonus: 40,
    },
  },
  {
    wealth: "Mid",
    reqs: "75-80 Ranged · 70+ Def · 74 Prayer (Rigour) · 80+ HP",
    gear: [
      "Weapon: Toxic blowpipe + dragon darts (60)",
      "Head: Masori mask (80) / Crystal helm (70 Ranged, 70 Def, 50 Agi)",
      "Cape: Ava's assembler / Dizana's quiver (70)",
      "Neck: Necklace of anguish",
      "Body/Legs: Crystal, Armadyl, or Karil's (70 Ranged, 70 Def)",
      "Hands: Barrows gloves / Zaryte vambraces",
      "Feet: Pegasian boots (75 Ranged, 75 Def)",
      "Ring: Archers ring (i) / Venator ring",
      "Shield: Twisted buckler (75 Ranged)",
    ],
    note: "Rigour needs 74 Prayer plus a Dexterous prayer scroll. Big DPS jump.",
    loadout: {
      label: "Mid (blowpipe + dragon darts)",
      rangedLevel: 80,
      hpLevel: 85,
      defenceLevel: 70,
      prayer: "rigour",
      style: "rapid",
      void: "none",
      attackSpeedTicks: 2,
      rangedAttackBonus: 160,
      rangedStrengthBonus: 55,
    },
  },
  {
    wealth: "High / Maxed",
    reqs: "80+ Ranged · 75+ Def · 74+ Prayer · 90+ HP",
    gear: [
      "Weapon: Toxic blowpipe + dragon darts, or Zaryte cbow (80) / bofa (80)",
      "Head: Masori mask (f) (80 Ranged)",
      "Cape: Dizana's quiver / Ava's assembler",
      "Neck: Necklace of anguish (rupture for survivability)",
      "Body/Legs: Masori (f) (80 Ranged)",
      "Hands: Zaryte vambraces",
      "Feet: Pegasian boots / Avernic treads",
      "Ring: Venator ring / Archers ring (i)",
      "Shield: Twisted buckler",
    ],
    note: "Inferno spec: also wants 90+ Def, 80+ Prayer, 94 Magic for Ice Barrage.",
    loadout: {
      label: "Maxed (Masori + blowpipe)",
      rangedLevel: 99,
      hpLevel: 99,
      defenceLevel: 80,
      prayer: "rigour",
      style: "rapid",
      void: "none",
      attackSpeedTicks: 2,
      rangedAttackBonus: 195,
      rangedStrengthBonus: 68,
    },
  },
  {
    wealth: "Alternative",
    reqs: "75 Ranged · 42-45 Def · 44 Prayer · Void set",
    gear: [
      "Elite void top/bottom + void ranger helm (42 Def, 22 Def to wear set)",
      "Weapon: Toxic blowpipe + dragon darts",
      "Cape: Ava's assembler",
      "Set effect multiplies both accuracy and damage by 1.125 (elite)",
    ],
    note: "Void trades flat gear bonuses for a set multiplier. Strong on fast weapons.",
    loadout: {
      label: "Elite void + blowpipe",
      rangedLevel: 90,
      hpLevel: 90,
      defenceLevel: 70,
      prayer: "rigour",
      style: "rapid",
      void: "elite",
      attackSpeedTicks: 2,
      rangedAttackBonus: 90,
      rangedStrengthBonus: 57,
    },
  },
];
