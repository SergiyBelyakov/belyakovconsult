---
---
"0", "-", "unknown", "01.01.1900".

Formally the field is filled in. So all of it honestly lands in the same 98% completeness from the data quality report.

The fastest way I know to find placeholders: sort the field values by frequency. They are almost always at the top, because people type them the same way and often. Five minutes, and you see how much of the "98%" is really "I don't know".

Where they come from:
• the form will not save an empty field
• the value is not known yet at entry
• the form has no "not applicable" option

I like to think of a placeholder not as a person's mistake but as a hint. It points to the place where the form stops people from entering the truth: someone wanted to say "I don't know", and the system only allowed "01.01.1900".

What to do:
1. List the placeholders for every critical field.
2. Count them as empty values in quality reports.
3. Add an honest "unknown" to the form and a check at data entry.

The full piece on completeness and quality: {{link}}

#DataQuality #DataGovernance #Registers
