---
title: A governação de dados aparece quando os números entram em conflito
description: Duas equipas apresentam números diferentes e ambas têm razão. O que esse momento revela sobre a governação de dados e as quatro perguntas para começar.
date: 2026-10-26
services: [data-governance, data-quality]
tags: [governação de dados, setor público, indicadores]
---

Imagine uma reunião de direção (o exemplo é ilustrativo, mas familiar). É apresentado o número de beneficiários de um serviço no trimestre. Uma equipa traz 41 200, outra 38 900. Os dois relatórios foram feitos com cuidado, as fórmulas estão verificadas e não há erros de cálculo.

É neste momento que se percebe se a organização tem governação de dados. Não quando se aprova uma política, mas quando dois números corretos não coincidem.

## Porque é que os dois números podem estar certos

A diferença quase nunca é de aritmética. Normalmente as equipas contam coisas ligeiramente diferentes sem dar por isso, porque lhes dão o mesmo nome.

- **Definição diferente.** Uma conta pessoas, a outra conta pedidos. Quem fez dois pedidos aparece uma vez num relatório e duas no outro.
- **Data de referência diferente.** Uma usa a situação no fim do trimestre, a outra o dia em que o relatório foi produzido. Entretanto, alguns registos mudaram.
- **Fonte diferente.** Uma usa o registo oficial, a outra a sua folha de cálculo de trabalho, que recebe os dados com atraso ou depois de verificações manuais.
- **Regras de limpeza diferentes.** Uma remove duplicados e registos de teste, a outra não.

Cada uma destas opções é razoável por si só. O problema é que ninguém decidiu qual delas é a regra para toda a organização.

## Um jogo com dois árbitros

É como um jogo de futebol com dois árbitros, cada um com o seu livro de regras. Ambos apitam honestamente segundo as suas regras, mas o resultado é diferente. Discutir qual é o melhor árbitro não adianta: primeiro é preciso acordar as regras.

A analogia tem limites. No futebol as regras são escritas fora do campo, enquanto uma organização tem de escrever as suas, muitas vezes a meio da época e com prazos de reporte à porta.

A esse acordo chamamos governação de dados (Data Governance): quem define as regras para os dados, quem garante que são cumpridas e o que acontece quando as regras se contradizem.

## Quatro perguntas para começar

A governação de dados é muitas vezes imaginada como um regulamento extenso. Na prática começa com quatro perguntas simples para cada indicador ou conjunto de dados crítico:

1. **Quem define a regra?** Quem decide o que exatamente se conta: pessoas ou pedidos, em que data, com que exceções.
2. **Qual é a fonte oficial?** De onde vem o número que pode ser mostrado à direção, aos parceiros e aos financiadores.
3. **Quem corrige um erro?** Quando se encontra um problema, quem é responsável por corrigi-lo na origem e não no próximo relatório.
4. **Quem aprova uma alteração?** Se a definição tiver de mudar, quem decide e como é que quem produz os números fica a saber.

Se alguém na reunião acima conseguir responder a estas perguntas num minuto, o conflito termina nesse mesmo minuto. Caso contrário, vai repetir-se todos os trimestres.

## Papéis que mantêm as respostas no lugar

As respostas têm de estar ligadas a pessoas concretas, senão desaparecem na primeira rotação de equipa. Normalmente bastam quatro papéis:

- **Proprietário dos dados (data owner).** O responsável de uma área que garante que os dados servem as suas decisões. Aprova definições e alterações.
- **Curador dos dados (data steward).** A pessoa que conhece no dia a dia como os dados funcionam, mantém as definições, deteta discrepâncias e prepara propostas de alteração.
- **Responsável técnico (data custodian).** A equipa que mantém o sistema ou o registo e implementa tecnicamente as regras acordadas.
- **Utilizador dos dados.** Analistas, equipas de reporte, parceiros. Usam os dados segundo as regras e avisam quando algo não bate certo.

Numa organização pequena, uma pessoa pode acumular vários papéis. O importante é que, para cada indicador crítico, se saiba quem é o proprietário e quem é o curador.

## Um procedimento mínimo quando os números não coincidem

Não é preciso um regulamento completo para resolver um conflito concreto:

1. Coloque os dois números lado a lado e registe em que diferem a definição, a data de referência, a fonte e as regras de limpeza.
2. Identifique o proprietário do indicador. Se não existir, designe-o por decisão da direção.
3. O proprietário escolhe uma definição e uma fonte oficial. A decisão fica registada por escrito, com data.
4. O curador atualiza a descrição do indicador para que o próximo relatório seja calculado da mesma forma.
5. Todos os que produzem este indicador recebem uma nota curta sobre a nova regra.

Depois de alguns conflitos resolvidos assim, o regulamento aparece. Só que vai descrever decisões reais e não a intenção de as tomar um dia.

## Experimente com o seu exemplo

Pense na última vez que os seus números não coincidiram: numa reunião, num relatório para um parceiro, numa resposta a um pedido. Tente responder às quatro perguntas deste artigo para esse indicador.

Onde a resposta soar a "depende de a quem se pergunta" ou "não é claro", é aí que a [governação de dados](/pt/data-governance/) deve começar. Normalmente trata-se de um ou dois indicadores, não do sistema inteiro.
