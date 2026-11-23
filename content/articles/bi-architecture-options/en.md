---
title: "BI architecture: four options, pros and cons, and Power BI best practices"
description: "Self-service on sources, a classic warehouse, a cloud warehouse with ELT and a Fabric lakehouse: when each one fits and what always pays off in Power BI."
date: 2026-11-22
services: [business-intelligence, data-architecture]
tags: [BI, data architecture, Power BI, Microsoft Fabric, data warehouse, lakehouse, Direct Lake]
promo:
  hook: "4 BI architectures"
  tag: "Pros, cons and when to pick each"
  cta: "Which architecture sits behind your reports today?"
---

Slow dashboards, two different revenue figures in two reports, fear of touching the model. Usually this is not a flaw of the tool. It is a consequence of the architecture behind the reports.

Below are the four options I see most often: what each does well, what it does badly, when to choose it and when to outgrow it. They are not mutually exclusive. Companies usually move from the first to the second or third, and large organisations often live in a hybrid. At the end: Power BI practices that pay off with any architecture.

## In short

| | Self-service on sources | Classic warehouse | Cloud warehouse + ELT | Lakehouse in Fabric |
|---|---|---|---|---|
| Time to start | days | months | weeks or months | weeks or months |
| Scale | small | medium to large | large | large |
| Main strength | speed | one version of the truth | scales on demand | one copy of data, freshness |
| Main risk | several versions of one number | slow to change | bill grows with volume | new skills, Fabric capacity required |
| Fits | a pilot, one team | finance, regulated reporting | many sources, fast growth | large volumes in the Microsoft ecosystem |

The table is a rough guide. Real timelines and costs depend on the number of sources, their quality, volumes and the team.

## 1. Self-service directly on sources

**What it looks like.** An analyst connects Power BI to the ERP, CRM, Excel files and SharePoint. All data preparation lives in Power Query inside the report file, and every report has its own model.

**Pros**

- Live in days, no separate infrastructure.
- The business sees its data right away and works out what is missing.
- The cheapest way to test whether analytics is needed at all.

**Cons**

- Logic is scattered across files. The same measure is calculated differently in different reports.
- Refreshes load the operational systems and stop keeping up as data grows.
- Hard to control who sees what and where a number came from.
- The model often depends on one person.

**When to choose it.** A pilot, one team, a few sources, testing a hypothesis before investing in a warehouse.

**Signs it is time to move on.** Two versions of one number in a meeting. The same Power Query steps copied into several files. The nightly refresh does not finish by morning. Why fixing sources inside BI is a bad idea is covered separately: [BI should not be the place where source systems are repaired](/en/insights/bi-is-not-for-fixing-sources/).

## 2. Classic data warehouse

**What it looks like.** Data from sources goes through scheduled ETL (extract, transform, load) into a relational warehouse such as SQL Server or Azure SQL. There it is organised in a star schema: fact tables and dimensions. Power BI reads ready-made tables.

**Pros**

- One version of the truth: measures are defined once, in the warehouse.
- A methodology proven over decades, and plenty of people who know it.
- History is kept, so last month's report can be reproduced.
- Operational systems do not suffer from analysts' queries.

**Cons**

- Every change goes through the data team, so a new measure takes weeks.
- Data is usually refreshed once a day.
- Your own hardware or servers have to be maintained and scaled by hand.

**When to choose it.** Finance, regulated reporting, stable processes where accuracy and reproducibility matter more than speed of change.

## 3. Cloud warehouse with ELT

**What it looks like.** Data is first loaded as is into a cloud warehouse (Snowflake, BigQuery, Databricks SQL, Fabric Warehouse) and transformed inside it (ELT). Transformations are often written as code, for example in dbt, with tests and versions in Git.

**Pros**

- Compute scales on demand: a heavy query does not wait for a new server.
- Transformations as code: changes are visible in history and can be reviewed and rolled back.
- New sources, including semi-structured ones, are easy to add.

**Cons**

- The bill depends on the workload. Without controls it grows with volume and the number of queries.
- It needs engineering discipline: tests, reviews, monitoring.
- Data leaves your own infrastructure, so security and storage requirements need thought.

**When to choose it.** Many sources, fast-growing volumes, several teams consuming the same data.

## 4. Lakehouse in Microsoft Fabric

**What it looks like.** Data is stored in OneLake in the open Delta format and moves through layers: Bronze (raw), Silver (cleaned), Gold (ready for analytics). Power BI reads Gold tables in Direct Lake mode: the VertiPaq engine loads data from Delta tables into memory without a separate copy, as with Import.

**Pros**

