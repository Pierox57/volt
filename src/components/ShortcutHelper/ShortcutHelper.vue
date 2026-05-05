<!-- MIGRATED from: ShortcutHelper/index.tsx -->
<script setup lang="ts">
import { ref } from 'vue'
import styles from './ShortcutHelper.module.css'

const SHORTCUTS = [
  { keys: ['Suppr', 'Backspace'], action: 'Supprimer les blocs sélectionnés' },
  { keys: ['Ctrl/⌘', 'D'],        action: 'Dupliquer la sélection' },
  { keys: ['Ctrl/⌘', 'A'],        action: 'Tout sélectionner' },
  { keys: ['Shift', 'Clic'],      action: 'Sélection multiple' },
  { keys: ['Ctrl/⌘', 'Clic'],     action: 'Basculer la sélection' },
  { keys: ['Échap'],              action: 'Désélectionner tout' },
  { keys: ['Glisser'],            action: 'Réordonner les blocs' },
  { keys: ['≡', 'bord droit'],    action: 'Redimensionner la durée' },
]

const isOpen = ref(false)
</script>

<template>
  <!-- Trigger button -->
  <button
    :class="styles.trigger"
    @click="isOpen = !isOpen"
    title="Raccourcis clavier"
    aria-label="Afficher les raccourcis clavier"
    :aria-expanded="isOpen"
  >
    ?
  </button>

  <!-- Backdrop -->
  <div
    v-if="isOpen"
    :class="styles.backdrop"
    @click="isOpen = false"
    aria-hidden="true"
  />

  <!-- Panel -->
  <div
    v-if="isOpen"
    :class="styles.panel"
    role="dialog"
    aria-label="Raccourcis clavier"
  >
    <div :class="styles.header">
      <h3 :class="styles.title">Raccourcis clavier</h3>
      <button
        :class="styles.closeBtn"
        @click="isOpen = false"
        aria-label="Fermer"
      >
        ✕
      </button>
    </div>
    <ul :class="styles.list">
      <li v-for="{ keys, action } in SHORTCUTS" :key="action" :class="styles.item">
        <div :class="styles.keys">
          <kbd v-for="k in keys" :key="k" :class="styles.kbd">{{ k }}</kbd>
        </div>
        <span :class="styles.action">{{ action }}</span>
      </li>
    </ul>
    <p :class="styles.footer">
      Cliquez n'importe où dans la timeline vide pour ajouter un bloc.
    </p>
  </div>
</template>
