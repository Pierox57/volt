import { useCallback, useRef } from 'react';
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

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  if (s % 60 === 0) return `${m}min`;
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

function markerInterval(totalSeconds: number): number {
  if (totalSeconds <= 600)  return 60;
  if (totalSeconds <= 3600) return 300;
  return 600;
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
  const wrapperRef = useRef<HTMLDivElement>(null);

  const totalDuration     = blocks.reduce((s, b) => s + b.duration, 0);
  const interval          = markerInterval(totalDuration);
  const maxDisplayWatts   = getMaxDisplayWatts(zoneSystem.zones);

  // Time ruler markers
  const markers: number[] = [];
  for (let t = 0; t <= totalDuration + interval; t += interval) {
    markers.push(t);
  }

  // Compute effective watts and height for each block
  const blockData = blocks.map((block, idx) => {
    const zoneIdx  = ZONE_KEYS.indexOf(block.zone as typeof ZONE_KEYS[number]);
    const watts    = getBlockWatts(block.watts, zoneIdx >= 0 ? zoneIdx : 0, zoneSystem.zones);
    const ratio    = wattsToHeightRatio(watts, maxDisplayWatts);
    const heightPx = Math.max(MIN_BLOCK_HEIGHT, ratio * CANVAS_HEIGHT);

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

    return { watts, heightPx, neighborWatts };
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

  /* ── Internal drag end (reorder + notify parent) ─────────────────────── */
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
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
        onDragStart={(e: DragStartEvent) => onDragStart(String(e.active.id))}
        onDragEnd={handleDragEnd}
      >
        <div className={styles.layoutRow}>
          {/* ── Vertical scale ── */}
          <Scale
            zones={zoneSystem.zones}
            maxDisplayWatts={maxDisplayWatts}
            canvasHeight={CANVAS_HEIGHT}
            mode={zoneSystem.mode === 'hrmax' ? 'hr' : 'watts'}
          />

          {/* ── Main timeline area ── */}
          <div
            ref={wrapperRef}
            className={styles.canvas}
            onClick={handleTimelineClick}
            data-timeline-bg="true"
          >
            {/* ── Zone background stripes ── */}
            <div className={styles.zoneStripes} data-timeline-bg="true">
              {zoneSystem.zones.map((range, i) => {
                const zoneKey = ZONE_KEYS[i];
                const cfg     = ZONE_CONFIG[zoneKey];
                const bottomPct = (range.min / maxDisplayWatts) * 100;
                const heightPct = ((range.max - range.min) / maxDisplayWatts) * 100;
                return (
                  <div
                    key={i}
                    className={styles.zoneStripe}
                    data-timeline-bg="true"
                    style={{
                      bottom: `${Math.min(bottomPct, 100)}%`,
                      height: `${Math.min(heightPct, 100 - Math.min(bottomPct, 100))}%`,
                      background: cfg.bg,
                      opacity: 0.06,
                    }}
                  />
                );
              })}
            </div>

            {/* ── Ruler ── */}
            {totalDuration > 0 && (
              <div className={styles.ruler} data-timeline-bg="true">
                {markers.map((t) => (
                  <div
                    key={t}
                    className={styles.marker}
                    style={{ left: `${(t / totalDuration) * 100}%` }}
                    data-timeline-bg="true"
                  >
                    <span className={styles.markerLabel}>{fmtTime(t)}</span>
                    <div className={styles.markerLine} />
                  </div>
                ))}
              </div>
            )}

            {/* ── Blocks row ── */}
            <SortableContext
              items={blocks.map((b) => b.id)}
              strategy={horizontalListSortingStrategy}
            >
              <div className={styles.blocksRow} style={{ height: CANVAS_HEIGHT }}>
                {blocks.map((block, idx) => {
                  const { watts, heightPx, neighborWatts } = blockData[idx];
                  const widthPct = totalDuration > 0
                    ? `${(block.duration / totalDuration) * 100}%`
                    : '100%';
                  return (
                    <IntervalBlock
                      key={block.id}
                      block={block}
                      isSelected={selectedIds.has(block.id)}
                      isActive={activeId === block.id}
                      widthStyle={widthPct}
                      heightPx={heightPx}
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

            {/* ── Empty state ── */}
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

        {/* ── Drag overlay ── */}
        <DragOverlay>
          {activeBlock != null && activeBlockData != null && (
            <div
              className={styles.dragOverlay}
              style={{
                width:       200,
                height:      Math.max(MIN_BLOCK_HEIGHT, activeBlockData.heightPx),
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
