---
services: [data-quality]
cards:
  - title: What completeness will not check
    text: Three checks worth adding to the fill rate.
  - title: Format
    text: A value only looks right if it matches the field description. Illustrative records.
    visual:
      type: fields
      items:
        - {value: "AB123456", ok: true, note: "matches format"}
        - {value: "AB 123456", note: "extra space"}
        - {value: "12.03.2019", note: "date in number field"}
  - title: Allowed values
    text: The code list allows two values, the data has six. Completeness will not notice.
    visual: {type: doc, label: "Code list: 2 values", note: "In the data: 6"}
  - title: Placeholders
    text: "\"0\", \"-\", \"unknown\", 01.01.1900. Look for them among the field's most frequent values."
    visual:
      type: flow
      items: ["Most frequent values", "Spot placeholders", "Count them as empty"]
---
Completeness says there is something in the field. A report that stops there is like checking that an envelope has a sheet of paper inside. What is written on it remains a mystery.

Here are three checks completeness will not do: format, allowed values and placeholders. Each one can run on a single field this week. Examples are illustrative.

#dataquality #datagovernance #registers #dataanalytics #govtech
