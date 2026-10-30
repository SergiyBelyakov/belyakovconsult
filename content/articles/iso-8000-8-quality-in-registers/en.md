---
title: Three levels of data quality in registers
description: What ISO 8000-8 says about syntactic, semantic and pragmatic quality, and why registers need all three.
date: 2026-10-29
services: [data-quality, data-governance]
tags: [data quality, ISO 8000, registers, public sector]
promo:                    # тригер-відео (LinkedIn 4:5, Instagram EN)
  hook: "Valid format. Wrong payment."
  tag: "ISO 8000-8: three levels of data quality"
  points:
    - {label: Syntax, text: "Does the value match the format?"}
    - {label: Semantics, text: "Does it mean the right thing?"}
    - {label: Pragmatics, text: "Is it fit for the decision?"}
  cta: "Which level does your register actually measure?"
carousel:
  - title: Valid format. Wrong data
    text: A value can pass every format check and still lead to the wrong decision.
    visual:
      type: fields
      items:
        - {value: "UA-02-123", ok: true, note: "valid format"}
        - {value: "another community", note: "wrong meaning"}
        - {value: "data from 2023", note: "stale for a payment"}
  - title: Three levels of quality in ISO 8000-8
    text: "Syntactic\nSemantic\nPragmatic"
    visual: {type: grid}
  - title: What each level checks
    text: "Syntax: does it match the format\nSemantics: does it mean the right thing\nPragmatics: is it fit for the decision"
    visual: {type: list}
  - title: The register owner sets thresholds
    text: The standard gives no ready-made scales. Each field gets a threshold based on the decision it supports.
    visual:
      type: compare
      highlight: right
      left: {label: "The standard gives", value: "Concepts"}
      right: {label: "The register sets", value: "Thresholds"}
  - title: Where to start
    text: One critical field and three checks instead of one completeness percentage.
    visual:
      type: flow
      items: ["A critical field", "Format specification", "Definition and code list", "Purpose and threshold", "Regular measurement"]
episodes:
  - title: Valid format, wrong meaning
    text: The syntactic check says "yes". The semantic one asks whether it is the right thing at all.
    carousel:
      - title: Both codes pass the format
        text: "Illustrative example: the community field holds a code from the code list. The format is flawless."
        visual:
          type: fields
          items:
            - {value: "UA-02-123", ok: true, note: "applicant's community"}
            - {value: "UA-02-132", note: "neighbouring community"}
      - title: Syntax versus semantics
        text: The first level checks against a format specification, the second against the meaning in a code list.
        visual:
          type: compare
          highlight: right
          left: {label: "Syntax asks", value: "How is it written?"}
          right: {label: "Semantics asks", value: "What does it mean?"}
      - title: What semantics needs
        text: "A definition of the field in words\nA code list or classification\nA link to the real object"
        visual: {type: list}
  - title: Fit for what?
    text: Pragmatic quality depends on the decision. The same data can be fine for a report and wrong for a payment.
    carousel:
      - title: Same data, two decisions
        text: An annual report survives a six-month-old address. A payment by place of residence does not.
        visual:
          type: compare
          highlight: right
          left: {label: "Annual report", value: "Fine"}
          right: {label: "Payment", value: "No"}
      - title: A threshold per decision
        text: The standard sets no scales. The register owner defines the threshold and scale for each field and writes them down.
        visual: {type: doc, label: "Field description", note: "Threshold: ?"}
      - title: Who judges pragmatics
        text: The system can check the format and the code list. Only the decision maker can judge fitness.
        visual:
          type: flow
          items: ["Who uses the field", "For which decision", "What threshold is enough", "How often we measure"]
  - title: Check one field
    text: Three questions in 20 minutes instead of one green percentage in a report.
    carousel:
      - title: Three questions for a field
        text: "Is there a format specification\nIs there a definition and code list\nDo we know which decision it serves"
        visual: {type: list, numbered: true}
      - title: Where the answer is "not sure"
        text: That is where implementation starts. What is missing is usually not checks but a description to check against.
        visual:
          type: grid
          items: ["Format", "Meaning", "Purpose", "Threshold"]
      - title: A question for you
        text: Does your register measure only the format, or fitness for decisions too?
        visual:
          type: compare
          highlight: right
          left: {label: "Format", value: "Measured"}
          right: {label: "Fitness", value: "?", note: "Who decides it?"}
