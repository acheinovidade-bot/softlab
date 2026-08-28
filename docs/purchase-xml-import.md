# Importação de XML de compra (NF-e)

O módulo de compras aceita o XML original de uma NF-e, valida o documento e cria uma pré-visualização antes de persistir a nota do fornecedor.

## Fluxo

1. O usuário seleciona um XML de até 2 MB.
2. A API rejeita DTD/entidades, interpreta a NF-e e armazena o original de forma imutável pelo hash SHA-256.
3. O CNPJ é relacionado ao fornecedor e cada `cProd` é resolvido pelo DE-PARA do fornecedor.
4. Itens sem vínculo ou com lote/validade incompatíveis permanecem bloqueados para correção.
5. A confirmação cria a nota, os itens, os rastros e os lotes aplicáveis em uma única transação.

A confirmação não altera saldo nem cria movimentação de estoque. A nota fica com status `imported_pending_receipt` até uma etapa posterior de recebimento e conferência física.

## Segurança e operação

- Permissões: `purchases.xml.read` e `purchases.xml.import`.
- Escopo obrigatório por empresa e filial.
- NF-e única por empresa através da chave de acesso.
- XML armazenado em `IMPORT_STORAGE_PATH`, com nome derivado do SHA-256 e permissão de arquivo restrita.
- Auditoria em pré-visualização e confirmação.
- O armazenamento local deve ser montado em volume persistente no ambiente de produção.
