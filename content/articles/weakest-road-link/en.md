---
title: "A bridge under repair: finding the weak links in a road network"
description: Closing a bridge or a ferry breaks routes, and the plan does not show which links are critical. How a road graph reveals bottlenecks, dead ends and weight limits.
date: 2027-01-11
draft: true
services: [geospatial-analysis, data-analysis]
tags: [logistics, graph analytics, roads, risks]
promo:
  hook: "The bridge closed for repairs on Monday. By Tuesday half the routes were taking detours."
  tag: "Road network"
  cta: "Do you know which road link is the most critical for your logistics?"
carousel:
  - title: Roads as a graph
    text: Settlements are nodes, road links are edges with travel time, class and limits.
    visual:
      type: flow
      items: ["Road map", "Graph", "Fastest paths", "Weak links"]
  - title: What to look for
    text: "Critical links\nDead ends with a single road\nJunction hubs\nWeight limits on bridges"
    visual: {type: list}
  - title: The price of a closed bridge
    text: In the demo the city bridge is closed. How much more the day costs.
    visual:
      type: compare
      highlight: right
      left: {label: "Routes unchanged", value: "+UAH 10.7k"}
      right: {label: "Recomputed", value: "+UAH 0.3k"}
  - title: How to prepare
    text: Scenarios are computed in advance, not on the day of the closure.
    visual:
      type: flow
      items: ["Link ranking", "Dead ends", "Scenarios", "Fast recompute"]
  - title: Try it yourself
    text: "The route planning demo: slice a road with the knife and see what changes."
    visual: {type: doc, label: "The road network as a graph", note: "Critical links and a map in minutes"}
---

When a road or a bridge closes, logistics finds out in the morning and counts the damage in the evening: how many vehicles took a detour, who was late, how much extra fuel was burnt. Yet most of these problems can be seen in advance if you look at the roads not as a map but as a graph.

## Roads as a graph

In a graph, settlements are nodes and road links are edges with length, travel time, class and limits. Bridges and ferries are separate edges that can be closed to see what changes. On such a graph, algorithms find the fastest paths, and with them the weak links of the network.

## What to look for

Critical links. For each road your vehicles use, you can compute how much more the day costs if it closes. A ranking of such links shows where a backup plan is needed.

Dead ends. If a single road leads to a village, closing it cuts the customer off completely. In graph theory these are bridges of the graph, and they are found automatically.

Junction hubs. Some settlements carry most of the fastest paths. A problem there hits many routes. They are also good candidates for a transfer point.

Weight limits. An old bridge rated for 10 tonnes or a ferry for 20 lets a van through but not a semi-trailer. The road exists on the map, but not for a heavy vehicle.

## Why recomputing matters more than knowing detours

In the [route planning demo](/en/cases/route-planning/), closing the city bridge without changing the routes costs about UAH 10.7 thousand a day: vehicles visit the same stops but take detours. If the plan is recomputed, the depot on the other bank takes over part of the customers, and the day costs only a few hundred hryvnias more. So the best protection against a closed road is not only knowing the detours but quickly recomputing the whole plan.

The same demo shows the opposite case: dead-end links to single villages have no substitute, and any closure means an undelivered order. Such customers need a different backup plan: a stock buffer, an agreed alternative date or delivery by a smaller vehicle on another road.

## How to prepare

1. Build the road graph for your routes: open road data plus what drivers know, that is seasonal closures, weight limits and ferries.
2. Compute the ranking of critical links for a typical day and find the dead ends.
3. For the five most critical links, compute the scenarios in advance: closure, flood, black ice.
4. Keep an optimiser at hand to recompute the plan in minutes on the day of a closure, not by hand.

Do you know which road link is the most critical for your logistics?
