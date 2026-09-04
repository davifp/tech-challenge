# Especificação técnica

**Funcionalidade:** Fase 1 — Dados e API de transações
**PRD:** [`prd.md`](./prd.md)
**Referências:** `AGENTS.md`, `.claude/rules/code-standards.md`, `PRACTICES.md`, `DECISIONS.md`, `docker-compose.yml`, `.env.example`.

## Resumo

Serviço `transactions` (NestJS + TS) organizado em **arquitetura hexagonal (Ports & Adapters)** com **use cases** por ação. Núcleo (`domain` + `application`) não depende de Nest, Prisma ou HTTP: fala com o mundo por portas. Driving adapter é HTTP (REST); driven adapter é Prisma/Postgres. Na fase 2, um driven adapter de Kafka entra sem tocar no core.

DTOs validados por **Zod** (`z.infer` como fonte única do tipo) via `ZodValidationPipe` do pacote `nestjs-zod`, que também integra com `@nestjs/swagger` para publicar a spec OpenAPI em `/api/docs`. Schema Prisma em `apps/transactions/prisma/`, com migrations versionadas e seed dos catalogs. `.env` validado por Zod no bootstrap — sem `DATABASE_URL` o app aborta. Erros normalizados por `HttpExceptionFilter` global, sem vazar detalhe interno.

## Arquitetura do sistema

### Visão dos componentes

```
apps/transactions/
  prisma/  { schema.prisma, migrations/, seed.ts, seed.demo.ts }
  test/    { helpers/transaction.factory.ts, setup/global-setup.ts, setup/reset.ts }
  src/
    domain/         { transaction, transaction-status (PENDING/APPROVED/REJECTED), transaction-type (TRANSFER) }
    application/
      ports/        { transaction-repository, transaction-catalog-repository }
      use-cases/    { create, get-by-external-id, list }
      errors/       { transaction-not-found, transfer-type-not-found, invalid-transaction, idempotency-key-conflict }
      helpers/      { hash-body }
    infrastructure/
      http/         { transactions.controller, dtos/ (Zod), pipes/zod-validation,
                      filters/http-exception, mappers/transaction-response }
      persistence/  { prisma.service, prisma-transaction.repository,
                      prisma-transaction-catalog.repository, mappers/transaction-record }
      config/       { env.schema (Zod), config.module }
    { transactions.module, app.module, main }
```

**Fluxo do `POST /transactions`:**

1. Controller lê header opcional `Idempotency-Key`.
2. `ZodValidationPipe` valida tipos, UUID, `value > 0`, `debit !== credit`.
3. `CreateTransactionUseCase` executa (ver seção "Idempotência" abaixo para o ramo com `Idempotency-Key`).
4. Caminho novo: checa `transferTypeId` no catalog → `Transaction.createPending` gera UUID v7 e reforça invariantes → `save` persiste.
5. Controller mapeia para `TransactionResponse` completo → `201 Created` + `Location`.

**Fluxo do `GET /transactions/:transactionExternalId`:** controller → `GetTransactionByExternalIdUseCase` → mapper → `200 TransactionResponse` ou `TransactionNotFoundError` → filter → `404`.

**Fluxo do `GET /transactions`:** controller → `ZodValidationPipe` (query) → `ListTransactionsUseCase` → `TransactionRepository.list(filters)` → `{ items, page, limit, total }`.

**Validação em camadas (Always-Valid).** Adapter HTTP (Zod) filtra input estrutural e cross-field antes do use case; o domínio (`Transaction.createPending`) re-checa as mesmas invariantes para bloquear construção de entidade inválida a partir de qualquer origem (seed, script, futuro consumer Kafka). Duplicação de ~2 linhas por regra em troca de defesa em profundidade.

Todos os componentes acima são **novos**. `apps/transactions/src/app.module.ts` (esqueleto vazio hoje) passa a importar `ConfigModule` e `TransactionsModule`.

## Design de implementação

### Principais interfaces

