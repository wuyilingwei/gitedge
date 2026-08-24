import { reactive } from "vue";
import { api, type User } from "./api";

export const sessionState = reactive<{
  user: User | null;
  checked: boolean;
  loading: boolean;
}>({ user: null, checked: false, loading: false });

export async function refreshSession(): Promise<User | null> {
  if (sessionState.loading) return sessionState.user;
  sessionState.loading = true;
  try {
    sessionState.user = await api.session();
  } catch {
    sessionState.user = null;
  } finally {
    sessionState.checked = true;
    sessionState.loading = false;
  }
  return sessionState.user;
}

export function setSession(user: User): void {
  sessionState.user = user;
  sessionState.checked = true;
}

export function clearSession(): void {
  sessionState.user = null;
  sessionState.checked = true;
}
