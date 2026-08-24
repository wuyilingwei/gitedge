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
  email?: string;
  name?: string;
}

interface AnonymousSession {
  authenticated: false;
}

type SessionResult = AuthenticatedSession | AnonymousSession;

function isSessionResult(value: unknown): value is SessionResult {
  if (typeof value !== "object" || value === null || !("authenticated" in value)) {
    return false;
  }

  if (value.authenticated === false) {
    return true;
  }

  return (
    value.authenticated === true &&
    "userId" in value &&
    typeof value.userId === "string" &&
    value.userId.length > 0
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
    return response;
  }
  if (!response.ok) {
    return new Response(JSON.stringify({ error: "Authentication service unavailable" }), {
      status: 502,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  const payload: unknown = await response.json();
  if (!isSessionResult(payload)) {
    return new Response(JSON.stringify({ error: "Invalid authentication response" }), {
      status: 502,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }
  return payload;
}

async function authenticate(
  request: Request,
  auth: GatewayService
): Promise<SessionResult | Response> {
  const sessionUrl = new URL("/internal/session", request.url);
  const headers = new Headers();
  const cookie = request.headers.get("Cookie");
  if (cookie) {
    headers.set("Cookie", cookie);
  }
  headers.set("Accept", "application/json");
  return readSession(await auth.fetch(new Request(sessionUrl, { headers })));
}

function forwardForge(request: Request, session: AuthenticatedSession): Request {
  const headers = new Headers(request.headers);
  withoutTrustedHeaders(headers);
  headers.set("X-GitEdge-User-Id", session.userId);
  if (session.email) headers.set("X-GitEdge-User-Email", session.email);
  if (session.name) headers.set("X-GitEdge-User-Name", session.name);
  return new Request(request, { headers });
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
    return env.AUTH.fetch(request);
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
