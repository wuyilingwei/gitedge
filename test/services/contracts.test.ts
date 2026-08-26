import { describe, expect, it } from "vitest";

import forgeWorker from "../../workers/forge/src/index";
import {
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

class RepositoryCreateStatement implements D1PreparedStatement {
  constructor(
    private readonly query: string,
    private readonly deletedRepositories: string[]
  ) {}

  bind(...values: unknown[]): D1PreparedStatement {
    if (this.query.startsWith("DELETE FROM repositories")) {
      this.deletedRepositories.push(String(values[0]));
    }
    return this;
  }

  first<T = unknown>(): Promise<T | null> {
    if (this.query.includes("SELECT id FROM namespaces")) {
      return Promise.resolve({ id: "namespace-1" } as T);
    }
    if (this.query.includes("SELECT slug FROM namespaces")) {
      return Promise.resolve({ slug: "rosmontis" } as T);
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

  prepare(query: string): D1PreparedStatement {
    return new RepositoryCreateStatement(query, this.deletedRepositories);
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

describe("service contracts", () => {
  it("normalizes repository slugs and rejects unsafe names", () => {
    expect(
      CreateRepositoryInputSchema.parse({ slug: "Code-Review", visibility: "private" }).slug
    ).toBe("code-review");
    expect(
      CreateRepositoryInputSchema.safeParse({ slug: "../private", visibility: "private" }).success
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
        headers: { "X-GitEdge-User-Id": "user-1", "X-GitEdge-User-Name": "rosmontis" },
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
        },
        body: JSON.stringify({ slug: "../escape", visibility: "private" }),
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
        },
        body: JSON.stringify({ slug: "edge", visibility: "public", description: "" }),
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
});
