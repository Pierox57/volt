<script setup lang="ts">
import { ref } from 'vue'
import styles from './PaywallModal.module.css'

const emit = defineEmits<{
  activated: []
  close: []
}>()

const loading = ref(false)

async function startTrial() {
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
        <span :class="styles.badge">⚡ VOLT Premium</span>
        <h2 :class="styles.title">Sync illimitée, partout</h2>
        <p :class="styles.subtitle">14 jours gratuits, sans engagement</p>
      </div>

      <div :class="styles.plans">
        <!-- Free plan -->
        <div :class="styles.plan">
          <div :class="styles.planName">Gratuit</div>
          <div :class="styles.planPrice">0€</div>
          <ul :class="styles.features">
            <li :class="styles.feature">
              <span :class="styles.featureIcon">✓</span>
              Export ZWO
            </li>
            <li :class="styles.feature">
              <span :class="styles.featureIcon">✓</span>
              Sauvegarde cloud
            </li>
            <li :class="[styles.feature, styles.featureMuted]">
              <span :class="styles.featureIconOff">✕</span>
              Sync Garmin & Wahoo
            </li>
            <li :class="[styles.feature, styles.featureMuted]">
              <span :class="styles.featureIconOff">✕</span>
              Export FIT
            </li>
            <li :class="[styles.feature, styles.featureMuted]">
              <span :class="styles.featureIconOff">✕</span>
              Historique workouts
            </li>
          </ul>
        </div>

        <!-- Premium plan -->
        <div :class="[styles.plan, styles.planPremium]">
          <div :class="styles.planBadge">Recommandé</div>
          <div :class="styles.planName">Premium</div>
          <div :class="styles.planPrice">
            <span :class="styles.priceAmount">4,99€</span>
            <span :class="styles.priceUnit">/mois</span>
          </div>
          <ul :class="styles.features">
            <li :class="styles.feature">
              <span :class="styles.featureIcon">✓</span>
              Export ZWO
            </li>
            <li :class="styles.feature">
              <span :class="styles.featureIcon">✓</span>
              Sauvegarde cloud
            </li>
            <li :class="styles.feature">
              <span :class="styles.featureIcon">✓</span>
              Sync Garmin & Wahoo
            </li>
            <li :class="styles.feature">
              <span :class="styles.featureIcon">✓</span>
              Export FIT
            </li>
            <li :class="styles.feature">
              <span :class="styles.featureIcon">✓</span>
              Historique workouts
            </li>
          </ul>
        </div>
      </div>

      <button :class="styles.trialBtn" :disabled="loading" @click="startTrial">
        <span v-if="loading">Activation…</span>
        <span v-else>Démarrer l'essai gratuit 14 jours</span>
      </button>

      <p :class="styles.legal">Aucune carte requise. Annulable à tout moment.</p>
    </div>
  </div>
</template>
