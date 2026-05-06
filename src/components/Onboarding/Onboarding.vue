<script setup lang="ts">
import { ref, computed } from 'vue'
import styles from './Onboarding.module.css'

const emit = defineEmits<{
  complete: [data: {
    discipline: string | null
    ftp: number | null
    fcMax: number | null
    materiel: string | null
    poids: number | null
  }]
}>()

/* ─── Questions ─────────────────────────────────────────────────────────── */
interface CardQuestion {
  id: string
  text: string
  type: 'cards'
  options: string[]
}
interface NumberQuestion {
  id: string
  text: string
  type: 'number'
  unit: string
  skipLabel: string
}
type Question = CardQuestion | NumberQuestion

const questions: Question[] = [
  {
    id: 'discipline',
    text: "Tu t'entraînes plutôt sur route, home trainer, ou les deux ?",
    type: 'cards',
    options: ['Route', 'Home trainer', 'Les deux'],
  },
  {
    id: 'ftp',
    text: 'Tu connais ton FTP ? (même approximatif)',
    type: 'number',
    unit: 'watts',
    skipLabel: 'Je ne sais pas',
  },
  {
    id: 'fcMax',
    text: 'Et ta fréquence cardiaque max ?',
    type: 'number',
    unit: 'bpm',
    skipLabel: 'Je ne sais pas',
  },
  {
    id: 'materiel',
    text: 'Tu rides avec quoi ?',
    type: 'cards',
    options: ['Garmin', 'Wahoo', 'Autre', 'Je ne sais pas encore'],
  },
  {
    id: 'poids',
    text: 'Ton poids ? (pour calculer les watts/kg)',
    type: 'number',
    unit: 'kg',
    skipLabel: 'Je préfère skipper',
  },
]

/* ─── State ─────────────────────────────────────────────────────────────── */
const currentIdx = ref(0)
const numInput   = ref('')
const answers    = ref<Record<string, string | number | null>>({
  discipline: null,
  ftp:        null,
  fcMax:      null,
  materiel:   null,
  poids:      null,
})

const currentQuestion = computed(() => questions[currentIdx.value])
const isLast          = computed(() => currentIdx.value === questions.length - 1)
const progress        = computed(() => (currentIdx.value / questions.length) * 100)

/* ─── Navigation ─────────────────────────────────────────────────────────── */
function advance() {
  if (isLast.value) {
    finish()
  } else {
    numInput.value = ''
    currentIdx.value++
  }
}

function selectCard(option: string) {
  answers.value[currentQuestion.value.id] = option
  advance()
}

function submitNumber() {
  const val = parseFloat(numInput.value)
  answers.value[currentQuestion.value.id] = isNaN(val) ? null : val
  advance()
}

function skipQuestion() {
  answers.value[currentQuestion.value.id] = null
  advance()
}

function numberPlaceholder(id: string): string {
  const examples: Record<string, string> = { ftp: '250', fcMax: '185', poids: '70' }
  return `Ex. ${examples[id] ?? '0'}`
}

function finish() {
  emit('complete', {
    discipline: answers.value.discipline as string | null,
    ftp:        answers.value.ftp        as number | null,
    fcMax:      answers.value.fcMax      as number | null,
    materiel:   answers.value.materiel   as string | null,
    poids:      answers.value.poids      as number | null,
  })
}
</script>

<template>
  <div :class="styles.screen">
    <!-- Brand -->
    <div :class="styles.brand">
      <span :class="styles.brandIcon">⚡</span>
      <span :class="styles.brandName">VOLT</span>
    </div>

    <!-- Progress bar -->
    <div :class="styles.progressBar">
      <div :class="styles.progressFill" :style="{ width: `${progress}%` }" />
    </div>

    <!-- Question area (transition) -->
    <div :class="styles.questionWrapper">
      <Transition name="q-slide" mode="out-in">
        <div :key="currentIdx" :class="styles.question">

          <!-- Question text -->
          <p :class="styles.questionText">{{ currentQuestion.text }}</p>

          <!-- Cards layout -->
          <div
            v-if="currentQuestion.type === 'cards'"
            :class="styles.cards"
          >
            <button
              v-for="opt in (currentQuestion as CardQuestion).options"
              :key="opt"
              :class="styles.card"
              @click="selectCard(opt)"
            >
              {{ opt }}
            </button>
          </div>

          <!-- Number input layout -->
          <div
            v-else-if="currentQuestion.type === 'number'"
            :class="styles.numberArea"
          >
            <div :class="styles.inputRow">
              <input
                v-model="numInput"
                :class="styles.numInput"
                type="number"
                min="0"
                :placeholder="numberPlaceholder(currentQuestion.id)"
                @keydown.enter="submitNumber"
              />
              <span :class="styles.unit">{{ (currentQuestion as NumberQuestion).unit }}</span>
            </div>
            <button :class="styles.continueBtn" @click="submitNumber">Continuer</button>
            <button :class="styles.skipNumberBtn" @click="skipQuestion">
              {{ (currentQuestion as NumberQuestion).skipLabel }}
            </button>
          </div>

        </div>
      </Transition>
    </div>

    <!-- Global skip (always visible) -->
    <button :class="styles.globalSkip" @click="skipQuestion">Passer</button>

    <!-- Step indicator -->
    <p :class="styles.stepIndicator">{{ currentIdx + 1 }} / {{ questions.length }}</p>
  </div>
</template>

<style>
.q-slide-enter-active,
.q-slide-leave-active {
  transition: opacity 0.25s var(--ease-out), transform 0.25s var(--ease-out);
}
.q-slide-enter-from {
  opacity: 0;
  transform: translateX(32px);
}
.q-slide-leave-to {
  opacity: 0;
  transform: translateX(-32px);
}
</style>
