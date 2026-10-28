---
services: [data-architecture, data-quality]
cards:
  - title: The number matched. The document did not
    text: Why one number is not enough to match registers.
  - title: An illustrative example
    text: Same digits, different documents and people. The records are invented.
    visual:
      type: fields
      items:
        - {value: "123456", note: "birth certificate"}
        - {value: "123456", note: "passport"}
        - {value: "123456", ok: true, note: "type + number: different"}
  - title: What to send in the exchange
    text: "Document type from a code list\nSeries as a separate field\nNumber as text"
    visual: {type: list, numbered: true}
---
The same digits do not mean the same document. In registers with several document types numbers can coincide, and matching by number alone mistakes the coincidence for success.

Swipe: an illustrative example of such a match and what to add to the exchange so it does not become an error.

#dataarchitecture #dataquality #registers #datainterchange #govtech
