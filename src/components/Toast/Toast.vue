<script setup lang="ts">
import styles from './Toast.module.css'

defineProps<{
  message: string
}>()
</script>

<template>
  <div :class="styles.toast">
    <span :class="styles.icon">✓</span>
    <span :class="styles.message">{{ message }}</span>
  </div>
</template>
