import { describe, expect, it } from "vitest";
import { handleGatewayRequest, type GatewayEnv, type GatewayService } from "../../workers/gateway/src/index";

function service(handler: (request: Request) => Response | Promise<Response>): GatewayService {
  return { fetch: async (request) => handler(request) };
}

describe("Gateway strict rate limits", () => {
  it("returns JSON 429 and Retry-After when an IP window is full", async () => {
    const env: GatewayEnv = {
      ASSETS: service(() => new Response("asset")),
      AUTH: service(() => new Response(JSON.stringify({ data: null }))),
      FORGE: service(() => new Response("forge")),
      GIT: service(() => new Response("git")),
      IP_RPM_LIMIT: "1",
      RATE_LIMITER: {
        getByName: () => ({
          consume: async () => ({ allowed: false, retryAfter: 42 }),
        }),
      },
    };
    const response = await handleGatewayRequest(
      new Request("https://gitedge.example.com/owner/repo.git/info/refs", {
        headers: { "CF-Connecting-IP": "203.0.113.9" },
      }),
      env
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(await response.json()).toEqual({ error: "Rate limit exceeded", retryAfter: 42 });
  });
});
