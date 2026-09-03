# Especificação técnica

**Funcionalidade:** Fase 0 — Fundação (monorepo, TS, quality gate, CI, docker-compose)
**PRD:** `.spec-driven/prd-fase-0-fundacao/prd.md`

## Resumo

Monorepo `pnpm workspaces` orquestrado por Turborepo, com três apps em `apps/` (`transactions` — NestJS API; `anti-fraud` — microserviço NestJS; `web` — dashboard Next.js) e configs compartilhadas em `packages/` (`eslint-config`, `prettier-config`, `tsconfig`, `vitest-config`). O quality gate único (`pnpm quality`) delega para `turbo run` cinco tasks — `lint`, `typecheck`, `format:check`, `test`, `build` — cada uma também executável isoladamente pelos scripts `pnpm lint`, `pnpm typecheck` etc.

Vitest é a única ferramenta de teste em todos os apps (uniforme, ESM-first, com `unplugin-swc` no NestJS para decorators e Testing Library no Next.js). Lefthook instala hooks Git no `postinstall`: `pre-commit` roda `lint-staged` sobre arquivos alterados; `commit-msg` roda `commitlint` com `@commitlint/config-conventional`. GitHub Actions executa `pnpm quality` em push e PR para `develop`, com cache de pnpm store e `.turbo/`. `docker-compose.yml`, `.env.example`, `.editorconfig`, `.gitignore`, `.nvmrc` e o PR template já existem no repositório e são apenas revisados. `DECISIONS.md` registra as escolhas estruturantes.

## Arquitetura do sistema

### Visão dos componentes

```
tech-challenge/
├── apps/
│   ├── transactions/         # NestJS placeholder + smoke
│   ├── anti-fraud/           # NestJS placeholder + smoke
│   └── web/                  # Next.js App Router placeholder + smoke
├── packages/
│   ├── eslint-config/        # Flat config: base, node, react
│   ├── prettier-config/      # Prettier compartilhado
│   ├── tsconfig/             # tsconfig bases: base, node, react
│   └── vitest-config/        # Vitest bases: node (NestJS), react (Next.js)
├── .github/workflows/quality.yml
├── lefthook.yml
├── commitlint.config.ts
├── turbo.json
├── pnpm-workspace.yaml
├── package.json              # scripts orquestradores + lint-staged
├── docker-compose.yml        # já existe — mantido
├── .env.example              # já existe — revisado
├── DECISIONS.md              # novo
└── README.md                 # substitui o do desafio
```

**Componentes novos:** `pnpm-workspace.yaml`, `turbo.json`, `package.json` raiz, esqueletos dos três apps, quatro pacotes de config, `lefthook.yml`, `commitlint.config.ts`, workflow do GitHub Actions, `DECISIONS.md` e `README.md` do projeto.

**Componentes revisados (não recriados):** `docker-compose.yml`, `.env.example`, `.editorconfig`, `.gitignore`, `.nvmrc`, `.github/pull_request_template.md`.

**Fluxo do quality gate**

```
pnpm quality → turbo run lint typecheck format:check test build
                 │
                 ├─▶ apps/transactions   (scripts próprios)
                 ├─▶ apps/anti-fraud     (scripts próprios)
                 └─▶ apps/web            (scripts próprios)
```

**Fluxo dos hooks**

```
git commit → lefthook
              ├─ pre-commit  → lint-staged → ESLint --fix + Prettier --write
              └─ commit-msg  → commitlint (Conventional Commits)
```

**Fluxo do CI**

```
push/PR → develop → GitHub Actions
                     ├─ setup Node 22 + pnpm 11 (cache pnpm store)
                     ├─ pnpm install --frozen-lockfile
                     ├─ restore/save .turbo/
                     └─ pnpm quality (verde/vermelho)
```

## Design de implementação

### Principais interfaces

**`package.json` (raiz) — scripts**

```json
{
  "scripts": {
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "format:check": "turbo run format:check",
    "test": "turbo run test",
    "build": "turbo run build",
    "quality": "pnpm lint && pnpm typecheck && pnpm format:check && pnpm test && pnpm build",
    "prepare": "lefthook install"
  }
}
```

**`turbo.json` — tasks**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build":        { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**", "!.next/cache/**"] },
    "lint":         { "dependsOn": ["^lint"] },
    "typecheck":    { "dependsOn": ["^typecheck"] },
    "format:check": {},
    "test":         { "dependsOn": ["^build"] }
  }
}
```

**`lefthook.yml`**

```yaml
pre-commit:
  parallel: true
  commands:
    lint-staged: { run: pnpm exec lint-staged }

