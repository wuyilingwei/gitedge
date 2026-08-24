import { beforeEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "../../apps/web/src/lib/api";
import { i18n } from "../../apps/web/src/i18n";

describe("GitEdge API client", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("unwraps the auth response envelope and sends the service payload", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { id: "u1", identifier: "rosmontis" } }), {
          status: 200,
        })
      );

    const user = await api.login({ identifier: "rosmontis", password: "a".repeat(12) });

    expect(user.identifier).toBe("rosmontis");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ identifier: "rosmontis", password: "a".repeat(12) }),
      })
    );
  });

  it("uses repository ids and unwraps Forge list responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), { status: 200 })
    );

    await api.issues("repo-7");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/forge/repositories/repo-7/issues",
      expect.objectContaining({ credentials: "include" })
    );
  });

  it("exposes the status when the API rejects a request", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("unauthorized", { status: 401 }));

    await expect(api.session()).rejects.toMatchObject<ApiError>({ status: 401 });
  });
});

describe("GitEdge product shell", () => {
  it("ships Chinese and English product language keys", () => {
    expect(i18n.global.t("brand")).toBe("码锋");
    i18n.global.locale.value = "en";
    expect(i18n.global.t("welcome")).toBe("Code at the edge");
    i18n.global.locale.value = "zh-CN";
  });
});