```ts
// application/ports/transaction-repository.port.ts
export type ListTransactionsFilters = {
  status?: TransactionStatusName;
  transferTypeId?: number;
  createdAtFrom?: Date;
  createdAtTo?: Date;
  page: number;
  limit: number;
};

export interface TransactionRepository {
  save(transaction: Transaction, idempotencyKey?: string): Promise<Transaction>;
  findByExternalId(externalId: string): Promise<Transaction | null>;
  findByIdempotencyKey(idempotencyKey: string): Promise<Transaction | null>;
  list(
    filters: ListTransactionsFilters,
  ): Promise<{ items: Transaction[]; total: number }>;
}
```

Injeção via **tokens** (`export const TRANSACTION_REPOSITORY = Symbol(...)`) para manter `domain`/`application` sem decorators do Nest. `TransactionsModule` liga token → provider Prisma. Use cases seguem o formato `execute(input) -> output` (ex.: `CreateTransactionUseCase` consulta `TransactionCatalogRepository` para o `transferTypeId`, constrói `Transaction.createPending`, salva pelo repositório).

### Modelos de dados

Contratos de I/O idênticos ao enunciado. Money é serializado como número JSON com duas casas decimais.

#### `CreateTransactionRequest` — corpo do `POST /transactions`

| Campo                     | Tipo     | Obrigatório | Descrição                                                                                                                          |
| ------------------------- | -------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `accountExternalIdDebit`  | `string` | sim         | UUID v4 da conta de débito. Deve ser diferente de `accountExternalIdCredit`.                                                       |
| `accountExternalIdCredit` | `string` | sim         | UUID v4 da conta de crédito. Deve ser diferente de `accountExternalIdDebit`.                                                       |
| `transferTypeId`          | `number` | sim         | Inteiro existente em `TransactionType`. Enum documentado na spec OpenAPI publicada em `/api/docs` (fase 1: apenas `1 = transfer`). |
| `value`                   | `number` | sim         | > 0, até duas casas decimais. Sem teto superior nesta fase (antifraude cuida disso na fase 2).                                     |

Header opcional `Idempotency-Key` — comportamento detalhado na seção "Idempotência".

```text
{
  "accountExternalIdDebit": "5f9a8b1e-3c2d-4f6a-8e9b-1a2b3c4d5e6f",
  "accountExternalIdCredit": "aa11bb22-cc33-4d44-8e55-ff66aa77bb88",
  "transferTypeId": 1,
  "value": 120.00
}
```

#### Resposta do `POST /transactions`

Corpo idêntico ao `TransactionResponse` (abaixo). `201 Created` para transação nova (header `Location: /transactions/<transactionExternalId>`); `200 OK` para replay via `Idempotency-Key` (sem `Location`, mesmo body).

#### `TransactionResponse` — payload do `GET /transactions/:transactionExternalId` e do `POST /transactions`

| Campo                     | Tipo                | Obrigatório | Descrição                                                 |
| ------------------------- | ------------------- | ----------- | --------------------------------------------------------- |
| `transactionExternalId`   | `string`            | sim         | UUID v7 gerado pelo servidor (também é a PK).             |
| `transactionType.name`    | `string`            | sim         | Nome em inglês (`transfer`).                              |
| `transactionStatus.name`  | `string`            | sim         | `pending`, `approved` ou `rejected`.                      |
| `value`                   | `number`            | sim         | Duas casas decimais.                                      |
| `createdAt`               | `string` (ISO 8601) | sim         | Data de criação em UTC.                                   |
| `updatedAt`               | `string` (ISO 8601) | sim         | Última alteração em UTC (fase 2 mexe via consumer Kafka). |
| `accountExternalIdDebit`  | `string`            | sim         | UUID da conta de origem.                                  |
| `accountExternalIdCredit` | `string`            | sim         | UUID da conta de destino.                                 |

```text
{
  "transactionExternalId": "0192a3f1-4a2b-7c8d-9e0f-1234567890ab",
  "transactionType":   { "name": "transfer" },
  "transactionStatus": { "name": "pending" },
  "value": 120.00,
  "createdAt": "2026-09-03T14:22:10.512Z",
  "updatedAt": "2026-09-03T14:22:10.512Z",
  "accountExternalIdDebit":  "5f9a8b1e-3c2d-4f6a-8e9b-1a2b3c4d5e6f",
  "accountExternalIdCredit": "aa11bb22-cc33-4d44-8e55-ff66aa77bb88"
}
```

