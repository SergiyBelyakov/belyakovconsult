---
title: 98% complete does not mean 98% quality
description: Why a high completeness rate says little about whether registry data is usable, and which checks reveal its real quality.
date: 2026-11-02
services: [data-quality, data-governance]
tags: [data quality, registries, public sector]
carousel:
  - title: Completeness answers only one question
    text: Is there anything in the field. Not whether you can trust it.
    visual:
      type: compare
      highlight: right
      left: {label: "Completeness asks", value: "Is it there?"}
      right: {label: "Quality asks", value: "Can we trust it?"}
  - title: Filled in, but not usable
    text: "All of this counts towards 98%. Records are illustrative."
    visual:
      type: fields
      items:
        - {value: "AB123456", ok: true, note: "usable"}
        - {value: "0", note: "placeholder"}
        - {value: "12.03.2019", note: "date, not a number"}
        - {value: "123456", note: "series in another field"}
  - title: What completeness cannot see
    text: "Format\nAllowed values\nPlaceholders\nConsistency across fields\nUniqueness"
    visual: {type: list}
  - title: Start from the decision
    text: A payment and a register match depend on different fields and different rules.
    visual:
      type: flow
      items: ["Decision: payment or match", "Fields it depends on", "Rule in plain words", "Regular check"]
  - title: Two columns instead of one percentage
    text: The gap between them is the real amount of work.
    visual:
      type: compare
      highlight: right
      left: {label: "Filled in", value: "98%"}
      right: {label: "Fit for use", value: "?", note: "Count it separately"}
episodes:
  - title: Placeholders count too
    text: "\"0\", \"-\", \"unknown\" and 01.01.1900 formally fill the field. And honestly land in the 98%."
    carousel:
      - title: You can find them in 5 minutes
        text: Sort the field values by frequency. Placeholders are almost always at the top.
        visual:
          type: bars
          items: [{label: "\"0\"", value: 1840}, {label: "\"-\"", value: 960}, {label: "01.01.1900", value: 410}]
          note: "Illustrative data: most frequent values"
          thousands: ","
      - title: Where they come from
        text: "The form will not save an empty field\nThe value is not known yet at entry\nThere is no \"not applicable\" option"
        visual: {type: list}
      - title: What to do about it
        text: A placeholder is not a person's mistake. It shows where the form stops people from entering the truth.
        visual:
          type: flow
          items: ["List placeholders per field", "Count them as empty", "An honest \"unknown\" in the form", "Checks at data entry"]
  - title: Show two columns
    text: "\"Filled in\" and \"usable\". The gap between them is the real amount of work."
    carousel:
      - title: Where conclusions get distorted
        text: "Coverage\nUnique recipients\nAmount paid"
        visual: {type: grid}
      - title: A rule instead of a percentage
        text: For every critical field.
        visual:
          type: flow
          items: ["Business rule in plain words", "A regular check", "Share that passes", "Who fixes it at the source"]
      - title: A question for you
        text: For your main register, do you know not only completeness but also the share of usable records?
        visual:
          type: compare
          highlight: right
          left: {label: "Completeness", value: "98%"}
          right: {label: "Usable", value: "?", note: "Count it separately"}
---

Data quality reports often open with completeness: the “document number” field is filled in 98% of records. The number looks reassuring. Yet it answers only one question: is there anything in the field at all?

## What hides behind “filled in”

An illustrative example from a register of service recipients (records are made up):

| Field value | Filled in? | Usable? |
| --- | --- | --- |
| `AB123456` | yes | yes |
| `AB 123456` | yes | after normalisation |
| `123456`, series in another field | yes | only together with that field |
| `0` or `-` | yes | no |
| `12.03.2019` instead of a number | yes | no |

All five records count towards the 98%. Only some of them can be used to match against another register, find duplicates or check eligibility for a payment.

## Completeness is the first check, not a quality score

Typical problems completeness cannot see:

- **Format.** Dates in several formats, numbers with and without spaces, Latin letters instead of Cyrillic.
- **Allowed values.** The reference list expects two values; the data holds six.
- **Placeholders.** “0”, “-”, “unknown”, “01.01.1900” formally fill the field.
- **Wrong field.** A document series typed into the number field, a comment in the address field.
- **Consistency across fields.** A document issued before the holder was born.
- **Uniqueness.** The same document number for different people.

## Which checks to use instead of one percentage

Start from the decision made with this data, not from a metric. If the field is used to match another register, format, document type and uniqueness matter. If a payment depends on it, allowed values and consistency with other fields matter.

Then, for each critical field:

1. Write the business rule in plain words.
2. Turn it into a check that runs regularly, not once before a report.
3. Count the share of records that pass, separately from completeness.
4. For records that fail, decide who fixes the error at the source, not in the report.

## How to show it to leadership

Instead of one number, show two columns: “filled in” and “fit for use”. The gap between them is the real amount of work. It also shows where a report’s conclusion may be distorted: coverage, the number of unique recipients, the total paid out.

When the gap is large, the problem is rarely analytics. More often there are no data entry rules and no one who owns the field. That is where [data governance](/en/data-governance/) begins.

A question to check yourself: for your key register, do you know not just completeness, but the share of records fit for use?
