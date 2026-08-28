# Catálogo de fornecedores

Cada fornecedor pode ser relacionado aos produtos internos com código e descrição próprios. A operação de substituição preserva o `last_price` dos vínculos mantidos; esse valor pertence ao histórico de compras e não pode ser digitado pela interface.

## Endpoints

- `GET /api/v1/master/supplier-products/catalog?search=`
- `GET /api/v1/master/supplier-products/supplier/:supplierId`
- `PUT /api/v1/master/supplier-products/supplier/:supplierId`
- `GET /api/v1/master/supplier-products/comparison/:productId`

Os endpoints exigem autenticação e módulo `purchases`. Leituras usam `master.suppliers.read`; substituição de vínculos usa `master.suppliers.manage` e grava auditoria na mesma transação.

## Integridade

Fornecedor, produto e vínculo são sempre filtrados por `companyId`. As FKs compostas do banco impedem relacionamentos entre tenants. A comparação ordena apenas preços efetivamente registrados; valores ausentes são identificados como tal e nunca estimados.
