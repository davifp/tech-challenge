# Especificação técnica

**Funcionalidade:** Fase 2 — Fluxo antifraude via Kafka (`transactions` ⇄ `anti-fraud`)
**PRD:** [`prd.md`](./prd.md)

## Resumo

O fluxo adotará entrega **pelo menos uma vez com efeitos idempotentes**. `transactions` gravará a transação e um evento de outbox na mesma transação PostgreSQL; um dispatcher assíncrono publicará `transaction.created`. `anti-fraud` aplicará uma política pura e publicará `transaction.status.updated`; o consumidor de `transactions` aplicará a decisão e registrará o `eventId` em inbox na mesma transação do banco.

KafkaJS ficará restrito aos adapters. Contratos Zod versionados viverão em `packages/event-contracts`. Duplicatas conservarão o mesmo evento lógico; estados finais serão imutáveis. Falhas de publicação permanecerão na outbox com backoff; falhas de consumo esgotadas irão para DLQ antes do commit do offset.

## Arquitetura do sistema

### Visão dos componentes

```text
HTTP -> CreateTransaction -> TransactionStore -> PostgreSQL(Transaction + OutboxEvent)
                                      OutboxDispatcher -> Kafka transaction.created
Kafka transaction.created -> Consumer -> AnalyzeTransaction -> Kafka status.updated
Kafka status.updated -> Consumer -> ApplyTransactionStatus -> PostgreSQL(Transaction + InboxEvent)
```

- `packages/event-contracts` (novo): schemas, tipos, versões e nomes de tópicos compartilhados.
- `transactions/domain` (modificado): transição `pending -> approved|rejected`, sem regressão.
- `transactions/application` (modificado): criação com outbox; casos de uso `DispatchOutboxEvents` e `ApplyTransactionStatus`; portas de outbox, publicação e aplicação atômica.
- `transactions/infrastructure` (modificado): repositórios Prisma de outbox/inbox, publisher/consumer KafkaJS, retry/DLQ, configuração e lifecycle.
- `anti-fraud/domain` (novo): `AntiFraudPolicy`, limite inclusivo de `1000`.
- `anti-fraud/application` (novo): `AnalyzeTransactionUseCase` e porta `TransactionStatusPublisher`.
- `anti-fraud/infrastructure` (novo): consumer/publisher KafkaJS, validação de ambiente, retry/DLQ e lifecycle Nest.
- Prisma/CI (modificados): migração de outbox/inbox e Kafka disponível nos testes de integração.

O `transactionExternalId` será a key Kafka, preservando ordem por transação. O `correlationId` terá o mesmo valor; `causationId` ligará a decisão ao evento de criação.

## Design de implementação

### Principais interfaces

```ts
interface TransactionEventStore {
  savePending(input: {
    transaction: Transaction;
    event: TransactionCreatedV1;
    idempotency?: TransactionIdempotency;
  }): Promise<SaveTransactionResult>;
}

interface TransactionDecisionStore {
  apply(input: {
    eventId: string;
    transactionExternalId: string;
    status: FinalTransactionStatus;
  }): Promise<"applied" | "duplicate" | "conflict" | "not-found">;
}
```

`DispatchOutboxEventsUseCase` lê eventos vencidos, publica por `EventPublisher` e marca sucesso ou próxima tentativa. `AnalyzeTransactionUseCase` recebe `TransactionCreatedV1`, decide por `AntiFraudPolicy` e publica um `TransactionStatusUpdatedV1` determinístico. Controllers e contratos HTTP não mudam.

### Modelos de dados

#### `IntegrationEventV1` — envelope compartilhado

| Campo           | Tipo          | Obrigatório | Descrição                                              |
| --------------- | ------------- | ----------- | ------------------------------------------------------ |
| `eventId`       | UUID          | sim         | Idempotência global do evento lógico.                  |
| `eventName`     | literal       | sim         | `transaction.created` ou `transaction.status.updated`. |
| `version`       | `1`           | sim         | Versão do contrato.                                    |
| `correlationId` | UUID          | sim         | `transactionExternalId`.                               |
| `causationId`   | UUID/null     | sim         | Evento causador; `null` na criação.                    |
| `data`          | objeto tipado | sim         | Dados específicos do evento.                           |

#### `TransactionCreatedV1` — solicitação de análise

| Campo em `data`         | Tipo           | Obrigatório | Descrição                       |
| ----------------------- | -------------- | ----------- | ------------------------------- |
| `transactionExternalId` | UUID           | sim         | Transação persistida.           |
| `value`                 | número decimal | sim         | Valor positivo, até duas casas. |

