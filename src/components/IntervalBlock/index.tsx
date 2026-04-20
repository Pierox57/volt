import { useCallback, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Block } from '../../types';
import {
  ZONE_CONFIG,
  PX_PER_SECOND,
  MIN_DURATION,
  SNAP_GRID,
  formatDuration,
} from '../../types';
import styles from './IntervalBlock.module.css';

interface IntervalBlockProps {
  block: Block;
  isSelected: boolean;
  isActive: boolean;
  onSelect: (id: string, mode: 'single' | 'multi') => void;
  onResize: (id: string, duration: number) => void;
}

export default function IntervalBlock({
  block,
  isSelected,
  isActive,
  onSelect,
  onResize,
}: IntervalBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });

  const resizingRef = useRef(false);
  const startXRef   = useRef(0);
  const startDurRef = useRef(0);

  const zone  = ZONE_CONFIG[block.zone];
  const width = block.duration * PX_PER_SECOND;

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : (transition ?? undefined),
    width,
    minWidth: MIN_DURATION * PX_PER_SECOND,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 0 : undefined,
  };

  /* ── Selection ─────────────────────────────────────────────────────────── */

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        onSelect(block.id, 'multi');
      } else {
        onSelect(block.id, 'single');
      }
    },
    [block.id, onSelect],
  );

  /* ── Resize ────────────────────────────────────────────────────────────── */

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      resizingRef.current = true;
      startXRef.current   = e.clientX;
      startDurRef.current = block.duration;

      const onPointerMove = (ev: PointerEvent) => {
        if (!resizingRef.current) return;
        const delta       = ev.clientX - startXRef.current;
        const rawDuration = startDurRef.current + delta / PX_PER_SECOND;
        const snapped     = Math.round(rawDuration / SNAP_GRID) * SNAP_GRID;
        const clamped     = Math.max(MIN_DURATION, snapped);
        onResize(block.id, clamped);
      };

      const onPointerUp = () => {
        resizingRef.current = false;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup',   onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup',   onPointerUp);
    },
    [block.id, block.duration, onResize],
  );

  /* ── Derived display values ────────────────────────────────────────────── */

  const isNarrow = width < 100;
  const isTiny   = width < 60;

  const blockClass = [
    styles.block,
    isSelected ? styles.selected : '',
    isActive   ? styles.active   : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={setNodeRef} style={sortableStyle} className={styles.wrapper}>
      <div
        className={blockClass}
        style={{
          background:  zone.bg,
          borderColor: zone.border,
          color:       zone.color,
        }}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        aria-label={`${zone.label} – ${formatDuration(block.duration)}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleClick(e as unknown as React.MouseEvent);
        }}
      >
        {/* Drag handle – top strip */}
        <div className={styles.dragHandle} {...attributes} {...listeners}>
          {!isTiny && <span className={styles.dragDots}>⠿</span>}
        </div>

        {/* Content */}
        {!isTiny && (
          <div className={styles.content}>
            {!isNarrow && (
              <span className={styles.zoneLabel}>{zone.label}</span>
            )}
            <span className={styles.duration}>{formatDuration(block.duration)}</span>
          </div>
        )}

        {/* Intensity bar */}
        <div
          className={styles.intensityBar}
          style={{ height: `${zone.intensity * 20}%`, background: zone.border }}
        />

        {/* Resize handle */}
        <div
          className={styles.resizeHandle}
          onPointerDown={handleResizePointerDown}
          title="Redimensionner"
        >
          <span className={styles.resizeDots} />
        </div>

        {/* Selection ring overlay */}
        {isSelected && <div className={styles.selectionRing} />}
      </div>
    </div>
  );
}
