INSERT INTO permissions (id, code, resource, action, created_at, updated_at)
VALUES ('01993000-0000-7000-8000-000000000001', 'fiscal.nfe.issue', 'fiscal.nfe', 'issue', now(), now())
ON CONFLICT (code) DO NOTHING;

INSERT INTO role_permissions (id, role_id, permission_id, created_at, updated_at)
SELECT gen_random_uuid(), r.id, p.id, now(), now()
FROM roles r JOIN permissions p ON p.code = 'fiscal.nfe.issue'
WHERE r.code = 'owner'
ON CONFLICT (role_id, permission_id) DO NOTHING;
