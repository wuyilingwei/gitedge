import { describe, expect, it } from "vitest";
import {
  handleGatewayRequest,
  type GatewayEnv,
  type GatewayService,
} from "../../workers/gateway/src/index";

function service(handler: (request: Request) => Response | Promise<Response>): GatewayService {
  return { fetch: async (request) => handler(request) };
}

function environment(
  overrides: Partial<Record<"auth" | "forge" | "git" | "assets", GatewayService>> = {}
): GatewayEnv {
  return {
    AUTH:
      overrides.auth ??
      service(
        () =>
          new Response(JSON.stringify({ authenticated: false }), {
            headers: { "Content-Type": "application/json" },
          })
      ),
    FORGE: overrides.forge ?? service(() => new Response("forge")),
    GIT: overrides.git ?? service(() => new Response("git")),
    ASSETS: overrides.assets ?? service(() => new Response("asset")),
  };
}

describe("Gateway routing", () => {
  it("forwards auth routes directly to the Auth binding", async () => {
    const response = await handleGatewayRequest(
      new Request("https://gitedge.example.com/api/auth/session"),
      environment({ auth: service((request) => new Response(new URL(request.url).pathname)) })
    );

    expect(await response.text()).toBe("/api/auth/session");
  });

  it("requires a session before forwarding Forge routes", async () => {
    const response = await handleGatewayRequest(
      new Request("https://gitedge.example.com/api/forge/repos"),
      environment()
    );

    expect(response.status).toBe(401);
  });

  it("strips spoofed identity headers and injects Auth identity", async () => {
    let received: Request | undefined;
    const response = await handleGatewayRequest(
      new Request("https://gitedge.example.com/api/forge/repos", {
        headers: { "X-GitEdge-User-Id": "attacker", Cookie: "session=valid" },
      }),
      environment({
        auth: service(
          () =>
            new Response(
              JSON.stringify({ authenticated: true, userId: "user-1", email: "u@example.com" }),
              { headers: { "Content-Type": "application/json" } }
            )
        ),
        forge: service((request) => {
          received = request;
          return new Response("ok");
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(received?.headers.get("X-GitEdge-User-Id")).toBe("user-1");
    expect(received?.headers.get("X-GitEdge-User-Email")).toBe("u@example.com");
  });

  it("routes Git Smart HTTP paths to the Git binding", async () => {
    const response = await handleGatewayRequest(
      new Request("https://gitedge.example.com/owner/repo.git/info/refs?service=git-upload-pack"),
      environment()
    );

    expect(await response.text()).toBe("git");
  });

  it("falls back to index.html for an unknown browser route", async () => {
    const paths: string[] = [];
    const response = await handleGatewayRequest(
      new Request("https://gitedge.example.com/owner/repo"),
      environment({
        assets: service((request) => {
          paths.push(new URL(request.url).pathname);
          return new Response(paths.length === 1 ? "missing" : "index", {
            status: paths.length === 1 ? 404 : 200,
          });
        }),
      })
    );

    expect(await response.text()).toBe("index");
    expect(paths).toEqual(["/owner/repo", "/index.html"]);
  });
});
