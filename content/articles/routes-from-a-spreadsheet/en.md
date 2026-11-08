---
title: "Routes from a spreadsheet: why zone planning costs more"
description: A dispatcher splits customers into zones and fills each vehicle while there is room. What gets lost and how to measure the gap to an optimised plan on your data.
date: 2027-01-04
draft: true
services: [geospatial-analysis, data-analysis]
tags: [logistics, routes, optimisation, dispatch]
promo:
  hook: "The vehicles leave on time and customers are happy. Nobody has counted the extra kilometres."
  tag: "Routes"
  cta: "How do you plan tomorrow's routes: in a spreadsheet, in software or in the dispatcher's head?"
carousel:
  - title: Planning by zones
    text: Each depot serves its area, a vehicle is filled while there is room. Simple and clear.
    visual:
      type: flow
      items: ["Zones around the depot", "Fill the vehicle", "Habitual order", "Departure"]
  - title: What the spreadsheet misses
    text: This is why the plan looks good and still costs more.
    visual:
      type: fields
      items:
        - {value: "Customer delivery windows", ok: false}
        - {value: "Different vehicles and tariffs", ok: false}
        - {value: "Customers swapped between depots", ok: false}
        - {value: "Closed roads and bridges", ok: false}
  - title: The gap in the demo
    text: The same 66 orders, two depots and 12 vehicles, the cost of one day.
    visual:
      type: compare
      highlight: right
      left: {label: "Manual plan", value: "UAH 77k"}
      right: {label: "Optimised", value: "UAH 51k"}
  - title: How to measure it yourself
    text: Actual trips against optimised ones on the same orders.
    visual:
      type: flow
      items: ["Orders", "Road graph", "Optimiser", "Comparison"]
  - title: Try it yourself
    text: "The route planning demo: drag a depot, slice a road, change the fleet."
    visual: {type: doc, label: "Route dispatch room", note: "Optimised vs manual plan"}
---

Many distributors plan routes the same way. Each depot has its own territory, customers are split into zones by direction, and the dispatcher fills a vehicle while there is room and time in the working day. Drivers know the order of stops themselves. The plan takes an hour to make, and it usually works: vehicles leave, customers get their goods.

## What such a plan does not show

A zone drawn by direction knows nothing about time. A supermarket receives goods until nine in the morning, a school until half past ten, a village shop until lunch. If one zone holds early customers from opposite ends of the district, the vehicle is either late or drives in a zigzag.

A spreadsheet does not compare vehicles. A semi-trailer carries more, but each of its kilometres costs more, and where two trucks would do, the semi-trailer carries half a load of air.

Depots do not swap customers. A village on the border between zones may be twenty minutes closer to the neighbouring depot, yet out of habit its own depot serves it.

And nobody calculates what a day costs. Fuel for the month is visible, but not which route eats the extra driver hours.

## What it costs

The [route planning demo](/en/cases/route-planning/) runs on synthetic data: two depots, 12 vehicles and 66 orders with delivery windows. The manual zone plan comes to UAH 77 thousand a day, the optimised one to 51 thousand: a third cheaper, a third fewer kilometres, and every order on time. On real data the gap will differ, because an experienced dispatcher knows the roads. But it can be measured, and that is where to start.

## How to measure the gap on your data

1. Take one or two weeks of orders: customer, date, pallets or weight, delivery window.
2. Build the road graph between depots and customers: distances, travel times, bridges, weight limits. The base is in open data such as OpenStreetMap, and drivers know the rest.
3. Describe the fleet and tariffs: capacity, fuel use, driver pay, fixed daily cost of each vehicle.
4. Compute the actual routes and the optimised ones on the same orders and compare cost, kilometres and lateness.

If the gap is a few percent, the plan is already good and daily monitoring is enough. If it is tens of percent, an optimiser is worth introducing.

## Where to start

Start with a dispatch room that shows the cost of every route, vehicle load and late delivery signals before departure. The optimiser comes later, once you can see where the money is lost. In the demo you can try both: switch the plan from manual to optimised, drag a depot or remove a vehicle and see the cost of the day change at once.

How do you plan tomorrow's routes: in a spreadsheet, in software or in the dispatcher's head?
