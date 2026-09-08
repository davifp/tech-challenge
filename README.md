# Tech Challenge

Monorepo (pnpm workspaces + Turborepo) para dois serviços NestJS (`transactions` e `anti-fraud`) e um dashboard Next.js (`web`). Fundação pronta: quality gate único, hooks Git, CI e infra local em Docker.

Práticas obrigatórias em [`PRACTICES.md`](./PRACTICES.md). Decisões estruturantes em [`DECISIONS.md`](./DECISIONS.md).

## Pré-requisitos

| Ferramenta       | Versão               |
| ---------------- | -------------------- |
| Node.js          | **22.x** (LTS "Jod") |
| pnpm             | **11.25+**           |
| Docker + Compose | recente              |

## Setup

```bash
git clone <fork-url> tech-challenge && cd tech-challenge
nvm install                # instala e ativa a versão definida no .nvmrc
node --version             # deve exibir v22.x
pnpm --version             # deve exibir 11.25.x
pnpm install               # instala dependências e hooks Git
cp .env.example .env
```

O `nvm use` deve ser executado em cada terminal novo antes de iniciar os apps ou rodar comandos do
projeto. Processos iniciados anteriormente precisam ser encerrados e reiniciados para usar a nova
versão do Node.

### Executar a aplicação completa

Prepare a infraestrutura e o banco de desenvolvimento uma vez:

```bash
docker compose up -d --wait
pnpm --filter @tech-challenge/transactions exec prisma migrate deploy
pnpm --filter @tech-challenge/transactions db:seed
```

Depois, escolha uma das opções abaixo.

**Opção 1 — iniciar Transactions, Anti-Fraud e Dashboard juntos:**

```bash
pnpm dev
```

Esse script executa a tarefa `dev` dos três apps ao mesmo tempo por meio do Turborepo.

**Opção 2 — acompanhar cada serviço separadamente:**

Use três terminais e execute um comando em cada um:

```bash
pnpm --filter @tech-challenge/transactions dev
pnpm --filter @tech-challenge/anti-fraud dev
pnpm --filter @tech-challenge/web dev
```

O Anti-Fraud é um worker Kafka e não expõe uma porta HTTP. A inicialização está saudável quando os
dois consumers entram em seus grupos e registram `outcome: "connected"`.

Serviços de infra depois do `docker compose up -d`:

| Serviço   | Endereço                                                         |
| --------- | ---------------------------------------------------------------- |
| Postgres  | `localhost:5432`                                                 |
| Kafka     | `localhost:9092`                                                 |
| Kafka UI  | [http://localhost:8080](http://localhost:8080)                   |
| Dashboard | [http://localhost:3000](http://localhost:3000)                   |
| API       | [http://localhost:3001](http://localhost:3001)                   |
| Swagger   | [http://localhost:3001/api/docs](http://localhost:3001/api/docs) |

O quality gate usa containers próprios e descartáveis em `localhost:5433` (PostgreSQL) e
`localhost:9093` (Kafka). Eles são removidos automaticamente ao final, sem alterar os dados locais
dos serviços acima. A API e o dashboard E2E também usam portas isoladas: `3091` e `5191`.

## Comandos

Comandos na raiz:

| Comando             | Efeito                                                          |
| ------------------- | --------------------------------------------------------------- |
| `pnpm dev`          | Inicia Transactions, Anti-Fraud e Dashboard em desenvolvimento. |
| `pnpm quality`      | Roda o gate completo com PostgreSQL e Kafka descartáveis.       |
| `pnpm lint`         | ESLint 9 (flat config) em todos os apps e pacotes.              |
| `pnpm typecheck`    | `tsc --noEmit` em todos os apps e pacotes.                      |
| `pnpm format:check` | Prettier em modo verificação.                                   |
| `pnpm test`         | Vitest em todos os apps.                                        |
| `pnpm build`        | `nest build` nos backends, `next build` no `web`.               |
| `pnpm test:e2e`     | Sobe os apps necessários e executa E2E-01/E2E-02 no Chromium.   |

Ciclo curto por app:

```bash
pnpm --filter @tech-challenge/<app> <script>
# apps: transactions, anti-fraud ou web
# scripts principais: dev, build, lint, typecheck, format:check e test
```

Para iniciar o dashboard na porta padrão do Next.js, mantenha `NEXT_PUBLIC_API_URL` configurada na
raiz e execute:

```bash
pnpm --filter @tech-challenge/web dev
```

O navegador usa `NEXT_PUBLIC_API_URL` para chamar a API diretamente. O serviço `transactions`
permite essa origem por CORS conforme `DASHBOARD_ORIGIN`.

## Testes E2E do dashboard

O E2E usa PostgreSQL e Kafka exclusivos, iniciados pelo comando raiz. A suíte inicia e encerra API,
antifraude e o build de produção do dashboard; ao final, a infraestrutura de testes também é
removida. Os containers persistentes de desenvolvimento podem continuar em execução.

```bash
cp .env.example .env
pnpm --filter @tech-challenge/web test:e2e:install
pnpm test:e2e
```

Os comandos raiz usam `3091` para a API E2E e `5191` para o dashboard. Ao executar diretamente no
workspace, os padrões são `3001` e `5191`. Se estiverem ocupadas, defina `E2E_TRANSACTIONS_PORT`,
`E2E_WEB_PORT`, `NEXT_PUBLIC_API_URL` e `DASHBOARD_ORIGIN` com valores coerentes antes do build e dos
testes. Capturas, snapshots acessíveis, traces e vídeos ficam em
`.spec-driven/prd-fase-3-dashboard-nextjs/evidences/`; o CI retém esse diretório quando falha.

Os comandos raiz `pnpm test`, `pnpm test:e2e` e `pnpm quality` gerenciam automaticamente o ambiente
definido em `docker-compose.test.yml`. Scripts executados diretamente dentro de um workspace usam as
variáveis de ambiente fornecidas pelo chamador. No comando raiz, os testes dos workspaces são
serializados porque as suítes de integração compartilham os tópicos do Kafka descartável.

Para validar todo o repositório, execute na raiz:

```bash
pnpm quality
```

Não é necessário interromper os apps nem a infraestrutura de desenvolvimento. O comando usa
PostgreSQL, Kafka, API e Dashboard isolados e remove os recursos temporários mesmo quando algum teste
falha. Evite executar os testes de integração diretamente dentro dos workspaces, pois esses comandos
usam as variáveis fornecidas pelo terminal; prefira sempre `pnpm test`, `pnpm test:e2e` ou
`pnpm quality` na raiz.

Infraestrutura:

```bash
docker compose ps           # status
docker compose logs -f      # acompanhar logs
docker compose down         # derruba (mantém volumes)
docker compose down -v      # derruba e apaga dados
```

Para encerrar o ambiente, use `Ctrl+C` no terminal dos apps e depois:

```bash
docker compose down
```

## Evidência operacional do fluxo antifraude

Com a infraestrutura saudável, inicie `transactions` e `anti-fraud` em terminais separados:

```bash
pnpm --filter @tech-challenge/transactions dev
pnpm --filter @tech-challenge/anti-fraud dev
```

Crie uma transação e use o identificador retornado para acompanhar a decisão eventual:

```bash
curl -sS -X POST http://localhost:3001/transactions \
  -H 'Content-Type: application/json' \
  -d '{"accountExternalIdDebit":"0199f9c2-1a2b-7c8d-9e0f-1234567890ab","accountExternalIdCredit":"0299f9c2-1a2b-7c8d-9e0f-1234567890ab","transferTypeId":1,"value":1000}'

curl -sS http://localhost:3001/transactions/<transactionExternalId>
```

No [Kafka UI](http://localhost:8080), abra o cluster `challenge` e inspecione os tópicos
`transaction.created` e `transaction.status.updated`. Ambos usam `transactionExternalId` como key e
correlação. Os logs JSON dos serviços registram `eventName`, `eventId`, `transactionExternalId`,
`correlationId`, tópico, partição, offset e `outcome`, permitindo seguir publicação, consumo,
duplicidade, retry e DLQ sem expor o payload ou credenciais.

## Referências

- [`PRACTICES.md`](./PRACTICES.md): práticas obrigatórias (quality gate, CI, commits, branches, PRs, testes, decisões).
- [`DECISIONS.md`](./DECISIONS.md): decisões estruturantes com alternativas e justificativas.
- [`docker-compose.yml`](./docker-compose.yml): infra local (Postgres, Kafka, Kafka UI).
- [`.spec-driven/`](./.spec-driven): PRD, TechSpec e tasks.
