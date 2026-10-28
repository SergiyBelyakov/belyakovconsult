---
publish_at: 2026-10-30 14:30
---
Most data quality dashboards show one big number. And it is almost always green.

I built a demo that shows what hides behind such a number. The data is synthetic: 360 records, 12 months, 6 regions, 5 domains. I planted a few problems on purpose; the indicator logic is the same as in real projects.

What is in the demo:
• four indicators on the first screen: volume, quality, source availability, incidents per 100K records
• a region × domain matrix and monthly exceptions instead of a single average
• a quality target on a slider: on the same data it flags anywhere from 5 to 256 segments
• a separate page for sources: availability, latency, refresh frequency, owner
• a PDF report for management from the current filters, with the calculation methodology

Overall quality in the demo is 97.55% against a 97% target. Try to find the segment where it is 93.80%. Hint: neither the region nor the domain alone will show it.

The demo is open: {{demo}}

Want this dashboard on your data? The demo has a "Get this for your data" button: describe your sources and the decision it should support.

#DataQuality #BusinessIntelligence #Analytics
