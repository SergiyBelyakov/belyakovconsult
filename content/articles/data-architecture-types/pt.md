---
title: "Arquitetura de dados: 6 níveis, do ERP ao data mesh"
description: "Seis tipos de arquitetura de dados nas empresas: de relatórios diretos nos sistemas a data warehouse, data lake, lakehouse e data mesh. Prós, contras e escolha."
date: 2026-11-27
services: [data-architecture, business-intelligence, data-governance]
tags: [arquitetura de dados, data warehouse, data lake, lakehouse, data mesh, data fabric, ODS, data mart, CDC]
promo:
  hook: "6 níveis de arquitetura de dados"
  tag: "Dos relatórios do ERP ao data mesh"
  cta: "Em que nível está a sua empresa hoje?"
---

Quando uma empresa tem dois valores diferentes de faturação e um novo relatório demora um mês, o problema raramente está nas pessoas ou na ferramenta de relatórios. Normalmente está na arquitetura de dados: de onde os relatórios tiram os dados, onde vive a lógica de negócio e quem responde pela exatidão dos números.

Abaixo estão seis tipos de arquitetura de dados encontrados em sistemas empresariais, do mais simples ao mais complexo. Não são degraus que todos têm de subir. Muitas empresas vivem bem no terceiro nível para sempre, e as grandes organizações combinam muitas vezes vários tipos em simultâneo. O objetivo do artigo é ajudar a perceber onde está e se precisa mesmo do nível seguinte.

Se o seu interesse é a camada de relatórios, temos um guia separado sobre [quatro opções de arquitetura de BI e boas práticas de Power BI](/pt/insights/bi-architecture-options/).

## Em resumo

| Nível | Tipo | Principal vantagem | Principal risco | Para quem |
|---|---|---|---|---|
| 1 | Relatórios diretos nos sistemas | arranque em dias | números diferentes em relatórios diferentes | pequena empresa, um ou dois sistemas |
| 2 | Réplica (ODS) | não sobrecarrega os sistemas operacionais | lógica ainda espalhada pelos relatórios | vários sistemas, relatórios operacionais |
| 3 | Data warehouse e data marts | uma versão da verdade, histórico | alterações levam semanas | média e grande empresa, finanças |
| 4 | Data lake | armazenamento barato para qualquer dado | sem regras vira pântano | grandes volumes, data science |
| 5 | Lakehouse | uma cópia dos dados para BI e ML | exige novas competências | grandes volumes, BI e ML juntos |
| 6 | Data mesh | escala sem estrangulamento central | exige uma organização madura | muitos domínios com equipas próprias |

Todas as avaliações aqui e abaixo são indicativas. Prazos e custos reais dependem do número de fontes, da sua qualidade, dos volumes e da equipa.

## 1. Relatórios diretos nos sistemas

**Como funciona.** Cada relatório liga-se sozinho aos sistemas operacionais: ERP, CRM, software de armazém, ficheiros Excel. A lógica de cálculo dos indicadores vive dentro de cada relatório. Os sistemas ligam-se uns aos outros um a um, ou seja, integração ponto a ponto.

**Vantagens.**

- Arranque em dias, sem infraestrutura própria.
- Custo mínimo e suporte simples enquanto há poucos relatórios.

**Desvantagens.**

- O mesmo número é calculado de forma diferente em relatórios diferentes.
- Consultas pesadas sobrecarregam os sistemas operacionais em horário de trabalho.
- Sem histórico: não se sabe como estava uma tabela de referência há um mês.

**Quando faz sentido.** Pequena empresa, um ou dois sistemas, poucos relatórios, uma equipa.

**Sinais para avançar.** As reuniões começam por descobrir de quem é o número certo. O ERP fica lento quando os relatórios atualizam. Uma nova fonte obriga a refazer uma dúzia de relatórios.

## 2. Réplica das bases operacionais (ODS)

**Como funciona.** Os dados dos sistemas operacionais são copiados periodicamente ou quase em tempo real para uma base separada, um operational data store (ODS). Os relatórios leem a cópia e não o sistema em produção. A estrutura das tabelas fica quase igual à da fonte.

**Vantagens.**

- Os sistemas operacionais deixam de sofrer com os relatórios.
- Dados de vários sistemas ficam no mesmo sítio e podem ser combinados.
- Atualidade elevada, sobretudo se as alterações forem copiadas com CDC.

**Desvantagens.**

- A lógica de negócio continua espalhada pelos relatórios e as diferenças nos números mantêm-se.
- A estrutura das fontes é pouco prática para análise e as consultas ficam complexas.
- Normalmente não há histórico de alterações: a cópia mostra o estado atual.

