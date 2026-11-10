---
title: "One good week is not a trend: how many observations stand behind a number"
description: Weekly conversion rose from 2% to 3% and everyone is already looking for the cause. Three checks that show whether there is enough data to trust the number.
date: 2027-02-08
draft: true
services: [data-analysis, management-analytics]
tags: [sampling, randomness, reporting, management analytics]
promo:
  hook: "Plus 50% in a week. On four orders."
  tag: "Small samples"
  cta: "How many observations stand behind your main weekly metric?"
carousel:
  - title: Conversion is up by half
    text: From 2% to 3% in a week. In units that is 8 and 12 orders.
    visual:
      type: compare
      highlight: right
      left: {label: "last week", value: "8"}
      right: {label: "this week", value: "12"}
  - title: One player in four is ahead
    text: The machine returns 92 of every 100, but a short run does not show it.
    visual:
      type: bars
      items: [{label: "20 spins", value: 263}, {label: "2,000 spins", value: 183}, {label: "20,000 spins", value: 3}]
      note: "Players ahead, of 1,000"
  - title: The count first, then the percentage
    text: Ask not “how much did it grow” but “how many events make up this number”.
    visual:
      type: flow
      items: ["Percentage in the report", "How many events behind it", "The usual spread", "Conclusion"]
  - title: When you can trust the number
    text: When there are hundreds of events and the change is larger than the usual spread.
    visual:
      type: fields
      items:
        - {value: "Hundreds of events per period", ok: true, note: "a spread of a few percent"}
        - {value: "A change beyond the spread", ok: true, note: "worth discussing"}
        - {value: "A dozen events a week", note: "luck, not a signal"}
  - title: Try it on the machine
    text: A game that shows how luck turns into math over a long run.
    visual: {type: doc, label: "Jackpot Cat", note: "Experiment 2, small samples"}
---

A hypothetical situation. Monday, an online shop’s weekly report. Conversion is up from 2% to 3%: half as much again in one week. The meeting is already looking for the cause: the new banner, the newsletter, the weather. A week later conversion is back at 2%, and now a cause is needed for the fall.

Perhaps there was no cause in either case. Here are three checks worth doing before you explain a change.

## 1. Count events, not percentages

The site had 400 visitors that week. A 2% conversion is 8 orders, 3% is 12. The whole “half as much again” is made of four orders: one customer split a purchase into several orders and the trend is ready.

A percentage hides its denominator. So next to every relative metric in a report it pays to keep a count: how many events stand behind it. Growth from 800 to 1,200 orders and from 8 to 12 looks the same in percent and weighs very differently.

## 2. Compare the change with the usual spread

Even when nothing changes in the business, the number of orders jumps from week to week. For event counts there is a rough but useful estimate: the usual deviation is about the square root of the count. For 8 orders that is roughly 3, so weeks with 5 and with 11 orders are the same process. And 12 orders at that average turn up by themselves about once in nine weeks.

For 800 orders the square root gives 28, or 3.5%, and there a 50% rise can no longer be put down to chance.

The most honest check is simpler than the formula: look at the last 12 weeks. If orders have ranged from 5 to 13, then 12 this week is not news yet.

## 3. Widen the window or name the volume you need

To tell 2% from 3% with confidence you need about 4,000 visitors in each of the two periods, not 400. If that takes two months to collect, a weekly report is simply too frequent for this metric.

What to do about it:

1. Watch a 4-week or 8-week moving average and keep the weekly number as a reference.
2. Show the band of the usual spread on the chart: anything inside it needs no explanation.
3. Before an experiment (a new banner, a different price), work out how many events you need and do not call the result earlier.

## A five-minute check

Before you explain a change in a metric:

1. How many events stand behind the number in this period and in the previous one?
2. What was the spread over the last 12 periods when nothing was changed?
3. Does the new value fall outside that spread?
4. How many periods does it take to collect enough events for a conclusion?

## Try it on the machine

The learning section of the Data Lab now has a game, [Jackpot Cat: Do the Math](/en/cases/jackpot-cat/). It is an 80s-style slot machine with no money and no prizes that shows its math: it returns 92 credits of every 100 bet. In the second experiment a thousand players make 20 spins each, and 263 of them finish ahead: one in four could decide the machine pays. After 20,000 spins only three in a thousand are still ahead. The machine is the same; only the number of observations has changed.

Five more experiments cover the neighbouring traps: expected value, losing streaks, the near miss, the same average with a different risk, and the rare event that takes everything.

How many observations stand behind your main weekly metric?
