---
title: "Revenue grows but profit does not: decompose the margin"
description: Volume, mix, price, cost, new and lost customers. How to split the change in gross profit into factors and find where the margin leaks.
date: 2027-03-29
draft: true
services: [financial-analytics, data-analysis]
tags: [financial analytics, margin, sales, PVM, Excel]
promo:
  hook: "Revenue +15%. Gross profit +1%. Where did the money go?"
  tag: "Financial analytics"
  cta: "Can you see how much of your profit comes from price and how much from volume?"
carousel:
  - title: Revenue +15%, profit +1%
    text: Margin fell from 26.1% to 22.9%. The report shows the total but does not say why.
    visual:
      type: compare
      highlight: right
      left: {label: "revenue", value: "+15%"}
      right: {label: "gross profit", value: "+1%"}
  - title: Six factors instead of one number
    text: "Volume\nSales mix\nPrice\nCost\nNew customers\nLost customers"
    visual: {type: list}
  - title: Price did not keep up with cost
    text: Prices added UAH 27.5m, cost took UAH 34.8m. Managers’ discounts ate part of the list price increase.
    visual:
      type: bars
      items: [{label: "Price", value: 27.5}, {label: "Cost", value: -34.8}]
      note: "UAH m, fictional distributor"
  - title: Growth came from cheap channels
    text: Chains and sub-distributors with a 17-19% margin grew faster, while independent stores with 34% shrank.
    visual:
      type: compare
      highlight: left
      left: {label: "chains", value: "+29%", note: "margin 17%"}
      right: {label: "stores", value: "−9%", note: "margin 34%"}
  - title: Try the model yourself
    text: A profit bridge, a regional map, a whale curve, sales managers and scenarios on synthetic data.
    visual: {type: doc, label: "Sales and margin", note: "Data Lab"}
---

A fictional situation. The sales director of a distributor reports that revenue for ten months grew 15%. The finance director replies that gross profit grew only 1% and margin fell from 26.1% to 22.9%. Both are right, and neither can say where the money went.

A summary report shows two numbers but does not explain the gap between them. The answer is a decomposition of the change in profit into factors: price, volume, mix, or PVM. The factors add up exactly to the change in profit, so nothing hides in "other".

## Six factors of the change in profit

Every item (a product, a product in a channel or a product at a customer) is compared across two periods: quantity, net price after discounts and unit cost.

| Factor | What it shows | In the example, UAH m |
| --- | --- | --- |
| Volume | more units at the average margin | +9.4 |
| Mix | items with a lower margin grew faster | −3.1 |
| Price | change in net price on the current volume | +27.5 |
| Cost | change in unit cost, with a minus sign | −34.8 |
| New | profit of customers and products absent last year | +10.9 |
| Lost | profit of customers and products that are gone | −8.2 |

Together +1.7: exactly the growth in gross profit (from 168.4 to 170.1).

## What was hiding behind the total

**Price did not keep up with cost.** Coffee and cocoa got more expensive, the list price went up, but prices added 27.5 and cost took 34.8. Discounts ate part of the list price increase: their share of the list price grew from 14.5% to 18.1%.

**Growth came from low margin channels.** Chains grew 29% and sub-distributors 13% at a 17-19% margin. Independent stores with a 34% margin shrank 9%. The sales mix moved to where every hryvnia of revenue brings less.

**New customers cost more than they seem.** New customers and items brought 61 of revenue but only 10.9 of profit. Closed stores took 28 of revenue at a 29% margin.

**A bonus on revenue rewards discounts.** The managers with the largest revenue growth deepened discounts the most. In a ranking by profit they end up in the second half of the list.

## The level of analysis changes the answer

What counts as an item decides where a change lands. At product level, a shift of sales from stores to chains looks like a price cut: the average price of the product went down. At product × customer level the same shift becomes mix, and price shows only real price changes for each customer.

There is no single right level: choose it for the question. Products are enough for a talk with purchasing. A talk with the sales team needs customers and channels.

## How to run this analysis yourself

1. Collect sales for the two compared periods: product, customer, channel, manager, quantity, revenue after all discounts and cost.
2. Compare the same months, not a year with half a year: otherwise seasonality looks like volume.
3. Choose the item level for the question: product, product × channel or product × customer.
4. Count new and lost items separately: they have no base price or margin.
5. Check that the factors add up to the change in profit. A "residual" means the formulas are wrong.
6. Look below gross profit: logistics, marketplace fees and payment terms often make a large customer lose money.

## Try the model yourself

The Data Lab has a [Sales and margin](/en/cases/sales-margin/) demo: a profit bridge with a choice of months and level, a regional map, a product matrix, a whale curve, the path from list price to contribution in every channel, a ranking of sales managers and scenarios where you drag the price bar and watch profit change. The model downloads as an Excel file where every factor is a formula.

This report can run on your own data from an ERP or Excel: [financial analytics](/en/financial-analytics/).

Can you see how much of your profit comes from price and how much from volume?
