INSERT INTO permissions (id, code, resource, action, created_at, updated_at) VALUES
  ('01992f00-0000-7000-8000-000000000001', 'admin.branches.read', 'admin.branches', 'read', now(), now()),
  ('01992f00-0000-7000-8000-000000000002', 'admin.branches.manage', 'admin.branches', 'manage', now(), now()),
  ('01992f00-0000-7000-8000-000000000003', 'admin.users.read', 'admin.users', 'read', now(), now()),
  ('01992f00-0000-7000-8000-000000000004', 'admin.users.manage', 'admin.users', 'manage', now(), now()),
  ('01992f00-0000-7000-8000-000000000005', 'admin.roles.read', 'admin.roles', 'read', now(), now()),
  ('01992f00-0000-7000-8000-000000000006', 'admin.roles.manage', 'admin.roles', 'manage', now(), now()),
  ('01992f00-0000-7000-8000-000000000007', 'admin.audit.read', 'admin.audit', 'read', now(), now())
ON CONFLICT (code) DO NOTHING;
