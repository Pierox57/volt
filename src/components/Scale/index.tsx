/**
 * Scale – vertical axis showing watts values and zone colour bands.
 * Positioned to the left of the timeline blocks area.
 * Uses percentage-based positioning so it adapts to any container height.
 */
import type { ZoneRange } from '../../types';
import { ZONE_CONFIG, ZONES } from '../../types';
import styles from './Scale.module.css';

interface ScaleProps {
  zones: ZoneRange[];
  maxDisplayWatts: number;
  mode: 'watts' | 'hr';
}

export default function Scale({ zones, maxDisplayWatts, mode }: ScaleProps) {
  // Collect unique boundary values to display as graduation lines
  const boundaries: number[] = [];
  for (const z of zones) {
    if (!boundaries.includes(z.min)) boundaries.push(z.min);
    if (!boundaries.includes(z.max) && z.max <= maxDisplayWatts * 1.1) boundaries.push(z.max);
  }
  boundaries.sort((a, b) => a - b);

  return (
    <div className={styles.scale}>
      {/* Zone color bands – percentage positioning, fills container height */}
      {ZONES.map((zoneKey, i) => {
        const range = zones[i];
        const cfg = ZONE_CONFIG[zoneKey];
        const bottomPct = Math.min(range.min / maxDisplayWatts, 1) * 100;
        const topPct    = Math.min(range.max / maxDisplayWatts, 1) * 100;
        const heightPct = Math.max(0, topPct - bottomPct);
        return (
          <div
            key={zoneKey}
            className={styles.zoneBand}
            style={{
              bottom: `${bottomPct}%`,
              height: `${heightPct}%`,
              background: cfg.bg,
              opacity: 0.3,
            }}
          />
        );
      })}

      {/* Graduation lines + labels – percentage positioning */}
      {boundaries.map((val) => {
        const bottomPct = Math.min(val / maxDisplayWatts, 1) * 100;
        return (
          <div
            key={val}
            className={styles.graduation}
            style={{ bottom: `${bottomPct}%` }}
          >
            <span className={styles.label}>
              {val}{mode === 'watts' ? 'W' : ''}
            </span>
            <div className={styles.tick} />
          </div>
        );
      })}
    </div>
  );
}
