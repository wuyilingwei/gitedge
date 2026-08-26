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

export type TrustedUser = {
  readonly id: string;
  readonly identifier: string;
  readonly groupKey: string;
};

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
