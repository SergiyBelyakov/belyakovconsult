---
services: [business-intelligence, data-quality]
cards:
  - title: Three reports, three totals
    text: Same source, different cleaning. An illustrative example.
  - title: One region, many spellings
    text: Each report fixes a different subset. Values are illustrative.
    visual:
      type: fields
      items:
        - {value: "Kyiv region", ok: true, note: "reference"}
        - {value: "Kyiv reg.", note: "abbreviation"}
        - {value: "kyiv region ", note: "case, trailing space"}
        - {value: "Kyivska obl.", note: "other spelling"}
  - title: Why totals drift
    text: Each report merges a slightly different set of spellings.
    visual:
      type: flow
      items: ["Same source", "Three cleaning rules", "Three totals"]
  - title: One rule instead of three
    text: Clean once, in a shared layer of the data model, and let every report reuse it.
    visual:
      type: compare
      highlight: right
      left: {label: "Before", value: "3 rules"}
      right: {label: "After", value: "1 rule"}
---
Three reports use the same source and still disagree. Often nobody made a calculation error: each report simply cleans the data its own way.

In the cards: how one region name turns into several (the values are illustrative), why totals drift apart, and what changes when the cleaning moves into one shared place.

#dataquality #powerbi #businessintelligence #datagovernance #dataanalytics
