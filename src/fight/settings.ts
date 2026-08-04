import type { Loadout, RangedPrayer, RangedStyle, VoidRanged } from "./engine/loadout";
import { maxHit, hitChance } from "./engine/loadout";
import {
  JAD_DEFENCE_LEVEL,
  JAD_RANGED_DEF_BONUS,
  REACTION_PRESETS,
  DEFAULT_REACTION,
} from "./engine/constants";
import type { ReactionPreset } from "./engine/constants";
import { GEAR_TIERS } from "./data/presets";

export function createSettingsPanel(
  initial: Loadout,
  onApply: (l: Loadout, reactionTicks: number) => void,
): HTMLElement {
  const l: Loadout = { ...initial };
  let reaction: ReactionPreset = DEFAULT_REACTION;
  const controls: Record<string, HTMLInputElement | HTMLSelectElement> = {};

  const panel = document.createElement("div");
  panel.className = "settings";
  panel.innerHTML = `<h2>Loadout</h2>`;

  const preview = document.createElement("div");
  preview.className = "preview";

  const refresh = () => {
    const mh = maxHit(l);
    const acc = hitChance(l, {
      defenceLevel: JAD_DEFENCE_LEVEL,
      rangedDefenceBonus: JAD_RANGED_DEF_BONUS,
    });
    const dps = (acc * (mh / 2)) / (l.attackSpeedTicks * 0.6);
    preview.innerHTML =
      `<span>Max hit <b>${mh}</b></span>` +
      `<span>Acc vs Jad <b>${(acc * 100).toFixed(1)}%</b></span>` +
      `<span>DPS <b>${dps.toFixed(2)}</b></span>`;
  };

  const num = (label: string, key: keyof Loadout, min: number, max: number) => {
    const row = document.createElement("label");
    row.textContent = label;
    const input = document.createElement("input");
    input.type = "number";
    input.min = String(min);
    input.max = String(max);
    input.value = String(l[key]);
    input.addEventListener("input", () => {
      const v = Number(input.value);
      if (!Number.isNaN(v)) {
        (l as unknown as Record<string, unknown>)[key] = v;
        refresh();
      }
    });
    row.appendChild(input);
    panel.appendChild(row);
    controls[key] = input;
  };

  const sel = <T extends string>(label: string, key: keyof Loadout, opts: [T, string][]) => {
    const row = document.createElement("label");
    row.textContent = label;
    const s = document.createElement("select");
    for (const [val, text] of opts) {
      const o = document.createElement("option");
      o.value = val;
      o.textContent = text;
      if (l[key] === val) o.selected = true;
      s.appendChild(o);
    }
    s.addEventListener("change", () => {
      (l as unknown as Record<string, unknown>)[key] = s.value;
      refresh();
    });
    row.appendChild(s);
    panel.appendChild(row);
    controls[key] = s;
  };

  const tierNote = document.createElement("p");
  tierNote.className = "hint";

  {
    const row = document.createElement("label");
    row.textContent = "Gear tier";
    const s = document.createElement("select");
    const custom = document.createElement("option");
    custom.value = "-1";
    custom.textContent = "Custom";
    s.appendChild(custom);
    GEAR_TIERS.forEach((t, i) => {
      const o = document.createElement("option");
      o.value = String(i);
      o.textContent = `${t.wealth}: ${t.loadout.label}`;
      s.appendChild(o);
    });
    s.addEventListener("change", () => {
      const i = Number(s.value);
      if (i < 0) {
        tierNote.textContent = "";
        return;
      }
      const tier = GEAR_TIERS[i];
      Object.assign(l, tier.loadout);
      for (const key of Object.keys(controls)) {
        controls[key].value = String((l as unknown as Record<string, unknown>)[key]);
      }
      tierNote.textContent = `${tier.reqs}. Bonus totals are estimates, see the Gear tab.`;
      refresh();
    });
    row.appendChild(s);
    panel.appendChild(row);
    panel.appendChild(tierNote);
  }

  num("Ranged level", "rangedLevel", 1, 99);
  num("Hitpoints", "hpLevel", 10, 99);
  num("Defence level", "defenceLevel", 1, 99);
  sel<RangedPrayer>("Prayer", "prayer", [
    ["rigour", "Rigour (+23% dmg)"],
    ["eagle_eye", "Eagle Eye (+15%)"],
    ["none", "None"],
  ]);
  sel<RangedStyle>("Style", "style", [
    ["rapid", "Rapid (fast)"],
    ["accurate", "Accurate (+3)"],
    ["longrange", "Longrange"],
  ]);
  sel<VoidRanged>("Void", "void", [
    ["none", "None"],
    ["regular", "Regular"],
    ["elite", "Elite"],
  ]);
  num("Weapon speed (ticks)", "attackSpeedTicks", 1, 10);
  num("Ranged attack bonus", "rangedAttackBonus", 0, 400);
  num("Ranged strength bonus", "rangedStrengthBonus", 0, 400);

  {
    const row = document.createElement("label");
    row.textContent = "Difficulty";
    const s = document.createElement("select");
    const opts: [ReactionPreset, string][] = [
      ["hard", "Hard (1.2s), harder than real"],
      ["standard", "Standard (1.8s)"],
      ["learning", "Learning (2.4s)"],
      ["brutal", "Brutal (0.6s)"],
    ];
    for (const [val, text] of opts) {
      const o = document.createElement("option");
      o.value = val;
      o.textContent = text;
      if (val === reaction) o.selected = true;
      s.appendChild(o);
    }
    s.addEventListener("change", () => {
      reaction = s.value as ReactionPreset;
    });
    row.appendChild(s);
    panel.appendChild(row);
  }

  panel.appendChild(preview);

  const apply = document.createElement("button");
  apply.textContent = "Apply & restart";
  apply.addEventListener("click", () => onApply({ ...l }, REACTION_PRESETS[reaction]));
  panel.appendChild(apply);

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent =
    "Pick a tier, then overwrite the two bonus totals with your real Equipment Stats numbers for a 1:1 match.";
  panel.appendChild(hint);

  refresh();
  return panel;
}
