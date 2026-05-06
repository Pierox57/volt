<!-- MIGRATED from: App.tsx -->
<script setup lang="ts">
import { ZONE_CONFIG, ZONES } from '@/types'
import Timeline       from '@/components/Timeline/Timeline.vue'
import BlockToolbar   from '@/components/BlockToolbar/BlockToolbar.vue'
import ShortcutHelper from '@/components/ShortcutHelper/ShortcutHelper.vue'
import ZoneSettings   from '@/components/ZoneSettings/ZoneSettings.vue'
import { useKeyboard } from '@/composables/useKeyboard'
import { useWorkoutStore } from '@/stores/workout'
import styles from './App.module.css'

const store = useWorkoutStore()

/* ─── Format helper ─────────────────────────────────────────────────────── */
function formatTotal(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`
  return `${m}min`
}

/* ─── Keyboard shortcuts ────────────────────────────────────────────────── */
useKeyboard({
  onDelete:    store.deleteSelected,
  onDuplicate: store.duplicateSelected,
  onSelectAll: store.selectAll,
  onEscape:    store.deselectAll,
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
          <span :class="styles.statValue">{{ store.blocks.length }}</span>
          <span :class="styles.statLabel">blocs</span>
        </div>
        <div v-if="store.totalSeconds > 0" :class="styles.stat">
          <span :class="styles.statValue">{{ formatTotal(store.totalSeconds) }}</span>
          <span :class="styles.statLabel">durée</span>
        </div>
        <div v-if="store.selectedIds.size > 0" :class="[styles.stat, styles.statSelected]">
          <span :class="styles.statValue">{{ store.selectedIds.size }}</span>
          <span :class="styles.statLabel">
            sélectionné{{ store.selectedIds.size > 1 ? 's' : '' }}
          </span>
        </div>
      </div>

      <div :class="styles.headerActions">
        <!-- Zone settings -->
        <ZoneSettings
          :zone-system="store.zoneSystem"
          @zone-system-change="store.setZoneSystem"
        />
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
      <Timeline />
    </main>

    <!-- Block toolbar (floating, anchored above selected blocks) -->
    <BlockToolbar
      v-if="store.selectedBlocks.length > 0"
      :selected-blocks="store.selectedBlocks"
      :zone-system="store.zoneSystem"
      @absolute-duration-change="store.setAbsoluteDuration"
      @watts-change="store.setSelectedWatts"
      @delete="store.deleteSelected"
      @duplicate="store.duplicateSelected"
      @close="store.deselectAll"
    />

    <!-- Shortcut helper -->
    <ShortcutHelper />
  </div>
</template>
