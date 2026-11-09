---
title: A January slump again? How to tell seasonality from a real problem
description: Every January sales fall by a third on December, and every January it looks like a crisis. Three checks that separate seasonality from a real problem.
date: 2027-02-01
draft: true
services: [business-intelligence, management-analytics]
tags: [seasonality, reporting, management analytics, data visualisation]
promo:
  hook: "Minus 38% in a month. And all is well."
  tag: "Seasonality"
  cta: "What do you compare January with in your reports?"
carousel:
  - title: Minus 38% on December
    text: Every year the January report looks like a crisis. But December is a peak every year.
    visual:
      type: compare
      highlight: right
      left: {label: "on December", value: "−38%"}
      right: {label: "on last January", value: "+10%"}
  - title: Compare with the same month
    text: January with January, not with December. The season then cancels itself out.
    visual:
      type: bars
      items: [{label: "January 2024", value: 89}, {label: "January 2025", value: 98}, {label: "January 2026", value: 108}]
      note: "Each January is higher than the last"
  - title: A rolling 12-month total
    text: It always holds one December and one January, so the season disappears.
    visual:
      type: flow
      items: ["Month on month", "On the same month last year", "Rolling 12 months", "Decision"]
  - title: When January really is a problem
    text: When it is worse than last January or the rolling total starts to fall.
    visual:
      type: fields
      items:
        - {value: "On last January", ok: true, note: "below trend: a question"}
        - {value: "Rolling 12 months", ok: true, note: "falling: a problem"}
        - {value: "On December", note: "season, not a signal"}
  - title: Ride the season yourself
    text: A game where the track is a sales chart with a peak every December.
    visual: {type: doc, label: "Scooter Cat", note: "Level 3: seasonality"}
---

An imagined scene. The first week of February, the January review. The slide shows sales down 38% on December. Someone asks what happened. The analyst explains that it is the same every year: December has holidays and bonuses, in January everyone takes a break from shopping. People listen, but the doubt stays. A year later it all repeats.

The problem is not January. It is what January is compared with. Here are three checks that take five minutes and separate seasonality from a real problem.

## 1. The same month last year, not the previous month

Month on month works when there is no season. When there is one, every comparison with the previous month mixes two things: the season and the change in the business. January against December always loses, May against April always wins.

Compare January with January. In our imagined example January 2026 is 38% below December but 10% above January 2025. The first number is about the calendar, the second is about the business.

What to add to the report: a "vs the same month last year" column next to "vs the previous month", and a chart with the years as lines on top of each other and the months along the axis. All the Januaries then stand side by side, and you can see whether each one is higher than the last.

## 2. A rolling 12-month total

The total for the last 12 months always holds exactly one December and one January. The season evens out inside it, and what is left is what management cares about: is the business growing or not.

In the same example the rolling total at the end of January 2026 is even slightly higher than at the end of December: January 2026 replaced the weaker January 2025 in it. The January "slump" is actually growth.

For weekly data a moving average over a few weeks does the same job: it removes the weekly teeth and leaves the trend.

## 3. When January really is a problem

Seasonality does not mean January is always fine. Signals worth acting on:

1. January is worse than last January while the rest of the year grew.
2. The rolling 12-month total stopped growing or started to fall.
3. January lags last year by more than months usually vary.

The first two show on one chart; the third needs a few years of history to know the usual spread.

## A five-minute check

Before the monthly review:

1. Is there a season in the data? Overlay two or three years on one chart.
2. Does the report compare with the same month last year?
3. Is there a rolling 12-month total or average?
4. Are holidays, promotions and other events that shift a month labelled on the chart?

## Ride the season yourself

The learning section of the Data Lab now has a game, [Scooter Cat: Ride the Chart](/en/cases/scooter-cat/). The track is a chart, and level three is three years of sales with a peak every December and a drop every January. The dashed line shows the same month a year earlier, and after the level there is a debrief with the numbers of the track. Eleven more levels cover other report charts, from a histogram and a Pareto chart to a waterfall, a control chart and a forecast band.

What do you compare January with in your reports?
