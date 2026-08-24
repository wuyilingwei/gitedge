import { describe, expect, it } from "vitest";

import forgeWorker from "../../workers/forge/src/index";
import { CreateRepositoryInputSchema, LoginInputSchema, PutWikiPageInputSchema } from "../../packages/contracts/src/index";

class FakeStatement implements D1PreparedStatement {
  bind(..._values: unknown[]): D1PreparedStatement { return this; }
  first<T = unknown>(): Promise<T | null> { return Promise.resolve(null); }
  all<T = unknown>(): Promise<D1Result<T>> {
    return Promise.resolve({
      results: [{ id: "repo-1", namespace_id: "namespace-1", owner: "rosmontis", slug: "edge", visibility: "private", description: "", created_at: 1, updated_at: 2 }] as T[],
      meta: { changes: 0 },
    });
  }
  run(): Promise<D1Result> { return Promise.resolve({ results: [], meta: { changes: 0 } }); }
}

class FakeDatabase implements D1Database {
  prepare(_query: string): D1PreparedStatement { return new FakeStatement(); }
  batch(_statements: readonly D1PreparedStatement[]): Promise<readonly D1Result[]> { return Promise.resolve([]); }
}

describe("service contracts", () => {
  it("normalizes repository slugs and rejects unsafe names", () => {
    expect(CreateRepositoryInputSchema.parse({ slug: "Code-Review", visibility: "private" }).slug).toBe("code-review");
    expect(CreateRepositoryInputSchema.safeParse({ slug: "../private", visibility: "private" }).success).toBe(false);
  });

  it("requires a sufficiently strong password and bounded wiki content", () => {
    expect(LoginInputSchema.safeParse({ identifier: "rosmontis", password: "too-short" }).success).toBe(false);
    expect(PutWikiPageInputSchema.safeParse({ title: "Home", content: "x".repeat(100_001) }).success).toBe(false);
  });

  it("accepts only Gateway's trusted-user headers and returns frontend repository fields", async () => {
    const env = { DB: new FakeDatabase(), LOG_LEVEL: "error" };
    const rejected = await forgeWorker.fetch(new Request("https://forge.internal/repositories", {
      headers: { "X-GitEdge-Trusted-User-Id": "user-1", "X-GitEdge-Trusted-User-Identifier": "rosmontis" },
    }), env);
    expect(rejected.status).toBe(401);

    const accepted = await forgeWorker.fetch(new Request("https://forge.internal/repositories", {
      headers: { "X-GitEdge-User-Id": "user-1", "X-GitEdge-User-Name": "rosmontis" },
    }), env);
    expect(accepted.status).toBe(200);
    await expect(accepted.json()).resolves.toEqual({
      data: [{ id: "repo-1", namespaceId: "namespace-1", owner: "rosmontis", name: "edge", slug: "edge", defaultBranch: "main", visibility: "private", description: "", createdAt: 1, updatedAt: 2 }],
    });
  });

  it("rejects invalid repository input before querying D1", async () => {
    const env = { DB: new FakeDatabase(), LOG_LEVEL: "error" };
    const response = await forgeWorker.fetch(new Request("https://forge.internal/repositories", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-GitEdge-User-Id": "user-1", "X-GitEdge-User-Name": "rosmontis" },
      body: JSON.stringify({ slug: "../escape", visibility: "private" }),
    }), env);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: { code: "bad_request", message: "Invalid repository payload." } });
  });
});
