<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import { api, ApiError } from '../lib/api'
const { t } = useI18n(); const route = useRoute(); const router = useRouter()
const register = computed(() => route.path === '/register'); const email = ref(''); const password = ref(''); const name = ref(''); const error = ref(''); const busy = ref(false)
async function submit() { busy.value = true; error.value = ''; try { if (register.value) await api.register({ name: name.value, email: email.value, password: password.value }); else await api.login({ email: email.value, password: password.value }); sessionStorage.setItem('gitedge:session', 'true'); router.push(String(route.query.redirect || '/dashboard')) } catch (cause) { error.value = cause instanceof ApiError && cause.status === 401 ? t('apiError') : t('apiError') } finally { busy.value = false } }
</script>
<template>
  <section class="auth-layout"><div class="auth-intro"><p class="eyebrow">GITEDGE / 码锋</p><h1>{{ t('welcome') }}</h1><p>{{ t('welcomeText') }}</p><div class="terminal"><span>~$</span> git clone edge://your-repo<br><span>✓</span> <em>{{ t('edge') }}</em></div></div><form class="panel auth-card" @submit.prevent="submit"><div><p class="eyebrow">{{ register ? '01 / ACCOUNT' : '00 / ACCESS' }}</p><h2>{{ register ? t('signUp') : t('signIn') }}</h2><p class="muted">{{ register ? t('registerHint') : t('loginHint') }}</p></div><label v-if="register">{{ t('name') }}<input v-model="name" required autocomplete="username" /></label><label>{{ t('email') }}<input v-model="email" type="email" required autocomplete="email" /></label><label>{{ t('password') }}<input v-model="password" type="password" required minlength="8" autocomplete="current-password" /></label><p v-if="error" class="form-error">{{ error }}</p><button class="button primary" :disabled="busy">{{ busy ? t('loading') : t('submit') }}</button><p class="switch-auth">{{ register ? t('signIn') : t('signUp') }} <RouterLink :to="register ? '/login' : '/register'">{{ register ? t('signIn') : t('create') }}</RouterLink></p></form></section>
</template>