#### `ListTransactionsResponse` — payload do `GET /transactions`

| Campo   | Tipo                    | Obrigatório | Descrição                                                                              |
| ------- | ----------------------- | ----------- | -------------------------------------------------------------------------------------- |
| `items` | `TransactionResponse[]` | sim         | Página ordenada por `createdAt` desc; cada item é idêntico ao payload do `GET` por id. |
| `page`  | `number`                | sim         | Página retornada (≥ 1).                                                                |
| `limit` | `number`                | sim         | Itens por página efetivamente aplicados.                                               |
| `total` | `number`                | sim         | Contagem global aplicando os filtros.                                                  |

```text
{
  "items": [ /* TransactionResponse */ ],
  "page": 1, "limit": 20, "total": 42
}
```

#### `ErrorEnvelope` — envelope de erro normalizado

| Código                     | HTTP  | Significado                                                                    |
| -------------------------- | ----- | ------------------------------------------------------------------------------ |
| `VALIDATION_ERROR`         | `400` | Body/query inválido no adapter HTTP (schema Zod, cross-field).                 |
| `INVALID_TRANSACTION`      | `400` | Invariante de domínio violada em construção não-HTTP (defesa em profundidade). |
| `TRANSACTION_NOT_FOUND`    | `404` | `transactionExternalId` inexistente.                                           |
| `TRANSFER_TYPE_NOT_FOUND`  | `400` | `transferTypeId` sem correspondência no catalog.                               |
| `IDEMPOTENCY_KEY_CONFLICT` | `422` | `Idempotency-Key` reutilizada com body diferente (padrão IETF).                |
| `INTERNAL_ERROR`           | `500` | Falha inesperada; detalhe fica no log.                                         |

```text
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request payload",
    "details": [{ "path": "value", "message": "must be greater than 0" }]
  }
}
```

#### Schema do banco (Prisma)

```
model Transaction {
  transactionExternalId     String            @id @default(uuid(7)) @db.Uuid
  idempotencyKey            String?           @unique @db.VarChar(64)
  bodyHash                  String?           @db.VarChar(64)
  accountExternalIdDebit    String            @db.Uuid
  accountExternalIdCredit   String            @db.Uuid
  value                     Decimal           @db.Decimal(19, 2)
  transferTypeId            Int
  transferType              TransactionType   @relation(fields: [transferTypeId], references: [id])
  transactionStatusId       Int
  transactionStatus         TransactionStatus @relation(fields: [transactionStatusId], references: [id])
  createdAt                 DateTime          @default(now())
  updatedAt                 DateTime          @updatedAt

  @@index([createdAt(sort: Desc)])
  @@index([transactionStatusId, createdAt(sort: Desc)])
  @@index([transferTypeId, createdAt(sort: Desc)])
}

model TransactionType   { id Int @id; name String @unique @db.VarChar(32); transactions Transaction[] }
model TransactionStatus { id Int @id; name String @unique @db.VarChar(32); transactions Transaction[] }
```

**Seeds e test data:** ver "Abordagem de testes" abaixo (três estratégias: `seed.ts` para catálogos idempotentes, `seed.demo.ts` opcional para dashboard manual, factory helper para setup de teste).

### Idempotência

Header opcional `Idempotency-Key` (string ≤ 64 chars, UUID recomendado — padrão IETF draft-ietf-httpapi-idempotency-key-header). Persistido em coluna `UNIQUE` na própria tabela `Transaction` (sem tabela dedicada, sem TTL — modelo Brandur completo fica para fase futura).

**Hash canonical do body.** `application/helpers/hash-body.ts` monta string canonical `${accountExternalIdDebit}|${accountExternalIdCredit}|${transferTypeId}|${value.toFixed(2)}` e passa por `crypto.createHash('sha256').digest('hex')`. `toFixed(2)` normaliza `120` e `120.00` para o mesmo hash. Zero dependência nova. Migração para RFC 8785 (JCS) é trivial trocando só o helper se o body ganhar campos aninhados.

**Ramo no `CreateTransactionUseCase`** (quando `Idempotency-Key` presente):

