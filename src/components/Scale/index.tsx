/**
 * Scale – Y-axis showing zone color bands, labels (Z1–Z7 + range values),
 * and tick marks at each zone boundary.
 *
 * All positioning is percentage-based so it adapts to any container height.
 * Transitions on band positions provide a smooth animation when switching
 * between watts and bpm mode.
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
  const unit = mode === 'hr' ? 'bpm' : 'w';

  return (
    <div className={styles.scale}>
      {ZONES.map((zoneKey, i) => {
        const range      = zones[i];
        const cfg        = ZONE_CONFIG[zoneKey];
        const bottomPct  = (Math.min(range.min, maxDisplayWatts) / maxDisplayWatts) * 100;
        const topPct     = Math.min((range.max / maxDisplayWatts) * 100, 100);
        const heightPct  = Math.max(0, topPct - bottomPct);
        const isLast     = i === ZONES.length - 1;
        const rangeLabel = isLast
          ? `${range.min}${unit}+`
          : `${range.min}–${range.max}${unit}`;

        return (
          <div
            key={zoneKey}
            className={styles.zoneBand}
            style={{ bottom: `${bottomPct}%`, height: `${heightPct}%` }}
          >
            {/* Boundary line at the bottom of this band */}
            <div className={styles.boundaryLine} />

            {/* Labels: zone number + range value */}
            <div className={styles.labels}>
              <span className={styles.zoneName} style={{ color: cfg.border }}>
                Z{i + 1}
              </span>
              <span className={styles.zoneRange}>{rangeLabel}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
