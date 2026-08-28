# Cotação inteligente

Uma sugestão calculada pode ser convertida uma única vez em cotação. Somente itens com quantidade sugerida positiva são incluídos, e fornecedores ativos relacionados a qualquer produto são convidados automaticamente.

## Convites externos

Cada fornecedor recebe um token aleatório de 256 bits. Apenas o SHA-256 é persistido; o token aparece uma vez no link e pode ser rotacionado pelo usuário. O portal público permite responder ou atualizar a proposta até o prazo, sem conta no ERP.

O compartilhamento assistido abre o WhatsApp com mensagem e link preenchidos. O envio automatizado, templates, webhooks e estados de entrega pertencem à etapa de integração oficial do WhatsApp e não são simulados aqui.

## Mapa comparativo

O ERP compara por produto:

- menor preço unitário;
- menor prazo de entrega;
- maior prazo de pagamento informado;
- último preço conhecido do mesmo fornecedor;
- variação contra o último preço;
- economia potencial entre a maior e a menor proposta para a quantidade solicitada.

Condições textuais, marcas, disponibilidade parcial e observações permanecem visíveis e não são convertidas em pontuações arbitrárias.

## Segurança e integridade

- permissões internas `purchases.quotations.read` e `purchases.quotations.manage`;
- cotação, sugestão, produtos e fornecedores validados por empresa e filial;
- uma cotação por sugestão;
- um produto por cotação e uma resposta por fornecedor/item;
- prazo máximo de convite de 60 dias;
- respostas expiradas e itens externos são rejeitados;
- criação, rotação de link e resposta são auditadas em transações.
