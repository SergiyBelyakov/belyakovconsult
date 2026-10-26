---
---
A "field is not empty" check cannot tell an ID card number from a date typed into the wrong field. A generic length check does not help either: it lets through a passport and a phone number alike.

A format rule has to depend on the document type. A simplified example for Ukrainian documents:
• ID card: 9 digits
• booklet passport: 2 Cyrillic letters and 6 digits
• birth certificate: series and 6 digits
• foreign document: country of issue required

This is also why the document type has to travel as a separate field: without it, the rule simply does not know what to be.

Where to run the check:
1. At data entry, while the person is still there and can correct it.
2. When data arrives through the exchange, because the sender may check differently.
3. Send a rejected record back to the sender with a reason. A record that silently disappeared is worse than a wrong one: nobody will even look for it.

An error in a number is cheapest at the moment of entry. In a report it already costs a meeting, and in a payment it costs a complaint.

Format rules and steps: {{link}}

#DataQuality #DataArchitecture #GovTech
