export interface Repository { id: string; owner: string; name: string; description?: string; visibility: 'public' | 'private'; defaultBranch: string; updatedAt: string }
export interface Issue { number: number; title: string; body?: string; state: 'open' | 'closed'; author: string; updatedAt: string }
export interface PullRequest { number: number; title: string; state: 'open' | 'closed' | 'merged'; author: string; head: string; base: string; updatedAt: string }
export interface WikiPage { slug: string; title: string; excerpt: string; updatedAt: string }

export class ApiError extends Error { constructor(public readonly status: number, message: string) { super(message) } }

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...init?.headers }, ...init })
  if (!response.ok) throw new ApiError(response.status, await response.text() || response.statusText)
  return response.status === 204 ? (undefined as T) : await response.json() as T
}

export const api = {
  login: (payload: { email: string; password: string }) => request<{ user: { name: string } }>('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  register: (payload: { name: string; email: string; password: string }) => request<{ user: { name: string } }>('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) }),
  logout: () => request<void>('/api/auth/logout', { method: 'POST' }),
  session: () => request<{ user: { name: string } | null }>('/api/auth/session'),
  repositories: () => request<Repository[]>('/api/forge/repos'),
  issues: (owner: string, repo: string) => request<Issue[]>(`/api/forge/repos/${owner}/${repo}/issues`),
  pulls: (owner: string, repo: string) => request<PullRequest[]>(`/api/forge/repos/${owner}/${repo}/pulls`),
  wiki: (owner: string, repo: string) => request<WikiPage[]>(`/api/forge/repos/${owner}/${repo}/wiki`),
}
