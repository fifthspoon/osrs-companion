const KEY = "osrs-companion:players:v1";
const OLD_KEY = "osrs-companion:player:v1";
const API = "https://api.wiseoldman.net/v2";

export const MAX_NAME = 12;

export const SKILLS = [
  "attack", "strength", "defence", "hitpoints", "ranged", "magic", "prayer",
  "agility", "herblore", "thieving", "crafting", "fletching", "slayer",
  "hunter", "mining", "smithing", "fishing", "cooking", "firemaking",
  "woodcutting", "farming", "runecrafting", "construction", "sailing",
] as const;

export const COMBAT_SKILLS = [
  "attack", "strength", "defence", "hitpoints", "ranged", "magic", "prayer",
] as const;

export interface Skill {
  level: number;
  experience: number;
  rank: number;
}

export interface Character {
  id: string;
  name: string;
  displayName: string;
  type: string;
  build: string;
  combatLevel: number | null;
  totalLevel: number;
  exp: number;
  skills: Record<string, Skill>;
  updatedAt: number;
  syncedAt: number;
  manual: boolean;
}

interface Roster {
  active: string;
  list: Character[];
}

export function normalise(raw: string): string {
  return raw.replace(/_/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_NAME);
}

export function idFor(name: string): string {
  return normalise(name).toLowerCase();
}

export function combatOf(levels: Record<string, number>): number {
  const at = levels.attack ?? 1;
  const st = levels.strength ?? 1;
  const df = levels.defence ?? 1;
  const hp = levels.hitpoints ?? 10;
  const rn = levels.ranged ?? 1;
  const mg = levels.magic ?? 1;
  const pr = levels.prayer ?? 1;
  const base = 0.25 * (df + hp + Math.floor(pr / 2));
  const melee = (13 / 40) * (at + st);
  const range = (13 / 40) * Math.floor(rn * 1.5);
  const mage = (13 / 40) * Math.floor(mg * 1.5);
  return Math.floor(base + Math.max(melee, range, mage));
}

export function defaultLevels(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of SKILLS) out[s] = s === "hitpoints" ? 10 : 1;
  return out;
}

export function isUnranked(s: Skill | undefined): boolean {
  return !!s && s.experience < 0;
}

export function levelsOf(c: Character): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of SKILLS) {
    const floorLevel = s === "hitpoints" ? 10 : 1;
    const skill = c.skills[s];
    out[s] = !skill || isUnranked(skill) ? floorLevel : Math.max(floorLevel, skill.level);
  }
  return out;
}

let roster: Roster = read();

function blank(): Roster {
  return { active: "", list: [] };
}

function read(): Roster {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const r = JSON.parse(raw) as Roster;
      if (r && Array.isArray(r.list)) {
        r.list = r.list.filter((c) => c && typeof c.id === "string" && c.skills);
        if (!r.list.some((c) => c.id === r.active)) r.active = r.list[0]?.id ?? "";
        return r;
      }
    }
    return migrate();
  } catch {
    return blank();
  }
}

function migrate(): Roster {
  try {
    const raw = localStorage.getItem(OLD_KEY);
    if (!raw) return blank();
    const p = JSON.parse(raw);
    if (!p || typeof p.name !== "string" || !p.skills) return blank();
    const c: Character = { ...p, id: idFor(p.name), manual: false };
    const r: Roster = { active: c.id, list: [c] };
    write(r);
    localStorage.removeItem(OLD_KEY);
    return r;
  } catch {
    return blank();
  }
}

function write(r: Roster): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(r));
  } catch {
  }
}

export function list(): Character[] {
  return roster.list;
}

export function get(): Character | null {
  return roster.list.find((c) => c.id === roster.active) ?? null;
}

export function setActive(id: string): void {
  if (!roster.list.some((c) => c.id === id)) return;
  roster.active = id;
  write(roster);
}

export function remove(id: string): void {
  roster.list = roster.list.filter((c) => c.id !== id);
  if (roster.active === id) roster.active = roster.list[0]?.id ?? "";
  write(roster);
}

function upsert(c: Character): Character {
  const i = roster.list.findIndex((x) => x.id === c.id);
  if (i >= 0) roster.list[i] = c;
  else roster.list.push(c);
  roster.active = c.id;
  write(roster);
  return c;
}

export function saveManual(name: string, levels: Record<string, number>): Character {
  const clean = normalise(name);
  if (!clean) throw new Error("Give the character a name.");

  const skills: Record<string, Skill> = {};
  let total = 0;
  for (const s of SKILLS) {
    const floorLevel = s === "hitpoints" ? 10 : 1;
    const level = Math.max(floorLevel, Math.min(99, Math.round(levels[s] ?? floorLevel)));
    skills[s] = { level, experience: 0, rank: -1 };
    total += level;
  }
  skills.overall = { level: total, experience: 0, rank: -1 };

  const now = Date.now();
  return upsert({
    id: idFor(clean),
    name: clean,
    displayName: clean,
    type: "regular",
    build: "main",
    combatLevel: combatOf(levels),
    totalLevel: total,
    exp: 0,
    skills,
    updatedAt: now,
    syncedAt: now,
    manual: true,
  });
}

function parse(json: any, fallbackName: string): Character {
  const raw = json?.latestSnapshot?.data?.skills ?? {};
  const skills: Record<string, Skill> = {};
  for (const key of Object.keys(raw)) {
    const s = raw[key];
    skills[key] = {
      level: typeof s?.level === "number" ? s.level : 0,
      experience: typeof s?.experience === "number" ? s.experience : 0,
      rank: typeof s?.rank === "number" ? s.rank : -1,
    };
  }
  const name = normalise(json?.username ?? fallbackName);
  return {
    id: idFor(name),
    name,
    displayName: json?.displayName ?? name,
    type: json?.type ?? "regular",
    build: json?.build ?? "main",
    combatLevel: typeof json?.combatLevel === "number" ? json.combatLevel : null,
    totalLevel: skills.overall?.level ?? 0,
    exp: typeof json?.exp === "number" ? json.exp : (skills.overall?.experience ?? 0),
    skills,
    updatedAt: Date.parse(json?.updatedAt ?? "") || 0,
    syncedAt: Date.now(),
    manual: false,
  };
}

async function call(url: string, init?: RequestInit): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new Error("Could not reach WiseOldMan. Check your connection.");
  }
  if (res.status === 404) throw new Error("No player by that name on the hiscores.");
  if (res.status === 400) throw new Error("That is not a valid RuneScape name.");
  if (res.status === 429) throw new Error("WiseOldMan is rate limiting. Try again shortly.");
  if (!res.ok) throw new Error(`WiseOldMan returned ${res.status}.`);
  return res.json();
}

function tracked(json: any): boolean {
  return !!json?.latestSnapshot?.data?.skills && json?.type !== "unknown";
}

export async function sync(name: string): Promise<Character> {
  const clean = normalise(name);
  if (!clean) throw new Error("Enter a player name first.");
  const url = `${API}/players/${encodeURIComponent(clean)}`;

  const known = await call(url);
  if (!tracked(known)) throw new Error("No player by that name on the hiscores.");

  let json = known;
  try {
    const fresh = await call(url, { method: "POST" });
    if (tracked(fresh)) json = fresh;
  } catch {
  }

  return upsert(parse(json, clean));
}
