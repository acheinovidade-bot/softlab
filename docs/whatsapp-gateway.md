# Gateway WhatsApp não oficial

O ERP integra cotações a uma instância compatível com Evolution API. O adaptador usa envio de texto em `POST /message/sendText/{instance}` e não depende da API oficial da Meta, de templates aprovados ou de um WhatsApp Business Account.

## Configuração

1. Hospede e mantenha o gateway fora do ERP.
2. Defina a API key e o segredo do webhook como variáveis de ambiente, por exemplo `WHATSAPP_GATEWAY_API_KEY_TENANT` e `WHATSAPP_GATEWAY_WEBHOOK_SECRET_TENANT`.
3. No menu **WhatsApp**, informe URL, instância, caminho de envio e somente os nomes dessas variáveis.
4. Cadastre no gateway o webhook exibido pela tela, envie os eventos de mensagens e adicione o header `x-webhook-secret` com o segredo configurado.

Nenhuma credencial é gravada em `integrations.public_config`, logs de mensagens ou auditoria. Em produção, a URL do gateway deve usar HTTPS. Cada configuração e mensagem é vinculada à empresa e à filial autenticadas.

## Fluxo de cotações

**Enviar pelo gateway** gira o token público do fornecedor, monta uma URL absoluta usando `PUBLIC_WEB_URL`, envia uma mensagem de texto e registra o identificador devolvido pelo provedor. Falhas ficam disponíveis para reenvio. O webhook normaliza confirmações de envio, entrega, leitura, falha e mensagens recebidas.

O botão de compartilhamento manual continua disponível como contingência.

## Riscos e operação

Gateways baseados no WhatsApp Web não têm o SLA nem a estabilidade contratual da API oficial. Mudanças do WhatsApp ou do próprio gateway podem interromper sessões, e a conta usada pode sofrer limitações. Recomenda-se número dedicado, volume controlado, consentimento dos destinatários, monitoramento e plano de contingência.

Referências do provedor: [repositório oficial da Evolution API](https://github.com/evolution-foundation/evolution-api) e [documentação de webhooks](https://github.com/evolution-foundation/evolution-docs/blob/main/docs/02-Configuration/Webhooks.md).
