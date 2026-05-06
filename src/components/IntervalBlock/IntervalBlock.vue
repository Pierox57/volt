<!-- SVG-native block: renders a <g> containing <rect> elements -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Block, ZoneRange } from '@/types'
import {
  ZONE_CONFIG,
  MIN_DURATION,
  SNAP_GRID,
  TOTAL_ZONES,
  formatDuration,
} from '@/types'
import { smartSnapWatts } from '@/zones'
import type { BlockLayout } from '@/components/Timeline/Timeline.vue'

const DRAG_THRESHOLD = 4  // px before a click becomes a drag
const HANDLE_SIZE    = 24 // px length of resize handle pills

const props = defineProps<{
  block: Block
  /** Absolute pixel layout from the parent SVG */
  layout: BlockLayout
  isSelected: boolean
  /** True while being drag-reordered (shows ghost state) */
  isDragging: boolean
  svgHeight: number
  zoneRanges: ZoneRange[]
  maxDisplayWatts: number
}>()

const emit = defineEmits<{
  select: [id: string, mode: 'single' | 'multi']
  resize: [id: string, duration: number]
  wattsChange: [id: string, watts: number]
  /** Emitted when the user starts dragging the block for reorder (pointerX in SVG coords) */
  dragStart: [id: string, pointerX: number]
}>()

const zone = computed(() => ZONE_CONFIG[props.block.zone])

/* ── Derived display ── */
const approxH     = computed(() => props.layout.height)
const isTiny      = computed(() => approxH.value < 48)
const isVerySmall = computed(() => approxH.value < 32)

const intensityBarH = computed(() =>
  (zone.value.intensity / TOTAL_ZONES) * props.layout.height,
)

/* ── Block-level click / drag-start dispatch ── */
const pointerIsDown  = ref(false)
const pointerDownX   = ref(0)
const hasDragEmitted = ref(false)

function handleBlockPointerDown(e: PointerEvent) {
  e.stopPropagation()
  pointerIsDown.value  = true
  pointerDownX.value   = e.clientX
  hasDragEmitted.value = false
  ;(e.currentTarget as SVGElement).setPointerCapture(e.pointerId)
}

function handleBlockPointerMove(e: PointerEvent) {
  // Only act when a pointer button is held — prevents spurious drags on hover
  if (!pointerIsDown.value || hasDragEmitted.value) return
  const dx = Math.abs(e.clientX - pointerDownX.value)
  if (dx > DRAG_THRESHOLD) {
    hasDragEmitted.value = true
    // Compute pointer X relative to the SVG
    const svgEl = (e.currentTarget as SVGElement).ownerSVGElement
    if (!svgEl) return
    const rect  = svgEl.getBoundingClientRect()
    const svgX  = e.clientX - rect.left
    emit('dragStart', props.block.id, svgX)
  }
}

function handleBlockPointerUp(e: PointerEvent) {
  if (pointerIsDown.value && !hasDragEmitted.value) {
    // It was a click (not a drag)
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      emit('select', props.block.id, 'multi')
    } else {
      emit('select', props.block.id, 'single')
    }
  }
  pointerIsDown.value  = false
  hasDragEmitted.value = false
}

function handleBlockPointerCancel() {
  pointerIsDown.value  = false
  hasDragEmitted.value = false
}

/* ── Width resize (horizontal, right edge) ── */
const resizingWidth = ref(false)

function handleWidthResizePointerDown(e: PointerEvent) {
  e.stopPropagation()
  ;(e.currentTarget as SVGElement).setPointerCapture(e.pointerId)
  resizingWidth.value = true
  const startX   = e.clientX
  const startDur = props.block.duration

  const onMove = (ev: PointerEvent) => {
    if (!resizingWidth.value) return
    const delta      = ev.clientX - startX
    const rawDur     = startDur + delta / 1.5
    const snapped    = Math.round(rawDur / SNAP_GRID) * SNAP_GRID
    const clamped    = Math.max(MIN_DURATION, snapped)
    emit('resize', props.block.id, clamped)
  }
  const onUp = () => {
    resizingWidth.value = false
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup',   onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup',   onUp)
}

/* ── Height resize (vertical, top edge) ── */
const resizingHeight = ref(false)

