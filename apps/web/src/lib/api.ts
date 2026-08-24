export interface User {
  id: string;
  identifier: string;
}

export interface Repository {
  id: string;
  owner: string;
  name: string;
  description?: string;
  visibility: "public" | "private";
  defaultBranch: string;
  updatedAt: number;
}

export interface Issue {
  number: number;
  title: string;
  body?: string;
  state: "open" | "closed";
  author: string;
  updatedAt: number;
}

export interface PullRequest {
  number: number;
  title: string;
  body?: string;
  state: "open" | "closed" | "merged";
  author: string;
  headRef: string;
  baseRef: string;
  updatedAt: number;
}

export interface WikiPage {
  slug: string;
  title: string;
  content?: string;
  revision: number;
  updatedBy: string;
  updatedAt: number;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

interface ApiEnvelope<T> {
  data: T;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!response.ok) {
    throw new ApiError(response.status, (await response.text()) || response.statusText);
  }
  if (response.status === 204) return undefined as T;
  const envelope = (await response.json()) as ApiEnvelope<T>;
  return envelope.data;
}

export const api = {
  login: (payload: { identifier: string; password: string }) =>
    request<User>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  register: (payload: { identifier: string; password: string }) =>
    request<User>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  logout: () => request<void>("/api/auth/logout", { method: "POST" }),
  session: () => request<User>("/api/auth/session"),
  repositories: () => request<Repository[]>("/api/forge/repositories"),
  createRepository: (payload: {
    name: string;
    description: string;
    visibility: "public" | "private";
  }) =>
    request<Repository>("/api/forge/repositories", {
      method: "POST",
      body: JSON.stringify({
        slug: payload.name,
        description: payload.description,
        visibility: payload.visibility,
      }),
    }),
  issues: (repositoryId: string) =>
    request<Issue[]>(`/api/forge/repositories/${repositoryId}/issues`),
  createIssue: (repositoryId: string, payload: { title: string; body: string }) =>
    request<Issue>(`/api/forge/repositories/${repositoryId}/issues`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  pulls: (repositoryId: string) =>
    request<PullRequest[]>(`/api/forge/repositories/${repositoryId}/pull-requests`),
  createPullRequest: (
    repositoryId: string,
    payload: { title: string; body: string; head: string; base: string }
  ) =>
    request<PullRequest>(`/api/forge/repositories/${repositoryId}/pull-requests`, {
      method: "POST",
      body: JSON.stringify({
        title: payload.title,
        body: payload.body,
        headRef: payload.head,
        baseRef: payload.base,
      }),
    }),
  wiki: (repositoryId: string) =>
    request<WikiPage[]>(`/api/forge/repositories/${repositoryId}/wiki`),
  createWikiPage: (repositoryId: string, payload: { slug: string; title: string; body: string }) =>
    request<WikiPage>(
      `/api/forge/repositories/${repositoryId}/wiki/${encodeURIComponent(payload.slug)}`,
      {
        method: "PUT",
        body: JSON.stringify({ title: payload.title, content: payload.body }),
      }
    ),
  updateWikiPage: (
    repositoryId: string,
    slug: string,
    payload: { title: string; body: string; expectedRevision?: number }
  ) =>
    request<WikiPage>(`/api/forge/repositories/${repositoryId}/wiki/${encodeURIComponent(slug)}`, {
      method: "PUT",
      body: JSON.stringify({
        title: payload.title,
        content: payload.body,
        expectedRevision: payload.expectedRevision,
      }),
    }),
};
