<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { api, type Organization } from "../lib/api";
import StatusState from "../components/StatusState.vue";
const { t } = useI18n();
const organizations = ref<Organization[]>([]);
const loading = ref(true);
const error = ref("");
const formError = ref("");
const showForm = ref(false);
const saving = ref(false);
const form = ref({ slug: "", displayName: "", description: "" });
async function load() {
  loading.value = true;
  error.value = "";
  try {
    organizations.value = await api.organizations();
  } catch {
    error.value = t("apiError");
  } finally {
    loading.value = false;
  }
}
async function create() {
  saving.value = true;
  formError.value = "";
  try {
    await api.createOrganization(form.value);
    form.value = { slug: "", displayName: "", description: "" };
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
        <p class="eyebrow">{{ t("organizations") }} / 02</p>
        <h1>{{ t("organizations") }}</h1>
      </div>
      <button class="button primary" @click="showForm = !showForm">
        + {{ t("newOrganization") }}
      </button>
    </div>
    <form v-if="showForm" class="panel create-form" @submit.prevent="create">
      <label>{{ t("slug") }}<input v-model="form.slug" required /></label
      ><label>{{ t("displayName") }}<input v-model="form.displayName" required /></label
      ><label>{{ t("description") }}<textarea v-model="form.description" rows="3" /></label>
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
      :empty="!loading && !error && !organizations.length"
      @retry="load"
    />
    <div v-if="!loading && !error" class="repo-list">
      <RouterLink
        v-for="organization in organizations"
        :key="organization.slug"
        class="repo-row"
        :to="`/organizations/${organization.slug}`"
        ><div class="repo-icon">{{ organization.displayName.slice(0, 1).toUpperCase() }}</div>
        <div class="repo-copy">
          <h3>
            <strong>{{ organization.displayName }}</strong>
          </h3>
          <p>{{ organization.description || t("noDescription") }}</p>
        </div>
        <span class="arrow">→</span></RouterLink
      >
    </div>
  </section>
</template>
