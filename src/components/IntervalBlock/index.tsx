import { useCallback, useRef } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Block, ZoneRange } from '../../types';
import {
  ZONE_CONFIG,
  MIN_DURATION,
  SNAP_GRID,
  CANVAS_HEIGHT,
  MIN_BLOCK_HEIGHT,
  TOTAL_ZONES,
  formatDuration,
} from '../../types';
import { smartSnapWatts } from '../../zones';
import styles from './IntervalBlock.module.css';

interface IntervalBlockProps {
  block: Block;
  isSelected: boolean;
  isActive: boolean;
  /** Width as a CSS value, e.g. "12.5%" */
  widthStyle: string;
  /** Height as a 0–1 ratio of the blocks-row container height */
  heightRatio: number;
  /** The effective watts for this block (computed by parent) */
  effectiveWatts: number;
  /** Zone ranges for smart snap */
  zoneRanges: ZoneRange[];
  /** Watts values of neighbouring blocks for smart snap */
  neighborWatts: number[];
  /** Max display watts (scale ceiling) */
  maxDisplayWatts: number;
  onSelect: (id: string, mode: 'single' | 'multi') => void;
  onResize: (id: string, duration: number) => void;
  onWattsChange: (id: string, watts: number) => void;
}

export default function IntervalBlock({
  block,
  isSelected,
  isActive,
  widthStyle,
  heightRatio,
  effectiveWatts,
  zoneRanges,
  neighborWatts,
  maxDisplayWatts,
  onSelect,
  onResize,
  onWattsChange,
}: IntervalBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });

  const resizingWidthRef  = useRef(false);
  const resizingHeightRef = useRef(false);
  const startXRef         = useRef(0);
  const startYRef         = useRef(0);
  const startDurRef       = useRef(0);
  const startWattsRef     = useRef(0);

  const zone = ZONE_CONFIG[block.zone];

  const sortableStyle: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? 'none' : (transition ?? undefined),
    // flexShrink: 1 lets blocks compress proportionally so the last block isn't clipped
    flexShrink: 1,
    flexGrow: 0,
    flexBasis: widthStyle,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 0 : undefined,
    // Blocks grow upward from the bottom of the row
    alignSelf: 'flex-end',
    // Use CSS max() so blocks have both a minimum pixel height and a % of the container
    height: `max(${MIN_BLOCK_HEIGHT}px, ${(heightRatio * 100).toFixed(2)}%)`,
  };

  /* ── Selection ──────────────────────────────────────────────────────────── */
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

  /* ── Width resize (horizontal) ──────────────────────────────────────────── */
  const handleWidthResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      resizingWidthRef.current = true;
      startXRef.current        = e.clientX;
      startDurRef.current      = block.duration;

      const onPointerMove = (ev: PointerEvent) => {
        if (!resizingWidthRef.current) return;
        // Width is proportional; we keep pixel-per-second logic for delta
        const delta       = ev.clientX - startXRef.current;
        // Treat as if 1px = 1/1.5 second (rough heuristic since layout is now proportional)
        const rawDuration = startDurRef.current + (delta / 1.5);
        const snapped     = Math.round(rawDuration / SNAP_GRID) * SNAP_GRID;
        const clamped     = Math.max(MIN_DURATION, snapped);
        onResize(block.id, clamped);
      };

      const onPointerUp = () => {
        resizingWidthRef.current = false;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup',   onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup',   onPointerUp);
    },
    [block.id, block.duration, onResize],
  );

  /* ── Height resize (vertical – smart snap) ──────────────────────────────── */
  const handleHeightResizePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      resizingHeightRef.current = true;
      startYRef.current         = e.clientY;
      startWattsRef.current     = effectiveWatts;

      // Get the actual container height at drag-start time for accurate px-per-watt mapping
      const containerEl = (e.currentTarget.closest('[data-blocks-row]') as HTMLElement | null);
      const containerH  = containerEl?.clientHeight ?? CANVAS_HEIGHT;
      // px per watt for this canvas
      const pxPerWatt = containerH / maxDisplayWatts;

      const onPointerMove = (ev: PointerEvent) => {
        if (!resizingHeightRef.current) return;
        // Dragging UP = increase watts
        const deltaY      = startYRef.current - ev.clientY;
        const deltaWatts  = deltaY / pxPerWatt;
        const rawWatts    = startWattsRef.current + deltaWatts;
        const snapped     = smartSnapWatts(rawWatts, zoneRanges, neighborWatts);
        const minWatts    = zoneRanges[0]?.min ?? 0;
        const clamped     = Math.max(minWatts, Math.min(maxDisplayWatts, snapped));
        onWattsChange(block.id, Math.round(clamped));
      };

      const onPointerUp = () => {
        resizingHeightRef.current = false;
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup',   onPointerUp);
      };

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup',   onPointerUp);
    },
    [block.id, effectiveWatts, zoneRanges, neighborWatts, maxDisplayWatts, onWattsChange],
  );

  /* ── Derived display values ─────────────────────────────────────────────── */
  // Estimate pixel height for content-hiding thresholds (100px min container as fallback)
  const approxHeightPx = Math.max(MIN_BLOCK_HEIGHT, heightRatio * 100);
  const isTiny      = approxHeightPx < 48;
  const isVerySmall = approxHeightPx < 32;

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
          height:      '100%',
        }}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        aria-label={`${zone.label} – ${formatDuration(block.duration)} – ${effectiveWatts}W`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleClick(e as unknown as React.MouseEvent);
        }}
      >
        {/* ── Height resize handle (top, for vertical resize) ── */}
        <div
          className={styles.heightResizeHandle}
          onPointerDown={handleHeightResizePointerDown}
          title={`${effectiveWatts}W – glisser pour ajuster`}
        >
          <span className={styles.heightResizeDots} />
        </div>

        {/* ── Drag handle ── */}
        <div className={styles.dragHandle} {...attributes} {...listeners}>
          {!isTiny && <span className={styles.dragDots}>⠿</span>}
        </div>

        {/* ── Content ── */}
        {!isVerySmall && (
          <div className={styles.content}>
            {!isTiny && (
              <span className={styles.zoneLabel}>{zone.label}</span>
            )}
            <span className={styles.duration}>{formatDuration(block.duration)}</span>
            {!isTiny && (
              <span className={styles.wattsLabel}>{effectiveWatts}W</span>
            )}
          </div>
        )}

        {/* ── Intensity bar (left accent) ── */}
        <div
          className={styles.intensityBar}
          style={{ height: `${(zone.intensity / TOTAL_ZONES) * 100}%`, background: zone.border }}
        />

        {/* ── Width resize handle (right edge) ── */}
        <div
          className={styles.resizeHandle}
          onPointerDown={handleWidthResizePointerDown}
          title="Redimensionner la durée"
        >
          <span className={styles.resizeDots} />
        </div>

        {/* ── Selection ring overlay ── */}
        {isSelected && <div className={styles.selectionRing} />}
      </div>
    </div>
  );
}
