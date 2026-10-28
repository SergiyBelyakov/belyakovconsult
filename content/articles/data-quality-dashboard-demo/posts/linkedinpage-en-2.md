---
publish_at: 2026-11-02 14:30
---
Overall data quality: 97.55%. One segment in August: 93.80% and 25 incidents. Both numbers come from the same demo.

Watch the drop dissolve at each level of aggregation (synthetic data):
• all data, full year: 97.55%
• Odesa, all domains: 97.43%
• healthcare, all regions: 97.41%
• August, all segments: 97.45%
• Odesa × healthcare, year: 96.87%
• the same segment in August: 93.80%

It is like a class average: 4.5 out of 5 will not tell you that one student failed the test. The analogy is imperfect, because in data the "student" is thousands of records from one segment, and their error reaches a decision all at once.

So beyond averages, a data quality dashboard needs:
• a region × domain matrix coloured by status against the target
• a list of exceptions at the month × region × domain level, sorted by severity
• a target written into the methodology, not left as a default

Check your own dashboard: how many clicks does it take to reach a month × region × domain segment?

The full write-up with examples: {{link}}

#DataQuality #BusinessIntelligence #Analytics
