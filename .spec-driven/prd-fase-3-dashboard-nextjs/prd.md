# Documento de Requisitos do Produto (PRD)

**Funcionalidade:** Fase 3 — Dashboard Next.js (listagem, detalhe e criação).

**Referências:** [Fase 3 do planejamento](../phases.md), README original do desafio no commit `0bb0f175a2a4a147d3c3da610cfec5b24f26128f` (`git show 0bb0f17:README.md`, seções “O problema”, “Contratos”, “Frontend” e “Testes”), [PRACTICES.md](../../PRACTICES.md), [PRD da Fase 1](../prd-fase-1-dados-e-api-de-transacoes/prd.md), [PRD da Fase 2](../prd-fase-2-fluxo-antifraude-via-kafka/prd.md) e [DECISIONS.md](../../DECISIONS.md).

## Visão geral

O dashboard permite consultar, criar e acompanhar transações. Esta fase entrega listagem paginada com filtros, detalhe por identificador externo e formulário de criação, utilizando os serviços anteriores.

O desafio central é comunicar uma decisão que chega depois da criação: uma transação nasce pendente e passa a aprovada ou rejeitada pela análise antifraude. A interface deve acompanhar essa mudança e explicar carregamento, ausência de resultados e falhas, preservando o contexto de trabalho do operador.

## Objetivos

- Concluir três fluxos com dados reais: localizar uma transação, consultar seu detalhe e criar uma transação acompanhando sua decisão.
- Exibir automaticamente a decisão disponível na API em até 5 segundos, com a tela ativa e o ambiente local saudável; o prazo não inclui o processamento antifraude.
- Tornar verificáveis os estados de carregamento, erro e vazio, a validação do formulário e a recuperação após falhas.
- Permitir concluir os fluxos por teclado e em larguras de 375, 768 e 1280 pixels, com 375px como largura mínima suportada.
- Entregar testes de comportamento, validação no navegador e `pnpm quality` verde localmente e no CI, com decisões estruturantes justificadas.

## Histórias de usuário

- **US1:** Como operador, quero filtrar e percorrer transações para encontrar registros relevantes sem examinar toda a base.
- **US2:** Como operador, quero consultar uma transação pelo identificador externo para conferir contas, valor, datas e status.
- **US3:** Como operador, quero preencher uma transferência e corrigir entradas inválidas para registrar uma transação com segurança.
- **US4:** Como operador, quero acompanhar a decisão antifraude sem recarregar a página para saber quando a transação deixa de estar pendente.
- **US5:** Como operador, quero compreender falhas e tentar novamente sem perder dados para continuar meu trabalho.
- **US6:** Como avaliador, quero reproduzir os fluxos e verificar testes e decisões para avaliar a entrega.

## Principais funcionalidades

