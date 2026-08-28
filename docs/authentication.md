# Autenticação e autorização

O login exige e-mail, senha, empresa e filial. A API valida simultaneamente o usuário, o vínculo com a empresa, o acesso à filial e o status de todos os registros.

O access token é JWT HS256 de curta duração, permanece apenas em memória no frontend e contém `sub`, `companyId`, `branchId`, `sessionId`, permissões e módulos efetivos. Login e refresh também validam a assinatura SaaS. O refresh token é opaco, armazenado no banco apenas como SHA-256 e enviado ao navegador em cookie `HttpOnly`, `SameSite=Strict`; ele é rotacionado a cada uso.

Senhas são processadas com Argon2id, 64 MiB de memória, três iterações e paralelismo um. A política exige no mínimo 12 caracteres, maiúscula, minúscula, número e caractere especial.

Tentativas de login são limitadas no Redis e registradas de forma imutável. O e-mail aparece apenas como hash nos logs de tentativa. Recuperação de senha sempre responde da mesma maneira, exista ou não a conta.

## Endpoints

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `GET /api/v1/auth/me`
- `PATCH /api/v1/auth/password`

Rotas são protegidas globalmente. Somente handlers marcados como públicos dispensam JWT. Permissões específicas são declaradas com `RequirePermissions` e todas as permissões solicitadas precisam estar presentes.
