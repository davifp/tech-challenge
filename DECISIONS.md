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

## 3. Testes: Vitest em todos os apps

**Decisão:** Vitest é a única ferramenta de teste dos três apps, com `unplugin-swc` no NestJS para suportar decorators e Testing Library no Next.js.

**Alternativas consideradas:** Jest oficial do NestJS nos backends e Vitest apenas no web.

**Por quê:** ter a mesma ferramenta de teste nos três apps é bem mais confortável que ficar pulando entre Jest no backend e Vitest no frontend. Escolhi Vitest porque roda ESM direto, executa os arquivos de teste em paralelo por padrão e deixa o `packages/vitest-config` compartilhado entre os três. No NestJS, o `unplugin-swc` resolve os decorators sem trabalho extra, então trocar o Jest oficial não custou nada.

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