```text
{"eventId":"0199f9c3-4a2b-7c8d-9e0f-1234567890ab","eventName":"transaction.created","version":1,
 "correlationId":"0199f9c2-1a2b-7c8d-9e0f-1234567890ab","causationId":null,
 "data":{"transactionExternalId":"0199f9c2-1a2b-7c8d-9e0f-1234567890ab","value":1000.00}}
```

#### `TransactionStatusUpdatedV1` — decisão antifraude

| Campo em `data`         | Tipo | Obrigatório | Descrição                 |
| ----------------------- | ---- | ----------- | ------------------------- |
| `transactionExternalId` | UUID | sim         | Transação analisada.      |
| `status`                | enum | sim         | `approved` ou `rejected`. |

```text
{"eventId":"d9428888-122b-5e56-8e67-849d6e8fc5c1","eventName":"transaction.status.updated","version":1,
 "correlationId":"0199f9c2-1a2b-7c8d-9e0f-1234567890ab",
 "causationId":"0199f9c3-4a2b-7c8d-9e0f-1234567890ab",
 "data":{"transactionExternalId":"0199f9c2-1a2b-7c8d-9e0f-1234567890ab","status":"approved"}}
```

O `eventId` da decisão será UUID v5 derivado do `eventId` de criação em namespace fixo; reprocessamentos geram payload de negócio idêntico. O timestamp operacional será o timestamp do record Kafka/log, não parte da identidade do evento.

#### `FailedKafkaMessageV1` — registro em DLQ

| Campo                          | Tipo                 | Obrigatório | Descrição                    |
| ------------------------------ | -------------------- | ----------- | ---------------------------- |
| `sourceTopic/partition/offset` | string/número/string | sim         | Posição original.            |
| `originalKey`                  | string/null          | sim         | Key recebida.                |
| `originalValue`                | string               | sim         | Payload recuperável.         |
| `attempts`, `failedAt`         | número/ISO 8601      | sim         | Tentativas e instante final. |
| `error`                        | `{code,message}`     | sim         | Erro sanitizado.             |

```text
{"version":1,"sourceTopic":"transaction.created","partition":0,"offset":"42",
 "originalKey":"0199f9c2-1a2b-7c8d-9e0f-1234567890ab","originalValue":"{...}",
 "attempts":3,"failedAt":"2026-09-05T14:00:00.000Z",
 "error":{"code":"INVALID_EVENT","message":"Event contract is invalid"}}
```

#### `OutboxEvent` — publicação durável

| Campo                                            | Tipo                  | Obrigatório | Descrição                                 |
| ------------------------------------------------ | --------------------- | ----------- | ----------------------------------------- |
| `eventId`, `aggregateId`, `eventName`, `payload` | UUID/UUID/string/JSON | sim         | Identidade, transação, tópico e envelope. |
| `attemptCount`, `nextAttemptAt`                  | int/timestamp         | sim         | Agendamento do retry.                     |
| `publishedAt`, `lastError`                       | timestamp/string      | não         | Resultado da última publicação.           |

```text
{"eventId":"0199f9c3-4a2b-7c8d-9e0f-1234567890ab","aggregateId":"0199f9c2-1a2b-7c8d-9e0f-1234567890ab",
 "eventName":"transaction.created","attemptCount":0,"publishedAt":null,"lastError":null}
```

PK em `eventId`; índice em `publishedAt,nextAttemptAt`.

#### `InboxEvent` — consumo idempotente

| Campo                                  | Tipo           | Obrigatório | Descrição                          |
| -------------------------------------- | -------------- | ----------- | ---------------------------------- |
| `eventId`, `eventName`                 | UUID/string    | sim         | Evento aplicado; `eventId` é a PK. |
| `transactionExternalId`, `processedAt` | UUID/timestamp | sim         | Transação e momento do efeito.     |

```text
{"eventId":"d9428888-122b-5e56-8e67-849d6e8fc5c1","eventName":"transaction.status.updated",
 "transactionExternalId":"0199f9c2-1a2b-7c8d-9e0f-1234567890ab","processedAt":"2026-09-05T14:00:01.000Z"}
```

### Endpoints da API

Nenhuma rota nova. `POST /transactions` preserva `201`/`200` e corpo `pending`; seu commit inclui a outbox, mas não aguarda Kafka. `GET /transactions/:transactionExternalId` e a listagem mantêm os contratos da Fase 1 e passam a refletir a decisão eventual.

