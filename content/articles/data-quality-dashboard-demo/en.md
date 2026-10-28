---
title: "Data quality dashboard: don't hide the problem in an average"
description: Four indicators on the first screen, a matrix instead of one number, a target set by the data owner and a PDF report. Plus a demo on synthetic data.
date: 2026-10-30
services: [data-quality, business-intelligence]
tags: [data quality, dashboard, BI, Data Quality, demo]
carousel:
  - title: A data quality dashboard demo
    text: Six pages, filters and a one-minute PDF report. Synthetic data, real indicator logic.
    visual: {type: image, src: assets/cases/dashboard/card-overview-en.webp}
  - title: Four numbers on the first screen
    text: "Records processed\nData quality\nSource availability\nIncidents per 100K records"
    visual: {type: list, numbered: true}
  - title: The average hides the problem
    text: Overall 97.55%. One region and domain combination dropped to 93.80% in August.
    visual:
      type: compare
      highlight: right
      left: {label: "All data, full year", value: "97.55%"}
      right: {label: "One segment, August", value: "93.80%"}
  - title: A matrix instead of one number
    text: Region × domain, coloured by status against the target. Click a cell to filter everything else.
    visual: {type: image, src: assets/cases/dashboard/quality-matrix-en.webp}
  - title: A PDF report in a minute
    text: Indicators, insights, matrix, exceptions and methodology. From the current filters.
    visual: {type: image, src: assets/cases/dashboard/card-report-en.webp}
  - title: Try it yourself
    text: The demo is open on the website. Link in the post.
    visual:
      type: flow
      items: ["Open the demo", "Pick a region and domain", "Move the target", "Download the PDF"]
episodes:
  - title: The average hides the problem
    text: Six levels of aggregation of the same data. The drop shows only on the last one.
    carousel:
      - title: Almost everything looks fine
        text: "All data: 97.55%\nOdesa: 97.43%\nHealthcare: 97.41%\nAugust: 97.45%"
        visual: {type: list}
      - title: The segment over a year
        text: Odesa × Healthcare over 12 months. Slightly below target, nothing alarming.
        visual:
          type: compare
          highlight: right
          left: {label: "Target", value: "97.0%"}
          right: {label: "Segment, year", value: "96.87%"}
      - title: The segment in one month
        text: August 2026, synthetic demo data. Six times more incidents than the usual maximum.
        visual:
          type: compare
          highlight: right
          left: {label: "A usual month", value: "up to 4", note: "incidents"}
          right: {label: "August", value: "25", note: "incidents, quality 93.80%"}
      - title: What to show instead of an average
        text: "A region × domain matrix\nExceptions by month\nA target written into the methodology"
        visual: {type: list}
  - title: Sources separate from quality
    text: Records were 98.20% valid while the source kept failing. Two different problems with different owners.
    carousel:
      - title: Quality fine, source not
        text: Kharkiv × Geospatial data, June 2026 (synthetic demo data).
        visual:
          type: fields
          items:
            - {value: "Quality 98.20%", ok: true, note: "healthy"}
            - {value: "Availability 96.40%", note: "below the 99% SLA"}
            - {value: "Latency 410 ms", note: "above the 250 ms SLA"}
      - title: Invisible over a year again
        text: The source's average availability over the year is 99.06%. Formally above the SLA.
        visual:
          type: compare
          highlight: right
          left: {label: "Year", value: "99.06%"}
          right: {label: "June", value: "96.40%"}
      - title: A separate page for sources
        text: Availability, latency, refresh frequency and owner for each source.
        visual: {type: image, src: assets/cases/dashboard/sources-en.webp}
  - title: A report people read
    text: Managers rarely open a dashboard. They do open a PDF with clear methodology.
    carousel:
      - title: Three pages instead of a link
        text: Indicators, insights, quality matrix, exceptions, sources and methodology.
        visual: {type: image, src: assets/cases/dashboard/card-report-en.webp}
      - title: People set the target
        text: Segments below target on the same data. The threshold changes the picture by an order of magnitude.
        visual:
          type: bars
          items: [{label: "Target 96%", value: 5}, {label: "Target 97%", value: 94}, {label: "Target 98%", value: 256}]
          note: month × region × domain segments out of 360
      - title: This dashboard on your data
        text: Describe your sources and the decision it should support. I will reply with where I would start.
        visual:
          type: flow
          items: ["Sources", "Indicator definitions", "Target and SLA", "Dashboard and report"]
