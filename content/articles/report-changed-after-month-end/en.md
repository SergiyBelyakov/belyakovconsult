---
title: Why last month's report changed
description: Late records and status changes quietly rewrite past reports. How to agree a cut-off date and show revisions honestly.
date: 2026-11-16
services: [data-architecture, business-intelligence]
tags: [data architecture, BI, cut-off date, reporting]
promo:
  hook: "Last month changed."
  tag: "Why last month's report shows a new number"
  cta: "Who decides the cut-off date for your monthly report?"
carousel:
  - title: Same number, different day
    text: The October report was opened twice. Nobody broke anything.
    visual:
      type: bars
      items: [{label: "Report on 5 November", value: 1240}, {label: "Report on 20 November", value: 1287}]
      note: "Illustrative data, new applications in October"
      thousands: ","
  - title: Why the past changes
    text: "Late records\nBackdated corrections\nStatus changes\nMerged duplicates"
    visual: {type: list}
  - title: Balance or statement
    text: Most systems keep only the current state. A report for the past is recalculated every time.
    visual:
      type: compare
      highlight: right
      left: {label: "Current state", value: "Only now"}
      right: {label: "History", value: "What and when"}
  - title: Two dates in every record
    text: When it happened and when we learned about it. You need both.
    visual:
      type: grid
      items: ["Event date", "Entry date"]
  - title: Freeze it and show revisions
    text: A published number should never change silently.
    visual:
      type: flow
      items: ["Cut-off date", "Snapshot on that date", "Published version", "Revision with a reason"]
episodes:
  - title: The past changes too
    text: An October record can appear in November. And the October report will notice.
    carousel:
      - title: A late record
        text: The event happened in October but reached the system later.
        visual:
          type: flow
          items: ["Event on 28 October", "Entered on 12 November", "October report +1"]
      - title: The status changed
        text: Same application, but it is no longer among the approved ones.
        visual:
          type: compare
          highlight: right
          left: {label: "5 November", value: "Approved"}
          right: {label: "20 November", value: "Rejected"}
      - title: Duplicates were merged
        text: After cleaning, one person instead of three, and past numbers go down.
        visual: {type: doc, label: "Register, October", note: "3 records became 1"}
  - title: Can you repeat your number?
    text: A 20-minute check. Can you get today what you showed a month ago?
    carousel:
      - title: A 20-minute check
        text: If you cannot reproduce a published number, you have no snapshot.
        visual:
          type: flow
          items: ["Last month's indicator", "Calculate it today", "Compare with published", "Explain the gap"]
      - title: How to show a revision
        text: Both numbers side by side and one sentence on why they differ.
        visual:
          type: compare
          highlight: right
          left: {label: "Published", value: "1,240"}
          right: {label: "Now", value: "1,287", note: "Illustrative: late applications"}
      - title: A question for you
        text: Who decides in your team which date a monthly report is counted on?
        visual: {type: doc, label: "October report", note: "Whose cut-off date?"}
---

An illustrative situation. On 5 November you show leadership a report: 1,240 new applications in October. On 20 November someone opens the same report for the same October and sees 1,287. Nobody touched the formulas, the dashboard works, there are no errors.

The report simply recalculates October every time it is opened. And in the data, October keeps changing long after it ended on the calendar.

## Why the past changes in data

The typical reasons, and all of them are perfectly legitimate:

- **Late records.** An application was submitted on 28 October but entered into the system on 12 November. It belongs to October, so October "grew".
- **Backdated corrections.** An operator found a wrong date and fixed it. The record moved from September to October or the other way round.
- **Status changes.** An application that was "approved" on 5 November became "rejected" on 20 November. It is no longer in the report on approved applications.
- **Merged duplicates.** After cleaning, three records of one person became one, and past numbers went down.
- **Reference data changes.** A unit was reassigned to another region, and its whole history moved with it.

None of these changes is a mistake. The mistake is elsewhere: the report does not know the past has changed, and nobody can say which of the two numbers is "right".

## Account balance and bank statement

Most operational systems store the current state: what the status of an application is now, which region a unit belongs to now. A report for a past period filters that current state by date, so it gets a slightly different result every time.

It is like looking at your account balance to find out how much money you had a month ago. The balance only shows "now". For the past you need a statement: what happened and when.

The analogy has limits. A bank almost never changes last month's transaction retroactively, while in registers this is routine work. So data needs not only a statement but also a memory of when exactly something in it was corrected.

## What to add to the data architecture

Three things usually solve the problem:

1. **A snapshot on the cut-off date.** A copy of the data the report needs, as it was when the report was produced. The October report is built on the snapshot, not on the live table.
2. **Two dates in every record.** The event date (when the application was submitted) and the entry or change date (when we learned about it). Without the second date, a late record looks like any other.
3. **Published figures kept separately.** A number shown to leadership or partners is stored separately with its publication date and version. You can reproduce it a year later.

This does not have to be a big data warehouse. For one or two key indicators, a snapshot table filled once a month is enough.

## Agreeing the cut-off date

The technical part does not work without an agreement. Someone has to decide:

- which date a monthly report is counted on, for example the fifth working day after the month ends;
- what happens to changes that arrive after that date: ignore them, move them to the current month or issue a revision;
- who decides to revise a published number.

Without this agreement every analyst picks a date on their own, and we are back to two correct but different numbers.

## Showing revisions honestly

A published number should never change silently. If the data for a past period changed noticeably, show two columns, "published" and "now", plus one sentence of explanation. For example: "+47 applications entered after the cut-off date". The numbers in the example are illustrative, but the format works exactly like that.

It helps to agree a threshold in advance: what gap requires an official revision and what is simply logged.

## If you have no snapshots yet

You can start without new infrastructure. If records already have an entry date, the report can get close to "as it was": count only records entered no later than the cut-off date. That at least removes late records and shows how many of them there really are.

This trick has a limit. It does not bring back an application's old status or undo merged duplicates, because the current table remembers only the latest version of a record. So for indicators that money or leadership decisions depend on, replace the temporary filter with a real snapshot soon.

And one practical detail: write on the report itself the date the data was counted as of. One sentence at the bottom of the page removes half of the "why is your number different" questions.

## Check it yourself

Take a key indicator for last month that you have already shown. Calculate it today with the same report and compare it with the published one. If the numbers differ, try to explain the gap. If you cannot explain it and cannot reproduce the published number, you need a snapshot and a cut-off date. That is a question of [data architecture](/en/data-architecture/), not another fix in the report.

And who decides in your team which date the monthly report is counted on?
