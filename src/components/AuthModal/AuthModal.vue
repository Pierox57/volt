<script setup lang="ts">
import { ref } from 'vue'
import styles from './AuthModal.module.css'

const props = defineProps<{
  initialMode?: 'signup' | 'login'
}>()

const emit = defineEmits<{
  success: []
  close: []
}>()

const mode     = ref<'signup' | 'login'>(props.initialMode ?? 'signup')
const email    = ref('')
const password = ref('')
const loading  = ref(false)
const errorMsg = ref('')

async function handleSubmit() {
  if (!email.value || !password.value) {
    errorMsg.value = 'Remplis tous les champs.'
    return
  }
  errorMsg.value = ''
  loading.value  = true
  /* Mock auth — 800 ms */
  await new Promise<void>((resolve) => setTimeout(resolve, 800))
  loading.value = false
  emit('success')
}
</script>

<template>
  <div :class="styles.backdrop" @click.self="emit('close')">
    <div :class="styles.modal">
      <button :class="styles.closeBtn" aria-label="Fermer" @click="emit('close')">✕</button>

      <h2 :class="styles.title">
        {{ mode === 'signup' ? 'Créer un compte' : 'Se connecter' }}
      </h2>
      <p :class="styles.subtitle">
        {{ mode === 'signup' ? 'Pour sauvegarder et envoyer tes workouts' : 'Bon retour 👋' }}
      </p>

      <form :class="styles.form" @submit.prevent="handleSubmit">
        <div :class="styles.field">
          <label :class="styles.label">Email</label>
          <input
            v-model="email"
            :class="styles.input"
            type="email"
            placeholder="ton@email.com"
            autocomplete="email"
          />
        </div>
        <div :class="styles.field">
          <label :class="styles.label">Mot de passe</label>
          <input
            v-model="password"
            :class="styles.input"
            type="password"
            placeholder="••••••••"
            autocomplete="current-password"
          />
        </div>

        <p v-if="errorMsg" :class="styles.error">{{ errorMsg }}</p>

        <button :class="styles.submitBtn" type="submit" :disabled="loading">
          <span v-if="loading">Connexion…</span>
          <span v-else>{{ mode === 'signup' ? 'Créer mon compte' : 'Se connecter' }}</span>
        </button>
      </form>

      <p :class="styles.switchRow">
        <template v-if="mode === 'signup'">
          <span>J'ai déjà un compte</span>
          <button :class="styles.linkBtn" type="button" @click="mode = 'login'">
            Se connecter
          </button>
        </template>
        <template v-else>
          <span>Pas encore de compte ?</span>
          <button :class="styles.linkBtn" type="button" @click="mode = 'signup'">
            Créer un compte
          </button>
        </template>
      </p>
    </div>
  </div>
</template>
