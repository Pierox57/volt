<script setup lang="ts">
import { ref } from 'vue'
import styles from './DeviceModal.module.css'

const emit = defineEmits<{
  done: [device: 'garmin' | 'wahoo']
  close: []
}>()

const step            = ref<'choose' | 'loading'>('choose')
const selectedDevice  = ref<'garmin' | 'wahoo' | null>(null)

async function connectDevice(device: 'garmin' | 'wahoo') {
  selectedDevice.value = device
  step.value           = 'loading'
  /* Mock OAuth redirect — 1.5 s */
  await new Promise<void>((resolve) => setTimeout(resolve, 1500))
  emit('done', device)
}

const deviceLabel = (d: 'garmin' | 'wahoo') => (d === 'garmin' ? 'Garmin' : 'Wahoo')
</script>

<template>
  <div :class="styles.backdrop" @click.self="emit('close')">
    <div :class="styles.modal">
      <Transition name="step-fade" mode="out-in">

        <!-- Step: choose device -->
        <div v-if="step === 'choose'" key="choose" :class="styles.body">
          <button :class="styles.closeBtn" aria-label="Fermer" @click="emit('close')">✕</button>

          <h2 :class="styles.title">Connecter ton compteur</h2>
          <p :class="styles.subtitle">
            Sync tes workouts directement depuis VOLT
          </p>

          <div :class="styles.cards">
            <!-- Garmin -->
            <div :class="styles.deviceCard">
              <div :class="styles.deviceIcon">⌚</div>
              <div :class="styles.deviceName">Garmin Connect</div>
              <div :class="styles.deviceDesc">Garmin Edge, Fenix, Forerunner…</div>
              <button :class="styles.connectBtn" @click="connectDevice('garmin')">
                Connecter
              </button>
            </div>

            <!-- Wahoo -->
            <div :class="styles.deviceCard">
              <div :class="styles.deviceIcon">📡</div>
              <div :class="styles.deviceName">Wahoo Cloud</div>
              <div :class="styles.deviceDesc">ELEMNT, BOLT, ROAM…</div>
              <button :class="styles.connectBtn" @click="connectDevice('wahoo')">
                Connecter
              </button>
            </div>
          </div>
        </div>

        <!-- Step: OAuth loading -->
        <div v-else key="loading" :class="styles.loadingBody">
          <div :class="styles.spinner" />
          <p :class="styles.loadingText">
            Connexion à {{ selectedDevice ? deviceLabel(selectedDevice) : '' }} en cours…
          </p>
          <p :class="styles.loadingHint">Tu vas être redirigé automatiquement</p>
        </div>

      </Transition>
    </div>
  </div>
</template>

<style>
.step-fade-enter-active,
.step-fade-leave-active {
  transition: opacity 0.2s var(--ease-out);
}
.step-fade-enter-from,
.step-fade-leave-to {
  opacity: 0;
}
</style>
