---
title: BI não deve ser o lugar onde se reparam os sistemas de origem
description: Porque limpar e reconstruir dados dentro do Power BI torna os relatórios frágeis e que parte desse trabalho deve passar para o modelo de dados.
date: 2026-11-05
services: [business-intelligence, data-architecture]
tags: [Power BI, modelo de dados, BI, arquitetura de dados]
---

Se o Power BI limpa nomes, reconstrói tabelas de referência e recria lógica que não existe na origem em cada atualização, o relatório fica frágil. Funciona até que algo mude na origem. Parte desse trabalho pertence ao modelo de dados e às regras de preparação, e outra parte deve voltar ao sítio onde os erros aparecem.

## Como é um BI que "trata" as origens

Um exemplo ilustrativo, mas muito reconhecível. Um relatório sobre beneficiários de serviços é construído a partir de um registo. No Power Query (o editor de preparação de dados do Power BI) há várias dezenas de passos: retirar espaços no início dos nomes, juntar "Cidade de Lisboa", "Lisboa" e "LISBOA" num só valor, ir buscar códigos de distrito a um ficheiro à parte, excluir registos de teste pela palavra "teste" no apelido.

O relatório mostra números bonitos. Mas repare nos sinais:

- **Dezenas de passos de substituição de valores.** Cada atualização corrige outra vez os mesmos erros, porque ninguém os corrigiu na origem.
- **Uma tabela de correspondências em Excel.** A tabela "como estava, como deve ficar" vive ao lado do relatório, muitas vezes com um nome como `mapping_final_v3.xlsx`. Não tem dono além do autor do relatório.
- **A mesma limpeza em vários relatórios.** Cada analista escreve a sua versão, ligeiramente diferente. Uma origem, dois números na reunião.
- **As definições dos indicadores vivem em DAX** (a linguagem de fórmulas do Power BI). Quem conta como beneficiário, que estado é ativo, em que data contamos: quem decide é uma medida no relatório, não uma regra acordada.
- **A atualização falha na segunda de manhã** porque alguém mudou o nome de uma coluna na origem ou acrescentou uma nova grafia.

Se reconhece dois ou três destes sinais, o relatório assenta num ficheiro e numa pessoa.

## Porque é frágil

É como uma mancha no teto causada por um telhado com infiltrações. Pode pintá-la todos os meses e o teto parecerá arrumado. Mas o telhado continua a deixar entrar água, e a tinta custa sempre.

A analogia tem limites: todos veem a mancha no teto, enquanto uma correção no Power Query só é visível para o autor do ficheiro. E cada divisão é pintada com a sua própria tinta, ou seja, cada relatório limpa os dados à sua maneira.

Daqui resultam quatro consequências práticas:

1. **O erro na origem vive para sempre.** Quem introduz os dados nunca fica a saber que os introduz mal.
2. **Relatórios diferentes dão números diferentes**, porque a limpeza em cada um é ligeiramente diferente.
3. **O conhecimento fica numa só pessoa.** Umas férias ou uma saída, e o relatório transforma-se numa caixa negra.
4. **A atualização torna-se lenta e imprevisível**, porque a preparação pesada corre sempre em cada relatório.

## O que deixar no Power Query e o que tirar de lá

Não é preciso tirar tudo. Uma pergunta ajuda: mais alguém, além deste relatório, usa esta regra?

**Deixar no BI:**

- formatação, rótulos, ordem das categorias nos visuais;
- filtros que dizem respeito apenas a este relatório;
- pequenas transformações de uma tabela para um gráfico concreto;
- medidas que descrevem a apresentação, não a definição de um indicador.

**Passar para o modelo de dados e para a camada de preparação:**

- normalização de valores: nomes, maiúsculas, formatos de datas e números;
- tabelas de correspondências, numa tabela com dono e não no ficheiro de alguém;
- deteção e tratamento de duplicados;
- definições dos indicadores: quem é beneficiário, que estado é ativo, qual a data de referência;
- ligação de dados de sistemas diferentes.

**Devolver à origem:**

- erros que se repetem em cada carregamento. Devem ser corrigidos onde os dados são introduzidos: uma regra no formulário, uma lista de referência em vez de texto livre, uma verificação no momento da introdução.

## Um exemplo ilustrativo de camadas de preparação

O esquema abaixo não está ligado a uma ferramenta concreta. Pode ser uma base de dados, os dataflows do Power BI ou um armazém de dados à parte. A ordem importa mais do que a tecnologia.

1. **Camada bruta.** Uma cópia dos dados da origem tal como vêm, com a data de carregamento. Aqui não se corrige nada, para se poder sempre verificar o que chegou.
2. **Camada limpa.** Tipos, formatos e valores normalizados. As tabelas de correspondências ligam-se aqui, e cada uma tem um dono.
3. **Camada de lógica de negócio.** Definições dos indicadores e as tabelas de onde saem os relatórios: quem é beneficiário, que estados, que data de referência. Uma definição para todos os relatórios.
4. **BI.** Visuais, filtros e medidas sobre um modelo já preparado. O relatório mostra, não repara.

À parte das camadas, convém manter uma lista dos erros encontrados durante a limpeza. Essa lista vai para o dono da origem, para que o número de correções diminua com o tempo em vez de crescer.

## Como começar sem uma grande reconstrução

1. Abra o Power Query do seu relatório principal e marque cada passo: formatação, limpeza ou lógica de negócio.
2. Encontre os passos que se repetem em dois ou mais relatórios. Tire esses primeiro: já lhe custam números diferentes.
3. Reúna as tabelas de correspondências manuais num só sítio e atribua-lhes um dono.
4. Faça a lista dos erros que o relatório corrige em cada atualização e envie-a ao dono da origem.
5. O que ficar no relatório deve dizer respeito apenas à apresentação.

Depois de alguns destes passos, o [Business Intelligence](/pt/business-intelligence/) volta a fazer aquilo para que serve: ajudar a decidir. E as regras de preparação passam a fazer parte da [arquitetura de dados](/pt/data-architecture/), em vez de serem o segredo de um único ficheiro.

Uma pergunta para si: quantos passos tem o seu maior Power Query e quantos deles estão, na verdade, a tratar a origem?
