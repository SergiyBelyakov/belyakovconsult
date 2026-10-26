---
---
A 20-minute task for anyone responsible for reporting in Power BI.

Open Power Query in your main report and give every step one of three labels:
• formatting: labels, order, types for visuals
• cleaning: spaces, case, value replacements, mapping tables
• business logic: who is a recipient, which status is active, which date we count on

Usually the second pile is the biggest. And it is exactly what makes the report fragile.

What to move first:
1. Steps that repeat in two or more reports. They already cost you different numbers.
2. Manual mapping tables: into one place, with an owner.
3. Indicator definitions: into the data model, one for all reports.
4. The list of errors the report fixes every time: to the source owner.

This does not need a big rebuild. Start with one report and make sure the next one does not repeat its cleaning.

A question for you: how many steps does your largest Power Query have, and how many of them are actually treating the source?

The full piece: {{link}}

#PowerBI #PowerQuery #BusinessIntelligence
