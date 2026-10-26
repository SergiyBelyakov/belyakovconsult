---
---
A matching document number is rarely a rare accident. Usually one of four reasons is behind it:

• Separate numbering. Each document type has its own, and six digits easily repeat across types.
• Series in another field. The number was sent, the series was not, or it does not take part in matching.
• Lost leading zeros. The number was stored as a number, and 012345 turned into 12345.
• Look-alike letters. Latin A, B, K look like Cyrillic А, В, К, but to the system they are different characters.

The third one is my favourite, because nobody planned it. Excel means no harm: it simply thinks a leading zero is pointless. The trouble is that a document number is not a number. Nobody adds or multiplies it; it is a string that happens to consist of digits.

Interestingly, the first two reasons produce false matches, while the last two produce false mismatches: the same person cannot be found in two registers. The report is wrong in both directions, and from the outside you cannot see it.

A 5-minute check: in any extract, search for numbers shorter than they should be and for Latin letters in series. If you find some, you know where normalisation starts.

Full breakdown: {{link}}

#DataQuality #DataArchitecture #Registers
