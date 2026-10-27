---
title: Porque mudou o relatório do mês passado
description: Registos tardios e mudanças de estado reescrevem relatórios passados. Como acordar uma data de corte e mostrar revisões.
date: 2026-11-16
services: [data-architecture, business-intelligence]
tags: [arquitetura de dados, BI, data de corte, relatórios]
---

Uma situação ilustrativa. A 5 de novembro mostra à direção um relatório: 1 240 novos pedidos em outubro. A 20 de novembro alguém abre o mesmo relatório para o mesmo outubro e vê 1 287. Ninguém mexeu nas fórmulas, o dashboard funciona, não há erros.

O relatório simplesmente recalcula outubro sempre que é aberto. E, nos dados, outubro continua a mudar muito depois de ter terminado no calendário.

## Porque é que o passado muda nos dados

As causas típicas, todas perfeitamente legítimas:

- **Registos tardios.** Um pedido foi apresentado a 28 de outubro, mas introduzido no sistema a 12 de novembro. Pertence a outubro, e outubro "cresceu".
- **Correções retroativas.** Um operador encontrou uma data errada e corrigiu-a. O registo passou de setembro para outubro ou ao contrário.
- **Mudanças de estado.** Um pedido "aprovado" a 5 de novembro passou a "recusado" a 20 de novembro. Já não aparece no relatório de pedidos aprovados.
- **Fusão de duplicados.** Depois da limpeza, três registos da mesma pessoa passaram a um, e os números passados diminuíram.
- **Alterações nas tabelas de referência.** Uma unidade passou para outra região, e todo o seu histórico foi com ela.

Nenhuma destas mudanças é um erro. O erro está noutro lado: o relatório não sabe que o passado mudou, e ninguém consegue dizer qual dos dois números é o "certo".

## Saldo da conta e extrato

A maioria dos sistemas operacionais guarda o estado atual: qual é agora o estado do pedido, a que região pertence agora a unidade. Um relatório sobre um período passado filtra esse estado atual por data e, por isso, obtém sempre um resultado ligeiramente diferente.

É como olhar para o saldo da conta para saber quanto dinheiro tinha há um mês. O saldo mostra apenas o "agora". Para o passado é preciso o extrato: o que aconteceu e quando.

A analogia tem limites. Num banco, uma operação do mês passado quase nunca é alterada retroativamente, enquanto nos registos isso é trabalho corrente. Por isso os dados precisam não só de um extrato, mas também de memória sobre quando exatamente algo foi corrigido.

## O que acrescentar à arquitetura de dados

Três coisas costumam resolver o problema:

1. **Um instantâneo (snapshot) na data de corte.** Uma cópia dos dados de que o relatório precisa, tal como estavam quando foi produzido. O relatório de outubro é construído sobre o instantâneo, não sobre a tabela viva.
2. **Duas datas em cada registo.** A data do evento (quando o pedido foi apresentado) e a data de introdução ou alteração (quando soubemos dele). Sem a segunda data, um registo tardio parece igual a qualquer outro.
3. **Números publicados guardados à parte.** O número mostrado à direção ou aos parceiros fica guardado com a data de publicação e a versão. Pode ser reproduzido um ano depois.

Não tem de ser um grande data warehouse. Para um ou dois indicadores-chave, basta uma tabela de instantâneos preenchida uma vez por mês.

## Acordar a data de corte

A parte técnica não funciona sem um acordo. Alguém tem de decidir:

- em que data se calcula o relatório mensal, por exemplo no quinto dia útil após o fim do mês;
- o que acontece às alterações que chegam depois dessa data: ignorar, passar para o mês corrente ou publicar uma revisão;
- quem decide rever um número publicado.

Sem este acordo, cada analista escolhe a sua data, e voltamos a ter dois números certos, mas diferentes.

## Mostrar revisões com honestidade

Um número publicado nunca deve mudar em silêncio. Se os dados de um período passado mudaram de forma visível, mostre duas colunas, "publicado" e "agora", com uma frase de explicação. Por exemplo: "+47 pedidos introduzidos após a data de corte". Os números do exemplo são ilustrativos, mas o formato funciona exatamente assim.

Ajuda acordar um limiar com antecedência: que diferença exige uma revisão oficial e qual é apenas registada.

## Se ainda não tem instantâneos

Pode começar sem nova infraestrutura. Se os registos já têm data de introdução, o relatório pode aproximar-se do "como era": contar apenas os registos introduzidos até à data de corte. Assim elimina pelo menos os registos tardios e vê quantos são na realidade.

Este truque tem um limite. Não devolve o estado antigo de um pedido nem desfaz a fusão de duplicados, porque a tabela atual só se lembra da última versão do registo. Por isso, para indicadores de que dependem pagamentos ou decisões da direção, substitua depressa o filtro temporário por um instantâneo verdadeiro.

E um pormenor prático: escreva no próprio relatório a data a que os dados se referem. Uma frase no fundo da página elimina metade das perguntas "porque é que o vosso número é diferente".

## Verifique no seu caso

Pegue num indicador-chave do mês passado que já tenha mostrado. Calcule-o hoje com o mesmo relatório e compare com o publicado. Se os números forem diferentes, tente explicar a diferença. Se não conseguir explicá-la nem reproduzir o número publicado, precisa de um instantâneo e de uma data de corte. É uma questão de [arquitetura de dados](/pt/data-architecture/), não de mais uma correção no relatório.

E na sua equipa, quem decide em que data se calcula o relatório mensal?