---

A data quality report for a register often comes down to two questions: is the field filled in, and is the format correct. Both matter. But a value can pass every format check and still lead to the wrong decision: about a payment, about eligibility for a service, about how funds are allocated.

The ISO 8000-8 standard (Data quality, Part 8: information and data quality concepts and measuring) suggests looking at quality on three levels. For public registers, which underpin administrative decisions and data exchange between agencies, that distinction has a practical price.

## The three levels ISO 8000-8 describes

The standard distinguishes three kinds of data quality:

- **Syntactic quality.** How well data conforms to its specified syntax: format, structure, encoding. A date is stored as a date, a code has the right number of characters, an exchange file matches its schema.
- **Semantic quality.** How well data corresponds to what it is meant to represent. This needs explicitly defined metadata or a reference to a code list: what exactly the field means and which list its values come from.
- **Pragmatic quality.** How well data is fit for the purpose of the people who use it. This is a question not for the format or the code list, but for the decision made on the data.

Syntactic and semantic quality can be checked against a specification or a reference, often automatically. Pragmatic quality cannot be judged without the data users: only they know what is enough for their decision.

## One record, three different answers

An illustrative example (the records are invented). A benefits register has a "community of residence" field holding a code from a classification.

| What is in the field | Syntax | Semantics | Pragmatics |
| --- | --- | --- | --- |
| `UA-02-123`, the applicant's community, updated a month ago | yes | yes | yes |
| `UA-02-132`, a neighbouring community (digits swapped) | yes | no | no |
| `UA-02-123`, but the person moved a year ago | yes | yes at the time of entry | no for a payment |
| `0` | no | no | no |

A format check lets the first three rows through. A completeness check lets all four through. For a payment decision only the first one is usable.

It is like an address on an envelope. The postcode can have the right number of digits (syntax) but belong to another town (semantics). And even a correct address will not help if the person no longer lives there (pragmatics). The analogy has limits: the post office returns the letter, while a register quietly makes a decision based on a wrong record.

## Why format checks are not enough for registers

Most registers control syntax well: input masks, mandatory fields, exchange schemas. This is the easiest part to automate, so this is usually where the conversation about quality ends.

The problems with a real price tend to live on the other two levels:

- **Semantics.** A code with a valid format, but from the wrong classification or the wrong version. A "date" field means the application date in one system and the decision date in another. When registers exchange data, these differences stay invisible because the format matches.
- **Pragmatics.** The data is correct but too old for a particular decision. Or precise to the community when the decision needs an address. Or updated once a year while decisions are made monthly.

Completeness, which I wrote about earlier, is only the very first step of the syntactic level: it checks whether there is anything in the field at all.

## The register owner sets the thresholds

An important detail: ISO 8000-8 does not define ready-made scales or thresholds. The standard gives concepts and prerequisites for measurement, while the organisation sets the threshold for each measured object according to its needs and should state the scale it uses.

For a register this means "good enough quality" does not appear on its own. Someone has to decide what share of records with a confirmed community is acceptable for a payment, and what share is fine for a statistical report. Naturally this is the register owner or its data steward, together with the people who make decisions based on the data.

## What implementation looks like

There is no need to start with the whole register. A few critical fields that decisions or exchanges depend on are enough:

1. **Syntax.** Write down the format specification: type, length, mask, allowed characters. Check it at entry and during exchange.
2. **Semantics.** Give the field a definition in words, link it to a versioned code list or classification, and check values against it.
3. **Pragmatics.** Name the decision the field is needed for and who makes it. Together with them, set the threshold and the scale, for example how recent the data must be.
4. **Measurement.** Calculate results regularly, separately for each level, not as one overall percentage.
5. **Correction.** Errors are fixed at the source, where they were entered, not in the next report.

The result looks modest: a table of a few fields and three columns. But it shows where the register can be trusted for a decision and where, so far, only for a report. That is work on [data quality](/en/data-quality/), not on its percentages.

## Check one field

Take a field your register uses for a payment or eligibility decision and answer three questions. Is there a written format specification? Is there a definition and a code list that values are checked against? Do you know which decision the field serves and what level of quality is enough for it?

Wherever the answer is "not sure", that is where to start. Does your register already measure fitness for decisions, or only the format so far?
