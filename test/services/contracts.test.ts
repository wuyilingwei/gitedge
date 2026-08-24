import { describe, expect, it } from "vitest";

import { CreateRepositoryInputSchema, LoginInputSchema, PutWikiPageInputSchema } from "../../packages/contracts/src/index";

describe("service contracts", () => {
  it("normalizes repository slugs and rejects unsafe names", () => {
    expect(CreateRepositoryInputSchema.parse({ slug: "Code-Review", visibility: "private" }).slug).toBe("code-review");
    expect(CreateRepositoryInputSchema.safeParse({ slug: "../private", visibility: "private" }).success).toBe(false);
  });

  it("requires a sufficiently strong password and bounded wiki content", () => {
    expect(LoginInputSchema.safeParse({ identifier: "rosmontis", password: "too-short" }).success).toBe(false);
    expect(PutWikiPageInputSchema.safeParse({ title: "Home", content: "x".repeat(100_001) }).success).toBe(false);
  });
});
