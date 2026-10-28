---
services: [data-quality, data-architecture]
cards:
  - title: Right format, wrong meaning
    text: How syntactic quality differs from semantic quality.
  - title: An illustrative example
    text: Both codes pass the format check.
    visual:
      type: fields
      items:
        - {value: "UA-02-123", ok: true, note: "our community"}
        - {value: "UA-02-132", note: "another community"}
  - title: What meaning needs
    text: "A field definition\nA versioned code list\nA check against reality"
    visual: {type: list}
  - title: Order of checks
    text: Shape first, then meaning, then fitness.
    visual:
      type: flow
      items: ["Format", "Value in the code list", "Fit for the decision"]
---
Syntax and semantics sound like a linguistics lecture. In a register, though, the difference is very practical: a value can have a flawless format and still point to the wrong object.

Swipe for an illustrative example and what it takes to check the meaning, not just the shape.

#dataquality #registers #iso8000 #datagovernance #govtech
