---
services: [data-quality]
cards:
  - title: Where duplicates come from
    text: One person, several records. And the culprit is usually the process, not a person.
  - title: Typical causes
    text: "A typo in the name\nA different transliteration\nA new document after renewal\nEntry in different offices"
    visual: {type: list}
  - title: What they break
    text: "Recipient counts\nRepeat payments\nService coverage"
    visual: {type: grid}
  - title: Where to fix it
    text: You can clean the report every month. But the duplicate comes back while the form lets it in.
    visual:
      type: compare
      highlight: right
      left: {label: "In the report", value: "Every month"}
      right: {label: "At the source", value: "Once"}
---
A duplicate almost never appears because one person was careless. Usually the process creates it: the form does not say the person is already in the register, and different offices enter names their own way.

Swipe: where duplicates come from and why they should be removed at the source, not in the report.

#dataquality #registers #dataanalytics #datagovernance #govtech
