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
import { PX_PER_SECOND, ZONE_CONFIG, formatDuration } from '../../types';
import IntervalBlock from '../IntervalBlock';
import styles from './Timeline.module.css';

interface TimelineProps {
  blocks: Block[];
  selectedIds: Set<string>;
  activeId: string | null;
  onBlocksChange: (blocks: Block[]) => void;
  onSelect: (id: string, mode: 'single' | 'multi') => void;
  onAddBlock: () => void;
  onResizeBlock: (id: string, duration: number) => void;
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

export default function Timeline({
  blocks,
  selectedIds,
  activeId,
  onBlocksChange,
  onSelect,
  onAddBlock,
  onResizeBlock,
  onDragStart,
  onDragEnd,
}: TimelineProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const totalDuration = blocks.reduce((s, b) => s + b.duration, 0);
  const timelineWidth = Math.max(totalDuration * PX_PER_SECOND + 300, 900);
  const interval      = markerInterval(totalDuration);

  const markers: number[] = [];
  for (let t = 0; t <= totalDuration + interval; t += interval) {
    markers.push(t);
  }

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

  const activeBlock = blocks.find((b) => b.id === activeId);

  /* ── Internal drag end (reorder + notify parent) ───────────────────────── */
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
      {/* ── Scrollable container ── */}
      <div className={styles.scroll}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(e: DragStartEvent) => onDragStart(String(e.active.id))}
          onDragEnd={handleDragEnd}
        >
          {/* ── Timeline canvas ── */}
          <div
            ref={wrapperRef}
            className={styles.canvas}
            style={{ width: timelineWidth }}
            onClick={handleTimelineClick}
            data-timeline-bg="true"
          >
            {/* ── Ruler ── */}
            <div className={styles.ruler} data-timeline-bg="true">
              {markers.map((t) => (
                <div
                  key={t}
                  className={styles.marker}
                  style={{ left: t * PX_PER_SECOND }}
                  data-timeline-bg="true"
                >
                  <span className={styles.markerLabel}>{fmtTime(t)}</span>
                  <div className={styles.markerLine} />
                </div>
              ))}
            </div>

            {/* ── Blocks row ── */}
            <SortableContext
              items={blocks.map((b) => b.id)}
              strategy={horizontalListSortingStrategy}
            >
              <div className={styles.blocksRow}>
                {blocks.map((block) => (
                  <IntervalBlock
                    key={block.id}
                    block={block}
                    isSelected={selectedIds.has(block.id)}
                    isActive={activeId === block.id}
                    onSelect={onSelect}
                    onResize={onResizeBlock}
                  />
                ))}

                {/* Add-block affordance at the end */}
                <button
                  className={styles.addZone}
                  onClick={(e) => { e.stopPropagation(); onAddBlock(); }}
                  title="Ajouter un bloc (ou cliquez sur la timeline)"
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

          {/* ── Drag overlay ── */}
          <DragOverlay>
            {activeBlock != null && (
              <div
                className={styles.dragOverlay}
                style={{
                  width:       activeBlock.duration * PX_PER_SECOND,
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
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

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
