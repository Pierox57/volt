<script setup lang="ts">
import { ZONE_CONFIG, ZONES } from '@/types'
import Timeline       from '@/components/Timeline/Timeline.vue'
import BlockToolbar   from '@/components/BlockToolbar/BlockToolbar.vue'
import ShortcutHelper from '@/components/ShortcutHelper/ShortcutHelper.vue'
import { useKeyboard }     from '@/composables/useKeyboard'
import { useWorkoutStore } from '@/stores/workout'
import styles from './EditorView.module.css'

const store = useWorkoutStore()

/* ─── Keyboard shortcuts ────────────────────────────────────────────────── */
useKeyboard({
  onDelete:    store.deleteSelected,
  onDuplicate: store.duplicateSelected,
  onSelectAll: store.selectAll,
  onEscape:    store.deselectAll,
})
</script>

<template>
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
</template>
