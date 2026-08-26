import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface D1Binding {
  binding: string;
  database_name: string;
  database_id: string;
  migrations_dir: string;
}

interface KvBinding {
  binding: string;
  id: string;
}

interface WorkerConfig {
  account_id?: string;
  assets?: {
    binding: string;
    directory: string;
    html_handling: string;
    not_found_handling?: string;
  };
  d1_databases?: D1Binding[];
  kv_namespaces?: KvBinding[];
  observability?: { enabled: boolean };
  queues?: {
    producers: Array<{ binding: string; queue: string }>;
    consumers: Array<{ queue: string; max_batch_size: number; max_batch_timeout: number }>;
  };
  r2_buckets?: Array<{ binding: string; bucket_name: string }>;
  routes?: unknown[];
  services?: Array<{ binding: string; service: string }>;
  workers_dev?: boolean;
  vars?: Record<string, string>;
  durable_objects?: { bindings: Array<{ name: string; class_name: string }> };
  migrations?: Array<{ tag: string; new_sqlite_classes: string[] }>;
}

const targetAccountId = "df4481f3ce1fa0394b4617442a97d147";
const targetDomain = "gitedge.wuyilingwei.com";
const targetD1Id = "c9a00d9d-db41-494e-b096-55b8b6bfe3a9";
const targetKvId = "ece920cc5b2b4d4ca8972716ee16e4b4";
const serviceNames = ["auth", "forge", "git", "gateway"] as const;

function readWorkerConfig(service: (typeof serviceNames)[number]): WorkerConfig {
  const configPath = new URL(`../workers/${service}/wrangler.jsonc`, import.meta.url);
  return JSON.parse(readFileSync(configPath, "utf8")) as WorkerConfig;
}

function d1Binding(config: WorkerConfig): D1Binding {
  expect(config.d1_databases).toHaveLength(1);
  return config.d1_databases![0]!;
}

function kvBinding(config: WorkerConfig): KvBinding {
  expect(config.kv_namespaces).toHaveLength(1);
  return config.kv_namespaces![0]!;
}

describe("production deployment configuration", () => {
  const configs = Object.fromEntries(
    serviceNames.map((service) => [service, readWorkerConfig(service)])
  ) as Record<(typeof serviceNames)[number], WorkerConfig>;

  it("targets the intended Cloudflare account", () => {
    for (const service of serviceNames) {
      expect(configs[service].account_id).toBe(targetAccountId);
    }
  });

  it("exposes only Gateway on the production custom domain", () => {
    const gateway = configs.gateway;
    expect(gateway.workers_dev).toBe(false);
    expect(gateway.routes).toEqual([{ pattern: targetDomain, custom_domain: true }]);

    for (const service of ["auth", "forge", "git"] as const) {
      expect(configs[service].workers_dev).toBe(false);
      expect(configs[service].routes).toBeUndefined();
    }
  });

  it("connects Gateway to every internal service and its Vue assets", () => {
    expect(configs.gateway.services).toEqual([
      { binding: "AUTH", service: "gitedge-auth" },
      { binding: "FORGE", service: "gitedge-forge" },
      { binding: "GIT", service: "gitedge-git" },
    ]);
    expect(configs.gateway.assets).toEqual({
      binding: "ASSETS",
      directory: "../../apps/web/dist",
      html_handling: "none",
      not_found_handling: "none",
    });
  });

  it("keeps D1 and the migration directory consistent across services", () => {
    const authD1 = d1Binding(configs.auth);
    const forgeD1 = d1Binding(configs.forge);
    const gitD1 = d1Binding(configs.git);

    expect(authD1).toEqual(forgeD1);
    expect(forgeD1).toEqual(gitD1);
    expect(authD1.binding).toBe("DB");
    expect(authD1.database_name).toBe("gitedge");
    expect(authD1.database_id).toBe(targetD1Id);
    expect(authD1.migrations_dir).toBe("../../migrations");
    expect(readdirSync(new URL("../migrations/", import.meta.url))).toContain(
      "0001_auth_forge.sql"
    );
    expect(readdirSync(new URL("../migrations/", import.meta.url))).toContain(
      "0002_user_groups.sql"
    );
  });

  it("keeps signup, group quotas, and the strict IP limiter explicit", () => {
    expect(configs.auth.vars).toMatchObject({
      ALLOW_PUBLIC_SIGNUP: "true",
      DEFAULT_USER_GROUP: "free",
    });
    const groupLimitsJson = configs.gateway.vars?.USER_GROUP_LIMITS_JSON;
    expect(groupLimitsJson).toBeTruthy();
    expect(configs.forge.vars?.USER_GROUP_LIMITS_JSON).toBe(groupLimitsJson);
    expect(configs.git.vars?.USER_GROUP_LIMITS_JSON).toBe(groupLimitsJson);
    expect(JSON.parse(groupLimitsJson!)).toMatchObject({
      free: { rpm: 120, maxRepositories: 10 },
      team: { rpm: 600, maxRepositories: 100 },
      admin: { rpm: 1200, maxRepositories: 1000 },
    });
    expect(configs.gateway.vars?.IP_RPM_LIMIT).toBe("300");
    expect(configs.gateway.durable_objects?.bindings).toEqual([
      { name: "RATE_LIMITER", class_name: "RateLimitDurableObject" },
    ]);
    expect(configs.gateway.migrations).toEqual([
      { tag: "v1", new_sqlite_classes: ["RateLimitDurableObject"] },
    ]);
  });

  it("keeps Forge and Git on the same route-cache KV namespace", () => {
    const forgeKv = kvBinding(configs.forge);
    const gitKv = kvBinding(configs.git);

    expect(forgeKv).toEqual(gitKv);
    expect(forgeKv.binding).toBe("ROUTES");
    expect(forgeKv.id).toBe(targetKvId);
  });

  it("connects Git to the production R2 bucket and maintenance queue", () => {
    expect(configs.git.r2_buckets).toEqual([
      { binding: "REPO_BUCKET", bucket_name: "gitedge-git-repos" },
    ]);
    expect(configs.git.queues).toEqual({
      producers: [{ binding: "REPO_TASKS_QUEUE", queue: "gitedge-git-repo-maint" }],
      consumers: [{ queue: "gitedge-git-repo-maint", max_batch_size: 1, max_batch_timeout: 1 }],
    });
  });

  it("enables observability for every service", () => {
    for (const service of serviceNames) {
      expect(configs[service].observability).toEqual({ enabled: true });
    }
  });

  it("deploys the declared topology and applies the shared migration through Auth", () => {
    const deployScript = readFileSync(
      new URL("../scripts/deploy-stack.mjs", import.meta.url),
      "utf8"
    );

    expect(deployScript).toContain('"gitedge"');
    expect(deployScript).toContain('"workers/auth/wrangler.jsonc"');
    expect(deployScript).toContain('for (const service of ["auth", "forge", "git", "gateway"])');
    expect(deployScript).toContain("`workers/${service}/wrangler.jsonc`");
  });
});
