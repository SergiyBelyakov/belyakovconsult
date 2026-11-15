---
title: "Forecasting in Excel with formulas: from “last year” to FORECAST.ETS"
description: The naive forecast, moving average, smoothing, trend and seasonality in plain Excel formulas, plus an accuracy check. No Python or macros, step by step.
date: 2027-03-22
draft: true
services: [data-analysis, financial-analytics, business-intelligence]
tags: [forecasting, Excel, data analysis, budgeting]
promo:
  hook: "An honest forecast does not need Python. Six Excel formulas will do."
  tag: "Excel"
  cta: "What formula do you use to forecast your plan today?"
carousel:
  - title: The forecast is already in your Excel
    text: The naive forecast, moving average, smoothing, trend and seasonality are calculated with ordinary formulas.
    visual:
      type: flow
      items: ["Last year", "Average", "Smoothing", "Trend", "Season"]
  - title: Start with “last year”
    text: "=INDEX(B:B,ROW()-12) takes the same month last year. Any more complex model has to beat this benchmark."
    visual: {type: doc, label: "=INDEX(B:B,ROW()-12)", note: "seasonal naive forecast"}
  - title: Smoothing in one formula
    text: "Level = α · actual + (1 − α) · previous level. A higher α reacts faster to new data but carries more noise."
    visual:
      type: compare
      highlight: left
      left: {label: "α = 0.2", value: "a calm level"}
      right: {label: "α = 0.8", value: "jitters with the actuals"}
  - title: Season and trend together
    text: "FORECAST.ETS calculates Holt-Winters, and FORECAST.ETS.CONFINT gives the width of the interval."
    visual: {type: doc, label: "=FORECAST.ETS(A74,B$2:B$73,A$2:A$73,12)", note: "Excel 2016 and later"}
  - title: Check the accuracy
    text: Hide the last 12 months, forecast them and compare the error with the “same as last year” forecast.
    visual:
      type: bars
      items: [{label: "Holt-Winters", value: 0.52}, {label: "Linear trend", value: 0.97}, {label: "Seasonal naive", value: 1.57}]
      note: "MASE on coffee shop revenue, lower is better"
---

In most organisations the forecast lives in Excel. Often it is a single formula: last year’s average plus the manager’s gut feeling. Between that and machine learning there is a wide middle ground, and plain formulas cover it well. Here are six steps, each of which you can check on your own sheet.

All the examples below use a monthly series: dates in column A, values in column B from row 2 to row 73 (six years), the forecast from row 74. Arguments are separated by commas, as in English regional settings.

## 1. Naive and “same as last year”

The naive forecast repeats the last value: `=INDEX(B:B,COUNTA(B:B))`. The seasonal naive takes the same month last year: `=INDEX(B:B,ROW()-12)`. These formulas tune nothing, yet everything else has to be compared with them. A model that does not beat “same as last year” is not worth its complexity.

## 2. Moving average

The average of the last w periods: `=AVERAGE(B70:B73)` for a window of 4. A wide window smooths noise but notices changes late; a narrow one reacts quickly but jitters. A window that is a multiple of the season (12 for months, 7 for days) removes seasonality and shows the level. On a seasonal series a moving average is no good for forecasting: it gives a flat line.

## 3. Exponential smoothing

The level is updated every period: the new value weighs α, the previous level 1 − α. If α sits in cell H2 and the level is calculated in column C, the formula in row 3 is `=$H$2*B3+(1-$H$2)*C2`. The forecast for all future periods equals the last level.

α is chosen by the smallest error: calculate the one step ahead error in column D, the mean absolute error `=SUMPRODUCT(ABS(D3:D73))/COUNT(D3:D73)`, and minimise it with the Solver add-in by changing H2 between 0.01 and 0.99, or simply try a few values of α by hand.

## 4. Trend

A trend line: `=FORECAST.LINEAR(A74,B$2:B$73,A$2:A$73)`, the slope separately with `=SLOPE(B$2:B$73,A$2:A$73)`. A line is the easiest to explain (“+313 subscribers a month”), but it does not see slowing growth and keeps rising forever.

Holt’s method adds a smoothed trend to the smoothed level: two columns, level and slope, each with its own parameter. Damping (a parameter φ slightly below 1) stops the trend from growing forever, and in practice it is one of the most reliable simple methods.

## 5. Season and trend together

Monthly sales, tourism or energy use need both. Excel 2016 and later has a built in method: `=FORECAST.ETS(A74,B$2:B$73,A$2:A$73,12)` calculates exponential smoothing with level, trend and season (close to Holt-Winters), and `=FORECAST.ETS.CONFINT(A74,B$2:B$73,A$2:A$73,0.95,12)` gives half the width of the 95% interval. The Forecast Sheet button on the Data tab does the same without formulas.

If the seasonality has to be explained in numbers, a regression with dummy variables works: a column with the month number in the series and 11 columns of “1 if this is February” and so on. `=TREND(B$2:B$73,C$2:N$73,C74:N74)` gives the forecast and `=LINEST(...)` the coefficients: how much each month is above or below January.

## 6. Check the accuracy, not the looks

Hide the last 12 months: build the forecast on data up to row 61 and compare it with the actuals in rows 62 to 73. Calculate the mean absolute error of the model and the same for “same as last year”. Their ratio is MASE: below 1 means the model is useful.

On the synthetic coffee shop revenue from the Data Lab, Holt-Winters scores a MASE of 0.52, the linear trend 0.97 and the seasonal naive 1.57. The linear trend is barely better than the benchmark because it does not see the season, even though its line looks convincing on the history.

## Ready made workbooks with formulas

In the [forecasting models](/en/cases/forecast-models/) section of the Data Lab, eight models have an “Excel with formulas” button: the naive and seasonal naive forecasts, drift, moving average, smoothing, Holt, linear trend and Holt-Winters via FORECAST.ETS. The parameters sit in yellow cells: change α or the window and Excel recalculates the model, the forecast and the mean error. You can also download sample data there and test all 18 models on your own file.

What formula do you use to forecast your plan today?
