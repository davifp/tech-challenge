# DECISIONS.md

Decisões estruturantes deste repositório. Formato conforme `PRACTICES.md` → "Registro de decisões": **Decisão / Alternativas consideradas / Por quê**. Uma decisão sem alternativa considerada não é uma decisão.

## 1. Estrutura do projeto: monorepo com pnpm workspaces

**Decisão:** organizar `transactions`, `anti-fraud` e `web` em um único repositório como pacotes `pnpm workspaces`.

**Alternativas consideradas:** três repositórios separados por serviço.

**Por quê:** os três apps compartilham stack, quality gate, hooks e CI. Um repositório único elimina a triplicação de ferramentas e permite um comando (`pnpm quality`) que garante coerência entre eles. Polirepo faria sentido se o repositório fosse muito maior ou se os serviços tivessem ciclos de vida e times independentes, o que não é o caso.

## 2. Orquestração: Turborepo

**Decisão:** usar Turborepo (`turbo run <task>`) sobre os workspaces do pnpm.

**Alternativas consideradas:** Nx.

**Por quê:** Turborepo dá cache local e no CI e entende quem depende de quem entre os pacotes (`packages/*` → `apps/*`) com uma configuração bem direta: um `turbo.json` curto, sem plugin system, sem tentar adivinhar nada. Nx faz o mesmo, e em alguns pontos exige até menos config porque ele lê sozinho as configs das ferramentas pra montar o cache. O problema é que vem com um modelo maior pra aprender (targets, executors, generators, plugins), e isso só compensa quando o monorepo tem muitos pacotes. Turborepo também é o padrão do time do Next/Vercel, então integrar com o app `web` é uma preocupação a menos.

## 3. Testes: Vitest em todos os apps

**Decisão:** Vitest é a única ferramenta de teste dos três apps, com `unplugin-swc` no NestJS para suportar decorators e Testing Library no Next.js.

**Alternativas consideradas:** Jest oficial do NestJS nos backends e Vitest apenas no web.

**Por quê:** ter a mesma ferramenta de teste nos três apps é bem mais confortável que ficar pulando entre Jest no backend e Vitest no frontend. Escolhi Vitest porque roda ESM direto, executa os arquivos de teste em paralelo por padrão e deixa o `packages/vitest-config` compartilhado entre os três. No NestJS, o `unplugin-swc` resolve os decorators sem trabalho extra, então trocar o Jest oficial não custou nada.

## 4. Hooks Git: Lefthook

**Decisão:** Lefthook como runner de hooks (`pre-commit`, `commit-msg`), instalado automaticamente pelo `postinstall`.

**Alternativas consideradas:** Husky.

**Por quê:** quando usei Husky em versões mais antigas, o `git commit` sempre pesava porque cada hook subia um processo Node. A v9 resolveu isso, então performance sozinha não é mais motivo pra escolher um dos dois. O que me fez ficar com Lefthook é a configuração: um único YAML descreve tudo (quais hooks rodam, quais comandos, em que ordem, o que roda em paralelo, quais tipos de arquivo cada comando pega), fácil de ler e comparar no PR. No Husky, cada hook vira um shell script separado dentro de `.husky/` e os detalhes você monta na mão com `lint-staged`. O `postinstall` instala os hooks, sem passo extra depois do `pnpm install`.

## 5. Configs compartilhadas em `packages/*`

**Decisão:** `eslint-config`, `prettier-config`, `tsconfig` e `vitest-config` vivem como pacotes internos consumidos via `workspace:*`.

**Alternativas consideradas:** manter as configs na raiz e cada app estender via caminho relativo.

**Por quê:** cada config tem seu próprio `package.json` (com as dependências que ela usa listadas ali mesmo) e é importada pelo nome do pacote, sem caminho relativo. Acaba com os `../../../` frágeis e segue o padrão dos monorepos NestJS/Next de hoje.
