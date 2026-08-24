<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { api, type Repository } from "../lib/api";
import StatusState from "../components/StatusState.vue";

const { t, locale } = useI18n();
const repos = ref<Repository[]>([]);
const loading = ref(true);
const error = ref("");
const showForm = ref(false);
const saving = ref(false);
const formError = ref("");
const form = ref({ name: "", description: "", visibility: "private" as "public" | "private" });

function formatUpdatedAt(value: number): string {
  return new Intl.DateTimeFormat(locale.value, { dateStyle: "medium" }).format(value);
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    repos.value = await api.repositories();
  } catch {
    error.value = t("apiError");
  } finally {
    loading.value = false;
  }
}

async function createRepository() {
  saving.value = true;
  formError.value = "";
  try {
    await api.createRepository(form.value);
    form.value = { name: "", description: "", visibility: "private" };
    showForm.value = false;
    await load();
  } catch {
    formError.value = t("apiError");
  } finally {
    saving.value = false;
  }
}

onMounted(load);
</script>

<template>
  <section class="page">
    <div class="page-heading">
      <div>
        <p class="eyebrow">{{ t("dashboard") }} / 01</p>
        <h1>{{ t("repositories") }}</h1>
      </div>
      <button class="button primary" @click="showForm = !showForm">+ {{ t("newRepo") }}</button>
    </div>
    <form v-if="showForm" class="panel create-form" @submit.prevent="createRepository">
      <label>{{ t("repositoryName") }}<input v-model="form.name" required /></label>
      <label>{{ t("description") }}<input v-model="form.description" /></label>
      <label
        >{{ t("visibility")
        }}<select v-model="form.visibility">
          <option value="private">{{ t("private") }}</option>
          <option value="public">{{ t("public") }}</option>
        </select></label
      >
      <p v-if="formError" class="form-error">{{ formError }}</p>
      <div class="form-actions">
        <button type="button" class="button ghost" @click="showForm = false">
          {{ t("cancel") }}</button
        ><button class="button primary" :disabled="saving">
          {{ saving ? t("loading") : t("create") }}
        </button>
      </div>
    </form>
    <div class="rule" />
    <StatusState
      :loading="loading"
      :error="error"
      :empty="!loading && !error && !repos.length"
      @retry="load"
    />
    <div v-if="!loading && !error" class="repo-list">
      <RouterLink
        v-for="repo in repos"
        :key="repo.id"
        class="repo-row"
        :to="`/${repo.owner}/${repo.name}`"
      >
        <div class="repo-icon">{{ repo.name.slice(0, 1).toUpperCase() }}</div>
        <div class="repo-copy">
          <h3>
            {{ repo.owner }} / <strong>{{ repo.name }}</strong
            ><span :class="['badge', repo.visibility]">{{
              repo.visibility === "private" ? t("private") : t("public")
            }}</span>
          </h3>
          <p>{{ repo.description || t("noDescription") }}</p>
        </div>
        <div class="repo-meta">
          <code>{{ repo.defaultBranch }}</code
          ><span>{{ formatUpdatedAt(repo.updatedAt) }}</span
          ><span class="arrow">→</span>
        </div>
      </RouterLink>
    </div>
  </section>
</template>
