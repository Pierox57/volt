import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import type { Block, ZoneType } from '../../types';
import { ZONE_CONFIG, ZONES, MIN_DURATION, formatDuration } from '../../types';
import type { ZoneSystem } from '../../zones';
import { getBlockWatts } from '../../zones';
import styles from './BlockToolbar.module.css';

interface BlockToolbarProps {
  selectedBlocks: Block[];
  zoneSystem: ZoneSystem;
  onAbsoluteDurationChange: (duration: number) => void;
  onZoneChange: (zone: ZoneType) => void;
  onWattsChange: (watts: number) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}

const ZONE_KEYS: ZoneType[] = ['z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7'];

/** Parse a duration string in "mm:ss", "Nmin", or plain seconds format. */
function parseDuration(value: string): number | null {
  const trimmed = value.trim();
  // "Nmin" format (e.g. "5min")
  const minMatch = trimmed.match(/^(\d+)\s*min$/i);
  if (minMatch) return parseInt(minMatch[1], 10) * 60;
  // "mm:ss" format
  const mmss = trimmed.match(/^(\d+):(\d{1,2})$/);
  if (mmss) {
    const m = parseInt(mmss[1], 10);
    const s = parseInt(mmss[2], 10);
    if (s >= 60) return null;
    return m * 60 + s;
  }
  // plain number (seconds)
  const n = parseInt(trimmed, 10);
  if (!isNaN(n) && n > 0) return n;
  return null;
}

