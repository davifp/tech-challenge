# Documento de Requisitos do Produto (PRD)

**Funcionalidade:** Fase 1 — Dados e API de transações
**Referências:** enunciado original do desafio (seções "O problema", "Contratos", "Backend"), `PRACTICES.md` (seções "Testes", "Código", "Registro de decisões"), `.claude/rules/code-standards.md`, `DECISIONS.md`.

## Visão geral

O produto é o desafio técnico BIUD Fullstack: uma API orientada a eventos para transações financeiras, com validação antifraude assíncrona por Kafka, e um dashboard Next.js para operá-la. A fase 0 entregou a fundação (monorepo, quality gate, CI, infra local). A fase 1 acende a espinha dorsal do serviço `transactions`: modelagem de dados e endpoints REST que alimentam o dashboard.

Ao final desta fase, o serviço sabe criar uma transação com status inicial `pending`, consultá-la pelo identificador externo e listar transações paginadas com filtros por status, tipo e período. Ainda não publica nem consome eventos Kafka — isso é fase 2. A modelagem já contempla os três status (`pending`, `approved`, `rejected`) e a taxonomia de tipos, para a fase 2 acoplar o fluxo assíncrono sem retrabalho no schema.

## Objetivos

- **Modelagem persistente e reprodutível:** schema Prisma com `Transaction`, `TransactionType` e `TransactionStatus`; migrations aplicáveis do zero contra o Postgres do `docker-compose.yml`; seed mínimo dos catalogs.
- **Contratos idênticos ao enunciado:** o corpo do `POST /transactions` e o payload do `GET /transactions/:transactionExternalId` respeitam literalmente o enunciado, sem adicionar ou renomear campos sem decisão explícita.
- **Endpoints prontos para o dashboard:** criação, consulta por identificador externo e listagem paginada com filtros por status, tipo e período — o mínimo para a fase 3 popular a UI.
- **Erros úteis:** validação, não-encontrado e erro interno devolvem mensagens acionáveis, sem vazar detalhe interno.
- **Quality gate verde:** `pnpm quality` verde local e no CI, com testes cobrindo validação de contratos, formato de resposta e paginação/filtros.
- **Decisões registradas:** todas as decisões estruturantes desta fase em `DECISIONS.md` no formato "Decisão / Alternativas / Por quê" (lista canônica em CA-15).

Métrica principal: `pnpm quality` verde com os três endpoints atendendo aos contratos, filtros funcionando e migrations reprodutíveis do zero. Métrica secundária: nenhum campo dos contratos fora do enunciado sem decisão registrada em contrário.

## Histórias de usuário

- **US1:** Como consumidor da API (dashboard, script, `curl`), quero criar uma transação e receber o `transactionExternalId` de volta, sem esperar por processamento assíncrono.
- **US2:** Como consumidor da API, quero consultar por `transactionExternalId` e receber exatamente o payload do enunciado, sem adaptar meu cliente a variações.
- **US3:** Como usuário do dashboard (via API), quero listar transações paginadas com filtros por status, tipo e período para achar rapidamente o subconjunto que me interessa.
- **US4:** Como consumidor da API, quero mensagens de erro descritivas em entrada inválida ou recurso inexistente, para corrigir sem depender de logs internos.
- **US5:** Como desenvolvedor novo no projeto, quero rodar migrations e seed do zero contra o Postgres local com um comando previsível, sem intervenção manual.
- **US6:** Como avaliador, quero encontrar em `DECISIONS.md` as decisões estruturantes desta fase (lista completa em CA-15).

## Principais funcionalidades

1. **Modelagem de dados no Postgres.** Tabela `Transaction` com identificador externo, contas de débito e crédito, referência ao tipo, valor, referência ao status e timestamps. Catalogs `TransactionType` e `TransactionStatus` com `id` inteiro e `name`.
   - **RF1:** O schema Prisma define `Transaction`, `TransactionType` e `TransactionStatus`, com relacionamentos por chave estrangeira.
   - **RF2:** Migrations versionadas são aplicáveis do zero contra o Postgres do `docker-compose.yml`, sem passos manuais.
   - **RF3:** O seed popula `TransactionStatus` com `pending`, `approved`, `rejected` e `TransactionType` com `transfer` (id `1`), coerente com `transferTypeId: 1` do exemplo. `name` em inglês; tradução PT-BR fica no frontend.

