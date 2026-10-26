---
---
Why does last month's report change? Because most operational systems store only the current state.

The table knows an application's status now and which region a unit belongs to now. An October report filters that state by date and recalculates October every time, with every change that has happened since.

It is like working out how much money you had a month ago from today's balance. For the past you need a statement. (The analogy has limits: a bank almost never changes past transactions, while in registers it is routine. So data also needs a memory of when something was corrected.)

Three things I add to the data architecture:
1. A snapshot on the cut-off date: the report's data as it was when the report was produced.
2. Two dates in every record: the event date and the entry or change date. Without the second, a late record looks like any other.
3. Published figures stored separately, with publication date and version, so they can be reproduced a year later.

You do not need a big data warehouse to start. For one or two key indicators, a snapshot table filled once a month is enough.

Full piece: {{link}}

#DataArchitecture #DataWarehouse #BusinessIntelligence
