# Aplicativo móvel de força de vendas

O aplicativo é uma área responsiva e instalável do mesmo PWA do ERP. Pode ser aberto diretamente em `/forca-vendas`, mantendo autenticação, empresa, filial e permissões do usuário.

Catálogo, clientes e históricos consultados ficam armazenados no IndexedDB do aparelho. Sem sinal, novos clientes e pedidos entram em uma fila local identificada por empresa, filial e vendedor. Quando a conexão retorna, a fila é processada na ordem original: primeiro o cadastro do cliente, depois os pedidos dependentes. O servidor recalcula preços e tenta reservar o estoque nesse momento; se não houver saldo, a operação permanece pendente com o erro para tratamento, pois o celular offline não pode prometer disponibilidade concorrente.

Funcionalidades:

- criação de pedido pelo celular a partir do catálogo e preço vigentes;
- cadastro rápido de pessoa física ou jurídica;
- consulta do histórico de pedidos e itens por cliente;
- emissão de NF-e modelo 55 para vendas já faturadas e elegíveis;
- sugestão por cliente baseada em frequência, intervalo médio e quantidade histórica de compra.

O pedido móvel utiliza o fluxo comercial existente: cria orçamento, registra envio e aprovação e converte em pedido já separado. Na mesma transação serializável, o sistema escolhe os saldos pela ordem FEFO, grava local/lote e incrementa a quantidade reservada. Se o saldo disponível não cobrir todo o pedido, nada é criado. A emissão de NF-e continua dependente do faturamento e da conclusão da venda, preservando estoque, rastreabilidade e regras fiscais. A API nunca aceita preços calculados apenas pelo celular.

As sugestões são determinísticas e explicáveis: agrupam produtos do histórico, calculam intervalo médio entre compras e sinalizam itens cuja recompra está próxima ou atrasada. Empresas sem histórico recebem o catálogo normal, sem inventar recomendações.
