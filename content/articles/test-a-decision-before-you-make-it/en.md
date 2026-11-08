---
title: "Prices, cuts, debtors: test a decision before the meeting"
description: Obvious decisions have consequences that show up months later. A simulator shows EBITDA, cash against the threshold and workforce risk in advance.
date: 2027-01-25
draft: true
services: [management-analytics, financial-analytics]
tags: [management analytics, scenarios, decision simulator, liquidity]
promo:
  hook: "Prices up 5%, staff down 10%, stop shipping to the debtor. Sounds decisive. And six months later?"
  tag: "Decisions before the meeting"
  cta: "Does anyone calculate your meeting decisions in advance, or only check them after the fact?"
carousel:
  - title: Three problems at once
    text: The margin is falling, receivables are growing, people are leaving. Decisions are needed now, the effect comes months later.
    visual:
      type: list
      items: ["Margin a quarter below plan", "Client A pays after 98 days", "Plant turnover almost twice last year"]
  - title: The obvious steps
    text: Raise prices for everyone, stop shipping to the debtor, raise everyone's pay. Each step has a price.
    visual:
      type: flow
      items: ["Prices +5%", "Stop the debtor", "Pay +10%"]
  - title: The difference in the demo
    text: The same company, the same 12 months, a balanced score from −100 to 100.
    visual:
      type: compare
      highlight: right
      left: {label: "Obvious steps", value: "7"}
      right: {label: "Targeted decisions", value: "88"}
  - title: What the simulator calculates
    text: EBITDA over a year, the lowest cash point against the threshold, workforce risk and volume, with lags and elasticity.
    visual:
      type: fields
      items:
        - {value: "Demand elasticity", ok: true}
        - {value: "Time to effect", ok: true}
        - {value: "Capacity", ok: true}
        - {value: "Overtime and turnover", ok: true}
  - title: Try it yourself
    text: "The Be the CEO challenge: three problems, three minutes."
    visual: {type: doc, label: "Be the CEO", note: "Your decisions against the base case"}
---

Three problems land on the table at once. The margin year to date is a quarter below plan, the key client pays after a hundred days instead of forty-five, and at one of the plants staff turnover is almost twice last year's. The proposals sound decisive: raise prices for everyone by 5%, stop shipping to the debtor, raise everyone's pay by 10%. Each makes sense. The trouble is that the consequences do not show up at once, and not where you expect them.

## What you do not see when you decide

Prices. A price rise works from the next month, but in a competitive market some clients leave. And the contract with the largest client will not change without negotiation, so the rise misses exactly what puts the most pressure on the margin.

The debtor. Stopping shipments brings cash back, but the client cuts orders and the plant runs below capacity. It is the most expensive way to collect receivables.

Pay. A raise for everyone costs money at once, while turnover falls only over a few months, and everywhere, although the problem is at one plant.

Staff cuts. Payroll is lower from the second month, but severance, overtime for those who stay and a new wave of exits eat the savings where people are already leaving.

## What the simulator shows

The [executive dashboard demo](/en/cases/executive-dashboard/#scenarios) has a decision simulator on the data of a fictional manufacturer. It calculates 12 months ahead from the "if nothing changes" forecast and takes into account what a spreadsheet does not show: demand elasticity, the time each decision needs to work, capacity limits and the link between overtime and turnover. You see the result at once: EBITDA over a year, the lowest cash point against a threshold of two weeks of spending, workforce risk and volume.

Without decisions, the company's cash falls below the threshold in March and stays there for eight months. The obvious steps (prices for everyone, stopping the debtor, pay for everyone) bring some cash back, but EBITDA over the year is even slightly worse than the base case, and volume falls by 5%. Balanced score: 7 out of 100.

The targeted decisions look more modest: renegotiate the contract with the key client and the raw material terms, factor the client's invoices, and add targeted pay and people at the plant in trouble. Together that is UAH 16.6m more EBITDA over a year, cash dips below the threshold for only one month and workforce risk falls. Score: 88.

## Try it yourself

The "[Be the CEO](/en/cases/executive-dashboard/#ceo)" challenge takes about three minutes: three problems, four options each, and at the end a comparison with the base case and honest trade-offs of every choice. The model is illustrative: the coefficients are set explicitly and described on the method page.

## What it takes to calculate this for your company

An "if nothing changes" forecast on your data: plan, actuals and trends over the last couple of years.

Estimates of reactions: how demand responded to past price changes, how long it takes from a decision to its effect, where capacity ends. Some of this can be estimated from history, some agreed with unit managers.

The link between people and results: overtime, turnover, defects and plan delivery in one data set. This is where decisions that save money today and cost it six months later most often hide.
