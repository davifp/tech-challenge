# Documento de Requisitos do Produto (PRD)

**Funcionalidade:** Fase 0 — Fundação (monorepo, TypeScript, quality gate, CI, docker-compose)
**Referências:** `README.md` (seções "Fundação do projeto", "O que já vem no repositório", "Stack", "Subindo a infraestrutura"), `PRACTICES.md` (seções "Quality gate", "Integração contínua", "Commits", "Branches"), `.claude/rules/code-standards.md`.

## Visão geral

O produto é o desafio técnico BIUD Fullstack: uma API orientada a eventos para transações financeiras com validação antifraude via Kafka e um dashboard Next.js para operá-la. Antes de qualquer código de domínio, o repositório precisa de uma fundação técnica que sustente as fases seguintes sem retrabalho.

Esta fase entrega essa fundação: estrutura de código, tooling homogênea, quality gate único e integração contínua verdes. Quem clonar o repositório em qualquer momento das fases 1 a 3 encontra um ambiente reprodutível, com práticas obrigatórias já automatizadas (Conventional Commits, lint/format em pre-commit, TypeScript estrito, CI verde em `develop`), e consegue começar a trabalhar em minutos. Sem essa fundação, as práticas descritas em `PRACTICES.md` viveriam como intenção, não como garantia.

## Objetivos

- **Estrutura de código pronta:** monorepo com três apps preparados para receber o desenvolvimento — `transactions` (API), `anti-fraud` (microserviço) e `web` (dashboard) — cada um executável e testável isoladamente.
- **Quality gate único e reprodutível:** um comando `pnpm quality` cobre lint, checagem de tipos, formatação, testes e build; cada etapa também roda isolada. Verde localmente e no CI.
- **CI verde em `develop`:** GitHub Actions executa o mesmo quality gate a cada push e pull request para `develop`, com status verde na branch principal do desafio.
- **Práticas obrigatórias automatizadas:** commits fora de Conventional Commits são bloqueados; lint e formatação rodam em pre-commit apenas sobre arquivos alterados.
- **Setup ≤ 10 minutos:** um novo desenvolvedor clona o repo e vê `pnpm quality` verde em até 10 minutos, incluindo `pnpm install`, `docker compose up -d` e execução do quality gate.
- **Decisão de estrutura registrada:** `DECISIONS.md` documenta a escolha de monorepo com `pnpm workspaces`, as alternativas consideradas e o porquê.

Métrica principal: tempo de setup end-to-end ≤ 10 minutos. Métrica secundária: 0 execuções de `pnpm quality` vermelhas em `develop` após esta fase.

## Histórias de usuário

- **US1:** Como desenvolvedor recém-chegado ao projeto, quero clonar o repositório e ver `pnpm quality` verde em até 10 minutos para começar a trabalhar sem depender de tribal knowledge.
- **US2:** Como desenvolvedor, quero rodar cada app (`transactions`, `anti-fraud`, `web`) de forma isolada para acelerar o ciclo curto durante o desenvolvimento de uma fase.
- **US3:** Como desenvolvedor, quero que commits fora do padrão Conventional Commits sejam bloqueados no meu próprio ambiente para não sujar o histórico do repositório.
- **US4:** Como desenvolvedor, quero que lint e formatação rodem em pre-commit apenas sobre arquivos alterados para não pagar o custo da árvore inteira a cada commit.
- **US5:** Como avaliador ou mantenedor, quero abrir um pull request para `develop` e ver o CI executando o mesmo quality gate que roda localmente, terminando verde, para confiar que o código atende às práticas.
- **US6:** Como avaliador, quero encontrar em `DECISIONS.md` a decisão sobre estrutura do projeto para entender por que a organização foi feita como está.
- **US7:** Como desenvolvedor, quero subir Postgres, Kafka e Kafka UI com `docker compose up -d` para ter a infraestrutura local pronta antes das fases seguintes.

## Principais funcionalidades

1. **Estrutura de monorepo com pnpm workspaces.** Uma única árvore de código organiza os três apps do desafio como pacotes independentes, permitindo execução, teste e build isolados por app e também de forma agregada. Escolha registrada em `DECISIONS.md`.
   - **RF1:** O repositório organiza `transactions`, `anti-fraud` e `web` como pacotes `pnpm workspaces`, com `package.json` próprio por app e um `package.json` raiz coordenando scripts.

2. **Runtime e gerenciador padronizados.** Todos os apps rodam no mesmo Node e usam o mesmo gerenciador de pacotes, eliminando divergências entre máquinas.
   - **RF2:** Node.js 22+ alinhado ao `.nvmrc`; `pnpm` como único gerenciador de dependências.

3. **TypeScript estrito.** Todo código-fonte é TypeScript com modo estrito habilitado; `any` é tratado como violação e não passa no quality gate.
   - **RF3:** Configuração de TypeScript com modo estrito aplicada a todos os apps e pacotes; `any` é rejeitado pelo lint ou pelo compilador.

