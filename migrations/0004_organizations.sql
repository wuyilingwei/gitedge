ALTER TABLE namespaces ADD COLUMN kind TEXT NOT NULL DEFAULT 'personal'
  CHECK (kind IN ('personal', 'organization'));
ALTER TABLE namespaces ADD COLUMN display_name TEXT NOT NULL DEFAULT '';
ALTER TABLE namespaces ADD COLUMN description TEXT NOT NULL DEFAULT '';

ALTER TABLE namespace_memberships ADD COLUMN role TEXT NOT NULL DEFAULT 'member'
  CHECK (role IN ('owner', 'member'));

UPDATE namespace_memberships
SET role = 'owner'
WHERE EXISTS (
  SELECT 1
  FROM namespaces
  WHERE namespaces.id = namespace_memberships.namespace_id
    AND namespaces.created_by = namespace_memberships.user_id
);

CREATE TRIGGER IF NOT EXISTS set_personal_namespace_owner
AFTER INSERT ON namespace_memberships
WHEN EXISTS (
  SELECT 1
  FROM namespaces
  WHERE namespaces.id = NEW.namespace_id
    AND namespaces.kind = 'personal'
    AND namespaces.created_by = NEW.user_id
)
BEGIN
  UPDATE namespace_memberships
  SET role = 'owner'
  WHERE namespace_id = NEW.namespace_id AND user_id = NEW.user_id;
END;

CREATE INDEX IF NOT EXISTS idx_namespaces_kind_slug ON namespaces(kind, slug);
CREATE INDEX IF NOT EXISTS idx_namespace_memberships_namespace_role
  ON namespace_memberships(namespace_id, role);
