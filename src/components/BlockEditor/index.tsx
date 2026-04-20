import { useCallback } from 'react';
import type { Block, ZoneType } from '../../types';
import { ZONE_CONFIG, ZONES, formatDuration } from '../../types';
import type { ZoneSystem } from '../../zones';
import { getBlockWatts } from '../../zones';
import styles from './BlockEditor.module.css';

interface BlockEditorProps {
  selectedBlocks: Block[];
  zoneSystem: ZoneSystem;
  onDurationChange: (delta: number) => void;
  onZoneChange: (zone: ZoneType) => void;
  onWattsChange: (watts: number) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}

const DURATION_STEPS = [
  { label: '−1min', delta: -60 },
  { label: '−30s',  delta: -30 },
  { label: '+30s',  delta:  30 },
  { label: '+1min', delta:  60 },
];

const WATTS_STEPS = [
  { label: '−20W', delta: -20 },
  { label: '−5W',  delta:  -5 },
  { label: '+5W',  delta:   5 },
  { label: '+20W', delta:  20 },
];

const ZONE_KEYS: ZoneType[] = ['z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7'];

export default function BlockEditor({
  selectedBlocks,
  zoneSystem,
  onDurationChange,
  onZoneChange,
  onWattsChange,
  onDelete,
  onDuplicate,
  onClose,
}: BlockEditorProps) {
  const count = selectedBlocks.length;

  const uniqueZones = [...new Set(selectedBlocks.map((b) => b.zone))];
  const mixedZones  = uniqueZones.length > 1;
  const currentZone = mixedZones ? null : uniqueZones[0] ?? null;

  const totalDur = selectedBlocks.reduce((s, b) => s + b.duration, 0);
  const avgDur   = count > 0 ? Math.round(totalDur / count) : 0;

  // Compute effective watts for display
  const effectiveWattsValues = selectedBlocks.map((b) => {
    const zoneIdx = ZONE_KEYS.indexOf(b.zone);
    return getBlockWatts(b.watts, zoneIdx >= 0 ? zoneIdx : 0, zoneSystem.zones);
  });
  const allSameWatts = effectiveWattsValues.every((w) => w === effectiveWattsValues[0]);
  const displayWatts = allSameWatts ? effectiveWattsValues[0] : null;
  const avgWatts     = Math.round(effectiveWattsValues.reduce((s, w) => s + w, 0) / count);

  const handleZoneClick = useCallback(
    (zone: ZoneType) => onZoneChange(zone),
    [onZoneChange],
  );

  const handleWattsDelta = useCallback(
    (delta: number) => {
      const base = displayWatts ?? avgWatts;
      onWattsChange(Math.max(0, base + delta));
    },
    [displayWatts, avgWatts, onWattsChange],
  );

  if (count === 0) return null;

  return (
    <div className={styles.panel} role="dialog" aria-label="Éditeur de blocs">
      {/* ── Header ── */}
      <div className={styles.header}>
        <span className={styles.selectionInfo}>
          {count === 1 ? '1 bloc sélectionné' : `${count} blocs sélectionnés`}
        </span>
        <button className={styles.closeBtn} onClick={onClose} title="Fermer (Esc)" aria-label="Fermer">
          ✕
        </button>
      </div>

      <div className={styles.body}>
        {/* ── Duration section ── */}
        <section className={styles.section}>
          <label className={styles.sectionLabel}>Durée</label>
          <div className={styles.durationRow}>
            <span className={styles.durationDisplay}>
              {count === 1
                ? formatDuration(selectedBlocks[0].duration)
                : `~${formatDuration(avgDur)}`}
            </span>
            <div className={styles.stepButtons}>
              {DURATION_STEPS.map(({ label, delta }) => (
                <button
                  key={delta}
                  className={`${styles.stepBtn} ${delta < 0 ? styles.stepBtnNeg : styles.stepBtnPos}`}
                  onClick={() => onDurationChange(delta)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className={styles.divider} />

        {/* ── Watts / Intensity section ── */}
        <section className={styles.section}>
          <label className={styles.sectionLabel}>Puissance</label>
          <div className={styles.durationRow}>
            <span className={styles.wattsDisplay}>
              {displayWatts !== null ? `${displayWatts}W` : `~${avgWatts}W`}
            </span>
            <div className={styles.stepButtons}>
              {WATTS_STEPS.map(({ label, delta }) => (
                <button
                  key={delta}
                  className={`${styles.stepBtn} ${delta < 0 ? styles.stepBtnNeg : styles.stepBtnPos}`}
                  onClick={() => handleWattsDelta(delta)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <div className={styles.divider} />

        {/* ── Zone section ── */}
        <section className={styles.section}>
          <label className={styles.sectionLabel}>Zone</label>
          <div className={styles.zoneChips}>
            {ZONES.map((zone) => {
              const cfg    = ZONE_CONFIG[zone];
              const active = currentZone === zone;
              return (
                <button
                  key={zone}
                  className={`${styles.zoneChip} ${active ? styles.zoneChipActive : ''}`}
                  style={{
                    '--chip-bg':     cfg.bg,
                    '--chip-border': cfg.border,
                    '--chip-color':  cfg.color,
                  } as React.CSSProperties}
                  onClick={() => handleZoneClick(zone)}
                  title={cfg.label}
                  aria-pressed={active}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
          {mixedZones && (
            <p className={styles.mixedHint}>Zones mixtes — choisissez pour uniformiser</p>
          )}
        </section>

        <div className={styles.divider} />

        {/* ── Actions ── */}
        <section className={styles.actions}>
          <button
            className={`${styles.actionBtn} ${styles.actionDuplicate}`}
            onClick={onDuplicate}
            title="Dupliquer (Ctrl+D)"
          >
            <span className={styles.actionIcon}>⎘</span>
            Dupliquer
          </button>
          <button
            className={`${styles.actionBtn} ${styles.actionDelete}`}
            onClick={onDelete}
            title="Supprimer (Suppr)"
          >
            <span className={styles.actionIcon}>🗑</span>
            Supprimer
          </button>
        </section>
      </div>
    </div>
  );
}
