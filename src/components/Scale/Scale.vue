<!-- MIGRATED from: Scale/index.tsx -->
<script setup lang="ts">
/**
 * Scale – vertical axis showing watts values and zone colour bands.
 * Positioned to the left of the timeline blocks area.
 */
import type { ZoneRange } from '@/types'
import { ZONE_CONFIG, ZONES } from '@/types'
import styles from './Scale.module.css'

interface ScaleProps {
  zones: ZoneRange[]
  maxDisplayWatts: number
  mode: 'watts' | 'hr'
}

const props = defineProps<ScaleProps>()

function getBoundaries(): number[] {
  const boundaries: number[] = []
  for (const z of props.zones) {
    if (!boundaries.includes(z.min)) boundaries.push(z.min)
    if (!boundaries.includes(z.max) && z.max <= props.maxDisplayWatts * 1.1) boundaries.push(z.max)
  }
  boundaries.sort((a, b) => a - b)
  return boundaries
}
</script>

<template>
  <div :class="styles.scale">
    <!-- Zone color bands – percentage positioning, fills container height -->
    <template v-for="(zoneKey, i) in ZONES" :key="zoneKey">
      <div
        :class="styles.zoneBand"
        :style="{
          bottom: `${Math.min(zones[i].min / maxDisplayWatts, 1) * 100}%`,
          height: `${Math.max(0, Math.min(zones[i].max / maxDisplayWatts, 1) * 100 - Math.min(zones[i].min / maxDisplayWatts, 1) * 100)}%`,
          background: ZONE_CONFIG[zoneKey].bg,
          opacity: 0.3,
        }"
      />
    </template>

    <!-- Graduation lines + labels – percentage positioning -->
    <template v-for="val in getBoundaries()" :key="val">
      <div
        :class="styles.graduation"
        :style="{ bottom: `${Math.min(val / maxDisplayWatts, 1) * 100}%` }"
      >
        <span :class="styles.label">{{ val }}{{ mode === 'watts' ? 'W' : '' }}</span>
        <div :class="styles.tick" />
      </div>
    </template>
  </div>
</template>
