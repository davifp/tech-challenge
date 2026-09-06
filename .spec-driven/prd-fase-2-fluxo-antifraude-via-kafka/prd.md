# Documento de Requisitos do Produto (PRD)

**Funcionalidade:** Fase 2 — Fluxo antifraude via Kafka (`transactions` ⇄ `anti-fraud`)
**Referências:** `README.md` original do desafio (seções "O problema", "Contratos" e "Backend"), `PRACTICES.md` (seções "Testes", "Registro de decisões" e "Código"), `.claude/rules/code-standards.md`, PRD, TechSpec e tarefas da Fase 1, e `DECISIONS.md`.

## Visão geral

A Fase 1 entregou a criação, a persistência e a consulta de transações, que nascem com status `pending`. Esta fase fecha o ciclo antifraude assíncrono entre os serviços `transactions` e `anti-fraud`: cada nova transação é submetida para análise, recebe o resultado da regra de valor e tem seu status persistido atualizado para `approved` ou `rejected`.

O fluxo deve continuar correto diante de mensagens repetidas e falhas de mensageria. Para consumidores da API, a criação permanece imediata e não espera a análise antifraude; para desenvolvedores e avaliadores, os eventos e seus resultados devem ser observáveis e recuperáveis sem perda silenciosa.

## Objetivos

- **Fechar o ciclo assíncrono:** toda transação criada e publicada para análise chega, em um ambiente saudável, a exatamente um resultado de negócio coerente com a regra antifraude.
- **Preservar a experiência síncrona:** o `POST /transactions` continua respondendo com a transação persistida em `pending`, sem aguardar a decisão antifraude.
- **Aplicar a regra sem ambiguidade:** valores maiores que `1000` resultam em `rejected`; valores menores ou iguais a `1000`, inclusive o limite exato, resultam em `approved`.
- **Tolerar reprocessamento:** repetir qualquer uma das mensagens do fluxo não cria transações adicionais, não regride status e não corrompe dados persistidos.
- **Dar tratamento visível às falhas:** falhas de publicação ou consumo seguem uma política documentada de recuperação, sem descarte silencioso.
- **Permitir diagnóstico:** publicações, consumos, resultados e falhas relevantes ficam disponíveis em logs estruturados, e os dois eventos podem ser inspecionados no Kafka UI local.
- **Manter qualidade e rastreabilidade:** `pnpm quality` fica verde e as decisões sobre contratos, idempotência e falhas são registradas em `DECISIONS.md` com alternativas e justificativa.

Métricas principais: os cenários de aprovação, rejeição, transição de status e duplicidade passam nos testes de comportamento; ambos os eventos são observáveis no Kafka UI; o quality gate passa nos serviços afetados e na raiz. Não há meta de volume ou latência definida para esta fase; em condições locais saudáveis, exige-se processamento eventual, sem prazo máximo de negócio estabelecido.

## Histórias de usuário

- **US1:** Como consumidor da API, quero criar uma transação sem esperar pela análise antifraude para que minha requisição não fique acoplada ao tempo de processamento assíncrono.
- **US2:** Como consumidor da API, quero consultar uma transação e ver seu status mudar de `pending` para o resultado correto para conhecer a decisão antifraude.
- **US3:** Como responsável pela operação, quero que mensagens repetidas possam ser reprocessadas com segurança para recuperar o fluxo sem corromper o estado.
- **US4:** Como responsável pela operação, quero que falhas de mensageria tenham destino e evidências conhecidos para diagnosticar e recuperar transações que permaneçam pendentes.
- **US5:** Como desenvolvedor dos serviços, quero um contrato de evento único, tipado e consistente entre produtores e consumidores para evoluir o fluxo sem incompatibilidades silenciosas.
- **US6:** Como desenvolvedor ou avaliador, quero rastrear publicações, consumos e decisões nos logs e no Kafka UI para validar o ciclo ponta a ponta.
- **US7:** Como avaliador, quero testes automatizados e decisões registradas para verificar tanto o comportamento quanto a justificativa das escolhas estruturantes.

## Principais funcionalidades

1. **Submissão da transação para análise.** Uma transação criada no serviço `transactions` inicia o fluxo antifraude sem alterar a resposta síncrona existente.
   - **RF1:** Cada nova transação persistida com status `pending` origina um evento `transaction.created` destinado ao serviço `anti-fraud`.
   - **RF2:** O `POST /transactions` não espera pelo resultado antifraude e mantém o contrato, o código de resposta e o status inicial definidos na Fase 1.