## Pontos de integração

| Tópico                       | Produtor             | Consumidor/grupo                               |
| ---------------------------- | -------------------- | ---------------------------------------------- |
| `transaction.created`        | `transactions`       | `anti-fraud` / `KAFKA_GROUP_ID_ANTI_FRAUD`     |
| `transaction.status.updated` | `anti-fraud`         | `transactions` / `KAFKA_GROUP_ID_TRANSACTIONS` |
| `<source>.dlq`               | consumidor do source | operação/replay manual                         |

KafkaJS será supervisionado pelos hooks de lifecycle do Nest. Em `transactions`, a conexão roda em background com reconexão para Kafka indisponível não impedir o HTTP/outbox; o shutdown desconecta ordenadamente. Brokers, client ID, groups, timeouts e retry vêm do ambiente. Não há autenticação local. Com `autoCommit: false`, o adapter confirma `offset + 1` somente após efeito ou DLQ publicados; falha da DLQ conserva o offset. Erros transitórios, inclusive transação ainda não encontrada, tentam três vezes com backoff/heartbeat; contrato inválido ou conflito final vai direto à DLQ.

## Abordagem de testes

Vitest testará comportamento. Fakes serão usados nas portas em unidade; Prisma/PostgreSQL e Kafka reais nos testes de integração. Cada execução usará correlation IDs e consumer groups únicos para isolamento.

### Testes de unidade

| ID    | Nome do caso de teste                  | Critérios de aceitação | Resultado esperado                              |
| ----- | -------------------------------------- | ---------------------- | ----------------------------------------------- |
| TU-01 | aprova abaixo do limite                | CA-10                  | Valor menor que `1000` resulta em `approved`.   |
| TU-02 | aprova no limite                       | CA-02, CA-10           | `1000` resulta em `approved`.                   |
| TU-03 | rejeita acima do limite                | CA-03, CA-10           | Valor maior resulta em `rejected`.              |
| TU-04 | reprocessa criação deterministicamente | CA-05, CA-08, CA-10    | Mesmo input produz mesmo event ID e decisão.    |
| TU-05 | impede regressão/conflito              | CA-06, CA-10           | Estado final igual é no-op; diferente conflita. |
| TU-06 | classifica retry e DLQ                 | CA-07                  | Transitório tenta novamente; permanente não.    |

### Testes de integração

| ID    | Nome do caso de teste                   | Critérios de aceitação | Resultado esperado                                                      |
| ----- | --------------------------------------- | ---------------------- | ----------------------------------------------------------------------- |
| TI-01 | valida contratos compartilhados         | CA-08                  | Ambos os schemas aceitam exemplos e rejeitam incompatíveis.             |
| TI-02 | persiste criação e outbox atomicamente  | CA-01, CA-05           | Mesmo sem Kafka, POST/replay mantém uma transação e um evento lógico.   |
| TI-03 | recupera publicação da outbox           | CA-07, CA-09           | Falha agenda retry; sucesso marca publicado; replay conserva `eventId`. |
| TI-04 | consome criação e publica decisão       | CA-02, CA-03, CA-09    | Kafka contém a decisão correta e correlacionada.                        |
| TI-05 | aplica decisão com inbox atômica        | CA-04, CA-06           | Só a primeira entrega altera status/`updatedAt`.                        |
| TI-06 | envia evento inválido/conflitante à DLQ | CA-07, CA-09           | DLQ recebe contexto e source offset só então avança.                    |

### Testes E2E

| ID     | Nome do caso de teste | Critérios de aceitação     | Resultado esperado                                                              |
| ------ | --------------------- | -------------------------- | ------------------------------------------------------------------------------- |
| E2E-01 | POST até aprovação    | CA-01, CA-02, CA-04, CA-09 | Resposta inicial pending; consulta eventual approved; dois eventos rastreáveis. |
| E2E-02 | POST até rejeição     | CA-03, CA-04               | Valor acima de 1000 termina rejected.                                           |
| E2E-03 | fluxo com duplicatas  | CA-05, CA-06, CA-10        | Duplicatas não criam nem alteram efeito adicional.                              |
| E2E-04 | gate e evidências     | CA-11, CA-12               | `DECISIONS.md` contém três decisões e `pnpm quality` passa.                     |

## Sequenciamento do desenvolvimento

### Ordem de construção

