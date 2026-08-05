import { GEAR_TIERS } from "../../lib/firecapeSim/presets";

interface Section {
  title: string;
  lines: string[];
}

const FIGHT_CAVES: Section[] = [
  {
    title: "Requirements",
    lines: [
      "Recommended: 75 Ranged, 75 HP, 70 Defence, 60 Prayer.",
      "Pure (<20 Def): 75+ Ranged, 80 HP, 43+ Prayer.",
      "Protect from Missiles is the workhorse. it blocks nearly everything",
      "in the cave except Jad's magic and melee. Keep it up by default.",
      "Rigour / Eagle Eye are DPS bonuses, not requirements.",
      "Expect well over an hour for a full run at lower levels.",
      "Reward: Fire cape, 8,032 Tokkul, 1/200 TzRek-Jad pet.",
    ],
  },
  {
    title: "Kill priority (and why)",
    lines: [
      "Tz-Kih > Tok-Xil > Ket-Zek > Yt-MejKot > Tz-Kek.",
      "Tz-Kih first: drains Prayer on every hit, and Prayer is your",
      "survival resource for the entire cave. Praying does not stop it.",
      "Tok-Xil next: ranged reach is 15 tiles, so you cannot fully",
      "safespot it the way you can a meleer.",
      "Ket-Zek: highest raw damage once present, but its magic is",
      "fully blocked by Protect from Magic.",
      "Yt-MejKot: only heals while adjacent to you, so it ranks below",
      "the ranged threats. Finish wounded mobs so it has nothing to heal.",
      "Tz-Kek last: lowest damage, and killing it spawns two more.",
    ],
  },
  {
    title: "Safespotting",
    lines: [
      "Ranged is recommended precisely because it lets you safespot.",
      "Position behind the arena rock formations so line of sight lets",
      "only one or two monsters reach you at a time.",
      "The wiki names one landmark, the 'Italy rock' (roughly Italy",
      "shaped), used for the healer phase. It gives no tile coordinates,",
      "so check the wiki arena map image for exact placement.",
    ],
  },
  {
    title: "Bestiary",
    lines: [
      "Tz-Kih (22): 10 HP, max 4, melee, 4t. Drains prayer per hit.",
      "Tz-Kek (45): 20 HP, max 7, melee, 4t. Splits into two lvl-22.",
      "Tok-Xil (90): 40 HP, max 14 ranged / 13 melee, 4t. 15 tile range.",
      "Yt-MejKot (180): 80 HP, max 25, melee, 4t. Heals up to 10 HP.",
      "Ket-Zek (360): 160 HP, max 52 magic / 55 melee, 4t.",
      "TzTok-Jad (702): 250 HP, max 97 range/melee, 95 magic, 8t.",
      "Yt-HurKot (108): 60 HP, max 14, melee. Heals Jad 5 HP per 4t.",
    ],
  },
  {
    title: "Wave structure (63 waves)",
    lines: [
      "Each type debuts alone, then previous types recombine in",
      "escalating counts. Spike waves to brace for:",
      "1-2: Tz-Kih only.        3: Tz-Kek debut.",
      "7: Tok-Xil debut, first ranger.",
      "15: Yt-MejKot debut, first real difficulty spike.",
      "22: Yt-MejKot + Tok-Xil.   30: Yt-MejKot x2.",
      "31: Ket-Zek debut. damage jumps hard here.",
      "45: Ket-Zek + Tok-Xil x2.  61: Ket-Zek + Yt-MejKot x2.",
      "62: Ket-Zek x2. the orange one's spawn tile marks where",
      "    Jad appears next wave. Note it.",
      "63: TzTok-Jad + 4x Yt-HurKot.",
    ],
  },
  {
    title: "Jad: the prayer flick",
    lines: [
      "8 tick (4.8s) attacks. An unprayed hit is effectively lethal.",
      "KEY RULE: keep Protect from MELEE up by default. Switch to",
      "Missiles or Magic on the incoming attack, then switch straight",
      "back to Melee. Melee gives no reaction time, so it must already",
      "be on if you ever end up adjacent.",
      "",
      "Magic tell: rears on hind legs, dangles its front legs a moment,",
      "then launches a fireball from its mouth. Pray MAGIC.",
      "Ranged tell: rears up then slams both front legs down, dropping",
      "a boulder on you. Pray MISSILES.",
      "",
      "Common mistakes: reacting to the projectile instead of the",
      "wind-up (too slow); forgetting to return to Melee between",
      "attacks; panicking mid-flick and standing with no prayer at all.",
    ],
  },
  {
    title: "Healers: the kite (what kills people)",
    lines: [
      "Four Yt-HurKot spawn at roughly half HP (125). Each heals Jad",
      "5 HP every 4 ticks, so all four will out-heal your DPS.",
      "",
      "1. The instant they spawn, tag each of the four once. They stop",
      "   healing the moment they are targeting you instead.",
      "2. Lure them to the far side of Jad using the Italy rock so they",
      "   stay bunched away from him.",
      "3. Kill them while STILL flicking Jad's prayers the whole time.",
      "",
      "If you cannot use the rock, you must run through Jad east to west",
      "and back to keep the pack off him. The wiki calls this extremely",
      "difficult. Prefer the rock.",
      "Black chinchompas hit all four at once while they are clumped.",
      "",
      "THE TRAP: kiting drags you around, and if you drift adjacent to",
      "Jad he adds an INSTANT melee with no telegraph. Panic-flicking to",
      "melee then eats the next magic or ranged hit for 95+. Watch your",
      "distance the entire healer phase. This is the single most common",
      "death for overgeared players.",
    ],
  },
];

