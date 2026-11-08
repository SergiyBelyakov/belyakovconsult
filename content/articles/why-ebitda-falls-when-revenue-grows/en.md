---
title: "Revenue grows, EBITDA falls: find the cause, not someone to blame"
description: A monthly report shows a total and makes you guess. A root cause tree breaks the gap to plan down to unit, product, line item and factor.
date: 2027-01-18
draft: true
services: [financial-analytics, management-analytics]
tags: [financial analytics, EBITDA, plan vs actual, root cause tree]
promo:
  hook: "Sales are growing, profit is melting. In the meeting everyone brings their own explanation."
  tag: "Causes of deviations"
  cta: "How do you look for the cause when EBITDA is below plan: in a spreadsheet, in a meeting or in one report?"
carousel:
  - title: A familiar picture
    text: Revenue year to date is up 8.5% on last year, EBITDA is down 10%. The report shows the total; the causes are guesswork.
    visual:
      type: compare
      highlight: left
      left: {label: "Revenue", value: "+8.5%"}
      right: {label: "EBITDA", value: "−9.8%"}
  - title: Five levels instead of one number
    text: Every level is calculated from the data, and the branches always add up to the gap.
    visual:
      type: flow
      items: ["Company", "Unit", "Product", "Line item", "Factor"]
  - title: What the demo found
    text: An EBITDA gap to plan of UAH 15.5m year to date. Five factor groups explain 80%.
    visual:
      type: bars
      items: [{label: "Raw materials, South", value: 5.0}, {label: "Volume, South", value: 3.0}, {label: "Raw materials, North", value: 2.4}, {label: "Overtime, South", value: 1.4}]
      note: "UAH m year to date, synthetic data"
  - title: An explanation without invention
    text: The text is built from calculated factors, their duration and data sources. Causes that are not in the data are not in it.
    visual: {type: doc, label: "Explain the change", note: "Factors, duration, sources, scenarios"}
  - title: Try it yourself
    text: "The executive dashboard demo: a root cause tree, a waterfall and factor contribution."
    visual: {type: doc, label: "Executive dashboard", note: "The Root causes page"}
---

A familiar meeting. Revenue year to date is growing, yet EBITDA is below both the plan and last year. Finance shows a summary table, the plant director talks about raw materials, sales talk about competitors, and HR says people are leaving. Each explanation is half true, and nobody can say how much of the gap each cause accounts for.

## Why a total is not enough

A gap to plan is made of several movements that partly cancel each other out. Volume falls in one unit and grows in another. Raw materials get more expensive while vacancies temporarily save payroll. Together they produce one number, and that number does not show what happened.

The usual EBITDA bridge from plan to actual is already better: volume, direct costs, payroll, other costs. But it shows line items, not places. To act, an executive needs to know where exactly: which plant, which product, which line item and what changed in it, price or quantity.

## The root cause tree

A root cause tree breaks the same gap into five levels: company, unit, product, line item, factor. At every level the branches add up to the node above, so nothing gets lost and nothing is counted twice. Sales split into price and volume, materials into raw material price and scrap, payroll into headcount and overtime.

In the [executive dashboard demo](/en/cases/executive-dashboard/#causes) the year-to-date gap of a fictional manufacturer is UAH 15.5m. The tree opens the branch that explains the most right away: the South plant. Then you see that five unit × factor groups account for 80% of the losses: more expensive raw materials at both plants, lower volume at the South plant and overtime. Selecting a waterfall bar takes you one level down, and a row in the contribution list opens the matching branch.

## An explanation you can trust

Next to the tree there is an "Explain the change" button. It does not generate text; it builds sentences from numbers that are already calculated: which factor, how much, what share of the gap it explains, for how many months in a row it has lasted and which systems the data comes from. If a deviation shows every month since the start of the year, the explanation says plainly that it is a flaw of the plan rather than a new event. Overtime the budget never included is a typical example.

The explanation also suggests two scenarios to check, with a calculated effect. Cutting purchasing costs by 5% or raising prices by 3%: both open in the simulator, where you see EBITDA over a year, cash and risks.

## What it takes to do this on your data

Plan and actual at the same level of detail. If the budget is made by unit and the actuals exist by product, the tree stops at the unit. This is usually the first thing worth fixing.

An allocation rule for indirect costs that finance agrees with. Without it the product level turns into an argument.

Price and quantity separately. For manufacturing these are volumes from the accounting system, for services the number of clients and the average ticket.

And an honest plan. If overtime, seasonality or discounts to key clients are not in the budget, the tree will show them as deviations every month. That is a useful finding too: fix the plan first, then look for causes.
