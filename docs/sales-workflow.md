# Orçamentos e pedidos de venda

O fluxo comercial implementado é **Orçamento → Aprovação → Pedido → Separação → Faturamento → Entrega → Conclusão**. A conversão copia o snapshot comercial do orçamento em uma única transação, sem recalcular ou exigir redigitação.

## Orçamento

- Cliente opcional, vendedor e forma de pagamento obrigatórios.
- Produtos, quantidade, preço, desconto por item, desconto geral, acréscimo, frete e observações.
- Preço vigente, preço aberto e preço mínimo são validados exclusivamente na API.
- Descontos exigem `sales.discounts.apply`.
- Totais são calculados no servidor e protegidos também por constraints no PostgreSQL.
- Fluxo: rascunho, enviado, aprovado, convertido, vencido ou cancelado.

## Pedido e separação

Somente orçamento aprovado e vigente pode ser convertido. A transação cria pedido, itens e pagamento pendente, além de marcar o orçamento como convertido. Na separação, todos os itens recebem localização e, quando controlado, lote. A API valida produto, filial, validade do vínculo e quantidade disponível, reservando o saldo em transação serializável.

O faturamento somente é liberado depois que todos os itens foram separados. Nessa passagem, uma transação cria a venda e seu snapshot tributário, baixa o saldo e a reserva, registra movimentos e gera rastreabilidade por lote. Cancelamentos anteriores ao faturamento liberam as reservas. A emissão do documento eletrônico permanece no módulo fiscal.

## Endpoints

- `GET /api/v1/sales/lookups`
- `GET|POST /api/v1/sales/quotes`
- `POST /api/v1/sales/quotes/:id/transition`
- `POST /api/v1/sales/quotes/:id/convert`
- `GET /api/v1/sales/orders`
- `GET /api/v1/sales/orders/:id`
- `PUT /api/v1/sales/orders/:id/allocation`
- `POST /api/v1/sales/orders/:id/transition`
