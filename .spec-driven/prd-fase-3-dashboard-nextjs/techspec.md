# Especificação técnica

## Resumo

Implementar o [PRD](./prd.md) em `apps/web`, com dashboard responsivo para desktop e mobile, páginas App Router, telas interativas isoladas e TanStack Query para estado remoto. O navegador consome diretamente a API existente; `transactions` continua responsável pelo estado e `anti-fraud` pela decisão.

Bases: enunciado original (`0bb0f17`), [ARCHITECTURE.md](../../ARCHITECTURE.md), [CONTEXT.md](../../CONTEXT.md) e [DECISIONS.md](../../DECISIONS.md). Esta especificação descreve componentes planejados; a arquitetura documentada atualmente descreve o código existente.

## Arquitetura do sistema

### Visão dos componentes

Fluxo: tela → TanStack Query → cliente HTTP → API `transactions`.

| Componente em `apps/web/`                                                                                  | Responsabilidade                                                                                               |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `app/layout.tsx`, `app/providers.tsx`                                                                      | Shell servidor; QueryClient por instância, sem singleton mutável no servidor.                                  |
| `app/page.tsx`                                                                                             | Redirecionar para `/transactions`.                                                                             |
| `app/transactions/{page,loading}.tsx`, `new/page.tsx`, `[transactionExternalId]/page.tsx`                  | Compor listagem, criação e detalhe; resolver parâmetros assíncronos do Next.                                   |
| `app/error.tsx`                                                                                            | Recuperar exceções inesperadas de renderização.                                                                |
| `features/transactions/screens/`, `components/`                                                            | Telas, filtros, formulário, tabela, paginação, status e feedback; receber parâmetros e callbacks de navegação. |
| `features/transactions/{contracts,queries,transactions-api,submission-attempt,presentation,date-range}.ts` | Contratos, consultas, transporte, tentativa de criação e transformações puras.                                 |
| `next.config.mjs`, `postcss.config.mjs`, `app/globals.css`                                                 | Ambiente público do cliente e Tailwind.                                                                        |