export default function BlockToolbar({
  selectedBlocks,
  zoneSystem,
  onAbsoluteDurationChange,
  onZoneChange,
  onWattsChange,
  onDelete,
  onDuplicate,
  onClose,
}: BlockToolbarProps) {
  const count = selectedBlocks.length;

  // ── Derived display values ──────────────────────────────────────────────
  const totalDur = selectedBlocks.reduce((s, b) => s + b.duration, 0);
  const avgDur   = count > 0 ? Math.round(totalDur / count) : 0;
  const displayDur = count === 1 ? (selectedBlocks[0]?.duration ?? avgDur) : avgDur;

  const effectiveWatts = selectedBlocks.map((b) => {
    const zoneIdx = ZONE_KEYS.indexOf(b.zone);
    return getBlockWatts(b.watts, zoneIdx >= 0 ? zoneIdx : 0, zoneSystem.zones);
  });
  const avgWatts = count > 0
    ? Math.round(effectiveWatts.reduce((s, w) => s + w, 0) / count)
    : 0;
  const allSameWatts = effectiveWatts.every((w) => w === effectiveWatts[0]);
  const displayWatts = allSameWatts ? (effectiveWatts[0] ?? avgWatts) : avgWatts;

  const uniqueZones = [...new Set(selectedBlocks.map((b) => b.zone))];
  const currentZone: ZoneType | null = uniqueZones.length === 1 ? (uniqueZones[0] ?? null) : null;

  // ── Toolbar position (fixed) ────────────────────────────────────────────
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

  useLayoutEffect(() => {
    const update = () => {
      const rects = selectedBlocks
        .map((b) =>
          document
            .querySelector<HTMLElement>(`[data-block-id="${b.id}"]`)
            ?.getBoundingClientRect(),
        )
        .filter((r): r is DOMRect => r != null);

      if (rects.length === 0) {
        setPos(null);
        return;
      }

      const left = Math.min(...rects.map((r) => r.left));
      const right = Math.max(...rects.map((r) => r.right));
      const top = Math.min(...rects.map((r) => r.top));
      setPos({ x: (left + right) / 2, y: top });
    };

    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [selectedBlocks]);

  // ── Edit mode ───────────────────────────────────────────────────────────
  const [editMode, setEditMode] = useState(false);
  const [durationInput, setDurationInput] = useState('');
  const [wattsInput, setWattsInput] = useState('');

  const durInputRef   = useRef<HTMLInputElement>(null);
  const toolbarRef    = useRef<HTMLDivElement>(null);

  const openEdit = useCallback(() => {
    setDurationInput(formatDuration(displayDur));
    setWattsInput(String(displayWatts));
    setEditMode(true);
    // Defer focus until the input is in the DOM after the state update
    requestAnimationFrame(() => durInputRef.current?.focus());
  }, [displayDur, displayWatts]);

  const closeEdit = useCallback(() => setEditMode(false), []);

  const confirmEdit = useCallback(() => {
    // Apply duration
    const parsed = parseDuration(durationInput);
    if (parsed !== null) {
      onAbsoluteDurationChange(Math.max(MIN_DURATION, parsed));
    }
    // Apply watts
    const w = parseInt(wattsInput, 10);
    if (!isNaN(w) && w > 0) {
      onWattsChange(w);
    }
    setEditMode(false);
  }, [durationInput, wattsInput, onAbsoluteDurationChange, onWattsChange]);

  // ── Click-outside to deselect ───────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Element;
      if (toolbarRef.current?.contains(target)) return;
      // Clicking on a block updates selection — don't also deselect
      if (target.closest('[data-block-id]')) return;
      onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // ── Escape in edit mode closes edit (not the whole toolbar) ────────────
  // Note: useKeyboard already ignores events with input/textarea/select targets,
  // so we only need our own handler to close the edit panel — no stopPropagation needed.
  useEffect(() => {
    if (!editMode) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeEdit();
      }
    };
    // Capture phase fires before the target's handlers; the global useKeyboard
    // handler will naturally skip the event because its target is an input.
    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, [editMode, closeEdit]);

  if (count === 0 || pos === null) return null;

  const GAP = 8; // px gap between block top and toolbar bottom

  return (
    <div
      ref={toolbarRef}
      className={styles.root}
      style={{
        left: pos.x,
        top:  pos.y,
        transform: `translate(-50%, calc(-100% - ${GAP}px))`,
      }}
      role="toolbar"
      aria-label={count === 1 ? '1 bloc sélectionné' : `${count} blocs sélectionnés`}
    >
      {/* ── Edit panel (appears above toolbar) ── */}
      {editMode && (
        <div className={styles.editPanel} role="group" aria-label="Modifier les valeurs">
          <div className={styles.editRow}>
            {/* Duration input */}
            <div className={styles.editField}>
              <label className={styles.editLabel}>Durée</label>
              <input
                ref={durInputRef}
                className={styles.editInput}
                value={durationInput}
                onChange={(e) => setDurationInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmEdit();
                  // Escape handled by the capture-phase effect above
                }}
                placeholder="mm:ss"
                aria-label="Durée"
              />
            </div>

            {/* Watts input */}
            <div className={styles.editField}>
              <label className={styles.editLabel}>Watts</label>
              <input
                className={styles.editInput}
                type="number"
                min={0}
                value={wattsInput}
                onChange={(e) => setWattsInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmEdit();
                }}
                placeholder="W"
                aria-label="Puissance en watts"
              />
            </div>

            {/* Confirm / Cancel */}
            <div className={styles.editActions}>
              <button
                className={`${styles.editActionBtn} ${styles.editConfirm}`}
                onClick={confirmEdit}
                title="Confirmer (Entrée)"
                aria-label="Confirmer"
              >
                ✓
              </button>
              <button
                className={`${styles.editActionBtn} ${styles.editCancel}`}
                onClick={closeEdit}
                title="Annuler (Échap)"
                aria-label="Annuler"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Zone chips */}
          <div className={styles.zoneRow} role="group" aria-label="Zone">
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
                  onClick={() => onZoneChange(zone)}
                  title={cfg.label}
                  aria-pressed={active}
                >
                  {zone.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Main action toolbar ── */}
      <div className={styles.toolbar}>
        {count > 1 && (
          <span className={styles.countBadge} aria-label={`${count} blocs`}>
            {count}
          </span>
        )}

        <button
          className={styles.toolBtn}
          onClick={onDuplicate}
          title={`Dupliquer${count > 1 ? ` (${count} blocs)` : ''} — Ctrl+D`}
          aria-label="Dupliquer"
        >
          ⎘
        </button>

        <div className={styles.sep} />

        <button
          className={`${styles.toolBtn} ${styles.toolBtnDanger}`}
          onClick={onDelete}
          title={`Supprimer${count > 1 ? ` (${count} blocs)` : ''} — Suppr`}
          aria-label="Supprimer"
        >
          🗑
        </button>

        <div className={styles.sep} />

        <button
          className={`${styles.toolBtn} ${editMode ? styles.toolBtnActive : ''}`}
          onClick={editMode ? closeEdit : openEdit}
          title="Modifier les valeurs"
          aria-label="Modifier les valeurs"
          aria-expanded={editMode}
        >
          ✏
        </button>
      </div>
    </div>
  );
}