2. **Módulo `transactions` no NestJS.** Camada de aplicação sobre repositório Prisma, exposta por controller REST. DTOs validados por biblioteca registrada em `DECISIONS.md`.
   - **RF4:** O módulo contém controller, camada de aplicação e repositório; controller e camada de aplicação não dependem do Prisma diretamente.
   - **RF5:** DTOs de entrada rejeitam campos desconhecidos e validam tipos, formatos (UUID), limites (`value` > 0) e regras cruzadas (`accountExternalIdDebit !== accountExternalIdCredit`) antes de qualquer acesso ao banco.
   - **RF5a:** A entidade `Transaction` reforça as mesmas regras como invariantes no factory de criação (Always-Valid): construção com `value <= 0` ou `accountExternalIdDebit === accountExternalIdCredit` lança erro de domínio, mesmo se o adapter HTTP for bypassado (scripts, seeds, futuros consumers Kafka).
   - **RF5b:** O serviço publica documentação OpenAPI/Swagger em `/api/docs`, com o enum de `transferTypeId` documentado. Cliente descobre o catálogo pela spec.

3. **`POST /transactions` — criação.** Recebe o contrato de entrada do enunciado, grava com status `pending` e devolve o identificador externo.
   - **RF6:** O endpoint aceita o corpo `{ accountExternalIdDebit, accountExternalIdCredit, transferTypeId, value }` com `accountExternalId*` no formato UUID, `accountExternalIdDebit !== accountExternalIdCredit`, `transferTypeId` inteiro existente na tabela `TransactionType` e `value` numérico com até duas casas decimais e maior que zero. Nenhum teto superior de `value` é aplicado nesta fase (rejeição por valor alto é responsabilidade do antifraude na fase 2).
   - **RF7:** O registro é persistido com status `pending`, `transactionExternalId` gerado pelo servidor no formato UUID e `createdAt` no momento da criação.
   - **RF8:** A resposta síncrona é `201 Created` com header `Location: /transactions/<transactionExternalId>` e corpo idêntico ao payload do `GET /transactions/:transactionExternalId` (ver RF9), com `transactionStatus.name = "pending"`. Nenhum efeito assíncrono ocorre nesta fase.
   - **RF8a:** O endpoint aceita header opcional `Idempotency-Key` (string, ≤ 64 caracteres, formato livre — UUID recomendado, seguindo IETF draft-ietf-httpapi-idempotency-key-header). Se ausente, o fluxo é o normal. Se presente e nunca visto, a chave é persistida junto com a transação criada e o hash canonical do body (SHA-256 dos campos concatenados). Se presente e já visto com **mesmo body**, a transação existente é retornada com `200 OK` (mesmo body do `201`, sem Location). Se presente e já visto com **body diferente**, a resposta é `422 Unprocessable Entity` com código `IDEMPOTENCY_KEY_CONFLICT` (padrão IETF). Chaves não expiram nesta fase (vivem enquanto a transação existir).

4. **`GET /transactions/:transactionExternalId` — consulta.** Devolve exatamente o payload de saída definido no enunciado.
   - **RF9:** A resposta `200 OK` tem corpo exatamente `{ transactionExternalId, transactionType: { name }, transactionStatus: { name }, value, createdAt, updatedAt, accountExternalIdDebit, accountExternalIdCredit }`. A extensão além dos cinco campos do enunciado (contas + `updatedAt`) fica registrada em `DECISIONS.md` como decisão consciente para atender ao dashboard da fase 3 sem endpoint auxiliar.
   - **RF10:** Quando o `transactionExternalId` não existe, a resposta é `404 Not Found` com mensagem descritiva.

