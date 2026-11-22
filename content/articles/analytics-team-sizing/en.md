---
title: "BI team sizing: how many people and which skills"
description: "How to size the team for self-service, a warehouse, cloud ELT or a Fabric lakehouse: count the work, not job titles, then map roles and skills."
date: 2026-11-23
services: [data-architecture, business-intelligence, data-governance]
tags: [analytics team, skills, Power BI, Microsoft Fabric, data architecture, BI]
promo:
  hook: "How many people does BI need?"
  tag: "Count the work, not job titles"
  cta: "Can your BI specialist go on holiday without putting reports at risk?"
---

In the article on [four BI architecture options](/en/insights/bi-architecture-options/) we compared self-service on sources, a classic warehouse, a cloud warehouse with ELT and a lakehouse in Fabric. The next question leaders ask right after choosing: how many people do we need, and whom exactly should we hire?

The most common mistake is to size the team from job titles ("we need a BI developer") or from someone else's ratios. It is more reliable to size it from the work the team will do, and then check separately that no critical skill depends on a single person.

## In short

- Count the work, not job titles. Estimate building and running separately.
- People needed = hours of work per month divided by one person's productive hours.
- Every critical skill should sit with at least two people, or with a person and a partner.
- The more complex the architecture, the larger the share of engineering and the smaller the share of "just reports".

## Step 1. Inventory: what the team will do

Before talking about people, collect the numbers that drive the workload:

- **Sources:** how many, what type, how stable their structures are.
- **Subject areas and models:** sales, finance, inventory, HR and so on.
- **Reports:** how many are active, how many new ones per quarter.
- **Users and access groups:** who must see what.
- **Freshness and availability:** how often data is refreshed and by what time a report must be ready.
- **Rate of change:** how many new measures or fixes per month.
- **Regulatory and audit requirements:** history, snapshots, access logs.

## Step 2. Build and run, separately

**Building** has a start and an end: source integrations, the warehouse or lakehouse, models, reports, security, environments, documentation.

**Running** never ends: refresh monitoring and incidents, new requests and changes, access and user support, source changes, platform and cost, data quality.

Running is almost always underestimated. After go-live the work does not disappear, it changes shape: instead of construction there are dozens of small requests, and those are what consume the team.

## Step 3. The formula

**People needed (FTE) = (build hours per month + run hours per month) / one person's productive hours per month.**

Productive hours are not 168 or 160 a month. Holidays, sick leave, meetings, training and context switching take a noticeable share. The example below assumes 130 hours; use the figure that fits your company.

## An illustrative example

An illustrative company: 6 sources, 3 subject-area models, 25 reports, 150 users, a classic warehouse architecture. All hours below are illustrative and only show the method.

**Build (6 months)**

| Work | Calculation | Hours |
|---|---|---|
| Source integrations | 6 sources × 60 h | 360 |
| Models in the warehouse and Power BI | 3 models × 120 h | 360 |
| Reports | 25 reports × 16 h | 400 |
| Security, environments, documentation | estimate | 200 |
| **Total** | | **1,320, i.e. 220 per month** |

**Run (monthly after go-live)**

| Work | Calculation | Hours |
|---|---|---|
| Refresh monitoring and incidents | estimate | 40 |
| Changes and new requests | 25 reports × 2 h | 50 |
| Access and user support | 150 × 0.2 h | 30 |
| Source changes | 6 sources × 4 h | 24 |
| Platform and cost | estimate | 10 |
| **Total** | | **154** |

**The result.** During the build, running work grows gradually, so we take half of it: 220 + 77 = 297 hours a month, about 2.3 FTE. After go-live, 154 hours remain, about 1.2 FTE.

**What follows.** Keeping 2 or 3 people permanently just for the build peak is uneconomic, and one person for running means risk: a holiday or a resignation stops reporting. A sensible setup for this example: two in-house people with overlapping skills on a permanent basis, and a partner for the build period.

## Step 4. How the architecture changes the work

