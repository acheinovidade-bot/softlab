# Banco de dados

O baseline PostgreSQL contém 107 tabelas distribuídas entre SaaS, identidade, cadastros, catálogo, estoque, compras, vendas, caixa, financeiro, produção, fiscal, serviços, food service, logística, CRM, fidelidade, integrações e governança.

## Integridade multiempresa

Entidades operacionais carregam `company_id` e, quando aplicável, `branch_id`. Relações críticas usam chaves estrangeiras compostas `(id, company_id)`, impedindo que estoque, produto, pedido, financeiro ou documento fiscal apontem para registros pertencentes a outro tenant.

## Ledgers

`stock_movements`, `audit_logs` e `loyalty_transactions` são imutáveis por trigger. Correções devem ser registradas por lançamentos compensatórios, preservando o histórico.

## Concorrência

`stock_balances` possui uma dimensão única por filial, localização, produto e lote e uma coluna `version` para controle concorrente. Finalização de venda, produção, transferência e baixa financeira deverão bloquear ou atualizar saldos condicionalmente dentro de uma única transação.

## Identificadores

IDs são UUID sem default no banco. A aplicação será responsável por gerar UUIDv7 antes da persistência. Isso evita uma mistura silenciosa de versões de UUID.

## Aplicação

Com PostgreSQL disponível, execute `pnpm --filter @erp/api prisma migrate deploy`. O arquivo `migration_lock.toml` fixa PostgreSQL como provedor. Nunca edite uma migration já aplicada; crie uma migration corretiva.

## BI

As tabelas transacionais preservam chaves e datas necessárias às dimensões e fatos. Views analíticas e carga incremental serão adicionadas na fase de relatórios, em réplica ou banco analítico separado.