1. Computa `bodyHash = hashBody(command)`.
2. `findByIdempotencyKey(key)` no repositório.
3. Hit com **mesmo** `bodyHash` → retorna existente + flag `wasReplayed` (controller responde `200 OK`, sem `Location`).
4. Hit com `bodyHash` **diferente** → lança `IdempotencyKeyConflictError` → filter → `422 IDEMPOTENCY_KEY_CONFLICT`.
5. Miss → segue fluxo normal; `save` persiste transação + `idempotencyKey` + `bodyHash`.

**Race em requests concorrentes com mesma chave.** `PrismaTransactionRepository.save` tenta `create`; se pegar `PrismaClientKnownRequestError` com `code === 'P2002'` **e** `error.meta.target` incluir `idempotencyKey`, faz `findByIdempotencyKey` e retorna a existente. Isso delega a atomicidade ao `UNIQUE` do Postgres (padrão canônico Stripe). Catch fica no adapter Prisma para não vazar tecnologia no use case.

### Endpoints da API

| Método | Rota                                   | Corpo/Query                                                      | Sucesso                                                                                         | Erros                                                                                                                       |
| ------ | -------------------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `POST` | `/transactions`                        | `CreateTransactionRequest` (+ header opcional `Idempotency-Key`) | `201 TransactionResponse` (novo, com `Location`) / `200 TransactionResponse` (replay same body) | `400 VALIDATION_ERROR` / `400 TRANSFER_TYPE_NOT_FOUND` / `400 INVALID_TRANSACTION` / `422 IDEMPOTENCY_KEY_CONFLICT` / `500` |
| `GET`  | `/transactions/:transactionExternalId` | —                                                                | `200 TransactionResponse`                                                                       | `404 TRANSACTION_NOT_FOUND`                                                                                                 |
| `GET`  | `/transactions`                        | Query (ver tabela abaixo)                                        | `200 ListTransactionsResponse`                                                                  | `400 VALIDATION_ERROR`                                                                                                      |

**Query params do `GET /transactions`** (todos opcionais):

| Parâmetro        | Tipo                | Padrão | Regras                                                                                                                                                                                                                                          |
| ---------------- | ------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `status`         | `string`            | —      | Um de `pending`/`approved`/`rejected`.                                                                                                                                                                                                          |
| `transferTypeId` | `number`            | —      | Inteiro ≥ 1, existente no catalog.                                                                                                                                                                                                              |
| `createdAtFrom`  | `string` (RFC 3339) | —      | Timestamp RFC 3339 **com timezone** (`Z` ou `[±]hh:mm`). Ex.: `2026-09-04T00:00:00Z`. Zod: `z.iso.datetime({ offset: true })`. Recomenda-se `Z` na URL (o `+` do offset precisa ser encodado como `%2B`). Date-only (`YYYY-MM-DD`) é rejeitado. |
| `createdAtTo`    | `string` (RFC 3339) | —      | Mesmas regras do `From`. Se `From` presente, `To >= From`.                                                                                                                                                                                      |
| `page`           | `number`            | `1`    | Inteiro ≥ 1.                                                                                                                                                                                                                                    |
| `limit`          | `number`            | `20`   | Inteiro entre 1 e 100.                                                                                                                                                                                                                          |

> Filtros combinam com `AND`; datas inclusivas; ordem padrão `createdAt` desc; `total` é global (não da página).

## Pontos de integração

Uma dependência externa: **PostgreSQL** (do `docker-compose.yml`), autenticado pelo `.env`. Falha de conexão → `500 INTERNAL_ERROR`. Timeouts do Prisma nos defaults. Idempotência do POST: ver seção "Idempotência". Kafka entra na fase 2 sem tocar no core.

## Abordagem de testes

Stack: **Vitest** já configurado. Testes de unidade rodam sem I/O; mocks só no repositório dos use cases (in-memory). Testes de integração usam Postgres do `docker-compose.yml` em base dedicada `DATABASE_URL_TEST` — **compartilhada** entre runs, isolada via TRUNCATE.

**Três estratégias de dados:**

