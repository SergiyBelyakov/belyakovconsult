---
---
"So everything has to move out of Power BI?" No. That is probably the most common misunderstanding when I say BI should not repair the sources.

One question is enough for me: does anyone other than this report use this rule?

Keep in BI:
• formatting, labels, category order
• filters of this specific report
• measures that describe display, not the definition of an indicator

Move into the data model and preparation layer:
• value normalisation: names, case, date formats
• mapping tables, in a table with an owner
• duplicate detection
• indicator definitions: who is a recipient, which status is active

Send back to the source:
• errors that repeat with every load

An illustrative layer scheme where this lives: raw data as it is, a cleaned layer, business logic, BI for display only. It can be a database, Power BI dataflows or a separate warehouse. The order matters more than the tool.

The breakdown with examples: {{link}}

#PowerBI #DataArchitecture #BusinessIntelligence