4. **Lint e formatação compartilhados, em pre-commit incremental.** ESLint e Prettier compartilhados entre apps, executados no pre-commit apenas sobre arquivos alterados.
   - **RF4:** ESLint e Prettier configurados de forma compartilhada; hook de pre-commit executa lint e formatação exclusivamente sobre arquivos alterados no stage.

5. **Validação de commit.** Mensagens fora do padrão Conventional Commits são bloqueadas antes de entrar no histórico.
   - **RF5:** Hook `commit-msg` valida a mensagem contra Conventional Commits e bloqueia commits fora do padrão.

6. **Quality gate único, com etapas executáveis isoladamente.** Um comando roda todo o pipeline de qualidade; cada etapa também tem seu próprio comando para o ciclo curto do dia a dia.
   - **RF6:** `pnpm quality` executa lint, checagem de tipos, formatação, testes e build; cada etapa é também executável isoladamente por comando próprio (ex.: `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm test`, `pnpm build`).
   - **RF7:** Cada app expõe seu próprio quality gate isolado, executável via `pnpm --filter <app> quality` e etapas isoladas equivalentes.

7. **Testes de smoke por app.** A etapa de testes do quality gate só é verdadeira se algo executar; cada app tem pelo menos um teste real para garantir que o pipeline de testes está conectado.
   - **RF8:** Cada app (`transactions`, `anti-fraud`, `web`) contém pelo menos um teste executável, sem regras de domínio, apenas para provar que o pipeline de testes está funcionando.

8. **Integração contínua.** GitHub Actions executa o mesmo quality gate a cada push e pull request para `develop`.
   - **RF9:** Workflow do GitHub Actions dispara em push e pull request para `develop`, executa `pnpm quality` e mantém o status verde na branch principal.

9. **Infraestrutura local reprodutível.** Postgres, Kafka e Kafka UI sobem com um único comando, usando a configuração já versionada.
   - **RF10:** `docker compose up -d` sobe Postgres em `localhost:5432`, Kafka em `localhost:9092` e Kafka UI em `http://localhost:8080`, sem intervenção manual adicional.
   - **RF11:** `.env.example` documenta cada variável de ambiente necessária para apps e infraestrutura, sem valores sensíveis.

10. **Registro de decisões estruturantes.** Decisões que moldam o projeto (a começar pela estrutura do repositório) vivem em um único arquivo, no formato exigido pelo `PRACTICES.md`.
    - **RF12:** `DECISIONS.md` na raiz registra a decisão sobre a estrutura do projeto no formato "Decisão / Alternativas consideradas / Por quê".

11. **Convenções de fluxo de trabalho conferidas.** Arquivos de convenção herdados do repositório inicial são revisados e o template de PR é obrigatório.
    - **RF13:** `.editorconfig`, `.gitignore`, `.nvmrc` e `.github/pull_request_template.md` são conferidos e alinhados à stack; `.env.example` é atualizado sempre que uma nova variável é introduzida.

## Critérios de aceitação

- **CA-01 (US1, RF6, RF10):** Dado um ambiente limpo com Node 22+, `pnpm` e Docker instalados, quando o desenvolvedor executa `pnpm install`, `cp .env.example .env`, `docker compose up -d` e `pnpm quality`, então o quality gate termina verde em até 10 minutos.
- **CA-02 (RF6):** Dado o repositório instalado, quando o desenvolvedor executa cada etapa do quality gate isoladamente (`pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm test`, `pnpm build`), então cada uma passa com sucesso.
- **CA-03 (US2, RF7):** Dado o monorepo instalado, quando o desenvolvedor executa `pnpm --filter <app> quality` para qualquer um dos três apps, então apenas aquele app tem seu ciclo executado e passa com sucesso.
- **CA-04 (US2, RF1):** Dado o monorepo instalado, quando o desenvolvedor executa `pnpm --filter <app> dev` para qualquer um dos três apps, então apenas aquele app inicializa e responde na porta prevista.
- **CA-05 (US3, RF5):** Dado um commit com mensagem fora do padrão Conventional Commits, quando `git commit` é executado, então o hook `commit-msg` bloqueia o commit e sinaliza a violação.
- **CA-06 (RF5):** Dado um commit com mensagem no padrão Conventional Commits, quando `git commit` é executado, então o hook aceita a mensagem.
- **CA-07 (US4, RF4):** Dado arquivos alterados no stage, quando `git commit` é executado, então lint e formatação rodam apenas sobre esses arquivos e o commit é interrompido quando há violação não corrigível automaticamente.
- **CA-08 (US5, RF9):** Dado um pull request aberto para `develop`, quando o GitHub Actions executa o workflow, então `pnpm quality` roda por completo e fica verde ao final na visualização do PR.
- **CA-09 (RF9):** Dado um push ou PR para `develop` com falha em qualquer etapa do quality gate, quando o workflow executa, então o job termina em falha e o status do PR fica vermelho.
- **CA-10 (RF8):** Dado o quality gate executando a etapa de testes, quando `pnpm test` roda em cada app, então há ao menos um caso de teste executado por app e a etapa falha se qualquer um deles quebrar.
- **CA-11 (RF3):** Dado o código-fonte de qualquer app ou pacote, quando `pnpm typecheck` é executado, então nenhum uso de `any` é aceito e a etapa termina sem erros.
- **CA-12 (US7, RF10):** Dado o `docker compose up -d` executado, quando os containers sobem, então Postgres responde em `localhost:5432`, Kafka em `localhost:9092` e Kafka UI em `http://localhost:8080`.
- **CA-13 (RF11):** Dado uma nova variável de ambiente introduzida em qualquer app, quando o commit é aberto, então `.env.example` é atualizado com a chave sem valor sensível.
- **CA-14 (US6, RF12):** Dado `DECISIONS.md` na raiz, quando o leitor abre o arquivo, então encontra a decisão sobre a estrutura do projeto no formato "Decisão / Alternativas consideradas / Por quê".
- **CA-15 (RF13):** Dado o `.github/pull_request_template.md`, quando um pull request é aberto para `develop`, então o template é carregado automaticamente e inclui o checklist previsto.
- **CA-16 (RF2):** Dado o `.nvmrc` versionado, quando o desenvolvedor executa `nvm use` na raiz do repositório, então a versão Node 22+ é selecionada.

