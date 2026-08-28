# Cardápio digital por QR Code

Cada mesa ativa recebe um token público aleatório e exclusivo. No painel Food Service, o operador pode abrir, baixar e imprimir o QR Code que aponta para `/menu/{token}`.

O cliente acessa o cardápio sem login, escolhe os produtos marcados como disponíveis no delivery/cardápio, informa o nome e envia o pedido. A API valida novamente produtos e preços, abre ou reutiliza a comanda digital da mesa e grava os itens como `ordered`. A mesa passa para ocupada e o pedido aparece no fluxo normal do Food Service.

Endpoints públicos:

- `GET /api/v1/public/menu/:token`
- `POST /api/v1/public/menu/:token/orders`

O token não contém IDs de empresa ou filial. Pode ser rotacionado no banco caso um QR Code seja comprometido. A criação pública não aceita preço vindo do navegador e limita quantidade e tamanho do pedido.
