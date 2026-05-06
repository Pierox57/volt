<!-- MIGRATED from: App.tsx -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Block } from '@/types'
import {
  DEFAULT_DURATION,
  MIN_DURATION,
  ZONE_CONFIG,
  ZONES,
  generateId,
} from '@/types'
import type { ZoneSystem } from '@/zones'
import { createDefaultZoneSystem, getZoneIndexForWatts } from '@/zones'
import Timeline       from '@/components/Timeline/Timeline.vue'
import BlockToolbar   from '@/components/BlockToolbar/BlockToolbar.vue'
import ShortcutHelper from '@/components/ShortcutHelper/ShortcutHelper.vue'
import ZoneSettings   from '@/components/ZoneSettings/ZoneSettings.vue'
import { useKeyboard } from '@/composables/useKeyboard'
import styles from './App.module.css'

/* ─── Initial session (showcase) ───────────────────────────────────────── */
const INITIAL_BLOCKS: Block[] = [
  { id: generateId(), duration: 600, zone: 'z1' },
  { id: generateId(), duration: 300, zone: 'z2' },
  { id: generateId(), duration: 240, zone: 'z3' },
  { id: generateId(), duration: 180, zone: 'z4' },
  { id: generateId(), duration: 90,  zone: 'z5' },
  { id: generateId(), duration: 180, zone: 'z2' },
  { id: generateId(), duration: 90,  zone: 'z5' },
  { id: generateId(), duration: 180, zone: 'z2' },
  { id: generateId(), duration: 90,  zone: 'z4' },
  { id: generateId(), duration: 300, zone: 'z1' },
]

/* ─── State ─────────────────────────────────────────────────────────────── */
const blocks      = ref<Block[]>(INITIAL_BLOCKS)
const selectedIds = ref<Set<string>>(new Set())
const activeId    = ref<string | null>(null)
const zoneSystem  = ref<ZoneSystem>(createDefaultZoneSystem())

/* ─── Derived ───────────────────────────────────────────────────────────── */
const selectedBlocks = computed(() => blocks.value.filter((b: Block) => selectedIds.value.has(b.id)))
const totalSeconds   = computed(() => blocks.value.reduce((s: number, b: Block) => s + b.duration, 0))

