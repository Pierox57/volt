<!-- SVG native timeline: VueDraggable replaced by pointer-event drag-to-reorder -->
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useElementSize } from '@vueuse/core'
import { ZONES, formatDuration } from '@/types'
import { getBlockWatts, wattsToHeightRatio, getMaxDisplayWatts } from '@/zones'
import { useWorkoutStore } from '@/stores/workout'
import IntervalBlock from '@/components/IntervalBlock/IntervalBlock.vue'
import Scale from '@/components/Scale/Scale.vue'
import styles from './Timeline.module.css'

const store = useWorkoutStore()

/* ── SVG dimensions ── */
const BLOCK_GAP   = 3  // pixels between adjacent blocks
const MIN_BLOCK_H = 28

const svgRef = ref<SVGSVGElement | null>(null)
const { width: svgWidth, height: svgHeight } = useElementSize(svgRef)

/* ── Derived: maxDisplayWatts, markers, zone lines ── */
const maxDisplayWatts = computed(() => getMaxDisplayWatts(store.zoneSystem.zones))

const totalDuration = computed(() =>
  store.blocks.reduce((s, b) => s + b.duration, 0),
)

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

/* ── Block layout computation ── */
export interface BlockLayout {
  x: number
  y: number
  width: number
  height: number
  watts: number
  neighborWatts: number[]
}

const blockLayouts = computed((): BlockLayout[] => {
  const total = totalDuration.value
  const svgH  = svgHeight.value
  if (total === 0 || svgWidth.value === 0 || svgH === 0) return []

  const n = store.blocks.length
  const usableW = Math.max(0, svgWidth.value - BLOCK_GAP * Math.max(0, n - 1))

  let curX = 0
  return store.blocks.map((block, i) => {
    const zoneIdx = ZONES.indexOf(block.zone)
    const watts   = getBlockWatts(block.watts, zoneIdx >= 0 ? zoneIdx : 0, store.zoneSystem.zones)
    const hRatio  = wattsToHeightRatio(watts, maxDisplayWatts.value)
    const height  = Math.max(MIN_BLOCK_H, hRatio * svgH)
    const width   = (block.duration / total) * usableW
    const x       = curX
    const y       = svgH - height

    const prev = i > 0 ? store.blocks[i - 1] : null
    const next = i < n - 1 ? store.blocks[i + 1] : null
    const prevWatts = prev
      ? getBlockWatts(prev.watts, ZONES.indexOf(prev.zone), store.zoneSystem.zones)
      : null
    const nextWatts = next
      ? getBlockWatts(next.watts, ZONES.indexOf(next.zone), store.zoneSystem.zones)
      : null

    curX += width + BLOCK_GAP
    return { x, y, width, height, watts, neighborWatts: [prevWatts, nextWatts].filter((v): v is number => v !== null) }
  })
})

/* ── Zone boundary lines (horizontal) ── */
const zoneLineYs = computed(() => {
  const svgH = svgHeight.value
  if (svgH === 0) return []
  return store.zoneSystem.zones
    .map((z) => svgH - (z.min / maxDisplayWatts.value) * svgH)
    .filter((y) => y >= 0 && y <= svgH)
})

/* ── Drag-to-reorder ── */
interface DragState {
  blockId: string
  startX: number    // pointer X relative to SVG when drag started
  currentX: number  // pointer X relative to SVG (live)
  blockIdx: number
  ghostLayout: BlockLayout
}

const dragState = ref<DragState | null>(null)

/** Index where the dragged block would be inserted */
const dropIndex = computed(() => {
  if (!dragState.value) return -1
  const cx = dragState.value.currentX
  const layouts = blockLayouts.value
  // Find the insert position: compare cursor X with block centers (excluding dragged block)
  let insertIdx = 0
  for (let i = 0; i < layouts.length; i++) {
    if (i === dragState.value.blockIdx) continue
    const center = layouts[i].x + layouts[i].width / 2
    if (cx > center) insertIdx = i + 1
  }
  return insertIdx
})

/** Transform for the drag ghost (centered on cursor) */
const ghostTransform = computed(() => {
  if (!dragState.value) return ''
  const { currentX, ghostLayout } = dragState.value
  return `translate(${currentX - ghostLayout.width / 2}, ${ghostLayout.y})`
})

