---
title: A community passport goes stale on the day it is printed
description: A PDF community passport is updated once a year, and some numbers are already stale. How to build it from indicators with a source, owner and status.
date: 2026-12-28
draft: true
services: [data-governance, management-analytics]
tags: [community passport, communities, data governance, indicators]
promo:
  hook: "The community passport was printed in spring. By summer some numbers were already out of date."
  tag: "Community passport"
  cta: "When was your community passport last updated, and who is responsible for it?"
carousel:
  - title: The passport as a document
    text: A PDF once a year, numbers without a date or a source, nobody knows what is out of date.
    visual:
      type: compare
      highlight: right
      left: {label: "PDF passport", value: "once a year"}
      right: {label: "Live passport", value: "from registers"}
  - title: What every indicator needs
    text: Without these fields a number in the passport is only an impression.
    visual:
      type: fields
      items:
        - {value: "Definition and formula", ok: true}
        - {value: "Source", ok: true}
        - {value: "Data owner", ok: true, note: "a department, not a person"}
        - {value: "Date and update frequency", ok: true}
  - title: Four statuses
    text: |
      Up to date
      Stale
      Sources disagree
      No data
  - title: Calculate, do not retype
    text: Access to services, flood risk and population are calculated by models from primary data.
    visual:
      type: flow
      items: ["Registers and records", "Community model", "Passport indicator", "Decision"]
  - title: See a passport of 50 indicators
    text: "The community digital twin demo: every indicator has a source, an owner and a status."
    visual: {type: doc, label: "Community digital twin", note: "Passport: data status"}
---

In many communities the passport is a document of several dozen pages: area, population, budget, schools, clinics, roads. It is collected once a year from letters sent by departments, the numbers are retyped by hand and published as a PDF. A few months later some of the numbers no longer match reality, but the document does not show it.

## Why the passport goes stale

The numbers in a passport have no date and no source. The number of shelter places may have been copied from an inspection six months old. The length of roads in poor condition comes from a two-year-old inventory. The number of residents comes from a register that overstates the population by 10%. The reader sees equally confident numbers and cannot tell which of them to trust.

The second reason: nobody is responsible for most indicators. If a department does not know that a number from its records ends up in the passport, it does not keep that number up to date.

## How to keep the passport alive

1. An indicator catalogue. For each one: definition, formula, unit, source, data owner (a department), update frequency. This is the passport standard.
2. Data from registers, not from letters. Wherever possible, the indicator is calculated from an export: the budget, GP registrations, the facility network, land parcels.
3. A status for every number. Up to date, stale (the source has not been updated for longer than one and a half periods), sources disagree, no data. The status sits next to the value.
4. A link to place. A community indicator is made of settlement and facility indicators, so any number can be expanded down to a village or a school.
5. Models for what cannot be counted directly: access to services, flood zones, an estimate of the number of residents.

## Where to start this month

Pick the 20 indicators you base decisions on most often. For each one, write down the source, the owning department and the date of the last update. This list alone will show which numbers are out of date and which have no owner.

In the [community digital twin demo](/en/cases/community-twin/), a passport of 50 indicators is built from 17 sources: every indicator has a date, an owner and a status, and the passport template can be downloaded as Excel and your filled file checked right in the browser.

When was your community passport last updated, and who is responsible for it?
