<script setup lang="ts">
defineProps<{ loading?: boolean; error?: string; empty?: boolean }>()
defineEmits<{ retry: [] }>()
</script>
<template>
  <div v-if="loading" class="state"><span class="spinner" />{{ $t('loading') }}</div>
  <div v-else-if="error" class="state error"><strong>{{ $t('apiError') }}</strong><button class="button ghost" @click="$emit('retry')">{{ $t('retry') }}</button></div>
  <div v-else-if="empty" class="state"><span class="empty-dot" />{{ $t('empty') }}</div>
</template>
