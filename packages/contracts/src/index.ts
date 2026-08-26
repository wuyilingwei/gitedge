import { z } from "zod";

export const ErrorCodeSchema = z.enum([
  "bad_request",
  "unauthorized",
  "forbidden",
  "not_found",
  "conflict",
  "method_not_allowed",
  "internal_error",
]);

export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export type ServiceError = {
  readonly error: { readonly code: ErrorCode; readonly message: string };
};

export type ServiceResult<T> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly status: number; readonly error: ServiceError["error"] };

export type TrustedUser = { readonly id: string; readonly identifier: string };

export type UserGroupLimits = {
  readonly rpm: number;
  readonly maxRepositories: number;
  readonly maxPushBytes: number;
  readonly maxRepositoryBytes: number;
  readonly maxStorageBytes: number;
};

export const DEFAULT_USER_GROUP_LIMITS: Readonly<Record<string, UserGroupLimits>> = {
  free: {
    rpm: 120,
    maxRepositories: 10,
    maxPushBytes: 268_435_456,
    maxRepositoryBytes: 1_073_741_824,
    maxStorageBytes: 5_368_709_120,
  },
  team: {
    rpm: 600,
    maxRepositories: 100,
    maxPushBytes: 1_073_741_824,
    maxRepositoryBytes: 10_737_418_240,
    maxStorageBytes: 107_374_182_400,
  },
  admin: {
    rpm: 1200,
    maxRepositories: 1_000,
    maxPushBytes: 5_368_709_120,
    maxRepositoryBytes: 107_374_182_400,
    maxStorageBytes: 1_099_511_627_776,
  },
};

export function parseUserGroupLimits(value: string | undefined): Record<string, UserGroupLimits> {
  if (!value) return { ...DEFAULT_USER_GROUP_LIMITS };
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return { ...DEFAULT_USER_GROUP_LIMITS };
    }
    const result: Record<string, UserGroupLimits> = { ...DEFAULT_USER_GROUP_LIMITS };
    for (const [groupKey, raw] of Object.entries(parsed)) {
      if (typeof raw === "number" && Number.isSafeInteger(raw) && raw > 0) {
        result[groupKey] = { ...result.free, rpm: raw };
        continue;
      }
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) continue;
      const base = result[groupKey] ?? result.free;
      const candidate = { ...base };
      for (const field of [
        "rpm",
        "maxRepositories",
        "maxPushBytes",
        "maxRepositoryBytes",
        "maxStorageBytes",
      ] as const) {
        const next = raw[field];
        if (typeof next === "number" && Number.isSafeInteger(next) && next > 0) candidate[field] = next;
      }
      result[groupKey] = candidate;
    }
    return result;
  } catch {
    return { ...DEFAULT_USER_GROUP_LIMITS };
  }
}

export const RepositoryRouteCacheRecordSchema = z.object({
  repositoryId: z.string(),
  namespaceId: z.string(),
  doName: z.string(),
  updatedAt: z.number(),
});

export type RepositoryRouteCacheRecord = z.infer<typeof RepositoryRouteCacheRecordSchema>;

export function repositoryRouteCacheKey(namespaceSlug: string, repositorySlug: string): string {
  return `repo-route:v1:${namespaceSlug}/${repositorySlug}`;
}

export const RegisterInputSchema = z.object({
  identifier: z.string().trim().min(3).max(64),
  password: z.string().min(12).max(256),
});

export const LoginInputSchema = RegisterInputSchema;

export const CreateRepositoryInputSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{0,62}$/),
  visibility: z.enum(["public", "private"]),
  description: z.string().trim().max(500).default(""),
});

export const CreateIssueInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().max(50_000).default(""),
});

export const UpdateIssueInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    body: z.string().max(50_000).optional(),
    state: z.enum(["open", "closed"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export const CreatePullRequestInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().max(50_000).default(""),
  baseRef: z.string().trim().min(1).max(255),
  headRef: z.string().trim().min(1).max(255),
});

export const UpdatePullRequestInputSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    body: z.string().max(50_000).optional(),
    state: z.enum(["open", "closed"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0);

export const PutWikiPageInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().max(100_000),
  expectedRevision: z.number().int().nonnegative().optional(),
});
