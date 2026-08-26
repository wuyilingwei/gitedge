import {
  LoginInputSchema,
  RegisterInputSchema,
  type ServiceResult,
  type TrustedUser,
} from "../../../packages/contracts/src/index";
import { createLogger } from "../../../src/worker/common/logger";

type AuthEnv = {
  readonly DB: D1Database;
  readonly LOG_LEVEL?: string;
  readonly ALLOW_PUBLIC_SIGNUP: string;
  readonly DEFAULT_USER_GROUP: string;
};
type UserRow = {
  id: string;
  identifier: string;
  group_key: string;
  password_salt: string;
  password_hash: string;
};
type SessionRow = { id: string; identifier: string; group_key: string };

const SESSION_COOKIE = "gitedge_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
export const PBKDF2_ITERATIONS = 100_000;

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

function fail(
  status: number,
  code: "bad_request" | "unauthorized" | "forbidden" | "conflict" | "method_not_allowed",
  message: string
): Response {
  return json({ error: { code, message } }, status);
}

function bytesToBase64(bytes: Uint8Array): string {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function derivePasswordHash(
  password: string,
  salt: Uint8Array<ArrayBuffer>
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    key,
    256
  );
  return bytesToBase64(new Uint8Array(bits));
}

async function hashToken(token: string): Promise<string> {
  return bytesToBase64(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)))
  );
}

function createToken(): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(32)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function createSessionCookie(token: string, maxAge: number): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function readCookie(request: Request): string | null {
  const cookie = request.headers.get("Cookie") ?? "";
  const entry = cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return entry ? entry.slice(SESSION_COOKIE.length + 1) : null;
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function issueSession(env: AuthEnv, userId: string): Promise<string> {
  const token = createToken();
  const now = Date.now();
  await env.DB.prepare(
    "INSERT INTO auth_sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)"
  )
    .bind(await hashToken(token), userId, now + SESSION_MAX_AGE_SECONDS * 1000, now)
    .run();
  return token;
}

export async function register(
  env: AuthEnv,
  input: unknown
): Promise<ServiceResult<TrustedUser & { readonly sessionToken: string }>> {
  if (env.ALLOW_PUBLIC_SIGNUP !== "true")
    return {
      ok: false,
      status: 403,
      error: { code: "forbidden", message: "Public registration is disabled." },
    };
  const parsed = RegisterInputSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      status: 400,
      error: { code: "bad_request", message: "Invalid registration payload." },
    };
  const identifier = parsed.data.identifier.toLowerCase();
  const existing = await env.DB.prepare("SELECT id FROM users WHERE identifier = ?")
    .bind(identifier)
    .first<{ id: string }>();
  if (existing)
    return {
      ok: false,
      status: 409,
      error: { code: "conflict", message: "Identifier is already registered." },
    };
  const salt: Uint8Array<ArrayBuffer> = crypto.getRandomValues(new Uint8Array(16));
  const user: TrustedUser = {
    id: crypto.randomUUID(),
    identifier,
    groupKey: env.DEFAULT_USER_GROUP,
  };
  await env.DB.prepare(
    "INSERT INTO users (id, identifier, group_key, password_salt, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(
      user.id,
      identifier,
      user.groupKey,
      bytesToBase64(salt),
      await derivePasswordHash(parsed.data.password, salt),
      Date.now()
    )
    .run();
  const namespaceId = crypto.randomUUID();
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO namespaces (id, slug, created_by, created_at) VALUES (?, ?, ?, ?)"
    ).bind(namespaceId, identifier, user.id, now),
    env.DB.prepare(
      "INSERT INTO namespace_memberships (namespace_id, user_id, created_at) VALUES (?, ?, ?)"
    ).bind(namespaceId, user.id, now),
  ]);
  return { ok: true, data: { ...user, sessionToken: await issueSession(env, user.id) } };
}

