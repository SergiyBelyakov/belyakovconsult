---
title: Três níveis de qualidade de dados para registos públicos
description: O que a ISO 8000-8 diz sobre qualidade sintática, semântica e pragmática e porque os registos precisam das três.
date: 2026-10-29
services: [data-quality, data-governance]
tags: [qualidade de dados, ISO 8000, registos, setor público]
---

Um relatório de qualidade de dados de um registo resume-se muitas vezes a duas perguntas: o campo está preenchido e o formato está correto? Ambas importam. Mas um valor pode passar todas as verificações de formato e, mesmo assim, levar a uma decisão errada: sobre um pagamento, sobre o direito a um serviço, sobre a distribuição de fundos.

A norma ISO 8000-8 (Data quality, parte 8: conceitos de qualidade da informação e dos dados e a sua medição) propõe olhar para a qualidade em três níveis. Para os registos públicos, que sustentam decisões administrativas e a troca de dados entre organismos, esta distinção tem um preço prático.

## Os três níveis descritos pela ISO 8000-8

A norma distingue três tipos de qualidade dos dados:

- **Qualidade sintática.** Até que ponto os dados respeitam a sintaxe definida: formato, estrutura, codificação. Uma data está guardada como data, um código tem o número certo de caracteres, um ficheiro de troca respeita o esquema.
- **Qualidade semântica.** Até que ponto os dados correspondem ao que devem representar. Para isso são precisos metadados definidos de forma explícita ou uma referência a uma lista de códigos: o que significa exatamente o campo e de que lista vêm os valores.
- **Qualidade pragmática.** Até que ponto os dados são adequados ao propósito de quem os usa. Esta pergunta não se dirige ao formato nem à lista de códigos, mas à decisão tomada com esses dados.

A qualidade sintática e a semântica podem ser verificadas face a uma especificação ou a uma referência, muitas vezes de forma automática. A pragmática não se avalia sem os utilizadores dos dados: só eles sabem o que é suficiente para a sua decisão.

## Um registo, três respostas diferentes

Um exemplo ilustrativo (os registos são fictícios). Um registo de beneficiários de apoios tem o campo "comunidade de residência", com um código de uma classificação.

| O que está no campo | Sintaxe | Semântica | Pragmática |
| --- | --- | --- | --- |
| `UA-02-123`, comunidade do requerente, atualizado há um mês | sim | sim | sim |
| `UA-02-132`, comunidade vizinha (dígitos trocados) | sim | não | não |
| `UA-02-123`, mas a pessoa mudou-se há um ano | sim | sim no momento do registo | não para um pagamento |
| `0` | não | não | não |

Uma verificação de formato deixa passar as três primeiras linhas. Uma verificação de completude deixa passar as quatro. Para uma decisão de pagamento, só a primeira serve.

É como uma morada num envelope. O código postal pode ter o número certo de dígitos (sintaxe), mas pertencer a outra cidade (semântica). E mesmo uma morada correta não ajuda se a pessoa já lá não vive (pragmática). A analogia tem limites: os correios devolvem a carta, enquanto um registo toma uma decisão em silêncio com base num registo errado.

## Porque as verificações de formato não chegam

A maioria dos registos controla bem a sintaxe: máscaras de introdução, campos obrigatórios, esquemas de troca. É a parte mais fácil de automatizar, por isso é normalmente aí que acaba a conversa sobre qualidade.

Os problemas com custo real vivem mais vezes nos outros dois níveis:

- **Semântica.** Um código com formato válido, mas de outra classificação ou de outra versão. Um campo "data" significa a data do pedido num sistema e a data da decisão noutro. Na troca de dados entre registos, estas diferenças não se veem, porque o formato coincide.
- **Pragmática.** Os dados estão corretos, mas desatualizados para uma decisão concreta. Ou têm precisão ao nível da comunidade quando a decisão precisa de uma morada. Ou são atualizados uma vez por ano, enquanto as decisões são mensais.

A completude, sobre a qual escrevi antes, é apenas o primeiro passo do nível sintático: verifica se existe alguma coisa no campo.

## Os limiares são definidos pelo responsável do registo

Um pormenor importante: a ISO 8000-8 não define escalas nem limiares prontos. A norma dá conceitos e pré-requisitos para a medição, e a organização define o limiar de cada objeto medido de acordo com as suas necessidades, indicando a escala que usa.

Para um registo, isto significa que a "qualidade suficiente" não aparece sozinha. Alguém tem de decidir que proporção de registos com comunidade confirmada é aceitável para um pagamento e qual chega para um relatório estatístico. Naturalmente, essa decisão cabe ao responsável do registo ou ao seu gestor de dados, em conjunto com quem decide com base nesses dados.

## Como é a implementação

Não é preciso começar pelo registo inteiro. Bastam alguns campos críticos dos quais dependem decisões ou trocas de dados:

1. **Sintaxe.** Escreva a especificação do formato: tipo, comprimento, máscara, caracteres permitidos. Verifique na introdução e na troca de dados.
2. **Semântica.** Dê ao campo uma definição em palavras, ligue-o a uma lista de códigos ou classificação com versão e verifique os valores face a ela.
3. **Pragmática.** Identifique a decisão para a qual o campo é necessário e quem a toma. Em conjunto, defina o limiar e a escala, por exemplo a antiguidade máxima dos dados.
4. **Medição.** Calcule os resultados com regularidade, separadamente para cada nível, e não como uma única percentagem global.
5. **Correção.** Os erros corrigem-se na origem, onde foram introduzidos, e não no próximo relatório.

O resultado parece modesto: uma tabela com alguns campos e três colunas. Mas mostra onde se pode confiar no registo para decidir e onde, por agora, apenas para um relatório. Isto é trabalho de [qualidade de dados](/pt/data-quality/), e não das suas percentagens.

## Verifique um campo

Escolha um campo de que dependa um pagamento ou o direito a um serviço e responda a três perguntas. Existe uma especificação de formato escrita? Existe uma definição e uma lista de códigos com a qual os valores são comparados? Sabe para que decisão o campo é usado e que nível de qualidade é suficiente?

Onde a resposta for "não sei", é aí que deve começar. O seu registo já mede a adequação dos dados às decisões ou, por agora, apenas o formato?