---

A data quality dashboard usually shows one big number, and it is almost always green. I built a demo that shows why one number says very little and what to show instead.

The demo runs on synthetic data: 360 records, 12 months, 6 regions, 5 domains. I planted a few problems on purpose so there is something to find. The indicator logic is the same as in real projects.

[Open the dashboard demo](/en/cases/data-quality-dashboard/){: .btn .btn-primary }

![Data quality dashboard demo: the Overview page](/assets/cases/dashboard/overview-en.webp)

## Four numbers on the first screen

Four indicators are enough for the first screen, as long as each has a written definition:

- **Records processed.** Volume gives the percentage its weight: 97% of a thousand records and of a million affect very different numbers of people.
- **Data quality.** The share of valid records: sum of valid / sum of processed. It only works when it is written down what counts as valid.
- **Source availability.** Whether the data arrived at all. I keep it separate from quality because the causes and the owners differ.
- **Incidents per 100K records.** The absolute count depends on segment size; the rate lets you compare a large region with a small one.

## The average hides the problem

In the demo, overall quality is 97.55% against a 97% target. Green. One level down, the picture barely changes:

| Aggregation level | Quality |
| --- | --- |
| All data, full year | 97.55% |
| Odesa, all domains | 97.43% |
| Healthcare, all regions | 97.41% |
| August, all segments | 97.45% |
| Odesa × Healthcare, year | 96.87% |
| Odesa × Healthcare, August | 93.80% |

The drop to 93.80% with 25 incidents (usual months have 1 to 4) appears only in the last row. The example is illustrative, but the mechanism is real: every aggregation dilutes a problem with the normal data around it.

It is like a class average: 4.5 out of 5 will not tell you that one student failed the test. The analogy is imperfect, because in data the "student" is thousands of records from one segment, and their error reaches a decision all at once.

So the demo has two things instead of one number: a region × domain matrix coloured by status, and a list of exceptions at the month × region × domain level, sorted by severity.

## The data owner sets the target, not the dashboard

In the demo, the quality target moves with a slider. On the same data, a 96% target leaves 5 of 360 segments below it, 97% leaves 94, and 98% leaves 256.

The threshold changes the picture by an order of magnitude, so it is a management decision, not a default setting. The data owner makes it together with the people who decide on that data, and writes it into the methodology.

## Sources separate from quality

Another planted case: Kharkiv × Geospatial data, June. Records are 98.20% valid, so the quality chart is all green. Yet the source's availability is 96.40% against a 99% SLA, and latency is 410 ms against 250 ms.

The source's average availability over the year is 99.06%, formally above the SLA, so the failure disappears a second time. The demo has a separate page for sources: availability, latency, refresh frequency, integration type and owner.

## A report people read

Managers rarely open a dashboard, but they read a PDF in their inbox. So the report is built in one click from the current filters: key indicators, insights, structure, the quality matrix, exceptions, source health and the calculation methodology.

The methodology inside the report matters: people who did not calculate a figure can still check it. The PDF is built in the browser and no data is sent anywhere. You can also upload your own CSV in the sample format.

## How to check your own dashboard

1. Does every indicator have a written definition, including what a "valid record" is?
2. Can you get down to a month × region × domain segment in two clicks?
3. Who set the quality target, and where is it recorded?
4. Can you see source availability separately from record quality?
5. Does the report include a methodology that lets you recalculate the figures?

If the answer is "no" to two of the five, the dashboard reassures more than it controls. More on the approach: [Data Quality](/en/data-quality/) and [Business Intelligence](/en/business-intelligence/).

The demo is open: [play with the filters and download the PDF](/en/cases/data-quality-dashboard/). Does your dashboard show averages or segments?
