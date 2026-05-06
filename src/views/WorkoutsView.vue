<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useWorkoutStore } from '@/stores/workout'
import type { SavedWorkout } from '@/stores/workout'
import styles from './WorkoutsView.module.css'

const store  = useWorkoutStore()
const router = useRouter()

/* ─── Search ─────────────────────────────────────────────────────────────── */
const searchQuery = ref('')

const filteredWorkouts = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const list = [...store.savedWorkouts].sort(
    (a, b) => b.lastModified.getTime() - a.lastModified.getTime(),
  )
  if (!q) return list
  return list.filter((w) => w.name.toLowerCase().includes(q))
})

/* ─── Selection ──────────────────────────────────────────────────────────── */
const selectedIds = ref<Set<string>>(new Set())

const allSelected = computed(
  () => filteredWorkouts.value.length > 0 &&
    filteredWorkouts.value.every((w) => selectedIds.value.has(w.id)),
)

function toggleSelectAll() {
  if (allSelected.value) {
    selectedIds.value = new Set()
  } else {
    selectedIds.value = new Set(filteredWorkouts.value.map((w) => w.id))
  }
}

function toggleSelect(id: string) {
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else              next.add(id)
  selectedIds.value = next
}

/* ─── Context menu ───────────────────────────────────────────────────────── */
const openMenuId      = ref<string | null>(null)
const renamingId      = ref<string | null>(null)
const renameValue     = ref('')
const deletingId      = ref<string | null>(null)
const syncingIds      = ref<Set<string>>(new Set())

function toggleMenu(id: string) {
  openMenuId.value = openMenuId.value === id ? null : id
}

function closeMenu() {
  openMenuId.value = null
}

function openInEditor(workout: SavedWorkout) {
  closeMenu()
  store.loadWorkout(workout.id)
  router.push('/')
}

function startRename(workout: SavedWorkout) {
  closeMenu()
  renamingId.value  = workout.id
  renameValue.value = workout.name
}

function commitRename(id: string) {
  const name = renameValue.value.trim()
  if (name) store.renameWorkout(id, name)
  renamingId.value = null
}

function cancelRename() {
  renamingId.value = null
}

function duplicate(id: string) {
  closeMenu()
  store.duplicateWorkout(id)
}

async function syncOne(id: string) {
  closeMenu()
  const next = new Set(syncingIds.value)
  next.add(id)
  syncingIds.value = next
  await store.syncWorkout(id)
  const after = new Set(syncingIds.value)
  after.delete(id)
  syncingIds.value = after
}

function startDelete(id: string) {
  closeMenu()
  deletingId.value = id
}

function confirmDelete(id: string) {
  store.deleteWorkout(id)
  selectedIds.value.delete(id)
  deletingId.value = null
}

function cancelDelete() {
  deletingId.value = null
}

/* ─── Bulk actions ───────────────────────────────────────────────────────── */
const bulkDeleteConfirm = ref(false)

async function bulkSync() {
  const ids = [...selectedIds.value]
  ids.forEach((id) => {
    const next = new Set(syncingIds.value)
    next.add(id)
    syncingIds.value = next
  })
  await store.syncSavedWorkouts(ids)
  ids.forEach((id) => {
    const next = new Set(syncingIds.value)
    next.delete(id)
    syncingIds.value = next
  })
}

function confirmBulkDelete() {
  store.deleteSavedWorkouts([...selectedIds.value])
  selectedIds.value   = new Set()
  bulkDeleteConfirm.value = false
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `${h}h${m.toString().padStart(2, '0')}`
  return `${m}min`
}

