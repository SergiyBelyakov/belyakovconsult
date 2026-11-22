---
title: "Equipa de BI: quantas pessoas e que competências"
description: "Como dimensionar a equipa para self-service, data warehouse, nuvem com ELT ou lakehouse no Fabric: contar o trabalho, não os cargos, e mapear funções."
date: 2026-11-23
services: [data-architecture, business-intelligence, data-governance]
tags: [equipa de análise, competências, Power BI, Microsoft Fabric, arquitetura de dados, BI]
promo:
  hook: "Quantas pessoas precisa o BI?"
  tag: "Contar o trabalho, não os cargos"
  cta: "O seu especialista de BI pode ir de férias sem pôr os relatórios em risco?"
---

No artigo sobre [quatro opções de arquitetura de BI](/pt/insights/bi-architecture-options/) comparámos self-service sobre as fontes, data warehouse clássico, warehouse na nuvem com ELT e lakehouse no Fabric. A pergunta seguinte, que as direções fazem logo depois da escolha: de quantas pessoas precisamos e quem devemos contratar?

O erro mais comum é dimensionar a equipa a partir dos cargos («precisamos de um programador de BI») ou de rácios de outras empresas. É mais fiável partir do trabalho que a equipa vai fazer e verificar à parte que nenhuma competência crítica depende de uma só pessoa.

## Em resumo

- Conte o trabalho, não os cargos. Estime a construção e a operação em separado.
- Pessoas necessárias = horas de trabalho por mês a dividir pelas horas produtivas de uma pessoa.
- Cada competência crítica deve estar em pelo menos duas pessoas, ou numa pessoa e num parceiro.
- Quanto mais complexa a arquitetura, maior a parte de engenharia e menor a parte de «só relatórios».

## Passo 1. Inventário: o que a equipa vai fazer

Antes de falar de pessoas, recolha os números que determinam a carga:

- **Fontes:** quantas, de que tipo, quão estáveis são as suas estruturas.
- **Áreas de negócio e modelos:** vendas, finanças, stocks, recursos humanos, etc.
- **Relatórios:** quantos estão ativos, quantos novos por trimestre.
- **Utilizadores e grupos de acesso:** quem deve ver o quê.
- **Frescura e disponibilidade:** com que frequência os dados são atualizados e a que horas o relatório tem de estar pronto.
- **Ritmo de mudança:** quantas medidas novas ou correções por mês.
- **Requisitos regulatórios e de auditoria:** histórico, instantâneos, registos de acesso.

## Passo 2. Construção e operação, em separado

**A construção** tem início e fim: integrações das fontes, data warehouse ou lakehouse, modelos, relatórios, segurança, ambientes, documentação.

**A operação** nunca acaba: monitorização das atualizações e incidentes, novos pedidos e alterações, acessos e apoio aos utilizadores, alterações nas fontes, plataforma e custos, qualidade dos dados.

A operação é quase sempre subestimada. Depois do arranque o trabalho não desaparece, muda de forma: em vez de construção surgem dezenas de pequenos pedidos, e são eles que consomem a equipa.

## Passo 3. A fórmula

**Pessoas necessárias (FTE) = (horas de construção por mês + horas de operação por mês) / horas produtivas de uma pessoa por mês.**

As horas produtivas não são 168 nem 160 por mês. Férias, baixas, reuniões, formação e mudanças de contexto levam uma parte considerável. O exemplo abaixo assume 130 horas; use o valor adequado à sua empresa.

## Um exemplo ilustrativo

Uma empresa ilustrativa: 6 fontes, 3 modelos por área de negócio, 25 relatórios, 150 utilizadores, arquitetura com data warehouse clássico. Todas as horas abaixo são ilustrativas e servem apenas para mostrar o método.

**Construção (6 meses)**

| Trabalho | Cálculo | Horas |
|---|---|---|
| Integrações das fontes | 6 fontes × 60 h | 360 |
| Modelos no data warehouse e no Power BI | 3 modelos × 120 h | 360 |
| Relatórios | 25 relatórios × 16 h | 400 |
| Segurança, ambientes, documentação | estimativa | 200 |
| **Total** | | **1 320, ou seja 220 por mês** |

**Operação (mensal, após o arranque)**

| Trabalho | Cálculo | Horas |
|---|---|---|
| Monitorização das atualizações e incidentes | estimativa | 40 |
| Alterações e novos pedidos | 25 relatórios × 2 h | 50 |
| Acessos e apoio aos utilizadores | 150 × 0,2 h | 30 |
| Alterações nas fontes | 6 fontes × 4 h | 24 |
| Plataforma e custos | estimativa | 10 |
| **Total** | | **154** |

**O resultado.** Durante a construção, a operação cresce aos poucos, por isso contamos metade: 220 + 77 = 297 horas por mês, cerca de 2,3 FTE. Depois do arranque ficam 154 horas, cerca de 1,2 FTE.

**O que daqui resulta.** Manter 2 ou 3 pessoas em permanência só pelo pico da construção não compensa, e uma só pessoa na operação é um risco: umas férias ou uma saída param o reporte. Uma configuração sensata para este exemplo: duas pessoas internas com competências sobrepostas, em permanência, e um parceiro durante a construção.

## Passo 4. Como a arquitetura muda o trabalho