/** X coordinate of the drop indicator line */
const dropIndicatorX = computed(() => {
  if (!dragState.value) return 0
  const idx = dropIndex.value
  const layouts = blockLayouts.value
  if (idx === 0) return 0
  if (idx >= layouts.length) {
    const last = layouts[layouts.length - 1]
    return last ? last.x + last.width : 0
  }
  return layouts[idx].x - BLOCK_GAP / 2
})

function handleBlockDragStart(blockId: string, pointerX: number) {
  const idx = store.blocks.findIndex((b) => b.id === blockId)
  if (idx === -1) return
  const layout = blockLayouts.value[idx]
  if (!layout) return
  dragState.value = {
    blockId,
    startX: pointerX,
    currentX: pointerX,
    blockIdx: idx,
    ghostLayout: { ...layout },
  }
}

/* ── Lasso selection ── */
const lassoStartRef      = ref<{ x: number; y: number } | null>(null)
const isDraggingLassoRef = ref(false)
const lassoRect          = ref<{ x1: number; y1: number; x2: number; y2: number } | null>(null)

function cancelLasso() {
  lassoStartRef.value      = null
  isDraggingLassoRef.value = false
  lassoRect.value          = null
}

function handleEscapeKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    cancelLasso()
    if (dragState.value) dragState.value = null
  }
}

onMounted(() => window.addEventListener('keydown', handleEscapeKey))
onUnmounted(() => window.removeEventListener('keydown', handleEscapeKey))

/* ── Unified SVG pointer handlers ── */
function getSvgPoint(e: PointerEvent): { x: number; y: number } | null {
  if (!svgRef.value) return null
  const rect = svgRef.value.getBoundingClientRect()
  return { x: e.clientX - rect.left, y: e.clientY - rect.top }
}

function handleSvgPointerDown(e: PointerEvent) {
  const target = e.target as SVGElement
  // Ignore clicks on blocks/handles (they handle their own pointerdown)
  if (target.closest('[data-block-id]') || target.closest('button')) return

  const pt = getSvgPoint(e)
  if (!pt) return
  lassoStartRef.value      = pt
  isDraggingLassoRef.value = false
  ;(e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId)
}

function handleSvgPointerMove(e: PointerEvent) {
  // ── Drag-to-reorder ──
  if (dragState.value) {
    const pt = getSvgPoint(e)
    if (!pt) return
    dragState.value = { ...dragState.value, currentX: pt.x }
    return
  }

  // ── Lasso ──
  if (!lassoStartRef.value) return
  const pt = getSvgPoint(e)
  if (!pt) return
  const dx = pt.x - lassoStartRef.value.x
  const dy = pt.y - lassoStartRef.value.y
  if (!isDraggingLassoRef.value && Math.sqrt(dx * dx + dy * dy) < 4) return
  isDraggingLassoRef.value = true
  lassoRect.value = { x1: lassoStartRef.value.x, y1: lassoStartRef.value.y, x2: pt.x, y2: pt.y }

  // Compute lasso selection
  const lx1 = Math.min(lassoRect.value.x1, lassoRect.value.x2)
  const lx2 = Math.max(lassoRect.value.x1, lassoRect.value.x2)
  const ly1 = Math.min(lassoRect.value.y1, lassoRect.value.y2)
  const ly2 = Math.max(lassoRect.value.y1, lassoRect.value.y2)
  const ids = new Set<string>()
  store.blocks.forEach((block, idx) => {
    const layout = blockLayouts.value[idx]
    if (!layout) return
    const { x, y, width, height } = layout
    if (x < lx2 && x + width > lx1 && y < ly2 && y + height > ly1) {
      ids.add(block.id)
    }
  })
  store.lassoSelect(ids)
}

function handleSvgPointerUp() {
  // ── Drag-to-reorder commit ──
  if (dragState.value) {
    const { blockIdx } = dragState.value
    const di = dropIndex.value
    if (di !== blockIdx && di !== blockIdx + 1) {
      const newBlocks = [...store.blocks]
      const [removed] = newBlocks.splice(blockIdx, 1)
      const insertAt  = di > blockIdx ? di - 1 : di
      newBlocks.splice(insertAt, 0, removed)
      store.reorderBlocks(newBlocks)
    }
    dragState.value = null
    return
  }

  // ── Lasso ──
  if (!lassoStartRef.value) return
  if (!isDraggingLassoRef.value) {
    store.deselectAll()
  }
  cancelLasso()
}