- **`prisma/seed.ts`** (invocado por `prisma db seed`): reference data (catálogos) via `upsert` idempotente. `TransactionStatus` = `{1:'pending',2:'approved',3:'rejected'}`, `TransactionType` = `{1:'transfer'}`.
- **`prisma/seed.demo.ts`** (invocado por `pnpm seed:demo`, guardado por `NODE_ENV=development`): N transações variadas para dashboard manual da fase 3. Não roda em `prisma db seed` nem no CI.
- **`test/helpers/transaction.factory.ts`**: `createTransaction(overrides?)` insere via Prisma direto com defaults sensatos. Testes de integração usam para preparar cenários (`?status=approved`, ranges de `createdAt`) sem endpoint HTTP público (anti-pattern).

**Setup Vitest em dois arquivos:**

- **`test/setup/global-setup.ts`** (`globalSetup` em `vitest.config.ts`): roda uma vez por invocação. `prisma migrate reset --force --skip-seed` contra `DATABASE_URL_TEST` + `seedCatalogs`.
- **`test/setup/reset.ts`** (`setupFiles`): `beforeEach` executa `TRUNCATE TABLE "Transaction" RESTART IDENTITY CASCADE`. Catálogos ficam intactos.

**Alternativas descartadas:** transaction rollback (aborta em P2002, quebra TI-14/TI-15); Testcontainers (overkill para 15 TIs — migrável trocando só `global-setup.ts` quando a suíte crescer ou fase 2 precisar de container Kafka).

### Testes de unidade

| ID    | Nome do caso de teste                                                                                                                        | Critérios | Resultado esperado                                                                                                                                                                 |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TU-01 | `CreateTransactionUseCase` grava com `PENDING` e devolve `Transaction` completa                                                              | CA-02     | Repo in-memory recebe entidade `PENDING`; response contém todos os campos de `TransactionResponse`.                                                                                |
| TU-02 | `CreateTransactionUseCase` erra `TransferTypeNotFoundError` para tipo inexistente                                                            | CA-03     | Erro esperado; `save` não é chamado.                                                                                                                                               |
| TU-03 | `GetTransactionByExternalIdUseCase` retorna entidade quando existe                                                                           | CA-04     | Entidade do repositório in-memory.                                                                                                                                                 |
| TU-04 | `GetTransactionByExternalIdUseCase` erra `TransactionNotFoundError`                                                                          | CA-05     | Erro esperado.                                                                                                                                                                     |
| TU-05 | `ListTransactionsUseCase` aplica filtros e paginação com defaults                                                                            | CA-06–10  | `filters` normalizados (`page=1`, `limit=20`).                                                                                                                                     |
| TU-06 | Schemas Zod rejeitam UUID, `value ≤ 0`, `debit === credit`, `page < 1`, `limit > 100`, datas sem timezone (`2026-09-04`) e datas malformadas | CA-03,11  | `ZodError` com `path` correto.                                                                                                                                                     |
| TU-07 | `transaction-response.mapper` produz as chaves exatas de `TransactionResponse` (inclui contas e `updatedAt`)                                 | CA-04     | Chaves = payload de `TransactionResponse`.                                                                                                                                         |
| TU-08 | `Transaction.createPending` lança `InvalidTransactionError` para `value ≤ 0` e `debit === credit`, mesmo sem passar pelo adapter HTTP        | CA-03a    | Erro de domínio; entidade não é construída.                                                                                                                                        |
| TU-09 | `CreateTransactionUseCase` com `Idempotency-Key` já visto retorna a transação existente sem chamar `save`                                    | CA-02a    | `findByIdempotencyKey` retorna hit; `save` não é chamado; response contém a transação original.                                                                                    |
| TU-10 | `PrismaTransactionRepository.save` trata P2002 na coluna `idempotencyKey`: dispara `findByIdempotencyKey` e devolve a existente sem lançar   | CA-02a    | Mock do Prisma lança `PrismaClientKnownRequestError { code:'P2002', meta:{target:['idempotencyKey']} }`; repositório retorna a transação; P2002 em outra coluna propaga como erro. |
| TU-11 | `hash-body` é determinístico e insensível a formatação numérica (`120` == `120.00`)                                                          | CA-02b    | `hashBody({...value:120})` === `hashBody({...value:120.00})`; hashes diferentes quando qualquer campo semântico muda.                                                              |
| TU-12 | `CreateTransactionUseCase` com `Idempotency-Key` já visto mas body diferente lança `IdempotencyKeyConflictError`                             | CA-02b    | `findByIdempotencyKey` retorna hit com `bodyHash` diverso; erro esperado; `save` não é chamado.                                                                                    |

