<!-- MIGRATED from: BlockToolbar/index.tsx -->
<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import type { Block, ZoneType } from '@/types'
import { MIN_DURATION } from '@/types'
import type { ZoneSystem } from '@/zones'
import { getBlockWatts } from '@/zones'
import styles from './BlockToolbar.module.css'

const props = defineProps<{
  selectedBlocks: Block[]
  zoneSystem: ZoneSystem
}>()

const emit = defineEmits<{
  absoluteDurationChange: [duration: number]
  wattsChange: [watts: number]
  delete: []
  duplicate: []
  close: []
}>()

const ZONE_KEYS: ZoneType[] = ['z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7']

/* ── Format helpers ── */
function formatMmSs(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function parseDuration(value: string): number | null {
  const trimmed = value.trim()
  const mmss = trimmed.match(/^(\d+):(\d{1,2})$/)
  if (mmss) {
    const m = parseInt(mmss[1], 10)
    const s = parseInt(mmss[2], 10)
    if (s >= 60) return null
    return m * 60 + s
  }
  const n = parseInt(trimmed, 10)
  if (!isNaN(n) && n > 0) return n
  return null
}

/* ── Derived display values ── */
const count = computed(() => props.selectedBlocks.length)

const totalDur   = computed(() => props.selectedBlocks.reduce((s, b) => s + b.duration, 0))
const avgDur     = computed(() => count.value > 0 ? Math.round(totalDur.value / count.value) : 0)
const displayDur = computed(() => count.value === 1 ? (props.selectedBlocks[0]?.duration ?? avgDur.value) : avgDur.value)

const effectiveWatts = computed(() =>
  props.selectedBlocks.map((b) => {
    const zoneIdx = ZONE_KEYS.indexOf(b.zone)
    return getBlockWatts(b.watts, zoneIdx >= 0 ? zoneIdx : 0, props.zoneSystem.zones)
  }),
)
const avgWatts     = computed(() => count.value > 0
  ? Math.round(effectiveWatts.value.reduce((s, w) => s + w, 0) / count.value)
  : 0,
)
const allSameWatts = computed(() => effectiveWatts.value.every((w) => w === effectiveWatts.value[0]))
const displayWatts = computed(() => allSameWatts.value ? (effectiveWatts.value[0] ?? avgWatts.value) : avgWatts.value)

/* ── Toolbar position (fixed, anchored above selected blocks) ── */
const pos = ref<{ x: number; y: number } | null>(null)

function updatePos() {
  const rects = props.selectedBlocks
    .map((b) =>
      document.querySelector<HTMLElement>(`[data-block-id="${b.id}"]`)?.getBoundingClientRect(),
    )
    .filter((r): r is DOMRect => r != null)

  if (rects.length === 0) {
    pos.value = null
    return
  }

  const left  = Math.min(...rects.map((r) => r.left))
  const right = Math.max(...rects.map((r) => r.right))
  const top   = Math.min(...rects.map((r) => r.top))
  pos.value = { x: (left + right) / 2, y: top }
}

// Update position on mount and whenever selectedBlocks changes
onMounted(async () => {
  await nextTick()
  updatePos()
  window.addEventListener('scroll', updatePos, true)
  window.addEventListener('resize', updatePos)
})

onUnmounted(() => {
  window.removeEventListener('scroll', updatePos, true)
  window.removeEventListener('resize', updatePos)
})

watch(
  () => props.selectedBlocks,
  async () => {
    await nextTick()
    updatePos()
  },
  { deep: true },
)

/* ── Edit mode ── */
const editMode      = ref(false)
const durationInput = ref('')
const wattsInput    = ref('')

const durInputRef   = ref<HTMLInputElement | null>(null)
const wattsInputRef = ref<HTMLInputElement | null>(null)
const toolbarRef    = ref<HTMLDivElement | null>(null)

async function openEdit() {
  durationInput.value = formatMmSs(displayDur.value)
  wattsInput.value    = String(displayWatts.value)
  editMode.value = true
  await nextTick()
  if (count.value > 1) {
    wattsInputRef.value?.focus()
  } else {
    durInputRef.value?.focus()
  }
}

function closeEdit() {
  editMode.value = false
}

function confirmEdit() {
  const parsed = parseDuration(durationInput.value)
  if (parsed !== null) {
    emit('absoluteDurationChange', Math.max(MIN_DURATION, parsed))
  }
  const w = parseInt(wattsInput.value, 10)
  if (!isNaN(w) && w > 0) {
    emit('wattsChange', w)
  }
  editMode.value = false
}

/* ── Click-outside to deselect ── */
function handleMouseDown(e: MouseEvent) {
  const target = e.target as Element
  if (toolbarRef.value?.contains(target)) return
  if (target.closest('[data-block-id]')) return
  emit('close')
}

/* ── Escape in edit mode closes edit ── */
function handleEscapeCapture(e: KeyboardEvent) {
  if (editMode.value && e.key === 'Escape') {
    closeEdit()
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleMouseDown)
  document.addEventListener('keydown', handleEscapeCapture, true)
})

