---
services: [data-quality, data-governance]
cards:
  - title: Placeholders look like data
    text: How to find them in five minutes, and why they appear.
  - title: Sort by frequency
    text: Placeholders are almost always at the top.
    visual:
      type: bars
      items: [{label: "\"0\"", value: 1840}, {label: "\"-\"", value: 960}, {label: "01.01.1900", value: 410}]
      note: "Illustrative data"
      thousands: ","
  - title: Why they appear
    text: "Mandatory field, no honest option\nValue unknown at entry\nNo \"not applicable\" choice"
    visual: {type: list}
  - title: What to change
    text: Fix the form, then count placeholders as empty.
    visual: {type: doc, label: "Entry form", note: "Add \"unknown\""}
---
"0", "-", "unknown", "01.01.1900". All of them make a field look complete. None of them can be used for a decision.

Swipe for how to find placeholders in five minutes and what to change so they stop appearing.

#dataquality #datagovernance #registers #dataanalytics #govtech
