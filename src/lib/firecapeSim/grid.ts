import type { Vec } from "./types";
import { ARENA, TILE, GRID_W, GRID_H } from "./constants";

export function chebyshev(a: Vec, b: Vec): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function distToBlock(p: Vec, topLeft: Vec, size: number): number {
  const dx = Math.max(topLeft.x - p.x, 0, p.x - (topLeft.x + size - 1));
  const dy = Math.max(topLeft.y - p.y, 0, p.y - (topLeft.y + size - 1));
  return Math.max(dx, dy);
}

export function inBounds(p: Vec): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < GRID_W && p.y < GRID_H;
}

export function stepToward(from: Vec, target: Vec): Vec {
  return {
    x: from.x + Math.sign(target.x - from.x),
    y: from.y + Math.sign(target.y - from.y),
  };
}

export function tileCenter(t: Vec): Vec {
  return { x: ARENA.x + t.x * TILE + TILE / 2, y: ARENA.y + t.y * TILE + TILE / 2 };
}

export function blockCenter(topLeft: Vec, size: number): Vec {
  return {
    x: ARENA.x + (topLeft.x + size / 2) * TILE,
    y: ARENA.y + (topLeft.y + size / 2) * TILE,
  };
}

export function pxToTile(px: number, py: number): Vec | null {
  const x = Math.floor((px - ARENA.x) / TILE);
  const y = Math.floor((py - ARENA.y) / TILE);
  const t = { x, y };
  return inBounds(t) ? t : null;
}