Páginas e layout permanecem Server Components; providers e interação usam fronteiras cliente. A listagem envolve o adaptador de URL em [Suspense](https://nextjs.org/docs/app/api-reference/functions/use-search-params#static-rendering). A API é consultada no cliente: build e shell não dependem de sua disponibilidade.

**Responsividade — RF11, CA-15 e CA-16:** adotar [estilos a partir do mobile](https://tailwindcss.com/docs/responsive-design) com CSS/Tailwind, sem detectar largura por JavaScript. Largura mínima suportada de 375px. Layout fluido, limitado e centralizado em telas grandes; conteúdo sem rolagem horizontal da página.

| Tela/componente      | Mobile e tablet                                                                                   | Desktop                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Listagem             | Cartões rotulados com identificador, tipo, valor, status, criação e link para detalhe.            | Tabela semântica a partir de `lg` (64rem).                               |
| Filtros e formulário | Campos e ações empilhados, com largura disponível.                                                | Distribuição em colunas conforme o espaço, preservando ordem de leitura. |
| Detalhe e navegação  | Dados em uma coluna, UUIDs completos com quebra de linha; ações e paginação acomodadas sem corte. | Dados agrupados em colunas e ações próximas ao contexto.                 |

As apresentações compartilham consulta e estado; somente a visível participa da navegação e da árvore acessível. Redimensionar preserva filtros, preenchimento e acompanhamento. Controles devem funcionar por toque e teclado, sem depender de hover; loading, erro e vazio seguem a mesma adaptação.

## Design de implementação

### Principais interfaces

```ts
interface TransactionsApi {
  list(query: ListQuery, signal?: AbortSignal): Promise<TransactionPage>;
  get(id: string, signal?: AbortSignal): Promise<TransactionResponse>;
  create(attempt: SubmissionAttempt): Promise<TransactionResponse>;
}
```

Schemas [Zod](https://zod.dev/api) inferem tipos e validam entradas e respostas. O cliente transforma JSON inválido em erro de contrato. Não importar DTOs NestJS ou contratos Kafka no navegador.

### Modelos de dados

#### `CreateTransactionInput` — corpo HTTP

| Campo                     | Tipo   | Obrigatório | Regra                              |
| ------------------------- | ------ | ----------- | ---------------------------------- |
| `accountExternalIdDebit`  | string | sim         | UUID; normalizado para minúsculas. |
| `accountExternalIdCredit` | string | sim         | UUID distinto do débito.           |
| `transferTypeId`          | number | sim         | `1`.                               |
| `value`                   | number | sim         | Positivo, finito, até duas casas.  |

```json
{
  "accountExternalIdDebit": "0199f9c2-1a2b-7c8d-9e0f-1234567890ab",
  "accountExternalIdCredit": "0299f9c2-1a2b-7c8d-9e0f-1234567890ab",
  "transferTypeId": 1,
  "value": 1000.01
}
```

Formulário controlado com validação no envio e revalidação de campos corrigidos. Valor usa campo textual decimal e prefixo visual `R$`; aceitar `1000,01` e `1.000,01`, validar agrupamento antes da conversão e rejeitar precisão excedente sem arredondamento.

#### `TransactionResponse` — recurso existente

| Campo                                               | Tipo   | Obrigatório | Descrição                                        |
| --------------------------------------------------- | ------ | ----------- | ------------------------------------------------ |
| `transactionExternalId`                             | string | sim         | UUID da transação.                               |
| `transactionType`                                   | objeto | sim         | `name: "transfer"`.                              |
| `transactionStatus`                                 | objeto | sim         | `name: "pending"`, `"approved"` ou `"rejected"`. |
| `value`                                             | number | sim         | Valor original.                                  |
| `createdAt`, `updatedAt`                            | string | sim         | Instantes ISO UTC.                               |
| `accountExternalIdDebit`, `accountExternalIdCredit` | string | sim         | UUIDs das contas.                                |

```json
{
  "transactionExternalId": "0199f9d2-1a2b-7c8d-9e0f-1234567890ab",
  "transactionType": { "name": "transfer" },
  "transactionStatus": { "name": "pending" },
  "value": 1000.01,
  "createdAt": "2026-09-06T03:00:00.000Z",
  "updatedAt": "2026-09-06T03:00:00.000Z",
  "accountExternalIdDebit": "0199f9c2-1a2b-7c8d-9e0f-1234567890ab",
  "accountExternalIdCredit": "0299f9c2-1a2b-7c8d-9e0f-1234567890ab"
}
```

> Campos obrigatórios ausentes ou enums desconhecidos invalidam a resposta; o contrato atual não prevê substituição por `null` nem degradação parcial.

#### `TransactionPage` — paginação

| Campo                    | Tipo                  | Obrigatório | Descrição                         |
| ------------------------ | --------------------- | ----------- | --------------------------------- |
| `items`                  | TransactionResponse[] | sim         | Registros da página.              |
| `page`, `limit`, `total` | number                | sim         | Página, tamanho e total filtrado. |

```json
{ "items": [], "page": 1, "limit": 20, "total": 0 }
```

#### `ListQuery` — consulta normalizada

| Campo                          | Tipo   | Obrigatório | Descrição                 |
| ------------------------------ | ------ | ----------- | ------------------------- |
| `status`                       | string | não         | Enum do recurso.          |
| `transferTypeId`               | number | não         | `1`.                      |
| `createdAtFrom`, `createdAtTo` | string | não         | Instantes UTC inclusivos. |
| `page`, `limit`                | number | sim         | Página ≥1; tamanho 20.    |

```json
{
  "status": "pending",
  "page": 1,
  "limit": 20,
  "createdAtFrom": "2026-09-06T03:00:00.000Z",
  "createdAtTo": "2026-09-07T02:59:59.999Z"
}
```

URL da tela: `status`, `transferTypeId`, `from`, `to`, `page`; datas civis `YYYY-MM-DD`. Aplicar/limpar filtros reinicia página. Detalhe transporta `returnTo`, aceitando somente `/transactions` com parâmetros permitidos; acesso direto retorna à listagem inicial.

#### `SubmissionAttempt` — recuperação por aba

| Campo   | Tipo                   | Obrigatório | Descrição                        |
| ------- | ---------------------- | ----------- | -------------------------------- |
| `key`   | string                 | sim         | UUID gerado antes do POST.       |
| `body`  | CreateTransactionInput | sim         | Fotografia normalizada do envio. |
| `state` | string                 | sim         | `sending` ou `uncertain`.        |

```json
{
  "key": "0399f9c2-1a2b-4c8d-9e0f-1234567890ab",
  "body": {
    "accountExternalIdDebit": "0199f9c2-1a2b-7c8d-9e0f-1234567890ab",
    "accountExternalIdCredit": "0299f9c2-1a2b-7c8d-9e0f-1234567890ab",
    "transferTypeId": 1,
    "value": 1000.01
  },
  "state": "uncertain"
}
```

#### `ApiError` — envelope existente

| Campo                         | Tipo                             | Obrigatório | Descrição                 |
| ----------------------------- | -------------------------------- | ----------- | ------------------------- |
| `error.code`, `error.message` | string                           | sim         | Código e mensagem da API. |
| `error.details`               | `{path:string,message:string}[]` | não         | Erros de campo.           |

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request payload",
    "details": [{ "path": "value", "message": "must have up to two decimals" }]
  }
}
```

| Código                                                               | HTTP | Tratamento                              |
| -------------------------------------------------------------------- | ---- | --------------------------------------- |
| `VALIDATION_ERROR`, `TRANSFER_TYPE_NOT_FOUND`, `INVALID_TRANSACTION` | 400  | Campos e orientação em português.       |
| `TRANSACTION_NOT_FOUND`                                              | 404  | Estado não encontrado.                  |
| `IDEMPOTENCY_KEY_CONFLICT`                                           | 422  | Não repetir automaticamente.            |
| `INTERNAL_ERROR`                                                     | 500  | Falha recuperável, sem detalhe interno. |

**Variante local:** rede, timeout, resposta não JSON ou incompatível tornam-se erros tipados `NETWORK_ERROR`, `TIMEOUT`, `INVALID_RESPONSE`; não inventar envelope recebido. Traduzir por código/path, com fallback geral para códigos ou campos desconhecidos.

#### Mapeamento API → apresentação

| Origem                                        | Destino                                                                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `pending`, `approved`, `rejected`, `transfer` | Pendente, Aprovada, Rejeitada, Transferência.                                                                                              |
| `value`                                       | `Intl.NumberFormat`, `pt-BR`, `BRL`.                                                                                                       |
| Instantes ISO                                 | `Intl.DateTimeFormat`, `America/Sao_Paulo`; “Horário de Brasília”.                                                                         |
| Datas civis                                   | `TZDate` de [@date-fns/tz](https://github.com/date-fns/tz#tzdate); início do dia e início do dia seguinte menos 1 ms, serializados em UTC. |

#### Parâmetros fixos

| Parâmetro                       | Valor                |
| ------------------------------- | -------------------- |
| `PAGE_SIZE`, `POLL_INTERVAL_MS` | 20; 3000.            |
| `REQUEST_TIMEOUT_MS`            | 10000.               |
| `BUSINESS_TIME_ZONE`            | `America/Sao_Paulo`. |

### Endpoints da API (se aplicável)

#### Visão geral

| Método | Rota Nest                              | Descrição       |
| ------ | -------------------------------------- | --------------- |
| GET    | `/transactions`                        | Listagem.       |
| GET    | `/transactions/:transactionExternalId` | Detalhe.        |
| POST   | `/transactions`                        | Criação/replay. |

---

#### `GET /transactions`

| Parâmetros  | Padrão              | Regras                                          |
| ----------- | ------------------- | ----------------------------------------------- |
| `ListQuery` | página 1; limite 20 | AND; datas inclusivas; API aceita limite 1–100. |

| Status    | Corpo           | Quando                             |
| --------- | --------------- | ---------------------------------- |
| 200       | TransactionPage | Com registros ou vazio.            |
| 400 / 500 | ApiError        | Consulta inválida / falha interna. |

Sucesso: `/transactions?page=1&limit=20`; `items` contém recursos do exemplo `TransactionResponse`. Sem correspondência: exemplo vazio de `TransactionPage`. Erro: `page=0` produz `VALIDATION_ERROR`.

> Ordem existente: `createdAt DESC, transactionExternalId DESC`. Página além do total retorna vazia; ajustar para `max(1, ceil(total/20))` e consultar novamente.

---

#### `GET /transactions/:transactionExternalId`

| Parâmetro               | Tipo   | Padrão | Regra             |
| ----------------------- | ------ | ------ | ----------------- |
| `transactionExternalId` | string | —      | UUID obrigatório. |

| Status          | Corpo               | Quando                               |
| --------------- | ------------------- | ------------------------------------ |
| 200             | TransactionResponse | Existente.                           |
| 400 / 404 / 500 | ApiError            | UUID inválido / inexistente / falha. |

Sucesso: `/transactions/0199f9d2-1a2b-7c8d-9e0f-1234567890ab`, recurso exemplificado acima. Ausência produz `TRANSACTION_NOT_FOUND`; caminho `/transactions/invalido` produz `VALIDATION_ERROR`.

---

#### `POST /transactions`

| Parâmetro         | Tipo                   | Padrão | Regra                                               |
| ----------------- | ---------------------- | ------ | --------------------------------------------------- |
| Corpo             | CreateTransactionInput | —      | Exemplo acima; JSON estrito.                        |
| `Idempotency-Key` | header string          | —      | Obrigatório no cliente; API aceita 1–64 caracteres. |

| Status          | Corpo               | Quando                                |
| --------------- | ------------------- | ------------------------------------- |
| 201             | TransactionResponse | Nova; `pending`, com `Location`.      |
| 200             | TransactionResponse | Replay; estado atual, sem `Location`. |
| 400 / 422 / 500 | ApiError            | Validação / conflito / falha.         |

Sucesso: enviar `CreateTransactionInput` a `/transactions` na origem configurada. Repetição com a mesma chave/corpo retorna o mesmo UUID; trocar corpo gera `IDEMPOTENCY_KEY_CONFLICT`.

> Tanto 200 quanto 201 confirmam criação. Navegar pelo UUID do corpo, sem forçar pendência sobre replay terminal. Falha de transporte não prova que a criação falhou.

## Pontos de integração

O cliente usa `NEXT_PUBLIC_API_URL` para chamar diretamente `/transactions` e `/transactions/:transactionExternalId`, preservando consulta, método, corpo, status e chave. Sem autenticação nesta fase.

Manter a variável pública existente `NEXT_PUBLIC_API_URL`. `next.config.mjs` carrega `.env` da raiz com `dotenv`, preserva variáveis do processo e valida origem HTTP(S), sem credenciais. Configuração ausente falha explicitamente. Registrar a variável no CI e no hash/inputs do build em `apps/web/turbo.json`; mudar o destino exige reconstruir. O backend aceita por CORS somente `DASHBOARD_ORIGIN`, com padrão local `http://localhost:3000`. `fetch` usa `no-store`, timeout, cancelamento e `credentials: omit`.

[Query v5](https://github.com/tanstack/query/blob/main/docs/framework/react/reference/useQuery.md): chaves `['transactions','list',query]` e `['transactions','detail',id]`; `staleTime:0`, retries automáticos desativados. Polling enquanto os últimos dados contiverem pendentes, inclusive após erro; pausar em aba oculta, reconsultar ao montar, focar ou reconectar. Sem dados, oferecer tentativa manual. Dados existentes prevalecem sobre a tela de erro durante falhas de atualização.

Propagar AbortSignal e reconciliar respostas por UUID/`updatedAt`, preservando decisões terminais conhecidas. Invalidar listas afetadas após criação/decisão, reconsultando totais em vez de removê-los artificialmente. Validar a meta de 5 segundos também com consulta já em andamento; orçamento saudável de até 1 segundo por consulta/apresentação.

Antes do envio, guardar tentativa em `sessionStorage`; travar submissões concorrentes. Timeout/5xx preserva corpo/chave para replay manual; retomada restaura tentativa incerta. Confirmação limpa o armazenamento e alimenta o cache do detalhe. Correção após 400 inicia outra tentativa; resultado incerto exige recuperar a tentativa ou escolher explicitamente uma nova. Storage indisponível mantém tentativa em memória, sem recuperação após recarga.

## Abordagem de testes

Reutilizar Vitest/jsdom e Testing Library; adicionar [user-event](https://testing-library.com/docs/user-event/intro/). Testar componentes, schemas e cliente reais; substituir somente transporte HTTP externo. QueryClient isolado por teste; relógio controlado com avanço explícito e limpeza. Priorizar `getByRole`/`findByRole`. Rotas assíncronas são verificadas no navegador, conforme a [limitação do Vitest](https://nextjs.org/docs/app/guides/testing/vitest).

### Testes de unidade (se aplicável)

| ID    | Caso                       | Critérios           | Resultado                                                                                            |
| ----- | -------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------- |
| TU-01 | Entrada monetária e contas | CA-07, CA-14        | Normalização sem arredondamento; entradas inválidas rejeitadas.                                      |
| TU-02 | Dias de Brasília           | CA-02, CA-14        | Limites inclusivos, inclusive transição histórica de horário de verão; independência do dispositivo. |
| TU-03 | Respostas antigas          | CA-11, CA-13        | Sem regressão terminal.                                                                              |
| TU-04 | URL e mensagens            | CA-03, CA-06, CA-10 | Contexto válido e fallback português.                                                                |

### Testes de integração (se aplicável)

| ID    | Caso                             | Critérios           | Resultado                                                    |
| ----- | -------------------------------- | ------------------- | ------------------------------------------------------------ |
| TI-01 | Lista com 21 registros e filtros | CA-01, CA-02, CA-03 | Paginação e consultas corretas.                              |
| TI-02 | Estados da lista                 | CA-04               | Loading, erro, vazios e recuperação distintos.               |
| TI-03 | Detalhe                          | CA-05, CA-06        | Dados, loading, UUID inválido, 404 e erro.                   |
| TI-04 | Formulário                       | CA-07, CA-08, CA-10 | Campos inválidos, sucesso e erros preservando preenchimento. |
| TI-05 | Envio incerto                    | CA-09, CA-10        | Clique duplo, timeout, remontagem, replay terminal e 422.    |
| TI-06 | Acompanhamento                   | CA-11, CA-12, CA-13 | Prazo, foco, retomada, falha, página removida e recuperação. |
| TI-07 | Semântica e apresentação         | CA-14, CA-15        | Rótulos, foco, alertas, moeda e datas.                       |

### Testes E2E (se aplicável)

| ID     | Caso                                       | Critérios                  | Resultado                                                                                                        |
| ------ | ------------------------------------------ | -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| E2E-01 | Ciclo real no navegador                    | CA-08, CA-09, CA-11, CA-17 | 1000 aprova; 1000,01 rejeita; replay mantém UUID na chamada direta à API.                                        |
| E2E-02 | Navegação, acessibilidade e responsividade | CA-03, CA-15, CA-16, CA-17 | Listagem, detalhe e formulário utilizáveis em 375, 768 e 1280px, com toque, teclado, leitor de tela e zoom 200%. |
| E2E-03 | Entrega reproduzível                       | CA-17, CA-18               | Gate local/CI verde e decisões registradas.                                                                      |

E2E são roteiros obrigatórios com evidências; automação é opcional. Usar backend/antifraude, PostgreSQL e Kafka reais com dados sintéticos isolados. Guardar capturas e tempos; falhas induzidas no navegador complementam os cenários automatizados. Sem meta percentual de cobertura.

No E2E-02, registrar capturas de cada tela em mobile e desktop; conferir também larguras intermediárias, mudança de orientação, UUIDs longos e estados de loading/erro/vazio. Reprovar cortes, sobreposições ou rolagem horizontal da página que impeçam os fluxos. Validar layout no navegador; jsdom cobre comportamento e semântica.

## Sequenciamento do desenvolvimento

### Ordem de construção

1. Configuração, Tailwind, contratos e transporte.
2. Transformações, QueryClient e listagem/detalhe.
3. Formulário, idempotência e acompanhamento.
4. Testes, navegador, acessibilidade e documentação.

### Dependências técnicas

Manter Next 16/React 19 existentes. Adicionar Query 5, Zod 4, `@date-fns/tz`, `dotenv`, user-event e [Tailwind 4/PostCSS](https://tailwindcss.com/docs/installation/framework-guides/nextjs), com versões resolvidas no lockfile. A infraestrutura das fases anteriores é necessária para E2E; as flags de consumo e outbox precisam estar habilitadas nesse ambiente.

## Monitoramento e observabilidade

No cliente, registrar operação, duração, status/código e UUID quando disponível: `warn` para falha, `info` para recuperação, sem repetir logs a cada polling. Não registrar contas, valor, corpo ou chave. Correlacionar pelo UUID com os logs existentes do backend; sem nova plataforma ou endpoint de métricas.

## Considerações técnicas

### Principais decisões

Registradas como planejadas em `DECISIONS.md`: frontend por funcionalidade, Query/polling, consumo direto da API, validação e recuperação por aba. Polling mantém a API atual; SSE/WebSocket exigiriam novos contratos. Query evita recriar cache/invalidação manualmente; formulário controlado com Zod atende quatro campos sem biblioteca adicional de formulário.

### Riscos conhecidos

Contrato numérico limita precisão em valores grandes; rejeitar conversões que alterem a representação decimal. Offset e total podem variar entre consultas concorrentes: reconsultar e corrigir página. Storage restrito limita retomada após recarga; abas distintas não compartilham tentativa. Não fixar deslocamento UTC−3 nem somar 24 horas para calcular dias históricos.

### Conformidade com o AGENTS.md e as rules

Lidos `AGENTS.md` → `CLAUDE.md`, `PRACTICES.md` e todas as rules de `.agents/rules/` → `.claude/rules/` (somente `code-standards.md`). Aplicar tipos estritos, constantes nomeadas, guard clauses e funções coesas; limiares de linhas motivam revisão, não fragmentação automática. Conventional Commits, branch de trabalho e PR para `develop` permanecem obrigatórios.

### Conformidade com skills

`criar-techspec`: template, exploração e rastreabilidade. `vercel-react-best-practices`: fronteiras cliente pequenas, Suspense, imports diretos e cache isolado. `domain-modeling`: vocabulário existente e decisões no formato obrigatório do projeto. `web-design-guidelines` será aplicada à UI implementada. Usar `.spec-driven/` acompanha os artefatos existentes, substituindo o diretório genérico `tasks/` das skills.

### Arquivos relevantes e dependentes

Além dos componentes listados: `apps/web/package.json`, `vitest.config.ts`, `app/page.test.tsx`, `test/`, `.env.example`, `.github/workflows/quality.yml`, `pnpm-lock.yaml`, `DECISIONS.md`, `README.md` e `ARCHITECTURE.md`. Referências de contrato: `apps/transactions/src/infrastructure/http/{dtos,filters,mappers,transactions.controller.ts}` e testes HTTP existentes. Atualizar a arquitetura descritiva após implementar os componentes.
