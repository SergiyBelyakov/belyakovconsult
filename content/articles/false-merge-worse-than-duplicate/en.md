---
title: A false merge is worse than a duplicate. How not to fuse two people
description: Deduplicating by name merges namesakes and mixes two people’s data. Why a false merge costs more than a missed duplicate, and which rules stop it.
date: 2026-12-14
draft: true
services: [data-quality, data-governance]
tags: [duplicates, data quality, registers, data governance]
promo:
  hook: "Two Ivan Kovalenkos became one. The wrong one got the payment."
  tag: "Duplicates and namesakes"
  cta: "How does your register decide that two records are one person?"
carousel:
  - title: Two records, one name
    text: Kovalenko Ivan and Kovalenko Ivan. A duplicate or two different people?
    visual:
      type: compare
      left: {label: "born", value: "12.03.1985"}
      right: {label: "born", value: "07.11.1992"}
  - title: The name only confirms
    text: Match on stable data, not on the full name.
    visual:
      type: fields
      items:
        - {value: "Tax ID", ok: true, note: "strongest key"}
        - {value: "Phone, email", ok: true, note: "after normalising"}
        - {value: "Date of birth", ok: true, note: "different = different people"}
        - {value: "Full name", note: "confirmation only"}
  - title: Errors are not equal
    text: A missed duplicate counts a person twice. A false merge mixes two.
    visual:
      type: compare
      highlight: right
      left: {label: "Duplicate", value: "×2 in the report"}
      right: {label: "False merge", value: "someone else’s data"}
  - title: A merge must be reversible
    text: A merge log and links to the source records let you untangle a mistake.
    visual:
      type: flow
      items: ["Merge candidates", "Automatic only when certain", "Doubtful ones to review", "Log and undo"]
  - title: Practise on namesakes
    text: "Level three of the Laser Kitty game: duplicates and namesakes that must not be merged."
    visual: {type: doc, label: "Laser Kitty", note: "Level 3: duplicates"}
---

A made-up but familiar scene. An aid recipients register has two records: Kovalenko Ivan and Kovalenko Ivan. The same community, similar addresses. During a duplicate clean-up an analyst sees identical names and merges them. A month later one Ivan does not receive his payment because his account was replaced by the other one’s, and the other receives a debt notice that is not his.

Duplicates do harm, and people talk about them a lot. A false merge does more harm, and it is rarely counted.

## A duplicate and namesakes look the same

A duplicate is one person recorded twice: a phone in another format, an initial instead of the first name, capitals, swapped first and last name, a typo. Namesakes are two different people with the same first and last name. Common surnames are few, so in a register of tens of thousands of records namesakes are frequent.

If you look for duplicates by full name, namesakes automatically become “duplicates”.

## Why the errors are not equal

A missed duplicate means a person is counted twice: an inflated number of recipients, two letters instead of one, a double payment that can be found and recovered.

A false merge means two people’s data fused into one record. One person’s request history, account, contacts and status now belong to another. Untangling it is hard: after the merge nobody knows which fields belonged to whom. If merges are not logged, restoring the source records is often impossible.

So the goal of deduplication is not “find as many duplicates as possible” but “do not make a wrong merge”.

## Rules that stop false merges

1. Build the match key from stable data: tax ID, normalised phone, normalised email. The name only confirms the match.
2. Different dates of birth mean different people. Such pairs are never merged automatically.
3. Only confident matches are merged automatically. Doubtful pairs go to a person for review, with an explanation of why the system thinks they are similar.
4. Every merge is logged: which records, who, when, by which rule. The merged record keeps links to the source records, and a merge can be undone.
5. Besides the number of duplicates found, count false merges too: check a sample of merged pairs every month.

## A thirty-minute check

Take 20 pairs of records merged last month. For each pair check the date of birth and the tax ID if present. If even one pair has different dates of birth, the merge rules need a review, and the merged records should be untangled while that is still possible.

## Practise

The Data Lab learning section has a game, [Laser Kitty vs the Data Bugs](/en/cases/laser-kitty/). On level three record bugs fly in formation, among them duplicates in different formats and namesakes with different birth dates. Duplicates must be merged with a beam and namesakes let through: a false merge costs points, and the game explains what went wrong.

How does your register decide that two records are one person?
