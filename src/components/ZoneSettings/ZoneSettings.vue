<!-- MIGRATED from: ZoneSettings/index.tsx -->
<script setup lang="ts">
/**
 * ZoneSettings – compact panel to configure the zone calculation mode and key values.
 */
import { ref } from 'vue'
import type { ZoneSystem, CalcMode } from '@/zones'
import { recomputeZones } from '@/zones'
import styles from './ZoneSettings.module.css'

const props = defineProps<{
  zoneSystem: ZoneSystem
}>()

const emit = defineEmits<{
  zoneSystemChange: [sys: ZoneSystem]
}>()

const MODE_LABELS: Record<CalcMode, string> = {
  ftp:    'FTP',
  pma:    'PMA',
  hrmax:  'FC max',
  manual: 'Manuel',
}

const CALC_MODES: CalcMode[] = ['ftp', 'pma', 'hrmax', 'manual']

const open = ref(false)

function handleModeChange(mode: CalcMode) {
  const next: ZoneSystem = { ...props.zoneSystem, mode }
  emit('zoneSystemChange', { ...next, zones: recomputeZones(next) })
}

function handleValueChange(field: 'ftp' | 'pma' | 'hrmax', value: number) {
  const next: ZoneSystem = { ...props.zoneSystem, [field]: value }
  emit('zoneSystemChange', { ...next, zones: recomputeZones(next) })
}
</script>

<template>
  <div :class="styles.container">
    <button
      :class="styles.toggleBtn"
      @click="open = !open"
      title="Configurer les zones"
    >
      <span :class="styles.toggleIcon">⚙</span>
      <span :class="styles.toggleLabel">Zones</span>
      <span :class="styles.modeBadge">{{ MODE_LABELS[zoneSystem.mode] }}</span>
      <span :class="styles.arrow">{{ open ? '▲' : '▼' }}</span>
    </button>

    <div v-if="open" :class="styles.panel">
      <!-- Mode selector -->
      <div :class="styles.row">
        <span :class="styles.fieldLabel">Mode</span>
        <div :class="styles.modeChips">
          <button
            v-for="m in CALC_MODES"
            :key="m"
            :class="[styles.modeChip, zoneSystem.mode === m ? styles.modeChipActive : '']"
            @click="handleModeChange(m)"
          >
            {{ MODE_LABELS[m] }}
          </button>
        </div>
      </div>

      <!-- FTP input -->
      <div
        v-if="zoneSystem.mode === 'ftp' || zoneSystem.mode === 'manual'"
        :class="styles.row"
      >
        <label :class="styles.fieldLabel" for="ftp-input">FTP (W)</label>
        <input
          id="ftp-input"
          type="number"
          :class="styles.numberInput"
          :value="zoneSystem.ftp"
          min="50"
          max="600"
          step="5"
          @change="handleValueChange('ftp', Number(($event.target as HTMLInputElement).value))"
        />
      </div>

      <!-- PMA input -->
      <div v-if="zoneSystem.mode === 'pma'" :class="styles.row">
        <label :class="styles.fieldLabel" for="pma-input">PMA (W)</label>
        <input
          id="pma-input"
          type="number"
          :class="styles.numberInput"
          :value="zoneSystem.pma"
          min="50"
          max="800"
          step="5"
          @change="handleValueChange('pma', Number(($event.target as HTMLInputElement).value))"
        />
      </div>

      <!-- HRmax input -->
      <div v-if="zoneSystem.mode === 'hrmax'" :class="styles.row">
        <label :class="styles.fieldLabel" for="hrmax-input">FC max (bpm)</label>
        <input
          id="hrmax-input"
          type="number"
          :class="styles.numberInput"
          :value="zoneSystem.hrmax"
          min="100"
          max="220"
          step="1"
          @change="handleValueChange('hrmax', Number(($event.target as HTMLInputElement).value))"
        />
      </div>

      <!-- Zone summary -->
      <div :class="styles.zoneSummary">
        <div v-for="(z, i) in zoneSystem.zones" :key="i" :class="styles.zoneRow">
          <span :class="styles.zoneKey">Z{{ i + 1 }}</span>
          <span
            :class="styles.zoneRange"
            :aria-label="`${z.min} à ${z.max}`"
          >
            {{ z.min }}-{{ z.max }}
          </span>
          <span :class="styles.zoneUnit">
            {{ zoneSystem.mode === 'hrmax' ? 'bpm' : 'W' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
