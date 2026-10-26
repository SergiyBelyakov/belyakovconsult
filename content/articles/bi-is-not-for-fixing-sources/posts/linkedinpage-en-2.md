---
---
How do you tell that your Power BI is not showing the data but treating the sources? I look for four signs.

1. Dozens of value replacement steps in Power Query. Every refresh fixes the same errors again, because nobody fixed them in the source.

2. A mapping table in Excel. The "what it was, what it should be" table sits next to the report, often named something like `mapping_final_v3.xlsx`. It has no owner apart from the report's author. (If there is also a `_v4_final_new`, that is no longer a sign, it is a diagnosis.)

3. The same cleaning in several reports. Each analyst writes their own version, slightly differently. One source, two numbers in the meeting.

4. Indicator definitions in DAX. Who counts as a recipient, which status is active, which date we count on: a measure in the report decides that, not an agreed rule.

If you recognise two of these, the report rests on one file and one person. A one-minute check: could a colleague explain, without the author, why the number in the report differs from the source?

The full piece and what to do about it: {{link}}

#PowerBI #BusinessIntelligence #DAX
