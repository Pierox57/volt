<!-- MIGRATED from: IntervalBlock/index.tsx -->
<!-- Migration note: dnd-kit useSortable is handled by the parent VueDraggable wrapper.
     Per-item drag state (isDragging/transform) is handled via SortableJS CSS classes
     (.sortable-ghost for the placeholder, .sortable-drag for the flying clone).
     The sortable wrapper div is rendered here; VueDraggable binds drag attributes to it. -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Block, ZoneRange } from '@/types'
import {
  ZONE_CONFIG,
  MIN_DURATION,
  SNAP_GRID,
  CANVAS_HEIGHT,
  MIN_BLOCK_HEIGHT,
  TOTAL_ZONES,
  formatDuration,
} from '@/types'
import { smartSnapWatts } from '@/zones'
import styles from './IntervalBlock.module.css'

const props = defineProps<{
  block: Block
  isSelected: boolean
  isActive: boolean
  /** Width as a CSS value, e.g. "12.5%" */
  widthStyle: string
  /** Height as a 0–1 ratio of the blocks-row container height */
  heightRatio: number
  /** The effective watts for this block (computed by parent) */
  effectiveWatts: number
  /** Zone ranges for smart snap */
  zoneRanges: ZoneRange[]
  /** Watts values of neighbouring blocks for smart snap */
  neighborWatts: number[]
  /** Max display watts (scale ceiling) */
  maxDisplayWatts: number
}>()

const emit = defineEmits<{
  select: [id: string, mode: 'single' | 'multi']
  resize: [id: string, duration: number]
  wattsChange: [id: string, watts: number]
}>()

const resizingWidthRef   = ref(false)
const resizingHeightRef  = ref(false)
const widthHandleRef     = ref<HTMLDivElement | null>(null)
const heightHandleRef    = ref<HTMLDivElement | null>(null)

const zone = computed(() => ZONE_CONFIG[props.block.zone])

const wrapperStyle = computed(() => ({
  flexShrink: 1,
  flexGrow: 0,
  flexBasis: props.widthStyle,
  alignSelf: 'flex-end' as const,
  // Use CSS max() so blocks have both a minimum pixel height and a % of the container
  height: `max(${MIN_BLOCK_HEIGHT}px, ${(props.heightRatio * 100).toFixed(2)}%)`,
}))

// Use CANVAS_HEIGHT as the reference for content-hiding thresholds
const approxHeightPx = computed(() => Math.max(MIN_BLOCK_HEIGHT, props.heightRatio * CANVAS_HEIGHT))
const isTiny      = computed(() => approxHeightPx.value < 48)
const isVerySmall = computed(() => approxHeightPx.value < 32)

/* ── Selection ──────────────────────────────────────────────────────────── */
function handleClick(e: MouseEvent) {
  e.stopPropagation()
  if (e.shiftKey || e.metaKey || e.ctrlKey) {
    emit('select', props.block.id, 'multi')
  } else {
    emit('select', props.block.id, 'single')
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') handleClick(e as unknown as MouseEvent)
}

/* ── Width resize (horizontal) ──────────────────────────────────────────── */
function handleWidthResizePointerDown(e: PointerEvent) {
  e.stopPropagation()
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  resizingWidthRef.value = true
  const startX   = e.clientX
  const startDur = props.block.duration
  widthHandleRef.value?.classList.add(styles.dragging)

  const onPointerMove = (ev: PointerEvent) => {
    if (!resizingWidthRef.value) return
    const delta       = ev.clientX - startX
    const rawDuration = startDur + (delta / 1.5)
    const snapped     = Math.round(rawDuration / SNAP_GRID) * SNAP_GRID
    const clamped     = Math.max(MIN_DURATION, snapped)
    emit('resize', props.block.id, clamped)
  }

  const onPointerUp = () => {
    resizingWidthRef.value = false
    widthHandleRef.value?.classList.remove(styles.dragging)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup',   onPointerUp)
  }

  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup',   onPointerUp)
}

/* ── Height resize (vertical – smart snap) ──────────────────────────────── */
function handleHeightResizePointerDown(e: PointerEvent) {
  e.stopPropagation()
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  resizingHeightRef.value = true
  const startY     = e.clientY
  const startWatts = props.effectiveWatts
  heightHandleRef.value?.classList.add(styles.dragging)

  const containerEl = (e.currentTarget as HTMLElement).closest('[data-blocks-row]') as HTMLElement | null
  const containerH  = containerEl?.clientHeight ?? CANVAS_HEIGHT
  const pxPerWatt   = containerH / props.maxDisplayWatts

  const onPointerMove = (ev: PointerEvent) => {
    if (!resizingHeightRef.value) return
    const deltaY     = startY - ev.clientY
    const deltaWatts = deltaY / pxPerWatt
    const rawWatts   = startWatts + deltaWatts
    const snapped    = smartSnapWatts(rawWatts, props.zoneRanges, props.neighborWatts)
    const minWatts   = props.zoneRanges[0]?.min ?? 0
    const clamped    = Math.max(minWatts, Math.min(props.maxDisplayWatts, snapped))
    emit('wattsChange', props.block.id, Math.round(clamped))
  }

  const onPointerUp = () => {
    resizingHeightRef.value = false
    heightHandleRef.value?.classList.remove(styles.dragging)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup',   onPointerUp)
  }

  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup',   onPointerUp)
}
</script>

<template>
  <div
    :style="wrapperStyle"
    :class="styles.wrapper"
    :data-block-id="block.id"
  >
    <div
      :class="[styles.block, isSelected && styles.selected, isActive && styles.active]"
      :style="{
        background:  zone.bg,
        borderColor: zone.border,
        color:       zone.color,
        height:      '100%',
      }"
      @click="handleClick"
      @keydown="handleKeyDown"
      role="button"
      :tabindex="0"
      :aria-pressed="isSelected"
      :aria-label="`${zone.label} – ${formatDuration(block.duration)} – ${effectiveWatts}W`"
    >
      <!-- Height resize handle (top, for vertical resize) -->
      <div
        ref="heightHandleRef"
        :class="styles.heightResizeHandle"
        @pointerdown.stop="handleHeightResizePointerDown"
        :title="`${effectiveWatts}W – glisser pour ajuster`"
      >
        <span :class="styles.heightResizePill" />
      </div>

      <!-- Content -->
      <div v-if="!isVerySmall" :class="styles.content">
        <span v-if="!isTiny" :class="styles.zoneLabel">{{ zone.label }}</span>
        <span :class="styles.duration">{{ formatDuration(block.duration) }}</span>
        <span v-if="!isTiny" :class="styles.wattsLabel">{{ effectiveWatts }}W</span>
      </div>

      <!-- Intensity bar (left accent) -->
      <div
        :class="styles.intensityBar"
        :style="{ height: `${(zone.intensity / TOTAL_ZONES) * 100}%`, background: zone.border }"
      />

      <!-- Width resize handle (right edge) -->
      <div
        ref="widthHandleRef"
        :class="styles.resizeHandle"
        @pointerdown.stop="handleWidthResizePointerDown"
        title="Redimensionner la durée"
      >
        <span :class="styles.resizePill" />
      </div>

      <!-- Selection ring overlay -->
      <div v-if="isSelected" :class="styles.selectionRing" />
    </div>
  </div>
</template>
