---
title: BI should not be the place where source systems are repaired
description: Why cleaning and stitching data inside Power BI makes reports fragile, and which part of that work belongs in the data model.
date: 2026-11-05
services: [business-intelligence, data-architecture]
tags: [Power BI, data model, BI, data architecture]
carousel:
  - title: A report that repairs data daily
    text: Every refresh merges name variants and restores codes again. Illustrative example.
    visual:
      type: fields
      items:
        - {value: "Kyiv", ok: true, note: "reference"}
        - {value: "Kyiv city", note: "replaced every time"}
        - {value: "KYIV", note: "different case"}
  - title: Signs that BI is treating the sources
    text: "Dozens of value replacement steps\nA mapping table in Excel\nThe same cleaning in several reports\nIndicator definitions in DAX"
    visual: {type: list}
  - title: Why this is fragile
    text: The error in the source stays forever, and the report hides it every day. Only the file's author knows about it.
    visual:
      type: compare
      highlight: right
      left: {label: "Fix in BI", value: "Every time"}
      right: {label: "Fix at the source", value: "Once"}
  - title: Preparation layers
    text: An illustrative scheme. The order matters more than the tool.
    visual:
      type: flow
      items: ["Raw data as it is", "Cleaned layer", "Business logic", "BI: display only"]
  - title: Start with one report
    text: Mark each Power Query step as formatting, cleaning or logic. Move what repeats across reports first.
    visual: {type: doc, label: "Power Query: steps", note: "How many treat the source?"}
episodes:
  - title: Four signs that BI is treating the sources
    text: If you recognise two of them, the report rests on one file and one person.
    carousel:
      - title: Replacements in Power Query
        text: Every refresh fixes the same errors all over again. Illustrative example.
        visual:
          type: fields
          items:
            - {value: "Kyiv", ok: true, note: "reference"}
            - {value: "Kyiv city", note: "replaced"}
            - {value: "KYIV", note: "replaced"}
            - {value: " Kyiv ", note: "spaces"}
      - title: A mapping table in someone's Excel
        text: The lookup table sits next to the report, and one person knows about it.
        visual: {type: doc, label: "mapping_final_v3.xlsx", note: "Who owns it?"}
      - title: The same, but different
        text: One source, two reports, two ways of cleaning. And two different numbers in the meeting.
        visual:
          type: compare
          highlight: right
          left: {label: "Report A", value: "Own rules"}
          right: {label: "Report B", value: "Other rules"}
      - title: Definitions hidden in DAX
        text: Business rules inside measures are visible only to the report's author.
        visual:
          type: list
          items: ["Who counts as a recipient", "Which status is active", "Which date we count on"]
  - title: What to keep in Power BI
    text: Not everything has to move. The key question is whether anyone else uses this rule.
    carousel:
      - title: Keep in BI
        text: What concerns only this report.
        visual:
          type: list
          items: ["Formatting and labels", "Filters of this report", "Measures for visuals"]
      - title: Move into the data model
        text: "Value normalisation\nMapping tables\nDuplicate detection\nIndicator definitions"
        visual: {type: grid}
      - title: Send back to the source
        text: Errors that keep repeating get fixed where they are entered.
        visual:
          type: compare
          highlight: right
          left: {label: "In the report", value: "Hide it"}
          right: {label: "At the source", value: "Fix it"}
      - title: Illustrative preparation layers
        text: A database, dataflows or a warehouse. The order matters more than the tool.
        visual:
          type: flow
          items: ["Raw data as it is", "Cleaned layer", "Business logic", "BI: display only"]
  - title: Audit one report in 20 minutes
    text: Open Power Query in your main report and sort the steps into three piles.
    carousel:
      - title: Three piles of steps
        text: "Formatting\nCleaning\nBusiness logic"
        visual: {type: grid}
      - title: What to move first
        text: Start with what already costs you several different numbers.
        visual:
          type: flow
          items: ["Steps in 2+ reports", "Manual mapping tables", "Indicator definitions", "List of source errors"]
      - title: A question for you
        text: How many steps in your largest Power Query actually fix the source?
        visual:
          type: compare
          highlight: right
          left: {label: "Steps in report", value: "?"}
          right: {label: "Treat the source", value: "?", note: "Count them separately"}
