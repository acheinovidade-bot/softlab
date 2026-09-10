# ERP Híbrido

Fundação do ERP SaaS multiempresa e multifilial.

## Requisitos

- Node.js 20+
- pnpm 9.15+
- Docker com Compose

## Execução local

1. Copie `.env.example` para `.env`.
2. Execute `docker compose up -d`.
3. Execute `pnpm install`.
4. Execute `pnpm db:generate`.
5. Execute `pnpm --filter @erp/api prisma migrate deploy`.
6. Execute `pnpm --filter @erp/api prisma:bootstrap` para criar a primeira empresa e o administrador.
7. Execute `pnpm dev`.

Web: `http://localhost:5173`. API: `http://localhost:3000/api/v1`. Swagger: `http://localhost:3000/docs`.

## Qualidade

Execute `pnpm check` para lint, tipos, testes e builds. O health check retorna `503` quando PostgreSQL ou Redis estiver indisponível.

O repositório usa a branch `main` e executa o mesmo conjunto de verificações no GitHub Actions em cada `push` e `pull_request`.

## Banco e rollback

O baseline relacional está em `apps/api/prisma/migrations/20260826010000_initial_erp_schema/migration.sql`; autenticação e permissões administrativas são evoluções posteriores no mesmo histórico. Aplique tudo com `pnpm --filter @erp/api prisma migrate deploy`. Em produção, migrations nunca são revertidas apagando histórico: uma migration corretiva explícita deve ser criada e testada em restauração.

## Segurança

Não versione `.env`. Em produção, use secrets do provedor, restrinja `CORS_ORIGINS`, defina `SWAGGER_ENABLED=false` e execute PostgreSQL/Redis em rede privada.

A autenticação requer `ACCESS_TOKEN_SECRET` com pelo menos 32 caracteres. Consulte `docs/authentication.md` para os fluxos de sessão, `docs/admin-access.md` para administração multiempresa, `docs/saas-entitlements.md` para planos, `docs/master-data.md` para cadastros, `docs/customer-enrichment.md` para consultas de CNPJ/CEP, `docs/supplier-catalog.md` para produtos por fornecedor, `docs/product-catalog.md` para produtos, `docs/barcode-enrichment.md` para sugestões por GTIN, `docs/stock-operations.md` para estoque, `docs/purchase-xml-import.md` para importação de NF-e, `docs/purchase-intelligence.md` para o motor de reposição, `docs/smart-quotations.md` para cotações, `docs/whatsapp-gateway.md` para o gateway não oficial, `docs/production-orders.md` para engenharia e produção, `docs/sales-workflow.md` para orçamentos e pedidos, `docs/sales-force-mobile.md` para o aplicativo de força de vendas, `docs/pos.md` para o ponto de venda, `docs/pos-offline.md` para continuidade offline, `docs/cash-management.md` para o caixa diário, `docs/food-service.md` para mesas e comandas, `docs/digital-menu-qrcode.md` para o cardápio por QR Code, `docs/fiscal-hub-nfce.md` para NFC-e e impressão térmica de 80 mm e `docs/delivery-kanban.md` para entregas e logística com Google Maps.