**Quando faz sentido.** Vários sistemas operacionais, necessidade de relatórios operacionais e um projeto de data warehouse ainda demasiado grande.

**Sinais para avançar.** As mesmas fórmulas repetem-se em muitos relatórios. É preciso comparar períodos e não há histórico. Os analistas passam mais tempo a juntar tabelas do que a analisar.

## 3. Data warehouse e data marts

**Como funciona.** Os dados das fontes passam por ETL ou ELT: são limpos, reconciliados entre sistemas e guardados com histórico num data warehouse. Para as áreas de negócio constroem-se data marts em esquema em estrela: tabelas de factos e dimensões. Os relatórios leem dos data marts ou de um modelo semântico partilhado.

Há duas abordagens clássicas. Bill Inmon propôs construir primeiro um data warehouse empresarial normalizado e derivar dele os data marts. Ralph Kimball propôs construir o data warehouse diretamente a partir de modelos dimensionais ligados por dimensões partilhadas. Na prática, a maioria dos data warehouses modernos combina as duas ideias.

**Vantagens.**

- Uma versão da verdade: cada indicador é definido uma vez.
- Histórico de alterações e comparação de períodos.
- Um modelo que os utilizadores de negócio entendem e relatórios rápidos.

**Desvantagens.**

- Cada alteração passa pela equipa de dados e leva semanas.
- Pouco adequado a dados não estruturados: logs, textos, ficheiros.
- Exige uma equipa permanente e disciplina de modelação.

**Quando faz sentido.** Média e grande empresa, relatórios financeiros e regulamentares em que os números têm de bater ao cêntimo.

**Sinais para avançar.** Os volumes e tipos de dados crescem mais depressa do que o data warehouse os consegue receber. A data science precisa de dados brutos que o data warehouse não tem. A fila de pedidos à equipa de dados cresce durante meses.

## 4. Data lake

**Como funciona.** Todos os dados vão para um armazenamento de ficheiros barato, em bruto: tabelas, logs, eventos, documentos, dados de dispositivos. A estrutura aplica-se na leitura e não na escrita. O termo "data lake" surgiu por volta de 2010, juntamente com o ecossistema Hadoop.

**Vantagens.**

- Armazenamento muito barato para grandes volumes.
- Qualquer formato, incluindo dados não estruturados.
- Dados brutos disponíveis para data science e machine learning.

**Desvantagens.**

- Sem catálogo, responsáveis e regras de qualidade, o data lake transforma-se depressa num "pântano" onde ninguém sabe o que lá está nem se pode confiar.
- Os relatórios clássicos de BI continuam a precisar de um data warehouse ao lado, e os dados duplicam-se.
- Garantias fracas de consistência com escritas e alterações simultâneas.

**Quando faz sentido.** Grandes volumes de dados variados, uma equipa forte de data science, necessidade de guardar dados brutos durante anos.

**Sinais para avançar.** Mantém um data lake e um data warehouse com os mesmos dados. Relatórios e modelos de ML calculam os mesmos indicadores de forma diferente.

## 5. Lakehouse

**Como funciona.** O lakehouse junta o armazenamento barato do data lake com a fiabilidade do data warehouse. Os dados ficam em formatos de tabela abertos, como Delta Lake ou Apache Iceberg, que acrescentam transações, versões e controlo de esquema. Internamente, os dados organizam-se em geral pela arquitetura medallion: Bronze para dados brutos, Silver para dados limpos e reconciliados, Gold para data marts prontos a usar.

**Vantagens.**

- Uma cópia dos dados para BI, data science e ML.
- Dados mais atuais e menos cópias entre sistemas.
- O processamento escala separadamente do armazenamento.

**Desvantagens.**

- Novas competências: Spark, SQL em grande escala, gestão de formatos de tabela.
- Exige disciplina entre camadas, caso contrário a Gold vira o mesmo pântano.
- Os custos de processamento têm de ser vigiados porque crescem com a carga.

**Quando faz sentido.** Grandes volumes, BI e ML sobre os mesmos dados, uma plataforma cloud como Microsoft Fabric ou Databricks.

**Sinais para avançar.** A equipa central de dados tornou-se um estrangulamento para toda a empresa, enquanto domínios como vendas, logística e finanças têm analistas e engenheiros próprios e querem andar mais depressa.

## 6. Data mesh

**Como funciona.** O data mesh não é uma tecnologia, é uma abordagem organizacional. Foi descrito por Zhamak Dehghani em 2019. Em vez de uma equipa central, os dados pertencem aos domínios que os criam. A abordagem assenta em quatro princípios:

1. Propriedade por domínio: responde pelos dados a equipa que melhor os entende.
2. Dados como produto: cada domínio publica produtos de dados com descrição, padrões de qualidade e um responsável.
3. Plataforma de dados self-service: infraestrutura comum para que os domínios não construam tudo do zero.
4. Governação federada e computacional: regras comuns de segurança, qualidade e interoperabilidade, verificadas automaticamente.

**Vantagens.**

- Escala sem um único estrangulamento.
- Os dados ficam perto de quem os entende, por isso a qualidade melhora.
- Os domínios avançam ao seu próprio ritmo.

**Desvantagens.**

- Exige maturidade: responsáveis pelos dados, uma plataforma forte, cultura de responsabilidade.
- Risco de duplicação e definições incompatíveis se as regras forem fracas.
- Caro para empresas sem várias equipas de dados independentes.

**Quando faz sentido.** Uma grande organização com vários domínios, cada um com engenheiros e analistas próprios, em que a equipa central já não acompanha.

**Quando é cedo demais.** Se uma ou duas pessoas trabalham com dados, o data mesh acrescenta burocracia sem acrescentar velocidade.

## Abordagens transversais: streaming e data fabric

Há duas abordagens que não são um nível à parte, mas complementam qualquer um deles.

**Streaming.** Quando os dados são precisos em segundos e não na manhã seguinte, usam-se fluxos de eventos e CDC: as alterações nas bases operacionais são passadas de imediato. Os padrões clássicos são Lambda (camadas batch e streaming em paralelo) e Kappa (tudo como fluxo). O streaming é mais caro e mais difícil de manter, por isso vale a pena verificar com honestidade se as decisões são mesmo tomadas em minutos.

**Data fabric.** Um termo promovido pela Gartner e por fornecedores. A ideia é construir, por cima dos sistemas existentes, uma camada de metadados, catálogo e acesso virtual que automatiza a descoberta, a integração e o controlo dos dados. O data fabric foca a tecnologia e os metadados, o data mesh foca a organização e a propriedade. Um não exclui o outro. Não existe "data fabric pronto a usar": é uma direção, não uma plataforma concreta.

## Comparação

| Tipo | Complexidade | Atualidade | Escala | Custo típico |
|---|---|---|---|---|
| Relatórios nos sistemas | baixa | alta | pequena | mínimo |
| Réplica ODS | baixa a média | alta | pequena a média | baixo |
| Data warehouse e data marts | média | diária ou horária | média | médio |
| Data lake | média | depende da carga | grande | baixo no armazenamento |
| Lakehouse | alta | alta | grande | médio a alto |
| Data mesh | muito alta | depende dos domínios | muito grande | alto |

## Como escolher

Comece por cinco perguntas, não pela tecnologia:

1. Quantos sistemas fonte existem e quão diferentes são?
2. Quem usa os dados: alguns gestores ou centenas de pessoas em vários departamentos?
3. Quão atuais têm de ser os dados: na manhã seguinte, de hora a hora ou em segundos?
4. Há dados não estruturados e casos de machine learning?
5. Quantas pessoas podem manter a solução? Escrevemos sobre isso em [quantas pessoas precisa o BI](/pt/insights/analytics-team-sizing/).

Escolha o nível mais simples que cubra as necessidades reais dos próximos dois ou três anos. A complexidade deve acompanhar a escala: complexidade a mais custa tanto como capacidade a menos.

## Caminho de migração

É melhor mudar de nível de forma gradual do que com um grande projeto do zero:

- De relatórios nos sistemas para ODS: comece pelo sistema mais sobrecarregado.
- De ODS para data warehouse: tire dos relatórios e passe para data marts três a cinco dos indicadores mais discutidos.
- De data warehouse para lakehouse: migre domínio a domínio, mantendo os relatórios a funcionar.
- Para data mesh: primeiro nomeie responsáveis pelos dados e regras de governação de dados, depois distribua a responsabilidade técnica.

## Erros comuns

- Escolher a arquitetura pela moda e não pela necessidade.
- Construir um data lake sem catálogo nem responsáveis pelos dados.
- Migrar relatórios antigos sem rever a lógica, com todas as diferenças incluídas.
- Lançar data mesh sem plataforma e sem regras comuns.
- Esquecer a qualidade dos dados: nenhuma arquitetura corrige erros na entrada.

## Por onde começar

Escreva de onde vêm hoje os números dos três principais relatórios de gestão e onde vive a lógica por trás deles. Em poucas horas isto mostra em que nível está e onde está o maior risco. A partir daí ajudam uma [revisão da arquitetura de dados](/pt/data-architecture/) e a implementação da [governação de dados](/pt/data-governance/). As definições dos termos usados estão no [glossário](/pt/glossary/).

Em que nível de arquitetura de dados está a sua empresa hoje?