function handleSvgPointerCancel() {
  dragState.value = null
  cancelLasso()
}
</script>

<template>
  <div :class="styles.outer">
    <!-- Ruler row -->
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

    <!-- Content row: Scale + SVG blocks area -->
    <div :class="styles.contentRow">
      <!-- Vertical watts/hr scale -->
      <Scale
        :zones="store.zoneSystem.zones"
        :max-display-watts="maxDisplayWatts"
        :mode="store.zoneSystem.mode === 'hrmax' ? 'hr' : 'watts'"
      />

      <!-- SVG blocks area -->
      <div :class="styles.blocksArea" data-timeline-bg="true">
        <!-- Lasso cursor overlay -->
        <div
          v-if="lassoRect"
          :class="styles.lassoCursor"
        />

        <svg
          ref="svgRef"
          :class="styles.svgCanvas"
          :style="dragState ? { cursor: 'grabbing' } : undefined"
          @pointerdown="handleSvgPointerDown"
          @pointermove="handleSvgPointerMove"
          @pointerup="handleSvgPointerUp"
          @pointercancel="handleSvgPointerCancel"
          data-timeline-bg="true"
        >
          <!-- Zone boundary lines -->
          <line
            v-for="(y, i) in zoneLineYs"
            :key="i"
            x1="0"
            :x2="svgWidth"
            :y1="y"
            :y2="y"
            :class="styles.svgZoneLine"
          />

          <!-- Blocks -->
          <IntervalBlock
            v-for="(block, idx) in store.blocks"
            :key="block.id"
            :block="block"
            :layout="blockLayouts[idx] ?? { x: 0, y: 0, width: 0, height: 0, watts: 0, neighborWatts: [] }"
            :is-selected="store.selectedIds.has(block.id)"
            :is-dragging="dragState?.blockId === block.id"
            :svg-height="svgHeight"
            :zone-ranges="store.zoneSystem.zones"
            :max-display-watts="maxDisplayWatts"
            @select="store.selectBlock"
            @resize="store.resizeBlock"
            @watts-change="store.changeWatts"
            @drag-start="handleBlockDragStart"
          />

          <!-- Drag ghost (semi-transparent copy following cursor) -->
          <g
            v-if="dragState"
            :transform="ghostTransform"
            opacity="0.6"
            pointer-events="none"
            style="filter: drop-shadow(0 8px 24px rgba(0,0,0,0.25));"
          >
            <rect
              :width="dragState.ghostLayout.width"
              :height="dragState.ghostLayout.height"
              rx="6"
              fill="var(--color-accent)"
              opacity="0.7"
            />
          </g>

          <!-- Drop indicator line -->
          <line
            v-if="dragState"
            :x1="dropIndicatorX"
            :x2="dropIndicatorX"
            y1="0"
            :y2="svgHeight"
            stroke="var(--color-accent)"
            stroke-width="2"
            stroke-dasharray="4 3"
            pointer-events="none"
          />

          <!-- Lasso selection rectangle -->
          <rect
            v-if="lassoRect"
            :x="Math.min(lassoRect.x1, lassoRect.x2)"
            :y="Math.min(lassoRect.y1, lassoRect.y2)"
            :width="Math.abs(lassoRect.x2 - lassoRect.x1)"
            :height="Math.abs(lassoRect.y2 - lassoRect.y1)"
            :class="styles.svgLassoRect"
          />
        </svg>

        <!-- Add-block affordance (outside SVG, below) -->
        <button
          :class="styles.addZone"
          @click.stop="store.addBlock"
          title="Ajouter un bloc"
          aria-label="Ajouter un bloc"
        >
          <span :class="styles.addIcon">+</span>
        </button>

        <!-- Empty state -->
        <div v-if="store.blocks.length === 0" :class="styles.emptyState" data-timeline-bg="true">
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

    <!-- Total duration strip -->
    <div v-if="totalDuration > 0" :class="styles.durationStrip">
      <span :class="styles.durationTotal">
        Total : <strong>{{ formatDuration(totalDuration) }}</strong>
      </span>
      <span :class="styles.blockCount">
        {{ store.blocks.length }} bloc{{ store.blocks.length > 1 ? 's' : '' }}
      </span>
    </div>
  </div>
</template>
