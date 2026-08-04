const LABELS_KEY = "osrs-companion:labels:v1";
const ICONS_KEY = "osrs-companion:mapicons:v1";
const SIZE_KEY = "osrs-companion:mapsize:v1";

export const SIZE_MIN = 0.5;
export const SIZE_MAX = 3;
export const SIZE_DEFAULTS = { pin: 1, label: 1, icon: 1 };

export type SizeKey = keyof typeof SIZE_DEFAULTS;
export type SizePrefs = typeof SIZE_DEFAULTS;

function clampMul(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 1;
  return Math.min(SIZE_MAX, Math.max(SIZE_MIN, n));
}

function loadSizes(): SizePrefs {
  try {
    const raw = localStorage.getItem(SIZE_KEY);
    if (!raw) return { ...SIZE_DEFAULTS };
    const p = JSON.parse(raw) as Partial<SizePrefs>;
    return { pin: clampMul(p.pin), label: clampMul(p.label), icon: clampMul(p.icon) };
  } catch {
    return { ...SIZE_DEFAULTS };
  }
}

let labelsVisible = localStorage.getItem(LABELS_KEY) !== "0";
let iconsVisible = localStorage.getItem(ICONS_KEY) !== "0";
let sizePrefs: SizePrefs = loadSizes();

export function labelsOn(): boolean {
  return labelsVisible;
}

export function setLabelsOn(on: boolean): void {
  labelsVisible = on;
  localStorage.setItem(LABELS_KEY, on ? "1" : "0");
}

export function iconsOn(): boolean {
  return iconsVisible;
}

export function setIconsOn(on: boolean): void {
  iconsVisible = on;
  localStorage.setItem(ICONS_KEY, on ? "1" : "0");
}

export function sizes(): SizePrefs {
  return sizePrefs;
}

export function setSize(key: SizeKey, value: number): number {
  sizePrefs[key] = clampMul(value);
  localStorage.setItem(SIZE_KEY, JSON.stringify(sizePrefs));
  return sizePrefs[key];
}

export function resetSizes(): void {
  sizePrefs = { ...SIZE_DEFAULTS };
  localStorage.setItem(SIZE_KEY, JSON.stringify(sizePrefs));
}
