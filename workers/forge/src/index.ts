import {
  CreateIssueInputSchema,
  CreatePullRequestInputSchema,
  CreateRepositoryInputSchema,
  PutWikiPageInputSchema,
  UpdateIssueInputSchema,
  UpdatePullRequestInputSchema,
  type TrustedUser,
} from "../../../packages/contracts/src/index";
import { createLogger } from "../../../src/worker/common/logger";

type ForgeEnv = { readonly DB: D1Database; readonly LOG_LEVEL?: string };
type RepositoryRow = { id: string; namespace_id: string; slug: string; visibility: "public" | "private"; description: string; created_at: number; updated_at: number };
type NumberRow = { number: number | null };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });
}

function error(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status);
}

async function parseJson(request: Request): Promise<unknown> {
  try { return await request.json(); } catch { return null; }
}

function trustedUser(request: Request): TrustedUser | null {
  const id = request.headers.get("X-GitEdge-Trusted-User-Id");
  const identifier = request.headers.get("X-GitEdge-Trusted-User-Identifier");
  return id && identifier ? { id, identifier } : null;
}

async function repositoryForUser(env: ForgeEnv, userId: string, repositoryId: string): Promise<RepositoryRow | null> {
  return env.DB.prepare(
    "SELECT repositories.id, repositories.namespace_id, repositories.slug, repositories.visibility, repositories.description, repositories.created_at, repositories.updated_at FROM repositories JOIN namespace_memberships ON namespace_memberships.namespace_id = repositories.namespace_id WHERE repositories.id = ? AND namespace_memberships.user_id = ?",
  ).bind(repositoryId, userId).first<RepositoryRow>();
}

async function nextNumber(env: ForgeEnv, table: "forge_issues" | "forge_pull_requests", repositoryId: string): Promise<number> {
  const row = await env.DB.prepare(`SELECT MAX(number) AS number FROM ${table} WHERE repository_id = ?`).bind(repositoryId).first<NumberRow>();
  return (row?.number ?? 0) + 1;
}

function repoResponse(row: RepositoryRow) {
  return { id: row.id, namespaceId: row.namespace_id, slug: row.slug, visibility: row.visibility, description: row.description, createdAt: row.created_at, updatedAt: row.updated_at };
}

