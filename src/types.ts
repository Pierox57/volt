// ─── Zone types ────────────────────────────────────────────────────────────────

export type ZoneType = 'z1' | 'z2' | 'tempo' | 'threshold' | 'vo2';

export interface ZoneConfig {
  label: string;
  color: string;  // text colour
  bg: string;     // background
  border: string; // accent border
  intensity: number; // 1-5, used for visual ordering
}

export const ZONE_CONFIG: Record<ZoneType, ZoneConfig> = {
  z1:        { label: 'Zone 1',  color: '#134a6e', bg: '#a8d8ea', border: '#5badd4', intensity: 1 },
  z2:        { label: 'Zone 2',  color: '#ffffff', bg: '#52b788', border: '#2d9a5f', intensity: 2 },
  tempo:     { label: 'Tempo',   color: '#5a3e00', bg: '#ffd60a', border: '#e6b800', intensity: 3 },
  threshold: { label: 'Seuil',   color: '#ffffff', bg: '#f4722b', border: '#c9521a', intensity: 4 },
  vo2:       { label: 'VO2',     color: '#ffffff', bg: '#e63946', border: '#b5202d', intensity: 5 },
};

export const ZONES: ZoneType[] = ['z1', 'z2', 'tempo', 'threshold', 'vo2'];

// ─── Block ─────────────────────────────────────────────────────────────────────

export interface Block {
  id: string;
  duration: number; // seconds
  zone: ZoneType;
}

// ─── Timeline constants ─────────────────────────────────────────────────────────

/** Pixels rendered per second of duration */
export const PX_PER_SECOND = 1.5;

/** Minimum block duration in seconds (snap grid = 30 s) */
export const MIN_DURATION = 30;
export const SNAP_GRID = 30;

/** Default duration for a newly added block */
export const DEFAULT_DURATION = 300; // 5 minutes

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
