PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY NOT NULL,
  identifier TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expiry ON auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS namespaces (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL COLLATE NOCASE UNIQUE,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS namespace_memberships (
  namespace_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY(namespace_id, user_id),
  FOREIGN KEY (namespace_id) REFERENCES namespaces(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_namespace_memberships_user_ns
  ON namespace_memberships(user_id, namespace_id);

CREATE TABLE IF NOT EXISTS repositories (
  id TEXT PRIMARY KEY NOT NULL,
  namespace_id TEXT NOT NULL,
  created_by TEXT NOT NULL,
  slug TEXT NOT NULL,
  do_name TEXT NOT NULL UNIQUE,
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'private')),
  description TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(namespace_id, slug),
  FOREIGN KEY (namespace_id) REFERENCES namespaces(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_repositories_namespace_updated
  ON repositories(namespace_id, updated_at DESC, slug);

CREATE TABLE IF NOT EXISTS personal_access_tokens (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL UNIQUE,
  hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER,
  revoked_at INTEGER,
  last_used_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pats_user_created
  ON personal_access_tokens(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS pat_namespace_grants (
  pat_id TEXT NOT NULL,
  namespace_id TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('pull', 'push')),
  PRIMARY KEY(pat_id, namespace_id),
  FOREIGN KEY (pat_id) REFERENCES personal_access_tokens(id) ON DELETE CASCADE,
  FOREIGN KEY (namespace_id) REFERENCES namespaces(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pat_namespace_grants_namespace
  ON pat_namespace_grants(namespace_id);

CREATE TABLE IF NOT EXISTS pat_repo_grants (
  pat_id TEXT NOT NULL,
  repo_id TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('pull', 'push')),
  PRIMARY KEY(pat_id, repo_id),
  FOREIGN KEY (pat_id) REFERENCES personal_access_tokens(id) ON DELETE CASCADE,
  FOREIGN KEY (repo_id) REFERENCES repositories(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_pat_repo_grants_repo ON pat_repo_grants(repo_id);

CREATE TABLE IF NOT EXISTS forge_issues (
  id TEXT PRIMARY KEY NOT NULL,
  repository_id TEXT NOT NULL,
  number INTEGER NOT NULL,
  author_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('open', 'closed')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(repository_id, number),
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS forge_pull_requests (
  id TEXT PRIMARY KEY NOT NULL,
  repository_id TEXT NOT NULL,
  number INTEGER NOT NULL,
  author_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  base_ref TEXT NOT NULL,
  head_ref TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('open', 'closed')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE(repository_id, number),
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS forge_wiki_pages (
  repository_id TEXT NOT NULL,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  revision INTEGER NOT NULL,
  updated_by TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY(repository_id, slug),
  FOREIGN KEY (repository_id) REFERENCES repositories(id) ON DELETE CASCADE,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT
);
