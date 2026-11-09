---
services: [data-architecture, data-quality]
cards:
  - title: Format depends on the type
    text: One format rule for all documents lets the wrong ones through.
  - title: One rule or one per type
    text: A single rule either rejects valid documents or accepts invalid ones.
    visual:
      type: compare
      highlight: right
      left: {label: "One rule", value: "Too loose"}
      right: {label: "Per type", value: "Precise"}
  - title: What the check needs
    text: "Document type\nFormat rule for it\nA reason for rejection"
    visual: {type: grid}
  - title: Where to check
    text: At entry and on receipt. A rejected record goes back with a reason, not into a fix-up spreadsheet.
    visual:
      type: flow
      items: ["Type from a code list", "Rule for that type", "Check at entry", "Reject with a reason"]
---
One format rule for ALL documents? 🤡
It's giving "one key for every door".

The rule depends on the document type: valid for one, nonsense for another.

Swipe: start the check from the type, or the wrong ones walk right in 💀

#dataquality #dataarchitecture #registers #meme