5. **`GET /transactions` — listagem paginada.** Endpoint que alimenta o dashboard, com filtros opcionais por status, tipo e período, paginação offset e ordenação padrão.
   - **RF11:** Query params suportados, todos opcionais: `status` (um dos valores do catalog), `transferTypeId` (inteiro existente), `createdAtFrom` e `createdAtTo` (RFC 3339 completo com timezone — `Z` ou `[±]hh:mm`; recomenda-se enviar em UTC/`Z` para evitar o gotcha do `+` sem URL-encode), `page` (inteiro ≥ 1, padrão `1`) e `limit` (inteiro entre 1 e 100, padrão `20`).
   - **RF12:** Os filtros combinam com AND: só entram itens que satisfazem todos os filtros informados. `createdAtFrom` é inclusivo, `createdAtTo` também.
   - **RF13:** A ordenação padrão é `createdAt` decrescente.
   - **RF14:** A resposta é `200 OK` com corpo `{ items, page, limit, total }`, onde cada item tem exatamente o mesmo formato de saída do endpoint de consulta por identificador (mesmo shape, mesmos campos).
   - **RF15:** Query params inválidos (tipo, faixa, valor fora do catalog) resultam em `400 Bad Request` com mensagem descritiva.

6. **Tratamento de erros consistente.** Respostas de erro sinalizam a causa sem vazar detalhes internos.
   - **RF16:** Erros de validação retornam `400 Bad Request` com lista dos campos inválidos e o motivo.
   - **RF17:** Recursos não encontrados retornam `404 Not Found` com mensagem descritiva do recurso.
   - **RF18:** Erros internos retornam `500 Internal Server Error` com mensagem genérica; o detalhe fica no log e nunca no corpo da resposta.

7. **Configuração via ambiente.** Nenhuma credencial, host ou porta fixos no código.
   - **RF19:** A URL do banco vem de `DATABASE_URL` no `.env`; a ausência da variável faz o app falhar explicitamente ao subir. `.env.example` documenta a chave sem valor sensível.

8. **Testes de comportamento.** Suíte cobre os pontos de risco desta fase.
   - **RF20:** Testes cobrem: validação do contrato de entrada do `POST`, formato exato do payload do `GET` por identificador, comportamento dos filtros e da paginação no `GET` de listagem, e resposta `404` para identificador inexistente.

## Critérios de aceitação

