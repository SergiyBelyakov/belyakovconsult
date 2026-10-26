---
title: "Uma pessoa, três registos: de onde vêm os duplicados"
description: Porque é que uma pessoa aparece várias vezes num registo, como os duplicados distorcem contagens e pagamentos e onde devem ser corrigidos.
date: 2026-11-09
services: [data-quality, data-governance]
tags: [qualidade de dados, registos, duplicados, setor público]
---

O registo mostra três beneficiários de um serviço. Na realidade é uma só pessoa: Olena Petrenko, introduzida três vezes. Uma vez corretamente, outra com um ponto a mais depois do nome e outra com uma grafia latina diferente, porque é assim que se faz noutro balcão. O exemplo é ilustrativo, mas vejo isto em quase todos os registos com que trabalho.

## De onde vêm os duplicados

Um duplicado raramente nasce de descuido. Mais vezes é consequência da forma como o processo está montado.

- **Erros de introdução.** Um espaço a mais, um ponto, letras trocadas. Para uma pessoa é o mesmo registo, para o sistema é um novo.
- **Transliteração.** O mesmo apelido pode escrever-se em alfabeto latino de várias formas. Petrenko, Petrenco, Petrenka: cada versão é formalmente diferente.
- **Um documento novo.** A pessoa mudou de passaporte, de apelido depois do casamento ou recebeu um cartão de identificação. Ninguém encontrou o registo antigo, por isso criou-se um novo.
- **Vários pontos de entrada.** Um pedido online, um balcão de atendimento, uma importação de um sistema vizinho. Cada canal cria registos à sua maneira e ninguém verifica se a pessoa já existe.

## O que distorcem

O mais evidente: a contagem. Se 10% de um registo forem duplicados, um relatório de cobertura fica inflacionado mais ou menos na mesma proporção, e esse número é depois comparado com o plano.

Fica pior quando há dinheiro associado ao registo. Dois registos da mesma pessoa podem receber dois pagamentos. Ou o contrário: o pagamento está ligado ao registo antigo, enquanto a pessoa já chega pelo novo e ouve que não lhe é devido nada.

É como uma agenda de telefone onde a mesma pessoa está gravada como "Olena", "Olena trabalho" e "O. Petrenko". Ligar é incómodo, mas vive-se com isso. (A analogia tem limites: o telefone não transfere dinheiro para cada contacto.)

## Como encontrar duplicados prováveis

Comparar registos só pelo nome não chega: pessoas diferentes têm o mesmo nome. Comparar só pelo número do documento também não: os documentos mudam. Por isso a pesquisa usa uma chave construída a partir de vários campos:

1. Apelido e nome depois de normalizados: sem espaços nem pontos, com uma única regra de transliteração.
2. Data de nascimento.
3. Número do documento sem série nem separadores.
4. Um número fiscal ou outro identificador estável, se existir.

Uma correspondência exata da chave encontra os duplicados óbvios. Para os restantes usa-se correspondência aproximada (fuzzy matching): um algoritmo avalia a semelhança entre dois registos e sugere os pares com pontuação alta.

Sugere, não decide. Eu não juntaria registos automaticamente: fundir por engano duas pessoas diferentes é muito mais difícil de desfazer do que encontrar um duplicado. Os pares com pontuação alta são revistos por alguém que conhece o processo.

## A decisão principal: qual é o registo mestre

Encontrar um duplicado é fácil. Decidir o que fazer com ele é mais difícil. Para isso são precisas regras, não um botão "juntar":

- Que registo fica como registo mestre (master record) e com que critério: o mais antigo, o mais completo, o confirmado por documento.
- O que acontece ao histórico de pagamentos e serviços ligado aos outros registos.
- Quem aprova uma fusão quando há dinheiro em jogo.
- Como os outros sistemas que guardam referências ao registo antigo ficam a saber da alteração.

É uma questão de governação de dados, não apenas técnica. Sem um responsável pelos dados, a limpeza de duplicados transforma-se numa discussão sobre qual registo é o mais correto.

## Porque é que a correção deve ser feita na origem

O erro mais comum é eliminar duplicados no relatório. Todos os meses um analista escreve mais uma regra de limpeza, o relatório fica certo e o registo continua igual. No mês seguinte tudo se repete, e a regra fica um pouco mais complicada.

Verificar na introdução é muito mais barato. Quando um operador introduz uma pessoa nova, o formulário procura registos semelhantes com a mesma chave e mostra-os: "Já existe um registo semelhante. É a mesma pessoa?" Essa verificação funciona uma vez e de vez, não todos os meses.

## O que é melhor não fazer

Algumas abordagens parecem sensatas, mas costumam piorar as coisas:

- **Apagar duplicados.** Um registo apagado leva consigo o histórico: pedidos, decisões, pagamentos. É melhor marcá-lo como fundido e manter uma referência ao registo mestre.
- **Confiar num único campo.** "Se o número fiscal coincide, é a mesma pessoa" funciona até entrarem zeros ou o número de outra pessoa nesse campo. Uma chave de vários campos é mais robusta.
- **Limpar uma vez por ano num grande projeto.** Depois da limpeza os duplicados voltam a acumular-se ao mesmo ritmo, se a origem não mudou.

Cada uma destas abordagens dá um resultado rápido no relatório. E cada uma adia o problema real: um processo que cria novos duplicados todos os dias.

## Verifique nos seus dados

Pegue no seu registo principal e conte dois números: o número de registos e o número de pessoas únicas segundo uma chave de vários campos. Se o segundo for visivelmente menor, encontrou não só um problema de [qualidade de dados](/pt/data-quality/), mas também um ponto onde os relatórios de cobertura dizem mais do que existe na realidade.

Sabe quantas pessoas no seu registo têm mais do que um registo?