- One copy of data for engineers, analysts and reports.
- A Direct Lake refresh copies only metadata, so it takes seconds rather than hours.
- Query speed close to Import mode on large volumes.

**Cons**

- Direct Lake works only on Fabric capacity (F SKUs). Microsoft no longer sells new Power BI Premium capacities (P SKUs), so new deployments go to F SKUs.
- There are guardrails by capacity size: rows per table, model size. Direct Lake on the SQL endpoint falls back to slower DirectQuery when they are exceeded; Direct Lake on OneLake does not fall back, and queries fail until the tables are optimised.
- Some model features (for example calculated columns and tables) are limited or still in preview.
- The team needs new skills: Spark or SQL in Fabric, Delta, capacity management.

**When to choose it.** Large volumes, the Microsoft ecosystem, a need for fresh data without long imports. Microsoft itself recommends starting with a prototype to check whether Direct Lake suits your particular model.

## How to choose: five questions

1. **How many sources, and how fast are they growing?** Two or three stable sources rarely need cloud scale.
2. **How fresh does the data need to be?** If decisions are made weekly, minute-level data only adds cost.
3. **Who will maintain it?** An architecture nobody can support is worse than a simpler one.
4. **How reproducible must the numbers be?** Financial and regulated reporting needs history and snapshots, not only the current state.
5. **What do you already have?** Microsoft 365 and Power BI licences make Fabric a natural step; an existing dbt team makes a cloud warehouse natural.

If you are still choosing the platform rather than the architecture, start with the [BI platform comparison map](/en/insights/which-bi-platform-to-choose/).

## Power BI connection modes: when to use which

| Mode | Pros | Cons | When to use |
|---|---|---|---|
| Import | fastest queries, full DAX | data is fresh only after refresh, size limits | the default for most reports |
| DirectQuery | always current, no copy | every report interaction queries the source, slower | very large or very fresh data where Import is impossible |
| Direct Lake | speed close to Import, refresh in seconds | Fabric only, capacity guardrails | a lakehouse or warehouse in Fabric |
| Composite model | combines Import and DirectQuery | harder to set up and maintain | a big fact table plus fast dimensions or aggregations |
| Live connection | one shared dataset for many reports | the report cannot change the model | thin reports on top of a shared model |

## Power BI practices that pay off with any architecture

**Model**

- **Star schema.** Fact tables and dimensions, one-to-many relationships in one direction. Bidirectional relationships only where there is no other way.
- **A separate date table**, marked as a date table.
- **Measures in DAX, not calculated columns.** Calculated columns make the model bigger and are only computed at refresh.
- **Fewer columns, lower cardinality.** Remove what no report uses; split date and time; do not carry unique IDs without a reason.

**Data preparation**

- **Transform as close to the source as possible.** What can be done in the warehouse belongs there, not in Power Query.
- **Query folding.** Check that Power Query steps run on the source side, especially filters and joins.
- **Incremental refresh** for large fact tables: only new periods are refreshed.

**Shared model and reports**

- **One shared semantic model per subject area** and thin reports on top. A measure is then defined once.
- **Endorse trusted models** as certified or promoted, so users know what to rely on.
- **Row-level security (RLS)** in the model, not copies of reports for different departments.

**Development and release**

- **Power BI Project (PBIP) format and TMDL in Git.** The model and report are stored as text files and changes show up in history. Microsoft has announced general availability of TMDL.
- **Separate workspaces for development, test and production** with deployment pipelines between them.
- **Model quality checks** with tools such as the Best Practice Analyzer in Tabular Editor, and performance checks with Performance Analyzer and DAX Studio.

**Operations**

- **Monitor capacity** (the Fabric Capacity Metrics app) and refreshes: you should see failures before the CEO does in the morning.
- **An owner for every model and a short description of each measure.** Without that, even a correct model becomes a black box within a year.

## Common mistakes

- Buying a new BI tool hoping it will fix the numbers. It will not: that is a question of the data foundation, not the tool.
- Switching to DirectQuery "to keep it fresh" without checking whether the source can take the load.
- Building a lakehouse for three Excel files.
- Leaving a warehouse without measure owners: technically one version of the truth, in practice several definitions.

## Where to start

Look at your reports and answer honestly: how many models calculate the same revenue, and can you reproduce the figure you showed last month? If there are several models and you cannot, the next step is not a new dashboard but [data architecture](/en/data-architecture/) and a shared model for [business intelligence](/en/business-intelligence/).

How many people and which skills each of these architectures needs is covered separately: [BI team sizing: how many people and which skills](/en/insights/analytics-team-sizing/).

Which architecture sits behind your reports today?