- **RF1 — Listagem:** apresentar identificador externo, tipo, valor, status e data de criação, com as mais recentes primeiro. Exibir 20 registros por página, total de resultados, página atual e navegação disponível; cada registro permite abrir seu detalhe.
- **RF2 — Filtros e contexto:** filtrar por status, tipo e período de criação, combinando todos os critérios. Permitir somente início, somente fim ou ambos, incluindo integralmente os dias selecionados no horário de Brasília, independentemente do dispositivo. Impedir intervalo invertido, oferecer limpeza dos filtros e voltar à primeira página ao alterá-los. Preservar filtros e página ao retornar do detalhe.
- **RF3 — Estados da listagem:** distinguir carregamento inicial, falha de consulta, base vazia e ausência de resultados para os filtros. Oferecer nova tentativa no erro, criação na base vazia e limpeza quando os filtros não encontrarem resultados.
- **RF4 — Detalhe:** permitir acesso direto pelo identificador externo e pela listagem. Exibir identificador completo, contas de débito e crédito, tipo, valor, status, criação e última alteração, conforme a API existente. Distinguir carregamento, identificador inválido, transação inexistente e falha de consulta, com retorno à listagem e nova tentativa quando aplicável.
- **RF5 — Formulário:** solicitar contas de débito e crédito, tipo e valor. Exigir identificadores UUID válidos e distintos, inclusive quando diferirem somente em maiúsculas, tipo disponível e valor positivo com até duas casas decimais. Aceitar entrada decimal em português. Valores acima de 1000 continuam permitidos; a decisão pertence ao antifraude.
- **RF6 — Confirmação:** após a criação confirmada, informar sucesso e abrir o detalhe da transação retornada. Para uma nova transação, comunicar o estado inicial pendente sem esperar a análise; sucesso de criação não significa aprovação. Ao retornar à lista, refletir a criação se ela corresponder aos filtros ativos.
- **RF7 — Envio e recuperação:** indicar envio em andamento e impedir submissões simultâneas acidentais. Exibir erros de campo e falhas gerais em português, preservando o preenchimento. Se a confirmação se perder, explicar a incerteza; repetir a mesma tentativa com os mesmos dados não pode criar outra transação, utilizando a garantia já existente na API.
- **RF8 — Acompanhamento:** atualizar automaticamente pendentes visíveis na listagem e no detalhe, dentro da meta dos objetivos. Preservar foco, filtros e dados durante a atualização. Resultados atualizados respeitam os filtros e mantêm total e paginação coerentes. Ao retomar a tela, consultar o estado atual. Não substituir uma decisão conhecida por uma resposta pendente mais antiga.
- **RF9 — Falhas no acompanhamento:** manter os últimos dados conhecidos, sinalizar falha de atualização e permitir nova tentativa. Retomar o acompanhamento após recuperação. Demora ou indisponibilidade nunca implica aprovação ou rejeição; uma transação ainda pendente deve continuar identificada como tal.
- **RF10 — Apresentação:** traduzir `pending`, `approved`, `rejected` e `transfer` para “Pendente”, “Aprovada”, “Rejeitada” e “Transferência”. Aplicar idioma, moeda e fuso definidos na experiência do usuário, sem modificar os valores recebidos.
- **RF11 — Acessibilidade e responsividade:** disponibilizar navegação, filtros, paginação e formulário por teclado, com rótulos acessíveis, foco visível e mensagens associadas aos campos. Comunicar status também por texto, e carregamento, erros e sucesso para tecnologias assistivas. Manter conteúdo e ações utilizáveis nas larguras previstas e com ampliação de 200%.
- **RF12 — Verificação:** proteger com testes automatizados as três telas, filtros, paginação, estados, validação, recuperação de envio e atualização assíncrona. Validar os fluxos no navegador conectado ao backend local, incluindo aprovação e rejeição. A Fase 4 amplia a suíte; estes comportamentos já devem estar protegidos nesta entrega.
- **RF13 — Entrega verificável:** manter o quality gate verde e registrar as escolhas de acesso aos dados, validação e atualização de status em `DECISIONS.md`, com alternativas e justificativas. A TechSpec define os mecanismos para cumprir estes requisitos.

## Critérios de aceitação

- **CA-01 (US1, RF1):** Dadas 21 transações, quando a listagem é aberta sem filtros, então mostra as 20 mais recentes, total 21 e navegação para a segunda página, que contém a restante.
- **CA-02 (US1, RF2):** Dados filtros de status, tipo e período, quando aplicados separadamente ou combinados, então consulta e resultados respeitam todos os critérios. Início e fim incluem os dias inteiros; intervalo invertido apresenta erro antes da consulta.
- **CA-03 (US1, RF2):** Dada uma página posterior à primeira, quando os filtros mudam, então a navegação volta à primeira página; ao abrir um detalhe e retornar, filtros e página anteriores são recuperados.
- **CA-04 (US1, US5, RF3):** Dadas respostas demoradas, falhas e consultas sem registros, quando a lista é consultada, então cada situação apresenta seu estado e ação correspondente. Uma falha não aparece como lista vazia; nova tentativa bem-sucedida recupera os resultados.
- **CA-05 (US2, RF4):** Dada uma transação existente, quando seu detalhe é aberto diretamente ou pela lista, então todos os dados previstos aparecem e correspondem ao registro consultado.
- **CA-06 (US2, US5, RF4):** Dado um identificador inválido, inexistente ou uma consulta com falha, quando o detalhe é acessado, então a mensagem distingue a situação e permite retornar; falhas recuperáveis permitem tentar novamente.
- **CA-07 (US3, RF5):** Dados campos ausentes, UUID inválido, contas iguais, tipo indisponível, valor não positivo ou mais de duas casas decimais, quando o formulário é enviado, então aponta os campos inválidos sem criar uma transação.
- **CA-08 (US3, US4, RF5, RF6, RF8):** Dados formulários válidos com valores 1000 e 1000,01, quando enviados no ambiente integrado, então ambos são criados com confirmação e acesso ao detalhe; após a análise, exibem respectivamente “Aprovada” e “Rejeitada”.
- **CA-09 (US3, US5, RF7):** Dado um envio em andamento ou cuja resposta se perdeu, quando há clique repetido ou repetição da mesma tentativa, então existe apenas uma transação e a confirmação recuperada identifica esse registro.
- **CA-10 (US5, RF7):** Dado erro de validação do servidor ou falha de comunicação, quando o envio termina, então o formulário preserva os dados, mostra orientação em português e permite corrigir ou tentar novamente, sem anunciar sucesso não confirmado.
- **CA-11 (US4, RF8):** Dada uma transação pendente visível, quando a API disponibiliza a decisão em ambiente saudável e com a tela ativa, então listagem e detalhe refletem o resultado em até 5 segundos, sem recarregar a página ou exigir ação do usuário.
- **CA-12 (US1, US4, RF8):** Dada uma lista filtrada por pendentes, quando uma transação recebe decisão, então ela deixa o resultado, total e páginas são atualizados e, se a página atual deixar de existir, uma página válida é apresentada.
- **CA-13 (US4, US5, RF8, RF9):** Dada uma tela com dados, quando a atualização falha, então os dados permanecem visíveis com aviso; após a recuperação ou retomada da tela, o acompanhamento retorna sem perder filtros ou foco. Nenhuma decisão é inventada ou revertida por resposta antiga.
- **CA-14 (US1, US2, US3, RF10):** Dado o valor 1000,01, quando exibido ou preenchido, então preserva esse valor e aparece como “R$ 1.000,01”. Status e tipo são traduzidos. Alterar o fuso do dispositivo não muda datas exibidas nem resultados do mesmo filtro por período: ambos seguem o horário de Brasília, conforme informado na interface.
- **CA-15 (US1, US3, US5, RF11):** Dado uso exclusivo de teclado e tecnologia assistiva, quando os fluxos são percorridos, então controles têm nomes acessíveis, foco é perceptível e mensagens são comunicadas sem depender somente de cor.
- **CA-16 (US1, US2, US3, RF11):** Dadas as três larguras previstas e ampliação de 200%, quando as telas são utilizadas, então conteúdo e ações permanecem acessíveis, sem sobreposição impeditiva; identificadores completos podem ser consultados no detalhe.
- **CA-17 (US6, RF12, RF13):** Dada a implementação concluída, quando os testes e `pnpm quality` são executados localmente e no CI, então passam, com os comportamentos exigidos cobertos. A validação no navegador registra evidências dos fluxos reais e dos estados de erro, vazio e carregamento.
- **CA-18 (US6, RF13):** Dada a entrega, quando `DECISIONS.md` é consultado, então documenta as escolhas exigidas, incluindo atualização de status e alternativas descartadas, com justificativas compatíveis com os critérios acima.

