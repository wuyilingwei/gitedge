<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRoute, useRouter } from "vue-router";
import { api } from "../lib/api";
import { setSession } from "../lib/session";
const { t } = useI18n();
const route = useRoute();
const router = useRouter();
const register = computed(() => route.path === "/register");
const identifier = ref("");
const password = ref("");
const error = ref("");
const busy = ref(false);
async function submit() {
  busy.value = true;
  error.value = "";
  try {
    const user = register.value
      ? await api.register({ identifier: identifier.value, password: password.value })
      : await api.login({ identifier: identifier.value, password: password.value });
    setSession(user);
    await router.push(String(route.query.redirect || "/dashboard"));
  } catch {
    error.value = t("apiError");
  } finally {
    busy.value = false;
  }
}
</script>
<template>
  <section class="auth-layout">
    <div class="auth-intro">
      <p class="eyebrow">{{ t("brandSub") }} / {{ t("brand") }}</p>
      <h1>{{ t("welcome") }}</h1>
      <p>{{ t("welcomeText") }}</p>
      <div class="terminal">
        <span>~$</span> {{ t("cloneCommand") }}<br /><span>✓</span> <em>{{ t("edge") }}</em>
      </div>
    </div>
    <form class="panel auth-card" @submit.prevent="submit">
      <div>
        <p class="eyebrow">{{ register ? t("registerStep") : t("loginStep") }}</p>
        <h2>{{ register ? t("signUp") : t("signIn") }}</h2>
        <p class="muted">{{ register ? t("registerHint") : t("loginHint") }}</p>
      </div>
      <label
        >{{ t("identifier") }}<input v-model="identifier" required autocomplete="username" /></label
      ><label
        >{{ t("password")
        }}<input
          v-model="password"
          type="password"
          required
          minlength="12"
          autocomplete="current-password"
      /></label>
      <p v-if="error" class="form-error">{{ error }}</p>
      <button class="button primary" :disabled="busy">
        {{ busy ? t("loading") : t("submit") }}
      </button>
      <p class="switch-auth">
        {{ register ? t("hasAccount") : t("needsAccount") }}
        <RouterLink :to="register ? '/login' : '/register'">{{
          register ? t("signIn") : t("signUp")
        }}</RouterLink>
      </p>
    </form>
  </section>
</template>
