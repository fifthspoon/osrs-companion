export interface LabelDef {
  name: string;
  wx: number;
  wy: number;
  type: string;
  len: number;
  tier: number;
}

export interface IconData {
  source: string;
  threshold: number;
  types: Record<string, { file: string; name: string; category: string }>;
  icons: [string, number, number, number][];
}

const TYPE_WEIGHT: Record<string, number> = {
  region: 100, kingdom: 100, city: 85, settlement: 80, island: 60,
  maplink: 55, guild: 50, minigame: 48, dungeon: 40, boss: 40,
  mine: 34, "hunter area": 30,
};

function scoreOf(l: { type: string; len: number }): number {
  return (TYPE_WEIGHT[l.type] ?? 20) + Math.min(20, l.len / 2000);
}

function assignTiers(list: LabelDef[]): void {
  list.sort((a, b) => scoreOf(b) - scoreOf(a));
  list.forEach((l, i) => {
    l.tier = i < 20 ? 0 : i < 80 ? 1 : i < 220 ? 2 : 3;
  });
}

function cleanName(n: string): string {
  return n.replace(/\s*\((location|island|area|region|surface)\)\s*$/i, "");
}

export function tierForZoom(perSquare: number): number {
  if (perSquare < 0.35) return 0;
  if (perSquare < 0.9) return 1;
  if (perSquare < 2.5) return 2;
  return 3;
}

type LoadState = "idle" | "loading" | "done";

let labelData: LabelDef[] = [];
let labelState: LoadState = "idle";
const labelWaiting: Array<() => void> = [];

let iconData: IconData | null = null;
let iconState: LoadState = "idle";
const iconWaiting: Array<() => void> = [];

function drain(queue: Array<() => void>): void {
  const pending = queue.splice(0);
  for (const fn of pending) fn();
}

export function labels(): LabelDef[] {
  return labelData;
}

export function icons(): IconData | null {
  return iconData;
}

export function ensureLabels(onReady: () => void): void {
  if (labelState === "done") {
    onReady();
    return;
  }
  labelWaiting.push(onReady);
  if (labelState === "loading") return;
  labelState = "loading";
  fetch("/labels.json")
    .then((r) => (r.ok ? r.json() : []))
    .then((raw: Omit<LabelDef, "tier">[]) => {
      labelData = raw.map((l) => ({ ...l, name: cleanName(l.name), tier: 3 }));
      assignTiers(labelData);
    })
    .catch(() => {
      labelData = [];
    })
    .finally(() => {
      labelState = "done";
      drain(labelWaiting);
    });
}

export function ensureIcons(onReady: () => void): void {
  if (iconState === "done") {
    onReady();
    return;
  }
  iconWaiting.push(onReady);
  if (iconState === "loading") return;
  iconState = "loading";
  fetch("/mapicons.json")
    .then((r) => (r.ok ? r.json() : null))
    .then((raw: IconData | null) => {
      iconData = raw;
    })
    .catch(() => {
      iconData = null;
    })
    .finally(() => {
      iconState = "done";
      drain(iconWaiting);
    });
}
