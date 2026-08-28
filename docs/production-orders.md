# Engenharia e ordens de produção

O módulo cobre ficha técnica/BOM versionada e o fluxo **Planejada → Separação → Processamento → Qualidade → Finalizada**. Cada nova ficha desativa a versão ativa anterior sem alterar ordens já vinculadas.

## Regras operacionais

- Somente produtos do tipo `manufactured` recebem ficha técnica.
- Produto acabado não pode ser componente de si mesmo e componentes não podem se repetir.
- A necessidade prevista é proporcional ao rendimento da BOM e apresenta quantidade, perda estimada, disponibilidade e ruptura.
- As etapas avançam somente na sequência definida; a entrada em qualidade exige registro da conferência.
- A finalização exige localização, quantidade real, lote, fabricação, validade quando controlada, consumo real e perdas por componente.
- Componentes com controle de lote exigem um lote pertencente ao produto.

## Integridade de estoque

A finalização usa transação PostgreSQL `SERIALIZABLE`. Na mesma transação, o serviço valida empresa e filial, baixa cada matéria-prima, registra perdas, cria movimentos imutáveis, cria o lote produzido, soma o produto acabado e finaliza a ordem. Qualquer falha causa rollback integral. Conflitos de concorrência são repetidos até três vezes.

Os movimentos usam `reference_type = production_order`, permitindo rastrear a ordem desde o consumo até o lote acabado. A operação é registrada também em `audit_logs`.

## Endpoints

- `GET /api/v1/production/lookups`
- `GET|POST /api/v1/production/boms`
- `GET|POST /api/v1/production/orders`
- `GET /api/v1/production/orders/:id`
- `POST /api/v1/production/orders/:id/transition`
- `POST /api/v1/production/orders/:id/finalize`

As permissões são separadas entre leitura/gestão de engenharia, leitura/gestão de ordens e finalização.
