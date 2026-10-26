---
title: You can see data governance when numbers conflict
description: Two teams bring different figures, and both are right. What that moment reveals about data governance and the four questions to start with.
date: 2026-10-26
services: [data-governance, data-quality]
tags: [data governance, public sector, indicators]
carousel:
  - title: Two numbers, and both are right
    text: "An illustrative meeting: 41,200 recipients from one team and 38,900 from another. No calculation errors."
    visual:
      type: bars
      items: [{label: "Team A", value: 41200}, {label: "Team B", value: 38900}]
      note: "Illustrative data, same quarter"
      thousands: ","
  - title: Why this happens
    text: "Different definition: person or application.\nDifferent cut-off: end of month or report date.\nDifferent source: register or working spreadsheet."
    visual: {type: list}
  - title: Four data governance questions
    text: "Who sets the rule.\nWhich source is authoritative.\nWho fixes an error.\nWho approves a change."
    visual: {type: grid}
  - title: A policy without answers does not work
    text: A hundred-page document will not help if nobody in the meeting can say whose number is official.
    visual: {type: doc, label: "Policy, 100 pages", note: "Whose number is official?"}
  - title: Check it on your last conflict
    text: Wherever the answer is "unclear", that is where to start.
    visual:
      type: flow
      items: ["Recall the last number conflict", "Answer the 4 questions", "Find the \"unclear\" answers", "Start right there"]
episodes:
  - title: Whose number is it?
    text: Answers to the four questions only hold when real people stand behind them.
    carousel:
      - title: Four roles
        text: "Data owner\nData steward\nData custodian\nData consumer"
        visual: {type: grid}
      - title: Who does what
        text: "The owner approves definitions\nThe steward keeps the description and spots gaps\nThe technical team implements the rule\nThe consumer says when numbers disagree"
        visual: {type: list}
      - title: A small team works too
        text: One person can hold several roles. What matters is that every indicator has a name next to it.
        visual:
          type: compare
          highlight: right
          left: {label: "Fine", value: "1 person, several roles"}
          right: {label: "Not fine", value: "An indicator with no owner"}
      - title: Without names, answers disappear
        text: After the first reshuffle. So for every critical indicator, write down the owner and the steward.
        visual: {type: doc, label: "Indicator description", note: "Owner: ?"}
  - title: How many recipients do you have?
    text: Three teams can give three correct answers. An indicator reference sheet turns them into one.
    carousel:
      - title: A recipe without grams
        text: "\"Some flour, sugar to taste.\" Everyone gets a cake, but a different one."
        visual:
          type: compare
          highlight: right
          left: {label: "Recipe", value: "Some flour"}
          right: {label: "Indicator", value: "Recipients", note: "People or applications?"}
      - title: Five lines of a reference sheet
        text: "What we count, in one sentence\nUnit: person, application or service\nPeriod and cut-off date\nSource and who is responsible for it\nA formula someone else can repeat"
        visual: {type: list, numbered: true}
      - title: A 10-minute task
        text: If you had to call someone at line three, you need the sheet more than you thought.
        visual:
          type: flow
          items: ["One indicator from a report", "Five lines of the sheet", "Where you had to call someone", "Start right there"]
---

Picture a management meeting (the example is illustrative, but familiar). Leadership is shown the number of service recipients for the quarter. One team brings 41,200, another 38,900. Both reports are carefully built, the formulas check out, and there are no calculation errors.

This is the moment when you find out whether the organisation has data governance. Not when a policy is approved, but when two correct numbers disagree.

## Why both numbers can be right

The gap is almost never about arithmetic. Usually the teams count slightly different things without noticing, because they use the same name for them.

- **Different definition.** One counts people, the other counts applications. Someone who applied twice appears once in one report and twice in the other.
- **Different cut-off date.** One uses the status at the end of the quarter, the other the day the report was produced. Some records changed in between.
- **Different source.** One uses the register, the other its own working spreadsheet, which receives data late or after manual checks.
- **Different cleaning rules.** One removes duplicates and test records, the other does not.

Each of these choices is reasonable on its own. The problem is that nobody has decided which of them is the rule for the whole organisation.

## A match with two referees

It is like a football match with two referees, each holding a different rulebook. Both blow the whistle honestly by their own rules, yet the scores differ. Arguing about who is the better referee is pointless: first you need to agree on the rules.

The analogy has limits. In football the rules are written off the pitch, while an organisation has to write its own, often mid-season and under reporting deadlines.

That agreement is what we call data governance: who sets the rules for data, who makes sure they are followed, and what happens when rules contradict each other.

## Four questions to start with

Data governance is often imagined as a thick policy document. In practice it starts with four ordinary questions for every critical indicator or dataset:

1. **Who sets the rule?** Who decides what exactly is counted: people or applications, as of which date, with which exceptions.
2. **Which source is authoritative?** Where the number shown to leadership, partners and donors comes from.
3. **Who fixes an error?** When a problem is found, who is responsible for correcting it at the source rather than in the next report.
4. **Who approves a change?** If the definition needs to change, who decides and how the people producing the figures find out.

If someone in the meeting above can answer these questions within a minute, the conflict is over within the same minute. If not, it will come back every quarter.

## Roles that keep the answers in place

Answers need to be tied to specific people, otherwise they disappear with the first staff rotation. Four roles are usually enough:

- **Data owner.** The head of a function who is accountable for the data serving their decisions. They approve definitions and changes.
- **Data steward.** The person who knows day to day how the data works, maintains definitions, spots discrepancies and prepares proposed changes.
- **Data custodian.** The team that runs the system or register and implements agreed rules technically.
- **Data consumer.** Analysts, reporting teams, partners. They use data according to the rules and raise the flag when something does not add up.

In a small organisation one person may hold several roles. What matters is that for every critical indicator it is clear who the owner and the steward are.

## A minimal procedure when numbers disagree

You do not need a full policy to resolve a specific conflict:

1. Put the two numbers side by side and write down how the definition, cut-off date, source and cleaning rules differ.
2. Identify the owner of the indicator. If there is none, appoint one by a management decision.
3. The owner chooses one definition and one authoritative source. The decision is recorded in writing, with a date.
4. The steward updates the indicator description so that the next report is calculated the same way.
5. Everyone who produces this indicator receives a short note about the new rule.

After a few conflicts resolved this way, you will have the policy document. Only it will describe real decisions rather than an intention to make them some day.

## Check it on your own example

Think of the last time your numbers did not match: in a meeting, in a partner report, in a response to a request. Try to answer the four questions from this article for that indicator.

Wherever the answer sounds like "it depends who you ask" or "unclear", that is where [data governance](/en/data-governance/) should start. Usually that means one or two indicators, not the whole system.