### Testes de integração

| ID    | Nome do caso de teste                                                                                                                                                            | Critérios | Resultado esperado                                                                                                                                                                |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TI-01 | Migrations aplicam do zero e seed popula catalogs                                                                                                                                | CA-01     | Tabelas ok; `TransactionStatus` = 3 linhas; `TransactionType` ≥ 1.                                                                                                                |
| TI-02 | `POST /transactions` persiste `pending` e retorna `201 TransactionResponse` completo + `Location`                                                                                | CA-02     | Registro com `transactionStatusId=1`; UUID v7 válido; body tem contas e `updatedAt`; header `Location: /transactions/<uuid>`.                                                     |
| TI-03 | `POST /transactions` com body inválido → `400 VALIDATION_ERROR`                                                                                                                  | CA-03,12  | Nenhum registro criado; `details` aponta o campo.                                                                                                                                 |
| TI-04 | `GET /transactions/:id` retorna `TransactionResponse` com contas e `updatedAt`                                                                                                   | CA-04     | Chaves exatas: `transactionExternalId`, `transactionType.name`, `transactionStatus.name`, `value`, `createdAt`, `updatedAt`, `accountExternalIdDebit`, `accountExternalIdCredit`. |
| TI-05 | `GET /transactions/:id` inexistente → `404 TRANSACTION_NOT_FOUND`                                                                                                                | CA-05,12  | Envelope descritivo.                                                                                                                                                              |
| TI-06 | `GET /transactions` sem filtros aplica defaults e ordena `createdAt` desc                                                                                                        | CA-06     | `page=1`, `limit=20`, ordem correta.                                                                                                                                              |
| TI-07 | `GET /transactions?status=approved` filtra apenas aprovadas (setup via `createTransaction({ transactionStatusId: 2 })`)                                                          | CA-07     | Todos `items` com `transactionStatus.name = "approved"`.                                                                                                                          |
| TI-08 | `GET /transactions?transferTypeId=1` filtra por tipo (setup via factory)                                                                                                         | CA-08     | Todos `items` com o tipo esperado.                                                                                                                                                |
| TI-09 | `GET /transactions?createdAtFrom/To` filtra intervalo inclusivo (setup via factory com `createdAt` variados)                                                                     | CA-09     | Nenhum item fora do intervalo.                                                                                                                                                    |
| TI-10 | `GET /transactions?page=2&limit=5` devolve página correta e `total` global (setup: factory cria 10+ linhas)                                                                      | CA-10     | `items` = índices 5..9; `total` = count global.                                                                                                                                   |
| TI-11 | `GET /transactions?page=0` (etc.) → `400 VALIDATION_ERROR`                                                                                                                       | CA-11,12  | Envelope com `details`.                                                                                                                                                           |
| TI-12 | App falha no bootstrap sem `DATABASE_URL`                                                                                                                                        | CA-13     | Erro descritivo antes de `NestFactory.create`.                                                                                                                                    |
| TI-13 | `POST /transactions` com mesmo `Idempotency-Key` duas vezes (sequencial) → `201` depois `200`, mesma transação                                                                   | CA-02a    | Segunda resposta tem `200`, mesmo `transactionExternalId` e body; contagem no banco = 1.                                                                                          |
| TI-14 | Dois `POST /transactions` **concorrentes** com mesma `Idempotency-Key` (`Promise.all`) → ambos resolvem sem 500, mesmo `transactionExternalId`, uma resposta `201` e outra `200` | CA-02a    | Contagem no banco = 1; race atômica delegada ao UNIQUE do Postgres.                                                                                                               |
| TI-15 | `POST /transactions` com `Idempotency-Key: X` e body A retorna `201`; segundo `POST` com `Idempotency-Key: X` e body B retorna `422 IDEMPOTENCY_KEY_CONFLICT`                    | CA-02b    | Envelope descritivo; contagem no banco = 1.                                                                                                                                       |

Testes E2E de UI: **não aplicáveis** nesta fase (frontend é fase 3). A cobertura HTTP fim-a-fim já está nos TI-* usando `supertest` contra a instância Nest.

