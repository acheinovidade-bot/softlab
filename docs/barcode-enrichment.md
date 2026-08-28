# Enriquecimento por código de barras

O endpoint `GET /api/v1/catalog/barcodes/:barcode/suggestion` consulta o Open Food Facts quando `BARCODE_LOOKUP_PROVIDER=openfoodfacts`. O provedor usa dados comunitários, portanto a API retorna uma sugestão com avisos e a interface exige confirmação explícita antes de preencher qualquer campo.

O código GTIN é validado por comprimento e dígito verificador antes da chamada externa. Consultas exigem o módulo `catalog`, a permissão `catalog.products.manage` e são limitadas a 60 por empresa por minuto no Redis. Timeout e falhas externas retornam indisponibilidade controlada; produto não encontrado não é tratado como erro.

Variáveis:

- `BARCODE_LOOKUP_PROVIDER=disabled|openfoodfacts`
- `OPENFOODFACTS_USER_AGENT`, identificação obrigatória solicitada pelo provedor
- `BARCODE_LOOKUP_TIMEOUT_MS`, entre 1000 e 15000

Somente descrição, descrição reduzida, marca textual, imagem de referência e embalagem podem ser sugeridas. NCM e demais dados fiscais nunca são inferidos pelo Open Food Facts. A imagem externa é apenas visualizada; ela não é incorporada ao armazenamento do ERP sem uma etapa explícita de upload.

Fontes técnicas: [API atual v3 do Open Food Facts](https://openfoodfacts.github.io/openfoodfacts-server/api/) e [orientações oficiais de leitura e identificação por User-Agent](https://openfoodfacts.github.io/documentation/docs/Product-Opener/v3/products/get-api-v3-product-code/).
