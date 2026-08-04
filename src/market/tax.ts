export const TAX_RATE = 0.02;
export const TAX_CAP = 5_000_000;

export const EXEMPT_IDS = new Set([
  13190, 882, 806, 884, 807, 558, 886, 808, 365, 2309, 1891, 2140, 2142, 347,
  379, 355, 2327, 351, 329, 315, 361, 28824, 3853, 2552, 1755, 5325, 1785,
  2347, 1733, 233, 5341, 8794, 5329, 5343, 1735, 952, 5331,
  8011, 8010, 8009, 28790, 8008, 8013, 8007,
  3014, 3012, 3010, 3008,
]);

export const TAX_HINT =
  "Tax is 2% (changed from 1% on 29 May 2025), rounded down, capped at 5m, and 48 items are exempt including bonds and every teleport tablet.";

export function geTax(sellPrice: number, id: number): number {
  if (EXEMPT_IDS.has(id)) return 0;
  return Math.min(TAX_CAP, Math.floor(sellPrice * TAX_RATE));
}
