# PDV offline e sincronização

O front-end é instalável como PWA. O service worker mantém o shell visual no cache do navegador, enquanto o catálogo, clientes, vendedores, locais e formas de pagamento mais recentes ficam armazenados em IndexedDB por empresa e filial.

Quando o checkout perde comunicação:

1. a venda é gravada localmente com a chave de idempotência original;
2. o operador recebe um comprovante provisório `OFF-*` e pode continuar vendendo;
3. o cabeçalho informa o estado offline e a quantidade de vendas pendentes;
4. ao recuperar a conexão, a fila é enviada em ordem cronológica;
5. o servidor processa cada venda de forma transacional e impede duplicidade pela chave original.

Erros de negócio, como estoque insuficiente ou limite de crédito excedido, não são confundidos com queda de conexão. Eles permanecem pendentes com o erro registrado para tratamento, sem serem descartados.

O cache é separado por empresa e filial. Para operação real, o dispositivo deve ser individualizado e protegido por autenticação do sistema operacional, pois a fila pode conter identificadores comerciais locais.
