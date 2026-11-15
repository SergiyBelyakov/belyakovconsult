---
title: "An honest forecast: test a model before you trust it"
description: Held out data, a naive benchmark, MASE and an interval instead of a single line. Six rules for choosing a forecasting model that really predicts the future.
date: 2027-03-15
draft: true
services: [data-analysis, financial-analytics, management-analytics]
tags: [forecasting, data analysis, accuracy, Excel]
promo:
  hook: "The model fits the past perfectly. And loses to “same as last year”."
  tag: "Forecasting"
  cta: "What benchmark do you compare your forecast with?"
carousel:
  - title: A nice line is not a forecast
    text: A complex model fits the history almost perfectly, then makes bigger errors on new data than a simple rule.
    visual:
      type: compare
      highlight: right
      left: {label: "on history", value: "almost no error"}
      right: {label: "on new data", value: "worse than “last year”"}
  - title: Hide the last periods
    text: Train the model without the last 12 months and ask it to forecast them. Only then do you see the real accuracy.
    visual:
      type: flow
      items: ["History", "Train without 12 months", "Forecast", "Compare with actuals"]
  - title: Compare with naive
    text: "MASE divides the model’s error by the error of “same as last year”. Below 1: the model is useful. Above 1: use something simpler."
    visual:
      type: bars
      items: [{label: "Holt-Winters", value: 0.52}, {label: "ARIMA", value: 0.62}, {label: "Seasonal naive", value: 1.57}]
      note: "MASE on coffee shop revenue, lower is better"
  - title: An interval, not a line
    text: An 80% interval means the actual falls within it in 8 cases out of 10. Plan stock and budgets on the interval.
    visual:
      type: compare
      highlight: right
      left: {label: "one line", value: "1,633"}
      right: {label: "80% interval", value: "1,542 … 1,725"}
  - title: Test it on your data
    text: 18 models with formulas, accuracy testing and a forecast on your own file right in the browser.
    visual: {type: doc, label: "Forecasting models", note: "Data Lab"}
---

A fictional situation. A financial analyst builds a one year revenue forecast for a coffee shop chain. A model with a dozen parameters fits six years of history almost perfectly, the chart looks convincing, and the purchasing plan is based on it. A quarter later the actuals run noticeably lower. The simplest rule, “this month will be like the same month last year plus growth”, would have been wrong by less.

The problem is not the model, it is the testing. How well a model describes the past says almost nothing about how well it will predict the future. Here are six rules that separate an honest forecast from a nice line.

## 1. Test on data the model has not seen

Hide the last periods: 12 months for a monthly series, 13 weeks for a weekly one, 28 days for a daily one. Train the model on the rest and ask it to forecast what you hid. The difference between the forecast and the actuals on this held out data is the real accuracy.

The error on history is always optimistic: the model tuned its parameters to exactly those points. The more parameters, the better it memorises noise and the worse it carries that noise into the future. For reliability the test is repeated several times with a shifting starting point, which shows whether the model won one particular year by chance.

## 2. Always have a naive benchmark

The naive forecast: “tomorrow equals today”. The seasonal naive: “this month equals the same month last year”. They tune nothing, yet over a short horizon they are often hard to beat. A model that is not more accurate than the naive forecast is not needed, however sophisticated it is.

A convenient measure for the comparison is MASE: the model’s mean error divided by the error of the naive forecast. Below 1 means the model is more useful than “same as last year”, above 1 means a simple rule is the better choice. On the synthetic coffee shop revenue in the Data Lab, Holt-Winters scores a MASE of 0.52, ARIMA 0.62, and the seasonal naive 1.57 because it ignores growth.

## 3. Look beyond the average error

MAPE, the error in percent, is easy for managers to read, but it breaks when the actuals contain zeros, and it pushes towards under-forecasting: an over-forecast can produce an error above 100%, an under-forecast cannot. Bias shows whether the model systematically over- or under-forecasts: a forecast that is 5% above the actual every month means excess purchases even with a small average error.

Keep several measures side by side: MAE in the units of the series, MASE for the comparison with a benchmark, bias and the share of actuals inside the interval.

## 4. Show an interval, not just a line

A single number forecast is misleading: it suggests a precision that does not exist. An 80% interval means the actual falls within it in 8 cases out of 10. Safety stock, budget reserves and the number of shifts are planned on the interval.

The interval needs testing too. If only half of the held out actuals fall into the 80% interval, the model is overconfident. When you need the probability of an event (“what are the chances the price goes above 66 UAH”), a Monte Carlo simulation helps: a thousand possible futures instead of one.

## 5. Look at the residuals

Residuals are the difference between the actuals and what the model would have predicted one step ahead. In a good model they look like noise: no waves, no season, no trend. If the residuals show December peaks, the model missed the seasonality. If they stay above zero for a long time, it cannot keep up with the trend.

Residual autocorrelations show the same thing in numbers: bars outside the dashed lines mean the series still holds a pattern that can be used.

## 6. A simpler model with the same accuracy is better

In the M3 forecasting competition on 3,003 series, the Theta method came out on top: a simple combination of a trend line and exponential smoothing. The result has been confirmed many times since: complexity rarely pays off, and an average of several simple models is almost never the worst.

A simple model is easier to explain, check and maintain. If two models have the same MASE, choose the one the decision maker will understand.

## A check before you show a forecast

1. Is the accuracy measured on held out data rather than on history?
2. Does the model beat the naive or seasonal naive forecast?
3. Is there no systematic over- or under-forecasting?
4. Is an interval shown, and do the actuals fall into it as often as promised?
5. Are the residuals clean: no season, waves or trend?
6. Are you not forecasting further than the history allows? A seasonal series needs at least two full seasons.

## Test it on your data

The Data Lab now has a section on [forecasting models](/en/cases/forecast-models/): 18 models from the naive forecast to ARIMA, Monte Carlo and an ensemble. Each one comes with formulas, parameters you can move, a test on held out data and an explanation of what the model sees in the series. On the “Your data” page you can upload your own CSV or Excel file: every model is tested on it, the most accurate one builds a forecast with an interval, and the result downloads to Excel. The file never leaves your browser.

What benchmark do you compare your forecast with?
