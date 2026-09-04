import { describe, expect, it } from "vitest";

import forgeWorker from "../../workers/forge/src/index";
import {
  AddOrganizationMemberInputSchema,
  CreateOrganizationInputSchema,
  CreateRepositoryInputSchema,
  LoginInputSchema,
  PutWikiPageInputSchema,
} from "../../packages/contracts/src/index";

class FakeStatement implements D1PreparedStatement {
  bind(..._values: unknown[]): D1PreparedStatement {
    return this;
  }
  first<T = unknown>(): Promise<T | null> {
    return Promise.resolve(null);
  }
  all<T = unknown>(): Promise<D1Result<T>> {
    return Promise.resolve({
      results: [
        {
          id: "repo-1",
          namespace_id: "namespace-1",
          owner: "rosmontis",
          slug: "edge",
          visibility: "private",
          description: "",
          created_at: 1,
          updated_at: 2,
        },
      ] as T[],
      meta: { changes: 0 },
    });
  }
  run(): Promise<D1Result> {
    return Promise.resolve({ results: [], meta: { changes: 0 } });
  }
}

class FakeDatabase implements D1Database {
  prepare(_query: string): D1PreparedStatement {
    return new FakeStatement();
  }
  batch(_statements: readonly D1PreparedStatement[]): Promise<readonly D1Result[]> {
    return Promise.resolve([]);
  }
}

type TestNamespace = {
  id: string;
  slug: string;
  kind: "personal" | "organization";
  display_name: string;
  description: string;
  created_by: string;
  created_at: number;
  role: "owner" | "member";
};

const personalTestNamespace: TestNamespace = {
  id: "namespace-1",
  slug: "rosmontis",
  kind: "personal",
  display_name: "",
  description: "",
  created_by: "user-1",
  created_at: 1,
  role: "owner",
};

class RepositoryCreateStatement implements D1PreparedStatement {
  constructor(
    private readonly query: string,
    private readonly deletedRepositories: string[],
    private readonly repositoryCount: number,
    private readonly namespace: TestNamespace
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    if (this.query.startsWith("DELETE FROM repositories")) {
      this.deletedRepositories.push(String(values[0]));
    }
    return this;
  }

  first<T = unknown>(): Promise<T | null> {
    if (this.query.includes("COUNT(*) AS count")) {
      return Promise.resolve({ count: this.repositoryCount } as T);
    }
    if (this.query.includes("FROM namespaces LEFT JOIN namespace_memberships")) {
      return Promise.resolve(this.namespace as T);
    }
    return Promise.resolve(null);
  }

  all<T = unknown>(): Promise<D1Result<T>> {
    return Promise.resolve({ results: [], meta: { changes: 0 } });
  }

  run(): Promise<D1Result> {
    return Promise.resolve({
      results: [],
      meta: { changes: this.query.startsWith("INSERT OR IGNORE INTO repositories") ? 1 : 0 },
    });
  }
}

class RepositoryCreateDatabase implements D1Database {
  readonly deletedRepositories: string[] = [];

  constructor(
    private readonly repositoryCount = 0,
    private readonly namespace: TestNamespace = personalTestNamespace
  ) {}

  prepare(query: string): D1PreparedStatement {
    return new RepositoryCreateStatement(
      query,
      this.deletedRepositories,
      this.repositoryCount,
      this.namespace
    );
  }

  batch(_statements: readonly D1PreparedStatement[]): Promise<readonly D1Result[]> {
    return Promise.resolve([]);
  }
}

class PublicReadStatement implements D1PreparedStatement {
  constructor(private readonly query: string) {}

  bind(..._values: unknown[]): D1PreparedStatement {
    return this;
  }

  first<T = unknown>(): Promise<T | null> {
    if (this.query.includes("repositories.visibility = 'public'")) {
      return Promise.resolve({
        id: "repo-public",
        namespace_id: "namespace-1",
        owner: "rosmontis",
        slug: "edge",
        visibility: "public",
        description: "Public edge repository",
        created_at: 1,
        updated_at: 2,
      } as T);
    }
    return Promise.resolve(null);
  }

  all<T = unknown>(): Promise<D1Result<T>> {
    return Promise.resolve({ results: [], meta: { changes: 0 } });
  }

