---
services: [data-quality]
cards:
  - title: Filled in is not usable
    text: What completeness sees and what it misses.
  - title: All of this is "filled in"
    text: Illustrative records.
    visual:
      type: fields
      items:
        - {value: "AB123456", ok: true, note: "usable"}
        - {value: "-", note: "placeholder"}
        - {value: "unknown", note: "placeholder"}
  - title: Show two columns
    text: The gap between them is the real amount of work.
    visual:
      type: compare
      highlight: right
      left: {label: "Filled in", value: "98%"}
      right: {label: "Usable", value: "?"}
---
98% complete looks like good news. But completeness answers only one question: is there anything in the field at all.

Swipe for what hides behind "filled in" and what to show leadership instead of one percentage.

#dataquality #datagovernance #registers #dataanalytics #govtech
