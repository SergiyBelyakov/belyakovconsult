---
title: "Clean a register without losses: orphans, duplicates and bridges"
description: Test records, similar names, links through placeholders and bridge nodes. Five data cleaning traps and how to avoid them in NetworkX, Power Query and SQL.
date: 2027-03-08
draft: true
services: [data-quality, data-governance, data-architecture]
tags: [data quality, graph analytics, duplicates, registers]
promo:
  hook: "We cleaned the register. New applicants vanished."
  tag: "Data cleaning"
  cta: "What in your register is junk, and what is simply not linked yet?"
carousel:
  - title: A cleanup that makes things worse
    text: Records without links deleted, similar names merged. New applicants are gone and different people are merged into one.
    visual:
      type: compare
      highlight: right
      left: {label: "expected", value: "clean register"}
      right: {label: "got", value: "new losses"}
  - title: An orphan is not always junk
    text: "Remove a test record with no links. Keep a new record with no links: it simply has not been linked yet."
    visual:
      type: flow
      items: ["No links", "Creation date", "Test patterns", "Decision"]
  - title: A similar name is not a duplicate
    text: Merge on a key (company code, date of birth), not on the name. Namesakes with a different key are different people.
    visual:
      type: compare
      highlight: left
      left: {label: "same key", value: "merge"}
      right: {label: "different key", value: "keep"}
  - title: Placeholders and bridges
    text: A link through “phone 000 000 00 00” is false. A bridge node holds the network together and must not be deleted.
    visual:
      type: bars
      items: [{label: "Components before", value: 1}, {label: "After deleting a bridge", value: 3}]
      note: "Parts of the network"
  - title: Play it
    text: Pac-Man on a relationship graph. Five levels, five traps and a work tip after each one.
    visual: {type: doc, label: "Robo Vac and the Graph", note: "Data Lab"}
---

A fictional situation. A community social services register: people, households, facilities, social workers and the links between them. Before analysing the support network, an analyst decides to “clean” the data first. They delete every record without links, merge similar names and remove odd nodes. A week later it turns out that new applicants are gone, two different Olena Petrenkos have been merged into one, and the network has fallen apart into several islands.

Data cleaning is needed. But there are five traps that are easy to fall into when you look at names instead of keys and structure.

## 1. An orphan is not always junk

A record with no links is often a test: “TEST TEST”, “xxx”, “Client 1”, a record without a name or with a birth date of 01.01.1900. Such a record ends up in customer counts and reports, and it should go.

But a new applicant also starts without links: they have not yet been linked to a household or a facility. Before deleting, look at the creation date and the source. In NetworkX, isolated nodes come from `list(nx.isolates(G))`; in SQL it is a LEFT JOIN to the links table with `WHERE link_id IS NULL`. Exclude records created in the last 30 days and look for tests by pattern.

## 2. A similar name is not a duplicate

“Sunny Field LLC” and “LLC Sunny Field” with the same company code are a duplicate. “Olena Petrenko, 12.03.1958” and “Olena Petrenko, 27.08.1990” are two different people. A false merge is worse than a duplicate: two people’s data gets mixed and is harder to untangle than to merge.

In Power Query, fuzzy matching (similarity threshold 0.8) only gives candidates. Merge when the key matches exactly. Keep the most complete record as the golden one and move the duplicate’s links to it, not the other way round.

## 3. Placeholders create false links

When the phone is unknown, people type “000 000 00 00”. When the address is unknown, “unknown”. If you build links on a shared phone or address, all of these people become “linked”. The network swells, and the search for shared patterns produces false matches.

Finding placeholders is easy: `SELECT phone, COUNT(*) FROM person GROUP BY phone HAVING COUNT(*) > 20`. Put such values on a stop list and do not build links on them. Keep a genuinely shared number of a married couple or a family.

## 4. Bridges hold the network together

A social worker who supports people in two communities can be the only node between them. Delete her as “a record with little data” and the network falls apart, and the analysis shows two isolated communities.

In NetworkX, bridge nodes come from `nx.articulation_points(G)` and bridge edges from `nx.bridges(G)`. Before deleting or merging a node, check whether the number of components grows. And remove false links before the analysis, because they hide the real bridges.

## 5. Junk comes back from the source

If an import from another system has no checks, tests, duplicates and placeholders return after every load. Cleaning turns into a weekly ritual.

A rule at entry: required keys, a stop list of placeholders, a duplicate search before insert, and doubtful rows into a quarantine table. Fix the source, not the report.

## A check before cleaning

1. Have new records been excluded before deleting orphans?
2. Do you merge on a key rather than on name similarity?
3. Is there a stop list of placeholders for phones, addresses and email?
4. How many components does the graph have before and after cleaning?
5. Is there a rule on the import that will not let the same junk in again?

## Play it

The Data Lab now has a game, [Robo Vac and the Graph](/en/cases/vacuum-graph/): Pac-Man where the maze is a relationship graph. A kitten on a robot vacuum sucks up test records, merges duplicates into the golden record, cuts links through placeholders and steers around bridges. Five levels match the five traps from this text, and after each one there is a debrief of mistakes and a tip on how to do the same at work.

What in your register is junk, and what is simply not linked yet?
