# Delivery e logística

O módulo `logistics` organiza entregas em um Kanban operacional e mantém cada registro isolado por empresa e filial.

## Fluxo

Uma entrega percorre `new`, `confirmed`, `preparing`, `ready`, `out_for_delivery` e `delivered`. O avanço é sequencial. Ao iniciar `out_for_delivery`, a interface exige a seleção de um entregador ativo. A conclusão da entrega também conclui o pedido de venda vinculado. O cancelamento é permitido somente antes da saída para entrega.

## Taxas e zonas

As zonas podem ser configuradas por bairro, CEP, distância ou raio. Na criação da entrega, o serviço compara o endereço e a distância informada com as zonas ativas da filial e aplica a menor taxa compatível. O valor calculado fica gravado na entrega para preservar o histórico.

Os cadastros de entregadores e zonas ficam em **Configurações → Delivery**. O quadro de Delivery permanece dedicado à operação e ao avanço das entregas.

Para uma zona por raio, marque no Google Maps o ponto central e informe o alcance em quilômetros. Ao criar a entrega, marque a localização do endereço. A API calcula a distância geográfica pela fórmula de Haversine, sem confiar em uma taxa calculada pelo navegador. Configure `VITE_GOOGLE_MAPS_API_KEY` no ambiente web e restrinja a chave no Google Cloud às origens autorizadas e à Maps JavaScript API.

## API

- `GET /api/v1/delivery/overview`: quadro, entregadores, zonas e pedidos elegíveis.
- `POST /api/v1/delivery`: cria uma entrega vinculada ao pedido e endereço do cliente.
- `POST /api/v1/delivery/:id/transition`: avança ou cancela o fluxo.
- `POST /api/v1/delivery/drivers`: cadastra entregador.
- `POST /api/v1/delivery/zones`: cadastra regra e taxa de entrega.

## Permissões

- `logistics.deliveries.read`: consulta do quadro.
- `logistics.deliveries.operate`: criação, despacho e mudança de status.
- `logistics.settings.manage`: cadastro de entregadores e zonas.

Todas as consultas operacionais recebem o contexto autenticado da empresa. Pedidos, endereços, zonas e entregadores são validados no servidor antes da gravação, e transições geram eventos de auditoria.