---

If Power BI cleans names, stitches reference lists and rebuilds logic that does not exist in the source on every refresh, the report becomes fragile. It works until something changes in the source. Part of that work belongs in the data model and preparation rules, and part of it belongs back where the errors appear.

## What BI that "treats" the sources looks like

An illustrative but very familiar example. A report on service recipients is built from a register. Power Query (the data preparation editor in Power BI) has several dozen steps: trim leading spaces from names, turn "Kyiv city", "Kyiv" and "KYIV" into one value, pull region codes from a separate file, filter out test records by the word "test" in the surname.

The report shows nice numbers. But look at the signs:

- **Dozens of value replacement steps.** Every refresh fixes the same errors again, because nobody fixed them in the source.
- **A mapping table in Excel.** The "what it was, what it should be" table sits next to the report, often named something like `mapping_final_v3.xlsx`. It has no owner apart from the report's author.
- **The same cleaning in several reports.** Each analyst writes their own version, slightly differently. One source, two numbers in the meeting.
- **Indicator definitions live in DAX** (the Power BI formula language). Who counts as a recipient, which status is active, which date we count on: a measure in the report decides that, not an agreed rule.
- **The refresh breaks on Monday morning** because someone renamed a column in the source or added a new spelling.

If you recognise two or three of these, the report rests on one file and one person.

## Why this is fragile

It is like a stain on the ceiling from a leaking roof. You can repaint it every month and the ceiling will look tidy. But the roof still leaks, and the paint costs you every time.

The analogy has limits: everyone can see a stain on the ceiling, while a fix in Power Query is visible only to the file's author. And every room is painted with its own paint, meaning every report cleans the data its own way.

That leads to four practical consequences:

1. **The error in the source lives forever.** The people who enter the data never learn they are entering it wrong.
2. **Different reports give different numbers**, because their cleaning differs slightly.
3. **Knowledge sits with one person.** A holiday or a resignation, and the report turns into a black box.
4. **Refresh becomes slow and unpredictable**, because heavy preparation runs every time in every report.

## What to keep in Power Query and what to move out

You do not need to move everything. One question helps: does anyone other than this report use this rule?

**Keep in BI:**

- formatting, labels, category order for visuals;
- filters that concern only this report;
- light reshaping of a table for a specific chart;
- measures that describe display, not the definition of an indicator.

**Move into the data model and preparation layer:**

- normalisation of values: names, case, date and number formats;
- mapping tables, in a table with an owner rather than in someone's file;
- finding and handling duplicates;
- indicator definitions: who is a recipient, which status is active, which cut-off date;
- joining data from different systems.

**Send back to the source:**

- errors that repeat with every load. They should be fixed where data is entered: a rule in the form, a reference list instead of free text, a check at entry.

## An illustrative example of preparation layers

The scheme below is not tied to a specific tool. It can be a database, Power BI dataflows or a separate warehouse. The order matters more than the technology.

1. **Raw layer.** A copy of the source data as it is, with the load date. Nothing is fixed here, so you can always check what arrived.
2. **Cleaned layer.** Correct types, formats and normalised values. Mapping tables connect here, and each one has an owner.
3. **Business logic layer.** Indicator definitions and the tables reports are built from: who is a recipient, which statuses, which cut-off date. One definition for all reports.
4. **BI.** Visuals, filters and measures on top of a ready model. The report displays, it does not repair.

Separately from the layers, keep a list of errors found during cleaning. It goes to the source owner, so the number of fixes shrinks over time instead of growing.

## How to start without a big rebuild

1. Open Power Query in your main report and mark each step: formatting, cleaning or business logic.
2. Find the steps that repeat in two or more reports. Move those first: they already cost you different numbers.
3. Bring the manual mapping tables into one place and give them an owner.
4. List the errors the report fixes every time and send it to the source owner.
5. Whatever stays in the report should concern display only.

After a few of these steps, [Business Intelligence](/en/business-intelligence/) goes back to what it is for: helping people make decisions. And the preparation rules become part of the [data architecture](/en/data-architecture/) instead of the secret of a single file.

A question for you: how many steps does your largest Power Query have, and how many of them are actually treating the source?