- **CA-01 (US5, RF2, RF3):** Dado um Postgres limpo do `docker-compose.yml`, quando o desenvolvedor executa migrations e seed, então as tabelas são criadas e `TransactionStatus` fica populado com `pending`, `approved`, `rejected` e `TransactionType` com pelo menos `transfer` (id `1`), sem passos manuais.
- **CA-02 (US1, RF6, RF7, RF8):** Dado um corpo válido `{ accountExternalIdDebit, accountExternalIdCredit, transferTypeId, value }`, quando o cliente faz `POST /transactions`, então a resposta é `201 Created` com header `Location: /transactions/<transactionExternalId>` e corpo idêntico ao do `GET /transactions/:transactionExternalId` (mesmas chaves), com `transactionStatus.name = "pending"`; o registro persistido tem `createdAt` e `updatedAt` preenchidos.
- **CA-02a (US1, RF8a):** Dado um header `Idempotency-Key: abc123` em duas requisições `POST /transactions` seguidas com o mesmo corpo, quando o cliente inspeciona as respostas, então a primeira é `201 Created` e a segunda é `200 OK` com o mesmo `transactionExternalId` e o mesmo body; apenas um registro existe no banco.
- **CA-02b (US1, RF8a):** Dado um header `Idempotency-Key: abc123` usado inicialmente com um corpo A e depois reutilizado com um corpo B diferente, quando o cliente faz a segunda requisição `POST /transactions`, então a resposta é `422 Unprocessable Entity` com envelope de erro `{ error: { code: "IDEMPOTENCY_KEY_CONFLICT", message: "..." } }` e nenhum novo registro é criado.
- **CA-03 (US1, RF5, RF5a, RF6):** Dado um corpo com `accountExternalIdDebit` fora do formato UUID, `transferTypeId` inexistente, `value` ≤ 0, `accountExternalIdDebit === accountExternalIdCredit` ou campo obrigatório ausente, quando o cliente faz `POST /transactions`, então a resposta é `400 Bad Request` com mensagem apontando o(s) campo(s) inválido(s) e nenhum registro é criado.
- **CA-03a (US1, RF5a):** Dado um chamador não-HTTP (script, teste, seed) que instancia `Transaction` diretamente com `value ≤ 0` ou débito igual a crédito, quando o factory de criação é invocado, então uma exceção de domínio é lançada e nenhuma entidade é construída.
- **CA-04 (US2, RF9):** Dado um `transactionExternalId` existente, quando o cliente faz `GET /transactions/:transactionExternalId`, então a resposta `200 OK` tem exatamente as chaves `transactionExternalId`, `transactionType.name`, `transactionStatus.name`, `value`, `createdAt`, `updatedAt`, `accountExternalIdDebit` e `accountExternalIdCredit`, sem chaves adicionais e sem `transferTypeId` bruto (o tipo aparece aninhado como objeto).
- **CA-05 (US2, RF10):** Dado um `transactionExternalId` inexistente, quando o cliente faz `GET /transactions/:transactionExternalId`, então a resposta é `404 Not Found` com mensagem descritiva.
- **CA-06 (US3, RF11, RF13, RF14):** Dada uma base com transações, quando o cliente faz `GET /transactions` sem filtros, então a resposta é `200 OK` com `{ items, page: 1, limit: 20, total }`, `items` ordenado por `createdAt` desc e `items.length ≤ limit`.
- **CA-07 (US3, RF11, RF12):** Dado `?status=approved`, quando o cliente faz `GET /transactions`, então apenas itens com `transactionStatus.name = "approved"` aparecem em `items`.
- **CA-08 (US3, RF11, RF12):** Dado `?transferTypeId=1`, quando o cliente faz `GET /transactions`, então apenas itens com esse tipo aparecem em `items`.
- **CA-09 (US3, RF11, RF12):** Dado `?createdAtFrom=<data>&createdAtTo=<data>` válidos, quando o cliente faz `GET /transactions`, então apenas itens com `createdAt` dentro do intervalo inclusivo aparecem em `items`.
- **CA-10 (US3, RF11, RF14):** Dado `?page=2&limit=5` sobre uma base com mais de cinco itens, quando o cliente faz `GET /transactions`, então `items` contém a segunda página (índices 5 a 9 na ordenação padrão) e `total` reflete a contagem global (não a da página).
- **CA-11 (US3, RF15):** Dado `?page=0`, `?limit=999`, `?status=inexistente`, `?transferTypeId=abc`, `?createdAtFrom=2026-09-04` (date-only sem timezone) ou `?createdAtFrom=data-invalida`, quando o cliente faz `GET /transactions`, então a resposta é `400 Bad Request` com mensagem descritiva.
- **CA-12 (US4, RF16, RF17, RF18):** Dadas as respostas de erro `400`, `404` e `500`, quando o cliente inspeciona o corpo, então cada uma tem mensagem descritiva do problema e nenhuma expõe stack trace ou detalhe interno.
- **CA-13 (US5, RF19):** Dado o `.env` sem `DATABASE_URL`, quando o app sobe, então falha explicitamente com mensagem clara indicando a variável ausente.
- **CA-14 (RF20):** Dado `pnpm quality` executando, quando a etapa de testes roda, então os testes de comportamento de contrato do `POST`, formato do `GET` por identificador, filtros e paginação do `GET` de listagem e resposta `404` estão presentes e passam.
- **CA-15 (US6):** Dado `DECISIONS.md`, quando o leitor abre o arquivo, então encontra decisões no formato "Decisão / Alternativas / Por quê" para: arquitetura hexagonal + use-cases, paginação offset com `page`/`limit`, Zod na borda HTTP, UUID v7 merged como PK, `201` + body completo no POST, `Idempotency-Key` opcional, envelope de erro e nomes de catálogo em inglês.

## Experiência do usuário

**Personas.** Os usuários são o **dashboard** (fase 3) que consumirá a API e o **desenvolvedor / avaliador** que exercita a API via `curl`, cliente HTTP ou testes. Não há usuário final nesta fase.

