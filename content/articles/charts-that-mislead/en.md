---
title: How report charts mislead. Six mistakes and what to use instead
description: Two Y axes, a truncated scale, a pie with ten slices, a rainbow instead of a scale. Six mistakes that make a chart say what the data does not, and their fixes.
date: 2026-12-07
draft: true
services: [business-intelligence, data-analysis]
tags: [data visualisation, dashboards, reporting, BI]
promo:
  hook: "The chart says one thing. The data says another."
  tag: "Data visualisation"
  cta: "Which chart in your reports raises the most questions?"
carousel:
  - title: Two Y axes
    text: Where the lines cross depends only on how the scales were picked.
    visual:
      type: compare
      highlight: right
      left: {label: "Two axes", value: "“a link”"}
      right: {label: "Index, January = 100", value: "honest"}
  - title: Truncated axis
    text: A 3% gap with a scale from 95 looks like a twofold one.
    visual:
      type: bars
      items: [{label: "Community A", value: 97}, {label: "Community B", value: 100}]
      note: "Scale from zero: the gap is barely visible, as in the data"
  - title: A pie with ten slices
    text: The eye cannot tell 7% from 12% slices apart. A ranked bar chart reads at once.
    visual:
      type: flow
      items: ["10 slices", "Sort by size", "Ranked bars", "Tail into “Other”"]
  - title: Rainbow instead of a scale
    text: Red, yellow and green have no order. One colour from dark to light does.
    visual:
      type: grid
      items: ["Low", "Medium", "High", "No data"]
  - title: 27 chart types explained
    text: When to use which, how to shape the table, Excel samples.
    visual: {type: doc, label: "Chart gallery", note: "Sample data for every type"}
---

A made-up but familiar scene. A slide in a meeting shows two lines, maintenance costs and the number of requests, moving almost in parallel. The conclusion suggests itself: the more we spend, the more people come to us. Then someone notices that the left and right scales are different, and if you change one of them, the lines drift apart.

A chart does not lie on purpose. But every form, every axis and every colour makes a claim. Here are six mistakes that show up most often in the reports of communities, public bodies and companies, and what to do instead.

## 1. Two Y axes on one chart

When two measures of different scale share one canvas, each gets its own axis. The ratio between the axes is arbitrary, though: squeeze one and the lines that “moved together” drift apart. Crossings, parallels and gaps between the lines mean nothing.

Instead: two charts one above the other on a shared time axis, or an index where both measures equal 100 in the first month. Then one scale shows which one grows faster. [Line chart](/en/cases/chart-gallery/#chart&t=line).

## 2. A truncated axis on bars

A scale starting at 95 instead of zero makes 97 against 100 look like a twofold gap. For bars this is especially tricky, because readers compare lengths.

Instead: bars always start at zero. If the small difference is the point, show it as a number, or as dots without a fill, where the axis does not have to start at zero. For before and after, [dumbbells](/en/cases/chart-gallery/#chart&t=dumbbell) work well.

## 3. A pie with ten slices

The eye compares angles and areas worse than lengths. With ten slices of 7 to 12% you cannot tell which is larger, and the labels pile up.

Instead: [ranked horizontal bars](/en/cases/chart-gallery/#chart&t=bar), sorted from largest to smallest, with “Other” at the bottom. A pie works when there are up to five parts and one clearly dominates. On the [pie chart page](/en/cases/chart-gallery/#chart&t=donut) of the gallery you can switch the same data to a bar and a ranking and compare.

## 4. A rainbow instead of a scale

A map or a heat table where low is red, medium yellow and high green makes readers keep checking the legend: rainbow colours have no natural order. On top of that, about one man in twelve has trouble telling red from green.

Instead: one colour from dark to light for amounts, and two opposite colours with grey in the middle when the sign matters (above or below the norm). Missing data in a separate neutral colour, not as zero. Examples: the [heatmap](/en/cases/chart-gallery/#chart&t=heatmap) and the [oblast map](/en/cases/chart-gallery/#chart&t=map).

## 5. Line spaghetti

Ten lines on one chart with ten legend colours turn into a tangle. None can be followed, and past the fifth colour they start to look alike.

Instead: highlight the one line the story is about and make the rest grey. Or show small multiples with the same axes. Or a heatmap where each series becomes a row. More than five colours on a chart almost always means part of them belongs in “Other”.

## 6. Colour as the only carrier of meaning

A red or green status without a label, lines that differ only in hue, groups of points marked only by colour. For some readers, for black-and-white print and for a projector in a bright room this information disappears.

Instead: state the status with a word and an icon next to the colour, label the ends of lines, use marker shapes for groups of points, add a table version of the chart. The [progress meter](/en/cases/chart-gallery/#chart&t=meter) that replaces a gauge is built this way.

## A five-minute check

Before sending a report, go through each chart:

1. In one sentence: what should the reader see? Is it visible in three seconds?
2. Is there one Y axis? Do bars start at zero?
3. Are there five colours or fewer? Does each colour have a job: tell apart, show amount or highlight the point?
4. Can the meaning be read without colour?
5. Are exact numbers available where people will read them: labels, tooltips or a table?

## The chart gallery

The Data Lab has a new learning section: a [gallery of 27 chart types](/en/cases/chart-gallery/) that appear most often in reports and dashboards. For each one there is guidance on when it fits and when another one is better, tips, an Excel sample with a description of every column, and a way to build the chart from your own file right in the browser. The file is not sent anywhere.

Which chart in your reports raises the most questions?
