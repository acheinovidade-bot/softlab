# Arquitetura

O sistema começa como modular monolith em monorepo. `apps/web` contém a interface, `apps/api` contém os domínios e a API REST versionada, e `packages/contracts` contém apenas contratos estáveis compartilhados.

Cada domínio deverá possuir controller, application service, regras de domínio e adapters de persistência. Domínios não acessam tabelas de outros domínios diretamente. Integrações assíncronas usarão transactional outbox.

Toda entidade operacional será isolada por empresa e, quando aplicável, filial. Autorização na aplicação será a barreira primária; constraints e PostgreSQL RLS formarão defesa adicional.