export async function login(
  env: AuthEnv,
  input: unknown
): Promise<ServiceResult<TrustedUser & { readonly sessionToken: string }>> {
  const parsed = LoginInputSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false,
      status: 400,
      error: { code: "bad_request", message: "Invalid login payload." },
    };
  const identifier = parsed.data.identifier.toLowerCase();
  const user = await env.DB.prepare(
    "SELECT id, identifier, group_key, password_salt, password_hash FROM users WHERE identifier = ?"
  )
    .bind(identifier)
    .first<UserRow>();
  if (!user)
    return {
      ok: false,
      status: 401,
      error: { code: "unauthorized", message: "Invalid identifier or password." },
    };
  let passwordMatches = false;
  try {
    const passwordHash = await derivePasswordHash(
      parsed.data.password,
      base64ToBytes(user.password_salt)
    );
    passwordMatches = crypto.subtle.timingSafeEqual(
      base64ToBytes(passwordHash),
      base64ToBytes(user.password_hash)
    );
  } catch {
    // A malformed stored credential must not reveal a distinct authentication outcome.
    passwordMatches = false;
  }
  if (!passwordMatches)
    return {
      ok: false,
      status: 401,
      error: { code: "unauthorized", message: "Invalid identifier or password." },
    };
  return {
    ok: true,
    data: {
      id: user.id,
      identifier: user.identifier,
      groupKey: user.group_key,
      sessionToken: await issueSession(env, user.id),
    },
  };
}

export async function session(
  env: AuthEnv,
  token: string | null
): Promise<ServiceResult<TrustedUser>> {
  if (!token)
    return {
      ok: false,
      status: 401,
      error: { code: "unauthorized", message: "Authentication is required." },
    };
  const row = await env.DB.prepare(
    "SELECT users.id, users.identifier, users.group_key FROM auth_sessions JOIN users ON users.id = auth_sessions.user_id WHERE auth_sessions.token_hash = ? AND auth_sessions.expires_at > ?"
  )
    .bind(await hashToken(token), Date.now())
    .first<SessionRow>();
  if (!row)
    return {
      ok: false,
      status: 401,
      error: { code: "unauthorized", message: "Authentication is required." },
    };
  return { ok: true, data: { id: row.id, identifier: row.identifier, groupKey: row.group_key } };
}

export async function logout(env: AuthEnv, token: string | null): Promise<void> {
  if (token)
    await env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash = ?")
      .bind(await hashToken(token))
      .run();
}

export default {
  async fetch(request: Request, env: AuthEnv): Promise<Response> {
    const logger = createLogger(env.LOG_LEVEL, { service: "auth" });
    const path = new URL(request.url).pathname;
    if (request.method === "POST" && path === "/register") {
      const result = await register(env, await readJson(request));
      if (!result.ok) return json({ error: result.error }, result.status);
      logger.info("auth:registered", { userId: result.data.id });
      return json(
        {
          data: {
            id: result.data.id,
            identifier: result.data.identifier,
            groupKey: result.data.groupKey,
          },
        },
        201,
        {
          "Set-Cookie": createSessionCookie(result.data.sessionToken, SESSION_MAX_AGE_SECONDS),
        }
      );
    }
    if (request.method === "POST" && path === "/login") {
      const result = await login(env, await readJson(request));
      if (!result.ok) return json({ error: result.error }, result.status);
      logger.info("auth:logged-in", { userId: result.data.id });
      return json(
        {
          data: {
            id: result.data.id,
            identifier: result.data.identifier,
            groupKey: result.data.groupKey,
          },
        },
        200,
        {
          "Set-Cookie": createSessionCookie(result.data.sessionToken, SESSION_MAX_AGE_SECONDS),
        }
      );
    }
    if (request.method === "POST" && path === "/logout") {
      await logout(env, readCookie(request));
      return json({ data: { loggedOut: true } }, 200, { "Set-Cookie": createSessionCookie("", 0) });
    }
    if (request.method === "GET" && path === "/session") {
      const result = await session(env, readCookie(request));
      return result.ok ? json({ data: result.data }) : json({ error: result.error }, result.status);
    }
    return request.method === "GET" || request.method === "POST"
      ? fail(404, "bad_request", "Unknown auth endpoint.")
      : fail(405, "method_not_allowed", "Method is not allowed.");
  },
};
