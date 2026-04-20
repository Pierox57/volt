/**
 * Zone calculation logic and smart snap utilities.
 *
 * Supports 4 calculation modes:
 *   - ftp    : Coggan 7-zone power model based on FTP
 *   - pma    : Power-based, derived from PMA (VO2max power)
 *   - hrmax  : Heart-rate-based zones as % of HRmax
 *   - manual : User-defined zone boundaries
 */

import type { ZoneRange } from './types';

export type CalcMode = 'ftp' | 'pma' | 'hrmax' | 'manual';

export interface ZoneSystem {
  mode: CalcMode;
  ftp: number;     // watts (default 250)
  pma: number;     // watts, VO2max power (FTP ≈ 0.75 × PMA)
  hrmax: number;   // bpm
  /** 7 zone boundary ranges, index 0=Z1 … 6=Z7 */
  zones: ZoneRange[];
}

// ── Coggan 7-zone model – power as % of FTP ───────────────────────────────────
const FTP_ZONE_PCTS: Array<[number, number]> = [
  [0,    55],  // Z1 Active Recovery
  [55,   75],  // Z2 Endurance
  [75,   90],  // Z3 Tempo
  [90,  105],  // Z4 Threshold
  [105, 120],  // Z5 VO2max
  [120, 150],  // Z6 Anaerobic Capacity
  [150, 300],  // Z7 Neuromuscular
];

export function computeZonesFromFTP(ftp: number): ZoneRange[] {
  return FTP_ZONE_PCTS.map(([minPct, maxPct]) => ({
    min: Math.round(ftp * minPct / 100),
    max: Math.round(ftp * maxPct / 100),
  }));
}

// FTP ≈ 75 % of PMA
export function computeZonesFromPMA(pma: number): ZoneRange[] {
  return computeZonesFromFTP(Math.round(pma * 0.75));
}

// HR zones as % of HRmax
const HR_ZONE_PCTS: Array<[number, number]> = [
  [0,   60],  // Z1
  [60,  70],  // Z2
  [70,  80],  // Z3
  [80,  87],  // Z4
  [87,  93],  // Z5
  [93, 100],  // Z6
  [100, 110], // Z7 (sprint)
];

export function computeZonesFromHRmax(hrmax: number): ZoneRange[] {
  return HR_ZONE_PCTS.map(([minPct, maxPct]) => ({
    min: Math.round(hrmax * minPct / 100),
    max: Math.round(hrmax * maxPct / 100),
  }));
}

// ── Default system ─────────────────────────────────────────────────────────────

export function createDefaultZoneSystem(): ZoneSystem {
  const ftp = 250;
  return {
    mode: 'ftp',
    ftp,
    pma: Math.round(ftp / 0.75),
    hrmax: 185,
    zones: computeZonesFromFTP(ftp),
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Get the zone index (0-6) for a given watts value */
export function getZoneIndexForWatts(watts: number, zones: ZoneRange[]): number {
  for (let i = zones.length - 1; i >= 0; i--) {
    if (watts >= zones[i].min) return i;
  }
  return 0;
}

/** Get the midpoint watts of a zone */
export function zoneMidpoint(range: ZoneRange): number {
  // For Z7, use slightly above min to avoid huge values
  const max = Math.min(range.max, range.min * 1.3);
  return Math.round((range.min + max) / 2);
}

/**
 * Get effective watts for a block.
 * If block.watts is set, use it. Otherwise use the zone midpoint.
 */
export function getBlockWatts(
  watts: number | undefined,
  zoneIndex: number,
  zones: ZoneRange[],
): number {
  if (watts !== undefined) return watts;
  return zoneMidpoint(zones[zoneIndex]);
}

/**
 * The maximum watts value to display on the scale.
 * Uses the top of Z6 so that Z7 (sprint) is shown but doesn't dominate.
 */
export function getMaxDisplayWatts(zones: ZoneRange[]): number {
  // top of Z6 = zones[5].max
  return zones[5].max;
}

/**
 * Convert watts to a height ratio (0–1) for block rendering.
 * Clamped so the block always has a minimum visible height.
 */
export function wattsToHeightRatio(watts: number, maxDisplayWatts: number): number {
  return Math.min(1.0, Math.max(0, watts / maxDisplayWatts));
}

/**
 * Smart snap: snap a raw watts value to nearby zone boundaries
 * or neighbour block values, within a given threshold.
 *
 * @param rawWatts     - the unsnapped watts value
 * @param zones        - the 7 zone ranges
 * @param neighborVals - watts values of adjacent blocks
 * @param threshold    - snap distance in watts
 */
export function smartSnapWatts(
  rawWatts: number,
  zones: ZoneRange[],
  neighborVals: number[],
  threshold = 10,
): number {
  const candidates: number[] = [];

  // All zone boundaries
  for (const z of zones) {
    candidates.push(z.min, z.max);
  }

  // Neighbour block values
  for (const v of neighborVals) {
    candidates.push(v);
  }

  let snapped = rawWatts;
  let minDist = threshold;

  for (const c of candidates) {
    const dist = Math.abs(rawWatts - c);
    if (dist < minDist) {
      minDist = dist;
      snapped = c;
    }
  }

  return snapped;
}

/** Recompute zones based on the current mode */
export function recomputeZones(sys: ZoneSystem): ZoneRange[] {
  switch (sys.mode) {
    case 'ftp':    return computeZonesFromFTP(sys.ftp);
    case 'pma':    return computeZonesFromPMA(sys.pma);
    case 'hrmax':  return computeZonesFromHRmax(sys.hrmax);
    case 'manual': return sys.zones; // unchanged
    default:       return computeZonesFromFTP(sys.ftp);
  }
}
