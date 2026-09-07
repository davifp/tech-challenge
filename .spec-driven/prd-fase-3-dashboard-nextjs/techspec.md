# Especificação técnica

## Resumo

Implementar o [PRD](./prd.md) em `apps/web`: dashboard responsivo com App Router, TanStack Query para estado remoto e polling de pendentes. O navegador consome diretamente a API existente; `transactions` mantém estado e `anti-fraud` decide. Bases: [ARCHITECTURE.md](../../ARCHITECTURE.md), [CONTEXT.md](../../CONTEXT.md), [DECISIONS.md](../../DECISIONS.md) e os HTMLs em [`refs/`](./refs/).

## Arquitetura do sistema

### Visão dos componentes

Fluxo: tela → TanStack Query → cliente HTTP → API `transactions`.

| Componente em `apps/web/src/`                                                                 | Responsabilidade                                                                     |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `app/layout.tsx`                                                                              | Root Layout servidor; composição dos elementos compartilhados.                       |
| `components/shared/{dashboard-shell,providers}.tsx`                                           | Shell global e QueryClient por instância, sem singleton mutável no servidor.         |
| `app/page.tsx`                                                                                | Redirecionar para `/transactions`.                                                   |
| `app/transactions/{page,loading}.tsx`, `new/page.tsx`, `[transactionExternalId]/page.tsx`     | Compor listagem, criação e detalhe; resolver parâmetros assíncronos do Next.         |
| `app/error.tsx`                                                                               | Recuperar exceções inesperadas de renderização.                                      |
| `features/transactions/api/client.ts`                                                         | Único cliente HTTP: endpoints, timeout, cancelamento, validação Zod e erros tipados. |
| `features/transactions/{list,detail,create}/`                                                 | Fatias das três telas, cada uma com view e componentes específicos.                  |
| `features/transactions/components/`, `{contracts,queries,submission-attempt,presentation}.ts` | Código realmente compartilhado entre duas ou mais telas.                             |

Páginas e layout são Server Components; providers e interação usam fronteiras cliente. A listagem envolve o adaptador de URL em Suspense. A API é consultada no cliente: build e shell não dependem de sua disponibilidade.

**Responsividade (RF11, CA-15, CA-16):** mobile-first com Tailwind; sem detecção de largura por JavaScript. Largura mínima 375px; layout fluido centralizado em telas grandes; sem rolagem horizontal.

### Sistema de design

Tokens extraídos dos [`refs/`](./refs/) HTML e materializados em `src/styles/globals.css` via `@theme` do Tailwind 4. Os HTMLs de referência são a única fonte de verdade visual: paleta, tipografia, raios, densidade e composição de cada tela vêm deles.

Componentes nomeados: `dashboard-shell`, `transactions-header`, `transactions-filters`, `transactions-list`, `status-badge`, `copy-identifier-button`, `pagination-bar`, `empty-state`, `error-state`, `loading-skeleton`. Ícones SVG locais em `src/components/shared/icons.tsx`; sem font-icons nem Google Fonts.

Divergências obrigatórias em relação aos HTMLs: busca por hash/ID, cartões de resumo agregado, seleção por faixa de valor e tipos como PIX/TED são conteúdo fictício e não fazem parte do domínio. O dashboard implementa somente o que está no PRD.

## Design de implementação

### Principais interfaces

```ts
interface TransactionsApi {
  list(query: ListQuery, signal?: AbortSignal): Promise<TransactionPage>;
  get(id: string, signal?: AbortSignal): Promise<TransactionResponse>;
  create(attempt: SubmissionAttempt): Promise<TransactionResponse>;
}
```

Schemas Zod inferem tipos e validam entradas e respostas. Não importar DTOs NestJS ou contratos Kafka no navegador.

### Modelos de dados

#### `CreateTransactionInput` — corpo HTTP

| Campo                     | Tipo   | Regra                              |
| ------------------------- | ------ | ---------------------------------- |
| `accountExternalIdDebit`  | string | UUID; normalizado para minúsculas. |
| `accountExternalIdCredit` | string | UUID distinto do débito.           |
| `transferTypeId`          | number | `1`.                               |
| `value`                   | number | Positivo, finito, até duas casas.  |

Formulário gerenciado por React Hook Form com `zodResolver`. Valor textual no formulário com prefixo visual `R$`; aceitar `1000,01` e `1.000,01`, rejeitar precisão excedente sem arredondamento. Validar no envio e revalidar campos corrigidos; mapear erros de campo da API com `setError`, preservando preenchimento.

#### `TransactionResponse` — recurso existente

Campos: `transactionExternalId`, `transactionType.name`, `transactionStatus.name` (`pending`/`approved`/`rejected`), `value`, `createdAt`, `updatedAt`, `accountExternalIdDebit`, `accountExternalIdCredit`. Campos obrigatórios ausentes ou enums desconhecidos invalidam a resposta.

