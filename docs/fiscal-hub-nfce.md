# Hub fiscal NFC-e

O hub também expõe emissão de NF-e modelo 55 em `POST /api/v1/fiscal/nfe/:saleId/issue`, protegida por `fiscal.nfe.issue`. Esse fluxo é usado pelo aplicativo Força de Vendas e exige destinatário com CPF/CNPJ e endereço completo. Configure `NFE_GATEWAY_URL` e `NFE_GATEWAY_TOKEN`; a integração usa chave de idempotência distinta da NFC-e.

O ERP integra provedores fiscais por um adaptador REST, sem armazenar o certificado digital no banco. A configuração da filial guarda somente uma referência ao segredo; o hub é responsável por resolver essa referência, assinar, transmitir e devolver a autorização.

## Contrato do provedor

- `POST {NFCE_GATEWAY_URL}/v1/nfce/issue`
- `Authorization: Bearer {NFCE_GATEWAY_TOKEN}`
- `Idempotency-Key: nfce:{companyId}:{saleId}`
- Resposta aceita somente com `status=authorized`, chave de acesso de 44 dígitos, protocolo, série, número, data e URL do QR Code.

Sem configuração, certificado referenciado ou dados fiscais completos do produto, a emissão é bloqueada com erro de conflito. Uma falha do hub nunca cria documento autorizado localmente.

## ERP

- `POST /api/v1/fiscal/settings`: configura regime, ambiente, referência do certificado e parâmetros do provedor.
- `POST /api/v1/fiscal/nfce/:saleId/issue`: emite de forma idempotente e persiste o documento autorizado.
- `F8`: emite e imprime o DANFE NFC-e em 80 mm.
- `F9`: imprime o pedido de venda não fiscal em 80 mm.
- `Esc`: inicia a próxima venda.

As variáveis `NFCE_GATEWAY_URL` e `NFCE_GATEWAY_TOKEN` devem ser fornecidas somente pelo ambiente seguro de execução.
