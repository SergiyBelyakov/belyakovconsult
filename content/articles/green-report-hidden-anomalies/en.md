---
title: Green report, two extra zeros. Why dashboards miss anomalies
description: Monthly totals dissolve errors and risks in individual payments. How to find anomalies at the record level, and why many signals turn out to be normal.
date: 2026-11-30
draft: true
services: [data-quality, financial-analytics]
tags: [anomalies, data quality, financial analytics, payment control]
promo:
  hook: "The report is green. A payment has two extra zeros."
  tag: "Anomalies in payments"
  cta: "How many signals a month can your team actually review?"
carousel:
  - title: The report is green
    text: Spend for the year is within plan, plus 0.3%. No month stands out.
    visual:
      type: bars
      items: [{label: "Plan", value: 102.4}, {label: "Actual", value: 102.7}]
      note: "Illustrative data, UAH m"
  - title: The records tell another story
    text: Among almost 6,000 payments that make up the bars.
    visual:
      type: flow
      items: ["Cleaning: 1.5m instead of 15k", "The same invoice paid twice", "4 payments of 49k in a day", "Invisible in the monthly total"]
  - title: A signal is not a verdict
    text: An annual insurance policy, a cold spell and year-end purchases are unusual too.
    visual:
      type: compare
      highlight: left
      left: {label: "Errors and risks", value: "73"}
      right: {label: "Rare but normal", value: "32"}
  - title: Each group has its own normal
    text: An evening travel payment is common; an evening payment to a supplier is not.
    visual:
      type: grid
      items: ["Utilities", "Purchases", "Travel", "Rent"]
  - title: The threshold sets the workload
    text: "3.5σ: 117 signals a year and about 16 hours of review."
    visual: {type: doc, label: "Signal", note: "98 times the usual amount"}
---

An illustrative case. The finance report for the year: spend of UAH 102.7m, plus 0.3% against plan. No month goes beyond ±5% of plan. The report is green and nobody has questions.

Yet among the almost 6,000 payments that make up these bars there is this:

- a cleaning payment of UAH 1,539,539 instead of UAH 15,395: two extra zeros;
- the same contractor invoice paid twice, two days apart;
- four payments to one supplier in a day, each just under UAH 50,000, that is, below the approval limit;
- a new counterparty, a round UAH 150,000, paid on the day the invoice arrived, at seven in the evening.

None of these changes a monthly bar enough to draw attention. An error of 1.5m in a month with 7m of spend just looks like an expensive month.

## Why the dashboard misses it

A dashboard shows totals and averages. It answers "how much", not "what exactly". One strange transaction among thousands dissolves in the aggregate, and opposite errors can even cancel each other out.

The usual rules such as "show payments over UAH 100,000" only catch the obvious. Large rent or an annual licence lands on that list every month, while splitting into four payments of 49 thousand never does.

## An anomaly means "unlike the others"

An anomaly in data does not mean an error or fraud. It is a record that is unlike other records in its group: an amount 10 times the usual one for this counterparty, a payment at 23:40, the same amount to the same counterparty two days later, a counterparty the organisation has worked with for a week.

What you compare with matters. An evening travel payment is common; an evening payment to a supplier is not. A night-time electricity direct debit happens every month in two branches, so for utility payments it is normal. If you compare every payment with everything, what is usual for one group becomes unusual for another, and some real deviations get lost.

## A good share of signals will be normal

In the anomaly detection demo on synthetic data, at a threshold of 3.5σ the method flags 117 payments out of almost 6,000. Of these, 73 are real errors and risks, 32 are rare but normal and 12 are chance coincidences. Rare but normal looks like this:

- the annual insurance policies of all branches, paid in February;
- a January heating bill after a severe cold spell;
- large purchases before the budget year closes;
- an emergency repair paid at a weekend.

That is why a signal without an explanation does harm: the team either spends time on the obvious or stops trusting the system. Every signal should answer four questions: how the record differs, how rare that is, what may make it normal and what to check.

## The threshold sets the workload

The deviation threshold is not a technical setting. It is a decision about how many signals the team will really review.

- 4.5σ: 85 signals a year, 58 of them errors and risks. About 11 hours of review at 8 minutes per signal.
- 3.5σ: 117 signals, 73 of them errors and risks, about 16 hours.
- 2.5σ: 168 signals, 84 of them errors and risks, but already 46 chance coincidences, about 22 hours.

A lower threshold finds more problems, but each extra find costs more. The right threshold is set together with the people who will review the signals.

## What it looks like in the demo

The Data Lab has an anomaly detection demo on synthetic data. First you see a regular dashboard, then the same payments break into a 3D cloud: each expense group is a separate "galaxy", and everything outside the "normal boundary" sphere glows ruby. You can change the method, the threshold and the features and watch the number of signals change. Each record card has an explanation and the review result. You can also upload your own CSV or Excel file: the analysis runs in the browser and the file is sent nowhere. [Open the anomaly detection demo](/en/cases/anomaly-detection/).

## A half-hour check

Export the payments for the last three months and run four checks in a spreadsheet:

1. For each counterparty, compute the median payment and find payments more than 5 times higher.
2. Find identical amounts to one counterparty within 7 days.
3. Find payments between 95% and 100% of the approval limit, especially several in a day to one counterparty.
4. Find payments outside working hours and at weekends, except in groups where this is normal.

If something turns up, you already have a first version of a control. The only question then is doing it every month, with explanations and without manual work.

How many signals a month can your team actually review?
