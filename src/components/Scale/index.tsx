/**
 * Scale – vertical axis showing watts values and zone colour bands.
 * Positioned to the left of the timeline blocks area.
 */
import type { ZoneRange } from '../../types';
import { ZONE_CONFIG, ZONES } from '../../types';
import styles from './Scale.module.css';

interface ScaleProps {
  zones: ZoneRange[];
  maxDisplayWatts: number;
  canvasHeight: number;
  mode: 'watts' | 'hr';
}

export default function Scale({ zones, maxDisplayWatts, canvasHeight, mode }: ScaleProps) {
  // Collect unique boundary values to display as graduation lines
  const boundaries: number[] = [];
  for (const z of zones) {
    if (!boundaries.includes(z.min)) boundaries.push(z.min);
    if (!boundaries.includes(z.max) && z.max <= maxDisplayWatts * 1.1) boundaries.push(z.max);
  }
  boundaries.sort((a, b) => a - b);

  return (
    <div className={styles.scale} style={{ height: canvasHeight }}>
      {/* Zone color bands */}
      {ZONES.map((zoneKey, i) => {
        const range = zones[i];
        const cfg = ZONE_CONFIG[zoneKey];
        const bottomRatio = Math.min(range.min / maxDisplayWatts, 1);
        const topRatio    = Math.min(range.max / maxDisplayWatts, 1);
        const bottom = bottomRatio * canvasHeight;
        const height = Math.max(0, (topRatio - bottomRatio) * canvasHeight);
        return (
          <div
            key={zoneKey}
            className={styles.zoneBand}
            style={{
              bottom,
              height,
              background: cfg.bg,
              opacity: 0.25,
            }}
          />
        );
      })}

      {/* Graduation lines + labels */}
      {boundaries.map((val) => {
        const ratio = Math.min(val / maxDisplayWatts, 1);
        const bottom = ratio * canvasHeight;
        return (
          <div
            key={val}
            className={styles.graduation}
            style={{ bottom }}
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
