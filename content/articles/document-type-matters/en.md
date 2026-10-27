---
title: Document type can matter more than the number itself
description: Why a document number alone is not enough for reliable identification in data exchange, and what to add so a matching number does not become an error.
date: 2026-11-12
services: [data-architecture, data-quality]
tags: [data architecture, data exchange, identification, data quality]
carousel:
  - title: One number, two documents
    text: "An illustrative example: the same digits in two registers, but two different people."
    visual:
      type: fields
      items:
        - {value: "123456", note: "birth certificate"}
        - {value: "123456", note: "someone else's passport"}
        - {value: "match?", note: "the system says yes"}
  - title: A number without a type is a house without a street
    text: Almost every street has a house number 12. Number 123456 also appears in different document types.
    visual:
      type: compare
      highlight: right
      left: {label: "Key today", value: "Number"}
      right: {label: "Key needed", value: "Type+number"}
  - title: What to send in the exchange
    text: "Document type from a reference list\nSeries separate from the number\nNumber without spaces\nDate of issue"
    visual: {type: list}
  - title: Format depends on the type
    text: One length rule for every type lets almost anything through.
    visual:
      type: fields
      items:
        - {value: "123456789", ok: true, note: "ID card: 9 digits"}
        - {value: "КВ123456", ok: true, note: "booklet passport"}
        - {value: "12345", note: "fits no type at all"}
  - title: Count the false matches
    text: The gap between the two counts is the number of records matched by mistake.
    visual:
      type: flow
      items: ["Matches by number only", "Matches by full key", "Gap between them", "False matches"]
episodes:
  - title: Where false matches come from
    text: Numbers of different documents overlap more often than you think. Here are four typical reasons.
    carousel:
      - title: Four reasons
        text: "Separate numbering\nSeries in another field\nLost leading zeros\nLatin instead of Cyrillic"
        visual: {type: grid}
      - title: Excel ate the zero
        text: The number was stored as a number, and the leading zero vanished. Now it matches someone else's.
        visual:
          type: compare
          highlight: right
          left: {label: "Before", value: "012345"}
          right: {label: "After", value: "12345"}
      - title: Letters that only look alike
        text: "Illustrative records: identical on screen, different strings for the system."
        visual:
          type: fields
          items:
            - {value: "АВ123456", ok: true, note: "Cyrillic"}
            - {value: "AB123456", note: "Latin, will not match"}
            - {value: "АВ 123456", note: "a space, no match either"}
  - title: Format depends on the type
    text: A "field is not empty" check cannot tell an ID card number from a date.
    carousel:
      - title: A rule for each type
        text: "ID card: 9 digits\nBooklet passport: 2 letters and 6 digits\nBirth certificate: series and 6 digits\nForeign document: country of issue required"
        visual: {type: list}
      - title: Where to check
        text: A rejected record should go back with a reason, not disappear silently.
        visual:
          type: flow
          items: ["Type sets the rule", "Check at data entry", "Check on receipt", "Reject with a reason"]
      - title: One rule does not work
        text: A generic length check lets through a passport and a phone number alike.
        visual:
          type: compare
          highlight: right
          left: {label: "One for all", value: "Length only"}
          right: {label: "Per type", value: "Exact format"}
  - title: A 30-minute check
    text: Match two registers twice and look at the gap. It shows how many matches are false.
    carousel:
      - title: Two counts
        text: First by number only, then by type, series and number.
        visual:
          type: flow
          items: ["Sample from two registers", "Match by number only", "Match by full key", "Compare the counts"]
      - title: Look at the exchange contract
        text: If it has one "document number" field, every receiver guesses the type its own way.
        visual: {type: doc, label: "Exchange contract", note: "Where is the type?"}
      - title: A question for you
        text: Does your exchange send the document type as a separate field from a reference list?
        visual:
          type: compare
          highlight: right
          left: {label: "Number", value: "Yes"}
          right: {label: "Type", value: "?", note: "Check the contract"}
---

When an exchange between two systems sends only a document number, the same sequence of digits can belong to different documents of different people. The system sees a match and links the records. The error looks like a success.

## An illustrative collision

Two registers exchange data, and the matching key is the document number. The records below are invented, but the situation is typical:

| Register | Person | Value in the "number" field | What the document actually is |
| --- | --- | --- | --- |
| A | Child, born 2015 | `123456` | birth certificate, series in another field |
| B | Adult, born 1971 | `123456` | booklet passport, series in another field |

Both records are correct. But if you match by number alone, the child from register A will be "found" in register B. What happens next depends on what the system does with a match: pulls in an address, checks eligibility for a benefit, counts unique recipients.

## A number without a type: a house without a street

A document number is like a house number. Almost every street has a number 12, and without the street name a letter will not arrive. The document type and series play the role of the street.

The analogy has limits: in a city, at least street names do not repeat. Series and numbers of different document types sometimes do overlap, so even the "street" needs clarifying.

## Where false matches come from

A matching number is rarely a rare accident. Usually one of four reasons is behind it:

- **Separate numbering.** Each document type has its own numbering, and six digits easily repeat across types.
- **Series in another field.** The number was sent, the series was not, or the series sits in a separate field that does not take part in matching.
- **Lost leading zeros.** The number was stored as a number, and `012345` became `12345`, which is a completely different number.
- **Look-alike letters.** Latin `A`, `B`, `K` look like Cyrillic `А`, `В`, `К`, but to the system they are different characters.

The first two reasons produce false matches, the last two produce false mismatches: the same person cannot be found in two registers. Either way, the report counts the wrong thing.

## Which fields to add to the exchange

A number becomes a reliable key only together with a few fields next to it:

1. **Document type** as a code from a reference list, not free text that everyone writes differently.
2. **Series** as a separate field, if that document type has one.
3. **Number** as a string, without spaces and without converting it to a number.
4. **Date of issue** as an extra check when numbers do coincide.
5. **Country of issue** for foreign documents.

The matching key then becomes type, series and number together, after normalisation (strip spaces, bring Latin and Cyrillic to one alphabet by an agreed rule).

## Format checks by type

A "field is not empty" check cannot tell an ID card number from a date typed into the wrong field. Format rules have to depend on the document type. A simplified example for Ukrainian documents:

| Document type | Format rule (simplified) |
| --- | --- |
| ID card passport | 9 digits |
| Booklet passport | 2 Cyrillic letters and 6 digits |
| Birth certificate | series and 6 digits |
| Foreign document | country of issue required |

Run these rules twice: at data entry and when the data arrives through the exchange. A record that fails should go back to the sender with a reason, not disappear silently or land in the register "as is".

## Why this is architecture, not an interface detail

It is tempting to treat this as a detail of a particular API or SOAP service that developers will fix. In fact it is a question of the exchange contract: which fields are mandatory, which reference list the type comes from, who checks the format.

If the contract has a single "document number" field, every receiving system guesses the type its own way. One by length, another by whether there are letters, a third does not guess at all. Fixing this in every report separately is expensive and unreliable. Fixing it once in the contract is cheaper, even if several parties have to agree on the change.

## What to do in practice

1. Open the exchange specification and check whether the document type is sent as a separate field.
2. If not, add the type from a reference list and the series separately from the number.
3. Describe format rules for each type and run them at entry and on receipt.
4. Match two registers twice: by number only and by the full key. The gap between the results shows the number of false matches.

The last step takes half an hour and gives you an argument that is easy to show to leadership: how many records are matched by mistake right now. That kind of argument is where a conversation about [data architecture](/en/data-architecture/) starts.

And in your case: does the exchange send the document type as a separate field, or does the system still guess it from the length of the number?
