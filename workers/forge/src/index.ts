import {
  AddOrganizationMemberInputSchema,
  CreateOrganizationInputSchema,
  CreateIssueInputSchema,
  CreatePullRequestInputSchema,
  CreateRepositoryInputSchema,
  PutWikiPageInputSchema,
  UpdateIssueInputSchema,
  UpdatePullRequestInputSchema,
  parseUserGroupLimits,
  repositoryRouteCacheKey,
  type TrustedUser,
} from "../../../packages/contracts/src/index";
import { createLogger } from "../../../src/worker/common/logger";

type ForgeEnv = {
  readonly DB: D1Database;
  readonly ROUTES: {
    put(key: string, value: string): Promise<void>;
  };
  readonly LOG_LEVEL?: string;
  readonly USER_GROUP_LIMITS_JSON?: string;
};
type RepositoryRow = {
  id: string;
  namespace_id: string;
  owner: string;
  slug: string;
  visibility: "public" | "private";
  description: string;
  created_at: number;
  updated_at: number;
};
type NumberRow = { number: number | null };
type NamespaceKind = "personal" | "organization";
type OrganizationRole = "owner" | "member";
type NamespaceAccessRow = {
  id: string;
  slug: string;
  kind: NamespaceKind;
  display_name: string;
  description: string;
  created_by: string;
  created_at: number;
  role: OrganizationRole | null;
};
type OrganizationMemberRow = {
  identifier: string;
  role: OrganizationRole;
  createdAt: number;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function error(status: number, code: string, message: string): Response {
  return json({ error: { code, message } }, status);
}

async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function trustedUser(request: Request): TrustedUser | null {
  const id = request.headers.get("X-GitEdge-User-Id");
  const identifier = request.headers.get("X-GitEdge-User-Name");
  const groupKey = request.headers.get("X-GitEdge-User-Group");
  return id && identifier && groupKey ? { id, identifier, groupKey } : null;
}

async function repositoryForUser(
  env: ForgeEnv,
  userId: string,
  repositoryId: string
): Promise<RepositoryRow | null> {
  return env.DB.prepare(
    "SELECT repositories.id, repositories.namespace_id, namespaces.slug AS owner, repositories.slug, repositories.visibility, repositories.description, repositories.created_at, repositories.updated_at FROM repositories JOIN namespaces ON namespaces.id = repositories.namespace_id JOIN namespace_memberships ON namespace_memberships.namespace_id = repositories.namespace_id WHERE repositories.id = ? AND namespace_memberships.user_id = ?"
  )
    .bind(repositoryId, userId)
    .first<RepositoryRow>();
}

async function publicRepositoryForOwnerAndSlug(
  env: ForgeEnv,
  owner: string,
  slug: string
): Promise<RepositoryRow | null> {
  return env.DB.prepare(
    "SELECT repositories.id, repositories.namespace_id, namespaces.slug AS owner, repositories.slug, repositories.visibility, repositories.description, repositories.created_at, repositories.updated_at FROM repositories JOIN namespaces ON namespaces.id = repositories.namespace_id WHERE namespaces.slug = ? AND repositories.slug = ? AND repositories.visibility = 'public'"
  )
    .bind(owner, slug)
    .first<RepositoryRow>();
}

async function nextNumber(
  env: ForgeEnv,
  table: "forge_issues" | "forge_pull_requests",
  repositoryId: string
): Promise<number> {
  const row = await env.DB.prepare(
    `SELECT MAX(number) AS number FROM ${table} WHERE repository_id = ?`
  )
    .bind(repositoryId)
    .first<NumberRow>();
  return (row?.number ?? 0) + 1;
}

function repoResponse(row: RepositoryRow) {
  return {
    id: row.id,
    namespaceId: row.namespace_id,
    owner: row.owner,
    name: row.slug,
    slug: row.slug,
    defaultBranch: "main",
    visibility: row.visibility,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function organizationResponse(row: NamespaceAccessRow) {
  return {
    slug: row.slug,
    displayName: row.display_name,
    description: row.description,
    createdAt: row.created_at,
    role: row.role,
  };
}

async function namespaceForUser(
  env: ForgeEnv,
  userId: string,
  slug: string
): Promise<NamespaceAccessRow | null> {
  return env.DB.prepare(
    "SELECT namespaces.id, namespaces.slug, namespaces.kind, namespaces.display_name, namespaces.description, namespaces.created_by, namespaces.created_at, namespace_memberships.role FROM namespaces LEFT JOIN namespace_memberships ON namespace_memberships.namespace_id = namespaces.id AND namespace_memberships.user_id = ? WHERE namespaces.slug = ?"
  )
    .bind(userId, slug)
    .first<NamespaceAccessRow>();
}

function organizationOwner(namespace: NamespaceAccessRow): boolean {
  return namespace.kind === "organization" && namespace.role === "owner";
}

function canCreateRepository(namespace: NamespaceAccessRow, userId: string): boolean {
  if (namespace.kind === "organization") return organizationOwner(namespace);
  return namespace.created_by === userId;
}

async function publicRepositoryRead(env: ForgeEnv, parts: string[]): Promise<Response> {
  const owner = parts[2];
  const slug = parts[3];
  if (!owner || !slug) return error(404, "not_found", "Endpoint was not found.");

  const repository = await publicRepositoryForOwnerAndSlug(env, owner, slug);
  if (!repository) return error(404, "not_found", "Repository was not found.");
  if (parts.length === 4) return json({ data: repoResponse(repository) });

  const resource = parts[4];
  if (resource === "issues" && parts.length === 5) {
    const rows = await env.DB.prepare(
      "SELECT forge_issues.id, forge_issues.number, users.identifier AS author, forge_issues.title, forge_issues.body, forge_issues.state, forge_issues.created_at AS createdAt, forge_issues.updated_at AS updatedAt FROM forge_issues JOIN users ON users.id = forge_issues.author_id WHERE forge_issues.repository_id = ? ORDER BY forge_issues.number DESC"
    )
      .bind(repository.id)
      .all();
    return json({ data: rows.results });
  }
  if (resource === "pull-requests" && parts.length === 5) {
    const rows = await env.DB.prepare(
      "SELECT forge_pull_requests.id, forge_pull_requests.number, users.identifier AS author, forge_pull_requests.title, forge_pull_requests.body, forge_pull_requests.base_ref AS baseRef, forge_pull_requests.head_ref AS headRef, forge_pull_requests.state, forge_pull_requests.created_at AS createdAt, forge_pull_requests.updated_at AS updatedAt FROM forge_pull_requests JOIN users ON users.id = forge_pull_requests.author_id WHERE forge_pull_requests.repository_id = ? ORDER BY forge_pull_requests.number DESC"
    )
      .bind(repository.id)
      .all();
    return json({ data: rows.results });
  }
  if (resource === "wiki" && parts.length === 5) {
    const rows = await env.DB.prepare(
      "SELECT slug, title, revision, updated_by AS updatedBy, updated_at AS updatedAt FROM forge_wiki_pages WHERE repository_id = ? ORDER BY slug ASC"
    )
      .bind(repository.id)
      .all();
    return json({ data: rows.results });
  }
  if (resource === "wiki" && parts.length === 6) {
    const page = await env.DB.prepare(
      "SELECT slug, title, content, revision, updated_by AS updatedBy, updated_at AS updatedAt FROM forge_wiki_pages WHERE repository_id = ? AND slug = ?"
    )
      .bind(repository.id, parts[5])
      .first();
    return page ? json({ data: page }) : error(404, "not_found", "Wiki page was not found.");
  }
  return error(404, "not_found", "Endpoint was not found.");
}

export default {
  async fetch(request: Request, env: ForgeEnv): Promise<Response> {
    const logger = createLogger(env.LOG_LEVEL, { service: "forge" });
    const url = new URL(request.url);
    const parts = url.pathname.split("/").filter(Boolean);

    if (request.method === "GET" && parts[0] === "public" && parts[1] === "repositories") {
      return publicRepositoryRead(env, parts);
    }

    const user = trustedUser(request);
    if (!user) return error(401, "unauthorized", "Trusted user context is required.");

    if (request.method === "GET" && url.pathname === "/organizations") {
      const rows = await env.DB.prepare(
        "SELECT namespaces.id, namespaces.slug, namespaces.kind, namespaces.display_name, namespaces.description, namespaces.created_by, namespaces.created_at, namespace_memberships.role FROM namespaces JOIN namespace_memberships ON namespace_memberships.namespace_id = namespaces.id WHERE namespace_memberships.user_id = ? AND namespaces.kind = 'organization' ORDER BY namespaces.slug ASC"
      )
        .bind(user.id)
        .all<NamespaceAccessRow>();
      return json({ data: rows.results.map(organizationResponse) });
    }
    if (request.method === "POST" && url.pathname === "/organizations") {
      const parsed = CreateOrganizationInputSchema.safeParse(await parseJson(request));
      if (!parsed.success) return error(400, "bad_request", "Invalid organization payload.");
      const now = Date.now();
      const organizationId = crypto.randomUUID();
      try {
        await env.DB.batch([
          env.DB.prepare(
            "INSERT INTO namespaces (id, slug, created_by, created_at, kind, display_name, description) VALUES (?, ?, ?, ?, 'organization', ?, ?)"
          ).bind(
            organizationId,
            parsed.data.slug,
            user.id,
            now,
            parsed.data.displayName,
            parsed.data.description
          ),
          env.DB.prepare(
            "INSERT INTO namespace_memberships (namespace_id, user_id, created_at, role) VALUES (?, ?, ?, 'owner')"
          ).bind(organizationId, user.id, now),
        ]);
      } catch {
        logger.warn("forge:organization-create-conflict", {
          slug: parsed.data.slug,
          userId: user.id,
        });
        return error(409, "conflict", "Organization slug already exists.");
      }
      const organization: NamespaceAccessRow = {
        id: organizationId,
        slug: parsed.data.slug,
        kind: "organization",
        display_name: parsed.data.displayName,
        description: parsed.data.description,
        created_by: user.id,
        created_at: now,
        role: "owner",
      };
      logger.info("forge:organization-created", {
        organizationId,
        slug: organization.slug,
        userId: user.id,
      });
      return json({ data: organizationResponse(organization) }, 201);
    }

    const organizationSlug = parts[1];
    if (parts[0] === "organizations" && organizationSlug) {
      const organization = await namespaceForUser(env, user.id, organizationSlug);
      if (!organization || organization.kind !== "organization")
        return error(404, "not_found", "Organization was not found.");
      if (request.method === "GET" && parts.length === 2)
        return json({ data: organizationResponse(organization) });
      if (parts[2] === "members") {
        if (request.method === "GET" && parts.length === 3) {
          if (!organization.role)
            return error(403, "forbidden", "Organization membership is required.");
          const rows = await env.DB.prepare(
            "SELECT users.identifier, namespace_memberships.role, namespace_memberships.created_at AS createdAt FROM namespace_memberships JOIN users ON users.id = namespace_memberships.user_id WHERE namespace_memberships.namespace_id = ? ORDER BY namespace_memberships.role DESC, users.identifier ASC"
          )
            .bind(organization.id)
            .all<OrganizationMemberRow>();
          return json({ data: rows.results });
        }
        if (!organizationOwner(organization))
          return error(403, "forbidden", "Organization owner access is required.");
        if (request.method === "POST" && parts.length === 3) {
          const parsed = AddOrganizationMemberInputSchema.safeParse(await parseJson(request));
          if (!parsed.success)
            return error(400, "bad_request", "Invalid organization member payload.");
          const result = await env.DB.prepare(
            "INSERT OR IGNORE INTO namespace_memberships (namespace_id, user_id, created_at, role) SELECT ?, users.id, ?, ? FROM users WHERE users.identifier = ?"
          )
            .bind(organization.id, Date.now(), parsed.data.role, parsed.data.identifier)
            .run();
          if (result.meta.changes !== 1)
            return error(
              409,
              "conflict",
              "User was not found or is already an organization member."
            );
          logger.info("forge:organization-member-added", {
            organizationId: organization.id,
            identifier: parsed.data.identifier,
            role: parsed.data.role,
            userId: user.id,
          });
          return json(
            { data: { identifier: parsed.data.identifier, role: parsed.data.role } },
            201
          );
        }
        const memberIdentifier = parts[3];
        if (request.method === "DELETE" && memberIdentifier && parts.length === 4) {
          const result = await env.DB.prepare(
            "DELETE FROM namespace_memberships WHERE namespace_id = ? AND user_id = (SELECT id FROM users WHERE identifier = ?) AND NOT (role = 'owner' AND (SELECT COUNT(*) FROM namespace_memberships WHERE namespace_id = ? AND role = 'owner') <= 1) RETURNING user_id"
          )
            .bind(organization.id, memberIdentifier, organization.id)
            .first<{ user_id: string }>();
          if (!result)
            return error(
              409,
              "conflict",
              "Member was not found or is the last organization owner."
            );
          logger.info("forge:organization-member-removed", {
            organizationId: organization.id,
            identifier: memberIdentifier,
            userId: user.id,
          });
          return new Response(null, { status: 204 });
        }
      }
      return error(405, "method_not_allowed", "Method is not allowed for this endpoint.");
    }

    if (request.method === "GET" && url.pathname === "/repositories") {
      const rows = await env.DB.prepare(
        "SELECT repositories.id, repositories.namespace_id, namespaces.slug AS owner, repositories.slug, repositories.visibility, repositories.description, repositories.created_at, repositories.updated_at FROM repositories JOIN namespaces ON namespaces.id = repositories.namespace_id JOIN namespace_memberships ON namespace_memberships.namespace_id = repositories.namespace_id WHERE namespace_memberships.user_id = ? ORDER BY repositories.updated_at DESC"
      )
        .bind(user.id)
        .all<RepositoryRow>();
      return json({ data: rows.results.map(repoResponse) });
    }
    if (request.method === "POST" && url.pathname === "/repositories") {
      const parsed = CreateRepositoryInputSchema.safeParse(await parseJson(request));
      if (!parsed.success) return error(400, "bad_request", "Invalid repository payload.");
      const limits = parseUserGroupLimits(env.USER_GROUP_LIMITS_JSON);
      const groupLimits = limits[user.groupKey] ?? limits.free;
      const repositoryCount = await env.DB.prepare(
        "SELECT COUNT(*) AS count FROM repositories WHERE created_by = ?"
      )
        .bind(user.id)
        .first<{ count: number }>();
      if ((repositoryCount?.count ?? 0) >= groupLimits.maxRepositories) {
        return error(403, "forbidden", "Repository limit reached for this user group.");
      }
      const namespace = await namespaceForUser(env, user.id, parsed.data.owner);
      if (!namespace) return error(404, "not_found", "Repository owner was not found.");
      if (!canCreateRepository(namespace, user.id))
        return error(403, "forbidden", "Repository creation requires namespace owner access.");
      const now = Date.now();
      const repository: RepositoryRow = {
        id: crypto.randomUUID(),
        namespace_id: namespace.id,
        owner: namespace.slug,
        slug: parsed.data.slug,
        visibility: parsed.data.visibility,
        description: parsed.data.description,
        created_at: now,
        updated_at: now,
      };
      const result = await env.DB.prepare(
        "INSERT OR IGNORE INTO repositories (id, namespace_id, created_by, slug, do_name, visibility, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
        .bind(
          repository.id,
          namespace.id,
          user.id,
          repository.slug,
          `repo:${repository.id}`,
          repository.visibility,
          repository.description,
          now,
          now
        )
        .run();
      if (result.meta.changes !== 1)
        return error(409, "conflict", "Repository slug already exists.");
      try {
        await env.ROUTES.put(
          repositoryRouteCacheKey(namespace.slug, repository.slug),
          JSON.stringify({
            repositoryId: repository.id,
            namespaceId: namespace.id,
            doName: `repo:${repository.id}`,
            updatedAt: now,
          })
        );
      } catch (routeError) {
        await env.DB.prepare("DELETE FROM repositories WHERE id = ?").bind(repository.id).run();
        logger.error("forge:repository-route-cache-failed", {
          repositoryId: repository.id,
          namespaceId: namespace.id,
          error: routeError instanceof Error ? routeError.message : String(routeError),
        });
        return error(503, "internal_error", "Repository routing is unavailable.");
      }
      logger.info("forge:repository-created", {
        repositoryId: repository.id,
        namespaceId: namespace.id,
        userId: user.id,
      });
      return json({ data: repoResponse(repository) }, 201);
    }

    const repositoryId = parts[1];
    if (parts[0] !== "repositories" || !repositoryId)
      return error(404, "not_found", "Endpoint was not found.");
    const repository = await repositoryForUser(env, user.id, repositoryId);
    if (!repository) return error(404, "not_found", "Repository was not found.");
    if (request.method === "GET" && parts.length === 2)
      return json({ data: repoResponse(repository) });

    if (parts[2] === "issues") {
      if (request.method === "GET" && parts.length === 3) {
        const rows = await env.DB.prepare(
          "SELECT forge_issues.id, forge_issues.number, users.identifier AS author, forge_issues.title, forge_issues.body, forge_issues.state, forge_issues.created_at AS createdAt, forge_issues.updated_at AS updatedAt FROM forge_issues JOIN users ON users.id = forge_issues.author_id WHERE forge_issues.repository_id = ? ORDER BY forge_issues.number DESC"
        )
          .bind(repositoryId)
          .all();
        return json({ data: rows.results });
      }
      if (request.method === "POST" && parts.length === 3) {
        const parsed = CreateIssueInputSchema.safeParse(await parseJson(request));
        if (!parsed.success) return error(400, "bad_request", "Invalid issue payload.");
        const now = Date.now();
        const id = crypto.randomUUID();
        const number = await nextNumber(env, "forge_issues", repositoryId);
        await env.DB.prepare(
          "INSERT INTO forge_issues (id, repository_id, number, author_id, title, body, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?)"
        )
          .bind(id, repositoryId, number, user.id, parsed.data.title, parsed.data.body, now, now)
          .run();
        return json(
          {
            data: {
              id,
              number,
              ...parsed.data,
              author: user.identifier,
              state: "open",
              createdAt: now,
              updatedAt: now,
            },
          },
          201
        );
      }
      if (request.method === "PATCH" && parts.length === 4) {
        const parsed = UpdateIssueInputSchema.safeParse(await parseJson(request));
        if (!parsed.success) return error(400, "bad_request", "Invalid issue update.");
        const current = await env.DB.prepare(
          "SELECT id, title, body, state FROM forge_issues WHERE repository_id = ? AND number = ?"
        )
          .bind(repositoryId, Number(parts[3]))
          .first<{ id: string; title: string; body: string; state: string }>();
        if (!current) return error(404, "not_found", "Issue was not found.");
        const next = {
          title: parsed.data.title ?? current.title,
          body: parsed.data.body ?? current.body,
          state: parsed.data.state ?? current.state,
        };
        await env.DB.prepare(
          "UPDATE forge_issues SET title = ?, body = ?, state = ?, updated_at = ? WHERE id = ?"
        )
          .bind(next.title, next.body, next.state, Date.now(), current.id)
          .run();
        return json({ data: { id: current.id, number: Number(parts[3]), ...next } });
      }
    }

    if (parts[2] === "pull-requests") {
      if (request.method === "GET" && parts.length === 3) {
        const rows = await env.DB.prepare(
          "SELECT forge_pull_requests.id, forge_pull_requests.number, users.identifier AS author, forge_pull_requests.title, forge_pull_requests.body, forge_pull_requests.base_ref AS baseRef, forge_pull_requests.head_ref AS headRef, forge_pull_requests.state, forge_pull_requests.created_at AS createdAt, forge_pull_requests.updated_at AS updatedAt FROM forge_pull_requests JOIN users ON users.id = forge_pull_requests.author_id WHERE forge_pull_requests.repository_id = ? ORDER BY forge_pull_requests.number DESC"
        )
          .bind(repositoryId)
          .all();
        return json({ data: rows.results });
      }
      if (request.method === "POST" && parts.length === 3) {
        const parsed = CreatePullRequestInputSchema.safeParse(await parseJson(request));
        if (!parsed.success) return error(400, "bad_request", "Invalid pull request payload.");
        const now = Date.now();
        const id = crypto.randomUUID();
        const number = await nextNumber(env, "forge_pull_requests", repositoryId);
        await env.DB.prepare(
          "INSERT INTO forge_pull_requests (id, repository_id, number, author_id, title, body, base_ref, head_ref, state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)"
        )
          .bind(
            id,
            repositoryId,
            number,
            user.id,
            parsed.data.title,
            parsed.data.body,
            parsed.data.baseRef,
            parsed.data.headRef,
            now,
            now
          )
          .run();
        return json(
          {
            data: {
              id,
              number,
              ...parsed.data,
              author: user.identifier,
              state: "open",
              createdAt: now,
              updatedAt: now,
            },
          },
          201
        );
      }
      if (request.method === "PATCH" && parts.length === 4) {
        const parsed = UpdatePullRequestInputSchema.safeParse(await parseJson(request));
        if (!parsed.success) return error(400, "bad_request", "Invalid pull request update.");
        const current = await env.DB.prepare(
          "SELECT id, title, body, state FROM forge_pull_requests WHERE repository_id = ? AND number = ?"
        )
          .bind(repositoryId, Number(parts[3]))
          .first<{ id: string; title: string; body: string; state: string }>();
        if (!current) return error(404, "not_found", "Pull request was not found.");
        const next = {
          title: parsed.data.title ?? current.title,
          body: parsed.data.body ?? current.body,
          state: parsed.data.state ?? current.state,
        };
        await env.DB.prepare(
          "UPDATE forge_pull_requests SET title = ?, body = ?, state = ?, updated_at = ? WHERE id = ?"
        )
          .bind(next.title, next.body, next.state, Date.now(), current.id)
          .run();
        return json({ data: { id: current.id, number: Number(parts[3]), ...next } });
      }
    }

    if (parts[2] === "wiki" && request.method === "GET" && parts.length === 3) {
      const rows = await env.DB.prepare(
        "SELECT slug, title, revision, updated_by AS updatedBy, updated_at AS updatedAt FROM forge_wiki_pages WHERE repository_id = ? ORDER BY slug ASC"
      )
        .bind(repositoryId)
        .all();
      return json({ data: rows.results });
    }
    if (parts[2] === "wiki" && parts[3]) {
      const slug = parts[3];
      if (request.method === "GET") {
        const page = await env.DB.prepare(
          "SELECT slug, title, content, revision, updated_by AS updatedBy, updated_at AS updatedAt FROM forge_wiki_pages WHERE repository_id = ? AND slug = ?"
        )
          .bind(repositoryId, slug)
          .first();
        return page ? json({ data: page }) : error(404, "not_found", "Wiki page was not found.");
      }
      if (request.method === "PUT") {
        const parsed = PutWikiPageInputSchema.safeParse(await parseJson(request));
        if (!parsed.success) return error(400, "bad_request", "Invalid wiki page payload.");
        const current = await env.DB.prepare(
          "SELECT revision FROM forge_wiki_pages WHERE repository_id = ? AND slug = ?"
        )
          .bind(repositoryId, slug)
          .first<{ revision: number }>();
        if (
          parsed.data.expectedRevision !== undefined &&
          parsed.data.expectedRevision !== (current?.revision ?? 0)
        )
          return error(409, "conflict", "Wiki page revision has changed.");
        const revision = (current?.revision ?? 0) + 1;
        const now = Date.now();
        await env.DB.prepare(
          "INSERT INTO forge_wiki_pages (repository_id, slug, title, content, revision, updated_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(repository_id, slug) DO UPDATE SET title = excluded.title, content = excluded.content, revision = excluded.revision, updated_by = excluded.updated_by, updated_at = excluded.updated_at"
        )
          .bind(repositoryId, slug, parsed.data.title, parsed.data.content, revision, user.id, now)
          .run();
        return json({
          data: {
            slug,
            title: parsed.data.title,
            content: parsed.data.content,
            revision,
            updatedBy: user.id,
            updatedAt: now,
          },
        });
      }
    }
    return error(405, "method_not_allowed", "Method is not allowed for this endpoint.");
  },
};
