# Planos, assinaturas e módulos

O acesso de uma empresa depende de uma assinatura vigente. Login e renovação de sessão exigem status `trial` ou `active`, período atual não vencido, plano ativo e ausência de bloqueio. Estados `past_due`, `blocked` e `canceled` não emitem novos tokens.

## Direitos efetivos

Os módulos padrão vêm de `plan_modules`. Registros em `subscription_modules` funcionam como sobrescritas: `enabled=true` inclui um adicional e `enabled=false` remove um módulo do plano. Somente módulos ativos entram no JWT.

Endpoints de domínio devem declarar `RequireModules`, além das permissões funcionais. O guard global retorna `403` quando o módulo necessário não foi contratado.

## Limites

Criação e reativação de filiais ou usuários respeitam `branch_limit` e `user_limit`. A verificação ocorre na mesma transação da gravação e usa advisory lock por empresa, impedindo duas requisições concorrentes de ultrapassarem o limite.

## Catálogo inicial

A migration `20260826040000_saas_entitlements` cria índices e invariantes e cadastra o plano `starter`, com cinco usuários, duas filiais e os módulos `core`, `catalog`, `stock`, `sales` e `purchases`. Também cadastra os demais módulos previstos pelo ERP para contratação futura.

O bootstrap cria uma assinatura `trial` de 14 dias. Alterações comerciais de plano, cobrança e módulos adicionais pertencem à futura interface de operação da plataforma ou ao provedor de billing; administradores de uma empresa cliente possuem apenas consulta, evitando que liberem o próprio plano.

## Consulta

`GET /api/v1/admin/subscription` retorna plano, status, período, consumo de usuários/filiais e módulos efetivamente habilitados. Requer `admin.subscription.read` e o módulo `core`.
