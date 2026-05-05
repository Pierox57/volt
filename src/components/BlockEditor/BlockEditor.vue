<!-- MIGRATED from: BlockEditor/index.tsx -->
<script setup lang="ts">
import { computed } from 'vue'
import type { Block, ZoneType } from '@/types'
import { ZONE_CONFIG, ZONES, formatDuration } from '@/types'
import type { ZoneSystem } from '@/zones'
import { getBlockWatts } from '@/zones'
import styles from './BlockEditor.module.css'

const props = defineProps<{
  selectedBlocks: Block[]
  zoneSystem: ZoneSystem
}>()

const emit = defineEmits<{
  durationChange: [delta: number]
  zoneChange: [zone: ZoneType]
  wattsChange: [watts: number]
  delete: []
  duplicate: []
  close: []
}>()

const ZONE_KEYS: ZoneType[] = ['z1', 'z2', 'z3', 'z4', 'z5', 'z6', 'z7']

const DURATION_STEPS = [
  { label: '−1min', delta: -60 },
  { label: '−30s',  delta: -30 },
  { label: '+30s',  delta:  30 },
  { label: '+1min', delta:  60 },
]

const WATTS_STEPS = [
  { label: '−20W', delta: -20 },
  { label: '−5W',  delta:  -5 },
  { label: '+5W',  delta:   5 },
  { label: '+20W', delta:  20 },
]

const count = computed(() => props.selectedBlocks.length)

const uniqueZones = computed(() => [...new Set(props.selectedBlocks.map((b) => b.zone))])
const mixedZones  = computed(() => uniqueZones.value.length > 1)
const currentZone = computed(() => mixedZones.value ? null : uniqueZones.value[0] ?? null)

const totalDur = computed(() => props.selectedBlocks.reduce((s, b) => s + b.duration, 0))
const avgDur   = computed(() => count.value > 0 ? Math.round(totalDur.value / count.value) : 0)

const effectiveWattsValues = computed(() =>
  props.selectedBlocks.map((b) => {
    const zoneIdx = ZONE_KEYS.indexOf(b.zone)
    return getBlockWatts(b.watts, zoneIdx >= 0 ? zoneIdx : 0, props.zoneSystem.zones)
  }),
)
const allSameWatts = computed(() => effectiveWattsValues.value.every((w) => w === effectiveWattsValues.value[0]))
const displayWatts = computed(() => allSameWatts.value ? effectiveWattsValues.value[0] : null)
const avgWatts     = computed(() => Math.round(effectiveWattsValues.value.reduce((s, w) => s + w, 0) / count.value))

function handleWattsDelta(delta: number) {
  const base = displayWatts.value ?? avgWatts.value
  emit('wattsChange', Math.max(0, base + delta))
}
</script>

<template>
  <div v-if="count > 0" :class="styles.panel" role="dialog" aria-label="Éditeur de blocs">
    <!-- Header -->
    <div :class="styles.header">
      <span :class="styles.selectionInfo">
        {{ count === 1 ? '1 bloc sélectionné' : `${count} blocs sélectionnés` }}
      </span>
      <button :class="styles.closeBtn" @click="emit('close')" title="Fermer (Esc)" aria-label="Fermer">
        ✕
      </button>
    </div>

    <div :class="styles.body">
      <!-- Duration section -->
      <section :class="styles.section">
        <label :class="styles.sectionLabel">Durée</label>
        <div :class="styles.durationRow">
          <span :class="styles.durationDisplay">
            {{ count === 1 ? formatDuration(selectedBlocks[0].duration) : `~${formatDuration(avgDur)}` }}
          </span>
          <div :class="styles.stepButtons">
            <button
              v-for="{ label, delta } in DURATION_STEPS"
              :key="delta"
              :class="[styles.stepBtn, delta < 0 ? styles.stepBtnNeg : styles.stepBtnPos]"
              @click="emit('durationChange', delta)"
            >
              {{ label }}
            </button>
          </div>
        </div>
      </section>

      <div :class="styles.divider" />

      <!-- Watts / Intensity section -->
      <section :class="styles.section">
        <label :class="styles.sectionLabel">Puissance</label>
        <div :class="styles.durationRow">
          <span :class="styles.wattsDisplay">
            {{ displayWatts !== null ? `${displayWatts}W` : `~${avgWatts}W` }}
          </span>
          <div :class="styles.stepButtons">
            <button
              v-for="{ label, delta } in WATTS_STEPS"
              :key="delta"
              :class="[styles.stepBtn, delta < 0 ? styles.stepBtnNeg : styles.stepBtnPos]"
              @click="handleWattsDelta(delta)"
            >
              {{ label }}
            </button>
          </div>
        </div>
      </section>

      <div :class="styles.divider" />

      <!-- Zone section -->
      <section :class="styles.section">
        <label :class="styles.sectionLabel">Zone</label>
        <div :class="styles.zoneChips">
          <button
            v-for="zone in ZONES"
            :key="zone"
            :class="[styles.zoneChip, currentZone === zone ? styles.zoneChipActive : '']"
            :style="{
              '--chip-bg':     ZONE_CONFIG[zone].bg,
              '--chip-border': ZONE_CONFIG[zone].border,
              '--chip-color':  ZONE_CONFIG[zone].color,
            }"
            @click="emit('zoneChange', zone)"
            :title="ZONE_CONFIG[zone].label"
            :aria-pressed="currentZone === zone"
          >
            {{ ZONE_CONFIG[zone].label }}
          </button>
        </div>
        <p v-if="mixedZones" :class="styles.mixedHint">Zones mixtes — choisissez pour uniformiser</p>
      </section>

      <div :class="styles.divider" />

      <!-- Actions -->
      <section :class="styles.actions">
        <button
          :class="[styles.actionBtn, styles.actionDuplicate]"
          @click="emit('duplicate')"
          title="Dupliquer (Ctrl+D)"
        >
          <span :class="styles.actionIcon">⎘</span>
          Dupliquer
        </button>
        <button
          :class="[styles.actionBtn, styles.actionDelete]"
          @click="emit('delete')"
          title="Supprimer (Suppr)"
        >
          <span :class="styles.actionIcon">🗑</span>
          Supprimer
        </button>
      </section>
    </div>
  </div>
</template>
