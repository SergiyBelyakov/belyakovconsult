---
---
How do you tell whether your register works on data quality at all three levels of ISO 8000-8, not just the format? I would start with one field.

Take a field that a payment or eligibility decision depends on. And answer three questions:

1. Syntax. Is there a written format specification: type, length, mask, allowed characters?
2. Semantics. Is there a plain-words definition of the field and a versioned code list that values are checked against?
3. Pragmatics. Do you know which decision the field serves, who makes it and what quality threshold is enough?

Twenty minutes, and you see where the register can be trusted for decisions and where, so far, only for a report.

Wherever the answer is "not sure", that is where implementation starts. Often what is missing is not the checks themselves but a description to check against. A format check is easy to write. Agreeing what the field means and what threshold is acceptable is harder, because that is the register owner's decision.

A question for you: does your register already measure fitness for decisions, or only the format so far?

The full piece with an illustrative example: {{link}}

#DataQuality #DataGovernance #PublicSector