## Experiência do usuário

**Personas.** O único usuário desta fase é o **desenvolvedor** do projeto — o autor do desafio ou qualquer avaliador que clone o repositório. Não há usuário final: esta fase é infraestrutura de desenvolvimento.

**Fluxo de setup inicial (US1, US7).** Clone → `nvm use` → `pnpm install` → `cp .env.example .env` → `docker compose up -d` → `pnpm quality`. Em até 10 minutos, quality gate verde e infraestrutura local rodando. Passo-a-passo documentado no `README.md`.

**Fluxo do ciclo diário (US2, US3, US4, US5).** Branch a partir de `develop`, alteração, commit (pre-commit roda lint/format sobre arquivos alterados; `commit-msg` valida Conventional Commits), `pnpm quality` local, push e pull request para `develop` usando o template. CI executa o mesmo quality gate; PR só é mesclado com verde. Para trabalho focado, `pnpm --filter <app>` para dev/teste/quality gate isolados.

**UI/UX.** Experiência inteiramente de linha de comando e ferramentas de repositório (hooks, templates, CI). Critérios: mensagens de erro claras nos hooks e no CI, comandos consistentes entre apps, nomes explícitos nos scripts. Acessibilidade em interfaces gráficas não se aplica aqui — será exigida a partir da Fase 3.

## Restrições técnicas de alto nível

- **Stack obrigatória:** Node.js 22+, pnpm, NestJS + TypeScript, Prisma, PostgreSQL, Kafka, Next.js + React + Tailwind. A fundação prepara o terreno para todos, mesmo os que só serão exercitados nas fases seguintes.
- **Estrutura como premissa:** monorepo com `pnpm workspaces`; decisão registrada em `DECISIONS.md` com alternativa (repositórios separados) e justificativa.
- **Segurança:** nenhum segredo no repositório. `.env.example` é a única fonte documental de variáveis; `.env` real fica ignorado.
- **Fluxo de trabalho:** trabalho sai de `develop` via pull request; commits diretos em `develop` não são aceitos; Conventional Commits obrigatórios no `commit-msg`.
- **CI:** GitHub Actions rodando `pnpm quality` em push e PR para `develop`, verde ao final da fase.
- **Ambiente local:** `docker compose up -d` sobe Postgres, Kafka e Kafka UI conforme o `docker-compose.yml` versionado.
- **Regras de código (`.claude/rules/code-standards.md`):** sem `any`, arquivos ≤ 100 linhas, funções ≤ 30 linhas, ≤ 3 parâmetros, cláusulas de guarda, sem linhas em branco dentro de funções, magic numbers/strings extraídos.
- **Meta de desempenho:** setup end-to-end (clone → `pnpm quality` verde) em até 10 minutos em máquina de desenvolvimento típica com Docker já configurado.

## Fora do escopo

- **Prisma schema, migrations e persistência** — Fase 1.
- **Publicação e consumo de eventos Kafka e regra antifraude** — Fase 2.
- **Frontend real** (páginas, componentes, telas, estados de loading/erro/vazio) — Fase 3. Esta fase entrega apenas o esqueleto do app `web` com teste de smoke.
- **Endpoints de domínio** (criação, consulta, listagem de transações) — Fase 1.
- **Testes de regra de negócio e testes E2E** — fases 1 a 3. Esta fase entrega apenas o pipeline de testes conectado.
- **Autenticação, autorização e RBAC** — não previstos no desafio.
- **Observabilidade** (logs estruturados, métricas, tracing) — não previstos nesta fase.
- **Publicação, deploy e ambientes remotos** — não previstos no desafio.
- **Configuração adicional de banco/schemas Kafka além do `docker-compose.yml`** — fases seguintes definem suas necessidades.
