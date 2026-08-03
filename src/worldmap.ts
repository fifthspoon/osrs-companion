// World map coordinate model.
//
// The map is now a tile pyramid pulled from the wiki (see scripts/fetch-tiles.mjs)
// rather than one giant PNG, and that changes everything about placement.
//
// Tiles are indexed directly by in-game coordinates:
//
//   span   = 256 / 2^z        game squares covered by one 256px tile
//   tileX  = floor(worldX / span)
//   tileY  = floor(worldY / span)
//
// So the world-to-pixel transform is EXACT and derived, not measured. There is
// nothing left to calibrate: no landmark clicking, no two-point solve, no
// horizontal uncertainty. Every route stop and marker lands on the true pixel
// straight from its world coords. If a pin looks wrong now, the pin's world
// coords are wrong, not the map.

const MARK_KEY = "osrs-companion:markers:v1";

// Native resolution of the pulled tiles. z3 is maxNativeZoom on the wiki's
// pipeline (z4 and z5 are 404), so 8 px per game square is the real ceiling.
export const NATIVE_Z = 3;
export const TILE_PX = 256;
export const PX_PER_SQUARE = 1 << NATIVE_Z;          // 8
export const SQUARES_PER_TILE = TILE_PX / PX_PER_SQUARE; // 32

// Top of the base pixel space, in world y. Must be a multiple of the largest
// tile span (256 at z0) so tile rows line up at every zoom, which is why this
// is 4352 rather than the 4224 the old flat map used.
export const ORIGIN_Y = 4352;

// Extent actually pulled by scripts/fetch-tiles.mjs. Used to clamp panning so
// you cannot drag off into empty space forever.
export const WORLD_BOUNDS = { minX: 1024, minY: 2048, maxX: 4096, maxY: 4224 };

// Base pixel space, measured at NATIVE_Z.
export const BASE_W = WORLD_BOUNDS.maxX * PX_PER_SQUARE;
export const BASE_H = (ORIGIN_Y - WORLD_BOUNDS.minY) * PX_PER_SQUARE;

export interface CustomMarker {
  id: string;
  label: string;
  wx: number;
  wy: number;
}

export function loadMarkers(): CustomMarker[] {
  try {
    const raw = localStorage.getItem(MARK_KEY);
    if (raw) return JSON.parse(raw) as CustomMarker[];
  } catch {
    // fall through
  }
  return [];
}

export function saveMarkers(m: CustomMarker[]): void {
  try {
    localStorage.setItem(MARK_KEY, JSON.stringify(m));
  } catch {
    // ignore
  }
}

// World coords to base pixel space. y is flipped because north is up in game.
export function worldToPx(wx: number, wy: number) {
  return { x: wx * PX_PER_SQUARE, y: (ORIGIN_Y - wy) * PX_PER_SQUARE };
}

export function pxToWorld(px: number, py: number) {
  return { wx: px / PX_PER_SQUARE, wy: ORIGIN_Y - py / PX_PER_SQUARE };
}

// Pick the tile zoom whose native resolution best covers the on-screen scale.
// `screenScale` is screen pixels per base pixel. Rounding up means tiles are
// downscaled slightly rather than stretched, which keeps them sharp.
export function pickTileZoom(screenScale: number): number {
  const perSquare = screenScale * PX_PER_SQUARE;
  const z = Math.ceil(Math.log2(Math.max(perSquare, 1e-6)));
  return Math.max(0, Math.min(NATIVE_Z, z));
}

// Geometry of one tile at a given zoom, in base pixel space.
export function tileSpan(z: number): number {
  return TILE_PX / (1 << z);
}

export function tileBaseSize(z: number): number {
  return tileSpan(z) * PX_PER_SQUARE;
}

export function tileUrl(z: number, tx: number, ty: number): string {
  return `/tiles/${z}/${tx}_${ty}.png`;
}

// Base pixel top-left corner of tile (tx, ty). The +1 on ty is the y flip: the
// tile's northern edge is its top on screen.
export function tileOrigin(z: number, tx: number, ty: number) {
  const span = tileSpan(z);
  return {
    x: tx * span * PX_PER_SQUARE,
    y: (ORIGIN_Y - (ty + 1) * span) * PX_PER_SQUARE,
  };
}

// Inclusive tile index range covering a base pixel rectangle.
export function tileRange(z: number, x0: number, y0: number, x1: number, y1: number) {
  const size = tileBaseSize(z);
  const span = tileSpan(z);
  return {
    tx0: Math.floor(x0 / size),
    tx1: Math.floor(x1 / size),
    // Flipped, so the low base-y edge is the high tile index.
    ty0: Math.floor((ORIGIN_Y - y1 / PX_PER_SQUARE) / span),
    ty1: Math.floor((ORIGIN_Y - y0 / PX_PER_SQUARE) / span),
  };
}
