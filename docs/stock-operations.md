# Estoque atual e movimentações

O saldo é calculado por empresa, filial, localização, produto e lote. A API não possui endpoint para editar saldo diretamente: toda alteração cria uma movimentação imutável, atualiza o saldo e registra auditoria na mesma transação serializável.

## Endpoints

- `GET /api/v1/stock/overview`
- `GET /api/v1/stock/lookups`
- `GET /api/v1/stock/movements`
- `GET /api/v1/stock/lots?status=all|expired|15|30|60|90`
- `GET /api/v1/stock/fefo/:productId?quantity=`
- `POST /api/v1/stock/lots`
- `POST /api/v1/stock/adjustments`

O módulo contratado é `stock`. As permissões são `stock.inventory.read`, `stock.movements.read` e `stock.adjustments.create`.

## Regras

- Quantidades informadas pela interface são sempre positivas; a direção é determinada pelo tipo de movimento.
- Produtos que controlam lote exigem lote pertencente ao mesmo produto e empresa.
- Produtos sem controle de lote rejeitam lote.
- Saídas, perdas e ajustes negativos não podem consumir saldo reservado nem deixar disponível negativo, exceto quando o produto permite estoque negativo.
- A localização precisa pertencer à filial da sessão.
- Conflitos de concorrência serializável são repetidos até três vezes.
- O motivo fica registrado na auditoria vinculada à movimentação.
- Lotes com saldo disponível são classificados como vencidos, até 15, 30, 60 ou 90 dias.
- A prévia FEFO ignora lotes vencidos, ordena a validade mais próxima primeiro e informa eventual falta.
- A prévia FEFO é somente leitura: não reserva nem movimenta estoque.
- Produtos que controlam validade exigem uma data de validade ao cadastrar o lote.

A migration cria armazém `PRINCIPAL` e localização `GERAL` para filiais existentes. O bootstrap cria a mesma estrutura para novas instalações.
