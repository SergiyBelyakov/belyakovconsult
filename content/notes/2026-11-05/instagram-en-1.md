---
services: [business-intelligence, data-architecture]
cards:
  - title: Is your BI repairing the source?
    text: Four signs and a one-minute test.
  - title: Four signs
    text: "Dozens of replace steps\nA mapping file with no owner\nThe same cleaning in several reports\nDefinitions hidden in DAX"
    visual: {type: list}
  - title: The one-minute test
    text: Could a colleague explain the numbers without the author of the file?
    visual:
      type: compare
      highlight: right
      left: {label: "Yes", value: "Robust"}
      right: {label: "No", value: "Fragile"}
  - title: Where to start
    text: Pick the cleaning step that more than one report depends on.
    visual:
      type: flow
      items: ["Find shared cleaning", "Name an owner", "Move it out of BI"]
---
A report can show the right number and still be fragile. The question is where the cleaning happens.

Four signs that your BI is quietly repairing the source, and a one-minute test: could a colleague explain the numbers without the author of the file? If not, the cleaning probably lives in the wrong place.

#powerbi #businessintelligence #dataquality #dataarchitecture #dataanalytics
