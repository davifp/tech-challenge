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

| Serviço  | Endereço                                       |
| -------- | ---------------------------------------------- |
| Postgres | `localhost:5432`                               |
| Kafka    | `localhost:9092`                               |
| Kafka UI | [http://localhost:8080](http://localhost:8080) |

## Comandos

Raiz (quality gate):

| Comando             | Efeito                                                                          |
| ------------------- | ------------------------------------------------------------------------------- |
| `pnpm quality`      | Roda o pipeline completo: `lint`, `typecheck`, `format:check`, `test`, `build`. |
| `pnpm lint`         | ESLint 9 (flat config) em todos os apps e pacotes.                              |
| `pnpm typecheck`    | `tsc --noEmit` em todos os apps e pacotes.                                      |
| `pnpm format:check` | Prettier em modo verificação.                                                   |
| `pnpm test`         | Vitest em todos os apps.                                                        |
| `pnpm build`        | `nest build` nos backends, `next build` no `web`.                               |

Ciclo curto por app:

```bash
pnpm --filter @tech-challenge/<app> <script>
# scripts: dev, build, lint, typecheck, format:check, test, quality
```

Infraestrutura:

```bash
docker compose ps           # status
docker compose logs -f      # acompanhar logs
docker compose down         # derruba (mantém volumes)
docker compose down -v      # derruba e apaga dados
```

## Referências

- [`PRACTICES.md`](./PRACTICES.md): práticas obrigatórias (quality gate, CI, commits, branches, PRs, testes, decisões).
- [`DECISIONS.md`](./DECISIONS.md): decisões estruturantes com alternativas e justificativas.
- [`docker-compose.yml`](./docker-compose.yml): infra local (Postgres, Kafka, Kafka UI).
- [`.spec-driven/`](./.spec-driven): PRD, TechSpec e tasks.
