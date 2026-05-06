<script setup lang="ts">
import { ref } from 'vue'
import styles from './PaywallModal.module.css'

const emit = defineEmits<{
  activated: []
  close: []
}>()

const loading = ref(false)

async function activate() {
  loading.value = true
  /* Mock activation */
  await new Promise<void>((resolve) => setTimeout(resolve, 800))
  loading.value = false
  emit('activated')
}
</script>

<template>
  <div :class="styles.backdrop" @click.self="emit('close')">
    <div :class="styles.modal">
      <button :class="styles.closeBtn" aria-label="Fermer" @click="emit('close')">✕</button>

      <div :class="styles.header">
        <span :class="styles.badge">⚡ VOLT Sync</span>
        <h2 :class="styles.title">Synchronise tes workouts</h2>
        <p :class="styles.subtitle">Envoie directement sur ton compteur, sans fil</p>
      </div>

      <div :class="styles.priceBlock">
        <span :class="styles.priceAmount">9€</span>
        <span :class="styles.priceUnit">/mois</span>
      </div>

      <ul :class="styles.features">
        <li :class="styles.feature">
          <span :class="styles.featureIcon">✓</span>
          Sync Garmin Connect
        </li>
        <li :class="styles.feature">
          <span :class="styles.featureIcon">✓</span>
          Sync Wahoo Cloud
        </li>
        <li :class="styles.feature">
          <span :class="styles.featureIcon">✓</span>
          Export FIT
        </li>
      </ul>

      <button :class="styles.ctaBtn" :disabled="loading" @click="activate">
        <span v-if="loading">Activation…</span>
        <span v-else>S'abonner — 9€/mois</span>
      </button>

      <p :class="styles.legal">Annulable à tout moment.</p>
    </div>
  </div>
</template>
