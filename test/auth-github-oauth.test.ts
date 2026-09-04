import { afterEach, describe, expect, it, vi } from "vitest";

import { completeGithubOAuth, startGithubOAuth } from "../workers/auth/src/index";

type OAuthState = {
  code_verifier: string;
  access_level: "identity" | "read";
  return_to: string;
  expires_at: number;
};

type TestDatabase = {
  states: Map<string, OAuthState>;
  sessions: Map<string, string>;
  prepare(sql: string): unknown;
  batch(): Promise<unknown[]>;
};

function createDatabase(): TestDatabase {
  const states = new Map<string, OAuthState>();
  const sessions = new Map<string, string>();
  return {
    states,
    sessions,
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async first<T>() {
              if (sql.startsWith("DELETE FROM github_oauth_states")) {
                const stateHash = String(values[0]);
                const state = states.get(stateHash);
                states.delete(stateHash);
                if (!state || state.expires_at <= Number(values[1])) return null;
                return {
                  code_verifier: state.code_verifier,
                  access_level: state.access_level,
                  return_to: state.return_to,
                } as T;
              }
              return null;
            },
            async run() {
              if (sql.startsWith("INSERT INTO github_oauth_states")) {
                states.set(String(values[0]), {
                  code_verifier: String(values[1]),
                  access_level: values[2] as "identity" | "read",
                  return_to: String(values[3]),
                  expires_at: Number(values[4]),
                });
              }
              if (sql.startsWith("INSERT INTO auth_sessions"))
                sessions.set(String(values[0]), String(values[1]));
              return {};
            },
          };
        },
      };
    },
    async batch() {
      return [];
    },
  };
}

function testEnv(database: TestDatabase) {
  return {
    DB: database as unknown as D1Database,
    ALLOW_PUBLIC_SIGNUP: "true",
    DEFAULT_USER_GROUP: "free",
    GITHUB_CLIENT_ID: "github-test-client",
    GITHUB_CLIENT_SECRET: "github-test-secret",
    GITHUB_OAUTH_BASE: "https://github.example",
    GITHUB_API_BASE: "https://api.github.example",
    LOG_LEVEL: "error",
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("GitHub OAuth", () => {
  it("starts identity OAuth with state and S256 PKCE but no requested scope", async () => {
    const database = createDatabase();
    const response = await startGithubOAuth(
      new Request("https://forge.example/github/start?access=identity&returnTo=%2Faccount"),
      testEnv(database)
    );
    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("Location") ?? "");
    expect(location.origin).toBe("https://github.example");
    expect(location.pathname).toBe("/login/oauth/authorize");
    expect(location.searchParams.get("scope")).toBeNull();
    expect(location.searchParams.get("state")).toBeTruthy();
    expect(location.searchParams.get("code_challenge_method")).toBe("S256");
    expect(location.searchParams.get("code_challenge")).toHaveLength(43);
    expect(database.states.size).toBe(1);
  });

  it("rejects an external return target before persisting OAuth state", async () => {
    const database = createDatabase();
    const response = await startGithubOAuth(
      new Request(
        "https://forge.example/github/start?access=read&returnTo=https%3A%2F%2Fevil.example"
      ),
      testEnv(database)
    );
    expect(response.status).toBe(400);
    expect(database.states.size).toBe(0);
  });

  it("consumes state once, verifies the numeric user id, and establishes a session", async () => {
    const database = createDatabase();
    const environment = testEnv(database);
    const started = await startGithubOAuth(
      new Request("https://forge.example/github/start?access=identity&returnTo=%2Faccount"),
      environment
    );
    const state = new URL(started.headers.get("Location") ?? "").searchParams.get("state");
    expect(state).toBeTruthy();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (input.endsWith("/access_token"))
          return Response.json({
            access_token: "transient-token",
            token_type: "bearer",
            scope: "",
          });
        return Response.json(
          { id: 42, login: "mutable-login" },
          { headers: { "X-OAuth-Scopes": "" } }
        );
      })
    );
    const completed = await completeGithubOAuth(
      new Request(`https://forge.example/github/callback?state=${state}&code=provider-code`),
      environment
    );
    expect(completed.status).toBe(302);
    expect(completed.headers.get("Location")).toBe("/account");
    expect(completed.headers.get("Set-Cookie")).toContain("gitedge_session=");
    expect(database.states.size).toBe(0);
    expect(database.sessions.size).toBe(1);

    const replay = await completeGithubOAuth(
      new Request(`https://forge.example/github/callback?state=${state}&code=provider-code`),
      environment
    );
    expect(replay.status).toBe(400);
  });

  it("rejects a read grant that includes a broader scope", async () => {
    const database = createDatabase();
    const environment = testEnv(database);
    const started = await startGithubOAuth(
      new Request("https://forge.example/github/start?access=read&returnTo=%2Faccount"),
      environment
    );
    const state = new URL(started.headers.get("Location") ?? "").searchParams.get("state");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          access_token: "transient-token",
          token_type: "bearer",
          scope: "read:user,user:email,read:org,repo",
        })
      )
    );
    const completed = await completeGithubOAuth(
      new Request(`https://forge.example/github/callback?state=${state}&code=provider-code`),
      environment
    );
    expect(completed.status).toBe(302);
    expect(completed.headers.get("Location")).toBe("/account?error=github_oauth_failed");
    expect(database.sessions.size).toBe(0);
  });
});
