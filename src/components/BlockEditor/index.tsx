import { useCallback } from 'react';
import type { Block, ZoneType } from '../../types';
import { ZONE_CONFIG, ZONES, formatDuration } from '../../types';
import styles from './BlockEditor.module.css';

interface BlockEditorProps {
  selectedBlocks: Block[];
  onDurationChange: (delta: number) => void;
  onZoneChange: (zone: ZoneType) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}

const DURATION_STEPS = [
  { label: '−1min', delta: -60 },
  { label: '−30s', delta: -30 },
  { label: '+30s', delta: 30 },
  { label: '+1min', delta: 60 },
];

export default function BlockEditor({
  selectedBlocks,
  onDurationChange,
  onZoneChange,
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

  const handleZoneClick = useCallback(
    (zone: ZoneType) => onZoneChange(zone),
    [onZoneChange],
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
            <div className={styles.durationButtons}>
              {DURATION_STEPS.map(({ label, delta }) => (
                <button
                  key={delta}
                  className={`${styles.stepBtn} ${delta < 0 ? styles.stepBtnNeg : styles.stepBtnPos}`}
                  onClick={() => onDurationChange(delta)}
                  title={`${delta > 0 ? '+' : ''}${delta}s`}
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
          <label className={styles.sectionLabel}>Intensité</label>
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
