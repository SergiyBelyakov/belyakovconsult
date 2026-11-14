---
title: "A new BI platform will not fix the numbers: where to start"
description: A new dashboard, yet two revenues. The cause is not the tool but the data foundation. How to see where you are in 10 minutes and where to start.
date: 2027-03-01
draft: true
services: [data-strategy, data-governance, data-quality]
tags: [data maturity, data governance, data quality, data strategy]
promo:
  hook: "New dashboard. Same conflicting numbers."
  tag: "Data maturity"
  cta: "Where is your organisation: which data maturity level?"
carousel:
  - title: New tool, old arguments
    text: Three months after a new BI platform goes live, two dashboards show different revenue for the same month.
    visual:
      type: compare
      highlight: right
      left: {label: "expectation", value: "1 truth"}
      right: {label: "reality", value: "2 numbers"}
  - title: Analytics is ahead of the foundation
    text: Reports are at 3.5 of 5, while governance, quality and reference data underneath average 2.3.
    visual:
      type: bars
      items: [{label: "Analytics", value: 3.5}, {label: "Governance", value: 2.3}, {label: "Quality", value: 2.3}, {label: "Reference data", value: 1.8}]
      note: "Score from 1 to 5"
  - title: What not to do now
    text: Do not buy another platform, do not automate unchecked data and do not start with AI.
    visual:
      type: flow
      items: ["Definitions", "Quality at source", "Reference data", "Then dashboards"]
  - title: Three priorities
    text: Data quality, registers and reference data, architecture. One step each for 30, 90 and 180 days.
    visual:
      type: bars
      items: [{label: "Data quality", value: 2.7}, {label: "Reference data", value: 2.1}, {label: "Architecture", value: 1.8}]
      note: "Priority: gap to target, weighted for the foundation"
  - title: Assess yourself in 10 minutes
    text: 32 questions, a level from 1 to 5, a profile against the target, a roadmap and a PDF report. Answers stay in your browser.
    visual: {type: doc, label: "Data maturity assessment", note: "Data Lab"}
---

A fictional situation. A company with ten branches is tired of Excel reports and buys a modern BI platform. In two months a contractor builds nice dashboards: sales, margin, stock, customers. Three months later, at a meeting, the sales director shows March revenue of 41.2 million and the finance director shows 39.8 million. Both dashboards are new, both come from “a single source”.

The first reaction: the tool is bad or the contractor made a mistake. The second, even more expensive: buy another tool. But the problem is rarely the platform.

## Where two revenues come from

Sales counts revenue by shipment date, finance by invoice date. Returns are subtracted in the month of the return by one team and in the month of the sale by the other. The customer list in the CRM and in the accounting system diverge: the same counterparty is written under three different names. Nobody owns the definition of “revenue”, so every dashboard has its own truth.

The new platform simply showed this faster and more beautifully.

## Analytics is ahead of the foundation

This is easy to see if you assess data maturity by dimension rather than as a whole. In the example from the Data Lab, the company’s analytics is at 3.5 of 5: role based dashboards, automatic refresh, first forecasts. Governance and quality are at 2.3, registers and reference data at 1.8.

When analytics is a level or more above the foundation, dashboards lose trust. People go back to their own spreadsheets “to double check”, and the BI investment quietly stops working.

## What not to do now

1. Do not buy another BI platform or order new dashboards while key metrics are counted in different ways.
2. Do not automate reporting on unchecked data: automation only spreads errors faster.
3. Do not start with AI and forecasts. Models built on dirty, undocumented data give confidently wrong answers.

## Where to start

**30 days.** Pick 10 key metrics and write one definition, source and formula for each. Measure baseline quality of key data sets: the share of blanks, duplicates and values breaking the rules. Bring the 2 or 3 most important reference lists together in one place with codes.

**90 days.** Agree the glossary between departments, automate the checks and show the refresh date and quality status in every report. Approve merge rules for duplicates in the customer list.

**180 days.** Move key metric calculations into one semantic model that every dashboard uses. Add rules at entry so the errors do not come back.

After that, the same BI platform starts showing one revenue.

## Assess your organisation

The Data Lab now has a [data maturity assessment](/en/cases/data-maturity/): 32 questions across eight dimensions, about 10 minutes. Every answer describes a specific practice, so there is no guessing what “average” means. At the end you get a level from 1 to 5, a profile against the target for your type of organisation, three priorities, “what not to do now”, a 30, 90 and 180 day roadmap and a PDF report for your team. Your answers stay in your browser.

Where is your organisation: which data maturity level?
