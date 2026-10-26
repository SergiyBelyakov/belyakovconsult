---
---
The Power BI report works flawlessly. Until Monday, when someone renames a column in the source.

An illustrative but familiar example: Power Query has several dozen steps. Trim spaces, merge "Kyiv city", "Kyiv" and "KYIV" into one value, pull region codes from a separate file, filter out test records. Every refresh treats the same errors all over again.

It is like repainting a ceiling stain every month while the roof leaks. The ceiling looks tidy, the roof still leaks, and the paint costs you every time. (The analogy has limits: everyone sees the stain, while a fix in Power Query is visible only to the file's author.)

The consequences are very practical:
• the error in the source lives forever, because the people entering data never hear about it
• different reports clean differently and give different numbers
• the report rests on one person

One question helps decide what to do: does anyone other than this report use this rule? If yes, it belongs in the data model and the preparation layer. And errors that keep repeating should go back to the source.

Signs, what to keep in BI, and an illustrative layer scheme: {{link}}

#PowerBI #BusinessIntelligence #DataArchitecture
