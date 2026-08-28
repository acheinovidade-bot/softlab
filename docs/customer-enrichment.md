# Enriquecimento de clientes

O cadastro de pessoa jurídica pode consultar CNPJ e CEP pela BrasilAPI. Os resultados são sugestões externas: nada é persistido ou sobrescrito até o usuário selecionar **Aplicar sugestões** e salvar o cliente.

## Endpoints

- `GET /api/v1/master/customers/enrichment/cnpj/:cnpj`
- `GET /api/v1/master/customers/enrichment/cep/:cep`

Ambos exigem autenticação, módulo `sales` e permissão `master.customers.manage`. CNPJ e CEP são validados antes da chamada externa. Há limite por empresa e tipo de consulta de 30 requisições por minuto, aplicado no Redis com indisponibilidade segura caso a proteção não possa ser verificada.

## Configuração

- `CUSTOMER_ENRICHMENT_PROVIDER=disabled|brasilapi`
- `BRASILAPI_USER_AGENT`, identificação da aplicação e contato responsável
- `BRASILAPI_TIMEOUT_MS`, entre 1000 e 15000

O provedor não exige chave. Dados cadastrais externos podem estar desatualizados e devem ser confirmados pelo operador. Nenhuma informação de sócios é coletada ou armazenada.
