const TRUSTED_USER_HEADERS = [
  "x-gitedge-user-id",
  "x-gitedge-user-email",
  "x-gitedge-user-name",
] as const;

export interface GatewayService {
  fetch(request: Request): Promise<Response>;
}

export interface GatewayEnv {
  ASSETS: GatewayService;
  AUTH: GatewayService;
  FORGE: GatewayService;
  GIT: GatewayService;
}

interface AuthenticatedSession {
  authenticated: true;
  userId: string;
  userName: string;
}

interface AnonymousSession {
  authenticated: false;
}

type SessionResult = AuthenticatedSession | AnonymousSession;

interface AuthSessionPayload {
  data: { id: string; identifier: string } | null;
}

function isSessionPayload(value: unknown): value is AuthSessionPayload {
  if (typeof value !== "object" || value === null || !("data" in value)) {
    return false;
  }

  return (
    value.data === null ||
    (typeof value.data === "object" &&
      value.data !== null &&
      "id" in value.data &&
      "identifier" in value.data &&
      typeof value.data.id === "string" &&
      value.data.id.length > 0 &&
      typeof value.data.identifier === "string" &&
      value.data.identifier.length > 0)
  );
}

function isGitRequest(pathname: string): boolean {
  return /^\/[^/]+\/[^/]+\.git(?:\/|$)/.test(pathname);
}

function isApiPath(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function withPath(request: Request, pathname: string): Request {
  const url = new URL(request.url);
  url.pathname = pathname;
  return new Request(url, request);
}

function withoutTrustedHeaders(headers: Headers): void {
  for (const header of TRUSTED_USER_HEADERS) {
    headers.delete(header);
  }
}

async function readSession(response: Response): Promise<SessionResult | Response> {
  if (response.status === 401 || response.status === 403) {
    return { authenticated: false };
  }
  if (!response.ok) {
    return new Response(JSON.stringify({ error: "Authentication service unavailable" }), {
      status: 502,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const payload: unknown = await response.json();
  if (!isSessionPayload(payload)) {
    return new Response(JSON.stringify({ error: "Invalid authentication response" }), {
      status: 502,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
  if (payload.data === null) return { authenticated: false };
  return {
    authenticated: true,
    userId: payload.data.id,
    userName: payload.data.identifier,
  };
}

async function authenticate(
  request: Request,
  auth: GatewayService
): Promise<SessionResult | Response> {
  const sessionUrl = new URL("/session", request.url);
  const headers = new Headers();
  const cookie = request.headers.get("Cookie");
  if (cookie) {
    headers.set("Cookie", cookie);
  }
  headers.set("Accept", "application/json");
  return readSession(await auth.fetch(new Request(sessionUrl, { headers })));
}

function forwardServicePath(request: Request, prefix: string): Request {
  const pathname = new URL(request.url).pathname;
  const servicePath = pathname.slice(prefix.length) || "/";
  return withPath(request, servicePath);
}

function forwardForge(request: Request, session: AuthenticatedSession): Request {
  const headers = new Headers(request.headers);
  withoutTrustedHeaders(headers);
  headers.delete("Cookie");
  headers.set("X-GitEdge-User-Id", session.userId);
  headers.set("X-GitEdge-User-Name", session.userName);
  return new Request(forwardServicePath(request, "/api/forge"), { headers });
}

async function serveSpa(request: Request, assets: GatewayService): Promise<Response> {
  const assetResponse = await assets.fetch(request);
  if (assetResponse.status !== 404 || (request.method !== "GET" && request.method !== "HEAD")) {
    return assetResponse;
  }
  return assets.fetch(withPath(request, "/index.html"));
}

export async function handleGatewayRequest(request: Request, env: GatewayEnv): Promise<Response> {
  const url = new URL(request.url);

  if (isApiPath(url.pathname, "/api/auth")) {
    return env.AUTH.fetch(forwardServicePath(request, "/api/auth"));
  }

  if (isApiPath(url.pathname, "/api/forge")) {
    const session = await authenticate(request, env.AUTH);
    if (session instanceof Response) return session;
    if (!session.authenticated) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }
    return env.FORGE.fetch(forwardForge(request, session));
  }

  if (isGitRequest(url.pathname)) {
    return env.GIT.fetch(request);
  }

  if (request.method === "GET" || request.method === "HEAD") {
    return serveSpa(request, env.ASSETS);
  }

  return new Response("Not found\n", { status: 404 });
}

export default {
  fetch(request: Request, env: GatewayEnv): Promise<Response> {
    return handleGatewayRequest(request, env);
  },
};
