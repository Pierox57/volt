<!-- MIGRATED from: Timeline/index.tsx -->
<!-- Migration note: dnd-kit (DndContext + SortableContext + DragOverlay + useSensors) replaced
     by vuedraggable (SortableJS wrapper). The drag overlay ghost is handled by SortableJS's
     built-in .sortable-ghost / .sortable-drag classes styled via dragGhostStyles below.
     The 6px activation distance from dnd-kit is approximated by SortableJS default behavior. -->
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import VueDraggable from 'vuedraggable'
import type { Block } from '@/types'
import { formatDuration } from '@/types'
import type { ZoneSystem } from '@/zones'
import { getBlockWatts, wattsToHeightRatio, getMaxDisplayWatts } from '@/zones'
import IntervalBlock from '@/components/IntervalBlock/IntervalBlock.vue'
import Scale from '@/components/Scale/Scale.vue'
import styles from './Timeline.module.css'

const props = defineProps<{
  blocks: Block[]
  selectedIds: Set<string>
  activeId: string | null
  zoneSystem: ZoneSystem
}>()

const emit = defineEmits<{
  blocksChange: [blocks: Block[]]
  select: [id: string, mode: 'single' | 'multi']
  deselectAll: []
  lassoSelect: [ids: Set<string>]
  addBlock: []
  resizeBlock: [id: string, duration: number]
  wattsChange: [id: string, watts: number]
  dragStart: [id: string]
  dragEnd: []
}>()

const ZONE_KEYS = ['z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7'] as const

/* ── Draggable v-model bridge ── */
// vuedraggable needs a writable v-model, so we sync via computed
const localBlocks = computed({
  get: () => props.blocks,
  set: (val) => emit('blocksChange', val),
})

/* ── Derived values ── */
const totalDuration = computed(() => props.blocks.reduce((s, b) => s + b.duration, 0))

const maxDisplayWatts = computed(() => getMaxDisplayWatts(props.zoneSystem.zones))

function markerInterval(totalSeconds: number): number {
  if (totalSeconds <= 600)  return 60
  if (totalSeconds <= 3600) return 300
  return 600
}

const interval = computed(() => markerInterval(totalDuration.value))

const markers = computed(() => {
  const arr: number[] = []
  for (let t = 0; t <= totalDuration.value + interval.value; t += interval.value) {
    arr.push(t)
  }
  return arr
})

function fmtTime(s: number): string {
  const m = Math.floor(s / 60)
  if (s % 60 === 0) return `${m}min`
  return `${m}:${(s % 60).toString().padStart(2, '0')}`
}

const blockDataList = computed(() =>
  props.blocks.map((block, idx) => {
    const zoneIdx     = ZONE_KEYS.indexOf(block.zone as typeof ZONE_KEYS[number])
    const watts       = getBlockWatts(block.watts, zoneIdx >= 0 ? zoneIdx : 0, props.zoneSystem.zones)
    const heightRatio = wattsToHeightRatio(watts, maxDisplayWatts.value)

    const prevWatts = idx > 0
      ? getBlockWatts(
          props.blocks[idx - 1].watts,
          ZONE_KEYS.indexOf(props.blocks[idx - 1].zone as typeof ZONE_KEYS[number]),
          props.zoneSystem.zones,
        )
      : null
    const nextWatts = idx < props.blocks.length - 1
      ? getBlockWatts(
          props.blocks[idx + 1].watts,
          ZONE_KEYS.indexOf(props.blocks[idx + 1].zone as typeof ZONE_KEYS[number]),
          props.zoneSystem.zones,
        )
      : null
    const neighborWatts = [prevWatts, nextWatts].filter((v): v is number => v !== null)

    return { watts, heightRatio, neighborWatts }
  }),
)

const activeBlock = computed(() => props.blocks.find((b) => b.id === props.activeId) ?? null)
const activeBlockData = computed(() => {
  if (!activeBlock.value) return null
  return blockDataList.value[props.blocks.indexOf(activeBlock.value)] ?? null
})

/* ── Drag & drop (vuedraggable) ── */
function handleDragStart(evt: { item: HTMLElement }) {
  const id = evt.item.querySelector<HTMLElement>('[data-block-id]')?.dataset.blockId
    ?? evt.item.dataset.blockId
    ?? ''
  emit('dragStart', id)
}

function handleDragEnd() {
  emit('dragEnd')
}

/* ── Lasso selection ── */
const wrapperRef         = ref<HTMLDivElement | null>(null)
const lassoStartRef      = ref<{ x: number; y: number } | null>(null)
const isDraggingLassoRef = ref(false)
const lassoPointerIdRef  = ref<number | null>(null)
const lassoRect          = ref<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

