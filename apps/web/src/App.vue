<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { api } from "./lib/api";
import { clearSession, refreshSession, sessionState } from "./lib/session";

const { t, locale } = useI18n();
const router = useRouter();
function toggleLocale() {
  locale.value = locale.value === "zh-CN" ? "en" : "zh-CN";
}
async function signOut() {
  await api.logout();
  clearSession();
  await router.push("/login");
}
refreshSession();
</script>

<template>
  <div class="app-shell">
    <header class="topbar">
      <RouterLink class="brand" to="/dashboard"
        ><span class="brand-mark">G</span
        ><span
          ><strong>{{ t("brand") }}</strong
          ><small>{{ t("brandSub") }}</small></span
        ></RouterLink
      >
      <nav v-if="sessionState.user" class="top-actions">
        <RouterLink to="/dashboard">{{ t("dashboard") }}</RouterLink
        ><button class="text-button" @click="toggleLocale">
          {{ locale === "zh-CN" ? "EN" : "中文" }}</button
        ><button class="text-button" @click="signOut">{{ t("signOut") }}</button>
      </nav>
      <button v-else class="text-button" @click="toggleLocale">
        {{ locale === "zh-CN" ? "EN" : "中文" }}
      </button>
    </header>
    <main><RouterView /></main>
    <footer>
      <span>GitEdge · {{ t("brand") }}</span
      ><span>{{ t("edge") }}</span>
    </footer>
  </div>
</template>
