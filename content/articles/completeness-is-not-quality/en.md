---
title: 98% complete does not mean 98% quality
description: Why a high completeness rate says little about whether registry data is usable, and which checks reveal its real quality.
date: 2026-10-28
services: [data-quality, data-governance]
tags: [data quality, registries, public sector]
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