| Arquitetura | Onde vão mais horas | Funções-chave | O que se esquece muitas vezes |
|---|---|---|---|
| Self-service sobre as fontes | relatórios e Power Query | programador de BI, responsável pelos dados no negócio | lógica duplicada entre ficheiros, acessos |
| Data warehouse clássico | integrações ETL e modelo do warehouse | engenheiro de dados, arquiteto do warehouse, programador de BI, DBA | histórico de alterações, testes |
| Warehouse na nuvem + ELT | transformações como código, plataforma | analytics engineer, engenheiro de dados, engenheiro de plataforma, programador de BI | controlo de custos, segurança |
| Lakehouse no Fabric | pipelines Spark e SQL, capacidade, modelos Direct Lake | engenheiro de dados Fabric, analytics engineer, administrador de capacidade, programador de BI | monitorização da capacidade, limites do Direct Lake, otimização das tabelas Delta |

## Funções e competências

**Responsável de produto de dados ou líder de BI.** Gere prioridades e backlog, acorda com o negócio as definições das medidas. Competências: conhecimento do negócio, gestão de requisitos, modelação de dados básica.

**Responsável pelos dados e data steward no negócio.** Não é TI. Responde pelas definições das medidas, pela qualidade dos dados e pelas regras de acesso na sua área. Sem esta função, até uma equipa técnica perfeita recebe requisitos contraditórios.

**Programador de BI.** Modelação em estrela, DAX, Power Query (M), visualização, segurança ao nível da linha, desempenho (Performance Analyzer, DAX Studio), formato PBIP e Git.

**Analytics engineer.** SQL, modelação Kimball, transformações como código (dbt ou semelhante), testes de dados, Git e CI/CD. No Fabric, também modelos semânticos.

**Engenheiro de dados.** Integrações, ETL e ELT, orquestração, Python e PySpark, cargas incrementais, monitorização e qualidade. No Fabric: pipelines, notebooks, tabelas Delta.

**Engenheiro de plataforma ou administrador.** Ambientes, segurança, redes, capacidade e custos, cópias de segurança. Na nuvem inclui o controlo de custos.

**Arquiteto de dados.** Escolhe a arquitetura, define padrões, faz revisões. Muitas vezes é uma função parcial ou um especialista externo.

Em equipas pequenas, uma pessoa acumula várias funções, por exemplo programador de BI e analytics engineer. Não há problema, desde que as competências existam de facto e não estejam só na descrição de funções.

## Matriz: que competências cada arquitetura exige

| Função | Self-service | Data warehouse clássico | Nuvem + ELT | Lakehouse no Fabric |
|---|---|---|---|---|
| Responsável de produto / líder de BI | parcial | essencial | essencial | essencial |
| Responsável pelos dados e steward | essencial | essencial | essencial | essencial |
| Programador de BI | essencial | essencial | essencial | essencial |
| Analytics engineer | não necessária | parcial | essencial | essencial |
| Engenheiro de dados | não necessária | essencial | essencial | essencial |
| Plataforma e custos | parcial | parcial | essencial | essencial |
| Arquiteto de dados | parcial | parcial | parcial | parcial |

«Parcial» significa que a função é necessária de forma pontual: pode ser acumulada com outra ou contratada externamente.

## Certificações Microsoft como referência

Um certificado não substitui a experiência, mas ajuda a escrever um anúncio de emprego ou um plano de formação. Em novembro de 2026 estão em vigor:

- **PL-300, Power BI Data Analyst:** para o programador de BI.
- **DP-600, Fabric Analytics Engineer:** preparação de dados, modelos semânticos, SQL, KQL e DAX no Fabric.
- **DP-700, Fabric Data Engineer:** para o engenheiro de dados no Fabric.

## Contratar, formar ou recorrer a um parceiro

- **Contratar** para o trabalho que vai existir sempre: operação, alterações, responsabilidade pelo modelo.
- **Formar as próprias pessoas** onde o conhecimento do negócio pesa mais do que a ferramenta. Alguém das finanças que sabe como se calcula a margem é muitas vezes mais fácil de ensinar a usar o Power BI do que explicar a um programador porque é que a margem se calcula assim.
- **Recorrer a um parceiro** no pico da construção, para competências raras (arquitetura, otimização de capacidade, auditoria de modelos) e para uma visão independente.

## Sinais de que a equipa é pequena demais

- O backlog de pedidos cresce todos os meses.
- As falhas de atualização são reportadas pela administração, não pela monitorização.
- Não há tempo para documentação nem testes.
- Uma pessoa sabe como tudo funciona e não consegue ir de férias descansada.

## Erros comuns

- Contratar só programadores de relatórios para uma arquitetura com data warehouse ou lakehouse.
- Contar só a construção e esquecer a operação.
- Não ter um responsável pelos dados do lado do negócio.
- Manter uma competência crítica numa só pessoa.

## Por onde começar

Faça o inventário do primeiro passo, estime as horas com os seus próprios números e compare o resultado com quantas pessoas trabalham de facto em análise de dados hoje. Se a diferença for grande, comece pela [arquitetura de dados](/pt/data-architecture/) e pela [governação de dados](/pt/data-governance/): são elas que determinam quanto trabalho as pessoas terão de fazer.

O seu especialista de BI pode ir de férias sem pôr os relatórios em risco?
