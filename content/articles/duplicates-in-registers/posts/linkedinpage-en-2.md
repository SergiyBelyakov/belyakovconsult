---
---
How do you find duplicates in a register without accidentally merging two different people?

The first temptation is to compare names. But a large register has more namesakes than you think. The second is to compare document numbers. But people change passports, and the number changes with them.

So I build a key from several fields:
1. Surname and first name after normalisation: no spaces or dots, one transliteration rule.
2. Date of birth.
3. Document number without the series and separators.
4. A tax ID or another stable identifier, if there is one.

An exact match on that key finds the obvious duplicates. For the rest there is fuzzy matching: an algorithm scores how similar two records are and suggests pairs with a high score.

The key word is "suggests". I would not merge records automatically. Wrongly merging two different people takes far longer and costs far more to undo than finding a duplicate. Especially when payments are linked to the record.

So high-score pairs are reviewed by someone who knows the process. The algorithm saves them time, but it does not take the decision away.

The full piece on duplicates and where to fix them: {{link}}

#DataQuality #DataGovernance #PublicSector