function handleHeightResizePointerDown(e: PointerEvent) {
  e.stopPropagation()
  ;(e.currentTarget as SVGElement).setPointerCapture(e.pointerId)
  resizingHeight.value = true
  const startY     = e.clientY
  const startWatts = props.layout.watts
  const pxPerWatt  = props.svgHeight / props.maxDisplayWatts

  const onMove = (ev: PointerEvent) => {
    if (!resizingHeight.value) return
    const deltaY     = startY - ev.clientY
    const deltaWatts = deltaY / pxPerWatt
    const rawWatts   = startWatts + deltaWatts
    const snapped    = smartSnapWatts(rawWatts, props.zoneRanges, props.layout.neighborWatts)
    const minWatts   = props.zoneRanges[0]?.min ?? 0
    const clamped    = Math.max(minWatts, Math.min(props.maxDisplayWatts, snapped))
    emit('wattsChange', props.block.id, Math.round(clamped))
  }
  const onUp = () => {
    resizingHeight.value = false
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup',   onUp)
  }
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup',   onUp)
}
</script>

<template>
  <g
    :transform="`translate(${layout.x}, ${layout.y})`"
    :data-block-id="block.id"
    :opacity="isDragging ? 0.3 : 1"
  >
    <!-- Main rect (zone colour) -->
    <rect
      :width="layout.width"
      :height="layout.height"
      rx="6"
      :fill="zone.bg"
      :stroke="isSelected ? 'rgba(255,255,255,0.9)' : 'transparent'"
      stroke-width="2"
      cursor="grab"
      @pointerdown="handleBlockPointerDown"
      @pointermove="handleBlockPointerMove"
      @pointerup="handleBlockPointerUp"
      @pointercancel="handleBlockPointerCancel"
      :aria-label="`${zone.label} – ${formatDuration(block.duration)} – ${layout.watts}W`"
      role="button"
      :aria-pressed="isSelected"
    />

    <!-- Intensity bar (left accent) -->
    <rect
      x="0"
      :y="layout.height - intensityBarH"
      width="4"
      :height="intensityBarH"
      :fill="zone.border"
      opacity="0.7"
      pointer-events="none"
    />

    <!-- Text content (only shown when block is large enough) -->
    <template v-if="!isVerySmall">
      <text
        v-if="!isTiny"
        :x="layout.width / 2"
        :y="layout.height / 2 - 12"
        text-anchor="middle"
        dominant-baseline="middle"
        :fill="zone.color"
        font-size="10"
        font-weight="700"
        letter-spacing="0.06em"
        font-family="inherit"
        pointer-events="none"
        style="text-transform: uppercase;"
      >{{ zone.label }}</text>

      <text
        :x="layout.width / 2"
        :y="layout.height / 2 + (isTiny ? 0 : 4)"
        text-anchor="middle"
        dominant-baseline="middle"
        :fill="zone.color"
        font-size="13"
        font-weight="800"
        font-family="var(--font-mono, monospace)"
        pointer-events="none"
      >{{ formatDuration(block.duration) }}</text>

      <text
        v-if="!isTiny"
        :x="layout.width / 2"
        :y="layout.height / 2 + 18"
        text-anchor="middle"
        dominant-baseline="middle"
        :fill="zone.color"
        font-size="10"
        font-weight="700"
        font-family="var(--font-mono, monospace)"
        opacity="0.85"
        pointer-events="none"
      >{{ layout.watts }}W</text>
    </template>

    <!-- Height resize handle (top edge pill) -->
    <rect
      :x="Math.max(0, (layout.width - HANDLE_SIZE) / 2)"
      y="4"
      :width="HANDLE_SIZE"
      height="8"
      rx="4"
      fill="rgba(255,255,255,0.45)"
      cursor="ns-resize"
      :title="`${layout.watts}W – glisser pour ajuster`"
      @pointerdown.stop="handleHeightResizePointerDown"
    />

    <!-- Width resize handle (right edge pill) -->
    <rect
      :x="layout.width - 10"
      :y="Math.max(0, (layout.height - HANDLE_SIZE) / 2)"
      width="6"
      :height="HANDLE_SIZE"
      rx="3"
      fill="rgba(255,255,255,0.45)"
      cursor="ew-resize"
      title="Redimensionner la durée"
      @pointerdown.stop="handleWidthResizePointerDown"
    />

    <!-- Selection glow ring -->
    <rect
      v-if="isSelected"
      x="-3"
      y="-3"
      :width="layout.width + 6"
      :height="layout.height + 6"
      rx="9"
      fill="none"
      stroke="var(--color-accent)"
      stroke-width="3"
      opacity="0.5"
      pointer-events="none"
    />
  </g>
</template>
