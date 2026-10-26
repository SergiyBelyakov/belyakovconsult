---
---
How do you get, in half an hour, an argument about data architecture that any manager will understand?

Take a sample from two registers that exchange data and match them twice:
1. By document number only.
2. By the full key: document type, series and number.

The gap between the results is the number of records currently matched by mistake. Not a "risk", not a "potential issue", but a specific number you can put on the table.

The second thing to do in the same half hour: open the exchange contract. If it has a single "document number" field, every receiving system guesses the type its own way. One by length, another by whether there are letters, a third does not guess at all. And each of them believes it works correctly.

Fixing this in every report separately is expensive and unreliable. Fixing it once in the contract is cheaper, even if several parties have to agree on the change.

A question for you: does your exchange send the document type as a separate field from a reference list?

Example, format rules and steps: {{link}}

#DataArchitecture #DataQuality #GovTech