const INFERNO: Section[] = [
  {
    title: "Requirements",
    lines: [
      "Entry needs only a Fire cape handed to TzHaar-Ket-Keh.",
      "Recommended: 90+ Ranged, 90+ Defence, 90+ HP, 80+ Prayer.",
      "94+ Magic if using Ice Barrage on nibblers and blobs.",
      "Rigour and Augury strongly recommended.",
      "Prayer switching between simultaneous attackers is required",
      "here, not optional. This is a large step up from Fight Caves.",
      "Reward: Infernal cape, up to 16,440 Tokkul.",
    ],
  },
  {
    title: "Pillars and nibblers",
    lines: [
      "Three pillars. Jal-Nib spawn every wave (3 normally, 6 on the",
      "precursor waves 3, 8, 17 and 34) and chew pillars for 2-4",
      "damage every 2.4s.",
      "If all three pillars fall, nibblers target YOU, and they hit with",
      "100% accuracy regardless of your gear.",
      "Ice Barrage clusters them. an Ice Barrage giving 152 XP killed",
      "all three in one cast.",
      "From wave 50+, do not wreck your position just to clear nibblers.",
    ],
  },
  {
    title: "Bestiary",
    lines: [
      "Jal-Nib (32): 10 HP, max 4. 100% accuracy vs you.",
      "Jal-MejRah (85): 25 HP, max 19 ranged, 3t, 4 tile range.",
      "Jal-Ak (165): 40 HP, max 29, 6t. Splits into 3 on death.",
      "Jal-ImKot (240): 75 HP, max 49 melee, 4t. Burrows to reach you.",
      "Jal-Xil (370): 125 HP, max 46 ranged / 19 melee, 4t.",
      "Jal-Zek (490): 220 HP, max 70 magic / 52 melee, 4t. Revives.",
      "JalTok-Jad (900): 350 HP, max 113, 8t (9t in the trio).",
      "Jal-MejJak (250): 75 HP. Heals Zuk 15-24 HP per 3t.",
      "TzKal-Zuk (1400): 1200 HP, max 148 typeless, 10t / 7t enraged.",
    ],
  },
  {
    title: "Per-enemy handling",
    lines: [
      "Bat (Jal-MejRah): low priority. Protect Missiles negates its",
      "run-energy and stat drains. Only 4 tile range, so step out to reset.",
      "",
      "Blob (Jal-Ak): reads your overhead and hits the OPPOSITE style",
      "3 ticks later. Counter is to flick every tick, mage/range/mage.",
      "Splits into three minions on death (ranged, magic, melee), each",
      "max 18. Same alternating flick handles the split.",
      "",
      "Meleer (Jal-ImKot): pray Melee. If it is stuck behind a pillar,",
      "let it burrow to you and kill it in the open rather than chasing.",
      "You get a 6 tick grace window after it resurfaces.",
      "",
      "Ranger (Jal-Xil): pray Missiles. It switches to melee if you are",
      "adjacent, including diagonally.",
      "",
      "Mager (Jal-Zek): most dangerous regular-wave monster at 70 magic.",
      "Pray Magic. It revives one already-dead monster at half HP",
      "(each revivable once, cannot revive nibblers or minis) and does",
      "not attack for about 7 ticks around the revive cast.",
    ],
  },
  {
    title: "Wave structure (69 waves)",
    lines: [
      "1-17: nibblers and bats.",
      "18-34: rangers introduced.",
      "35-49: magers introduced.",
      "50-66: mager and ranger combinations. the hardest regular waves.",
      "67: single JalTok-Jad. spawns 5 healers at half HP.",
      "68: TRIPLE JalTok-Jad. 3 healers each.",
      "69: TzKal-Zuk.",
    ],
  },
  {
    title: "Waves 67-68: the Jads",
    lines: [
      "Same prayer flick as Fight Caves Jad, but 350 HP and max 113.",
      "Wave 67 is a single Jad, 8t, and spawns 5 Yt-HurKot at half HP.",
      "Tag them off exactly like the Fire Cape healer phase.",
      "",
      "Wave 68 is three Jads in a triangle at 9 ticks. The first attacks",
      "normally, the other two are delayed about 3 ticks, so all three",
      "land on a 9 tick cycle you can flick together. Each spawns only",
      "3 healers. This is the run's biggest prayer-flick DPS check.",
    ],
  },
  {
    title: "Wave 69: TzKal-Zuk",
    lines: [
      "1200 HP, max 148 TYPELESS. you cannot pray it or tick-eat it.",
      "10 tick attacks normally, 7 when enraged. 7x7 footprint.",
      "",
      "SHIELD: a glyph shield slides left and right between you and Zuk.",
      "You must stay behind its TRUE position. The animation does not",
      "perfectly reflect where it actually is, so stay centred or",
      "slightly in front of it, never lagging behind, and keep moving",
      "with it. Never take an extra attack at the risk of eating a Zuk",
      "hit. Drop vials or runes to mark your safe tiles.",
      "",
      "TRIGGERS:",
      "Start: after the shield completes one full left-right-left",
      "  rotation, a mager and ranger spawn behind you.",
      "600 HP: spawn timer pauses and 105 seconds is added. Clear the set.",
      "480 HP: a JalTok-Jad spawns behind you and the timer unpauses.",
      "  Do NOT push Zuk below 240 while still handling Jad plus the set.",
      "240 HP: Zuk enrages to 7 ticks and spawns 4 Jal-MejJak healers",
      "  on the lava in front of him.",
      "",
      "HEALERS: each heals Zuk 15-24 HP every 3 ticks until struck. Once",
      "hit, a healer turns and rains lava about 3 tiles out for 5-10.",
      "Tag one to stop its healing, then tag another, alternating. Keep",
      "your HP above ~25. stacked lava plus a Zuk hit kills instantly.",
    ],
  },
];