  run(): Promise<D1Result> {
    return Promise.resolve({ results: [], meta: { changes: 0 } });
  }
}

class PublicReadDatabase implements D1Database {
  prepare(query: string): D1PreparedStatement {
    return new PublicReadStatement(query);
  }

  batch(_statements: readonly D1PreparedStatement[]): Promise<readonly D1Result[]> {
    return Promise.resolve([]);
  }
}

class OrganizationStatement implements D1PreparedStatement {
  constructor(
    private readonly query: string,
    private readonly role: "owner" | "member",
    private readonly deleteOutcome: "last-owner" | "none"
  ) {}

  bind(..._values: unknown[]): D1PreparedStatement {
    return this;
  }

  first<T = unknown>(): Promise<T | null> {
    if (
      this.query.startsWith("DELETE FROM namespace_memberships") &&
      this.deleteOutcome === "last-owner"
    ) {
      return Promise.resolve(null);
    }
    if (this.query.includes("FROM namespaces LEFT JOIN namespace_memberships")) {
      return Promise.resolve({
        id: "organization-1",
        slug: "edge-team",
        kind: "organization",
        display_name: "Edge Team",
        description: "Builds at the edge",
        created_by: "user-1",
        created_at: 1,
        role: this.role,
      } as T);
    }
    return Promise.resolve(null);
  }

  all<T = unknown>(): Promise<D1Result<T>> {
    if (this.query.includes("SELECT users.identifier")) {
      return Promise.resolve({
        results: [{ identifier: "member", role: "member", createdAt: 2 }] as T[],
        meta: { changes: 0 },
      });
    }
    return Promise.resolve({ results: [], meta: { changes: 0 } });
  }

  run(): Promise<D1Result> {
    return Promise.resolve({ results: [], meta: { changes: 1 } });
  }
}

class OrganizationDatabase implements D1Database {
  batches: readonly D1PreparedStatement[][] = [];

  constructor(
    private readonly role: "owner" | "member" = "owner",
    private readonly deleteOutcome: "last-owner" | "none" = "none"
  ) {}

  prepare(query: string): D1PreparedStatement {
    return new OrganizationStatement(query, this.role, this.deleteOutcome);
  }

  batch(statements: readonly D1PreparedStatement[]): Promise<readonly D1Result[]> {
    this.batches = [...this.batches, [...statements]];
    return Promise.resolve([]);
  }
}

