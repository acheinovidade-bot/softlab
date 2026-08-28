# Inteligência de compras

O motor cria fotografias auditáveis de reposição por empresa e filial. Um cálculo não gera pedidos nem altera estoque.

## Entradas consideradas

- média diária das vendas no histórico escolhido;
- tendência dos períodos recentes, limitada entre `0,75` e `1,50`;
- sazonalidade do mesmo horizonte no ano anterior, também limitada entre `0,75` e `1,50`;
- estoque físico menos reservas da filial;
- estoque mínimo e máximo configurados por produto/filial;
- pedidos de compra aprovados, pedidos, parciais e em trânsito;
- menor prazo conhecido entre fornecedores ativos do produto.

## Fórmula

`demanda ajustada = média diária × tendência × sazonalidade`

`alvo bruto = demanda do horizonte + demanda durante o prazo + estoque de segurança`

Quando existe estoque máximo, o alvo é limitado a ele. A sugestão final é o alvo menos estoque disponível, compras pendentes e compras em trânsito, nunca ficando negativa. Quantidades são arredondadas para cima em seis casas decimais.

Produtos sem vendas ainda podem ser sugeridos através do estoque mínimo. Fatores ausentes assumem valor neutro `1` e prazo desconhecido assume zero dias, deixando essa limitação visível no resultado.

## Operação e segurança

- horizontes padrão: 7, 15, 30, 45 e 60 dias;
- horizonte personalizado entre 1 e 180 dias;
- histórico entre 30 e 730 dias;
- permissões `purchases.suggestions.read` e `purchases.suggestions.calculate`;
- consultas e registros isolados por empresa e filial;
- parâmetros, fórmula e explicações persistidos com a sugestão;
- geração registrada na auditoria.
