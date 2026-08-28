# Administração de acessos

O módulo administrativo gerencia filiais, perfis, permissões e vínculos de usuários dentro da empresa presente no JWT. Consultas e alterações de recursos empresariais sempre filtram por `companyId`; filiais e perfis informados ao conceder acesso também são validados contra essa mesma empresa.

## Preparação inicial

Depois de configurar o `.env`, aplique as migrations e crie a primeira empresa:

```bash
pnpm --filter @erp/api prisma migrate deploy
pnpm --filter @erp/api prisma:bootstrap
```

O bootstrap é transacional e cria uma empresa, a filial `MATRIZ`, o primeiro administrador e o perfil `owner`, ligado a todas as permissões existentes. Ele deve ser executado uma única vez por empresa inicial. A saída informa os IDs necessários no primeiro login.

## Permissões

- `admin.branches.read` e `admin.branches.manage`
- `admin.users.read` e `admin.users.manage`
- `admin.roles.read` e `admin.roles.manage`
- `admin.audit.read`, reservada para a futura consulta de auditoria
- `admin.subscription.read`, para consultar plano, consumo e módulos

O menu web é filtrado pelas permissões do access token, mas isso é apenas uma conveniência visual. A API aplica a autorização novamente em cada endpoint.

## Endpoints

Todos os endpoints usam o prefixo `/api/v1` e exigem Bearer JWT:

- `GET|POST /admin/branches`
- `PATCH /admin/branches/:id`
- `GET /admin/permissions`
- `GET|POST /admin/roles`
- `PATCH /admin/roles/:id`
- `PUT /admin/roles/:id/permissions`
- `GET /admin/users`
- `POST /admin/users/invitations`
- `PATCH /admin/users/:id`
- `PUT /admin/users/:id/access`
- `GET /admin/subscription`

O identificador usado nas rotas de usuários é o vínculo `company_users.id`, não o ID global do usuário.

## Convites

Um convite de usuário novo cria uma credencial aleatória inacessível, um token de definição de senha válido por 24 horas e um evento `auth.user_invited` na outbox. Se o e-mail já pertencer a um usuário global, nenhuma redefinição de senha é criada; somente o vínculo com a empresa e o evento `auth.user_added_to_company` são registrados.

O processamento e envio dos eventos da outbox serão conectados ao provedor de mensagens na etapa de integrações. Até lá, nenhum e-mail é alegado como enviado. O token de uso único é persistido somente como hash na tabela de recuperação; a cópia necessária à entrega fica no evento pendente.

## Sessão web

O access token permanece apenas em memória. O refresh token fica em cookie `HttpOnly`, `SameSite=Strict`, limitado ao caminho `/api/v1/auth`; o frontend usa `credentials: include` ao renovar ou encerrar a sessão. Desativar um vínculo revoga todas as sessões abertas daquele usuário na empresa.

## Auditoria e integridade

Criação e alteração de filiais, perfis, permissões e acessos são gravadas em `audit_logs` na mesma transação da operação principal. A migration de permissões é idempotente pelo código. Restrições únicas e chaves estrangeiras do baseline complementam as validações de tenant feitas pela aplicação.
