---
title: Why the executive learns about a plant problem six months late
description: Finance and HR reports live apart, so the chain of overtime, exits, defects and a missed plan is only visible afterwards. How to put it on one screen.
date: 2026-11-23
draft: true
services: [management-analytics, financial-analytics]
tags: [management analytics, financial analytics, staff turnover, plan vs actual]
promo:
  hook: "The plan failed in July. It started in May."
  tag: "Finance and HR in one report"
  cta: "Have your finance and HR reports ever sat side by side?"
carousel:
  - title: July. The plan is missed
    text: The finance report shows minus 12% against plan. People look for the reason in sales.
    visual:
      type: bars
      items: [{label: "Plan", value: 21.7}, {label: "Actual", value: 19.1}]
      note: "Illustrative data, UAH m"
  - title: May. Overtime begins
    text: The HR report saw it. Nobody opened it next to the finance report.
    visual:
      type: flow
      items: ["May: overtime 13%", "June: people leave", "July: defects 3%", "July: minus 12% vs plan"]
  - title: Two reports, two owners
    text: Finance counts money, HR counts people. Nobody counts the link between them.
    visual:
      type: compare
      highlight: right
      left: {label: "Apart", value: "Effect"}
      right: {label: "Together", value: "Cause"}
  - title: What to put side by side
    text: Four lines for one unit over the same months.
    visual:
      type: grid
      items: ["Overtime", "Turnover, 12 months", "Defects or NPS", "Revenue vs plan"]
  - title: A rule, not a guess
    text: Overtime above 10% two months in a row is a signal to the executive, before people leave.
    visual: {type: doc, label: "Signal", note: "Overtime 13%, May"}
---

An illustrative case. In August the finance director brings a report to the management meeting: the South plant missed its July plan by 12%. The discussion turns to sales, clients and prices. Meanwhile the HR report had shown rising overtime since May, exits since June, and the quality team logged twice as many defects in July.

All three facts were known. They just lived in three different reports that nobody opened together.

## What the chain looks like

The pattern is familiar to many plants and service networks:

1. **Workload grows.** Two experienced people leave, the vacancies stay open for two months, the rest cover shifts with overtime.
2. **People get tired and leave.** After two or three months of overtime, exits speed up. Annual staff turnover goes from 13% to 25%.
3. **Quality suffers.** New people are still learning, experienced ones are overloaded. Defects rise, on-time deliveries fall.
4. **Finance sees the effect.** A client delays payment because of defects, volume drops, the plan is missed.

The finance report shows only step four. The first three are visible in other reports, and each of them was a cheaper moment to step in.

## Why this happens

It is not that someone does a poor job. The finance team builds its report from the accounting system, HR builds its report from the HR system and timesheets. Each has its own format, its own cut-off date and its own audience.

It is like one doctor who only looks at the temperature and another who only looks at the lab results. Both see the truth, but the diagnosis comes from whoever sees both. The analogy is imperfect: a company has no chief physician by default, someone has to be given that role.

## What to put on one screen

For each unit, four lines over the same months:

- **Overtime**, the share of hours above the norm;
- **Turnover** over the last 12 months, voluntary exits only;
- **Quality:** defects in production, or NPS and waiting time in service;
- **Revenue vs plan**, in per cent.

When they sit one under another, you can see what happens first and what follows. The calculation is simple; the hard part is bringing data from different systems to the same unit and the same month.

## Rules that fire earlier

A few rules worth checking every month:

- overtime above 10% of hours two months in a row;
- turnover above 20% a year in any unit;
- a vacancy open for more than 45 days;
- revenue more than 5% below plan.

The thresholds are illustrative and should be agreed with management. What matters is that the first three rules fire months before the fourth.

## How it looks in the demo

The Data Lab has an executive dashboard demo on synthetic data: finance, people and operations on one screen, a short monthly brief, an EBITDA bridge from plan to actual and ten signal rules. The People page has exactly this link panel for the unit with the highest turnover. The data is illustrative, the logic of the calculation is real: [open the executive dashboard demo](/en/cases/executive-dashboard/#people).

## A half-hour check

Take the last 12 months of one unit and write four columns into a table: overtime, exits, defects or complaints, plan delivery. Look for a month after which everything went downhill. If there is one, that is where the first signal should have fired.

Have your finance and HR reports ever sat side by side?
