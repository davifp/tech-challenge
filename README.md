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
nvm use                    # respeita o .nvmrc (Node 22)
pnpm install               # instala deps e hooks Git (via postinstall)
cp .env.example .env
docker compose up -d       # Postgres, Kafka e Kafka UI
pnpm quality               # roda o pipeline completo
```

Verde ao final significa repositório pronto para desenvolvimento. Setup medido localmente em ~45s (teto do desafio: 10 min).

Serviços de infra depois do `docker compose up -d`:

| Serviço   | Endereço                                       |
| --------- | ---------------------------------------------- |
| Postgres  | `localhost:5432`                               |
| Kafka     | `localhost:9092`                               |
| Kafka UI  | [http://localhost:8080](http://localhost:8080) |
| Dashboard | [http://localhost:3000](http://localhost:3000) |

## Comandos

Raiz (quality gate):

| Comando             | Efeito                                                        |
| ------------------- | ------------------------------------------------------------- |
| `pnpm quality`      | Roda lint, tipos, formato, Vitest, build e E2E Playwright.    |
| `pnpm lint`         | ESLint 9 (flat config) em todos os apps e pacotes.            |
| `pnpm typecheck`    | `tsc --noEmit` em todos os apps e pacotes.                    |
| `pnpm format:check` | Prettier em modo verificação.                                 |
| `pnpm test`         | Vitest em todos os apps.                                      |
| `pnpm build`        | `nest build` nos backends, `next build` no `web`.             |
| `pnpm test:e2e`     | Sobe os apps necessários e executa E2E-01/E2E-02 no Chromium. |

Ciclo curto por app:

```bash
pnpm --filter @tech-challenge/<app> <script>
# scripts: dev, build, lint, typecheck, format:check, test, quality
```

Para iniciar o dashboard na porta padrão do Next.js, mantenha `NEXT_PUBLIC_API_URL` configurada na
raiz e execute:

```bash
pnpm --filter @tech-challenge/web dev
```

O navegador usa `NEXT_PUBLIC_API_URL` para chamar a API diretamente. O serviço `transactions`
permite essa origem por CORS conforme `DASHBOARD_ORIGIN`.

## Testes E2E do dashboard

O E2E usa `DATABASE_URL_TEST` e apaga somente essa base antes da execução. Nunca aponte essa variável
para desenvolvimento ou produção. PostgreSQL e Kafka devem estar saudáveis; a suíte inicia e encerra
API, antifraude e o build de produção do dashboard.

```bash
cp .env.example .env
docker compose up -d postgres kafka
pnpm --filter @tech-challenge/web test:e2e:install
pnpm test:e2e
```

As portas padrão são `3001` para a API E2E e `5191` para o dashboard. Se estiverem ocupadas, defina
`E2E_TRANSACTIONS_PORT`, `E2E_WEB_PORT`, `NEXT_PUBLIC_API_URL` e `DASHBOARD_ORIGIN` com valores
coerentes antes de executar o build e os testes. Capturas, snapshots acessíveis, traces e vídeos ficam
em `.spec-driven/prd-fase-3-dashboard-nextjs/evidences/`; o CI retém esse diretório quando falha.

Infraestrutura:

```bash
docker compose ps           # status
docker compose logs -f      # acompanhar logs
docker compose down         # derruba (mantém volumes)
docker compose down -v      # derruba e apaga dados
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