| Architecture | Where most hours go | Key roles | What is often forgotten |
|---|---|---|---|
| Self-service on sources | reports and Power Query | BI developer, business data owner | duplicated logic across files, access |
| Classic warehouse | ETL integrations and the warehouse model | data engineer, warehouse architect, BI developer, DBA | change history, tests |
| Cloud warehouse + ELT | transformations as code, the platform | analytics engineer, data engineer, platform engineer, BI developer | cost control, security |
| Lakehouse in Fabric | Spark and SQL pipelines, capacity, Direct Lake models | Fabric data engineer, analytics engineer, capacity admin, BI developer | capacity monitoring, Direct Lake guardrails, Delta table optimisation |

## Roles and skills

**Data product owner or head of BI.** Owns priorities and the backlog, agrees measure definitions with the business. Skills: business understanding, requirements management, basic data modelling.

**Business data owner and steward.** Not IT. Responsible for measure definitions, data quality and access rules in their area. Without this role even a perfect technical team gets contradictory requirements.

**BI developer.** Star schema modelling, DAX, Power Query (M), visualisation, row-level security, performance (Performance Analyzer, DAX Studio), the PBIP format and Git.

**Analytics engineer.** SQL, Kimball modelling, transformations as code (dbt or similar), data tests, Git and CI/CD. In Fabric, semantic models too.

**Data engineer.** Integrations, ETL and ELT, orchestration, Python and PySpark, incremental loads, monitoring and quality. In Fabric: pipelines, notebooks, Delta tables.

**Platform engineer or administrator.** Environments, security, networking, capacity and cost, backups. In the cloud this includes cost control.

**Data architect.** Chooses the architecture, sets standards, reviews. Often a part-time role or an external expert.

In small teams one person combines several roles, for example BI developer and analytics engineer. That is fine as long as the skills are real, not just written into a job description.

## Matrix: which skills each architecture needs

| Role | Self-service | Classic warehouse | Cloud + ELT | Lakehouse in Fabric |
|---|---|---|---|---|
| Product owner / head of BI | partial | core | core | core |
| Data owner and steward | core | core | core | core |
| BI developer | core | core | core | core |
| Analytics engineer | not needed | partial | core | core |
| Data engineer | not needed | core | core | core |
| Platform and cost | partial | partial | core | core |
| Data architect | partial | partial | partial | partial |

"Partial" means the role is needed occasionally: it can be combined with another one or brought in from outside.

## Microsoft certifications as a reference point

A certificate does not replace experience, but it helps to write a job description or a training plan. As of November 2026 these are current:

- **PL-300, Power BI Data Analyst:** for the BI developer.
- **DP-600, Fabric Analytics Engineer:** data preparation, semantic models, SQL, KQL and DAX in Fabric.
- **DP-700, Fabric Data Engineer:** for the data engineer in Fabric.

## Hire, train or bring in a partner

- **Hire** for work that will always exist: running, changes, ownership of the model.
- **Train your own people** where business knowledge matters more than the tool. Someone from finance who knows how margin is calculated is often easier to teach Power BI than it is to explain to a developer why margin is calculated that way.
- **Bring in a partner** for the build peak, for rare skills (architecture, capacity optimisation, model audits) and for an independent view.

## Signs the team is too small

- The request backlog grows every month.
- Refresh failures are reported by executives, not by monitoring.
- There is no time for documentation and tests.
- One person knows how everything works and cannot take a holiday in peace.

## Common mistakes

- Hiring only report developers for a warehouse or lakehouse architecture.
- Counting only the build and forgetting the run.
- Having no data owner on the business side.
- Keeping a critical skill with one person.

## Where to start

Take the inventory from step 1, estimate the hours on your own numbers and compare the result with how many people actually work on analytics today. If the gap is large, start with [data architecture](/en/data-architecture/) and [data governance](/en/data-governance/): they decide how much work people will have to do in the first place.

Can your BI specialist go on holiday without putting reports at risk?
