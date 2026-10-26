---
---
Two registers exchange data, and the matching key is the document number. Sounds reliable, until it turns out that number 123456 belongs both to a child's birth certificate and to an adult's booklet passport.

The example is illustrative, but the mechanics are typical. The series sit in another field, the exchange sends only the number, the system sees a match and links the records. The error looks like a success.

A document number is like a house number. Almost every street has a number 12, and without the street name a letter will not arrive. Document type and series play the role of the street. (The analogy has limits: in a city, at least street names do not repeat, while series of different document types sometimes overlap.)

What makes a number a reliable key:
• document type as a code from a reference list
• series as a separate field
• number as a string, without spaces and never converted to a number
• date of issue as an extra check

This is not an interface question but an exchange contract question. If the contract has one "document number" field, every system guesses the type its own way.

Example, format rules and steps: {{link}}

#DataArchitecture #DataQuality #GovTech
