# DECISIONS.md

Decisões estruturantes deste repositório. Formato conforme `PRACTICES.md` → "Registro de decisões": **Decisão / Alternativas consideradas / Por quê**. Uma decisão sem alternativa considerada não é uma decisão.

## 1. Estrutura do projeto: monorepo com pnpm workspaces

**Decisão:** organizar `transactions`, `anti-fraud` e `web` em um único repositório como pacotes `pnpm workspaces`.

**Alternativas consideradas:** três repositórios separados por serviço.

**Por quê:** os três apps compartilham a mesma stack, quality gate, hooks e CI. Mantê-los em um único repositório evita a duplicação de ferramentas e permite usar o comando pnpm quality para garantir a consistência do projeto. A separação em vários repositórios faria sentido se o projeto fosse maior, tivesse times ou ciclos de vida independentes, ou se algum microsserviço atendesse a vários consumidores e precisasse evoluir de forma autônoma. Esse não é o caso atualmente.

## 2. Turborepo

**Decisão:** usar Turborepo sobre os workspaces do pnpm.

**Alternativas consideradas:** somente scripts do pnpm e Nx.

**Por quê:** o Turborepo oferece cache e organiza a ordem das tarefas entre os pacotes. Scripts do
pnpm seriam mais simples, mas não teriam esse cache. Nx também funcionaria, porém traz mais conceitos
do que precisamos neste projeto.

## 3. Testes: Vitest e Playwright

**Decisão:** usar Vitest nos testes dos apps e contratos, Testing Library nos componentes React e
Playwright com Chromium nos testes pelo navegador.

**Alternativas consideradas:** Jest nos serviços NestJS e Cypress nos testes de navegador.

**Por quê:** Vitest permite compartilhar a mesma configuração no monorepo. Playwright facilita
iniciar, aguardar e encerrar o dashboard e a API durante o E2E. Com Cypress, essa coordenação exigiria
scripts externos.

## 4. Lefthook e lint-staged

**Decisão:** usar Lefthook para os hooks e `lint-staged` para limitar lint e formatação aos arquivos
alterados. A instalação acontece pelo `prepare` da raiz.

**Alternativas consideradas:** Husky.

**Por quê:** no Lefthook, todos os hooks ficam descritos no mesmo arquivo YAML, o que facilita entender e alterar essa configuração. O Husky também resolveria, mas costuma espalhar os hooks em vário scripts. Neste projeto, o Lefthook organiza a execução e o `lint-staged` escolhe quais arquivos serão verificados.

## 5. Configs compartilhadas em `packages/*`

**Decisão:** `eslint-config`, `prettier-config`, `tsconfig` e `vitest-config` vivem como pacotes internos consumidos via `workspace:*`.

**Alternativas consideradas:** manter as configs na raiz e cada app estender via caminho relativo.

**Por quê:** cada config tem seu próprio `package.json` (com as dependências que ela usa listadas ali mesmo) e é importada pelo nome do pacote, sem caminho relativo. Acaba com os `../../../` frágeis e segue o padrão dos monorepos NestJS/Next de hoje.

## 6. Arquitetura hexagonal com casos de uso

**Decisão:** separar o serviço entre domínio, aplicação e adapters. Cada operação da API tem um
caso de uso próprio, e o acesso ao banco acontece por portas definidas na camada de aplicação.

**Alternativas consideradas:** seguir a estrutura tradicional do NestJS, com controllers chamando
services diretamente ligados ao ORM.

**Por quê:** a estrutura tradicional atende bem aplicações menores, mas pode aproximar as
regras de negócio do framework e do ORM. Como o serviço também terá integrações com PostgreSQL
e Kafka, a separação mantém o núcleo independente dessas tecnologias e permite testar ou
substituir uma integração sem reescrever as regras da transação.

## 7. Paginação por página e limite

**Decisão:** usar paginação por offset com `page` e `limit`, ordenando as transações mais recentes
primeiro.

**Alternativas consideradas:** cursor.

**Por quê:** o dashboard precisa navegar por páginas e exibir o total de registros. Cursor seria
mais adequado para volumes muito maiores, mas adicionaria complexidade sem benefício agora.

## 8. UUID v7 como identificador da transação

**Decisão:** usar `transactionExternalId` como chave primária em UUID v7, sem manter um segundo ID
interno.

**Alternativas consideradas:** inteiro incremental com UUID externo separado ou UUID v4 como chave
primária.

