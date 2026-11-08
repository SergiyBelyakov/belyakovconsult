---
title: "How many people live in the community: register, GP lists or meters?"
description: The register overstates the population because people leave without deregistering. How to reconcile three sources into a number to plan with.
date: 2026-12-21
draft: true
services: [data-governance, data-analysis]
tags: [population, communities, registers, data governance]
promo:
  hook: "The register says 49,000. 44,700 actually live here. Which number do we plan with?"
  tag: "Community population"
  cta: "Which population figure does your community plan schools and the budget with?"
carousel:
  - title: Three sources, three numbers
    text: The register, GP registrations and household meters do not agree.
    visual:
      type: bars
      thousands: ","
      items:
        - {label: "Residents register", value: 49050}
        - {label: "Estimate from three sources", value: 44670}
        - {label: "GP registrations", value: 39915}
  - title: Why the register overstates
    text: People leave and do not deregister. IDPs live here but are registered elsewhere.
    visual:
      type: compare
      left: {label: "registered, not living here", value: "7,633"}
      right: {label: "living here, not registered", value: "3,253"}
  - title: Three independent estimates
    text: No source is accurate on its own. Together they give a number with a range.
    visual:
      type: fields
      items:
        - {value: "Meters × household size", ok: true, note: "weight 0.40"}
        - {value: "GP registrations ÷ coverage", ok: true, note: "weight 0.35"}
        - {value: "Register − absent + IDPs", ok: true, note: "weight 0.25"}
  - title: The gap is largest in small villages
    text: |
      Hlyboke: register 39% higher
      Stepove: 34% higher
      Zalissia: 33% higher
  - title: See the reconciliation in the twin
    text: "The community digital twin demo: register, GP lists, meters and a projection to 2035."
    visual: {type: doc, label: "Community digital twin", note: "Population: three estimates"}
---

A fictional community. The residents register says 49,050 people. There are 39,915 registrations with family doctors. Household meters with consumption number 19,114, which is about 44,000 people when multiplied by the average household size. Which figure should a school network plan, a social services budget or a revenue-per-resident indicator use?

Most often the register is used because it is "official". And it is wrong by 10%, and in some villages by a third.

## Why the register overstates

The register records where people are registered, not where they live. People leave to work abroad or in large cities and do not deregister for years. In small remote villages, one record in four can belong to someone who is not there. Meanwhile internally displaced people live in the community but are registered elsewhere.

GP registrations understate: some people have no family doctor or registered in the city where they work. Meter-based estimates depend on how many people live in one household, which is lower in villages than in town.

## How to get a number you can trust

No source is right on its own, but they are wrong in different ways. So they are combined:

1. Meters with consumption above 30 kWh a month × average household size, separately for the town, small towns and villages.
2. GP registrations by home address ÷ the share of residents who have a registration.
3. The register minus addresses with neither consumption nor GP registrations, plus IDPs who actually live in the community.

A weighted mean of the three estimates gives the central figure, and the spread between them shows how far it can be trusted. It is worth calculating for every settlement separately: the gap in the town and in a remote village is completely different.

## What changes in decisions

Revenue per resident based on the register looks lower than it is. The load on clinics and schools based on the register is overstated. A forecast of first graders from the register promises children who have already left. Each of these mistakes costs money.

## Where to start this month

Ask for an export of active meters and GP registrations by address and match them with the register street by street and settlement by settlement. Where the gap exceeds 25%, run address checks together with the village heads.

In the [community digital twin demo](/en/cases/community-twin/#people), the Population page shows how three estimates combine into one, where the register departs from reality most, and what happens to the number of children and people aged 65+ by 2035.

Which population figure does your community plan schools and the budget with?