## Sequenciamento do desenvolvimento

### Ordem de construção

1. **Prisma + Postgres** — deps, `schema.prisma`, migration inicial, `seed.ts` (catálogos idempotentes via `upsert`), `seed.demo.ts` (dev-only, guardado por `NODE_ENV`), `PrismaService`.
2. **Config validado** — `ConfigModule` + Zod para `DATABASE_URL`/`TRANSACTIONS_PORT`; `main.ts` usa valor tipado.
3. **Domain + application** — entidades, tokens de porta, use cases; TU-* com repos in-memory (núcleo verde sem Nest).
4. **Adapters HTTP** — DTOs Zod, pipe, filter, controller, mapper de response.
5. **Adapter Prisma** — repositórios implementando as portas; mapper record → domínio.
6. **Wiring** — `TransactionsModule` liga tokens → providers; `AppModule` importa `ConfigModule` + `TransactionsModule`.
7. **Integração** — setup files `test/setup/global-setup.ts` (migrate reset + seed catálogos) e `test/setup/reset.ts` (TRUNCATE por teste), factory helper `test/helpers/transaction.factory.ts`; TI-01..TI-15 contra Postgres real; `pnpm quality` prepara base de teste no `pretest`.
8. **DECISIONS.md** — registrar hexagonal + use cases, paginação offset com `page`/`limit`, Zod na borda + `nestjs-zod`, UUID v7 merged como PK, `201` + body completo no POST com `Location`, `Idempotency-Key` opcional, enum documentado via OpenAPI, envelope de erro, nomes em inglês.

### Dependências técnicas

- Postgres do `docker-compose.yml` de pé para desenvolvimento local e integração.
- Base de dados dedicada `challenge_test` para os TI-* (variável `DATABASE_URL_TEST` no `.env.example`).
- Dependências novas (dev + runtime): `prisma` (≥ 5.18 para `uuid(7)`), `@prisma/client`, `zod`, `nestjs-zod`, `@nestjs/swagger`, `@nestjs/config`.

## Monitoramento e observabilidade

Mínimo defensável:

- **Logs** via `Logger` do Nest: `log` para request completa, `error` para `500`. `HttpExceptionFilter` loga `stack` mas nunca o coloca no corpo da resposta.
- **Bootstrap explícito**: validação Zod do `.env` aborta com mensagem apontando as variáveis inválidas (CA-13).
- **Health checks, métricas e tracing** ficam fora (PRD explicita "observabilidade não prevista").

## Considerações técnicas

### Principais decisões

- **Hexagonal + use-cases** (vs service Nest monolítico ou Clean por anel). Fase 2 introduz Kafka como driven adapter sem tocar no core. Porta `TransactionEventPublisher` **não** é criada nesta fase (YAGNI); entra na fase 2 junto com a implementação real.
- **Zod na borda HTTP via `nestjs-zod`** (vs `class-validator`, vs Valibot). Schema é fonte única do tipo; `nestjs-zod` provê `ZodValidationPipe` pronto e integração com `@nestjs/swagger` (spec OpenAPI publicada em `/api/docs`). Application recebe tipos TS puros, não `z.infer<>` do HTTP — mapper explícito no controller converte body/query em command de application.
- **Offset `page`/`limit`** (vs cursor, vs `page/pageSize`). `limit` alinha com convenção IETF; dashboard mostra "página N de M"; a defesa de alto volume na fase 5 explora índices e réplicas.
- **Prisma em `apps/transactions/prisma/`** (vs `packages/database`). `anti-fraud` não lê o banco.
- **UUID v7 merged como PK** (vs int autoincrement + externalId separado, vs UUID v4). Prisma 5.18+ suporta `@default(uuid(7))` nativamente; schema mais enxuto (uma coluna a menos, um `@unique` a menos, um mapper a menos), locality de B-tree comparável a bigint, defesa da fase 5 mais forte, migração futura zero. Trade-off aceito: timestamp leak — redundante com `createdAt` que já é público.
- **`201 Created` + body completo do recurso + header `Location`** (vs `202 Accepted` + só `externalId`). Recurso está criado sincronamente (queryable no GET imediato); `status: "pending"` é estado de negócio, não promessa assíncrona. Padrão Stripe/Adyen; cliente já sabe tudo sem GET adicional.
- **`Idempotency-Key` opcional (padrão IETF draft) via coluna `UNIQUE` na própria tabela** (vs modelo Brandur/Stripe completo com tabela dedicada, response cacheado e TTL). Custo baixíssimo (~20 linhas); defesa da fase 5 fica trivial; consumer Kafka na fase 2 usa `eventId` como chave própria.
- **Enum `transferTypeId` documentado na spec OpenAPI** (vs endpoint `GET /transfer-types`). Zalando/Fern/Appwrite: enums vivem na spec; endpoint separado só quando o catálogo é dinâmico/administrável.
- **Envelope `{ error: { code, message, details? } }`** (vs shape default do Nest). `code` estável para o cliente.
- **Money `Decimal(19,2)` no banco → `number` no JSON**. Seguro até bilhões com duas casas; string ou centavos ficam fora até serem pedidos.
- **Nomes de catálogo em inglês** (vs português como no texto do enunciado). Tradução PT-BR é responsabilidade do frontend (fase 3); chaves estáveis facilitam i18n futuro.

