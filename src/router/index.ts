import { createRouter, createWebHistory } from 'vue-router'
import { useUserStore } from '@/stores/user'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: () => import('@/views/EditorView.vue'),
    },
    {
      path: '/workouts',
      component: () => import('@/views/WorkoutsView.vue'),
      beforeEnter: () => {
        const userStore = useUserStore()
        if (!userStore.isAuthenticated) {
          return { path: '/', query: { modal: 'auth' } }
        }
        if (!userStore.isPremium) {
          return { path: '/', query: { modal: 'paywall' } }
        }
        return true
      },
    },
  ],
})

export default router