#### `TransactionPage` — paginação

Campos: `items: TransactionResponse[]`, `page`, `limit`, `total`. Página além do total retorna vazia; ajustar para `max(1, ceil(total/20))` e consultar novamente.

#### `ListQuery` — consulta normalizada

Campos: `status?`, `transferTypeId?`, `createdAtFrom?`, `createdAtTo?`, `page` (≥1), `limit` (20). URL da tela usa `status`, `from`, `to`, `page`; datas civis `YYYY-MM-DD`. Alterar filtros reinicia página.

#### `SubmissionAttempt` — recuperação por aba

Campos: `key` (UUID gerado antes do POST), `body: CreateTransactionInput`, `state` (`sending`/`uncertain`). Guardar no `sessionStorage` antes do envio; confirmar limpa o armazenamento e alimenta o cache do detalhe.

#### `ApiError` — envelope existente

Campos: `error.code`, `error.message`, `error.details?` (`{path, message}[]`). Códigos relevantes: `VALIDATION_ERROR`/`TRANSFER_TYPE_NOT_FOUND`/`INVALID_TRANSACTION` (400), `TRANSACTION_NOT_FOUND` (404), `IDEMPOTENCY_KEY_CONFLICT` (422), `INTERNAL_ERROR` (500). Erros de rede, timeout e resposta inválida tornam-se `NETWORK_ERROR`, `TIMEOUT`, `INVALID_RESPONSE`. Traduzir por código/path com fallback geral.

#### Mapeamento API → apresentação

| Origem                                        | Destino                                                |
| --------------------------------------------- | ------------------------------------------------------ |
| `pending`, `approved`, `rejected`, `transfer` | Pendente, Aprovada, Rejeitada, Transferência.          |
| `value`                                       | `Intl.NumberFormat`, `pt-BR`, `BRL`.                   |
| Instantes ISO                                 | `Intl.DateTimeFormat`, `America/Sao_Paulo`.            |
| Datas civis                                   | `TZDate` de `@date-fns/tz`; limites inclusivos em UTC. |

#### Parâmetros fixos

| Parâmetro                       | Valor                |
| ------------------------------- | -------------------- |
| `PAGE_SIZE`, `POLL_INTERVAL_MS` | 20; 3000.            |
| `REQUEST_TIMEOUT_MS`            | 10000.               |
| `BUSINESS_TIME_ZONE`            | `America/Sao_Paulo`. |

### Endpoints da API

| Método | Rota                                   | Descrição       |
| ------ | -------------------------------------- | --------------- |
| GET    | `/transactions`                        | Listagem.       |
| GET    | `/transactions/:transactionExternalId` | Detalhe.        |
| POST   | `/transactions`                        | Criação/replay. |

`POST` exige header `Idempotency-Key` (UUID da tentativa). Status 200 e 201 confirmam criação; navegar pelo UUID do corpo, sem forçar pendência sobre replay terminal. Contratos completos em `apps/transactions/src/infrastructure/http/`.

## Pontos de integração

`NEXT_PUBLIC_API_URL` aponta para `/transactions`. `next.config.mjs` carrega `.env` via `dotenv`, valida origem HTTP(S) e falha explicitamente se ausente. Registrar variável no CI e em `apps/web/turbo.json`. `fetch` usa `no-store`, timeout, cancelamento e `credentials: omit`.

TanStack Query v5: chaves `['transactions','list',query]` e `['transactions','detail',id]`; `staleTime:0`, retries automáticos desativados. Polling enquanto os últimos dados contiverem pendentes, inclusive após erro; pausar em aba oculta, reconsultar ao montar, focar ou reconectar. Dados existentes prevalecem sobre a tela de erro durante falhas de atualização. Propagar `AbortSignal` e reconciliar respostas por UUID/`updatedAt`, preservando decisões terminais. Invalidar listas afetadas após criação/decisão.

Antes do envio, travar submissões concorrentes; timeout/5xx preserva corpo/chave para replay manual. Storage indisponível mantém tentativa em memória sem recuperação após recarga.

## Abordagem de testes

Reutilizar Vitest/jsdom e Testing Library; adicionar `user-event`. Testar componentes, schemas e cliente reais; substituir somente transporte HTTP externo. QueryClient isolado por teste; relógio controlado com avanço explícito e limpeza. Priorizar `getByRole`/`findByRole`. Rotas assíncronas verificadas no navegador.

Playwright automatiza E2E-01 e a parte reproduzível de E2E-02 em Chromium. A configuração inicia o
build de produção do dashboard e a API com `webServer`; o worker antifraude sem porta HTTP é iniciado
no setup global e encerrado pelo teardown da execução. Cada rodada usa `DATABASE_URL_TEST`, grupos
Kafka exclusivos e outbox/consumidores habilitados. Projetos separados cobrem 375, 768 e 1280px;
screenshots, vídeos e traces são mantidos em `evidences/`, e o Vitest limita sua descoberta a
`src/` para não executar specs Playwright.