describe("service contracts", () => {
  it("normalizes repository slugs and rejects unsafe names", () => {
    expect(
      CreateRepositoryInputSchema.parse({
        owner: "Rosmontis",
        slug: "Code-Review",
        visibility: "private",
      }).slug
    ).toBe("code-review");
    expect(
      CreateRepositoryInputSchema.safeParse({
        owner: "rosmontis",
        slug: "../private",
        visibility: "private",
      }).success
    ).toBe(false);
  });

  it("requires a sufficiently strong password and bounded wiki content", () => {
    expect(
      LoginInputSchema.safeParse({ identifier: "rosmontis", password: "too-short" }).success
    ).toBe(false);
    expect(
      PutWikiPageInputSchema.safeParse({ title: "Home", content: "x".repeat(100_001) }).success
    ).toBe(false);
  });

  it("requires an explicit repository owner and validates organization payloads", () => {
    expect(
      CreateRepositoryInputSchema.safeParse({ slug: "edge", visibility: "private" }).success
    ).toBe(false);
    expect(
      CreateOrganizationInputSchema.parse({ slug: "Edge-Team", displayName: "Edge Team" })
    ).toEqual({
      slug: "edge-team",
      displayName: "Edge Team",
      description: "",
    });
    expect(AddOrganizationMemberInputSchema.parse({ identifier: "member" })).toEqual({
      identifier: "member",
      role: "member",
    });
  });

  it("accepts only Gateway's trusted-user headers and returns frontend repository fields", async () => {
    const env = { DB: new FakeDatabase(), LOG_LEVEL: "error" };
    const rejected = await forgeWorker.fetch(
      new Request("https://forge.internal/repositories", {
        headers: {
          "X-GitEdge-Trusted-User-Id": "user-1",
          "X-GitEdge-Trusted-User-Identifier": "rosmontis",
        },
      }),
      env
    );
    expect(rejected.status).toBe(401);

    const accepted = await forgeWorker.fetch(
      new Request("https://forge.internal/repositories", {
        headers: {
          "X-GitEdge-User-Id": "user-1",
          "X-GitEdge-User-Name": "rosmontis",
          "X-GitEdge-User-Group": "free",
        },
      }),
      env
    );
    expect(accepted.status).toBe(200);
    await expect(accepted.json()).resolves.toEqual({
      data: [
        {
          id: "repo-1",
          namespaceId: "namespace-1",
          owner: "rosmontis",
          name: "edge",
          slug: "edge",
          defaultBranch: "main",
          visibility: "private",
          description: "",
          createdAt: 1,
          updatedAt: 2,
        },
      ],
    });
  });

  it("allows anonymous reads only through an owner and slug public repository path", async () => {
    const env = { DB: new PublicReadDatabase(), LOG_LEVEL: "error" };
    const repository = await forgeWorker.fetch(
      new Request("https://forge.internal/public/repositories/rosmontis/edge"),
      env
    );
    const issues = await forgeWorker.fetch(
      new Request("https://forge.internal/public/repositories/rosmontis/edge/issues"),
      env
    );
    const write = await forgeWorker.fetch(
      new Request("https://forge.internal/public/repositories/rosmontis/edge/issues", {
        method: "POST",
      }),
      env
    );
    const privateRepository = await forgeWorker.fetch(
      new Request("https://forge.internal/public/repositories/rosmontis/private"),
      { DB: new FakeDatabase(), LOG_LEVEL: "error" }
    );

    expect(repository.status).toBe(200);
    await expect(repository.json()).resolves.toMatchObject({
      data: { owner: "rosmontis", slug: "edge", visibility: "public" },
    });
    expect(issues.status).toBe(200);
    expect(write.status).toBe(401);
    expect(privateRepository.status).toBe(404);
  });

  it("rejects invalid repository input before querying D1", async () => {
    const env = { DB: new FakeDatabase(), LOG_LEVEL: "error" };
    const response = await forgeWorker.fetch(
      new Request("https://forge.internal/repositories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-GitEdge-User-Id": "user-1",
          "X-GitEdge-User-Name": "rosmontis",
          "X-GitEdge-User-Group": "free",
        },
        body: JSON.stringify({ owner: "rosmontis", slug: "../escape", visibility: "private" }),
      }),
      env
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: { code: "bad_request", message: "Invalid repository payload." },
    });
  });

  it("publishes a repository route candidate when Forge creates a repository", async () => {
    const database = new RepositoryCreateDatabase();
    const writes: Array<{ key: string; value: string }> = [];
    const env = {
      DB: database,
      LOG_LEVEL: "error",
      ROUTES: {
        async put(key: string, value: string): Promise<void> {
          writes.push({ key, value });
        },
      },
    };

    const response = await forgeWorker.fetch(
      new Request("https://forge.internal/repositories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-GitEdge-User-Id": "user-1",
          "X-GitEdge-User-Name": "rosmontis",
          "X-GitEdge-User-Group": "free",
        },
        body: JSON.stringify({
          owner: "rosmontis",
          slug: "edge",
          visibility: "public",
          description: "",
        }),
      }),
      env
    );

    expect(response.status).toBe(201);
    expect(writes).toHaveLength(1);
    expect(writes[0]?.key).toBe("repo-route:v1:rosmontis/edge");
    expect(JSON.parse(writes[0]!.value)).toMatchObject({
      namespaceId: "namespace-1",
      doName: expect.stringMatching(/^repo:/),
    });
    expect(database.deletedRepositories).toEqual([]);
  });

  it("rejects repository creation when the user group repository limit is reached", async () => {
    const response = await forgeWorker.fetch(
      new Request("https://forge.internal/repositories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-GitEdge-User-Id": "user-1",
          "X-GitEdge-User-Name": "rosmontis",
          "X-GitEdge-User-Group": "free",
        },
        body: JSON.stringify({
          owner: "rosmontis",
          slug: "blocked",
          visibility: "public",
          description: "",
        }),
      }),
      {
        DB: new RepositoryCreateDatabase(10),
        LOG_LEVEL: "error",
        ROUTES: { put: async () => {} },
      }
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: { code: "forbidden", message: "Repository limit reached for this user group." },
    });
  });

  it("allows an organization owner to create a repository under that organization", async () => {
    const database = new RepositoryCreateDatabase(0, {
      id: "organization-1",
      slug: "edge-team",
      kind: "organization",
      display_name: "Edge Team",
      description: "",
      created_by: "other-user",
      created_at: 1,
      role: "owner",
    });
    const writes: Array<{ key: string; value: string }> = [];
    const response = await forgeWorker.fetch(
      new Request("https://forge.internal/repositories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-GitEdge-User-Id": "user-1",
          "X-GitEdge-User-Name": "rosmontis",
          "X-GitEdge-User-Group": "free",
        },
        body: JSON.stringify({ owner: "edge-team", slug: "docs", visibility: "private" }),
      }),
      {
        DB: database,
        LOG_LEVEL: "error",
        ROUTES: { put: async (key: string, value: string) => void writes.push({ key, value }) },
      }
    );

    expect(response.status).toBe(201);
    expect(writes[0]?.key).toBe("repo-route:v1:edge-team/docs");
  });

  it("creates organizations atomically and lets owners list and add members", async () => {
    const database = new OrganizationDatabase();
    const env = { DB: database, LOG_LEVEL: "error", ROUTES: { put: async () => {} } };
    const headers = {
      "Content-Type": "application/json",
      "X-GitEdge-User-Id": "user-1",
      "X-GitEdge-User-Name": "rosmontis",
      "X-GitEdge-User-Group": "free",
    };

    const created = await forgeWorker.fetch(
      new Request("https://forge.internal/organizations", {
        method: "POST",
        headers,
        body: JSON.stringify({
          slug: "edge-team",
          displayName: "Edge Team",
          description: "Builds",
        }),
      }),
      env
    );
    const members = await forgeWorker.fetch(
      new Request("https://forge.internal/organizations/edge-team/members", { headers }),
      env
    );
    const added = await forgeWorker.fetch(
      new Request("https://forge.internal/organizations/edge-team/members", {
        method: "POST",
        headers,
        body: JSON.stringify({ identifier: "member" }),
      }),
      env
    );

    expect(created.status).toBe(201);
    expect(database.batches).toHaveLength(1);
    expect(database.batches[0]).toHaveLength(2);
    expect(members.status).toBe(200);
    await expect(members.json()).resolves.toEqual({
      data: [{ identifier: "member", role: "member", createdAt: 2 }],
    });
    expect(added.status).toBe(201);
  });

  it("lets members read organization members but reserves member changes for owners", async () => {
    const env = {
      DB: new OrganizationDatabase("member"),
      LOG_LEVEL: "error",
      ROUTES: { put: async () => {} },
    };
    const headers = {
      "Content-Type": "application/json",
      "X-GitEdge-User-Id": "member-user",
      "X-GitEdge-User-Name": "member",
      "X-GitEdge-User-Group": "free",
    };
    const organization = await forgeWorker.fetch(
      new Request("https://forge.internal/organizations/edge-team", { headers }),
      env
    );
    const members = await forgeWorker.fetch(
      new Request("https://forge.internal/organizations/edge-team/members", { headers }),
      env
    );
    const write = await forgeWorker.fetch(
      new Request("https://forge.internal/organizations/edge-team/members", {
        method: "POST",
        headers,
        body: JSON.stringify({ identifier: "another-member" }),
      }),
      env
    );

    await expect(organization.json()).resolves.toMatchObject({ data: { role: "member" } });
    expect(members.status).toBe(200);
    expect(write.status).toBe(403);
    await expect(write.json()).resolves.toEqual({
      error: { code: "forbidden", message: "Organization owner access is required." },
    });
  });

  it("does not delete the final organization owner", async () => {
    const env = {
      DB: new OrganizationDatabase("owner", "last-owner"),
      LOG_LEVEL: "error",
      ROUTES: { put: async () => {} },
    };
    const response = await forgeWorker.fetch(
      new Request("https://forge.internal/organizations/edge-team/members/rosmontis", {
        method: "DELETE",
        headers: {
          "X-GitEdge-User-Id": "user-1",
          "X-GitEdge-User-Name": "rosmontis",
          "X-GitEdge-User-Group": "free",
        },
      }),
      env
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "conflict",
        message: "Member was not found or is the last organization owner.",
      },
    });
  });
});
