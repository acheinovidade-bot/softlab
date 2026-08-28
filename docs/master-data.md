# Cadastros mestres

Clientes, fornecedores e funcionários são isolados por `companyId`, possuem busca paginada, ativação/inativação e auditoria transacional. Não há exclusão física pela API.

## Endpoints

- `GET|POST /api/v1/master/customers`
- `GET|PATCH /api/v1/master/customers/:id`
- `PUT /api/v1/master/customers/:id/addresses`
- `GET|POST /api/v1/master/suppliers`
- `PATCH /api/v1/master/suppliers/:id`
- catálogo e comparação de produtos em `/api/v1/master/supplier-products`; consulte `docs/supplier-catalog.md`
- `GET|POST /api/v1/master/employees`
- `PATCH /api/v1/master/employees/:id`

Listagens aceitam `page`, `pageSize`, `search` e `status=active|inactive|all`. Clientes exigem o módulo `sales`, fornecedores exigem `purchases` e funcionários exigem `core`, além das permissões `master.*.read|manage`.

## Integridade

CPF/CNPJ e códigos são únicos dentro da empresa conforme o baseline. A filial e o usuário opcional de um funcionário são validados contra a empresa do token. Endereços de cliente são substituídos em uma única transação, junto da auditoria.

Histórico de compras, ticket médio, pontos, cashback, produtos por fornecedor e comparação de preços serão derivados dos módulos transacionais correspondentes, evitando duplicação de dados ou indicadores fictícios. Consultas externas de CNPJ/CEP estão disponíveis como sugestões confirmáveis quando a BrasilAPI está configurada; consulte `docs/customer-enrichment.md`.
