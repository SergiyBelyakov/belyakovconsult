---
title: "One person, three records: register duplicates"
description: Why one person shows up in a register several times, what it does to reports and payments, and where to fix duplicates.
date: 2026-11-09
services: [data-quality, data-governance]
tags: [data quality, registers, duplicates, public sector]
promo:
  hook: "One person. Three records."
  tag: "Where register duplicates come from"
  cta: "How many people in your register have more than one record?"
carousel:
  - title: One person, three records
    text: The register says there are three recipients. In fact it is one person entered three times.
    visual:
      type: fields
      items:
        - {value: "Petrenko Olena", ok: true, note: "main record"}
        - {value: "Petrenko Olena.", note: "trailing dot"}
        - {value: "Petrenco Olena", note: "other spelling"}
  - title: Where duplicates come from
    text: "Typos at entry\nTransliteration\nA new document\nSeveral entry points"
    visual: {type: grid}
  - title: What they distort
    text: The number of recipients grows, and one person may be paid twice.
    visual:
      type: compare
      highlight: right
      left: {label: "In the report", value: "3 people"}
      right: {label: "In reality", value: "1 person"}
  - title: How to find duplicates
    text: Automation suggests pairs, a person makes the decision.
    visual:
      type: flow
      items: ["A matching key", "Fuzzy matching", "Human review", "Decide the master record"]
  - title: Fix it at the source
    text: Cleaning in the report repeats every month. A check at data entry works once and for good.
    visual: {type: doc, label: "Entry form", note: "Already exists?"}
episodes:
  - title: A key for finding duplicates
    text: Comparing names alone is not enough. Comparing the document number alone is not enough either.
    carousel:
      - title: One field misleads
        text: Different people share names. A document number changes together with the document.
        visual:
          type: compare
          highlight: right
          left: {label: "Name only", value: "Namesakes"}
          right: {label: "Document only", value: "New passport"}
      - title: A key from several fields
        text: "Surname without spaces or dots\nDate of birth\nDocument number without series\nTax ID, if there is one"
        visual: {type: list}
      - title: A person decides
        text: The algorithm finds similar pairs. I would not merge records automatically.
        visual:
          type: flow
          items: ["Similar pairs", "Similarity score", "Human review", "Merge or not"]
  - title: Which record is the master?
    text: Finding a duplicate is easy. Deciding what to do with it is harder.
    carousel:
      - title: A decision, not a button
        text: "Which record stays\nWhat happens to payment history\nWho approves a merge\nHow other systems learn"
        visual: {type: grid}
      - title: A check at data entry
        text: The form shows a similar record before a new one is created.
        visual: {type: doc, label: "New record", note: "A similar one exists"}
      - title: A question for you
        text: Do you know how many people in your register have more than one record?
        visual:
          type: compare
          highlight: right
          left: {label: "Records", value: "Known"}
          right: {label: "People", value: "?", note: "Count it separately"}
---

The register shows three service recipients. In fact it is one person: Olena Petrenko, entered three times. Once correctly, once with an extra dot after the first name, and once with a different Latin spelling, because that is how another office does it. The example is illustrative, but anyone who has worked with a large register will recognise it.

## Where duplicates come from

A duplicate rarely appears out of carelessness. More often it is a consequence of how the process is built.

- **Typos at entry.** An extra space, a dot, swapped letters. To a person it is the same record, to the system a new one.
- **Transliteration.** One surname can be written in Latin script in several ways. Petrenko, Petrenco, Petrenka: each version is formally different.
- **A new document.** The person changed their passport, took a new surname after marriage or got an ID card. Nobody found the old record, so a new one was created.
- **Several entry points.** An online application, a service centre, an import from a neighbouring system. Each channel creates records its own way, and nobody checks whether the person already exists.

## What they distort

The most obvious one: the count. If 10% of a register are duplicates, a coverage report is inflated by roughly the same amount, and that figure is then compared with the plan.

It gets worse when money depends on the record. Two records of one person can receive two payments. Or the opposite: the payment is tied to the old record, while the person now comes through the new one and hears that nothing is due.

It is like a phone book where one person is saved as "Olena", "Olena work" and "O. Petrenko". Calling is inconvenient, but you can live with it. (The analogy has limits: your phone does not send money to each contact.)

## How to find likely duplicates

Comparing records by name alone is not enough: different people share names. Comparing by document number alone is not enough either: documents change. So the search uses a key built from several fields:

1. Surname and first name after normalisation: no spaces or dots, one transliteration rule.
2. Date of birth.
3. Document number without the series and separators.
4. A tax ID or another stable identifier, if there is one.

An exact key match finds the obvious duplicates. For the rest, fuzzy matching is used: an algorithm scores how similar two records are and suggests pairs with a high score.

It suggests, it does not decide. I would not merge records automatically: wrongly merging two different people is far harder to undo than finding a duplicate. High-score pairs are reviewed by someone who knows the process.

## The key decision: which record is the master

Finding a duplicate is easy. Deciding what to do with it is harder. That takes rules, not a "merge" button:

- Which record remains the master record, and on what principle: the oldest, the most complete, the one confirmed by a document.
- What happens to the history of payments and services linked to the other records.
- Who approves a merge when money depends on it.
- How other systems that hold references to the old record learn about the change.

This is a data governance question, not only a technical one. Without a data owner, duplicate cleaning turns into an argument about whose record is more correct.

## Why the fix belongs at the source

The most common mistake is removing duplicates in the report. Every month an analyst writes yet another cleaning rule, the report becomes correct, and the register stays the same. Next month it all repeats, and the rule gets a little more complicated.

Checking at entry is much cheaper. When an operator enters a new person, the form searches for similar records using the same key and shows them: "A similar record already exists. Is this the same person?" That check works once and for good, not every month.

## What is better not to do

A few approaches look sensible but usually make things worse:

- **Deleting duplicates.** A deleted record takes its history with it: applications, decisions, payments. It is better to mark the record as merged and keep a reference to the master.
- **Trusting one field.** "If the tax ID matches, it is the same person" works until zeros or someone else's number get into the field. A key from several fields is more robust.
- **Cleaning once a year as a big project.** After the cleanup, duplicates pile up again at the same rate if the source has not changed.

Each of these gives a quick result in the report. And each postpones the real problem: a process that creates new duplicates every day.

## Check it on your own data

Take your main register and count two numbers: the number of records and the number of unique people by a multi-field key. If the second is noticeably smaller, you have found not only a [data quality](/en/data-quality/) problem but also a place where coverage reports say more than there really is.

Do you know how many people in your register have more than one record?