onUnmounted(() => {
  document.removeEventListener('mousedown', handleMouseDown)
  document.removeEventListener('keydown', handleEscapeCapture, true)
})

const GAP = 8 // px gap between block top and toolbar bottom

const isHr = computed(() => props.zoneSystem.mode === 'hrmax')
</script>

<template>
  <div
    v-if="count > 0 && pos !== null"
    ref="toolbarRef"
    :class="styles.root"
    :style="{
      left: `${pos.x}px`,
      top:  `${pos.y}px`,
      transform: `translate(-50%, calc(-100% - ${GAP}px))`,
    }"
    role="toolbar"
    :aria-label="count === 1 ? '1 bloc sélectionné' : `${count} blocs sélectionnés`"
  >
    <!-- Edit panel (appears above toolbar) -->
    <div v-if="editMode" :class="styles.editPanel" role="group" aria-label="Modifier les valeurs">
      <div :class="styles.editRow">
        <!-- Duration input -->
        <div :class="styles.editField">
          <label :class="styles.editLabel">
            Durée{{ count > 1 ? ' (—)' : '' }}
          </label>
          <input
            ref="durInputRef"
            :class="styles.editInput"
            :value="count > 1 ? '—' : durationInput"
            @input="durationInput = ($event.target as HTMLInputElement).value"
            @keydown.enter="confirmEdit"
            placeholder="mm:ss"
            aria-label="Durée"
            :disabled="count > 1"
          />
        </div>

        <!-- Intensity input (watts or bpm depending on mode) -->
        <div :class="styles.editField">
          <label :class="styles.editLabel">{{ isHr ? 'bpm' : 'watts' }}</label>
          <input
            ref="wattsInputRef"
            :class="styles.editInput"
            type="number"
            :min="0"
            :value="wattsInput"
            @input="wattsInput = ($event.target as HTMLInputElement).value"
            @keydown.enter="confirmEdit"
            :placeholder="isHr ? 'bpm' : 'W'"
            :aria-label="isHr ? 'Fréquence cardiaque en bpm' : 'Puissance en watts'"
          />
        </div>

        <!-- Confirm / Cancel -->
        <div :class="styles.editActions">
          <button
            :class="[styles.editActionBtn, styles.editConfirm]"
            @click="confirmEdit"
            title="Confirmer (Entrée)"
            aria-label="Confirmer"
          >
            <!-- IconCheck -->
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <polyline points="2, 7 5.5, 10.5 12, 3.5" />
            </svg>
          </button>
          <button
            :class="[styles.editActionBtn, styles.editCancel]"
            @click="closeEdit"
            title="Annuler (Échap)"
            aria-label="Annuler"
          >
            <!-- IconX -->
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <line x1="2" y1="2" x2="10" y2="10" />
              <line x1="10" y1="2" x2="2" y2="10" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Main action toolbar -->
    <div :class="styles.toolbar">
      <span v-if="count > 1" :class="styles.countBadge" :aria-label="`${count} blocs`">
        {{ count }}
      </span>

      <button
        :class="[styles.toolBtn, styles.toolBtnAccent]"
        @click="emit('duplicate')"
        :title="`Dupliquer${count > 1 ? ` (${count} blocs)` : ''} — Ctrl+D`"
        aria-label="Dupliquer"
      >
        <!-- IconCopy -->
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
          <path d="M3 10.5V4A1.5 1.5 0 0 1 4.5 2.5H11" />
        </svg>
      </button>

      <div :class="styles.sep" />

      <button
        :class="[styles.toolBtn, styles.toolBtnDanger]"
        @click="emit('delete')"
        :title="`Supprimer${count > 1 ? ` (${count} blocs)` : ''} — Suppr`"
        aria-label="Supprimer"
      >
        <!-- IconTrash -->
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M2.5 4.5h11" />
          <path d="M5.5 4.5V3.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1" />
          <path d="M6.5 7.5v4M9.5 7.5v4" />
          <path d="M4 4.5l.65 7.15A1 1 0 0 0 5.65 12.5h4.7a1 1 0 0 0 1-.85L12 4.5" />
        </svg>
      </button>

      <div :class="styles.sep" />

      <button
        :class="[styles.toolBtn, editMode && styles.toolBtnActive]"
        @click="editMode ? closeEdit() : openEdit()"
        title="Modifier les valeurs"
        aria-label="Modifier les valeurs"
        :aria-expanded="editMode"
      >
        <!-- IconPencil -->
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M11 2.5a1.5 1.5 0 0 1 2.12 0l.38.38a1.5 1.5 0 0 1 0 2.12L5 13.5H2.5v-2.5L11 2.5Z" />
          <path d="M9.5 4 12 6.5" />
        </svg>
      </button>
    </div>
  </div>
</template>