function gearSections(): Section[] {
  const out: Section[] = [
    {
      title: "How to use this",
      lines: [
        "Pick your tier in the Loadout panel to fill the fields, then",
        "OVERWRITE the two bonus totals with your real numbers from the",
        "in-game Equipment Stats screen. The tier totals below are",
        "estimates aggregated across a full setup, not exact item data.",
        "Level requirements are exact.",
      ],
    },
  ];
  for (const t of GEAR_TIERS) {
    out.push({
      title: `${t.wealth}`,
      lines: [t.reqs, "", ...t.gear, "", t.note],
    });
  }
  out.push({
    title: "Key level requirements",
    lines: [
      "Weapons: msb 50, rune cbow 61, dragon cbow 64, Armadyl/Karil's/",
      "  crystal 70, blowpipe 75, Zaryte cbow 80, bofa 80, tbow 85.",
      "Ammo: adamant dart 30, rune dart 40, amethyst 55, dragon dart 60,",
      "  rune arrow 40, dragon arrow 60, dragon bolts 61.",
      "Armour: ranger boots 40, d'hide 40/50/60/70 by colour,",
      "  blessed d'hide 70, Karil's & Armadyl 70 Ranged + 70 Def,",
      "  crystal 70/70 + 50 Agility, Masori 80, Pegasian 75 Ranged +",
      "  75 Def, twisted buckler 75, Ava's acc 50 / assembler 70.",
      "Prayers: Protect Magic 37, Missiles 40, Melee 43, Eagle Eye 44,",
      "  Rigour 74 (+Dexterous scroll), Augury 77 (+Arcane scroll).",
    ],
  });
  return out;
}

export function createGuidePanel(): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "guide";

  const header = document.createElement("div");
  header.className = "guide-tabs";
  const body = document.createElement("div");
  body.className = "guide-body";

  const render = (sections: Section[]) => {
    body.innerHTML = "";
    body.scrollTop = 0;
    for (const sec of sections) {
      const h = document.createElement("h3");
      h.textContent = sec.title;
      body.appendChild(h);
      const ul = document.createElement("ul");
      for (const line of sec.lines) {
        const li = document.createElement("li");
        li.textContent = line;
        if (line === "") li.className = "spacer";
        ul.appendChild(li);
      }
      body.appendChild(ul);
    }
  };

  const tabs: [string, () => Section[]][] = [
    ["Fight Caves", () => FIGHT_CAVES],
    ["Inferno", () => INFERNO],
    ["Gear", gearSections],
  ];
  tabs.forEach(([name, get], i) => {
    const b = document.createElement("button");
    b.textContent = name;
    if (i === 0) b.classList.add("active");
    b.addEventListener("click", () => {
      header.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active");
      render(get());
    });
    header.appendChild(b);
  });

  panel.innerHTML = `<h2>Strategy</h2>`;
  panel.appendChild(header);
  panel.appendChild(body);
  render(FIGHT_CAVES);
  return panel;
}