1. Contratos compartilhados e registros no `DECISIONS.md`.
2. Migração outbox/inbox e criação atômica em `transactions`.
3. Policy/use case de `anti-fraud` e adapters Kafka comuns.
4. Consumer de decisão e transição de domínio em `transactions`.
5. Retry/DLQ, logs, testes Kafka/E2E e CI.

### Dependências técnicas

- Adicionar `kafkajs` aos backends, `zod` ao pacote de contratos e config validada ao `anti-fraud`.
- Kafka/PostgreSQL do Compose; Kafka como service no GitHub Actions; tópicos auto-created apenas em local/CI.
- `DATABASE_URL_TEST` isolada; `.env.example` documenta `KAFKA_BROKERS`, `KAFKA_CLIENT_ID`, os dois group IDs, timeouts/retry e intervalo da outbox.

## Monitoramento e observabilidade

`ConsoleLogger({ json: true })` emitirá `eventName`, `eventId`, `transactionExternalId`, `correlationId`, `topic`, `partition`, `offset`, `attempt`, `outcome` e erro sanitizado. Resultados distinguem `published`, `processed`, `duplicate`, `retry_scheduled` e `dead_lettered`. Nunca registrar payload completo ou credenciais. Bootstrap falha cedo em config inválida; backlog/erros da outbox permanecem consultáveis no banco. Métricas, tracing e alertas ficam fora do escopo do PRD.

## Considerações técnicas

### Principais decisões

- **Outbox transacional** em vez de publish síncrono/dual write: mantém `POST` desacoplado e elimina a janela “persistiu, não publicou”; aceita duplicata após publish antes de `publishedAt`.
- **At-least-once + inbox/determinismo** em vez de transações Kafka ponta a ponta: cobre as garantias exigidas com menor acoplamento operacional.
- **KafkaJS direto nos adapters** em vez de decorators `@nestjs/microservices`: oferece controle explícito de offsets, retry e DLQ sem vazar framework no core.
- **Contrato Zod v1 compartilhado** em vez de tipos duplicados ou schema registry: valida runtime e compile-time no monorepo; registry passa a valer com evolução independente.
- **Retry curto + DLQ** em vez de retry infinito no consumer: evita bloquear partição por poison message. Publicação da outbox continua em retry durável porque Kafka indisponível impediria também a DLQ.

### Riscos conhecidos

- Crash entre publish e `publishedAt` duplica record; IDs estáveis e inbox mitigam.
- Outbox por polling adiciona latência eventual; não há SLO nesta fase.
- Retry no `eachMessage` deve permanecer abaixo do session timeout e chamar heartbeat.
- Tópicos auto-created podem nascer com defaults inadequados; produção exigirá provisionamento explícito.
- Replay da DLQ é manual nesta fase e deve preservar key/payload originais.
- `Transaction` e `PrismaTransactionRepository` já estão próximos/no limite de 100 linhas; extrair policy e adapters evita violar as rules.

### Conformidade com o AGENTS.md e as rules

Foram lidos `AGENTS.md` (symlink de `CLAUDE.md`), `PRACTICES.md` e a única rule efetiva, `.agents/rules/code-standards.md` (symlink para `.claude/rules`). APIs atuais de KafkaJS, NestJS 12 e Prisma 7 foram verificadas no Context7 MCP. A implementação manterá TypeScript estrito sem `any`, arquivos ≤100 linhas, funções ≤30, até três parâmetros, guard clauses, constantes nomeadas, config externa, sem segredos/comentários dispensáveis, Conventional Commits, PR para `develop` e `pnpm quality` verde.

### Conformidade com skills

- `criar-techspec`: estrutura, rastreabilidade CA/testes e limite de especificação.
- `domain-modeling`: glossário em `CONTEXT.md` e distinção entre análise e decisão.
- `hexagonal-architecture`: core independente, portas de capacidade, adapters Kafka/Prisma e composição Nest.

### Arquivos relevantes e dependentes

- Novos: `CONTEXT.md`, `packages/event-contracts/**`; domínios/aplicações/adapters Kafka citados nos dois apps; migration outbox/inbox; testes Kafka.
- Modificados: `apps/{transactions,anti-fraud}/package.json`, módulos/main/config; `transactions` domain/repository/use case de criação; Prisma schema/setup; `.env.example`, `.github/workflows/quality.yml`, `DECISIONS.md`, lockfile.
- Preservados: contratos/controllers HTTP, `apps/web/**`, tópicos/serviços existentes do `docker-compose.yml`.
