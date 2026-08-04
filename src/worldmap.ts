
const MARK_KEY = "osrs-companion:markers:v1";

export const NATIVE_Z = 3;
export const TILE_PX = 256;
export const PX_PER_SQUARE = 1 << NATIVE_Z;          // 8
export const SQUARES_PER_TILE = TILE_PX / PX_PER_SQUARE; // 32

export const ORIGIN_Y = 4352;

export const WORLD_BOUNDS = { minX: 960, minY: 2048, maxX: 4032, maxY: 4224 };

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
  }
  return [];
}

export function saveMarkers(m: CustomMarker[]): void {
  try {
    localStorage.setItem(MARK_KEY, JSON.stringify(m));
  } catch {
  }
}

export function worldToPx(wx: number, wy: number) {
  return { x: wx * PX_PER_SQUARE, y: (ORIGIN_Y - wy) * PX_PER_SQUARE };
}

export function pxToWorld(px: number, py: number) {
  return { wx: px / PX_PER_SQUARE, wy: ORIGIN_Y - py / PX_PER_SQUARE };
}

export function pickTileZoom(screenScale: number): number {
  const perSquare = screenScale * PX_PER_SQUARE;
  const z = Math.ceil(Math.log2(Math.max(perSquare, 1e-6)));
  return Math.max(0, Math.min(NATIVE_Z, z));
}

export function tileSpan(z: number): number {
  return TILE_PX / (1 << z);
}

export function tileBaseSize(z: number): number {
  return tileSpan(z) * PX_PER_SQUARE;
}

export function tileUrl(z: number, tx: number, ty: number): string {
  return `/tiles/${z}/${tx}_${ty}.png`;
}

export function tileOrigin(z: number, tx: number, ty: number) {
  const span = tileSpan(z);
  return {
    x: tx * span * PX_PER_SQUARE,
    y: (ORIGIN_Y - (ty + 1) * span) * PX_PER_SQUARE,
  };
}

export function tileRange(z: number, x0: number, y0: number, x1: number, y1: number) {
  const size = tileBaseSize(z);
  const span = tileSpan(z);
  return {
    tx0: Math.floor(x0 / size),
    tx1: Math.floor(x1 / size),
    ty0: Math.floor((ORIGIN_Y - y1 / PX_PER_SQUARE) / span),
    ty1: Math.floor((ORIGIN_Y - y0 / PX_PER_SQUARE) / span),
  };
}
