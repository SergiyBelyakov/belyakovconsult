---
title: "Data architecture types: 6 levels from ERP reports to data mesh"
description: "Six types of enterprise data architecture, from reports straight on source systems to warehouse, lake, lakehouse and data mesh. Pros, cons and how to choose."
date: 2026-11-27
services: [data-architecture, business-intelligence, data-governance]
tags: [data architecture, data warehouse, data lake, lakehouse, data mesh, data fabric, ODS, data mart, CDC]
promo:
  hook: "6 levels of data architecture"
  tag: "From ERP reports to data mesh"
  cta: "Which level is your company on today?"
---

When a company has two different revenue figures and a new report takes a month, the problem is rarely the people or the reporting tool. Usually it sits in the data architecture: where reports get their data, where business logic lives and who is accountable for the numbers being right.

Below are six types of data architecture found in enterprise systems, from the simplest to the most complex. They are not steps everyone has to climb. Many companies do well on level three for good, and large organisations often run several types side by side. The goal of this article is to help you see where you are and whether you really need the next level.

If you are interested in the reporting layer specifically, we have a separate guide to [four BI architecture options and Power BI best practices](/en/insights/bi-architecture-options/).

## In short

| Level | Type | Main plus | Main risk | Fits |
|---|---|---|---|---|
| 1 | Reports straight from systems | live in days | different numbers in different reports | small company, one or two systems |
| 2 | Replica (ODS) | spares operational systems | logic still scattered across reports | several systems, operational reporting |
| 3 | Warehouse and marts | one version of the truth, history | changes take weeks | mid-size and large business, finance |
| 4 | Data lake | cheap storage for any data | turns into a swamp without rules | large volumes, data science |
| 5 | Lakehouse | one copy of data for BI and ML | needs new skills | large volumes, BI and ML together |
| 6 | Data mesh | scale without a central bottleneck | needs a mature organisation | many domains with their own data teams |

All assessments here and below are indicative. Real timelines and costs depend on the number of sources, their quality, volumes and the team.

## 1. Reports straight from systems

**What it looks like.** Every report connects to operational systems on its own: the ERP, CRM, warehouse software, Excel files. The logic for calculating measures lives inside each report. Systems are wired to each other one by one, which is point-to-point integration.

**Pros.**

- Live in days with no separate infrastructure.
- Minimal cost and simple support while there are few reports.

**Cons.**

- The same number is calculated differently in different reports.
- Heavy queries load operational systems during working hours.
- No history: you cannot tell what a reference table looked like a month ago.

**When it fits.** A small company with one or two systems, a few reports and one team.

**Signals to move on.** Meetings start by working out whose number is right. The ERP slows down when reports refresh. A new source means reworking a dozen reports.

## 2. Replica of operational databases (ODS)

**What it looks like.** Data from operational systems is copied on a schedule or in near real time into a separate database, an operational data store (ODS). Reports read the copy, not the live system. Table structures stay almost the same as in the source.

**Pros.**

- Operational systems no longer suffer from reporting.
- Data from several systems sits in one place and can be combined.
- Freshness is high, especially when changes are copied with CDC.

**Cons.**

- Business logic is still scattered across reports, so the numbers still disagree.
- Source structures are awkward for analytics and queries get complex.
- Usually no change history: the copy shows the current state.

**When it fits.** Several operational systems, a need for operational reporting, and a warehouse project that is still too big a step.

**Signals to move on.** The same formulas are duplicated in many reports. You need period comparisons and there is no history. Analysts spend more time joining tables than analysing.

## 3. Data warehouse and data marts

**What it looks like.** Source data goes through ETL or ELT: it is cleaned, reconciled across systems and stored with history in a data warehouse. Data marts are built for business areas using a star schema: fact tables and dimensions. Reports read from the marts or from a shared semantic model.

There are two classic approaches. Bill Inmon proposed building a normalised enterprise warehouse first and deriving marts from it. Ralph Kimball proposed building the warehouse directly from dimensional models linked by shared, conformed dimensions. In practice most modern warehouses combine both ideas.

**Pros.**

- One version of the truth: each measure is defined once.
- Change history and period comparisons.
- A model business users understand, and fast reports.

**Cons.**

- Every change goes through the data team, which takes weeks.
- A poor fit for unstructured data: logs, text, files.
- Needs a permanent team and modelling discipline.

**When it fits.** Mid-size and large businesses, financial and regulatory reporting where numbers must reconcile to the cent.

**Signals to move on.** Data volumes and types grow faster than the warehouse can take them in. Data science needs raw data the warehouse does not hold. The data team backlog grows for months.

## 4. Data lake

**What it looks like.** All data lands in cheap file storage in raw form: tables, logs, events, documents, device data. Structure is applied when data is read, not when it is written. The term "data lake" appeared around 2010 together with the Hadoop ecosystem.

**Pros.**

- Very cheap storage for large volumes.
- Any format, including unstructured data.
- Raw data is available for data science and machine learning.

**Cons.**

