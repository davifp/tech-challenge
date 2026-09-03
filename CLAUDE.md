# Projeto

Desafio técnico BIUD fullstack: API orientada a eventos para transações financeiras com validação antifraude via Kafka, e um dashboard Next.js para operá-la. Detalhes em `README.md`; práticas obrigatórias em `PRACTICES.md`; padrões de código em `.claude/rules/code-standards.md`.

**Stack obrigatória:** Node.js 22+, pnpm, NestJS + TypeScript, Prisma, PostgreSQL, Kafka, Next.js + React + Tailwind.

**Quality gate:** `pnpm quality` (lint, tipos, formatação, testes, build). Precisa estar verde local e no CI.

# Skills → ações

Invoque as skills via `/<nome-da-skill>` antes de planejar, implementar ou revisar.

| Skill / recurso | Use para… | Não use se… |
| --- | --- | --- |
| `vercel-react-best-practices` | Next.js App Router: RSC, Server Actions, streaming, `next/image`, Suspense, otimização de bundle | Tarefa fora de React/Next.js |
| `web-design-guidelines` | Auditar UI contra guidelines: acessibilidade, semântica, estados de loading/vazio/erro | Tarefa puramente backend/API sem UI |
| **Context7 MCP** | Consultar docs oficiais de qualquer lib (NestJS, Prisma, kafkajs, TanStack Query, Testing Library, Vitest, Next.js, Tailwind, Zod, etc.) — sempre que precisar de sintaxe ou config | Refatoração pura, lógica de negócio, ou conceito genérico de programação |

# Ordem sugerida por tipo de tarefa

- **Backend (NestJS: endpoints, use-cases, Prisma):** **Context7 MCP** (NestJS/Prisma) → aplicar `.claude/rules/code-standards.md` → testes com Context7 (Vitest/Jest).
- **Kafka (produção e consumo de eventos):** **Context7 MCP** (`kafkajs` / `@nestjs/microservices`) → cuidar de idempotência, DLQ e retries → registrar decisão em `DECISIONS.md`.
- **Frontend (Next.js + Tailwind: páginas, listagem, formulário, detalhe):** `vercel-react-best-practices` → **Context7 MCP** (Next.js/Tailwind/TanStack Query) → validar UI no navegador → auditar com `web-design-guidelines`.
- **Testes:** **Context7 MCP** (Vitest/Testing Library/Playwright) — testes de **comportamento**, não de implementação; `getByRole` antes de `data-testid` (ver `PRACTICES.md`).

# Restrições sempre em vigor

- **Sem `any` em TypeScript** — se aparecer, o tipo ainda não foi entendido (`PRACTICES.md`).
- **Sem segredos no código** — usar `.env`, nunca versionar credenciais (`.claude/rules/code-standards.md`).
- **Conventional Commits** validados no hook `commit-msg`. Trabalho sai de `develop`, nunca direto nela; entra por PR usando `.github/pull_request_template.md`.
- **Decisões estruturantes vão para `DECISIONS.md`** na raiz — decisão + alternativas + porquê. Uma decisão sem alternativa considerada não é uma decisão.
- **Antes de sugerir libs ou APIs, verifique no Context7 MCP** — o conhecimento do treinamento pode estar desatualizado.
