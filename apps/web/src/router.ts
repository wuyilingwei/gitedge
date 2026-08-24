import { createRouter, createWebHistory } from 'vue-router'
import AuthView from './pages/AuthView.vue'
import DashboardView from './pages/DashboardView.vue'
import RepositoryView from './pages/RepositoryView.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/login', component: AuthView, meta: { public: true } },
    { path: '/register', component: AuthView, meta: { public: true } },
    { path: '/dashboard', component: DashboardView },
    { path: '/:owner/:repo/:section(code|issues|pulls|wiki|settings)?', component: RepositoryView },
  ],
})

router.beforeEach((to) => {
  const signedIn = sessionStorage.getItem('gitedge:session') === 'true'
  if (!to.meta.public && !signedIn) return { path: '/login', query: { redirect: to.fullPath } }
  if (to.meta.public && signedIn) return '/dashboard'
})
