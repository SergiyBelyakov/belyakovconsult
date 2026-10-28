---
title: "Painel de qualidade dos dados: não esconda o problema na média"
description: Quatro indicadores no primeiro ecrã, uma matriz em vez de um número, uma meta definida pelo responsável dos dados e um relatório PDF. Com demo.
date: 2026-10-30
services: [data-quality, business-intelligence]
tags: [qualidade dos dados, painel, BI, Data Quality, demo]
---

Um painel de qualidade dos dados costuma mostrar um único número grande, e quase sempre está verde. Construí uma demo que mostra porque um número diz pouco e o que mostrar em vez dele.

A demo usa dados sintéticos: 360 registos, 12 meses, 6 regiões, 5 domínios. Coloquei lá alguns problemas de propósito, para haver o que encontrar. A lógica dos indicadores é a mesma dos projetos reais.

[Abrir a demo do painel](/pt/cases/data-quality-dashboard/){: .btn .btn-primary }

![Demo do painel de qualidade dos dados: a página Visão geral](/assets/cases/dashboard/overview-pt.webp)

## Quatro números no primeiro ecrã

Quatro indicadores chegam para o primeiro ecrã, desde que cada um tenha uma definição escrita:

- **Registos processados.** O volume dá peso à percentagem: 97% de mil registos e de um milhão afetam números de pessoas muito diferentes.
- **Qualidade dos dados.** A quota de registos válidos: soma de valid / soma de processed. Só funciona quando está escrito o que conta como válido.
- **Disponibilidade das fontes.** Se os dados chegaram de todo. Mantenho-a separada da qualidade, porque as causas e os responsáveis são diferentes.
- **Incidentes por 100 mil registos.** O número absoluto depende do tamanho do segmento; a taxa permite comparar uma região grande com uma pequena.

## A média esconde o problema

Na demo, a qualidade global é 97,55% para uma meta de 97%. Verde. Um nível abaixo, o quadro quase não muda:

| Nível de agregação | Qualidade |
| --- | --- |
| Todos os dados, ano completo | 97,55% |
| Odesa, todos os domínios | 97,43% |
| Saúde, todas as regiões | 97,41% |
| Agosto, todos os segmentos | 97,45% |
| Odesa × Saúde, ano | 96,87% |
| Odesa × Saúde, agosto | 93,80% |

A queda para 93,80% com 25 incidentes (nos meses habituais há entre 1 e 4) só aparece na última linha. O exemplo é ilustrativo, mas o mecanismo é real: cada agregação dilui o problema nos dados normais à sua volta.

É como a média de uma turma: 16 em 20 não diz que um aluno chumbou no teste. A analogia é imperfeita, porque nos dados o «aluno» são milhares de registos de um segmento, e o erro deles chega à decisão de uma só vez.

Por isso a demo tem duas coisas em vez de um número: uma matriz região × domínio colorida pelo estado e uma lista de exceções ao nível mês × região × domínio, ordenada por gravidade.

## A meta é definida pelo responsável dos dados, não pelo painel

Na demo, a meta de qualidade ajusta-se com um cursor. Com os mesmos dados, uma meta de 96% deixa abaixo 5 de 360 segmentos, 97% deixa 94 e 98% deixa 256.

O limiar muda o quadro em dezenas de vezes, por isso é uma decisão de gestão e não uma predefinição. O responsável dos dados toma-a com quem decide com base nesses dados e regista-a na metodologia.

## Fontes separadas da qualidade

Outro caso colocado de propósito: Kharkiv × Dados geoespaciais, junho. Os registos são 98,20% válidos, logo o gráfico de qualidade está todo verde. Mas a disponibilidade da fonte é 96,40% para um SLA de 99%, e a latência é 410 ms para 250 ms.

A disponibilidade média desta fonte no ano é 99,06%, formalmente acima do SLA, por isso a falha desaparece pela segunda vez. A demo tem uma página própria para as fontes: disponibilidade, latência, frequência de atualização, tipo de integração e responsável.

## Um relatório que se lê

A direção raramente abre um painel, mas lê um PDF no email. Por isso o relatório é gerado num clique com os filtros atuais: indicadores-chave, conclusões, estrutura, matriz de qualidade, exceções, estado das fontes e metodologia de cálculo.

A metodologia dentro do relatório é importante: quem não calculou o número consegue verificá-lo. O PDF é gerado no navegador e nenhum dado é enviado. Também pode carregar o seu próprio CSV no formato do exemplo.

## Como verificar o seu painel

1. Cada indicador tem uma definição escrita, incluindo o que é um «registo válido»?
2. Consegue chegar a um segmento mês × região × domínio em dois cliques?
3. Quem definiu a meta de qualidade e onde está registada?
4. Vê a disponibilidade das fontes separada da qualidade dos registos?
5. O relatório inclui uma metodologia que permita recalcular os números?

Se a resposta for «não» a duas das cinco, o painel mais tranquiliza do que controla. Mais sobre a abordagem: [qualidade de dados](/pt/data-quality/) e [Business Intelligence](/pt/business-intelligence/).

A demo está aberta: [experimente os filtros e descarregue o PDF](/pt/cases/data-quality-dashboard/). O seu painel mostra médias ou segmentos?