// Cancel lasso on Escape
function handleEscapeKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && lassoStartRef.value) {
    lassoStartRef.value      = null
    isDraggingLassoRef.value = false
    lassoPointerIdRef.value  = null
    lassoRect.value          = null
  }
}

onMounted(() => window.addEventListener('keydown', handleEscapeKey))
onUnmounted(() => window.removeEventListener('keydown', handleEscapeKey))

function handleCanvasPointerDown(e: PointerEvent) {
  const target = e.target as HTMLElement
  if (target.closest('[data-block-id]') || target.closest('button')) return
  if (!wrapperRef.value) return

  const containerRect = wrapperRef.value.getBoundingClientRect()
  const x = e.clientX - containerRect.left
  const y = e.clientY - containerRect.top

  lassoStartRef.value      = { x, y }
  isDraggingLassoRef.value = false
  lassoPointerIdRef.value  = e.pointerId
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function handleCanvasPointerMove(e: PointerEvent) {
  if (!lassoStartRef.value || !wrapperRef.value) return

  const containerRect = wrapperRef.value.getBoundingClientRect()
  const x = e.clientX - containerRect.left
  const y = e.clientY - containerRect.top

  const dx = x - lassoStartRef.value.x
  const dy = y - lassoStartRef.value.y

  if (!isDraggingLassoRef.value && Math.sqrt(dx * dx + dy * dy) < 4) return

  isDraggingLassoRef.value = true

  const rect = { x1: lassoStartRef.value.x, y1: lassoStartRef.value.y, x2: x, y2: y }
  lassoRect.value = rect

  const lx1 = Math.min(rect.x1, rect.x2)
  const lx2 = Math.max(rect.x1, rect.x2)
  const ly1 = Math.min(rect.y1, rect.y2)
  const ly2 = Math.max(rect.y1, rect.y2)

  const ids = new Set<string>()
  props.blocks.forEach((block) => {
    const el = wrapperRef.value?.querySelector<HTMLElement>(
      `[data-block-id="${CSS.escape(block.id)}"]`,
    )
    if (!el) return
    const br      = el.getBoundingClientRect()
    const bLeft   = br.left   - containerRect.left
    const bRight  = br.right  - containerRect.left
    const bTop    = br.top    - containerRect.top
    const bBottom = br.bottom - containerRect.top
    if (bLeft < lx2 && bRight > lx1 && bTop < ly2 && bBottom > ly1) {
      ids.add(block.id)
    }
  })
  emit('lassoSelect', ids)
}

function handleCanvasPointerUp() {
  if (!lassoStartRef.value) return
  if (!isDraggingLassoRef.value) {
    emit('deselectAll')
  }
  lassoStartRef.value      = null
  isDraggingLassoRef.value = false
  lassoPointerIdRef.value  = null
  lassoRect.value          = null
}

function handleCanvasPointerCancel() {
  lassoStartRef.value      = null
  isDraggingLassoRef.value = false
  lassoPointerIdRef.value  = null
  lassoRect.value          = null
}

/* ── Typed event forwarding for IntervalBlock ── */
function onBlockSelect(id: string, mode: 'single' | 'multi') {
  emit('select', id, mode)
}
function onBlockResize(id: string, duration: number) {
  emit('resizeBlock', id, duration)
}
function onBlockWattsChange(id: string, watts: number) {
  emit('wattsChange', id, watts)
}
</script>

<template>
  <div :class="styles.outer">
    <!-- Ruler row (full width, spans scale gap + blocks area) -->
    <div :class="styles.rulerRow">
      <div :class="styles.scaleGap" />
      <div v-if="totalDuration > 0" :class="styles.ruler" data-timeline-bg="true">
        <div
          v-for="t in markers"
          :key="t"
          :class="styles.marker"
          :style="{
            left: `${(t / totalDuration) * 100}%`,
            transform: t === 0 ? 'translateX(0)' : 'translateX(-50%)',
          }"
          data-timeline-bg="true"
        >
          <span :class="styles.markerLabel">{{ fmtTime(t) }}</span>
          <div :class="styles.markerLine" />
        </div>
      </div>
    </div>

    <!-- Content row: Scale + Blocks (fills remaining height) -->
    <div :class="styles.contentRow">
      <!-- Vertical watts/hr scale -->
      <Scale
        :zones="zoneSystem.zones"
        :max-display-watts="maxDisplayWatts"
        :mode="zoneSystem.mode === 'hrmax' ? 'hr' : 'watts'"
      />

      <!-- Blocks area -->
      <div
        ref="wrapperRef"
        :class="styles.blocksArea"
        @pointerdown="handleCanvasPointerDown"
        @pointermove="handleCanvasPointerMove"
        @pointerup="handleCanvasPointerUp"
        @pointercancel="handleCanvasPointerCancel"
        :style="lassoRect ? { cursor: 'crosshair' } : undefined"
        data-timeline-bg="true"
      >
        <!-- Lasso selection rectangle -->
        <div
          v-if="lassoRect"
          :class="styles.lassoRect"
          :style="{
            left:   `${Math.min(lassoRect.x1, lassoRect.x2)}px`,
            top:    `${Math.min(lassoRect.y1, lassoRect.y2)}px`,
            width:  `${Math.abs(lassoRect.x2 - lassoRect.x1)}px`,
            height: `${Math.abs(lassoRect.y2 - lassoRect.y1)}px`,
          }"
        />

        <!-- Blocks row with drag-to-reorder -->
        <VueDraggable
          v-model="localBlocks"
          item-key="id"
          :animation="150"
          ghost-class="volt-drag-ghost"
          drag-class="volt-drag-active"
          :force-fallback="false"
          tag="div"
          :component-data="{ class: styles.blocksRow, 'data-blocks-row': 'true' }"
          @start="handleDragStart"
          @end="handleDragEnd"
        >
          <template #header>
            <!-- Zone boundary lines -->
            <div :class="styles.zoneLines" data-timeline-bg="true">
              <div
                v-for="(range, i) in zoneSystem.zones"
                :key="i"
                :class="styles.zoneLine"
                data-timeline-bg="true"
                :style="{ bottom: `${Math.min((range.min / maxDisplayWatts) * 100, 100)}%` }"
              />
            </div>
          </template>

          <template #item="{ element: block, index: idx }">
            <IntervalBlock
              :key="block.id"
              :block="block"
              :is-selected="selectedIds.has(block.id)"
              :is-active="activeId === block.id"
              :width-style="totalDuration > 0 ? `${(block.duration / totalDuration) * 100}%` : '100%'"
              :height-ratio="blockDataList[idx]?.heightRatio ?? 0"
              :effective-watts="blockDataList[idx]?.watts ?? 0"
              :zone-ranges="zoneSystem.zones"
              :neighbor-watts="blockDataList[idx]?.neighborWatts ?? []"
              :max-display-watts="maxDisplayWatts"
              @select="onBlockSelect"
              @resize="onBlockResize"
              @watts-change="onBlockWattsChange"
            />
          </template>

          <template #footer>
            <!-- Add-block affordance -->
            <button
              :class="styles.addZone"
              @click.stop="emit('addBlock')"
              title="Ajouter un bloc"
              aria-label="Ajouter un bloc"
            >
              <span :class="styles.addIcon">+</span>
            </button>
          </template>
        </VueDraggable>

        <!-- Empty state -->
        <div v-if="blocks.length === 0" :class="styles.emptyState" data-timeline-bg="true">
          <div :class="styles.emptyIcon" data-timeline-bg="true">⚡</div>
          <p :class="styles.emptyTitle" data-timeline-bg="true">
            Cliquez pour ajouter votre premier bloc
          </p>
          <p :class="styles.emptyHint" data-timeline-bg="true">
            Ou utilisez le bouton <strong>+</strong> en haut
          </p>
        </div>
      </div>
    </div>

    <!-- Drag overlay (shown during drag, mirrors the active block) -->
    <Teleport to="body">
      <div
        v-if="activeBlock && activeBlockData"
        class="volt-drag-overlay"
        :style="{
          position: 'fixed',
          pointerEvents: 'none',
          zIndex: 9999,
          display: 'none', /* Hidden by default; shown via JS in dragStart/dragEnd */
        }"
      >
        <!-- Content is rendered by SortableJS clone — this div is kept for potential future use -->
      </div>
    </Teleport>

    <!-- Total duration strip -->
    <div v-if="totalDuration > 0" :class="styles.durationStrip">
      <span :class="styles.durationTotal">
        Total : <strong>{{ formatDuration(totalDuration) }}</strong>
      </span>
      <span :class="styles.blockCount">
        {{ blocks.length }} bloc{{ blocks.length > 1 ? 's' : '' }}
      </span>
    </div>
  </div>
</template>

<style>
/* ── SortableJS drag ghost and active styles (global, as they are applied to cloned DOM nodes) ── */

/* Ghost placeholder (original position while dragging) – semi-transparent */
.volt-drag-ghost {
  opacity: 0.35 !important;
}

/* Flying drag clone (follows the cursor) – elevated shadow */
.volt-drag-active {
  box-shadow: 0 20px 60px rgba(0,0,0,.18), 0 8px 20px rgba(0,0,0,.12) !important;
  cursor: grabbing !important;
  z-index: 9999 !important;
}

.volt-drag-active .block {
  cursor: grabbing !important;
}
</style>