function formatDate(date: Date): string {
  const now     = Date.now()
  const diffMs  = now - date.getTime()
  const diffDay = Math.floor(diffMs / 86400_000)
  if (diffDay === 0) return "Aujourd'hui"
  if (diffDay === 1) return 'Hier'
  if (diffDay < 7)   return `Il y a ${diffDay} j`
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function syncIcon(status: SavedWorkout['syncStatus']): string {
  if (status === 'synced')  return '✓'
  if (status === 'pending') return '⟳'
  return '–'
}

function syncLabel(status: SavedWorkout['syncStatus']): string {
  if (status === 'synced')  return 'Synchronisé'
  if (status === 'pending') return 'En attente'
  return 'Non synchronisé'
}
</script>

<template>
  <div :class="styles.page">
    <!-- Page header -->
    <div :class="styles.pageHeader">
      <div>
        <h1 :class="styles.pageTitle">Mes workouts</h1>
        <p :class="styles.pageSubtitle">{{ store.savedWorkouts.length }} workout{{ store.savedWorkouts.length !== 1 ? 's' : '' }} sauvegardé{{ store.savedWorkouts.length !== 1 ? 's' : '' }}</p>
      </div>
      <input
        v-model="searchQuery"
        :class="styles.searchInput"
        type="search"
        placeholder="🔍 Rechercher un workout…"
        aria-label="Rechercher un workout"
      />
    </div>

    <!-- Empty state -->
    <div v-if="store.savedWorkouts.length === 0" :class="styles.empty">
      <div :class="styles.emptyIllustration">⚡</div>
      <p :class="styles.emptyTitle">Aucun workout pour l'instant</p>
      <p :class="styles.emptySubtitle">Crée ton premier workout dans l'éditeur</p>
      <button :class="styles.emptyBtn" @click="router.push('/')">
        Créer mon premier workout
      </button>
    </div>

    <!-- Workout list -->
    <div v-else :class="styles.tableWrapper">
      <table :class="styles.table">
        <thead>
          <tr>
            <th :class="styles.thCheck">
              <input
                type="checkbox"
                :checked="allSelected"
                :indeterminate="selectedIds.size > 0 && !allSelected"
                @change="toggleSelectAll"
                aria-label="Tout sélectionner"
              />
            </th>
            <th :class="styles.thName">Nom</th>
            <th :class="styles.thStat">Durée</th>
            <th :class="styles.thStat">TSS est.</th>
            <th :class="styles.thDate">Modifié</th>
            <th :class="styles.thSync">Garmin</th>
            <th :class="styles.thActions" />
          </tr>
        </thead>
        <TransitionGroup name="row" tag="tbody">
          <tr
            v-for="workout in filteredWorkouts"
            :key="workout.id"
            :class="[styles.row, selectedIds.has(workout.id) && styles.rowSelected]"
          >
            <!-- Checkbox -->
            <td :class="styles.tdCheck">
              <input
                type="checkbox"
                :checked="selectedIds.has(workout.id)"
                @change="toggleSelect(workout.id)"
                :aria-label="`Sélectionner ${workout.name}`"
              />
            </td>

            <!-- Name (with inline rename) -->
            <td :class="styles.tdName">
              <template v-if="renamingId === workout.id">
                <input
                  v-model="renameValue"
                  :class="styles.renameInput"
                  type="text"
                  autofocus
                  @blur="commitRename(workout.id)"
                  @keyup.enter="commitRename(workout.id)"
                  @keyup.escape="cancelRename"
                />
              </template>
              <template v-else-if="deletingId === workout.id">
                <span :class="styles.deleteConfirmText">
                  Supprimer « {{ workout.name }} » ?
                </span>
                <div :class="styles.deleteConfirmActions">
                  <button :class="styles.btnDangerSm" @click="confirmDelete(workout.id)">Supprimer</button>
                  <button :class="styles.btnGhostSm" @click="cancelDelete">Annuler</button>
                </div>
              </template>
              <template v-else>
                <span :class="styles.workoutName">{{ workout.name }}</span>
              </template>
            </td>

            <!-- Duration -->
            <td :class="styles.tdStat">{{ formatDuration(workout.totalSeconds) }}</td>

            <!-- TSS -->
            <td :class="styles.tdStat">{{ workout.estimatedTss }}</td>

            <!-- Last modified -->
            <td :class="styles.tdDate">{{ formatDate(workout.lastModified) }}</td>

            <!-- Sync status -->
            <td :class="styles.tdSync">
              <span
                :class="[
                  styles.syncBadge,
                  styles[`sync-${workout.syncStatus}`],
                  syncingIds.has(workout.id) && styles.syncSpinning,
                ]"
                :title="syncLabel(workout.syncStatus)"
              >
                {{ syncingIds.has(workout.id) ? '⟳' : syncIcon(workout.syncStatus) }}
              </span>
            </td>

            <!-- Actions (3-dot menu) -->
            <td :class="styles.tdActions">
              <div :class="styles.menuWrapper">
                <button
                  :class="styles.menuTrigger"
                  :aria-label="`Actions pour ${workout.name}`"
                  @click.stop="toggleMenu(workout.id)"
                >
                  ···
                </button>
                <div
                  v-if="openMenuId === workout.id"
                  :class="styles.menu"
                  @click.stop
                >
                  <button :class="styles.menuItem" @click="openInEditor(workout)">
                    <span>✏️</span> Ouvrir dans l'éditeur
                  </button>
                  <button :class="styles.menuItem" @click="startRename(workout)">
                    <span>🏷️</span> Renommer
                  </button>
                  <button :class="styles.menuItem" @click="duplicate(workout.id)">
                    <span>📋</span> Dupliquer
                  </button>
                  <button :class="styles.menuItem" @click="syncOne(workout.id)" :disabled="syncingIds.has(workout.id)">
                    <span>🔄</span> Sync Garmin
                  </button>
                  <div :class="styles.menuDivider" />
                  <button :class="[styles.menuItem, styles.menuItemDanger]" @click="startDelete(workout.id)">
                    <span>🗑️</span> Supprimer
                  </button>
                </div>
              </div>
            </td>
          </tr>
        </TransitionGroup>
      </table>

      <!-- No search results -->
      <div v-if="filteredWorkouts.length === 0 && searchQuery" :class="styles.noResults">
        Aucun workout ne correspond à « {{ searchQuery }} »
      </div>
    </div>

    <!-- Bulk action bar -->
    <Transition name="bulk-bar">
      <div v-if="selectedIds.size > 0" :class="styles.bulkBar">
        <span :class="styles.bulkCount">
          {{ selectedIds.size }} sélectionné{{ selectedIds.size > 1 ? 's' : '' }}
        </span>
        <div :class="styles.bulkActions">
          <template v-if="bulkDeleteConfirm">
            <span :class="styles.bulkConfirmText">Supprimer {{ selectedIds.size }} workout{{ selectedIds.size > 1 ? 's' : '' }} ?</span>
            <button :class="styles.btnDanger" @click="confirmBulkDelete">Confirmer</button>
            <button :class="styles.btnGhost" @click="bulkDeleteConfirm = false">Annuler</button>
          </template>
          <template v-else>
            <button :class="styles.btnSecondary" @click="bulkSync">🔄 Sync Garmin</button>
            <button :class="styles.btnDanger" @click="bulkDeleteConfirm = true">🗑️ Supprimer</button>
          </template>
        </div>
      </div>
    </Transition>

    <!-- Backdrop to close open menus -->
    <div
      v-if="openMenuId !== null"
      :class="styles.menuBackdrop"
      @click="closeMenu"
    />
  </div>
</template>

<style>
/* Row transition */
.row-enter-active,
.row-leave-active {
  transition: opacity 0.2s var(--ease-out), transform 0.2s var(--ease-out);
}
.row-enter-from,
.row-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* Bulk bar transition */
.bulk-bar-enter-active,
.bulk-bar-leave-active {
  transition: opacity 0.2s var(--ease-out), transform 0.2s var(--ease-out);
}
.bulk-bar-enter-from,
.bulk-bar-leave-to {
  opacity: 0;
  transform: translateY(12px);
}
</style>