## Experiência do usuário

O operador começa na listagem, refina a consulta, abre um detalhe e retorna ao contexto anterior. “Nova transação” leva ao formulário; o sucesso conduz ao detalhe, onde acompanha a decisão. O avaliador repete essa jornada na infraestrutura local.

**Preferências confirmadas:** painel compacto, tema claro, português do Brasil, valores em reais e atualização automática em até 5 segundos nas condições dos objetivos. Datas de criação e alteração, na listagem e no detalhe, e limites dos filtros seguem `America/Sao_Paulo`, indicado como “Horário de Brasília”. Essa convenção preserva os instantes registrados pela API.

Carregamentos preservam a navegação; atualizações em segundo plano mantêm conteúdo legível e controles utilizáveis. Pendência significa espera pela decisão, e rejeição antifraude é um resultado de negócio, sem aparência de falha técnica do formulário.

## Restrições técnicas de alto nível

- Next.js com App Router, React, Tailwind, TypeScript estrito e pnpm são obrigatórios; nenhum `any`.
- Dependências: contratos da Fase 1 e fluxo antifraude da Fase 2. Usar os endpoints existentes de criação, listagem e consulta, preservando seus contratos.
- Catálogo atual: somente `transferTypeId = 1`, “Transferência”. O filtro continua disponível; não pressupor outros tipos nem um endpoint de catálogo.
- A API é a fonte do status; não consultar Kafka diretamente pela interface nem aplicar a regra antifraude no frontend.
- URLs e configuração vêm do ambiente, com documentação em `.env.example`; credenciais não podem chegar ao navegador, código versionado ou mensagens de erro.
- Testes verificam comportamento e priorizam consultas por papel acessível, como `getByRole`. Dados de validação são sintéticos.
- Organização interna, bibliotecas auxiliares e mecanismo de atualização serão definidos na TechSpec. Não há meta de escala nesta fase.

## Fora do escopo

- Novos endpoints, alterações de contratos, regras antifraude ou catálogo administrável.
- Autenticação, autorização, edição, cancelamento ou exclusão de transações.
- Saldos, movimentação financeira efetiva, gráficos agregados, exportações e notificações externas.
- Tema escuro, personalização visual, múltiplas moedas e conversão cambial.
- Atualização contínua de toda a base quando não houver pendentes visíveis.
- Deploy em produção, testes de carga e consolidação ampla da suíte da Fase 4. Automação E2E de navegador é opcional; validação no navegador é obrigatória.