**Por quê:** um único identificador simplifica o modelo e evita expor IDs sequenciais. O UUID v7
também preserva melhor a localidade dos índices do que UUIDs totalmente aleatórios.

## 9. Criação retorna o recurso completo

**Decisão:** responder ao `POST /transactions` com `201 Created`, header `Location` e o mesmo corpo
completo usado na consulta da transação.

**Alternativas consideradas:** `202 Accepted` ou uma resposta contendo apenas o identificador.

**Por quê:** a transação já foi persistida quando a resposta é enviada. O status `pending` é um
estado do negócio, não uma criação pendente, e devolver o recurso evita uma consulta logo depois do
POST.

## 10. Idempotência na criação de transações

**Decisão:** aceitar o header opcional `Idempotency-Key` no `POST /transactions` para evitar
que a mesma transação seja criada mais de uma vez.

**Alternativas consideradas:** deixar o cliente lidar com requisições duplicadas ou criar uma
tabela só para controlar essas chaves.

**Por quê:** alguma falha de rede podem levar o cliente a reenviar a mesma requisição, sem que isso
represente uma nova transação. A combinação de restrição única com operação atômica garante a
idempotência mesmo diante de requisições concorrentes. Como a chave é opcional, requisições sem ela não
têm essa garantia; além disso, ela protege apenas a entrada HTTP e não substitui a estratégia de
idempotência necessária no consumo de eventos Kafka.

## 11. Envelope de erro único

**Decisão:** responder erros no formato `{ error: { code, message, details? } }` em todos os
endpoints.

**Alternativas consideradas:** manter o formato padrão do NestJS.

**Por quê:** o cliente recebe um código estável para tratar cada situação e detalhes por campo nos
erros de validação. Falhas internas usam uma mensagem genérica para não expor informações do
servidor.

## 12. Valor monetário como decimal

**Decisão:** salvar os valores como `Decimal(19,2)` no banco e usar número na aplicação e na API.

**Alternativa considerada:** criar um objeto `Money` no domínio.

**Por quê:** como ainda não fazemos cálculos com dinheiro, o `Money` deixaria o código mais complexo
sem trazer benefício agora. Se isso mudar, ele poderá ser adicionado depois.

## 13. Contratos Kafka compartilhados e versionados

**Decisão:** manter os contratos dos eventos `transaction.created` e
`transaction.status.updated` no pacote `@tech-challenge/event-contracts`. Os contratos são
versionados e validados com Zod antes do processamento.

**Alternativas consideradas:** definir os tipos separadamente em cada serviço, usar apenas
interfaces TypeScript ou adotar um schema registry.

**Por quê:** O producer e o consumer estão no mesmo monorepo e evoluem juntos. O pacote compartilhado
evita contratos diferentes entre os serviços, e o Zod também valida as mensagens recebidas. Um
schema registry acrescentaria infraestrutura sem necessidade nesta fase.

## 14. Idempotência e ordenação dos eventos Kafka

**Decisão:** usar `transactionExternalId` como chave no Kafka, manter o mesmo `eventId` nas novas
tentativas e registrar os eventos processados em uma inbox.

**Alternativas consideradas:** gerar um novo identificador em cada tentativa ou depender do
exactly-once do Kafka.

**Por quê:** o Kafka pode repetir mensagens. O identificador estável evita aplicar o mesmo efeito duas
vezes, e a chave mantém em ordem os eventos de uma transação.

## 15. Recuperação de falhas no Kafka

**Decisão:** usar uma outbox para não perder eventos na publicação. No consumo, tentar processar a
mensagem até três vezes e, se não der certo, enviá-la para uma DLQ. A mensagem só é confirmada depois
de ser processada ou enviada para a DLQ.

**Alternativas consideradas:** publicar no Kafka durante a requisição, usar CDC para publicar as
alterações do banco ou usar tópicos de retry antes da DLQ.

**Por quê:** publicar durante a requisição faria a API depender do Kafka. CDC seria uma solução
robusta, mas exigiria mais infraestrutura. Como as tentativas são curtas, fazê-las no próprio consumer
é mais simples do que manter tópicos adicionais, e a DLQ evita que uma mensagem inválida bloqueie o
fluxo.

## 16. Organização do frontend por funcionalidade

**Decisão:** manter o código do dashboard em `features/transactions`. As páginas do App Router apenas
montam as telas.

**Alternativa considerada:** organizar o frontend por camadas técnicas globais, como `components`,
`services` e `hooks`.

**Por quê:** Como seria apenas a feature de transações, deixar os arquivos necessários mais próximos da feature fez mais sentido
para mim. Caso houvesse mais features, uma separação por camadas seria melhor.

