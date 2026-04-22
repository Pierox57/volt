import { useCallback, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import type { Block } from '../../types';
import { ZONE_CONFIG, CANVAS_HEIGHT, MIN_BLOCK_HEIGHT, formatDuration } from '../../types';
import type { ZoneSystem } from '../../zones';
import { getBlockWatts, wattsToHeightRatio, getMaxDisplayWatts } from '../../zones';
import IntervalBlock from '../IntervalBlock';
import Scale         from '../Scale';
import styles from './Timeline.module.css';

interface TimelineProps {
  blocks: Block[];
  selectedIds: Set<string>;
  activeId: string | null;
  zoneSystem: ZoneSystem;
  onBlocksChange: (blocks: Block[]) => void;
  onSelect: (id: string, mode: 'single' | 'multi') => void;
  onAddBlock: () => void;
  onResizeBlock: (id: string, duration: number) => void;
  onWattsChange: (id: string, watts: number) => void;
  onDragStart: (id: string) => void;
  onDragEnd: (event: DragEndEvent) => void;
}

/**
 * Format a time value (seconds) as mm:ss for short workouts, hh:mm for long.
 * The format chosen is based on the total workout duration.
 */
function fmtTime(s: number, totalSeconds: number): string {
  if (totalSeconds >= 3600) {
    // Long workout → hh:mm
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}:${m.toString().padStart(2, '0')}`;
  }
  // Short workout → mm:ss
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/**
 * Choose the most readable tick interval for the X axis based on total duration.
 * Returns interval in seconds.
 */
function markerInterval(totalSeconds: number): number {
  if (totalSeconds < 1200)  return 60;   // < 20 min → every 1 min
  if (totalSeconds < 3600)  return 300;  // 20–60 min → every 5 min
  if (totalSeconds < 5400)  return 600;  // 60–90 min → every 10 min
  return 900;                            // > 90 min → every 15 min
}

const ZONE_KEYS = ['z1','z2','z3','z4','z5','z6','z7'] as const;

export default function Timeline({
  blocks,
  selectedIds,
  activeId,
  zoneSystem,
  onBlocksChange,
  onSelect,
  onAddBlock,
  onResizeBlock,
  onWattsChange,
  onDragStart,
  onDragEnd,
}: TimelineProps) {
  const wrapperRef   = useRef<HTMLDivElement>(null);
  const blocksRowRef = useRef<HTMLDivElement>(null);
  const [activeDimensions, setActiveDimensions] = useState<{ width: number; height: number } | null>(null);

  const totalDuration   = blocks.reduce((s, b) => s + b.duration, 0);
  const interval        = markerInterval(totalDuration);
  const maxDisplayWatts = getMaxDisplayWatts(zoneSystem.zones);

  /**
   * The full visible duration range = workout duration + one extra interval.
   * This guarantees breathing room after the last block so the end is always
   * clearly visible with at least one graduation mark beyond it.
   */
  const visibleDuration = Math.max(totalDuration + interval, interval);

  // Time ruler markers: 0 … totalDuration + interval (one extra mark)
  const markers: number[] = [];
  for (let t = 0; t <= totalDuration + interval; t += interval) {
    markers.push(t);
  }

  // Compute effective watts and height ratio (0–1) for each block
  const blockData = blocks.map((block, idx) => {
    const zoneIdx     = ZONE_KEYS.indexOf(block.zone as typeof ZONE_KEYS[number]);
    const watts       = getBlockWatts(block.watts, zoneIdx >= 0 ? zoneIdx : 0, zoneSystem.zones);
    const heightRatio = wattsToHeightRatio(watts, maxDisplayWatts);

    // Neighbor watts for smart snap
    const prevWatts = idx > 0
      ? getBlockWatts(
          blocks[idx - 1].watts,
          ZONE_KEYS.indexOf(blocks[idx - 1].zone as typeof ZONE_KEYS[number]),
          zoneSystem.zones,
        )
      : null;
    const nextWatts = idx < blocks.length - 1
      ? getBlockWatts(
          blocks[idx + 1].watts,
          ZONE_KEYS.indexOf(blocks[idx + 1].zone as typeof ZONE_KEYS[number]),
          zoneSystem.zones,
        )
      : null;
    const neighborWatts = [prevWatts, nextWatts].filter((v): v is number => v !== null);

    return { watts, heightRatio, neighborWatts };
  });

  /* ── Click on empty area → add block ──────────────────────────────────── */
  const handleTimelineClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (
        target === wrapperRef.current ||
        target.dataset.timelineBg === 'true'
      ) {
        onAddBlock();
      }
    },
    [onAddBlock],
  );

  /* ── dnd-kit sensors ──────────────────────────────────────────────────── */
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const activeBlock     = blocks.find((b) => b.id === activeId);
  const activeBlockData = activeBlock
    ? blockData[blocks.indexOf(activeBlock)]
    : null;

  /* ── Internal drag start (capture exact dimensions) ─────────────────── */
  const handleDragStart = useCallback(
    (e: DragStartEvent) => {
      const id = String(e.active.id);
      const el = document.querySelector(`[data-block-id="${CSS.escape(id)}"]`);
      const rect = el?.getBoundingClientRect();
      setActiveDimensions(
        rect ? { width: rect.width, height: rect.height } : null,
      );
      onDragStart(id);
    },
    [onDragStart],
  );


  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDimensions(null);
      const { active, over } = event;
      if (over && active.id !== over.id) {
        const oldIndex = blocks.findIndex((b) => b.id === active.id);
        const newIndex = blocks.findIndex((b) => b.id === over.id);
        onBlocksChange(arrayMove(blocks, oldIndex, newIndex));
      }
      onDragEnd(event);
    },
    [blocks, onBlocksChange, onDragEnd],
  );

  return (
    <div className={styles.outer}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* ── Content row: Scale + Blocks (fills remaining height) ── */}
        <div className={styles.contentRow}>
          {/* Vertical watts/hr scale – aligns directly with the blocks row */}
          <Scale
            zones={zoneSystem.zones}
            maxDisplayWatts={maxDisplayWatts}
            mode={zoneSystem.mode === 'hrmax' ? 'hr' : 'watts'}
          />

          {/* Blocks area */}
          <div
            ref={wrapperRef}
            className={styles.blocksArea}
            onClick={handleTimelineClick}
            data-timeline-bg="true"
          >
            <SortableContext
              items={blocks.map((b) => b.id)}
              strategy={horizontalListSortingStrategy}
            >
              <div
                ref={blocksRowRef}
                className={styles.blocksRow}
                data-blocks-row="true"
              >
                {/* Zone bands – very-low-opacity colored fills per zone */}
                <div className={styles.zoneBands} data-timeline-bg="true">
                  {ZONE_KEYS.map((zoneKey, i) => {
                    const range      = zoneSystem.zones[i];
                    const cfg        = ZONE_CONFIG[zoneKey];
                    const bottomPct  = (Math.min(range.min, maxDisplayWatts) / maxDisplayWatts) * 100;
                    const topPct     = Math.min((range.max / maxDisplayWatts) * 100, 100);
                    const heightPct  = Math.max(0, topPct - bottomPct);
                    return (
                      <div
                        key={zoneKey}
                        className={styles.zoneBand}
                        data-timeline-bg="true"
                        style={{
                          bottom: `${bottomPct}%`,
                          height: `${heightPct}%`,
                          background: cfg.bg,
                        }}
                      />
                    );
                  })}
                </div>

                {/* Zone boundary lines – dashed horizontal rules */}
                <div className={styles.zoneLines} data-timeline-bg="true">
                  {zoneSystem.zones.map((range, i) => {
                    const bottomPct = (Math.min(range.min, maxDisplayWatts) / maxDisplayWatts) * 100;
                    if (bottomPct < 1 || bottomPct >= 100) return null;
                    return (
                      <div
                        key={i}
                        className={styles.zoneLine}
                        data-timeline-bg="true"
                        style={{ bottom: `${bottomPct}%` }}
                      />
                    );
                  })}
                </div>

                {/* Blocks */}
                {blocks.map((block, idx) => {
                  const { watts, heightRatio, neighborWatts } = blockData[idx];
                  const widthPct = `${(block.duration / visibleDuration) * 100}%`;
                  return (
                    <IntervalBlock
                      key={block.id}
                      block={block}
                      isSelected={selectedIds.has(block.id)}
                      isActive={activeId === block.id}
                      widthStyle={widthPct}
                      heightRatio={heightRatio}
                      effectiveWatts={watts}
                      zoneRanges={zoneSystem.zones}
                      neighborWatts={neighborWatts}
                      maxDisplayWatts={maxDisplayWatts}
                      onSelect={onSelect}
                      onResize={onResizeBlock}
                      onWattsChange={onWattsChange}
                    />
                  );
                })}

                {/* Add-block affordance */}
                <button
                  className={styles.addZone}
                  onClick={(e) => { e.stopPropagation(); onAddBlock(); }}
                  title="Ajouter un bloc"
                  aria-label="Ajouter un bloc"
                >
                  <span className={styles.addIcon}>+</span>
                </button>
              </div>
            </SortableContext>

            {/* Empty state */}
            {blocks.length === 0 && (
              <div className={styles.emptyState} data-timeline-bg="true">
                <div className={styles.emptyIcon} data-timeline-bg="true">⚡</div>
                <p className={styles.emptyTitle} data-timeline-bg="true">
                  Cliquez pour ajouter votre premier bloc
                </p>
                <p className={styles.emptyHint} data-timeline-bg="true">
                  Ou utilisez le bouton <strong>+</strong> en haut
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── X-axis ruler (sits below the blocks canvas, full width) ── */}
        <div className={styles.rulerRow}>
          {/* Blank cell that aligns with the scale column */}
          <div className={styles.scaleGap} />
          {totalDuration > 0 && (
            <div className={styles.ruler} data-timeline-bg="true">
              {markers.map((t, markerIdx) => {
                const leftPct = (t / visibleDuration) * 100;
                // First marker: left-align; last: right-align; others: center
                let transform = 'translateX(-50%)';
                if (markerIdx === 0)                    transform = 'translateX(0)';
                if (markerIdx === markers.length - 1)   transform = 'translateX(-100%)';
                return (
                  <div
                    key={t}
                    className={styles.marker}
                    style={{ left: `${leftPct}%`, transform }}
                    data-timeline-bg="true"
                  >
                    <div className={styles.markerLine} />
                    <span className={styles.markerLabel}>
                      {fmtTime(t, totalDuration)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Drag overlay ── */}
        <DragOverlay>
          {activeBlock != null && activeBlockData != null && (
            <div
              className={styles.dragOverlay}
              style={{
                boxSizing:   'border-box',
                width:       activeDimensions?.width  ?? 200,
                height:      activeDimensions?.height ?? Math.max(MIN_BLOCK_HEIGHT, activeBlockData.heightRatio * CANVAS_HEIGHT),
                background:  ZONE_CONFIG[activeBlock.zone].bg,
                borderColor: ZONE_CONFIG[activeBlock.zone].border,
                color:       ZONE_CONFIG[activeBlock.zone].color,
              }}
            >
              <span className={styles.dragOverlayLabel}>
                {ZONE_CONFIG[activeBlock.zone].label}
              </span>
              <span className={styles.dragOverlayDur}>
                {formatDuration(activeBlock.duration)}
              </span>
              <span className={styles.dragOverlayWatts}>
                {activeBlockData.watts}W
              </span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* ── Total duration strip ── */}
      {totalDuration > 0 && (
        <div className={styles.durationStrip}>
          <span className={styles.durationTotal}>
            Total : <strong>{formatDuration(totalDuration)}</strong>
          </span>
          <span className={styles.blockCount}>
            {blocks.length} bloc{blocks.length > 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
