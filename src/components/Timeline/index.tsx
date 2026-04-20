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
  const wrapperRef   = useRef<HTMLDivElement>(null);
  const blocksRowRef = useRef<HTMLDivElement>(null);

  const totalDuration   = blocks.reduce((s, b) => s + b.duration, 0);
  const interval        = markerInterval(totalDuration);
  const maxDisplayWatts = getMaxDisplayWatts(zoneSystem.zones);

  // Time ruler markers
  const markers: number[] = [];
  for (let t = 0; t <= totalDuration + interval; t += interval) {
    markers.push(t);
  }

  // Compute effective watts and height ratio (0–1) for each block
  const blockData = blocks.map((block, idx) => {
    const zoneIdx     = ZONE_KEYS.indexOf(block.zone as typeof ZONE_KEYS[number]);
    const watts       = getBlockWatts(block.watts, zoneIdx >= 0 ? zoneIdx : 0, zoneSystem.zones);
    // heightRatio 0–1: block visual height = max(MIN_BLOCK_HEIGHT px, heightRatio * container %)
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
        {/* ── Ruler row (full width, spans scale gap + blocks area) ── */}
        <div className={styles.rulerRow}>
          {/* Blank cell to align ruler with blocks, not the scale */}
          <div className={styles.scaleGap} />
          {totalDuration > 0 && (
            <div className={styles.ruler} data-timeline-bg="true">
              {markers.map((t) => {
                const leftPct = (t / totalDuration) * 100;
                // First marker: left-align so "0min" label is not clipped
                const transform = t === 0 ? 'translateX(0)' : 'translateX(-50%)';
                return (
                  <div
                    key={t}
                    className={styles.marker}
                    style={{ left: `${leftPct}%`, transform }}
                    data-timeline-bg="true"
                  >
                    <span className={styles.markerLabel}>{fmtTime(t)}</span>
                    <div className={styles.markerLine} />
                  </div>
                );
              })}
            </div>
          )}
        </div>

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
                {/* Zone boundary lines – thin horizontal guides replacing colored bands */}
                <div className={styles.zoneLines} data-timeline-bg="true">
                  {zoneSystem.zones.map((range, i) => {
                    const bottomPct = Math.min((range.min / maxDisplayWatts) * 100, 100);
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

        {/* ── Drag overlay ── */}
        <DragOverlay>
          {activeBlock != null && activeBlockData != null && (
            <div
              className={styles.dragOverlay}
              style={{
                width:       200,
                height:      Math.max(MIN_BLOCK_HEIGHT, activeBlockData.heightRatio * CANVAS_HEIGHT),
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