- Without a catalogue, owners and quality rules a lake quickly becomes a "swamp" where nobody knows what is there or whether to trust it.
- Classic BI reporting still needs a warehouse next to it, so data is duplicated.
- Weak consistency guarantees under concurrent writes and updates.

**When it fits.** Large volumes of varied data, a strong data science team, a need to keep raw data for years.

**Signals to move on.** You maintain both a lake and a warehouse with the same data. Reports and ML models calculate the same measures differently.

## 5. Lakehouse

**What it looks like.** A lakehouse combines the cheap file storage of a lake with the reliability of a warehouse. Data is stored in open table formats such as Delta Lake or Apache Iceberg, which add transactions, versions and schema control. Inside, data is usually organised with the medallion architecture: Bronze for raw data, Silver for cleaned and reconciled data, Gold for ready-to-use marts.

**Pros.**

- One copy of data for BI, data science and ML.
- Fresher data and fewer copies between systems.
- Compute scales separately from storage.

**Cons.**

- New skills: Spark, SQL at scale, managing table formats.
- Needs discipline between layers, otherwise Gold becomes the same swamp.
- Compute costs need watching because they grow with the workload.

**When it fits.** Large volumes, BI and ML on the same data, a cloud platform such as Microsoft Fabric or Databricks.

**Signals to move on.** The central data team has become a bottleneck for the whole company, while domains such as sales, logistics and finance have their own analysts and engineers and want to move faster.

## 6. Data mesh

**What it looks like.** Data mesh is not a technology but an organisational approach. Zhamak Dehghani described it in 2019. Instead of one central team, data is owned by the domains that create it. The approach rests on four principles:

1. Domain ownership: the team that understands the data best is accountable for it.
2. Data as a product: each domain publishes data products with a description, quality standards and an owner.
3. Self-serve data platform: shared infrastructure so domains do not build everything from scratch.
4. Federated computational governance: shared rules for security, quality and interoperability, checked automatically.

**Pros.**

- Scale without a single bottleneck.
- Data stays close to the people who understand it, so quality improves.
- Domains move at their own pace.

**Cons.**

- Needs maturity: data owners, a strong platform, a culture of accountability.
- Risk of duplication and incompatible definitions if the rules are weak.
- Expensive for companies without several independent data teams.

**When it fits.** A large organisation with several domains, each with its own engineers and analysts, where the central team can no longer keep up.

**When it is too early.** If one or two people work with data, data mesh adds bureaucracy without adding speed.

## Cross-cutting approaches: streaming and data fabric

Two approaches are not a separate level but complement any of them.

**Streaming.** When data is needed in seconds rather than the next morning, teams use event streams and CDC: changes in operational databases are passed on immediately. The classic patterns are Lambda (batch and streaming layers in parallel) and Kappa (everything as a stream). Streaming is more expensive and harder to support, so check honestly whether decisions are really made within minutes.

**Data fabric.** A term promoted by Gartner and vendors. The idea is to build a layer of metadata, catalogue and virtual access on top of existing systems that automates finding, integrating and controlling data. Data fabric focuses on technology and metadata, data mesh on organisation and ownership. They do not exclude each other. There is no "data fabric out of the box": it is a direction, not a specific platform.

## Comparison

| Type | Complexity | Freshness | Scale | Typical cost |
|---|---|---|---|---|
| Reports from systems | low | high | small | minimal |
| ODS replica | low to medium | high | small to medium | low |
| Warehouse and marts | medium | daily or hourly | medium | medium |
| Data lake | medium | depends on loading | large | low for storage |
| Lakehouse | high | high | large | medium to high |
| Data mesh | very high | depends on domains | very large | high |

## How to choose

Start with five questions, not with technology:

1. How many source systems are there and how different are they?
2. Who uses the data: a few managers or hundreds of people across departments?
3. How fresh must data be: next morning, hourly or within seconds?
4. Do you have unstructured data and machine learning use cases?
5. How many people can support the solution? We covered team sizing in [how many people BI needs](/en/insights/analytics-team-sizing/).

Choose the simplest level that covers your real needs for the next two or three years. Match complexity to scale: unnecessary complexity costs as much as missing capability.

## Migration path

Move between levels gradually rather than with one big project from scratch:

- From reports on systems to an ODS: start with the most loaded system.
- From an ODS to a warehouse: move three to five of the most disputed measures out of reports and into marts.
- From a warehouse to a lakehouse: migrate domain by domain while reports keep working.
- To data mesh: first appoint data owners and data governance rules, then distribute technical responsibility.

## Common mistakes

- Choosing an architecture by trend rather than by need.
- Building a lake without a catalogue and data owners.
- Moving old reports without reviewing their logic, discrepancies included.
- Launching data mesh without a platform and shared rules.
- Forgetting data quality: no architecture fixes errors at the input.

## Where to start

Write down where the numbers for the three main management reports come from today and where the logic behind them lives. In a few hours this shows which level you are on and where the biggest risk sits. From there, a [data architecture review](/en/data-architecture/) and setting up [data governance](/en/data-governance/) help. Definitions of the terms used here are in the [glossary](/en/glossary/).

Which level of data architecture is your company on today?
