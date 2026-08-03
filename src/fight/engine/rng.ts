// Deterministic PRNG (mulberry32). The RNG state lives in GameState.seed and is
// threaded through every draw, so a run is fully reproducible from its seed,
// which means you can replay and review a death tick-by-tick later.
export function nextRandom(seed: number): { value: number; seed: number } {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, seed: t };
}