### Riscos conhecidos

- **Serialização de `Decimal`.** Prisma devolve `Decimal` (lib), não `number`. Mapper converte via `.toNumber()` com duas casas; TU-07 cobre.
- **Integração compartilhando Postgres.** Contaminaria a base de dev. Mitigação: `DATABASE_URL_TEST` em base separada (detalhes em "Abordagem de testes").
- **Zod pipe custom.** Risco de mensagem inconsistente entre `body` e `query`. Mitigação: pipe único parametrizado por schema; TU-06 cobre.
- **Bootstrap sem `DATABASE_URL`.** Validar o `.env` antes de `NestFactory.create` para manter a mensagem limpa.

### Conformidade com o AGENTS.md e as rules

Li `AGENTS.md` (symlink para `CLAUDE.md`) e `.claude/rules/code-standards.md`. Restrições que amarram esta spec:

- **Sem `any`:** tipos vêm de `z.infer` (DTOs) e de mappers explícitos.
- **≤ 100 linhas/arquivo, ≤ 30/função, ≤ 3 parâmetros, guard clauses, sem linhas em branco em funções, sem magic numbers.** Constantes: `DEFAULT_PAGE = 1`, `DEFAULT_LIMIT = 20`, `MAX_LIMIT = 100`, `DECIMAL_SCALE = 2`, `IDEMPOTENCY_KEY_MAX_LENGTH = 64`.
- **Sem segredos:** `DATABASE_URL`/`DATABASE_URL_TEST` no `.env`; `.env.example` documenta.
- **Conventional Commits + PR para `develop`** (fluxo da fase 0).
- **`DECISIONS.md`** ganha todas as decisões estruturantes listadas no PRD (arquitetura hexagonal + use-cases, paginação offset com `page`/`limit`, Zod na borda via `nestjs-zod`, UUID v7 merged como PK, `201` + body completo com `Location`, `Idempotency-Key` opcional, enum via OpenAPI, envelope de erro, nomes em inglês, money como `Decimal(19,2)` → `number`).

### Conformidade com skills

Aplicáveis: `criar-tasks` (próximo passo do fluxo), `executar-task` (execução), `executar-review` (após implementação), `executar-qa` (validação de comportamento). `vercel-react-best-practices`, `web-design-guidelines` e `domain-modeling` **não se aplicam** aqui (frontend é fase 3; modelagem é enxuta e não exige a skill dedicada).

### Arquivos relevantes e dependentes

- **Modificados:** `apps/transactions/package.json` (deps + scripts `seed:demo` e `db:seed`), `apps/transactions/src/app.module.ts`, `apps/transactions/src/main.ts`, `apps/transactions/src/smoke.test.ts` (removido em favor dos testes reais), `.env.example` (adiciona `DATABASE_URL_TEST`), `DECISIONS.md` (novas decisões).
- **Novos:** todos os arquivos listados em "Visão dos componentes".
- **Não tocados:** `apps/anti-fraud/*`, `apps/web/*`, `packages/*`, `docker-compose.yml` (Postgres já pronto), workflow de CI.
