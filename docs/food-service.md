# Food Service

O módulo oferece mapa visual de mesas e atendimento nos canais mesa, delivery, balcão, retirada, totem e cardápio digital. Uma mesa pode manter várias comandas abertas simultaneamente.

Ao selecionar uma mesa, o operador pode abrir outra comanda, alternar entre as comandas vinculadas, lançar produtos com quantidade e observações e consultar o botão **RESUMO**. O resumo apresenta todos os itens e o total do consumo para conferência com o cliente.

O acesso exige o módulo `food`. Consulta, configuração de mesas e operação de comandas são protegidas respectivamente por `food.tables.read`, `food.tables.manage` e `food.tabs.operate`.

## Impressão por setor

O botão **Configurar impressão** conecta o Food Service ao agente local Windows e associa os setores cadastrados nos produtos, como Cozinha, Bar e Expedição, às impressoras instaladas. Depois que o item é gravado na comanda, o pedido é encaminhado automaticamente à impressora do setor correspondente.

O instalador é gerado por `pnpm windows:installers` em `tools/windows/dist/ERP-Hibrido-Print-Manager-Windows.zip`. O agente inicia no logon, aceita chamadas somente em `127.0.0.1:18181` e valida o nome da impressora antes de enviar o trabalho ao spooler do Windows.
