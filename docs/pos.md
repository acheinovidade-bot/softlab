# Ponto de Venda (PDV)

O PDV registra uma venda de balcão em uma única transação serializável. Pedido, itens, venda, baixa de estoque, rastreabilidade por lote, pagamentos e auditoria são confirmados juntos; qualquer falha desfaz todo o checkout.

## Operação

- `F2`: posiciona o cursor na busca por código, código de barras ou descrição.
- `F4`: posiciona o cursor no primeiro valor de pagamento.
- `F9`: finaliza a venda quando carrinho e pagamentos estão válidos.
- `Esc`: solicita confirmação antes de limpar a venda atual.
- Produtos com preço aberto permitem edição do valor. Descontos exigem `sales.pos.discount`.
- O pagamento pode ser dividido entre formas distintas, mas a soma deve coincidir exatamente com o total.

## Estoque e lotes

Produtos sem controle de lote baixam o saldo do local selecionado. Produtos controlados usam FEFO: os lotes com vencimento mais próximo são consumidos primeiro, podendo uma linha ser dividida entre vários lotes. Lotes vencidos ou sem validade são ignorados quando o produto controla validade. A tabela `sale_item_traces` mantém a ligação entre item, lote, quantidade e movimento de estoque.

## Idempotência e segurança

Cada tentativa recebe uma chave UUID. Os pagamentos armazenam essa chave com o prefixo `pos:` e uma repetição devolve o comprovante da operação já concluída, sem duplicar a venda. O acesso exige o módulo `sales` e a permissão `sales.pos.use`; descontos possuem autorização separada.

## Endpoints

- `GET /api/v1/sales/pos/lookups`: clientes, vendedores, locais, formas de pagamento, preços e disponibilidade.
- `POST /api/v1/sales/pos/checkout`: checkout atômico e resposta com pedido, venda, total e contagens.

Os pagamentos ficam vinculados ao pedido. A abertura, movimentação e conferência de gaveta serão tratadas pelo módulo de Caixa, sem alterar o histórico da venda.

## Crediário e extrato do cliente

A forma **Crediário** exige cliente identificado e vencimento. O checkout valida o limite contra todo o saldo aberto e cria uma conta a receber vinculada ao cupom. No botão **Extrato do cliente**, o operador filtra data inicial e final, visualiza os produtos de cada cupom, o valor original, os recebimentos e quanto ainda é devido ao final de cada venda.

Recebimentos podem ser parciais. Cada baixa usa idempotência, atualiza o saldo da conta, grava o histórico financeiro e, quando o operador possui caixa aberto, lança o recebimento automaticamente nessa sessão. As permissões são separadas em `sales.credit.read` e `sales.credit.receive`.
