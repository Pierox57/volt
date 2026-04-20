/**
 * ZoneSettings – compact panel to configure the zone calculation mode and key values.
 */
import { useCallback, useState } from 'react';
import type { ZoneSystem } from '../../zones';
import { recomputeZones } from '../../zones';
import type { CalcMode } from '../../zones';
import styles from './ZoneSettings.module.css';

interface ZoneSettingsProps {
  zoneSystem: ZoneSystem;
  onZoneSystemChange: (sys: ZoneSystem) => void;
}

const MODE_LABELS: Record<CalcMode, string> = {
  ftp:    'FTP',
  pma:    'PMA',
  hrmax:  'FC max',
  manual: 'Manuel',
};

export default function ZoneSettings({ zoneSystem, onZoneSystemChange }: ZoneSettingsProps) {
  const [open, setOpen] = useState(false);

  const handleModeChange = useCallback((mode: CalcMode) => {
    const next: ZoneSystem = { ...zoneSystem, mode };
    onZoneSystemChange({ ...next, zones: recomputeZones(next) });
  }, [zoneSystem, onZoneSystemChange]);

  const handleValueChange = useCallback((field: 'ftp' | 'pma' | 'hrmax', value: number) => {
    const next: ZoneSystem = { ...zoneSystem, [field]: value };
    onZoneSystemChange({ ...next, zones: recomputeZones(next) });
  }, [zoneSystem, onZoneSystemChange]);

  return (
    <div className={styles.container}>
      <button
        className={styles.toggleBtn}
        onClick={() => setOpen((v) => !v)}
        title="Configurer les zones"
      >
        <span className={styles.toggleIcon}>⚙</span>
        <span className={styles.toggleLabel}>Zones</span>
        <span className={styles.modeBadge}>{MODE_LABELS[zoneSystem.mode]}</span>
        <span className={styles.arrow}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={styles.panel}>
          {/* Mode selector */}
          <div className={styles.row}>
            <span className={styles.fieldLabel}>Mode</span>
            <div className={styles.modeChips}>
              {(['ftp', 'pma', 'hrmax', 'manual'] as CalcMode[]).map((m) => (
                <button
                  key={m}
                  className={`${styles.modeChip} ${zoneSystem.mode === m ? styles.modeChipActive : ''}`}
                  onClick={() => handleModeChange(m)}
                >
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>
          </div>

          {/* FTP input */}
          {(zoneSystem.mode === 'ftp' || zoneSystem.mode === 'manual') && (
            <div className={styles.row}>
              <label className={styles.fieldLabel} htmlFor="ftp-input">FTP (W)</label>
              <input
                id="ftp-input"
                type="number"
                className={styles.numberInput}
                value={zoneSystem.ftp}
                min={50}
                max={600}
                step={5}
                onChange={(e) => handleValueChange('ftp', Number(e.target.value))}
              />
            </div>
          )}

          {/* PMA input */}
          {zoneSystem.mode === 'pma' && (
            <div className={styles.row}>
              <label className={styles.fieldLabel} htmlFor="pma-input">PMA (W)</label>
              <input
                id="pma-input"
                type="number"
                className={styles.numberInput}
                value={zoneSystem.pma}
                min={50}
                max={800}
                step={5}
                onChange={(e) => handleValueChange('pma', Number(e.target.value))}
              />
            </div>
          )}

          {/* HRmax input */}
          {zoneSystem.mode === 'hrmax' && (
            <div className={styles.row}>
              <label className={styles.fieldLabel} htmlFor="hrmax-input">FC max (bpm)</label>
              <input
                id="hrmax-input"
                type="number"
                className={styles.numberInput}
                value={zoneSystem.hrmax}
                min={100}
                max={220}
                step={1}
                onChange={(e) => handleValueChange('hrmax', Number(e.target.value))}
              />
            </div>
          )}

          {/* Zone summary */}
          <div className={styles.zoneSummary}>
            {zoneSystem.zones.map((z, i) => (
              <div key={i} className={styles.zoneRow}>
                <span className={styles.zoneKey}>Z{i + 1}</span>
                <span className={styles.zoneRange}>{z.min}–{z.max}</span>
                <span className={styles.zoneUnit}>
                  {zoneSystem.mode === 'hrmax' ? 'bpm' : 'W'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
