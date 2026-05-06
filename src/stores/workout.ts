import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Block } from '@/types'
import {
  DEFAULT_DURATION,
  MIN_DURATION,
  ZONES,
  generateId,
} from '@/types'
import type { ZoneSystem } from '@/zones'
import { createDefaultZoneSystem, getZoneIndexForWatts } from '@/zones'

/* ─── Initial session (showcase) ────────────────────────────────────────── */
function makeInitialBlocks(): Block[] {
  return [
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
}

export const useWorkoutStore = defineStore('workout', () => {
  /* ─── State ─────────────────────────────────────────────────────────── */
  const blocks      = ref<Block[]>(makeInitialBlocks())
  const selectedIds = ref<Set<string>>(new Set())
  const zoneSystem  = ref<ZoneSystem>(createDefaultZoneSystem())

  /* ─── Derived ────────────────────────────────────────────────────────── */
  const selectedBlocks = computed(() =>
    blocks.value.filter((b) => selectedIds.value.has(b.id)),
  )
  const totalSeconds = computed(() =>
    blocks.value.reduce((s, b) => s + b.duration, 0),
  )

  /* ─── Selection ──────────────────────────────────────────────────────── */
  function selectBlock(id: string, mode: 'single' | 'multi') {
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

  function deselectAll() {
    selectedIds.value = new Set<string>()
  }

  function selectAll() {
    selectedIds.value = new Set(blocks.value.map((b) => b.id))
  }

  function lassoSelect(ids: Set<string>) {
    selectedIds.value = ids
  }

  /* ─── Block CRUD ─────────────────────────────────────────────────────── */
  function addBlock() {
    const block: Block = { id: generateId(), duration: DEFAULT_DURATION, zone: 'z2' }
    blocks.value      = [...blocks.value, block]
    selectedIds.value = new Set([block.id])
  }

  function resizeBlock(id: string, duration: number) {
    blocks.value = blocks.value.map((b) => (b.id === id ? { ...b, duration } : b))
  }

  function changeWatts(id: string, watts: number) {
    blocks.value = blocks.value.map((b) => {
      if (b.id !== id) return b
      const zoneIdx = getZoneIndexForWatts(watts, zoneSystem.value.zones)
      return { ...b, watts, zone: ZONES[zoneIdx] }
    })
  }

  function deleteSelected() {
    if (!selectedIds.value.size) return
    blocks.value      = blocks.value.filter((b) => !selectedIds.value.has(b.id))
    selectedIds.value = new Set<string>()
  }

  function duplicateSelected() {
    if (!selectedIds.value.size) return
    const sel     = blocks.value.filter((b) => selectedIds.value.has(b.id))
    const lastIdx = Math.max(...sel.map((b) => blocks.value.indexOf(b)))
    const clones  = sel.map((b) => ({ ...b, id: generateId() }))
    blocks.value = [
      ...blocks.value.slice(0, lastIdx + 1),
      ...clones,
      ...blocks.value.slice(lastIdx + 1),
    ]
    selectedIds.value = new Set(clones.map((c) => c.id))
  }

  function reorderBlocks(newOrder: Block[]) {
    blocks.value = newOrder
  }

  function clearAll() {
    blocks.value      = []
    selectedIds.value = new Set<string>()
  }

  /* ─── Group / bulk edits ─────────────────────────────────────────────── */
  function setAbsoluteDuration(duration: number) {
    blocks.value = blocks.value.map((b) =>
      selectedIds.value.has(b.id)
        ? { ...b, duration: Math.max(MIN_DURATION, duration) }
        : b,
    )
  }

  function setSelectedWatts(watts: number) {
    blocks.value = blocks.value.map((b) => {
      if (!selectedIds.value.has(b.id)) return b
      const zoneIdx = getZoneIndexForWatts(watts, zoneSystem.value.zones)
      return { ...b, watts, zone: ZONES[zoneIdx] }
    })
  }

  /* ─── Zone system ────────────────────────────────────────────────────── */
  function setZoneSystem(sys: ZoneSystem) {
    zoneSystem.value = sys
    blocks.value = blocks.value.map((b) => {
      if (b.watts === undefined) return b
      const zoneIdx = getZoneIndexForWatts(b.watts, sys.zones)
      return { ...b, zone: ZONES[zoneIdx] }
    })
  }

  return {
    /* state */
    blocks,
    selectedIds,
    zoneSystem,
    /* derived */
    selectedBlocks,
    totalSeconds,
    /* actions */
    selectBlock,
    deselectAll,
    selectAll,
    lassoSelect,
    addBlock,
    resizeBlock,
    changeWatts,
    deleteSelected,
    duplicateSelected,
    reorderBlocks,
    clearAll,
    setAbsoluteDuration,
    setSelectedWatts,
    setZoneSystem,
  }
})