export default {
  async fetch(request: Request, env: ForgeEnv): Promise<Response> {
    const user = trustedUser(request);
    if (!user) return error(401, "unauthorized", "Trusted user context is required.");
    const logger = createLogger(env.LOG_LEVEL, { service: "forge" });
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);

    if (request.method === "GET" && url.pathname === "/repositories") {
      const rows = await env.DB.prepare(
        "SELECT repositories.id, repositories.namespace_id, repositories.slug, repositories.visibility, repositories.description, repositories.created_at, repositories.updated_at FROM repositories JOIN namespace_memberships ON namespace_memberships.namespace_id = repositories.namespace_id WHERE namespace_memberships.user_id = ? ORDER BY repositories.updated_at DESC",
      ).bind(user.id).all<RepositoryRow>();
      return json({ data: rows.results.map(repoResponse) });
    }
    if (request.method === "POST" && url.pathname === "/repositories") {
      const parsed = CreateRepositoryInputSchema.safeParse(await parseJson(request));
      if (!parsed.success) return error(400, "bad_request", "Invalid repository payload.");
      const namespace = await env.DB.prepare("SELECT id FROM namespaces WHERE created_by = ? ORDER BY created_at ASC LIMIT 1").bind(user.id).first<{ id: string }>();
      if (!namespace) return error(403, "forbidden", "No personal namespace is available.");
      const now = Date.now();
      const repository: RepositoryRow = { id: crypto.randomUUID(), namespace_id: namespace.id, slug: parsed.data.slug, visibility: parsed.data.visibility, description: parsed.data.description, created_at: now, updated_at: now };
      const result = await env.DB.prepare(
        "INSERT OR IGNORE INTO repositories (id, namespace_id, created_by, slug, do_name, visibility, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).bind(repository.id, namespace.id, user.id, repository.slug, `repo:${repository.id}`, repository.visibility, repository.description, now, now).run();
      if (result.meta.changes !== 1) return error(409, "conflict", "Repository slug already exists.");
      logger.info("forge:repository-created", { repositoryId: repository.id, userId: user.id });
      return json({ data: repoResponse(repository) }, 201);
    }

    const repositoryId = parts[1];
    if (parts[0] !== "repositories" || !repositoryId) return error(404, "not_found", "Endpoint was not found.");
    const repository = await repositoryForUser(env, user.id, repositoryId);
    if (!repository) return error(404, "not_found", "Repository was not found.");
    if (request.method === "GET" && parts.length === 2) return json({ data: repoResponse(repository) });

    if (parts[2] === "issues") {
      if (request.method === "GET" && parts.length === 3) {
        const rows = await env.DB.prepare("SELECT id, number, author_id AS authorId, title, body, state, created_at AS createdAt, updated_at AS updatedAt FROM forge_issues WHERE repository_id = ? ORDER BY number DESC").bind(repositoryId).all();
        return json({ data: rows.results });
      }
      if (request.method === "POST" && parts.length === 3) {
        const parsed = CreateIssueInputSchema.safeParse(await parseJson(request));
        if (!parsed.success) return error(400, "bad_request", "Invalid issue payload.");
        const now = Date.now(); const id = crypto.randomUUID(); const number = await nextNumber(env, "forge_issues", repositoryId);
        await env.DB.prepare("INSERT INTO forge_issues (id, repository_id, number, author_id, title, body, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?)").bind(id, repositoryId, number, user.id, parsed.data.title, parsed.data.body, now, now).run();
        return json({ data: { id, number, ...parsed.data, state: "open", createdAt: now, updatedAt: now } }, 201);
      }
      if (request.method === "PATCH" && parts.length === 4) {
        const parsed = UpdateIssueInputSchema.safeParse(await parseJson(request));
        if (!parsed.success) return error(400, "bad_request", "Invalid issue update.");
        const current = await env.DB.prepare("SELECT id, title, body, state FROM forge_issues WHERE repository_id = ? AND number = ?").bind(repositoryId, Number(parts[3])).first<{ id: string; title: string; body: string; state: string }>();
        if (!current) return error(404, "not_found", "Issue was not found.");
        const next = { title: parsed.data.title ?? current.title, body: parsed.data.body ?? current.body, state: parsed.data.state ?? current.state };
        await env.DB.prepare("UPDATE forge_issues SET title = ?, body = ?, state = ?, updated_at = ? WHERE id = ?").bind(next.title, next.body, next.state, Date.now(), current.id).run();
        return json({ data: { id: current.id, number: Number(parts[3]), ...next } });
      }
    }

    if (parts[2] === "pull-requests") {
      if (request.method === "GET" && parts.length === 3) {
        const rows = await env.DB.prepare("SELECT id, number, author_id AS authorId, title, body, base_ref AS baseRef, head_ref AS headRef, state, created_at AS createdAt, updated_at AS updatedAt FROM forge_pull_requests WHERE repository_id = ? ORDER BY number DESC").bind(repositoryId).all();
        return json({ data: rows.results });
      }
      if (request.method === "POST" && parts.length === 3) {
        const parsed = CreatePullRequestInputSchema.safeParse(await parseJson(request));
        if (!parsed.success) return error(400, "bad_request", "Invalid pull request payload.");
        const now = Date.now(); const id = crypto.randomUUID(); const number = await nextNumber(env, "forge_pull_requests", repositoryId);
        await env.DB.prepare("INSERT INTO forge_pull_requests (id, repository_id, number, author_id, title, body, base_ref, head_ref, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)").bind(id, repositoryId, number, user.id, parsed.data.title, parsed.data.body, parsed.data.baseRef, parsed.data.headRef, now, now).run();
        return json({ data: { id, number, ...parsed.data, state: "open", createdAt: now, updatedAt: now } }, 201);
      }
      if (request.method === "PATCH" && parts.length === 4) {
        const parsed = UpdatePullRequestInputSchema.safeParse(await parseJson(request));
        if (!parsed.success) return error(400, "bad_request", "Invalid pull request update.");
        const current = await env.DB.prepare("SELECT id, title, body, state FROM forge_pull_requests WHERE repository_id = ? AND number = ?").bind(repositoryId, Number(parts[3])).first<{ id: string; title: string; body: string; state: string }>();
        if (!current) return error(404, "not_found", "Pull request was not found.");
        const next = { title: parsed.data.title ?? current.title, body: parsed.data.body ?? current.body, state: parsed.data.state ?? current.state };
        await env.DB.prepare("UPDATE forge_pull_requests SET title = ?, body = ?, state = ?, updated_at = ? WHERE id = ?").bind(next.title, next.body, next.state, Date.now(), current.id).run();
        return json({ data: { id: current.id, number: Number(parts[3]), ...next } });
      }
    }

    if (parts[2] === "wiki" && parts[3]) {
      const slug = parts[3];
      if (request.method === "GET") {
        const page = await env.DB.prepare("SELECT slug, title, content, revision, updated_by AS updatedBy, updated_at AS updatedAt FROM forge_wiki_pages WHERE repository_id = ? AND slug = ?").bind(repositoryId, slug).first();
        return page ? json({ data: page }) : error(404, "not_found", "Wiki page was not found.");
      }
      if (request.method === "PUT") {
        const parsed = PutWikiPageInputSchema.safeParse(await parseJson(request));
        if (!parsed.success) return error(400, "bad_request", "Invalid wiki page payload.");
        const current = await env.DB.prepare("SELECT revision FROM forge_wiki_pages WHERE repository_id = ? AND slug = ?").bind(repositoryId, slug).first<{ revision: number }>();
        if (parsed.data.expectedRevision !== undefined && parsed.data.expectedRevision !== (current?.revision ?? 0)) return error(409, "conflict", "Wiki page revision has changed.");
        const revision = (current?.revision ?? 0) + 1; const now = Date.now();
        await env.DB.prepare("INSERT INTO forge_wiki_pages (repository_id, slug, title, content, revision, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(repository_id, slug) DO UPDATE SET title = excluded.title, content = excluded.content, revision = excluded.revision, updated_by = excluded.updated_by, updated_at = excluded.updated_at").bind(repositoryId, slug, parsed.data.title, parsed.data.content, revision, user.id, now).run();
        return json({ data: { slug, title: parsed.data.title, content: parsed.data.content, revision, updatedBy: user.id, updatedAt: now } });
      }
    }
    return error(405, "method_not_allowed", "Method is not allowed for this endpoint.");
  },
};
