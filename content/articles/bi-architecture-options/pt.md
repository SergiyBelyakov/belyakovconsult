---
title: "Arquitetura de BI: quatro opções, prós e contras e boas práticas de Power BI"
description: "Self-service sobre as fontes, data warehouse clássico, warehouse na nuvem com ELT e lakehouse no Fabric: quando cada um faz sentido e o que compensa sempre no Power BI."
date: 2026-11-22
services: [business-intelligence, data-architecture]
tags: [BI, arquitetura de dados, Power BI, Microsoft Fabric, data warehouse, lakehouse, Direct Lake]
promo:
  hook: "4 arquiteturas de BI"
  tag: "Prós, contras e quando escolher cada uma"
  cta: "Que arquitetura está por trás dos seus relatórios hoje?"
---

Dashboards lentos, dois valores de receita diferentes em dois relatórios, receio de mexer no modelo. Normalmente não é um defeito da ferramenta. É uma consequência da arquitetura que está por trás dos relatórios.

Seguem-se as quatro opções que encontro com mais frequência: o que cada uma faz bem, o que faz mal, quando a escolher e quando a deixar para trás. Não se excluem mutuamente. As empresas costumam passar da primeira para a segunda ou terceira, e as grandes organizações vivem muitas vezes num modelo híbrido. No fim: práticas de Power BI que compensam com qualquer arquitetura.

## Em resumo

| | Self-service sobre as fontes | Data warehouse clássico | Warehouse na nuvem + ELT | Lakehouse no Fabric |
|---|---|---|---|---|
| Arranque | dias | meses | semanas ou meses | semanas ou meses |
| Escala | pequena | média a grande | grande | grande |
| Principal vantagem | rapidez | uma única versão da verdade | escala a pedido | uma só cópia dos dados, frescura |
| Principal risco | várias versões do mesmo número | mudanças lentas | a fatura cresce com o volume | novas competências, exige capacidade Fabric |
| Indicado para | um piloto, uma equipa | finanças, reporte regulatório | muitas fontes, crescimento rápido | grandes volumes no ecossistema Microsoft |

A tabela é uma orientação. Prazos e custos reais dependem do número de fontes, da sua qualidade, dos volumes e da equipa.

## 1. Self-service diretamente sobre as fontes

**Como funciona.** Um analista liga o Power BI ao ERP, ao CRM, a ficheiros Excel e ao SharePoint. Toda a preparação de dados vive no Power Query dentro do ficheiro do relatório, e cada relatório tem o seu próprio modelo.

**Prós**

- Em funcionamento em poucos dias, sem infraestrutura própria.
- O negócio vê os seus dados de imediato e percebe o que falta.
- A forma mais barata de testar se a análise de dados é sequer necessária.

**Contras**

- A lógica fica espalhada por ficheiros. A mesma medida é calculada de forma diferente em relatórios diferentes.
- As atualizações sobrecarregam os sistemas operacionais e deixam de acompanhar o crescimento dos dados.
- É difícil controlar quem vê o quê e de onde veio um número.
- O modelo depende muitas vezes de uma só pessoa.

**Quando escolher.** Um piloto, uma equipa, poucas fontes, testar uma hipótese antes de investir num data warehouse.

**Sinais de que está na altura de avançar.** Duas versões do mesmo número numa reunião. Os mesmos passos do Power Query copiados para vários ficheiros. A atualização noturna não termina até de manhã. Porque corrigir as fontes dentro do BI é má ideia está explicado à parte: [BI não deve ser o lugar onde se reparam os sistemas de origem](/pt/insights/bi-is-not-for-fixing-sources/).

## 2. Data warehouse clássico

**Como funciona.** Os dados das fontes passam por um ETL agendado (extração, transformação, carga) para um data warehouse relacional, como SQL Server ou Azure SQL. Aí ficam organizados num esquema em estrela: tabelas de factos e dimensões. O Power BI lê tabelas já preparadas.

**Prós**

- Uma única versão da verdade: as medidas são definidas uma vez, no data warehouse.
- Uma metodologia testada ao longo de décadas e muitos profissionais que a conhecem.
- O histórico é guardado, por isso o relatório do mês passado pode ser reproduzido.
- Os sistemas operacionais não sofrem com as consultas dos analistas.