2. **Decisão antifraude.** O serviço `anti-fraud` analisa transações recebidas e comunica um resultado determinístico.
   - **RF3:** O `anti-fraud` recebe eventos `transaction.created` e identifica a transação e o valor necessários para a análise.
   - **RF4:** Uma transação com valor maior que `1000` recebe resultado `rejected`; uma transação com valor menor ou igual a `1000` recebe resultado `approved`.
   - **RF5:** Para cada análise concluída, o `anti-fraud` origina um evento `transaction.status.updated` que identifica a transação e o status resultante.

3. **Atualização do status persistido.** O serviço `transactions` aplica o resultado antifraude à transação correspondente.
   - **RF6:** Ao receber `transaction.status.updated`, o serviço localiza a transação pelo identificador externo e persiste o status informado.
   - **RF7:** Após o processamento, as consultas já existentes refletem `approved` ou `rejected`, sem mudança no formato de resposta da API.

4. **Contrato compartilhado e evolutivo.** Produtores e consumidores interpretam os dois eventos da mesma maneira.
   - **RF8:** Os payloads são tipados e contêm os dados e identificadores necessários para processamento, correlação e idempotência; o formato escolhido é registrado em `DECISIONS.md`.
   - **RF9:** Uma alteração de contrato atualiza produtor e consumidor no mesmo pull request e é coberta por validação automatizada nos dois lados.

5. **Reprocessamento idempotente.** Entregas repetidas não mudam o significado nem a integridade do fluxo.
   - **RF10:** Reprocessar o mesmo `transaction.created` produz a mesma decisão de negócio e não cria uma nova transação nem um resultado conflitante.
   - **RF11:** Reprocessar o mesmo `transaction.status.updated` não altera novamente uma transação que já recebeu aquele resultado e não regride seu status.
   - **RF12:** A estratégia e a chave usadas para reconhecer reprocessamentos são registradas em `DECISIONS.md`.

6. **Tratamento de falhas de mensageria.** Falhas transitórias e mensagens que não podem ser processadas têm comportamento conhecido.
   - **RF13:** Falhas de publicação e consumo não são descartadas silenciosamente e seguem uma política de retry e/ou DLQ registrada em `DECISIONS.md`.
   - **RF14:** Uma falha ao obter ou aplicar o resultado mantém a transação em `pending` até que um resultado válido seja processado; não há aprovação ou rejeição presumida.
   - **RF15:** É possível distinguir, por evidência operacional, mensagens processadas, em nova tentativa e destinadas ao tratamento de falha escolhido.

7. **Observabilidade e testes.** O ciclo pode ser acompanhado e seus comportamentos críticos são protegidos contra regressão.
   - **RF16:** Publicações e consumos geram logs estruturados com nome do evento, identificação da transação, resultado do processamento e falhas relevantes, sem credenciais.
   - **RF17:** Testes de comportamento cobrem a regra do limite, a transição persistida, as duplicidades nos dois sentidos e o tratamento de falha definido.

## Critérios de aceitação

- **CA-01 (US1, RF1, RF2):** Dado um corpo válido, quando o cliente executa `POST /transactions`, então recebe a mesma resposta síncrona da Fase 1 com status `pending`, sem aguardar o antifraude, e o evento `transaction.created` fica observável no Kafka UI.
- **CA-02 (US2, RF3, RF4, RF5):** Dada uma transação com valor `1000`, quando `anti-fraud` processa `transaction.created`, então decide `approved` e publica `transaction.status.updated` com esse resultado.
- **CA-03 (US2, RF3, RF4, RF5):** Dada uma transação com valor maior que `1000`, quando `anti-fraud` processa `transaction.created`, então decide `rejected` e publica `transaction.status.updated` com esse resultado.
- **CA-04 (US2, RF6, RF7):** Dado um `transaction.status.updated` válido para uma transação existente, quando `transactions` o processa, então `GET /transactions/:transactionExternalId` passa de `pending` para o status recebido e mantém o formato de resposta existente.
- **CA-05 (US3, RF10):** Dado o mesmo `transaction.created` entregue mais de uma vez, quando as entregas são processadas, então a decisão permanece igual e não surge transação adicional, resultado conflitante ou corrupção de dados.
- **CA-06 (US3, RF11):** Dado o mesmo `transaction.status.updated` entregue mais de uma vez, quando as entregas são processadas, então somente a primeira aplicação efetiva altera a transação e as seguintes preservam o estado e os dados persistidos.
- **CA-07 (US4, RF13, RF14, RF15):** Dada uma falha de publicação ou consumo, quando ela ocorre, então a mensagem segue a política de retry e/ou DLQ registrada, a falha produz evidência operacional e nenhum status final é presumido antes do processamento válido.
- **CA-08 (US5, RF8, RF9):** Dado qualquer payload dos dois eventos, quando produtores, consumidores e testes o utilizam, então o contrato é tipado, compatível nos dois lados e não contém `any`; uma alteração incompatível não é aceita em apenas um serviço.
- **CA-09 (US6, RF5, RF16):** Dado o fluxo completo de uma transação, quando ele é executado, então `transaction.created` e `transaction.status.updated` podem ser encontrados no Kafka UI e os logs estruturados permitem correlacionar publicação, consumo, resultado e eventual falha pela transação.
- **CA-10 (US7, RF17):** Dado `pnpm quality`, quando os testes são executados, então existem e passam cenários de valor abaixo de `1000`, valor igual a `1000`, valor acima de `1000`, transição de status e reprocessamento idempotente em ambos os consumidores.
- **CA-11 (US7, RF12, RF13):** Dado `DECISIONS.md`, quando o leitor o consulta, então encontra, no formato "Decisão / Alternativas consideradas / Por quê", o formato dos payloads, a chave e a estratégia de idempotência e a política de retry/DLQ.
- **CA-12 (US7):** Dado o código da fase concluído, quando `pnpm quality` é executado na raiz e no CI, então lint, tipos, formatação, testes e build passam para todos os serviços afetados.

