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

/* ─── Saved workout types ────────────────────────────────────────────────── */
export type SyncStatus = 'synced' | 'pending' | 'never'

export interface SavedWorkout {
  id: string
  name: string
  blocks: Block[]
  totalSeconds: number
  estimatedTss: number
  syncStatus: SyncStatus
  lastModified: Date
}

function calcTotalSeconds(blocks: Block[]): number {
  return blocks.reduce((s, b) => s + b.duration, 0)
}

function estimateTss(blocks: Block[]): number {
  const raw = blocks.reduce((sum, b) => {
    const zoneIdx     = ZONES.indexOf(b.zone as typeof ZONES[number])
    const fraction    = (zoneIdx + 1) / ZONES.length
    return sum + (b.duration / 3600) * fraction * fraction * 100
  }, 0)
  return Math.round(raw)
}

/* ─── Mock saved workouts ───────────────────────────────────────────────── */
function makeMockSavedWorkouts(): SavedWorkout[] {
  const now = Date.now()
  return [
    {
      id: 'sw-1',
      name: 'Sweet Spot x5',
      blocks: [
        { id: generateId(), duration: 600, zone: 'z1' },
        { id: generateId(), duration: 1200, zone: 'z4' },
        { id: generateId(), duration: 300,  zone: 'z2' },
        { id: generateId(), duration: 1200, zone: 'z4' },
        { id: generateId(), duration: 300,  zone: 'z1' },
      ],
      get totalSeconds() { return calcTotalSeconds(this.blocks) },
      get estimatedTss() { return estimateTss(this.blocks) },
      syncStatus: 'synced',
      lastModified: new Date(now - 2 * 86400_000),
    },
    {
      id: 'sw-2',
      name: 'VO2max Intervals',
      blocks: [
        { id: generateId(), duration: 600, zone: 'z2' },
        { id: generateId(), duration: 180, zone: 'z5' },
        { id: generateId(), duration: 180, zone: 'z1' },
        { id: generateId(), duration: 180, zone: 'z5' },
        { id: generateId(), duration: 180, zone: 'z1' },
        { id: generateId(), duration: 180, zone: 'z5' },
        { id: generateId(), duration: 300, zone: 'z1' },
      ],
      get totalSeconds() { return calcTotalSeconds(this.blocks) },
      get estimatedTss() { return estimateTss(this.blocks) },
      syncStatus: 'pending',
      lastModified: new Date(now - 5 * 86400_000),
    },
    {
      id: 'sw-3',
      name: 'Endurance 2h',
      blocks: [
        { id: generateId(), duration: 7200, zone: 'z2' },
      ],
      get totalSeconds() { return calcTotalSeconds(this.blocks) },
      get estimatedTss() { return estimateTss(this.blocks) },
      syncStatus: 'never',
      lastModified: new Date(now - 10 * 86400_000),
    },
    {
      id: 'sw-4',
      name: 'Pyramide Z1-Z5',
      blocks: [
        { id: generateId(), duration: 300, zone: 'z1' },
        { id: generateId(), duration: 300, zone: 'z2' },
        { id: generateId(), duration: 300, zone: 'z3' },
        { id: generateId(), duration: 300, zone: 'z4' },
        { id: generateId(), duration: 300, zone: 'z5' },
        { id: generateId(), duration: 300, zone: 'z4' },
        { id: generateId(), duration: 300, zone: 'z3' },
        { id: generateId(), duration: 300, zone: 'z2' },
        { id: generateId(), duration: 300, zone: 'z1' },
      ],
      get totalSeconds() { return calcTotalSeconds(this.blocks) },
      get estimatedTss() { return estimateTss(this.blocks) },
      syncStatus: 'synced',
      lastModified: new Date(now - 14 * 86400_000),
    },
    {
      id: 'sw-5',
      name: 'Tempo 40min',
      blocks: [
        { id: generateId(), duration: 600,  zone: 'z2' },
        { id: generateId(), duration: 2400, zone: 'z3' },
        { id: generateId(), duration: 600,  zone: 'z1' },
      ],
      get totalSeconds() { return calcTotalSeconds(this.blocks) },
      get estimatedTss() { return estimateTss(this.blocks) },
      syncStatus: 'never',
      lastModified: new Date(now - 21 * 86400_000),
    },
  ]
}

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
  const blocks         = ref<Block[]>(makeInitialBlocks())
  const selectedIds    = ref<Set<string>>(new Set())
  const zoneSystem     = ref<ZoneSystem>(createDefaultZoneSystem())
  const savedWorkouts  = ref<SavedWorkout[]>(makeMockSavedWorkouts())

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

  /* ─── Cloud persistence (mock) ──────────────────────────────────────── */
  async function persistToCloud(): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, 600))
  }

  /* ─── Saved workouts CRUD ────────────────────────────────────────────── */
  function saveCurrentWorkout(name: string): SavedWorkout {
    const workout: SavedWorkout = {
      id:           `sw-${generateId()}`,
      name,
      blocks:       blocks.value.map((b) => ({ ...b })),
      totalSeconds: calcTotalSeconds(blocks.value),
      estimatedTss: estimateTss(blocks.value),
      syncStatus:   'never',
      lastModified: new Date(),
    }
    savedWorkouts.value = [workout, ...savedWorkouts.value]
    return workout
  }

  function loadWorkout(id: string) {
    const workout = savedWorkouts.value.find((w) => w.id === id)
    if (!workout) return
    blocks.value      = workout.blocks.map((b) => ({ ...b }))
    selectedIds.value = new Set<string>()
  }

  function renameWorkout(id: string, name: string) {
    savedWorkouts.value = savedWorkouts.value.map((w) =>
      w.id === id ? { ...w, name, lastModified: new Date() } : w,
    )
  }

  function duplicateWorkout(id: string) {
    const idx = savedWorkouts.value.findIndex((w) => w.id === id)
    if (idx === -1) return
    const src     = savedWorkouts.value[idx]
    const copy: SavedWorkout = {
      ...src,
      id:           `sw-${generateId()}`,
      name:         `${src.name} (copie)`,
      blocks:       src.blocks.map((b) => ({ ...b, id: generateId() })),
      syncStatus:   'never',
      lastModified: new Date(),
    }
    const next = [...savedWorkouts.value]
    next.splice(idx + 1, 0, copy)
    savedWorkouts.value = next
  }

  function deleteWorkout(id: string) {
    savedWorkouts.value = savedWorkouts.value.filter((w) => w.id !== id)
  }

  function deleteSavedWorkouts(ids: string[]) {
    const set = new Set(ids)
    savedWorkouts.value = savedWorkouts.value.filter((w) => !set.has(w.id))
  }

  async function syncWorkout(id: string): Promise<void> {
    savedWorkouts.value = savedWorkouts.value.map((w) =>
      w.id === id ? { ...w, syncStatus: 'pending' } : w,
    )
    await new Promise<void>((resolve) => setTimeout(resolve, 1200))
    savedWorkouts.value = savedWorkouts.value.map((w) =>
      w.id === id ? { ...w, syncStatus: 'synced' } : w,
    )
  }

  async function syncSavedWorkouts(ids: string[]): Promise<void> {
    const set = new Set(ids)
    savedWorkouts.value = savedWorkouts.value.map((w) =>
      set.has(w.id) ? { ...w, syncStatus: 'pending' } : w,
    )
    await new Promise<void>((resolve) => setTimeout(resolve, 1400))
    savedWorkouts.value = savedWorkouts.value.map((w) =>
      set.has(w.id) ? { ...w, syncStatus: 'synced' } : w,
    )
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
    savedWorkouts,
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
    persistToCloud,
    saveCurrentWorkout,
    loadWorkout,
    renameWorkout,
    duplicateWorkout,
    deleteWorkout,
    deleteSavedWorkouts,
    syncWorkout,
    syncSavedWorkouts,
  }
})
