---
services: [business-intelligence, data-architecture]
cards:
  - title: What stays in BI, what moves out
    text: Three places for data cleaning and one simple rule to choose.
  - title: Three places
    text: "Report\nData model\nSource"
    visual: {type: grid}
  - title: The rule
    text: One question. Who else uses this cleaning?
    visual:
      type: compare
      highlight: right
      left: {label: "This report only", value: "BI"}
      right: {label: "Several reports", value: "Model"}
  - title: And entry errors
    text: They go back to the source. Otherwise they get fixed every month, in every report separately.
    visual: {type: doc, label: "Entry error", note: "Fix at the source"}
---
Not all data cleaning needs to leave Power BI. But not all of it should stay there either.

The simple rule I use: what only matters for display stays in the report. What several reports use goes into the data model. What is an entry error goes back to the source, to the people who can remove it for good.

#powerbi #businessintelligence #dataquality #dataarchitecture #dataanalytics