## Experiência do usuário

**Perfis.** O consumidor da API pode ser o futuro dashboard, um script ou um cliente HTTP. Desenvolvedores, avaliadores e responsáveis pela operação acompanham o fluxo por consultas à API, Kafka UI, testes e logs.

**Jornada principal.** O cliente cria uma transação e recebe imediatamente o recurso em `pending`. Sem uma nova ação do cliente, a transação é analisada e passa a `approved` ou `rejected`. Uma consulta posterior apresenta o novo status no mesmo contrato já conhecido.

**Jornadas excepcionais.** Se uma mensagem for repetida, o resultado permanece estável. Se houver falha na mensageria, a transação pode permanecer `pending` enquanto a política de recuperação atua, e a situação deve ser diagnosticável. Não há interface visual nesta fase; requisitos de UI e acessibilidade serão tratados na Fase 3. A experiência operacional deve usar descrições de evento e resultado compreensíveis e não depender de leitura de código.

## Restrições técnicas de alto nível

- Kafka é a tecnologia de mensageria obrigatória, usando a infraestrutura local existente no `docker-compose.yml` e compartilhada pelos dois serviços.
- O serviço `anti-fraud` usa NestJS + TypeScript e integra-se ao serviço `transactions` exclusivamente pelos eventos definidos para este fluxo.
- Os eventos obrigatórios são `transaction.created`, publicado por `transactions` e consumido por `anti-fraud`, e `transaction.status.updated`, publicado por `anti-fraud` e consumido por `transactions`.
- Publisher e consumer compartilham o mesmo contrato; mudanças devem alcançar os dois lados no mesmo pull request.
- Payloads, processamento e logs são tipados sem `any`.
- Credenciais, hosts, portas e identificadores de ambiente vêm de configuração externa; nenhum valor sensível ou host de execução fica fixo no código.
- O formato dos payloads, a estratégia de idempotência e a política de retry/DLQ são decisões pendentes obrigatórias em `DECISIONS.md`, sempre com alternativas consideradas e justificativa.
- O fluxo parte dos contratos e dados entregues na Fase 1: identificador externo da transação, status inicial `pending` e estados finais `approved` e `rejected`.
- Não há meta de throughput ou latência nesta fase; a confiabilidade funcional e a recuperação observável têm prioridade.

## Fora do escopo

- Interface do usuário, dashboard e qualquer alteração visual — Fase 3.
- Testes E2E de UI — Fase 3 ou Fase 4, conforme o escopo posterior.
- Novas regras antifraude além do limite de valor `1000`, como score, listas de bloqueio, dados externos ou revisão manual.
- Alterações nos contratos HTTP, filtros, paginação ou idempotência de criação entregues na Fase 1.
- Comunicação síncrona entre `transactions` e `anti-fraud` para obter a decisão.
- Autenticação, autorização, RBAC, deploy remoto e operação de ambientes produtivos.
- Metas de escala, particionamento para alto volume, métricas de negócio, tracing distribuído e alertas; podem ser definidos em fases futuras.
