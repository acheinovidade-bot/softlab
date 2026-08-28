# Caixa diário

O módulo financeiro controla caixas por filial e turnos por operador. Uma restrição parcial impede duas sessões abertas no mesmo caixa.

## Fluxo

1. O operador abre o turno informando o saldo inicial.
2. Vendas do PDV lançam recebimentos automaticamente, vinculados ao pagamento original.
3. Suprimentos, sangrias e pagamentos avulsos exigem valor e justificativa.
4. No fechamento, cada forma apresenta **Sistema**, recebe o valor **Digitado** e grava a **Diferença**.
5. A reabertura exclui a conferência anterior, preserva movimentos e exige `finance.cash.reopen`.

Todas as operações são isoladas por empresa e filial, registram operador e horário e auditam abertura, fechamento e reabertura.
