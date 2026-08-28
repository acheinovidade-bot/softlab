# Catálogo de produtos

O catálogo usa o módulo SaaS `catalog` e permissões separadas para consulta, manutenção, custo e preço. Produtos são isolados por empresa e possuem código e código de barras únicos por tenant.

## Endpoints

- `GET|POST /api/v1/catalog/lookups[/:kind]`
- `GET|POST /api/v1/catalog/products`
- `GET|PATCH /api/v1/catalog/products/:id`
- `POST /api/v1/catalog/products/:id/prices`
- `PUT /api/v1/catalog/products/:id/branch-settings`

Os tipos de lookup são `groups`, `categories`, `brands`, `units` e `price-tables`. A listagem de produtos aceita `page`, `pageSize`, `search` e `status`.

## Preços e estoque

Alterações de preço geram um novo período de vigência; o preço anterior é encerrado, preservando histórico. Uma restrição única impede dois preços atuais para a mesma combinação de produto, tabela e filial. O custo só é retornado para `catalog.cost.read`.

Configurações de mínimo, máximo e localização são específicas por filial. Saldo atual não é gravado no produto: será calculado exclusivamente pelo ledger de estoque no próximo módulo.

## Fiscal e outros canais

NCM, CEST, origem, CFOP, CST, CSOSN e alíquotas configuráveis ficam disponíveis no cadastro. Regras fiscais completas continuam centralizadas em `tax_rules`, pois variam por regime, operação, origem, destino e vigência.

Produtos podem ser classificados como fabricados e preparados para delivery e setor de impressão. BOM, complementos, imagens e upload de mídia pertencem às etapas especializadas de produção, food service e armazenamento; nenhum arquivo ou dado externo é simulado nesta etapa.
