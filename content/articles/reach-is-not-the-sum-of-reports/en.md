---
title: "Reach is not the sum of reports: count people, not records"
description: Partners report 35,760 recipients; 32,870 are unique and 30,570 confirmed by checks. Three checks to run before the donor report.
date: 2027-02-22
draft: true
services: [data-quality, data-strategy, management-analytics]
tags: [data quality, monitoring and evaluation, double counting, donor programmes]
promo:
  hook: "35,760 in the reports. 30,570 in reality."
  tag: "Double counting"
  cta: "How many people in your reach are counted twice?"
carousel:
  - title: A sum of reports is not people
    text: Three partners report 35,760 recipients. Verified people among them number 30,570.
    visual:
      type: compare
      highlight: right
      left: {label: "sum of reports", value: "35,760"}
      right: {label: "verified reach", value: "30,570"}
  - title: Where the gap comes from
    text: One person in two partners’ databases, duplicates in one database and records without documents.
    visual:
      type: bars
      items: [{label: "In two partners’ databases", value: 2270}, {label: "Twice in one database", value: 620}, {label: "Not confirmed by checks", value: 2302}]
      note: "Records"
  - title: Suspiciously round numbers
    text: In 43% of one partner’s monthly reports the number of participants ends in zero.
    visual:
      type: bars
      items: [{label: "Expected", value: 10}, {label: "Partner D", value: 43}]
      note: "Reports ending in 0, %"
  - title: Three checks
    text: A shared pseudonymous ID, checks against documents and the last digit test.
    visual:
      type: flow
      items: ["Shared ID", "Database matching", "Document checks", "Verified reach"]
  - title: Try it in the demo
    text: A fictional programme with five partners and every data quality check.
    visual: {type: doc, label: "Programme monitoring and evaluation", note: "The Data quality page"}
---

A hypothetical case. The quarterly donor report. The psychosocial support partner reports 16,900 people, the mobile social teams 17,100, vocational training 1,760. The summary table says “35,760 people reached”, which is 113% of plan to date.

Before sending the report it is worth running three checks. After them the number drops by more than 5,000, and it is better that you see this rather than the donor’s verification.

## 1. One person in two partners’ databases

Receiving two services is fine: a mobile team brought medicines and helped with paperwork, and a psychologist ran a few sessions. But in programme reach a person counts once. When each partner keeps its own database, double counting is inevitable.

The fix: a shared pseudonymous recipient ID (for example a hash of the document number and date of birth, without the data itself) and matching the databases every quarter. In our example 1,840 people appear in both the teams’ and the psychologists’ databases, another 310 and 120 in two other pairs of partners. On top of that, 620 records repeat in one partner’s database: the same person was registered in two communities.

Unique people number 32,870. That is 104% of plan, not 113%.

## 2. Checks against source documents

Every quarter take a random sample of each partner’s records and check them against attendance lists, applications and acts. Sixty records per partner are enough to see a problem.

For four partners between 93% and 98% of records check out. For psychosocial support it gets worse every quarter: 96% at the start, 78% and 81% in the last two quarters, 86% overall. Unconfirmed records are not necessarily invented, but they should not be reported as reach. After the checks 30,570 people remain, that is 96% of plan.

## 3. The last digit test

When people are counted from lists, the last digit of the monthly number of participants is distributed almost evenly: each digit appears in about 10% of reports. When the number is written by eye, zeros and fives appear. For the same partner 43% of monthly reports end in zero, and the χ² test says this does not happen by chance.

This is not proof of fraud. Most often it is what a report written from memory at the end of the month looks like. But it is a signal that the number was estimated rather than counted, and that it is time to move to counting from attendance lists.

## A check before the donor report

1. Do all partners share a pseudonymous recipient ID?
2. How many people appear in the databases of two or more partners, and are they removed from reach?
3. What share of records was confirmed by this quarter’s sample checks?
4. Are there too many round numbers in the monthly reports?

## See it in the demo

The Data Lab now has a [programme monitoring and evaluation demo](/en/cases/monitoring-evaluation/). Its Data quality page shows all three checks on a fictional programme with five partners: the path from the sum of reports to verified reach, document checks by quarter, the last digit test and a score for every partner on the five data quality standards. Move the reporting quarter back and you can see when the problem first became visible.

How many people in your reach are counted twice?