**Contras**

- Cada mudança passa pela equipa de dados, por isso uma nova medida demora semanas.
- Os dados costumam ser atualizados uma vez por dia.
- Servidores próprios têm de ser mantidos e escalados à mão.

**Quando escolher.** Finanças, reporte regulatório, processos estáveis em que precisão e reprodutibilidade importam mais do que a rapidez de mudança.

## 3. Warehouse na nuvem com ELT

**Como funciona.** Os dados são primeiro carregados tal como estão para um warehouse na nuvem (Snowflake, BigQuery, Databricks SQL, Fabric Warehouse) e transformados lá dentro (ELT). As transformações são muitas vezes escritas como código, por exemplo em dbt, com testes e versões em Git.

**Prós**

- A capacidade de cálculo escala a pedido: uma consulta pesada não espera por um servidor novo.
- Transformações como código: as mudanças ficam no histórico e podem ser revistas e revertidas.
- É fácil acrescentar novas fontes, incluindo semiestruturadas.

**Contras**

- A fatura depende da carga. Sem controlo, cresce com o volume e com o número de consultas.
- Exige disciplina de engenharia: testes, revisões, monitorização.
- Os dados saem da infraestrutura própria, por isso segurança e requisitos de armazenamento têm de ser pensados.

**Quando escolher.** Muitas fontes, volumes a crescer depressa, várias equipas a consumir os mesmos dados.

## 4. Lakehouse no Microsoft Fabric

**Como funciona.** Os dados ficam no OneLake, no formato aberto Delta, e passam por camadas: Bronze (brutos), Silver (limpos), Gold (prontos para análise). O Power BI lê as tabelas Gold em modo Direct Lake: o motor VertiPaq carrega os dados das tabelas Delta para memória sem uma cópia separada, como no modo Import.

**Prós**

- Uma só cópia dos dados para engenheiros, analistas e relatórios.
- Uma atualização em Direct Lake copia apenas metadados, por isso demora segundos em vez de horas.
- Velocidade de consulta próxima do modo Import em grandes volumes.

**Contras**

- O Direct Lake só funciona em capacidade Fabric (F SKU). A Microsoft já não vende novas capacidades Power BI Premium (P SKU), por isso as novas implementações vão para F SKU.
- Há limites por tamanho de capacidade: linhas por tabela, tamanho do modelo. O Direct Lake através do endpoint SQL passa para DirectQuery, mais lento, quando são ultrapassados; o Direct Lake sobre OneLake não passa, e as consultas falham até as tabelas serem otimizadas.
- Algumas funcionalidades do modelo (por exemplo colunas e tabelas calculadas) são limitadas ou ainda estão em pré-visualização.
- A equipa precisa de novas competências: Spark ou SQL no Fabric, Delta, gestão de capacidade.

**Quando escolher.** Grandes volumes, ecossistema Microsoft, necessidade de dados frescos sem importações longas. A própria Microsoft recomenda começar com um protótipo para confirmar se o Direct Lake serve o seu modelo.

## Como escolher: cinco perguntas

1. **Quantas fontes há e a que ritmo crescem?** Duas ou três fontes estáveis raramente precisam de escala na nuvem.
2. **Quão frescos têm de ser os dados?** Se as decisões são semanais, dados ao minuto só acrescentam custo.
3. **Quem vai manter a solução?** Uma arquitetura que ninguém consegue suportar é pior do que uma mais simples.
4. **Quão reprodutíveis têm de ser os números?** O reporte financeiro e regulatório precisa de histórico e de instantâneos, não só do estado atual.
5. **O que já existe na empresa?** Licenças Microsoft 365 e Power BI tornam o Fabric um passo natural; uma equipa de dbt já existente torna natural um warehouse na nuvem.

Se ainda está a escolher a plataforma e não a arquitetura, comece pelo [mapa de comparação de plataformas de BI](/pt/insights/which-bi-platform-to-choose/).

## Modos de ligação do Power BI: quando usar cada um