**Fluxos.**

- **Criar:** `POST /transactions` com contrato de entrada; `201` com o body completo do recurso e header `Location`. Aceita header opcional `Idempotency-Key` para dedup de retentativas. Síncrono, sem dependência externa.
- **Consultar:** `GET /transactions/:transactionExternalId`; `200` com payload completo (inclui contas e `updatedAt`) ou `404`.
- **Listar:** `GET /transactions` com filtros opcionais (`status`, `transferTypeId`, `createdAtFrom`, `createdAtTo`, `page`, `limit`); página ordenada por `createdAt` desc; itens no mesmo shape do detalhe.

**UI/UX.** Interface é a API HTTP em JSON: contratos idênticos ao enunciado, códigos HTTP semânticos, mensagens de erro descritivas e sem vazamento interno. Acessibilidade visual não se aplica aqui — entra na fase 3.

## Restrições técnicas de alto nível

- **Stack obrigatória:** NestJS + TypeScript + Prisma + PostgreSQL.
- **Contratos literais:** o corpo do `POST /transactions` e o payload do `GET /transactions/:transactionExternalId` respeitam o enunciado sem adicionar ou renomear campos.
- **Idioma dos catalogs:** `TransactionStatus.name` e `TransactionType.name` são armazenados em inglês (`pending`, `approved`, `rejected`, `transfer`); tradução PT-BR é responsabilidade do frontend na fase 3.
- **Valor monetário:** persistido como decimal com duas casas; moeda é implícita e única (BRL) nesta fase.
- **Identificadores externos:** `transactionExternalId` é UUID v7 gerado no servidor e serve como PK único da tabela `Transaction` (schema merged, sem `id` interno separado). `accountExternalIdDebit` e `accountExternalIdCredit` são UUIDs (versão livre — vindos de outro sistema).
- **Sem `any`:** DTOs, entidades e retornos são tipados. Uso de `any` é violação e não passa no quality gate.
- **Configuração via ambiente:** `DATABASE_URL` no `.env`; nenhuma credencial ou host fixo no código; `.env.example` atualizado.
- **Regras de código (`.claude/rules/code-standards.md`):** arquivos ≤ 100 linhas, funções ≤ 30 linhas, ≤ 3 parâmetros, cláusulas de guarda, sem linhas em branco dentro de funções, sem números/strings mágicos.
- **Decisões pendentes registradas em `DECISIONS.md`:** lista canônica em CA-15.
- **Fluxo de trabalho:** trabalho sai de `develop` via pull request; Conventional Commits obrigatórios; `pnpm quality` verde local e no CI.

## Fora do escopo

- **Publicação e consumo de eventos Kafka** (`transaction.created` e `transaction.status.updated`) — fase 2.
- **Atualização assíncrona do status** disparada pelo antifraude — fase 2.
- **Serviço `anti-fraud`** e a regra "acima de 1000 rejeita" — fase 2.
- **Teto superior de `value` na criação** — não aplicado nesta fase; rejeição por valor alto é responsabilidade do antifraude (fase 2).
- **Frontend** (páginas, filtros na UI, estados de carregando/erro/vazio) — fase 3.
- **Autenticação, autorização e RBAC** — não previstos no desafio.
- **Idempotência com response cacheado por chave (modelo Brandur/Stripe completo)** — nesta fase, o `Idempotency-Key` só dedupa a criação da entidade (retorna a existente); não há tabela dedicada, recovery points ou TTL. Modelo completo pode entrar em fase seguinte se necessário.
- **Endpoint de catálogo `GET /transfer-types`** — enum documentado via OpenAPI atende à descoberta; endpoint auxiliar pode entrar quando o catálogo crescer/ficar administrável.
- **Filtros multi-valor, cursor, ordenação customizada, busca textual e sparse fieldsets no `GET` de listagem** — não pedidos; podem ser considerados em fases futuras.
- **Observabilidade** (logs estruturados dedicados, métricas, tracing) — não previstos nesta fase.
- **Deploy e ambientes remotos** — não previstos no desafio.