### Testes de unidade

| ID    | Caso                       | Critérios           | Resultado esperado                                                                  |
| ----- | -------------------------- | ------------------- | ----------------------------------------------------------------------------------- |
| TU-01 | Entrada monetária e contas | CA-07, CA-14        | Normalização sem arredondamento; entradas inválidas rejeitadas.                     |
| TU-02 | Dias de Brasília           | CA-02, CA-14        | Limites inclusivos com transição de horário de verão; independência do dispositivo. |
| TU-03 | Respostas antigas          | CA-11, CA-13        | Sem regressão de decisão terminal.                                                  |
| TU-04 | URL e mensagens            | CA-03, CA-06, CA-10 | Contexto válido e fallback em português.                                            |

### Testes de integração

| ID    | Caso                             | Critérios           | Resultado esperado                                           |
| ----- | -------------------------------- | ------------------- | ------------------------------------------------------------ |
| TI-01 | Lista com 21 registros e filtros | CA-01, CA-02, CA-03 | Paginação e consultas corretas.                              |
| TI-02 | Estados da lista                 | CA-04               | Loading, erro, vazios e recuperação distintos.               |
| TI-03 | Detalhe                          | CA-05, CA-06        | Dados, loading, UUID inválido, 404 e erro.                   |
| TI-04 | Formulário                       | CA-07, CA-08, CA-10 | Campos inválidos, sucesso e erros preservando preenchimento. |
| TI-05 | Envio incerto                    | CA-09, CA-10        | Clique duplo, timeout, remontagem, replay terminal e 422.    |
| TI-06 | Acompanhamento                   | CA-11, CA-12, CA-13 | Prazo, foco, retomada, falha, página removida e recuperação. |
| TI-07 | Semântica e apresentação         | CA-14, CA-15        | Rótulos, foco, alertas, moeda e datas.                       |

### Testes E2E

| ID     | Caso                                       | Critérios                  | Resultado esperado                                                                       |
| ------ | ------------------------------------------ | -------------------------- | ---------------------------------------------------------------------------------------- |
| E2E-01 | Ciclo real no navegador                    | CA-08, CA-09, CA-11, CA-17 | 1000 aprova; 1000,01 rejeita; replay mantém UUID.                                        |
| E2E-02 | Navegação, acessibilidade e responsividade | CA-03, CA-15, CA-16, CA-17 | Fluxos utilizáveis em 375, 768 e 1280px, com toque, teclado, leitor de tela e zoom 200%. |
| E2E-03 | Entrega reproduzível                       | CA-17, CA-18               | Gate local/CI verde e decisões registradas.                                              |

E2E com backend/antifraude, PostgreSQL e Kafka reais; dados sintéticos isolados. A árvore acessível
do Chromium complementa a navegação por teclado automatizada; a verificação com leitor de tela
externo permanece manual e deve ser registrada sem ser confundida com automação. Sem meta percentual
de cobertura.

## Sequenciamento do desenvolvimento

1. Configuração, Tailwind, contratos e transporte.
2. Transformações, QueryClient e listagem/detalhe.
3. Formulário, idempotência e acompanhamento.
4. Testes, navegador, acessibilidade e documentação.

Manter Next 16/React 19. Adicionar: Query 5, Zod 4, React Hook Form, `@hookform/resolvers`, `@date-fns/tz`, `dotenv`, `user-event` e Tailwind 4/PostCSS. A infraestrutura das fases anteriores é necessária para E2E.

## Tratamento de falhas

O cliente HTTP transforma falhas de rede, timeout, cancelamento e respostas inválidas em erros tipados. TanStack Query mantém estado da consulta; a interface apresenta falha e recuperação ao operador. Logs operacionais são responsabilidade dos serviços backend.

## Considerações técnicas

### Decisões registradas em `DECISIONS.md`

Frontend por funcionalidade; Query/polling em vez de SSE/WebSocket (evita novos contratos backend); consumo direto da API; React Hook Form com `zodResolver`; idempotência e recuperação separadas do formulário.

### Riscos conhecidos

Contrato numérico limita precisão em valores grandes: rejeitar conversões que alterem a representação decimal. Offset e total podem variar entre consultas concorrentes: reconsultar e corrigir página. Storage restrito limita retomada após recarga; abas distintas não compartilham tentativa.

### Conformidade com o CLAUDE.md e as rules

Lidos `CLAUDE.md`, `PRACTICES.md` e `.claude/rules/code-standards.md`. Tipos estritos, constantes nomeadas, guard clauses e funções coesas. Conventional Commits, branch de trabalho e PR para `develop` obrigatórios.

### Conformidade com skills

`vercel-react-best-practices`: fronteiras cliente pequenas, Suspense, imports diretos e cache isolado. `web-design-guidelines` aplicada à UI implementada. `criar-techspec`: template, exploração e rastreabilidade.
