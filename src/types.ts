// ─── Zone types ────────────────────────────────────────────────────────────────

export type ZoneType = 'z1' | 'z2' | 'z3' | 'z4' | 'z5' | 'z6' | 'z7';

export interface ZoneConfig {
  label: string;
  color: string;   // text colour
  bg: string;      // background
  border: string;  // accent border
  intensity: number; // 1-7
}

export const ZONE_CONFIG: Record<ZoneType, ZoneConfig> = {
  z1: { label: 'Z1 – Récup',     color: '#134a6e', bg: '#a8d8ea', border: '#5badd4', intensity: 1 },
  z2: { label: 'Z2 – Endurance', color: '#ffffff', bg: '#52b788', border: '#2d9a5f', intensity: 2 },
  z3: { label: 'Z3 – Tempo',     color: '#5a3e00', bg: '#ffd60a', border: '#e6b800', intensity: 3 },
  z4: { label: 'Z4 – Seuil',     color: '#ffffff', bg: '#f4722b', border: '#c9521a', intensity: 4 },
  z5: { label: 'Z5 – VO2max',    color: '#ffffff', bg: '#e63946', border: '#b5202d', intensity: 5 },
  z6: { label: 'Z6 – Anaérobie', color: '#ffffff', bg: '#9b2226', border: '#6e1519', intensity: 6 },
  z7: { label: 'Z7 – Neuro',     color: '#ffffff', bg: '#560764', border: '#3a0445', intensity: 7 },
};

export const ZONES: ZoneType[] = ['z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7'];

/** Tuple of zone keys used for index-based lookups */
export const ZONE_KEYS = ['z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7'] as const;

// ─── Block ─────────────────────────────────────────────────────────────────────

export interface Block {
  id: string;
  duration: number; // seconds
  zone: ZoneType;
  watts?: number;   // target power in watts; if undefined, derived from zone midpoint
}

// ─── Zone range ────────────────────────────────────────────────────────────────

export interface ZoneRange {
  min: number;
  max: number;
}

// ─── Timeline constants ─────────────────────────────────────────────────────────

/** Pixels rendered per second of duration (kept for drag overlay compat) */
export const PX_PER_SECOND = 1.5;

/** Minimum block duration in seconds */
export const MIN_DURATION = 30;
export const SNAP_GRID = 30;

/** Default duration for a newly added block */
export const DEFAULT_DURATION = 300;

/** Canvas height for the blocks area in pixels */
export const CANVAS_HEIGHT = 220;

/** Total number of intensity zones (used for intensity bar height calculation) */
export const TOTAL_ZONES = 7;

/** Minimum block height in pixels */
export const MIN_BLOCK_HEIGHT = 28;

// ─── Utility ───────────────────────────────────────────────────────────────────

let _counter = 0;
export function generateId(): string {
  return `block-${Date.now()}-${++_counter}`;
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (s === 0) return `${m}min`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
