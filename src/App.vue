<!-- MIGRATED from: App.tsx -->
<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute, useRouter, RouterView, RouterLink } from 'vue-router'
import AuthModal      from '@/components/AuthModal/AuthModal.vue'
import Onboarding     from '@/components/Onboarding/Onboarding.vue'
import DeviceModal    from '@/components/DeviceModal/DeviceModal.vue'
import PaywallModal   from '@/components/PaywallModal/PaywallModal.vue'
import ZoneSettings   from '@/components/ZoneSettings/ZoneSettings.vue'
import Toast          from '@/components/Toast/Toast.vue'
import { useWorkoutStore } from '@/stores/workout'
import { useUserStore }    from '@/stores/user'
import { computeZonesFromFTP } from '@/zones'
import styles from './App.module.css'

const store     = useWorkoutStore()
const userStore = useUserStore()
const route     = useRoute()
const router    = useRouter()

const isEditor = computed(() => route.path === '/')

/* ─── Flow state ─────────────────────────────────────────────────────────── */
type FlowStep = null | 'auth' | 'onboarding' | 'device' | 'paywall'
const flowStep   = ref<FlowStep>(null)
const toastMsg   = ref<string | null>(null)
let   toastTimer: ReturnType<typeof setTimeout> | null = null

/* ─── Open modal from query param (used by router guard redirect) ─────────── */
watch(
  () => route.query.modal,
  (modal) => {
    if (modal === 'auth')    flowStep.value = 'auth'
    if (modal === 'paywall') flowStep.value = 'paywall'
    if (modal) router.replace({ query: {} })
  },
  { immediate: true },
)

/* ─── Toast helper ───────────────────────────────────────────────────────── */
function showToast(msg: string, delayMs = 0) {
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toastMsg.value = msg
    toastTimer = setTimeout(() => {
      toastMsg.value = null
      toastTimer = null
    }, 3000)
  }, delayMs)
}

/* ─── Format helper ─────────────────────────────────────────────────────── */
function formatTotal(s: number): string {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`
  return `${m}min`
}

/* ─── Toolbar button label ──────────────────────────────────────────────── */
const sendButtonLabel = computed(() => {
  const m = userStore.materiel
  if (m === 'Garmin' || m === 'Wahoo') return `↑ Envoyer vers ${m}`
  return '↑ Envoyer vers mon compteur'
})

/* ─── Main send handler ─────────────────────────────────────────────────── */
function handleSendToDevice() {
  if (!userStore.isAuthenticated) {
    flowStep.value = 'auth'
    return
  }
  /* Already connected + premium → send directly */
  if (userStore.isPremium && (userStore.garminConnected || userStore.wahooConnected)) {
    const device = userStore.garminConnected ? 'Garmin' : 'Wahoo'
    showToast(`Workout envoyé vers ton ${device}`, 1000)
    return
  }
  flowStep.value = 'device'
}

/* ─── Auth modal events ─────────────────────────────────────────────────── */
async function onAuthSuccess() {
  userStore.login()
  await store.persistToCloud()
  flowStep.value = 'onboarding'
}

/* ─── Onboarding events ─────────────────────────────────────────────────── */
function onOnboardingComplete(data: {
  discipline: string | null
  ftp: number | null
  fcMax: number | null
  materiel: string | null
  poids: number | null
}) {
  userStore.saveOnboarding(data)

  /* If FTP was provided, update the zone system to show real watts */
  if (data.ftp && data.ftp > 0) {
    store.setZoneSystem({
      mode:  'ftp',
      ftp:   data.ftp,
      /* PMA ≈ FTP / 0.75 — standard Coggan power-duration ratio */
      pma:   Math.round(data.ftp / 0.75),
      hrmax: data.fcMax ?? store.zoneSystem.hrmax,
      zones: computeZonesFromFTP(data.ftp),
    })
  }

  flowStep.value = null
  showToast('Workout sauvegardé sur ton compte ✓')
}

/* ─── Device modal events ───────────────────────────────────────────────── */
function onDeviceDone(device: 'garmin' | 'wahoo') {
  if (device === 'garmin') userStore.connectGarmin()
  else                     userStore.connectWahoo()

  if (userStore.isPremium) {
    flowStep.value = null
    const label = device === 'garmin' ? 'Garmin' : 'Wahoo'
    showToast(`Workout envoyé vers ton ${label}`, 1000)
  } else {
    flowStep.value = 'paywall'
  }
}

/* ─── Paywall modal events ──────────────────────────────────────────────── */
function onPaywallActivated() {
  userStore.activatePremium()
  flowStep.value = null
  const device = userStore.garminConnected ? 'Garmin' : 'Wahoo'
  showToast(`Workout envoyé vers ton ${device}`, 1000)
}
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

      <!-- Editor stats (only on editor page) -->
      <div v-if="isEditor" :class="styles.stats">
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
      <div v-else :class="styles.stats" />

      <div :class="styles.headerActions">
        <!-- Nav link to workouts (premium only) -->
        <RouterLink
          v-if="userStore.isAuthenticated && userStore.isPremium"
          to="/workouts"
          :class="styles.navLink"
          active-class=""
        >
          Mes workouts
        </RouterLink>

        <!-- Zone settings (editor only) -->
        <ZoneSettings
          v-if="isEditor"
          :zone-system="store.zoneSystem"
          @zone-system-change="store.setZoneSystem"
        />

        <!-- Send to device button (editor only) -->
        <button v-if="isEditor" :class="styles.btnPrimary" @click="handleSendToDevice">
          {{ sendButtonLabel }}
        </button>
      </div>
    </header>

    <!-- Routed content -->
    <RouterView />

    <!-- ── Flow modals / screens ────────────────────────────────────────── -->

    <!-- Auth modal (signup / login) -->
    <AuthModal
      v-if="flowStep === 'auth'"
      @success="onAuthSuccess"
      @close="flowStep = null"
    />

    <!-- Onboarding full-screen -->
    <Onboarding
      v-if="flowStep === 'onboarding'"
      @complete="onOnboardingComplete"
    />

    <!-- Device connection modal -->
    <DeviceModal
      v-if="flowStep === 'device'"
      @done="onDeviceDone"
      @close="flowStep = null"
    />

    <!-- Paywall modal -->
    <PaywallModal
      v-if="flowStep === 'paywall'"
      @activated="onPaywallActivated"
      @close="flowStep = null"
    />

    <!-- Toast notification -->
    <Transition name="toast">
      <div v-if="toastMsg" :class="styles.toastWrapper">
        <Toast :message="toastMsg" />
      </div>
    </Transition>
  </div>
</template>

<style>
/* Toast transition — global because Transition applies classes to the wrapper */
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.25s var(--ease-out), transform 0.25s var(--ease-out);
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
