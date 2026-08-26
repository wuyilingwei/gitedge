import {
  consumeRateLimit,
  type RateLimitNamespace,
  type RateLimitDecision,
} from "./rate-limit";
import { parseUserGroupLimits } from "../../../packages/contracts/src/index";
export { RateLimitDurableObject } from "./rate-limit";

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
  RATE_LIMITER: RateLimitNamespace;
  IP_RPM_LIMIT?: string;
  USER_GROUP_LIMITS_JSON?: string;
}

interface AuthenticatedSession {
  authenticated: true;
  userId: string;
  userName: string;
  groupKey: string;
}

interface AnonymousSession {
  authenticated: false;
}

type SessionResult = AuthenticatedSession | AnonymousSession;

interface AuthSessionPayload {
  data: { id: string; identifier: string; groupKey?: string } | null;
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
      value.data.identifier.length > 0 &&
      (!("groupKey" in value.data) || typeof value.data.groupKey === "string"))
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
    groupKey: payload.data.groupKey || "free",
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

function forwardForge(request: Request, session?: AuthenticatedSession): Request {
  const headers = new Headers(request.headers);
  withoutTrustedHeaders(headers);
  headers.delete("Cookie");
  if (session) {
    headers.set("X-GitEdge-User-Id", session.userId);
    headers.set("X-GitEdge-User-Name", session.userName);
  }
  return new Request(forwardServicePath(request, "/api/forge"), { headers });
}

function parsePositiveLimit(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function rateLimitedResponse(decision: RateLimitDecision): Response | null {
  if (decision.allowed) return null;
  return Response.json(
    { error: "Rate limit exceeded", retryAfter: decision.retryAfter },
    { status: 429, headers: { "Retry-After": String(decision.retryAfter) } }
  );
}

async function enforceIpLimit(request: Request, env: GatewayEnv): Promise<Response | null> {
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const decision = await consumeRateLimit(
    env.RATE_LIMITER,
    `ip:${ip}`,
    parsePositiveLimit(env.IP_RPM_LIMIT, 300)
  );
  return rateLimitedResponse(decision);
}

async function enforceUserLimit(session: AuthenticatedSession, env: GatewayEnv): Promise<Response | null> {
  const limits = parseUserGroupLimits(env.USER_GROUP_LIMITS_JSON);
  const decision = await consumeRateLimit(
    env.RATE_LIMITER,
    `user:${session.groupKey}:${session.userId}`,
    limits[session.groupKey]?.rpm ?? limits.free.rpm
  );
  return rateLimitedResponse(decision);
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

  const rateLimitPath = isApiPath(url.pathname, "/api") || isGitRequest(url.pathname);
  if (rateLimitPath) {
    const ipLimitResponse = await enforceIpLimit(request, env);
    if (ipLimitResponse) return ipLimitResponse;
  }

  if (isApiPath(url.pathname, "/api/auth")) {
    return env.AUTH.fetch(forwardServicePath(request, "/api/auth"));
  }

  if (isApiPath(url.pathname, "/api/forge")) {
    const session = await authenticate(request, env.AUTH);
    if (session instanceof Response) return session;
    if (!session.authenticated) {
      if (request.method === "GET" || request.method === "HEAD") {
        return env.FORGE.fetch(forwardForge(request));
      }
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json; charset=utf-8" },
      });
    }
    const userLimitResponse = await enforceUserLimit(session, env);
    if (userLimitResponse) return userLimitResponse;
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
