---
title: 98% de completude não significa 98% de qualidade
description: Porque uma completude elevada diz pouco sobre se os dados de um registo são utilizáveis e que verificações mostram a qualidade real.
date: 2026-10-28
services: [data-quality, data-governance]
tags: [qualidade de dados, registos, setor público]
---

Os relatórios de qualidade de dados começam muitas vezes pela completude: o campo "número do documento" está preenchido em 98% dos registos. O número tranquiliza. Mas responde apenas a uma pergunta: existe alguma coisa no campo?

## O que se esconde atrás de "preenchido"

Um exemplo ilustrativo de um registo de beneficiários de serviços (os registos são fictícios):

| Valor no campo | Preenchido? | Utilizável? |
| --- | --- | --- |
| `AB123456` | sim | sim |
| `AB 123456` | sim | depois de normalizado |
| `123456`, série noutro campo | sim | só em conjunto com esse campo |
| `0` ou `-` | sim | não |
| `12.03.2019` em vez de um número | sim | não |

Os cinco registos contam para os 98%. Mas só parte deles serve para cruzar com outro registo, encontrar duplicados ou verificar o direito a um pagamento.

## A completude é a primeira verificação, não uma medida de qualidade

Problemas típicos que a completude não vê:

- **Formato.** Datas em vários formatos, números com e sem espaços, letras latinas em vez de cirílicas na série.
- **Valores admitidos.** A lista de referência prevê dois valores, mas os dados têm seis.
- **Marcadores de preenchimento.** "0", "-", "desconhecido", "01.01.1900" preenchem formalmente o campo.
- **Campo usado para outra coisa.** A série do documento no campo do número, um comentário no campo da morada.
- **Coerência entre campos.** Um documento emitido antes da data de nascimento do titular.
- **Unicidade.** O mesmo número de documento para pessoas diferentes.

## Que verificações usar em vez de uma única percentagem

Comece pela decisão tomada com estes dados, não pela métrica. Se o campo serve para cruzar com outro registo, importam o formato, o tipo de documento e a unicidade. Se dele depende um pagamento, importam os valores admitidos e a coerência com outros campos.

Depois, para cada campo crítico:

1. Escreva a regra de negócio em palavras simples.
2. Transforme-a numa verificação que corre regularmente, e não só uma vez antes do relatório.
3. Conte a percentagem de registos que passam a verificação, separadamente da completude.
4. Para os registos que falham, defina quem corrige o erro na origem, e não no relatório.

## Como mostrar isto à direção

Em vez de um número, mostre duas colunas: "preenchido" e "utilizável". A diferença entre elas é o volume real de trabalho. Também mostra onde a conclusão de um relatório pode estar distorcida: cobertura, número de beneficiários únicos, montante pago.

Quando a diferença é grande, o problema raramente está na análise. O mais comum é faltarem regras de introdução de dados e alguém responsável pelo campo. É aí que começa a [governação de dados](/pt/data-governance/).

Uma pergunta para si: no seu registo principal, sabe não só a completude, mas também a percentagem de registos utilizáveis?
