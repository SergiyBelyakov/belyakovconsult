---
services: [data-quality, data-governance]
cards:
  - title: The machine suggests, a person decides
    text: How to look for duplicates without merging two different people.
  - title: A split of work
    text: Fast where it can be, careful where it must be.
    visual:
      type: flow
      items: ["Normalise the fields", "Score similar pairs", "A person reviews top pairs", "Log every merge"]
  - title: Why a person stays in the loop
    text: "Illustrative: same name, same birth date, different people. It happens more often in big registers."
    visual:
      type: compare
      highlight: right
      left: {label: "Algorithm", value: "Looks alike"}
      right: {label: "Person", value: "Same or not"}
  - title: Never delete
    text: Mark the duplicate, link it to the master record, keep the history of payments.
    visual: {type: doc, label: "Merge log", note: "Who, when, why"}
---
Algorithm: "these two look the same" 🤖
Me: bro, that is two different people with the same name and birthday 💀

The machine finds look-alikes. A human decides if it is one person or two.

Swipe: machine suggests, human decides, every merge leaves a trace. No cap.

#dataquality #datagovernance #registers #meme
