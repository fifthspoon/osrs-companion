export function gp(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}b`;
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}m`;
  if (a >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(Math.round(n));
}

export function age(sec: number): string {
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
  return `${Math.floor(sec / 86400)}d`;
}

export function duration(hours: number): string {
  if (!Number.isFinite(hours)) return "never";
  const mins = hours * 60;
  if (mins < 1) return "under a minute";
  if (mins < 90) return `about ${Math.round(mins)} min`;
  if (hours < 24) return `about ${hours.toFixed(1)} hours`;
  return `about ${Math.round(hours / 24)} days`;
}

export function count(n: number): string {
  return Math.round(n).toLocaleString();
}

export function parseGp(v: string): number {
  const raw = v.trim().toLowerCase().replace(/[, ]/g, "");
  const mult = raw.endsWith("b") ? 1e9 : raw.endsWith("m") ? 1e6 : raw.endsWith("k") ? 1e3 : 1;
  const n = parseFloat(raw) * mult;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : -1;
}