commit-msg:
  commands:
    commitlint: { run: pnpm exec commitlint --edit {1} }
```

**`lint-staged` (em `package.json` raiz)**

```json
{
  "lint-staged": {
    "*.{ts,tsx,js,mjs}":     ["eslint --fix", "prettier --write"],
    "*.{md,json,yml,yaml}":  ["prettier --write"]
  }
}
```

**Scripts padrão por app**

```json
{
  "scripts": {
    "dev": "…",
    "build": "…",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "quality": "pnpm lint && pnpm typecheck && pnpm format:check && pnpm test && pnpm build"
  }
}
```

### Versões alvo (estáveis, 2026-09-03)

| Categoria | Pacote | Versão alvo |
| --- | --- | --- |
| Runtime | Node.js | 22 (LTS "Jod") — fixado no `.nvmrc` |
| Gerenciador | `pnpm` | 11.x |
| Linguagem | `typescript` | 7.x |
| Monorepo | `turbo` | 2.10.x |
| Testes | `vitest` | 5.x |
| NestJS | `@nestjs/core`, `@nestjs/cli` | 12.x |
| Next.js | `next` | 16.x (React 19) |
| Lint | `eslint` | 10.x (flat config) |
| Lint TS | `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin` | 8.x |
| Format | `prettier` | 3.9.x |
| Hooks | `lefthook` | 2.1.x |
| Commits | `@commitlint/cli`, `@commitlint/config-conventional` | 21.x |
| Staged | `lint-staged` | 17.x |
| NestJS ↔ Vitest | `unplugin-swc` | 1.5.x |
| Testing Library | `@testing-library/react`, `@testing-library/jest-dom` | 16.x, 7.x |

Cada `package.json` fixa o range em `^<major>.<minor>` para permitir patches sem quebras. `packageManager` no `package.json` raiz cravado em `pnpm@11.x.x` para o Corepack/CI.

### Modelos de dados

Não aplicável nesta fase. Não há entidades, contratos JSON ou schemas de banco a modelar — todos entram nas fases 1 (Prisma/domínio) e 2 (eventos Kafka).

### Endpoints da API

Não aplicável nesta fase. Endpoints entram na Fase 1.

## Pontos de integração

- **GitHub Actions** — workflow `.github/workflows/quality.yml`. Triggers: `push` para `develop` e `pull_request` com destino `develop`. Steps: `actions/checkout@v4`, `pnpm/action-setup@v4` (pnpm 11), `actions/setup-node@v4` (Node 22 + cache `pnpm`), `actions/cache@v4` para `.turbo/`, `pnpm install --frozen-lockfile`, `pnpm quality`. Timeout duro do job: 15 minutos. Falha em qualquer step marca o commit como vermelho.
- **Docker Compose local** — arquivo já versionado. Não é invocado no quality gate; apenas fornece infra local para o CA-01 e as fases seguintes.
- **Registry npm** — dependências resolvidas via `pnpm install`. CI usa `--frozen-lockfile`.

## Abordagem de testes

O PRD desta fase entrega apenas o pipeline conectado (RF8, CA-10): um teste de smoke por app, sem regra de domínio.

### Testes de unidade

| ID    | Nome do caso de teste                          | CA    | Resultado esperado                                                    |
| ----- | ---------------------------------------------- | ----- | --------------------------------------------------------------------- |
| TU-01 | `transactions/smoke` — asserção trivial        | CA-10 | `pnpm --filter transactions test` executa 1 caso e passa              |
| TU-02 | `anti-fraud/smoke` — asserção trivial          | CA-10 | `pnpm --filter anti-fraud test` executa 1 caso e passa                |
| TU-03 | `web/smoke` — renderização mínima via Testing Library | CA-10 | `pnpm --filter web test` executa 1 caso e passa                       |
| TU-04 | Quality gate isolado por app                   | CA-03 | `pnpm --filter <app> quality` roda lint/typecheck/format/test/build de um único app |
| TU-05 | Quality gate isolado por etapa                 | CA-02 | Cada `pnpm <etapa>` (`lint`, `typecheck`, `format:check`, `test`, `build`) roda isoladamente e passa |
| TU-06 | ESLint bloqueia `any`                          | CA-11 | Regra `@typescript-eslint/no-explicit-any` como `error`; `pnpm lint` falha se houver `any` explícito |

### Testes de integração

| ID    | Nome do caso de teste                              | CA          | Resultado esperado                                                            |
| ----- | -------------------------------------------------- | ----------- | ----------------------------------------------------------------------------- |
| TI-01 | Hook `commit-msg` rejeita mensagem inválida        | CA-05       | `git commit -m "arrumei"` sai com código ≠ 0 e mensagem do commitlint         |
| TI-02 | Hook `commit-msg` aceita Conventional Commits      | CA-06       | `git commit -m "feat(x): y"` completa com sucesso                              |
| TI-03 | Hook `pre-commit` processa só arquivos alterados   | CA-07       | Ao commitar 1 arquivo, apenas ele passa por ESLint/Prettier (verificado via `lint-staged` verbose) |
| TI-04 | Setup end-to-end ≤ 10 min                          | CA-01       | Do `pnpm install` ao `pnpm quality` verde em ambiente limpo, com Docker configurado, em ≤ 10 min |
| TI-05 | `docker compose up -d` sobe as três dependências   | CA-12       | Após o comando, Postgres em `5432`, Kafka em `9092`, Kafka UI em `8080` respondem |
| TI-06 | Workflow do CI executa em PR para `develop`        | CA-08, CA-09| Push/PR em `develop` dispara o job; verde para código válido, vermelho para falha em qualquer etapa |

### Testes E2E

Não aplicável nesta fase — sem UI real e sem endpoints de domínio. E2E entra a partir da Fase 3.

Sem meta numérica de cobertura (`PRACTICES.md`: "não perseguimos um número de cobertura"). Vitest usa mocks somente para módulos externos; aqui, nada a mockar.

## Sequenciamento do desenvolvimento

### Ordem de construção

1. **Esqueleto do monorepo** — `pnpm-workspace.yaml`, `package.json` raiz mínimo, `turbo.json`, diretórios `apps/` e `packages/`.
2. **Configs compartilhadas** — `packages/tsconfig`, `packages/eslint-config` (flat), `packages/prettier-config`, `packages/vitest-config`.
3. **Esqueletos dos apps** — `transactions` e `anti-fraud` (NestJS mínimo com `main.ts`, `app.module.ts`), `web` (Next.js App Router com `app/page.tsx`, `app/layout.tsx`).
4. **Smoke tests** — um por app.
5. **Quality gate** — scripts raiz + tasks Turbo; validar cada etapa isoladamente.
6. **Hooks** — `lefthook.yml`, `commitlint.config.ts`, `lint-staged` no `package.json` raiz; `prepare: lefthook install`.
7. **CI** — `.github/workflows/quality.yml`.
8. **Revisar arquivos herdados** — `.env.example`, `.gitignore`, `.editorconfig`, `.nvmrc`, PR template.
9. **`DECISIONS.md`** — decisão de estrutura + Turbo + Vitest + Lefthook + configs compartilhadas + resposta à pergunta sobre volume alto (README exige).
10. **`README.md`** — substituir o do desafio; documentar setup ≤ 10 min, comandos, arquitetura.

### Dependências técnicas

- Node 22 (LTS "Jod") e pnpm 11+ instalados; versão fixada no `.nvmrc` já versionado.
- Docker e Docker Compose (para CA-01 e CA-12).
- Acesso ao registry público npm.
- GitHub Actions habilitado no fork.

## Monitoramento e observabilidade

Nesta fase, "observabilidade" é sobre o próprio pipeline de qualidade:

- **Local**: `docker compose ps` mostra containers healthy (Postgres e Kafka já têm healthcheck no compose); Turbo imprime status por task; Vitest e tsc emitem stderr claro em falhas.
- **CI**: cada step do workflow tem status próprio no PR; falha bloqueia mesclagem.
- **Logs de aplicação**: não há aplicação nesta fase — logger estruturado entra a partir da Fase 1.

## Considerações técnicas

### Principais decisões

Todas registradas também em `DECISIONS.md`.

1. **Monorepo `pnpm workspaces`** vs. polirepo. Escolhido pelo quality gate único, tooling e CI compartilhados. Alternativa: 3 repos separados — descartada pela duplicação de tooling e CI × 3.
2. **Turborepo** vs. `pnpm -r` puro vs. Nx. Escolhido pelo cache incremental (local e no CI) e pelo grafo de dependências entre pacotes. `pnpm -r`: sem cache. Nx: overkill para 3 apps.
3. **Vitest em todos os apps** vs. Jest oficial do NestJS. Escolhido para uma única API cross-app, ESM-first, execução paralela e integração com Testing Library. NestJS + Vitest requer `unplugin-swc` para decorators — factível e amplamente adotado.
4. **Lefthook** vs. Husky. Escolhido pela performance (binário Go), config YAML declarativa, execução paralela nativa. Instalação via `lefthook install` no `postinstall`.
5. **Configs compartilhadas em `packages/*`** vs. root. Escolhido pelo isolamento (cada config é um pacote com seu `package.json`) e uso via `workspace:*`.
6. **ESLint 10 com flat config**. Flat config é o único formato suportado desde a v9; a v10 (atual estável) mantém isso e endurece a checagem.
7. **Sem meta numérica de cobertura**. `PRACTICES.md` orienta explicitamente contra números.

### Riscos conhecidos

1. **NestJS + Vitest** exige plugin (`unplugin-swc`) para decorators. Mitigação: seguir o preset conhecido; validar smoke test cedo (item 4 da ordem).
2. **Cache do Turbo no CI** pode ficar frio no primeiro run. Mitigação: cache do pnpm store e do `.turbo/` no Actions (`actions/cache@v4`).
3. **Meta de 10 min** depende de rede/CPU. Mitigação: `pnpm install` com store em cache; `docker compose up -d` fora do quality gate; pré-requisitos documentados no `README.md`.
4. **Auto-create topics no Kafka** está habilitado no `docker-compose.yml`. Aceitável para dev; Fase 2 pode reavaliar para produção-like.

### Conformidade com o AGENTS.md e as rules

Este projeto **não** possui `AGENTS.md` nem `.agents/rules/`. As regras equivalentes vivem em `CLAUDE.md` (raiz), `.claude/rules/code-standards.md` e `PRACTICES.md`, todas lidas para redigir esta spec.

Restrições relevantes aplicadas:

- Sem `any` em TypeScript (RF3, CA-11) — enforced no lint (`@typescript-eslint/no-explicit-any: error`) e no compilador (`strict: true`, `noImplicitAny: true`).
- Arquivos ≤ 100 linhas, funções ≤ 30 linhas, ≤ 3 parâmetros — os arquivos desta fase são triviais (configs e placeholders); manter os limites é natural.
- Guard clauses, sem linhas em branco em funções, magic numbers/strings extraídos — herdados via ESLint config.
- Segredos apenas em `.env` — respeitado pelo `.env.example` (documentação sem valores reais) e pelo `.gitignore` (já ignora `.env`).
- Conventional Commits — imposto pelo hook `commit-msg` (RF5, CA-05, CA-06).
- Trabalho sai de `develop` via PR — reforçado no PR template e pelo próprio workflow, que só dispara verde para código válido.

### Conformidade com skills

Skills do projeto (`.claude/skills/`) aplicáveis a esta fase:

- **`criar-prd`** — usada para o PRD.
- **`criar-techspec`** — em uso agora.
- **`criar-tasks`** — próxima etapa (decomposição em tarefas).
- **`executar-task`** — para implementar cada tarefa.
- **`executar-review`** — antes do merge do PR.
- **`executar-qa`** — validação final; nesta fase é limitada (não há UI/domínio), foco em CA-01, CA-08, CA-09, CA-12.

Não aplicáveis nesta fase: `vercel-react-best-practices` e `web-design-guidelines` (não há UI real).

### Arquivos relevantes e dependentes

**A criar**

- `pnpm-workspace.yaml`, `package.json` (raiz), `turbo.json`, `lefthook.yml`, `commitlint.config.ts`.
- `apps/transactions/`, `apps/anti-fraud/`, `apps/web/` — cada um com `package.json`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `src/` (Nest) ou `app/` (Next) e um smoke test.
- `packages/eslint-config/`, `packages/prettier-config/`, `packages/tsconfig/`, `packages/vitest-config/` — cada um com `package.json` e arquivos de config exportados.
- `.github/workflows/quality.yml`.
- `DECISIONS.md`, `README.md` (substitui o do desafio).

**A revisar/atualizar**

- `.env.example` — conferir aderência às portas/variáveis.
- `.gitignore` — já cobre `node_modules`, `dist`, `.next`, `.env`, `coverage`, `.turbo`; conferir e ajustar se necessário.
- `.editorconfig`, `.nvmrc` — já ok.
- `.github/pull_request_template.md` — já ok; conferir checklist.
- `docker-compose.yml` — já ok; mantido.