/* ─── Format helper ─────────────────────────────────────────────────────── */
function formatTotal(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`
  return `${m}min`
}

/* ─── Selection ─────────────────────────────────────────────────────────── */
function handleSelect(id: string, mode: 'single' | 'multi') {
  if (mode === 'multi') {
    const next = new Set(selectedIds.value)
    if (next.has(id)) next.delete(id)
    else              next.add(id)
    selectedIds.value = next
    return
  }
  if (selectedIds.value.size === 1 && selectedIds.value.has(id)) {
    selectedIds.value = new Set<string>()
    return
  }
  selectedIds.value = new Set([id])
}

function handleDeselectAll() {
  selectedIds.value = new Set<string>()
}

function handleSelectAll() {
  selectedIds.value = new Set(blocks.value.map((b: Block) => b.id))
}

/* ─── Add block ─────────────────────────────────────────────────────────── */
function handleAddBlock() {
  const newBlock: Block = { id: generateId(), duration: DEFAULT_DURATION, zone: 'z2' }
  blocks.value      = [...blocks.value, newBlock]
  selectedIds.value = new Set([newBlock.id])
}

/* ─── Resize block ──────────────────────────────────────────────────────── */
function handleResizeBlock(id: string, duration: number) {
  blocks.value = blocks.value.map((b: Block) => (b.id === id ? { ...b, duration } : b))
}

/* ─── Watts change ──────────────────────────────────────────────────────── */
function handleWattsChange(id: string, watts: number) {
  blocks.value = blocks.value.map((b: Block) => {
    if (b.id !== id) return b
    const zoneIdx = getZoneIndexForWatts(watts, zoneSystem.value.zones)
    return { ...b, watts, zone: ZONES[zoneIdx] }
  })
}

/* ─── Delete ────────────────────────────────────────────────────────────── */
function handleDelete() {
  if (selectedIds.value.size === 0) return
  blocks.value      = blocks.value.filter((b: Block) => !selectedIds.value.has(b.id))
  selectedIds.value = new Set<string>()
}

/* ─── Duplicate ─────────────────────────────────────────────────────────── */
function handleDuplicate() {
  if (selectedIds.value.size === 0) return
  const selectedInOrder = blocks.value.filter((b: Block) => selectedIds.value.has(b.id))
  const lastIdx = Math.max(...selectedInOrder.map((b: Block) => blocks.value.indexOf(b)))
  const clones  = selectedInOrder.map((b: Block) => ({ ...b, id: generateId() }))
  blocks.value = [
    ...blocks.value.slice(0, lastIdx + 1),
    ...clones,
    ...blocks.value.slice(lastIdx + 1),
  ]
  selectedIds.value = new Set(clones.map((c: Block) => c.id))
}

/* ─── Group edit ────────────────────────────────────────────────────────── */
function handleAbsoluteDurationChange(duration: number) {
  blocks.value = blocks.value.map((b: Block) =>
    selectedIds.value.has(b.id)
      ? { ...b, duration: Math.max(MIN_DURATION, duration) }
      : b,
  )
}

function handleBlockEditorWattsChange(watts: number) {
  blocks.value = blocks.value.map((b: Block) => {
    if (!selectedIds.value.has(b.id)) return b
    const zoneIdx = getZoneIndexForWatts(watts, zoneSystem.value.zones)
    return { ...b, watts, zone: ZONES[zoneIdx] }
  })
}

/* ─── Zone system ───────────────────────────────────────────────────────── */
function handleZoneSystemChange(sys: ZoneSystem) {
  zoneSystem.value = sys
  blocks.value = blocks.value.map((b: Block) => {
    if (b.watts === undefined) return b
    const zoneIdx = getZoneIndexForWatts(b.watts, sys.zones)
    return { ...b, zone: ZONES[zoneIdx] }
  })
}

/* ─── Drag & drop ───────────────────────────────────────────────────────── */
function handleDragStart(id: string) {
  activeId.value = id
}

function handleDragEnd() {
  activeId.value = null
}

/* ─── Clear all ─────────────────────────────────────────────────────────── */
function handleClearAll() {
  blocks.value      = []
  selectedIds.value = new Set<string>()
}

/* ─── Keyboard shortcuts ────────────────────────────────────────────────── */
useKeyboard({
  onDelete:    handleDelete,
  onDuplicate: handleDuplicate,
  onSelectAll: handleSelectAll,
  onEscape:    handleDeselectAll,
})
</script>

<template>
  <div :class="styles.app">
    <!-- Header -->
    <header :class="styles.header">
      <div :class="styles.brand">
        <span :class="styles.brandIcon">⚡</span>
        <span :class="styles.brandName">VOLT</span>
        <span :class="styles.brandSub">Workout Builder</span>
      </div>

      <div :class="styles.stats">
        <div :class="styles.stat">
          <span :class="styles.statValue">{{ blocks.length }}</span>
          <span :class="styles.statLabel">blocs</span>
        </div>
        <div v-if="totalSeconds > 0" :class="styles.stat">
          <span :class="styles.statValue">{{ formatTotal(totalSeconds) }}</span>
          <span :class="styles.statLabel">durée</span>
        </div>
        <div v-if="selectedIds.size > 0" :class="[styles.stat, styles.statSelected]">
          <span :class="styles.statValue">{{ selectedIds.size }}</span>
          <span :class="styles.statLabel">
            sélectionné{{ selectedIds.size > 1 ? 's' : '' }}
          </span>
        </div>
      </div>

      <div :class="styles.headerActions">
        <!-- Zone settings -->
        <ZoneSettings
          :zone-system="zoneSystem"
          @zone-system-change="handleZoneSystemChange"
        />

        <button
          :class="styles.btnSecondary"
          @click="handleDeselectAll"
          :disabled="selectedIds.size === 0"
        >
          Désélectionner
        </button>
        <button :class="styles.btnPrimary" @click="handleAddBlock">
          <span>+</span>&nbsp;Ajouter
        </button>
        <button
          v-if="blocks.length > 0"
          :class="styles.btnDanger"
          @click="handleClearAll"
          title="Vider la timeline"
        >
          Vider
        </button>
      </div>
    </header>

    <!-- Zone legend -->
    <div :class="styles.legend">
      <div v-for="zone in ZONES" :key="zone" :class="styles.legendItem">
        <span
          :class="styles.legendDot"
          :style="{ background: ZONE_CONFIG[zone].bg, border: `2px solid ${ZONE_CONFIG[zone].border}` }"
        />
        <span :class="styles.legendLabel">{{ ZONE_CONFIG[zone].label }}</span>
      </div>
    </div>

    <!-- Main content -->
    <main :class="styles.main">
      <Timeline
        :blocks="blocks"
        :selected-ids="selectedIds"
        :active-id="activeId"
        :zone-system="zoneSystem"
        @blocks-change="blocks = $event"
        @select="handleSelect"
        @deselect-all="handleDeselectAll"
        @lasso-select="selectedIds = $event"
        @add-block="handleAddBlock"
        @resize-block="handleResizeBlock"
        @watts-change="handleWattsChange"
        @drag-start="handleDragStart"
        @drag-end="handleDragEnd"
      />
    </main>

    <!-- Block toolbar (floating, anchored above selected blocks) -->
    <BlockToolbar
      v-if="selectedBlocks.length > 0"
      :selected-blocks="selectedBlocks"
      :zone-system="zoneSystem"
      @absolute-duration-change="handleAbsoluteDurationChange"
      @watts-change="handleBlockEditorWattsChange"
      @delete="handleDelete"
      @duplicate="handleDuplicate"
      @close="handleDeselectAll"
    />

    <!-- Shortcut helper -->
    <ShortcutHelper />
  </div>
</template>
