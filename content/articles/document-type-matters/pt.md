---
title: O tipo de documento pode ser mais importante do que o número
description: Porque o número do documento não basta para uma identificação fiável na troca de dados e o que acrescentar para que uma coincidência não se torne um erro.
date: 2026-10-29
services: [data-architecture, data-quality]
tags: [arquitetura de dados, troca de dados, identificação, qualidade de dados]
---

Quando uma troca de dados entre dois sistemas envia apenas o número do documento, a mesma sequência de dígitos pode pertencer a documentos diferentes de pessoas diferentes. O sistema vê uma correspondência e liga os registos. O erro parece um sucesso.

## Um exemplo ilustrativo de colisão

Dois registos trocam dados e a chave de correspondência é o número do documento. Os registos abaixo são fictícios, mas a situação é típica:

| Registo | Pessoa | Valor no campo "número" | Que documento é na realidade |
| --- | --- | --- | --- |
| A | Criança, nascida em 2015 | `123456` | certidão de nascimento, série noutro campo |
| B | Adulto, nascido em 1971 | `123456` | passaporte antigo, série noutro campo |

Ambos os registos estão corretos. Mas se a correspondência for feita só pelo número, a criança do registo A será "encontrada" no registo B. O que acontece a seguir depende do que o sistema faz com a correspondência: importa uma morada, verifica o direito a um apoio, conta beneficiários únicos.

## Um número sem tipo: uma casa sem rua

O número de um documento é como o número de uma porta. Quase todas as ruas têm um número 12, e sem o nome da rua a carta não chega. O tipo de documento e a série fazem o papel da rua.

A analogia tem limites: numa cidade, pelo menos os nomes das ruas não se repetem. Séries e números de tipos de documento diferentes às vezes sobrepõem-se, por isso até a "rua" precisa de ser esclarecida.

## De onde vêm as falsas correspondências

Uma coincidência de números raramente é um acaso raro. Normalmente há uma de quatro razões por trás:

- **Numerações diferentes.** Cada tipo de documento tem a sua numeração, e seis dígitos repetem-se facilmente entre tipos.
- **Série noutro campo.** O número foi enviado e a série não, ou a série está num campo separado que não entra na correspondência.
- **Zeros perdidos.** O número foi guardado como número, e `012345` passou a `12345`, que é um número completamente diferente.
- **Letras parecidas.** As letras latinas `A`, `B`, `K` parecem as cirílicas `А`, `В`, `К`, mas para o sistema são caracteres diferentes.

As duas primeiras razões criam falsas correspondências, as duas últimas criam falsas diferenças: a mesma pessoa não é encontrada nos dois registos. Em ambos os casos, o relatório conta a coisa errada.

## Que campos acrescentar à troca

Um número só se torna uma chave fiável juntamente com alguns campos ao lado:

1. **Tipo de documento** como código de uma lista de referência, e não texto livre que cada um escreve à sua maneira.
2. **Série** num campo separado, se esse tipo de documento a tiver.
3. **Número** como texto, sem espaços e sem o converter em número.
4. **Data de emissão** como verificação adicional quando os números coincidem.
5. **País de emissão** para documentos estrangeiros.

A chave de correspondência passa então a ser tipo, série e número em conjunto, depois de normalizados (retirar espaços, uniformizar letras latinas e cirílicas segundo uma regra acordada).

## Verificação do formato por tipo

A verificação "o campo não está vazio" não distingue o número de um cartão de identificação de uma data escrita no campo errado. As regras de formato têm de depender do tipo de documento. Um exemplo simplificado para documentos ucranianos:

| Tipo de documento | Regra de formato (simplificada) |
| --- | --- |
| Cartão de identificação | 9 dígitos |
| Passaporte antigo (caderneta) | 2 letras cirílicas e 6 dígitos |
| Certidão de nascimento | série e 6 dígitos |
| Documento estrangeiro | país de emissão obrigatório |

Estas regras devem correr duas vezes: na introdução dos dados e na receção através da troca. Um registo que falhe deve voltar ao remetente com o motivo, e não desaparecer em silêncio nem entrar no registo "tal como está".

## Porque isto é arquitetura e não um pormenor da interface

É tentador tratar isto como um pormenor de uma API ou de um serviço SOAP que os programadores vão corrigir. Na verdade, é uma questão do contrato da troca: que campos são obrigatórios, de que lista de referência vem o tipo, quem verifica o formato.

Se o contrato tiver um único campo "número do documento", cada sistema recetor adivinha o tipo à sua maneira. Um pelo comprimento, outro pela presença de letras, um terceiro nem tenta. Corrigir isto em cada relatório é caro e pouco fiável. Corrigir uma vez no contrato é mais barato, mesmo que várias partes tenham de acordar a alteração.

## O que fazer na prática

1. Abra a especificação da troca e verifique se o tipo de documento é enviado num campo separado.
2. Se não for, acrescente o tipo a partir de uma lista de referência e a série separada do número.
3. Descreva regras de formato para cada tipo e aplique-as na introdução e na receção.
4. Cruze dois registos duas vezes: só pelo número e pela chave completa. A diferença entre os resultados mostra o número de falsas correspondências.

O último passo demora meia hora e dá um argumento fácil de mostrar à direção: quantos registos estão hoje ligados por engano. É com argumentos assim que começa a conversa sobre [arquitetura de dados](/pt/data-architecture/).

E no seu caso: a troca envia o tipo de documento num campo separado, ou o sistema ainda o adivinha pelo comprimento do número?
