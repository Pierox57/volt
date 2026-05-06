import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useUserStore = defineStore('user', () => {
  /* ─── State ─────────────────────────────────────────────────────────── */
  const isAuthenticated = ref(false)
  const isPremium       = ref(false)
  const garminConnected = ref(false)
  const wahooConnected  = ref(false)
  const ftp             = ref<number | null>(null)
  const fcMax           = ref<number | null>(null)
  const poids           = ref<number | null>(null)
  const materiel        = ref<string | null>(null)
  const discipline      = ref<string | null>(null)

  /* ─── Actions ────────────────────────────────────────────────────────── */
  function login() {
    isAuthenticated.value = true
  }

  function activatePremium() {
    isPremium.value = true
  }

  function connectGarmin() {
    garminConnected.value = true
  }

  function connectWahoo() {
    wahooConnected.value = true
  }

  function saveOnboarding(data: {
    ftp?: number | null
    fcMax?: number | null
    poids?: number | null
    materiel?: string | null
    discipline?: string | null
  }) {
    if (data.ftp       !== undefined) ftp.value       = data.ftp
    if (data.fcMax     !== undefined) fcMax.value     = data.fcMax
    if (data.poids     !== undefined) poids.value     = data.poids
    if (data.materiel  !== undefined) materiel.value  = data.materiel
    if (data.discipline !== undefined) discipline.value = data.discipline
  }

  return {
    /* state */
    isAuthenticated,
    isPremium,
    garminConnected,
    wahooConnected,
    ftp,
    fcMax,
    poids,
    materiel,
    discipline,
    /* actions */
    login,
    activatePremium,
    connectGarmin,
    connectWahoo,
    saveOnboarding,
  }
})
