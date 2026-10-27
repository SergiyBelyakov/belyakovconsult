---
---
An illustrative example. The "community of residence" field holds the code `UA-02-132` when it should be `UA-02-123`. Someone swapped two digits.

Both codes are in the code list. Both have a valid format. The syntax check honestly says "yes", and the record moves on: into a report, an exchange, a decision.

This is the line between two quality levels described in ISO 8000-8:
• syntactic quality asks how the value is written
• semantic quality asks what it means and whether it corresponds to what it should represent

Syntax is checked against a format specification. Semantics against definitions and code lists. So a semantic check needs:
1. A definition of the field in plain words.
2. A code list or classification with a stated version.
3. A way to check the value against reality, for example another register.

I would look for the most expensive semantic gaps where registers exchange data. A "date" field means the application date in one system and the decision date in another. The format matches, so the exchange runs without a single error. The conclusions diverge.

The full piece on the three quality levels: {{link}}

#DataQuality #DataGovernance #Registers
