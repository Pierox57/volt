import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import type { Block, ZoneType } from '../../types';
import { MIN_DURATION } from '../../types';
import type { ZoneSystem } from '../../zones';
import { getBlockWatts } from '../../zones';
import styles from './BlockToolbar.module.css';

interface BlockToolbarProps {
  selectedBlocks: Block[];
  zoneSystem: ZoneSystem;
  onAbsoluteDurationChange: (duration: number) => void;
  onWattsChange: (watts: number) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}

const ZONE_KEYS: ZoneType[] = ['z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7'];

/** Always formats seconds as zero-padded MM:SS (e.g. 300 → "05:00", 330 → "05:30"). */
function formatMmSs(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/** Parse a duration string in "mm:ss" or plain seconds format. */
function parseDuration(value: string): number | null {
  const trimmed = value.trim();
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

/* ── Inline SVG icons (thin stroke, no external dependency) ── */
function IconCopy() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M3 10.5V4A1.5 1.5 0 0 1 4.5 2.5H11" />
    </svg>
  );
}

function IconTrash() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 4.5h11" />
      <path d="M5.5 4.5V3.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1" />
      <path d="M6.5 7.5v4M9.5 7.5v4" />
      <path d="M4 4.5l.65 7.15A1 1 0 0 0 5.65 12.5h4.7a1 1 0 0 0 1-.85L12 4.5" />
    </svg>
  );
}

function IconPencil() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 2.5a1.5 1.5 0 0 1 2.12 0l.38.38a1.5 1.5 0 0 1 0 2.12L5 13.5H2.5v-2.5L11 2.5Z" />
      <path d="M9.5 4 12 6.5" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="2, 7 5.5, 10.5 12, 3.5" />
    </svg>
  );
}

function IconX() {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <line x1="2" y1="2" x2="10" y2="10" />
      <line x1="10" y1="2" x2="2" y2="10" />
    </svg>
  );
}

export default function BlockToolbar({
  selectedBlocks,
  zoneSystem,
  onAbsoluteDurationChange,
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
    setDurationInput(formatMmSs(displayDur));
    setWattsInput(String(displayWatts));
    setEditMode(true);
    // Defer focus until the input is in the DOM after the state update
    requestAnimationFrame(() => durInputRef.current?.focus());
  }, [displayDur, displayWatts, setDurationInput, setWattsInput, setEditMode]);

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

            {/* Intensity input (watts or bpm depending on mode) */}
            {(() => {
              const isHr = zoneSystem.mode === 'hrmax';
              const unitLabel = isHr ? 'bpm' : 'watts';
              return (
                <div className={styles.editField}>
                  <label className={styles.editLabel}>{unitLabel}</label>
                  <input
                    className={styles.editInput}
                    type="number"
                    min={0}
                    value={wattsInput}
                    onChange={(e) => setWattsInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmEdit();
                    }}
                    placeholder={isHr ? 'bpm' : 'W'}
                    aria-label={isHr ? 'Fréquence cardiaque en bpm' : 'Puissance en watts'}
                  />
                </div>
              );
            })()}

            {/* Confirm / Cancel */}
            <div className={styles.editActions}>
              <button
                className={`${styles.editActionBtn} ${styles.editConfirm}`}
                onClick={confirmEdit}
                title="Confirmer (Entrée)"
                aria-label="Confirmer"
              >
                <IconCheck />
              </button>
              <button
                className={`${styles.editActionBtn} ${styles.editCancel}`}
                onClick={closeEdit}
                title="Annuler (Échap)"
                aria-label="Annuler"
              >
                <IconX />
              </button>
            </div>
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
          className={`${styles.toolBtn} ${styles.toolBtnAccent}`}
          onClick={onDuplicate}
          title={`Dupliquer${count > 1 ? ` (${count} blocs)` : ''} — Ctrl+D`}
          aria-label="Dupliquer"
        >
          <IconCopy />
        </button>

        <div className={styles.sep} />

        <button
          className={`${styles.toolBtn} ${styles.toolBtnDanger}`}
          onClick={onDelete}
          title={`Supprimer${count > 1 ? ` (${count} blocs)` : ''} — Suppr`}
          aria-label="Supprimer"
        >
          <IconTrash />
        </button>

        <div className={styles.sep} />

        <button
          className={`${styles.toolBtn} ${editMode ? styles.toolBtnActive : ''}`}
          onClick={editMode ? closeEdit : openEdit}
          title="Modifier les valeurs"
          aria-label="Modifier les valeurs"
          aria-expanded={editMode}
        >
          <IconPencil />
        </button>
      </div>
    </div>
  );
}
