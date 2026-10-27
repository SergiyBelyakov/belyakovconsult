---
services: [data-quality, data-governance]
cards:
  - title: How duplicates appear
    text: Four common routes into a register, and the fix that works.
  - title: Four routes
    text: "Typos\nTransliteration\nA new document\nAnother office"
    visual: {type: grid}
  - title: Delete or merge?
    text: Deleting loses history, such as payments and decisions linked to the record.
    visual:
      type: compare
      highlight: right
      left: {label: "Delete", value: "History lost"}
      right: {label: "Merge", value: "History kept"}
  - title: What works
    text: Show similar records at entry, before a new one is created.
    visual:
      type: flow
      items: ["Similar record check", "A person decides", "Merge with history"]
---
One person, three records. It happens in registers more easily than it sounds, and rarely because someone was careless.

In the cards: four common ways duplicates appear, why deleting them is the wrong fix, and what to do instead. Everything here is illustrative, but the patterns will be familiar to anyone who works with a large register.

#dataquality #registers #datagovernance #govtech #dataanalytics
