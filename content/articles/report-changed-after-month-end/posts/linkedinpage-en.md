---
---
On 5 November a report shows 1,240 new applications for October. On 20 November the same report for the same October shows 1,287. (The numbers are illustrative, the situation is not.)

Nobody touched the formulas. The report simply recalculates October every time it is opened, and October keeps changing in the data long after the month ends:
• an application submitted on 28 October was entered on 12 November
• an operator corrected a date retroactively
• an "approved" application became "rejected"
• three records of one person were merged into one

None of these changes is a mistake. The mistake is that the report does not know the past changed, and nobody can say which of the two numbers is right.

Most systems store only the current state. It is like working out how much money you had a month ago from today's account balance. (The analogy has limits: a bank almost never changes past transactions, registers do it every day.)

What helps:
1. A snapshot of the data on the cut-off date.
2. Two dates per record: when it happened and when we learned.
3. Published figures stored separately with a version.

Plus an agreement on who counts the report and as of which date.

Full piece: {{link}}

#DataArchitecture #BusinessIntelligence #Reporting