## 17. Acesso direto do dashboard à API

**Decisão:** o navegador chama a API diretamente pela URL definida em `NEXT_PUBLIC_API_URL`. O
backend libera por CORS apenas a origem definida em `DASHBOARD_ORIGIN`.

**Alternativas consideradas:** usar rewrite do Next.js ou criar Route Handlers como intermediários.

**Por quê:** a API não tem autenticação nesta fase e já oferece os endpoints e dados necessários. Uma camada
intermediária só aumentaria a configuração sem resolver um problema atual.

## 18. Estado remoto e acompanhamento com TanStack Query

**Decisão:** usar TanStack Query para consultas e cache. Enquanto houver uma transação pendente na
tela, o dashboard consulta novamente a API a cada 3 segundos. Uma decisão final nunca volta para
`pending`, mesmo que chegue uma resposta antiga.

**Alternativas consideradas:** Redux Toolkit com RTK Query, hooks com cache manual ou SSE para
receber as atualizações do backend.

**Por quê:** a empresa já utiliza Redux Toolkit, então RTK Query seria uma opção válida. Neste
dashboard, porém, não existe outro estado global que justifique criar uma store Redux apenas para
buscar dados. TanStack Query resolve cache, cancelamento e polling com menos configuração. Se o
projeto passar a usar Redux para outros estados, RTK Query pode se tornar a escolha mais consistente.
SSE evitaria o polling, mas exigiria um novo endpoint e conexões persistentes para uma atualização
que não precisa ser em tempo real.

## 19. Validação do dashboard com Zod e React Hook Form

**Decisão:** usar Zod para validar os dados recebidos da API e as entradas do formulário. React Hook
Form gerencia os campos, erros e envio, integrado ao Zod por `@hookform/resolvers`.

**Alternativas consideradas:** confiar apenas no TypeScript, usar somente a validação nativa do HTML
ou gerenciar o formulário diretamente com estado React.

**Por quê:** TypeScript não valida dados em tempo de execução, e a validação do HTML não cobre regras
como contas diferentes e valor monetário brasileiro. Zod concentra as regras de cada entrada em
schemas. Para este formulário, React Hook Form pode ser mais do que o necessário, mas foi adotado por
já ser o padrão da empresa e por facilitar a manutenção caso o dashboard receba novos formulários.

## 20. Recuperação de tentativa de criação por aba

**Decisão:** guardar no `sessionStorage` os dados da tentativa e sua chave idempotente enquanto o
resultado for incerto. Se o storage não estiver disponível, manter apenas em memória.

**Alternativas consideradas:** `localStorage`, persistência no servidor e não guardar a tentativa.

**Por quê:** sem guardar a chave e os dados, o usuário não conseguiria tentar de novo com segurança
se a resposta se perdesse. O `sessionStorage` deixa o formulário um pouco mais complexo, mas resolve
isso sem salvar a tentativa no backend e mantém os dados apenas na aba atual.

## 21. Criação como modal e página

**Decisão:** usar a rota `/transactions/new` como modal quando a navegação parte da listagem e como
página completa no acesso direto ou após atualizar a página.

**Alternativas consideradas:** usar apenas uma página ou controlar o modal somente com estado React.

**Por quê:** o modal mantém o contexto da listagem, enquanto a rota permite acesso direto, atualização
da página e navegação pelo histórico do navegador. Um modal controlado apenas por estado perderia
esses comportamentos.

## 22. Escritas e Leituras Concorrentes

Primeiro, eu tentaria resolver da forma mais simples. Usaria o ID da entidade como chave da mensagem no Kafka, para que os eventos relacionados sejam enviados para a mesma partição e processados em ordem. Depois, faria testes de concorrência e de carga para verificar se isso é suficiente.
Se ainda houvesse risco de conflito em operações críticas, como transferências, usaria transações no banco com bloqueio pessimista, garantindo que duas operações concorrentes não alterem o mesmo registro ao mesmo tempo.
Também colocaria um identificador único em cada evento e faria o consumidor registrar quais mensagens já foram processadas. Isso evita executar a mesma operação mais de uma vez, porque a chave do Kafka organiza as mensagens, mas não remove duplicadas automaticamente.
Se o volume de leituras fosse muito maior que o de escritas, poderia considerar CQRS para separar os dois modelos. Porém, deixaria isso como última opção, porque aumenta bastante a complexidade e não elimina sozinho os conflitos entre escritas.