| Modo | Prós | Contras | Quando usar |
|---|---|---|---|
| Import | consultas mais rápidas, DAX completo | dados frescos só depois da atualização, limites de tamanho | por defeito para a maioria dos relatórios |
| DirectQuery | sempre atual, sem cópia | cada interação consulta a fonte, mais lento | dados muito grandes ou muito frescos quando o Import é impossível |
| Direct Lake | velocidade próxima do Import, atualização em segundos | só no Fabric, limites de capacidade | lakehouse ou warehouse no Fabric |
| Modelo composto | combina Import e DirectQuery | mais difícil de configurar e manter | uma tabela de factos grande com dimensões ou agregações rápidas |
| Ligação dinâmica | um conjunto de dados partilhado para muitos relatórios | o relatório não altera o modelo | relatórios finos sobre um modelo partilhado |

## Práticas de Power BI que compensam com qualquer arquitetura

**Modelo**

- **Esquema em estrela.** Tabelas de factos e dimensões, relações um-para-muitos num só sentido. Relações bidirecionais apenas onde não há alternativa.
- **Uma tabela de datas própria**, marcada como tabela de datas.
- **Medidas em DAX, não colunas calculadas.** As colunas calculadas aumentam o modelo e só são calculadas na atualização.
- **Menos colunas, menor cardinalidade.** Retire o que nenhum relatório usa; separe data e hora; não traga identificadores únicos sem motivo.

**Preparação de dados**

- **Transformar o mais perto possível da fonte.** O que pode ser feito no data warehouse pertence lá, não ao Power Query.
- **Query folding.** Confirme que os passos do Power Query são executados do lado da fonte, sobretudo filtros e junções.
- **Atualização incremental** para tabelas de factos grandes: só os períodos novos são atualizados.

**Modelo partilhado e relatórios**

- **Um modelo semântico partilhado por área de negócio** e relatórios finos por cima. Assim cada medida é definida uma só vez.
- **Endosse os modelos de confiança** como certificados ou promovidos, para que os utilizadores saibam em que se apoiar.
- **Segurança ao nível da linha (RLS)** no modelo, e não cópias de relatórios para diferentes departamentos.

**Desenvolvimento e publicação**

- **Formato Power BI Project (PBIP) e TMDL em Git.** O modelo e o relatório ficam guardados como ficheiros de texto e as alterações aparecem no histórico. A Microsoft anunciou a disponibilidade geral do TMDL.
- **Áreas de trabalho separadas para desenvolvimento, teste e produção**, com pipelines de implementação entre elas.
- **Verificação da qualidade do modelo** com ferramentas como o Best Practice Analyzer do Tabular Editor, e do desempenho com o Performance Analyzer e o DAX Studio.

**Operação**

- **Monitorize a capacidade** (a aplicação Fabric Capacity Metrics) e as atualizações: as falhas devem ser vistas por si, não pela administração de manhã.
- **Um responsável por cada modelo e uma breve descrição de cada medida.** Sem isso, até um modelo correto se torna uma caixa negra ao fim de um ano.

## Erros comuns

- Comprar uma nova ferramenta de BI na esperança de que corrija os números. Não corrige: é uma questão da base de dados, não da ferramenta.
- Passar para DirectQuery «para ter dados frescos» sem verificar se a fonte aguenta a carga.
- Construir um lakehouse para três ficheiros Excel.
- Deixar um data warehouse sem responsáveis pelas medidas: tecnicamente uma única versão da verdade, na prática várias definições.

## Por onde começar

Olhe para os seus relatórios e responda com honestidade: quantos modelos calculam a mesma receita e consegue reproduzir o número que mostrou no mês passado? Se há vários modelos e não consegue, o passo seguinte não é um novo dashboard, mas [arquitetura de dados](/pt/data-architecture/) e um modelo partilhado para [business intelligence](/pt/business-intelligence/).

Quantas pessoas e que competências cada uma destas arquiteturas exige está explicado à parte: [Equipa de BI: quantas pessoas e que competências](/pt/insights/analytics-team-sizing/).

Que arquitetura está por trás dos seus relatórios hoje?
