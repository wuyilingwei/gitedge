import { DurableObject } from "cloudflare:workers";

export interface RateLimitDecision {
  allowed: boolean;
  retryAfter: number;
}

export interface RateLimitStub {
  consume(key: string, limit: number, now?: number): Promise<RateLimitDecision>;
}

export interface RateLimitNamespace {
  getByName(name: string): RateLimitStub;
}

type HitRow = { at: number };

export class RateLimitDurableObject extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      ctx.storage.sql.exec(
        "CREATE TABLE IF NOT EXISTS rate_limit_hits (key TEXT NOT NULL, at INTEGER NOT NULL)"
      );
      ctx.storage.sql.exec(
        "CREATE INDEX IF NOT EXISTS rate_limit_hits_key_at ON rate_limit_hits (key, at)"
      );
    });
  }

  async consume(key: string, limit: number, now = Date.now()): Promise<RateLimitDecision> {
    const safeLimit = Number.isFinite(limit) ? Math.floor(limit) : 0;
    const cutoff = now - 60_000;
    this.ctx.storage.sql.exec("DELETE FROM rate_limit_hits WHERE key = ? AND at <= ?", key, cutoff);
    const count = this.ctx.storage.sql
      .exec<{ count: number }>(
        "SELECT COUNT(*) AS count FROM rate_limit_hits WHERE key = ? AND at > ?",
        key,
        cutoff
      )
      .one().count;
    if (safeLimit <= 0 || count >= safeLimit) {
      const oldest = this.ctx.storage.sql
        .exec<HitRow>(
          "SELECT at FROM rate_limit_hits WHERE key = ? AND at > ? ORDER BY at ASC LIMIT 1",
          key,
          cutoff
        )
        .toArray()[0]?.at;
      return { allowed: false, retryAfter: Math.max(1, Math.ceil(((oldest ?? now) + 60_000 - now) / 1000)) };
    }
    this.ctx.storage.sql.exec("INSERT INTO rate_limit_hits (key, at) VALUES (?, ?)", key, now);
    return { allowed: true, retryAfter: 0 };
  }
}

const SHARD_COUNT = 32;

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function consumeRateLimit(
  namespace: RateLimitNamespace,
  key: string,
  limit: number
): Promise<RateLimitDecision> {
  const digest = await sha256Hex(key);
  const shard = Number.parseInt(digest.slice(0, 2), 16) % SHARD_COUNT;
  return namespace.getByName(`rate-limit-${shard}`).consume(digest, limit);
}
