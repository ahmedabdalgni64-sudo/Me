// server.ts
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

// src/server/binance.ts
import { WebSocket } from "ws";

// src/server/indicators.ts
function calculateEMA(values, period) {
  const result = new Array(values.length).fill(null);
  if (values.length < period) return result;
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  let prevEMA = sum / period;
  result[period - 1] = prevEMA;
  const multiplier = 2 / (period + 1);
  for (let i = period; i < values.length; i++) {
    const currentEMA = (values[i] - prevEMA) * multiplier + prevEMA;
    result[i] = currentEMA;
    prevEMA = currentEMA;
  }
  return result;
}
function calculateSMA(values, period) {
  const result = new Array(values.length).fill(null);
  if (values.length < period) return result;
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  result[period - 1] = sum / period;
  for (let i = period; i < values.length; i++) {
    sum += values[i] - values[i - period];
    result[i] = sum / period;
  }
  return result;
}
function calculateRSI(closes, period = 14) {
  const result = new Array(closes.length).fill(null);
  if (closes.length <= period) return result;
  const gains = [];
  const losses = [];
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  avgGain /= period;
  avgLoss /= period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result[i + 1] = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);
  }
  return result;
}
function calculateMACD(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);
  const macdLine = new Array(closes.length).fill(null);
  for (let i = 0; i < closes.length; i++) {
    if (fastEMA[i] !== null && slowEMA[i] !== null) {
      macdLine[i] = fastEMA[i] - slowEMA[i];
    }
  }
  const validStartIndex = macdLine.findIndex((v) => v !== null);
  const validMacd = validStartIndex !== -1 ? macdLine.slice(validStartIndex) : [];
  const validSignal = calculateEMA(validMacd, signalPeriod);
  const signalLine = new Array(closes.length).fill(null);
  const histogram = new Array(closes.length).fill(null);
  if (validStartIndex !== -1) {
    for (let i = 0; i < validSignal.length; i++) {
      const originalIdx = validStartIndex + i;
      signalLine[originalIdx] = validSignal[i];
      if (macdLine[originalIdx] !== null && validSignal[i] !== null) {
        histogram[originalIdx] = macdLine[originalIdx] - validSignal[i];
      }
    }
  }
  return { macdLine, signalLine, histogram };
}
function calculateBollingerBands(closes, period = 20, multiplier = 2) {
  const middle = calculateSMA(closes, period);
  const upper = new Array(closes.length).fill(null);
  const lower = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    const mid = middle[i];
    if (mid === null) continue;
    let varianceSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      varianceSum += Math.pow(closes[j] - mid, 2);
    }
    const stdDev = Math.sqrt(varianceSum / period);
    upper[i] = mid + multiplier * stdDev;
    lower[i] = mid - multiplier * stdDev;
  }
  return { upper, middle, lower };
}
function calculateStochastic(candles, kPeriod = 14, kSmoothing = 3, dPeriod = 3) {
  const fastK = [];
  const fastKIndices = [];
  for (let i = kPeriod - 1; i < candles.length; i++) {
    let lowest = Infinity;
    let highest = -Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (candles[j].low < lowest) lowest = candles[j].low;
      if (candles[j].high > highest) highest = candles[j].high;
    }
    const diff = highest - lowest;
    const currentClose = candles[i].close;
    const kVal = diff === 0 ? 50 : (currentClose - lowest) / diff * 100;
    fastK.push(kVal);
    fastKIndices.push(i);
  }
  const smoothedKValues = calculateSMA(fastK, kSmoothing);
  const smoothedKAll = new Array(candles.length).fill(null);
  const validSmoothedK = [];
  const validSmoothedKIndices = [];
  for (let i = 0; i < smoothedKValues.length; i++) {
    const val = smoothedKValues[i];
    const targetIdx = fastKIndices[i];
    smoothedKAll[targetIdx] = val;
    if (val !== null) {
      validSmoothedK.push(val);
      validSmoothedKIndices.push(targetIdx);
    }
  }
  const dValues = calculateSMA(validSmoothedK, dPeriod);
  const dAll = new Array(candles.length).fill(null);
  for (let i = 0; i < dValues.length; i++) {
    const val = dValues[i];
    const targetIdx = validSmoothedKIndices[i];
    dAll[targetIdx] = val;
  }
  return { stochK: smoothedKAll, stochD: dAll };
}
function calculateATR(candles, period = 14) {
  if (candles.length < 2) return 0;
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const cur = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close)
    );
    trs.push(tr);
  }
  if (trs.length < period) {
    return trs.reduce((a, b) => a + b, 0) / (trs.length || 1);
  }
  let atr = 0;
  for (let i = 0; i < period; i++) {
    atr += trs[i];
  }
  atr /= period;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  return atr;
}
function findPivots(candles, currentPrice, lookback = 100) {
  const subset = candles.slice(-lookback);
  const pivotsHigh = [];
  const pivotsLow = [];
  const windowSize = 3;
  for (let i = windowSize; i < subset.length - windowSize; i++) {
    const curr = subset[i];
    let isHigh = true;
    let isLow = true;
    for (let w = 1; w <= windowSize; w++) {
      if (subset[i - w].high > curr.high || subset[i + w].high > curr.high) {
        isHigh = false;
      }
      if (subset[i - w].low < curr.low || subset[i + w].low < curr.low) {
        isLow = false;
      }
    }
    if (isHigh) pivotsHigh.push(curr.high);
    if (isLow) pivotsLow.push(curr.low);
  }
  const resistances = pivotsHigh.filter((p) => p > currentPrice * 1.001).sort((a, b) => a - b);
  const supports = pivotsLow.filter((p) => p < currentPrice * 0.999).sort((a, b) => b - a);
  const cleanLevels = (levels) => {
    const res = [];
    for (const lvl of levels) {
      if (!res.some((existing) => Math.abs(existing - lvl) / existing < 3e-3)) {
        res.push(lvl);
      }
      if (res.length >= 2) break;
    }
    return res;
  };
  const nearestResistances = cleanLevels(resistances);
  const nearestSupports = cleanLevels(supports);
  if (nearestResistances.length === 0) {
    nearestResistances.push(currentPrice * 1.02);
    nearestResistances.push(currentPrice * 1.04);
  } else if (nearestResistances.length === 1) {
    nearestResistances.push(nearestResistances[0] * 1.02);
  }
  if (nearestSupports.length === 0) {
    nearestSupports.push(currentPrice * 0.98);
    nearestSupports.push(currentPrice * 0.96);
  } else if (nearestSupports.length === 1) {
    nearestSupports.push(nearestSupports[0] * 0.98);
  }
  return { nearestSupports, nearestResistances };
}
function analyzeMarketData(symbol, interval, candles, tickerMeta) {
  if (candles.length < 50) {
    throw new Error(`\u0639\u062F\u062F \u0627\u0644\u0634\u0645\u0648\u0639 \u0627\u0644\u0645\u0633\u062A\u0644\u0645\u0629 (${candles.length}) \u063A\u064A\u0631 \u0643\u0627\u0641\u064D \u0644\u0625\u062C\u0631\u0627\u0621 \u0627\u0644\u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u0641\u0646\u064A \u0627\u0644\u062F\u0642\u064A\u0642 (\u0627\u0644\u062D\u062F \u0627\u0644\u0623\u062F\u0646\u0649 50).`);
  }
  const closes = candles.map((c) => c.close);
  const lastIndex = candles.length - 1;
  const currentPrice = candles[lastIndex].close;
  const ema20Series = calculateEMA(closes, 20);
  const ema50Series = calculateEMA(closes, 50);
  const curEMA20 = ema20Series[lastIndex] ?? currentPrice;
  const curEMA50 = ema50Series[lastIndex] ?? currentPrice;
  let emaSignal = "\u0645\u062D\u0627\u064A\u062F";
  let emaInterpretation = "\u0627\u0644\u0633\u0639\u0631 \u0648\u0645\u062A\u0648\u0633\u0637\u0627\u062A EMA \u0641\u064A \u0646\u0637\u0627\u0642 \u0645\u062A\u062F\u0627\u062E\u0644";
  if (currentPrice > curEMA20 && curEMA20 > curEMA50) {
    emaSignal = "\u0634\u0631\u0627\u0621";
    emaInterpretation = "\u0627\u0644\u0633\u0639\u0631 \u0641\u0648\u0642 EMA20 \u0648EMA20 \u0641\u0648\u0642 EMA50 (\u062A\u0631\u062A\u064A\u0628 \u0635\u0627\u0639\u062F \u0642\u0648\u064A)";
  } else if (currentPrice < curEMA20 && curEMA20 < curEMA50) {
    emaSignal = "\u0628\u064A\u0639";
    emaInterpretation = "\u0627\u0644\u0633\u0639\u0631 \u062A\u062D\u062A EMA20 \u0648EMA20 \u062A\u062D\u062A EMA50 (\u062A\u0631\u062A\u064A\u0628 \u0647\u0627\u0628\u0637)";
  }
  const rsiSeries = calculateRSI(closes, 14);
  const curRSI = rsiSeries[lastIndex] ?? 50;
  let rsiSignal = "\u0645\u062D\u0627\u064A\u062F";
  let rsiInterpretation = "\u0641\u064A \u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0645\u062D\u0627\u064A\u062F\u0629 \u0627\u0644\u0637\u0628\u064A\u0639\u064A\u0629 (30 - 70)";
  if (curRSI < 30) {
    rsiSignal = "\u0634\u0631\u0627\u0621";
    rsiInterpretation = `\u0630\u0631\u0648\u0629 \u0628\u064A\u0639 \u0645\u0641\u0631\u0637\u0629 (${curRSI.toFixed(1)} < 30) \u062A\u0634\u064A\u0631 \u0644\u0627\u062D\u062A\u0645\u0627\u0644 \u0627\u0631\u062A\u062F\u0627\u062F \u0635\u0627\u0639\u062F`;
  } else if (curRSI > 70) {
    rsiSignal = "\u0628\u064A\u0639";
    rsiInterpretation = `\u0630\u0631\u0648\u0629 \u0634\u0631\u0627\u0621 \u0645\u0641\u0631\u0637\u0629 (${curRSI.toFixed(1)} > 70) \u062A\u0634\u064A\u0631 \u0644\u062A\u0634\u0628\u0639 \u0634\u0631\u0627\u0626\u064A \u0648\u062C\u0646\u064A \u0623\u0631\u0628\u0627\u062D`;
  }
  const { macdLine, signalLine, histogram } = calculateMACD(closes, 12, 26, 9);
  const curMacd = macdLine[lastIndex] ?? 0;
  const curSignal = signalLine[lastIndex] ?? 0;
  const curHist = histogram[lastIndex] ?? 0;
  let macdSignal = "\u0645\u062D\u0627\u064A\u062F";
  let macdInterpretation = "\u062E\u0637 \u0627\u0644\u0645\u0627\u0643\u062F \u0642\u0631\u064A\u0628 \u0645\u0646 \u062E\u0637 \u0627\u0644\u0625\u0634\u0627\u0631\u0629";
  if (curMacd > curSignal) {
    macdSignal = "\u0634\u0631\u0627\u0621";
    macdInterpretation = `\u062E\u0637 \u0627\u0644\u0645\u0627\u0643\u062F (${curMacd.toFixed(2)}) \u0623\u0639\u0644\u0649 \u0645\u0646 \u062E\u0637 \u0627\u0644\u0625\u0634\u0627\u0631\u0629 (${curSignal.toFixed(2)}) \u0645\u0639 \u0647\u064A\u0633\u062A\u0648\u063A\u0631\u0627\u0645 \u0625\u064A\u062C\u0627\u0628\u064A`;
  } else if (curMacd < curSignal) {
    macdSignal = "\u0628\u064A\u0639";
    macdInterpretation = `\u062E\u0637 \u0627\u0644\u0645\u0627\u0643\u062F (${curMacd.toFixed(2)}) \u0623\u062F\u0646\u0649 \u0645\u0646 \u062E\u0637 \u0627\u0644\u0625\u0634\u0627\u0631\u0629 (${curSignal.toFixed(2)}) \u0645\u0639 \u0647\u064A\u0633\u062A\u0648\u063A\u0631\u0627\u0645 \u0633\u0644\u0628\u064A`;
  }
  const { upper, middle, lower } = calculateBollingerBands(closes, 20, 2);
  const curUpper = upper[lastIndex] ?? currentPrice * 1.05;
  const curMiddle = middle[lastIndex] ?? currentPrice;
  const curLower = lower[lastIndex] ?? currentPrice * 0.95;
  const bandWidth = curUpper - curLower;
  const percentB = bandWidth > 0 ? (currentPrice - curLower) / bandWidth : 0.5;
  let bollingerSignal = "\u0645\u062D\u0627\u064A\u062F";
  let bollingerInterpretation = "\u0627\u0644\u0633\u0639\u0631 \u064A\u062A\u062D\u0631\u0643 \u062F\u0627\u062E\u0644 \u062D\u062F\u0648\u062F \u0646\u0637\u0627\u0642 \u0628\u0648\u0644\u064A\u0646\u062C\u0631 \u0627\u0644\u0637\u0628\u064A\u0639\u064A";
  if (currentPrice <= curLower) {
    bollingerSignal = "\u0634\u0631\u0627\u0621";
    bollingerInterpretation = `\u0627\u0644\u0633\u0639\u0631 \u0639\u0646\u062F \u0627\u0644\u062D\u062F \u0627\u0644\u0633\u0641\u0644\u064A \u0623\u0648 \u062A\u062D\u062A\u0647 (${curLower.toFixed(2)}) \u064A\u0631\u062C\u062D \u0627\u0644\u0627\u0631\u062A\u062F\u0627\u062F`;
  } else if (currentPrice >= curUpper) {
    bollingerSignal = "\u0628\u064A\u0639";
    bollingerInterpretation = `\u0627\u0644\u0633\u0639\u0631 \u0639\u0646\u062F \u0627\u0644\u062D\u062F \u0627\u0644\u0639\u0644\u0648\u064A \u0623\u0648 \u0641\u0648\u0642\u0647 (${curUpper.toFixed(2)}) \u064A\u0631\u062C\u062D \u0627\u0644\u062A\u0635\u062D\u064A\u062D`;
  }
  const { stochK, stochD } = calculateStochastic(candles, 14, 3, 3);
  const curK = stochK[lastIndex] ?? 50;
  const curD = stochD[lastIndex] ?? 50;
  let stochasticSignal = "\u0645\u062D\u0627\u064A\u062F";
  let stochasticInterpretation = "\u0627\u0644\u0645\u0624\u0634\u0631 \u0641\u064A \u0627\u0644\u0646\u0637\u0627\u0642 \u0627\u0644\u0645\u062A\u0648\u0633\u0637 (20 - 80)";
  if (curK < 20) {
    stochasticSignal = "\u0634\u0631\u0627\u0621";
    stochasticInterpretation = `\u0642\u064A\u0645\u0629 %K \u0639\u0646\u062F (${curK.toFixed(1)} < 20) \u0641\u064A \u0645\u0646\u0637\u0642\u0629 \u062A\u0634\u0628\u0639 \u0628\u064A\u0639\u064A`;
  } else if (curK > 80) {
    stochasticSignal = "\u0628\u064A\u0639";
    stochasticInterpretation = `\u0642\u064A\u0645\u0629 %K \u0639\u0646\u062F (${curK.toFixed(1)} > 80) \u0641\u064A \u0645\u0646\u0637\u0642\u0629 \u062A\u0634\u0628\u0639 \u0634\u0631\u0627\u0626\u064A`;
  }
  const indicatorSignals = [
    rsiSignal,
    macdSignal,
    emaSignal,
    bollingerSignal,
    stochasticSignal
  ];
  let buyCount = 0;
  let sellCount = 0;
  let neutralCount = 0;
  for (const s of indicatorSignals) {
    if (s === "\u0634\u0631\u0627\u0621") buyCount++;
    else if (s === "\u0628\u064A\u0639") sellCount++;
    else neutralCount++;
  }
  let overallSignal = "\u0645\u062D\u0627\u064A\u062F";
  if (buyCount >= 4) {
    overallSignal = "\u0634\u0631\u0627\u0621 \u0642\u0648\u064A";
  } else if (buyCount === 3 && buyCount > sellCount) {
    overallSignal = "\u0634\u0631\u0627\u0621";
  } else if (sellCount >= 4) {
    overallSignal = "\u0628\u064A\u0639 \u0642\u0648\u064A";
  } else if (sellCount === 3 && sellCount > buyCount) {
    overallSignal = "\u0628\u064A\u0639";
  } else {
    overallSignal = "\u0645\u062D\u0627\u064A\u062F";
  }
  const majorityCount = Math.max(buyCount, sellCount, neutralCount);
  const consensusRatio = `${majorityCount} \u0645\u0646 5 \u0645\u0624\u0634\u0631\u0627\u062A \u062A\u062A\u0641\u0642`;
  const agreementPercentage = Math.round(majorityCount / 5 * 100);
  const summary = {
    overallSignal,
    buyCount,
    sellCount,
    neutralCount,
    consensusRatio,
    agreementPercentage
  };
  const prev5Index = Math.max(0, lastIndex - 5);
  const prevEMA50 = ema50Series[prev5Index] ?? curEMA50;
  const ema50SlopePercent = (curEMA50 - prevEMA50) / (prevEMA50 || 1) * 100;
  let trend = "\u0639\u0631\u0636\u064A";
  if (ema50SlopePercent > 0.05 && currentPrice > curEMA50) {
    trend = "\u0635\u0627\u0639\u062F";
  } else if (ema50SlopePercent < -0.05 && currentPrice < curEMA50) {
    trend = "\u0647\u0627\u0628\u0637";
  } else {
    trend = "\u0639\u0631\u0636\u064A";
  }
  const { nearestSupports, nearestResistances } = findPivots(candles, currentPrice, 100);
  const atr14 = calculateATR(candles, 14);
  let direction = "\u0644\u0627 \u062A\u0648\u062C\u062F \u0635\u0641\u0642\u0629 \u0648\u0627\u0636\u062D\u0629";
  let isValid = false;
  let entryPrice = currentPrice;
  let stopLoss = 0;
  let takeProfit = 0;
  let riskRewardRatio = 0;
  let rejectionReason;
  const primarySupport = nearestSupports[0] || currentPrice * 0.98;
  const primaryResistance = nearestResistances[0] || currentPrice * 1.02;
  if (overallSignal === "\u0634\u0631\u0627\u0621 \u0642\u0648\u064A" || overallSignal === "\u0634\u0631\u0627\u0621") {
    direction = "\u0634\u0631\u0627\u0621";
    entryPrice = currentPrice;
    const baseStop = primarySupport < currentPrice ? primarySupport : currentPrice - atr14;
    stopLoss = Number((baseStop - 1.5 * atr14).toFixed(4));
    takeProfit = Number(primaryResistance.toFixed(4));
    const risk = entryPrice - stopLoss;
    const reward = takeProfit - entryPrice;
    if (risk <= 0 || reward <= 0) {
      direction = "\u0644\u0627 \u062A\u0648\u062C\u062F \u0635\u0641\u0642\u0629 \u0648\u0627\u0636\u062D\u0629";
      isValid = false;
      rejectionReason = "\u0627\u0644\u0645\u0633\u062A\u0648\u064A\u0627\u062A \u0627\u0644\u0641\u0646\u064A\u0629 \u0645\u062A\u0642\u0627\u0631\u0628\u0629 \u062C\u062F\u0627\u064B \u0623\u0648 \u063A\u064A\u0631 \u0645\u062A\u0633\u0642\u0629";
    } else {
      riskRewardRatio = Number((reward / risk).toFixed(2));
      if (riskRewardRatio < 1.5) {
        direction = "\u0644\u0627 \u062A\u0648\u062C\u062F \u0635\u0641\u0642\u0629 \u0648\u0627\u0636\u062D\u0629";
        isValid = false;
        rejectionReason = `\u0646\u0633\u0628\u0629 \u0627\u0644\u0639\u0627\u0626\u062F \u0644\u0644\u0645\u062E\u0627\u0637\u0631\u0629 (1:${riskRewardRatio}) \u0623\u0642\u0644 \u0645\u0646 \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u062F\u0646\u0649 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 1:1.5`;
      } else {
        isValid = true;
      }
    }
  } else if (overallSignal === "\u0628\u064A\u0639 \u0642\u0648\u064A" || overallSignal === "\u0628\u064A\u0639") {
    direction = "\u0628\u064A\u0639";
    entryPrice = currentPrice;
    const baseStop = primaryResistance > currentPrice ? primaryResistance : currentPrice + atr14;
    stopLoss = Number((baseStop + 1.5 * atr14).toFixed(4));
    takeProfit = Number(primarySupport.toFixed(4));
    const risk = stopLoss - entryPrice;
    const reward = entryPrice - takeProfit;
    if (risk <= 0 || reward <= 0) {
      direction = "\u0644\u0627 \u062A\u0648\u062C\u062F \u0635\u0641\u0642\u0629 \u0648\u0627\u0636\u062D\u0629";
      isValid = false;
      rejectionReason = "\u0627\u0644\u0645\u0633\u062A\u0648\u064A\u0627\u062A \u0627\u0644\u0641\u0646\u064A\u0629 \u0645\u062A\u0642\u0627\u0631\u0628\u0629 \u062C\u062F\u0627\u064B \u0623\u0648 \u063A\u064A\u0631 \u0645\u062A\u0633\u0642\u0629";
    } else {
      riskRewardRatio = Number((reward / risk).toFixed(2));
      if (riskRewardRatio < 1.5) {
        direction = "\u0644\u0627 \u062A\u0648\u062C\u062F \u0635\u0641\u0642\u0629 \u0648\u0627\u0636\u062D\u0629";
        isValid = false;
        rejectionReason = `\u0646\u0633\u0628\u0629 \u0627\u0644\u0639\u0627\u0626\u062F \u0644\u0644\u0645\u062E\u0627\u0637\u0631\u0629 (1:${riskRewardRatio}) \u0623\u0642\u0644 \u0645\u0646 \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u062F\u0646\u0649 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 1:1.5`;
      } else {
        isValid = true;
      }
    }
  } else {
    direction = "\u0644\u0627 \u062A\u0648\u062C\u062F \u0635\u0641\u0642\u0629 \u0648\u0627\u0636\u062D\u0629";
    isValid = false;
    rejectionReason = "\u0627\u0644\u0645\u0624\u0634\u0631\u0627\u062A \u0627\u0644\u0641\u0646\u064A\u0629 \u0641\u064A \u062D\u0627\u0644\u0629 \u062A\u0628\u0627\u064A\u0646 \u0648\u062D\u064A\u0627\u062F\u060C \u064A\u0641\u0636\u0644 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u062D\u062A\u0649 \u0627\u0643\u062A\u0645\u0627\u0644 \u0625\u0634\u0627\u0631\u0629 \u0648\u0627\u0636\u062D\u0629";
  }
  let confidence = "\u0645\u0646\u062E\u0641\u0636\u0629";
  if (majorityCount >= 4 && (trend === "\u0635\u0627\u0639\u062F" || trend === "\u0647\u0627\u0628\u0637")) {
    confidence = "\u0639\u0627\u0644\u064A\u0629";
  } else if (majorityCount >= 3) {
    confidence = "\u0645\u062A\u0648\u0633\u0637\u0629";
  }
  const fmt = (num) => num >= 1e3 ? num.toLocaleString("en-US", { maximumFractionDigits: 2 }) : num.toFixed(num < 1 ? 4 : 2);
  let explanationAr = "";
  if (direction === "\u0634\u0631\u0627\u0621" && isValid) {
    explanationAr = `\u0645\u0624\u0634\u0631 RSI \u0639\u0646\u062F ${curRSI.toFixed(1)} (${rsiSignal})\u060C \u0648\u0627\u0644\u0633\u0639\u0631 \u0627\u0644\u062D\u0627\u0644\u064A ${fmt(currentPrice)} \u064A\u062A\u0645\u0631\u0643\u0632 \u0641\u0648\u0642 \u062F\u0639\u0645 ${fmt(primarySupport)}. \u0627\u0644\u0627\u062A\u062C\u0627\u0647 \u0627\u0644\u0639\u0627\u0645 ${trend} \u0645\u0639 \u062A\u0648\u0627\u0641\u0642 ${buyCount} \u0645\u0646 5 \u0645\u0624\u0634\u0631\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u0635\u0639\u0648\u062F. \u0646\u0633\u0628\u0629 \u0627\u0644\u0639\u0627\u0626\u062F \u0644\u0644\u0645\u062E\u0627\u0637\u0631\u0629 \u0645\u0645\u062A\u0627\u0632\u0629 1:${riskRewardRatio}.`;
  } else if (direction === "\u0628\u064A\u0639" && isValid) {
    explanationAr = `\u0645\u0624\u0634\u0631 RSI \u0639\u0646\u062F ${curRSI.toFixed(1)} (${rsiSignal})\u060C \u0648\u0627\u0644\u0633\u0639\u0631 \u0627\u0644\u062D\u0627\u0644\u064A ${fmt(currentPrice)} \u064A\u0648\u0627\u062C\u0647 \u0645\u0642\u0627\u0648\u0645\u0629 \u0642\u0648\u064A\u0629 \u0639\u0646\u062F ${fmt(primaryResistance)}. \u0627\u0644\u0627\u062A\u062C\u0627\u0647 \u0627\u0644\u0639\u0627\u0645 ${trend} \u0645\u0639 \u062A\u0648\u0627\u0641\u0642 ${sellCount} \u0645\u0646 5 \u0645\u0624\u0634\u0631\u0627\u062A \u0639\u0644\u0649 \u0627\u0644\u0647\u0628\u0648\u0637. \u0646\u0633\u0628\u0629 \u0627\u0644\u0639\u0627\u0626\u062F \u0644\u0644\u0645\u062E\u0627\u0637\u0631\u0629 1:${riskRewardRatio}.`;
  } else {
    explanationAr = `\u0645\u0624\u0634\u0631 RSI \u0639\u0646\u062F ${curRSI.toFixed(1)}\u060C \u0627\u0644\u0633\u0639\u0631 \u0627\u0644\u062D\u0627\u0644\u064A ${fmt(currentPrice)} \u0642\u0631\u0628 \u062F\u0639\u0645 ${fmt(primarySupport)} \u0648\u0645\u0642\u0627\u0648\u0645\u0629 ${fmt(primaryResistance)}. \u0627\u0644\u0627\u062A\u062C\u0627\u0647 \u0627\u0644\u0639\u0627\u0645 ${trend} \u0645\u0639 \u062D\u0627\u0644\u0629 ${overallSignal}. ${rejectionReason || "\u0644\u0627 \u062A\u0648\u062C\u062F \u0635\u0641\u0642\u0629 \u0645\u0633\u062A\u0648\u0641\u064A\u0629 \u0644\u0644\u0634\u0631\u0648\u0637 \u062D\u0627\u0644\u064A\u0627\u064B"}.`;
  }
  const trade = {
    direction,
    isValid,
    entryPrice: Number(entryPrice.toFixed(4)),
    stopLoss: stopLoss > 0 ? stopLoss : Number((currentPrice * 0.97).toFixed(4)),
    takeProfit: takeProfit > 0 ? takeProfit : Number((currentPrice * 1.05).toFixed(4)),
    riskRewardRatio,
    atr14: Number(atr14.toFixed(4)),
    rejectionReason,
    explanationAr,
    confidence,
    trend,
    nearestSupports,
    nearestResistances
  };
  const indicators = {
    rsi: {
      value: Number(curRSI.toFixed(2)),
      signal: rsiSignal,
      interpretation: rsiInterpretation
    },
    macd: {
      macd: Number(curMacd.toFixed(4)),
      signalLine: Number(curSignal.toFixed(4)),
      histogram: Number(curHist.toFixed(4)),
      signal: macdSignal,
      interpretation: macdInterpretation
    },
    ema: {
      ema20: Number(curEMA20.toFixed(4)),
      ema50: Number(curEMA50.toFixed(4)),
      currentPrice: Number(currentPrice.toFixed(4)),
      signal: emaSignal,
      interpretation: emaInterpretation
    },
    bollinger: {
      upper: Number(curUpper.toFixed(4)),
      middle: Number(curMiddle.toFixed(4)),
      lower: Number(curLower.toFixed(4)),
      percentB: Number(percentB.toFixed(4)),
      signal: bollingerSignal,
      interpretation: bollingerInterpretation
    },
    stochastic: {
      k: Number(curK.toFixed(2)),
      d: Number(curD.toFixed(2)),
      signal: stochasticSignal,
      interpretation: stochasticInterpretation
    }
  };
  return {
    symbol,
    interval,
    currentPrice: Number(currentPrice.toFixed(4)),
    priceChange24h: tickerMeta?.priceChange24h ?? 0,
    priceChangePercent24h: tickerMeta?.priceChangePercent24h ?? 0,
    high24h: tickerMeta?.high24h ?? 0,
    low24h: tickerMeta?.low24h ?? 0,
    volume24h: tickerMeta?.volume24h ?? 0,
    lastUpdated: Date.now(),
    cached: false,
    candles,
    indicators,
    series: {
      ema20: ema20Series,
      ema50: ema50Series,
      bollingerUpper: upper,
      bollingerMiddle: middle,
      bollingerLower: lower,
      rsi: rsiSeries,
      macdLine,
      macdSignal: signalLine,
      macdHist: histogram,
      stochK,
      stochD
    },
    summary,
    trade
  };
}

// src/server/binance.ts
var PRIMARY_BINANCE_URL = "https://api.binance.com";
var FALLBACK_BINANCE_URL = "https://data-api.binance.vision";
var WS_BASE_URL = "wss://stream.binance.com:9443/ws";
var DEFAULT_SYMBOLS = [
  "BTCUSDT",
  "ETHUSDT",
  "BNBUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "ADAUSDT",
  "DOGEUSDT",
  "TONUSDT"
];
var VALID_TIMEFRAMES = ["15m", "1h", "4h", "1d"];
var CACHE_TTL_MS = 5e3;
var klineCache = /* @__PURE__ */ new Map();
var tickerCache = null;
var singleTickerCache = /* @__PURE__ */ new Map();
var exchangeInfoCache = null;
var lastSuccessfulBinanceContact = 0;
var lastBinanceError = null;
async function fetchBinanceApi(path2) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6e3);
    const res = await fetch(`${PRIMARY_BINANCE_URL}${path2}`, {
      signal: controller.signal,
      headers: {
        "User-Agent": "BinanceMarketReader/1.0",
        Accept: "application/json"
      }
    });
    clearTimeout(timeout);
    if (res.ok) {
      lastSuccessfulBinanceContact = Date.now();
      lastBinanceError = null;
      return await res.json();
    }
    const errText = await res.text();
    console.warn(`Primary Binance API returned status ${res.status}: ${errText.slice(0, 100)}`);
  } catch (err) {
    console.warn(`Primary Binance API failed (${err?.message || err}), switching to fallback...`);
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6e3);
    const res = await fetch(`${FALLBACK_BINANCE_URL}${path2}`, {
      signal: controller.signal,
      headers: {
        "User-Agent": "BinanceMarketReader/1.0",
        Accept: "application/json"
      }
    });
    clearTimeout(timeout);
    if (res.ok) {
      lastSuccessfulBinanceContact = Date.now();
      lastBinanceError = null;
      return await res.json();
    }
    const errText = await res.text();
    throw new Error(`\u0643\u0644\u0627 \u0627\u0644\u062E\u0627\u062F\u0645\u064A\u0646 \u063A\u064A\u0631 \u0645\u062A\u0627\u062D\u064A\u0646 \u062D\u0627\u0644\u064A\u0627\u064B (${res.status}): ${errText.slice(0, 100)}`);
  } catch (err) {
    lastBinanceError = err?.message || "\u0641\u0634\u0644 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u0640 Binance";
    throw new Error(`\u062A\u0639\u0630\u0631 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u062E\u0648\u0627\u062F\u0645 \u0628\u064A\u0646\u0627\u0646\u0633 \u0627\u0644\u0639\u0627\u0645\u0629: ${lastBinanceError}`);
  }
}
async function getKlines(symbol, interval = "1h", limit = 500) {
  const normSymbol = symbol.toUpperCase();
  const cacheKey = `${normSymbol}_${interval}_${limit}`;
  const now = Date.now();
  const cached = klineCache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return {
      candles: cached.data,
      cached: true,
      lastUpdated: cached.timestamp
    };
  }
  const raw = await fetchBinanceApi(
    `/api/v3/klines?symbol=${encodeURIComponent(normSymbol)}&interval=${interval}&limit=${limit}`
  );
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`\u0644\u0645 \u064A\u062A\u0645 \u0627\u0633\u062A\u0644\u0627\u0645 \u0623\u064A \u0634\u0645\u0648\u0639 \u0644\u0644\u0632\u0648\u062C ${normSymbol}`);
  }
  const candles = raw.map((item) => ({
    time: Number(item[0]),
    open: Number(item[1]),
    high: Number(item[2]),
    low: Number(item[3]),
    close: Number(item[4]),
    volume: Number(item[5]),
    closeTime: Number(item[6])
  }));
  klineCache.set(cacheKey, { data: candles, timestamp: now });
  return { candles, cached: false, lastUpdated: now };
}
async function get24hTickers(symbols = DEFAULT_SYMBOLS) {
  const now = Date.now();
  if (tickerCache && now - tickerCache.timestamp < CACHE_TTL_MS) {
    const filtered2 = tickerCache.data.filter((t) => symbols.includes(t.symbol));
    return {
      tickers: filtered2,
      cached: true,
      lastUpdated: tickerCache.timestamp
    };
  }
  const raw = await fetchBinanceApi("/api/v3/ticker/24hr");
  if (!Array.isArray(raw)) {
    throw new Error("\u0641\u0634\u0644 \u062C\u0644\u0628 \u0628\u064A\u0627\u0646\u0627\u062A \u0623\u0633\u0639\u0627\u0631 \u0627\u0644\u0633\u0648\u0642");
  }
  const allTickers = raw.filter((item) => item.symbol.endsWith("USDT")).map((item) => {
    const sym = item.symbol;
    const baseAsset = sym.replace("USDT", "");
    return {
      symbol: sym,
      baseAsset,
      quoteAsset: "USDT",
      price: Number(item.lastPrice),
      priceChange24h: Number(item.priceChange),
      priceChangePercent24h: Number(item.priceChangePercent),
      high24h: Number(item.highPrice),
      low24h: Number(item.lowPrice),
      volume24h: Number(item.volume),
      lastUpdated: now
    };
  });
  tickerCache = { data: allTickers, timestamp: now };
  const filtered = allTickers.filter((t) => symbols.includes(t.symbol));
  return { tickers: filtered, cached: false, lastUpdated: now };
}
async function getSingleTicker(symbol) {
  const normSymbol = symbol.toUpperCase();
  const now = Date.now();
  const cached = singleTickerCache.get(normSymbol);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }
  const raw = await fetchBinanceApi(
    `/api/v3/ticker/24hr?symbol=${encodeURIComponent(normSymbol)}`
  );
  const baseAsset = normSymbol.replace("USDT", "");
  const data = {
    symbol: normSymbol,
    baseAsset,
    quoteAsset: "USDT",
    price: Number(raw.lastPrice),
    priceChange24h: Number(raw.priceChange),
    priceChangePercent24h: Number(raw.priceChangePercent),
    high24h: Number(raw.highPrice),
    low24h: Number(raw.lowPrice),
    volume24h: Number(raw.volume),
    lastUpdated: now
  };
  singleTickerCache.set(normSymbol, { data, timestamp: now });
  return data;
}
async function getUsdtPairs() {
  const now = Date.now();
  if (exchangeInfoCache && now - exchangeInfoCache.timestamp < 36e5) {
    return exchangeInfoCache.data;
  }
  const raw = await fetchBinanceApi("/api/v3/exchangeInfo");
  const symbols = (raw?.symbols || []).filter((s) => s.status === "TRADING" && s.quoteAsset === "USDT").map((s) => s.symbol);
  exchangeInfoCache = { data: symbols, timestamp: now };
  return symbols;
}
async function getFullAnalysis(symbol, interval = "1h") {
  const normSymbol = symbol.toUpperCase();
  const [klinesResult, ticker] = await Promise.all([
    getKlines(normSymbol, interval, 500),
    getSingleTicker(normSymbol).catch(() => null)
  ]);
  const analysis = analyzeMarketData(normSymbol, interval, klinesResult.candles, {
    priceChange24h: ticker?.priceChange24h,
    priceChangePercent24h: ticker?.priceChangePercent24h,
    high24h: ticker?.high24h,
    low24h: ticker?.low24h,
    volume24h: ticker?.volume24h
  });
  analysis.cached = klinesResult.cached;
  analysis.lastUpdated = klinesResult.lastUpdated;
  return analysis;
}
async function getTimeframesSummary(symbol) {
  const normSymbol = symbol.toUpperCase();
  const timeframes = ["15m", "1h", "4h", "1d"];
  const results = await Promise.all(
    timeframes.map(async (tf) => {
      try {
        const { candles } = await getKlines(normSymbol, tf, 200);
        const analysis = analyzeMarketData(normSymbol, tf, candles);
        return {
          timeframe: tf,
          signal: analysis.summary.overallSignal,
          buyCount: analysis.summary.buyCount,
          sellCount: analysis.summary.sellCount,
          price: analysis.currentPrice,
          rsi: analysis.indicators.rsi.value,
          trend: analysis.trade.trend
        };
      } catch (err) {
        return {
          timeframe: tf,
          signal: "\u0645\u062D\u0627\u064A\u062F",
          buyCount: 0,
          sellCount: 0,
          price: 0,
          rsi: 50,
          trend: "\u0639\u0631\u0636\u064A"
        };
      }
    })
  );
  return results;
}
async function getWatchlistWithSignals() {
  const { tickers, lastUpdated } = await get24hTickers(DEFAULT_SYMBOLS);
  const tickersWithSignals = await Promise.all(
    tickers.map(async (t) => {
      try {
        const { candles } = await getKlines(t.symbol, "1h", 100);
        const analysis = analyzeMarketData(t.symbol, "1h", candles);
        return {
          ...t,
          signal: analysis.summary.overallSignal,
          lastUpdated
        };
      } catch {
        return {
          ...t,
          signal: "\u0645\u062D\u0627\u064A\u062F",
          lastUpdated
        };
      }
    })
  );
  return tickersWithSignals;
}
var BinanceStreamManager = class {
  constructor() {
    this.activeStreams = /* @__PURE__ */ new Map();
    this.listeners = /* @__PURE__ */ new Map();
  }
  subscribe(symbol, interval, listener) {
    const key = `${symbol.toLowerCase()}@kline_${interval}`;
    if (!this.listeners.has(key)) {
      this.listeners.set(key, /* @__PURE__ */ new Set());
    }
    this.listeners.get(key).add(listener);
    if (!this.activeStreams.has(key)) {
      this.startBinanceWs(symbol, interval, key);
    }
    return () => {
      const set = this.listeners.get(key);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.listeners.delete(key);
          const ws = this.activeStreams.get(key);
          if (ws) {
            ws.close();
            this.activeStreams.delete(key);
          }
        }
      }
    };
  }
  startBinanceWs(symbol, interval, key) {
    const url = `${WS_BASE_URL}/${key}`;
    try {
      const ws = new WebSocket(url);
      ws.on("open", () => {
      });
      ws.on("message", (data) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.e === "kline") {
            const k = parsed.k;
            const candleUpdate = {
              symbol: parsed.s,
              interval: k.i,
              time: k.t,
              closeTime: k.T,
              open: Number(k.o),
              high: Number(k.h),
              low: Number(k.l),
              close: Number(k.c),
              volume: Number(k.v),
              isClosed: k.x,
              lastUpdated: Date.now()
            };
            const set = this.listeners.get(key);
            if (set) {
              set.forEach((cb) => cb(candleUpdate));
            }
          }
        } catch {
        }
      });
      ws.on("error", () => {
      });
      ws.on("close", () => {
        this.activeStreams.delete(key);
        if (this.listeners.has(key) && this.listeners.get(key).size > 0) {
          setTimeout(() => {
            if (this.listeners.has(key)) {
              this.startBinanceWs(symbol, interval, key);
            }
          }, 3e3);
        }
      });
      this.activeStreams.set(key, ws);
    } catch {
    }
  }
};
var streamManager = new BinanceStreamManager();
function getBinanceStatus() {
  return {
    lastContact: lastSuccessfulBinanceContact,
    lastError: lastBinanceError,
    primaryUrl: PRIMARY_BINANCE_URL,
    fallbackUrl: FALLBACK_BINANCE_URL
  };
}

// src/server/trading.ts
import crypto from "crypto";
var ENV_API_KEY = process.env.BINANCE_API_KEY || "";
var ENV_API_SECRET = process.env.BINANCE_API_SECRET || "";
var ENV_USE_TESTNET = process.env.BINANCE_USE_TESTNET === "true";
var LIVE_API_BASE = "https://api.binance.com";
var TESTNET_API_BASE = "https://testnet.binance.vision";
var PaperTradingEngine = class {
  constructor() {
    this.balances = /* @__PURE__ */ new Map();
    this.orders = [];
    this.reset();
  }
  reset(initialUsdt = 1e4) {
    this.balances.clear();
    this.balances.set("USDT", { free: initialUsdt, locked: 0 });
    this.balances.set("BTC", { free: 0, locked: 0 });
    this.balances.set("ETH", { free: 0, locked: 0 });
    this.balances.set("BNB", { free: 0, locked: 0 });
    this.balances.set("SOL", { free: 0, locked: 0 });
    this.balances.set("XRP", { free: 0, locked: 0 });
    this.balances.set("ADA", { free: 0, locked: 0 });
    this.balances.set("DOGE", { free: 0, locked: 0 });
    this.balances.set("TON", { free: 0, locked: 0 });
    this.orders = [];
  }
  getBalances() {
    const list = [];
    this.balances.forEach((val, asset) => {
      if (val.free > 0 || val.locked > 0 || asset === "USDT") {
        list.push({
          asset,
          free: Number(val.free.toFixed(6)),
          locked: Number(val.locked.toFixed(6))
        });
      }
    });
    return list;
  }
  getOrders() {
    return [...this.orders];
  }
  async placeOrder(req, currentMarketPrice) {
    const baseAsset = req.symbol.replace("USDT", "").toUpperCase();
    const isBuy = req.side === "BUY";
    const executionPrice = req.type === "MARKET" ? currentMarketPrice : req.price || currentMarketPrice;
    const orderCost = req.quantity * executionPrice;
    const usdtBalance = this.balances.get("USDT") || { free: 0, locked: 0 };
    const baseBalance = this.balances.get(baseAsset) || { free: 0, locked: 0 };
    if (isBuy) {
      if (usdtBalance.free < orderCost) {
        throw new Error(
          `\u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0645\u062A\u0627\u062D \u0645\u0646 USDT \u063A\u064A\u0631 \u0643\u0627\u0641\u064D. \u0627\u0644\u0645\u0637\u0644\u0648\u0628: $${orderCost.toFixed(2)} | \u0627\u0644\u0645\u062A\u0627\u062D: $${usdtBalance.free.toFixed(2)}`
        );
      }
    } else {
      if (baseBalance.free < req.quantity) {
        throw new Error(
          `\u0627\u0644\u0631\u0635\u064A\u062F \u0627\u0644\u0645\u062A\u0627\u062D \u0645\u0646 ${baseAsset} \u063A\u064A\u0631 \u0643\u0627\u0641\u064D \u0644\u0644\u0628\u064A\u0639. \u0627\u0644\u0645\u0637\u0644\u0648\u0628: ${req.quantity} | \u0627\u0644\u0645\u062A\u0627\u062D: ${baseBalance.free}`
        );
      }
    }
    const orderId = `paper_${Date.now()}_${Math.floor(Math.random() * 1e3)}`;
    if (req.type === "MARKET") {
      if (isBuy) {
        usdtBalance.free -= orderCost;
        baseBalance.free += req.quantity;
      } else {
        baseBalance.free -= req.quantity;
        usdtBalance.free += orderCost;
      }
      this.balances.set("USDT", usdtBalance);
      this.balances.set(baseAsset, baseBalance);
      const order = {
        orderId,
        symbol: req.symbol,
        side: req.side,
        type: "MARKET",
        price: executionPrice,
        quantity: req.quantity,
        executedQty: req.quantity,
        cummulativeQuoteQty: orderCost,
        status: "FILLED",
        time: Date.now(),
        mode: "paper"
      };
      this.orders.unshift(order);
      return order;
    } else {
      const isFilledImmediately = isBuy && executionPrice >= currentMarketPrice || !isBuy && executionPrice <= currentMarketPrice;
      if (isFilledImmediately) {
        if (isBuy) {
          usdtBalance.free -= orderCost;
          baseBalance.free += req.quantity;
        } else {
          baseBalance.free -= req.quantity;
          usdtBalance.free += orderCost;
        }
        this.balances.set("USDT", usdtBalance);
        this.balances.set(baseAsset, baseBalance);
        const order = {
          orderId,
          symbol: req.symbol,
          side: req.side,
          type: "LIMIT",
          price: executionPrice,
          quantity: req.quantity,
          executedQty: req.quantity,
          cummulativeQuoteQty: orderCost,
          status: "FILLED",
          time: Date.now(),
          mode: "paper"
        };
        this.orders.unshift(order);
        return order;
      } else {
        if (isBuy) {
          usdtBalance.free -= orderCost;
          usdtBalance.locked += orderCost;
        } else {
          baseBalance.free -= req.quantity;
          baseBalance.locked += req.quantity;
        }
        this.balances.set("USDT", usdtBalance);
        this.balances.set(baseAsset, baseBalance);
        const order = {
          orderId,
          symbol: req.symbol,
          side: req.side,
          type: "LIMIT",
          price: executionPrice,
          quantity: req.quantity,
          executedQty: 0,
          cummulativeQuoteQty: 0,
          status: "NEW",
          time: Date.now(),
          mode: "paper"
        };
        this.orders.unshift(order);
        return order;
      }
    }
  }
  cancelOrder(orderId) {
    const order = this.orders.find((o) => o.orderId === orderId);
    if (!order) {
      throw new Error("\u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0623\u0645\u0631 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u0625\u0644\u063A\u0627\u0624\u0647");
    }
    if (order.status !== "NEW" && order.status !== "PARTIALLY_FILLED") {
      throw new Error("\u0644\u0627 \u064A\u0645\u0643\u0646 \u0625\u0644\u063A\u0627\u0621 \u0623\u0645\u0631 \u062A\u0645 \u062A\u0646\u0641\u064A\u0630\u0647 \u0628\u0627\u0644\u0641\u0639\u0644 \u0623\u0648 \u0645\u0644\u063A\u064A");
    }
    const baseAsset = order.symbol.replace("USDT", "");
    const isBuy = order.side === "BUY";
    const orderCost = order.quantity * order.price;
    const usdtBalance = this.balances.get("USDT") || { free: 0, locked: 0 };
    const baseBalance = this.balances.get(baseAsset) || { free: 0, locked: 0 };
    if (isBuy) {
      usdtBalance.locked = Math.max(0, usdtBalance.locked - orderCost);
      usdtBalance.free += orderCost;
    } else {
      baseBalance.locked = Math.max(0, baseBalance.locked - order.quantity);
      baseBalance.free += order.quantity;
    }
    this.balances.set("USDT", usdtBalance);
    this.balances.set(baseAsset, baseBalance);
    order.status = "CANCELED";
    return order;
  }
};
var paperTrading = new PaperTradingEngine();
function signBinanceRequest(params, secretKey) {
  const timestamp = Date.now();
  const queryParts = Object.entries({ ...params, timestamp }).map(
    ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
  );
  const queryString = queryParts.join("&");
  const signature = crypto.createHmac("sha256", secretKey).update(queryString).digest("hex");
  return `${queryString}&signature=${signature}`;
}
async function callBinancePrivateApi(method, path2, params, apiKey, secretKey, useTestnet = false) {
  const baseUrl = useTestnet ? TESTNET_API_BASE : LIVE_API_BASE;
  const signedQuery = signBinanceRequest(params, secretKey);
  let url = `${baseUrl}${path2}`;
  let body;
  const headers = {
    "X-MBX-APIKEY": apiKey,
    Accept: "application/json"
  };
  if (method === "GET" || method === "DELETE") {
    url += `?${signedQuery}`;
  } else {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = signedQuery;
  }
  const res = await fetch(url, {
    method,
    headers,
    body
  });
  const json = await res.json();
  if (!res.ok) {
    const errorMsg = json.msg || `\u062E\u0637\u0623 \u0645\u0646 \u0628\u064A\u0646\u0627\u0646\u0633 (${json.code || res.status})`;
    throw new Error(`\u062E\u0637\u0623 \u0641\u064A \u062A\u0646\u0641\u064A\u0630 \u0627\u0644\u0623\u0645\u0631 \u0639\u0644\u0649 \u0628\u064A\u0646\u0627\u0646\u0633: ${errorMsg}`);
  }
  return json;
}
async function getAccountState(mode = "paper", customKey, customSecret) {
  const apiKey = customKey || ENV_API_KEY;
  const apiSecret = customSecret || ENV_API_SECRET;
  const isConfigured = Boolean(apiKey && apiSecret);
  if (mode === "live" || mode === "testnet") {
    if (!isConfigured) {
      const paperBalances = paperTrading.getBalances();
      const usdt = paperBalances.find((b) => b.asset === "USDT")?.free || 0;
      return {
        mode: "paper",
        isConfigured: false,
        canTrade: true,
        testnet: mode === "testnet",
        totalEquityUsdt: usdt,
        freeUsdt: usdt,
        balances: paperBalances,
        openOrders: paperTrading.getOrders().filter((o) => o.status === "NEW"),
        recentTrades: paperTrading.getOrders()
      };
    }
    try {
      const useTestnet = mode === "testnet" || ENV_USE_TESTNET;
      const accountData = await callBinancePrivateApi(
        "GET",
        "/api/v3/account",
        {},
        apiKey,
        apiSecret,
        useTestnet
      );
      const balances2 = (accountData.balances || []).map((b) => ({
        asset: b.asset,
        free: Number(b.free),
        locked: Number(b.locked)
      })).filter((b) => b.free > 0 || b.locked > 0 || b.asset === "USDT");
      const openOrdersRaw = await callBinancePrivateApi(
        "GET",
        "/api/v3/openOrders",
        {},
        apiKey,
        apiSecret,
        useTestnet
      ).catch(() => []);
      const openOrders2 = (openOrdersRaw || []).map((o) => ({
        orderId: String(o.orderId),
        symbol: o.symbol,
        side: o.side,
        type: o.type,
        price: Number(o.price),
        quantity: Number(o.origQty),
        executedQty: Number(o.executedQty),
        cummulativeQuoteQty: Number(o.cummulativeQuoteQty),
        status: o.status,
        time: o.time,
        mode
      }));
      const freeUsdt2 = balances2.find((b) => b.asset === "USDT")?.free || 0;
      return {
        mode,
        isConfigured: true,
        canTrade: accountData.canTrade !== false,
        testnet: useTestnet,
        totalEquityUsdt: freeUsdt2,
        // Base USDT
        freeUsdt: freeUsdt2,
        balances: balances2,
        openOrders: openOrders2,
        recentTrades: []
      };
    } catch (err) {
      throw new Error(`\u062A\u0639\u0630\u0631 \u062C\u0644\u0628 \u062A\u0641\u0627\u0635\u064A\u0644 \u062D\u0633\u0627\u0628 \u0628\u064A\u0646\u0627\u0646\u0633: ${err.message}`);
    }
  }
  const balances = paperTrading.getBalances();
  const freeUsdt = balances.find((b) => b.asset === "USDT")?.free || 0;
  const allOrders = paperTrading.getOrders();
  const openOrders = allOrders.filter((o) => o.status === "NEW");
  return {
    mode: "paper",
    isConfigured: true,
    canTrade: true,
    testnet: false,
    totalEquityUsdt: freeUsdt,
    freeUsdt,
    balances,
    openOrders,
    recentTrades: allOrders.slice(0, 50)
  };
}
async function executeOrder(req, customKey, customSecret) {
  const mode = req.mode || "paper";
  const apiKey = customKey || ENV_API_KEY;
  const apiSecret = customSecret || ENV_API_SECRET;
  const ticker = await getSingleTicker(req.symbol);
  const currentPrice = ticker.price;
  if (mode === "paper" || !apiKey && mode !== "live") {
    return await paperTrading.placeOrder(req, currentPrice);
  }
  const useTestnet = mode === "testnet" || ENV_USE_TESTNET;
  const params = {
    symbol: req.symbol.toUpperCase(),
    side: req.side,
    type: req.type,
    quantity: req.quantity
  };
  if (req.type === "LIMIT") {
    if (!req.price) throw new Error("\u064A\u062C\u0628 \u062A\u062D\u062F\u064A\u062F \u0627\u0644\u0633\u0639\u0631 \u0644\u0623\u0645\u0631 Limit");
    params.price = req.price;
    params.timeInForce = "GTC";
  }
  const raw = await callBinancePrivateApi(
    "POST",
    "/api/v3/order",
    params,
    apiKey,
    apiSecret,
    useTestnet
  );
  return {
    orderId: String(raw.orderId),
    symbol: raw.symbol,
    side: raw.side,
    type: raw.type,
    price: Number(raw.price || currentPrice),
    quantity: Number(raw.origQty),
    executedQty: Number(raw.executedQty),
    cummulativeQuoteQty: Number(raw.cummulativeQuoteQty),
    status: raw.status,
    time: raw.transactTime || Date.now(),
    mode
  };
}
async function cancelOrder(orderId, symbol, mode = "paper", customKey, customSecret) {
  if (mode === "paper") {
    return paperTrading.cancelOrder(orderId);
  }
  const apiKey = customKey || ENV_API_KEY;
  const apiSecret = customSecret || ENV_API_SECRET;
  const useTestnet = mode === "testnet" || ENV_USE_TESTNET;
  const raw = await callBinancePrivateApi(
    "DELETE",
    "/api/v3/order",
    {
      symbol: symbol.toUpperCase(),
      orderId
    },
    apiKey,
    apiSecret,
    useTestnet
  );
  return {
    orderId: String(raw.orderId),
    symbol: raw.symbol,
    side: raw.side,
    type: raw.type,
    price: Number(raw.price),
    quantity: Number(raw.origQty),
    executedQty: Number(raw.executedQty),
    cummulativeQuoteQty: Number(raw.cummulativeQuoteQty),
    status: raw.status,
    time: Date.now(),
    mode
  };
}

// src/server/bot.ts
var TradingBotEngine = class {
  constructor() {
    this.scanTimer = null;
    this.isScanning = false;
    this.state = {
      isRunning: false,
      startedAt: null,
      lastScanAt: null,
      totalScans: 0,
      totalTradesExecuted: 0,
      activePositions: [],
      settings: {
        selectedSymbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "BNBUSDT"],
        interval: "1h",
        tradeMode: "paper",
        targetExchange: "binance",
        strategy: "consensus_strong",
        riskPerTrade: 5,
        // 5% of cash
        takeProfitRatio: 2,
        stopLossAtrMult: 1.5,
        autoSellOnReversal: true,
        scanIntervalSec: 20,
        webhookSecret: "ais-trader-bot-secret"
      },
      connectedExchanges: [
        {
          id: "binance",
          name: "Binance",
          arabicName: "\u0628\u064A\u0646\u0627\u0646\u0633",
          color: "#f59e0b",
          badge: "\u0627\u0644\u0623\u0633\u0627\u0633\u064A\u0629",
          status: "connected",
          supportedModes: ["paper", "testnet", "live"],
          description: "\u0627\u0644\u0631\u0628\u0637 \u0627\u0644\u0645\u0628\u0627\u0634\u0631 \u0645\u0639 \u0623\u0643\u0628\u0631 \u0645\u0646\u0635\u0629 \u062A\u062F\u0627\u0648\u0644 \u0641\u064A \u0627\u0644\u0639\u0627\u0644\u0645 \u0639\u0628\u0631 Public API \u0648 HMAC-SHA256."
        },
        {
          id: "bybit",
          name: "Bybit",
          arabicName: "\u0628\u0627\u064A \u0628\u064A\u062A",
          color: "#f97316",
          badge: "V5 API",
          status: "paper",
          supportedModes: ["paper", "live"],
          description: "\u062A\u0646\u0641\u064A\u0630 \u0627\u0644\u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u0641\u0648\u0631\u064A\u0629 \u0648\u0627\u0644\u0645\u0633\u062A\u0642\u0628\u0644\u064A\u0629 \u0639\u0644\u0649 Bybit \u0645\u0639 \u062F\u0639\u0645 \u0627\u0644\u062A\u062F\u0627\u0648\u0644 \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A \u0648\u0627\u0644\u062D\u064A."
        },
        {
          id: "okx",
          name: "OKX",
          arabicName: "\u0623\u0648\u0643\u064A \u0625\u0643\u0633",
          color: "#3b82f6",
          badge: "REST v5",
          status: "paper",
          supportedModes: ["paper", "live"],
          description: "\u0645\u0646\u0635\u0629 OKX \u0645\u0639 \u062F\u0639\u0645 \u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u0633\u0648\u0642 \u0648\u0627\u0644\u062D\u062F\u0648\u062F \u0648\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0633\u064A\u0648\u0644\u0629."
        },
        {
          id: "kucoin",
          name: "KuCoin",
          arabicName: "\u0643\u0648\u0643\u0648\u064A\u0646",
          color: "#10b981",
          badge: "Spot v1",
          status: "paper",
          supportedModes: ["paper", "live"],
          description: "\u0627\u0644\u062A\u062F\u0627\u0648\u0644 \u0627\u0644\u0622\u0644\u064A \u0648\u062A\u062A\u0628\u0639 \u0623\u0632\u0648\u0627\u062C \u0627\u0644\u0639\u0645\u0644\u0627\u062A \u0627\u0644\u0645\u062A\u0639\u062F\u062F\u0629 \u0639\u0644\u0649 \u0643\u0648\u0643\u0648\u064A\u0646."
        },
        {
          id: "gateio",
          name: "Gate.io",
          arabicName: "\u062C\u064A\u062A \u0622\u064A\u0648",
          color: "#ef4444",
          badge: "v4 API",
          status: "paper",
          supportedModes: ["paper", "live"],
          description: "\u062A\u0646\u0641\u064A\u0630 \u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A\u0627\u062A \u0627\u0644\u0628\u0648\u062A \u0627\u0644\u0644\u062D\u0638\u064A\u0629 \u0639\u0644\u0649 Gate.io."
        },
        {
          id: "tradingview",
          name: "TradingView Webhooks",
          arabicName: "\u062A\u0631\u064A\u062F\u0646\u062C \u0641\u064A\u0648 (Webhook)",
          color: "#22c55e",
          badge: "Webhook \u0645\u0628\u0627\u0634\u0631",
          status: "connected",
          supportedModes: ["paper", "live"],
          description: "\u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0627\u0644\u0625\u0634\u0627\u0631\u0627\u062A \u0627\u0644\u0641\u0648\u0631\u064A\u0629 \u0645\u0646 \u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A\u0627\u062A TradingView \u0623\u0648 Python \u0648\u062A\u0646\u0641\u064A\u0630\u0647\u0627 \u0622\u0644\u064A\u0627\u064B.",
          webhookUrl: "/api/webhook/tradingview"
        }
      ],
      logs: [
        {
          id: `log_init_${Date.now()}`,
          time: Date.now(),
          type: "info",
          message: '\u062A\u0645\u062A \u062A\u0647\u064A\u0626\u0629 \u0645\u062D\u0631\u0643 \u0627\u0644\u0628\u0648\u062A \u0627\u0644\u0622\u0644\u064A \u0645\u062A\u0639\u062F\u062F \u0627\u0644\u0645\u0646\u0635\u0627\u062A (Binance, Bybit, OKX, KuCoin, Gate.io, TradingView). \u0627\u0636\u063A\u0637 \u0639\u0644\u0649 "\u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u0628\u0648\u062A" \u0644\u0628\u062F\u0621 \u0627\u0644\u0645\u0633\u062D.'
        }
      ]
    };
  }
  getState() {
    return {
      ...this.state,
      activePositions: [...this.state.activePositions],
      settings: { ...this.state.settings },
      logs: [...this.state.logs],
      connectedExchanges: [...this.state.connectedExchanges]
    };
  }
  updateExchangeStatus(id, status, apiKeyMasked) {
    const ex = this.state.connectedExchanges.find((e) => e.id === id);
    if (ex) {
      ex.status = status;
      if (apiKeyMasked) ex.apiKeyMasked = apiKeyMasked;
      this.addLog("info", void 0, `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0631\u0628\u0637 \u0645\u0646\u0635\u0629 ${ex.name} (${ex.arabicName}) \u0625\u0644\u0649 \u0648\u0636\u0639 ${status}.`);
    }
  }
  // Handle incoming TradingView or external Webhook signal
  async handleWebhookSignal(data) {
    const symbol = (data.symbol || "BTCUSDT").toUpperCase();
    const action = data.action === "SELL" ? "SELL" : "BUY";
    const exchange = data.exchange || this.state.settings.targetExchange || "binance";
    try {
      const account = await getAccountState(this.state.settings.tradeMode);
      const curPrice = data.price || 76e3;
      const qty = data.quantity || Number((100 / curPrice).toFixed(4));
      const orderReq = {
        symbol,
        side: action,
        type: "MARKET",
        quantity: qty,
        mode: this.state.settings.tradeMode,
        exchange
      };
      const order = await executeOrder(orderReq);
      this.state.totalTradesExecuted += 1;
      this.addLog(
        action === "BUY" ? "buy" : "sell",
        symbol,
        `\u{1F4E1} [Webhook Signal] \u062A\u0646\u0641\u064A\u0630 \u0623\u0645\u0631 ${action === "BUY" ? "\u0634\u0631\u0627\u0621" : "\u0628\u064A\u0639"} \u0644\u0640 ${symbol} \u0639\u0644\u0649 \u0645\u0646\u0635\u0629 ${exchange.toUpperCase()}`,
        `\u0627\u0644\u0645\u0635\u062F\u0631: ${data.strategy || "TradingView Webhook"} | \u0627\u0644\u0643\u0645\u064A\u0629: ${qty} | \u0627\u0644\u0633\u0639\u0631: $${curPrice}`
      );
      if (action === "BUY") {
        this.state.activePositions.push({
          symbol,
          exchange,
          entryPrice: curPrice,
          quantity: qty,
          stopLoss: Number((curPrice * 0.98).toFixed(2)),
          takeProfit: Number((curPrice * 1.04).toFixed(2)),
          time: Date.now(),
          orderId: order.orderId
        });
      }
      return { success: true, message: `\u062A\u0645 \u062A\u0646\u0641\u064A\u0630 \u0625\u0634\u0627\u0631\u0629 Webhook \u0628\u0646\u062C\u0627\u062D \u0644\u0640 ${symbol}`, order };
    } catch (err) {
      this.addLog("warning", symbol, `\u0641\u0634\u0644 \u062A\u0646\u0641\u064A\u0630 \u0625\u0634\u0627\u0631\u0629 Webhook: ${err.message}`);
      return { success: false, message: err.message };
    }
  }
  updateSettings(newSettings) {
    this.state.settings = {
      ...this.state.settings,
      ...newSettings
    };
    this.addLog("info", void 0, "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0628\u0648\u062A \u0648\u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A\u0629 \u0627\u0644\u062A\u062F\u0627\u0648\u0644.");
    return this.state.settings;
  }
  start() {
    if (this.state.isRunning) return this.getState();
    this.state.isRunning = true;
    this.state.startedAt = Date.now();
    this.addLog(
      "info",
      void 0,
      `\u{1F7E2} \u062A\u0645 \u062A\u0634\u063A\u064A\u0644 \u0628\u0648\u062A \u0627\u0644\u062A\u062F\u0627\u0648\u0644 \u0627\u0644\u0622\u0644\u064A \u0628\u0646\u062C\u0627\u062D! \u064A\u062A\u0645 \u0641\u062D\u0635 ${this.state.settings.selectedSymbols.length} \u0623\u0632\u0648\u0627\u062C \u0643\u0644 ${this.state.settings.scanIntervalSec} \u062B\u0627\u0646\u064A\u0629.`
    );
    this.scanCycle().catch(() => {
    });
    const intervalMs = Math.max(10, this.state.settings.scanIntervalSec) * 1e3;
    this.scanTimer = setInterval(() => {
      this.scanCycle().catch(() => {
      });
    }, intervalMs);
    return this.getState();
  }
  stop() {
    if (!this.state.isRunning) return this.getState();
    this.state.isRunning = false;
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    this.addLog("warning", void 0, "\u{1F534} \u062A\u0645 \u0625\u064A\u0642\u0627\u0641 \u0628\u0648\u062A \u0627\u0644\u062A\u062F\u0627\u0648\u0644 \u0627\u0644\u0622\u0644\u064A \u0648\u062A\u062C\u0645\u064A\u062F \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0623\u0648\u0627\u0645\u0631 \u0627\u0644\u062C\u062F\u064A\u062F\u0629.");
    return this.getState();
  }
  clearLogs() {
    this.state.logs = [
      {
        id: `log_${Date.now()}`,
        time: Date.now(),
        type: "info",
        message: "\u062A\u0645 \u0645\u0633\u062D \u0627\u0644\u0633\u062C\u0644\u0627\u062A."
      }
    ];
  }
  addLog(type, symbol, message, details) {
    const entry = {
      id: `log_${Date.now()}_${Math.floor(Math.random() * 1e3)}`,
      time: Date.now(),
      type,
      symbol,
      message,
      details
    };
    this.state.logs.unshift(entry);
    if (this.state.logs.length > 150) {
      this.state.logs.pop();
    }
  }
  async scanCycle() {
    if (!this.state.isRunning || this.isScanning) return;
    this.isScanning = true;
    this.state.lastScanAt = Date.now();
    this.state.totalScans += 1;
    try {
      const { selectedSymbols, interval, tradeMode, riskPerTrade, strategy } = this.state.settings;
      const account = await getAccountState(tradeMode);
      const freeUsdt = account.freeUsdt;
      await this.manageActivePositions(tradeMode);
      let signalsFoundCount = 0;
      for (const symbol of selectedSymbols) {
        if (!this.state.isRunning) break;
        const alreadyHolding = this.state.activePositions.some((p) => p.symbol === symbol);
        if (alreadyHolding) continue;
        try {
          const analysis = await getFullAnalysis(symbol, interval);
          const currentPrice = analysis.currentPrice;
          const signal = analysis.summary.overallSignal;
          const rsi = analysis.indicators.rsi.value;
          let shouldBuy = false;
          let entryReason = "";
          if (strategy === "consensus_strong") {
            if (signal === "\u0634\u0631\u0627\u0621 \u0642\u0648\u064A" || signal === "\u0634\u0631\u0627\u0621" && analysis.summary.buyCount >= 3) {
              shouldBuy = true;
              entryReason = `\u062A\u0648\u0627\u0641\u0642 \u0625\u064A\u062C\u0627\u0628\u064A \u0642\u0648\u064A (${analysis.summary.consensusRatio}) \u0645\u0639 \u0627\u062A\u062C\u0627\u0647 ${analysis.trade.trend}`;
            }
          } else if (strategy === "rsi_extreme") {
            if (rsi <= 32) {
              shouldBuy = true;
              entryReason = `\u062A\u0634\u0628\u0639 \u0628\u064A\u0639\u064A \u062D\u0627\u062F \u0644\u0645\u0624\u0634\u0631 RSI (${rsi.toFixed(1)} < 32)`;
            }
          } else if (strategy === "trend_pullback") {
            if (analysis.trade.trend === "\u0635\u0627\u0639\u062F" && (signal === "\u0634\u0631\u0627\u0621" || signal === "\u0634\u0631\u0627\u0621 \u0642\u0648\u064A")) {
              shouldBuy = true;
              entryReason = `\u062A\u0623\u0643\u064A\u062F \u0627\u062A\u062C\u0627\u0647 \u0635\u0627\u0639\u062F \u0645\u0639 \u0625\u0634\u0627\u0631\u0629 \u0634\u0631\u0627\u0621 \u0625\u064A\u062C\u0627\u0628\u064A\u0629`;
            }
          }
          if (shouldBuy) {
            signalsFoundCount++;
            const budget = Math.max(15, freeUsdt * riskPerTrade / 100);
            if (freeUsdt < budget || budget < 10) {
              this.addLog(
                "warning",
                symbol,
                `\u062A\u0645 \u0631\u0635\u062F \u0625\u0634\u0627\u0631\u0629 \u0634\u0631\u0627\u0621 \u0644\u0640 ${symbol} \u0648\u0644\u0643\u0646 \u0627\u0644\u0633\u064A\u0648\u0644\u0629 \u0627\u0644\u0645\u062A\u0627\u062D\u0629 ($${freeUsdt.toFixed(2)}) \u063A\u064A\u0631 \u0643\u0627\u0641\u064A\u0629.`
              );
              continue;
            }
            const rawQty = budget / currentPrice;
            const quantity = rawQty >= 1 ? Number(rawQty.toFixed(4)) : Number(rawQty.toFixed(6));
            if (quantity <= 0) continue;
            const orderReq = {
              symbol,
              side: "BUY",
              type: "MARKET",
              quantity,
              mode: tradeMode,
              exchange: this.state.settings.targetExchange
            };
            const executedOrder = await executeOrder(orderReq);
            this.state.totalTradesExecuted += 1;
            const atr = analysis.trade.atr14 || currentPrice * 0.02;
            const stopLoss = Number((currentPrice - 1.5 * atr).toFixed(4));
            const takeProfit = Number((currentPrice + 2 * 1.5 * atr).toFixed(4));
            const position = {
              symbol,
              exchange: this.state.settings.targetExchange,
              entryPrice: currentPrice,
              quantity,
              stopLoss,
              takeProfit,
              time: Date.now(),
              orderId: executedOrder.orderId
            };
            this.state.activePositions.push(position);
            this.addLog(
              "buy",
              symbol,
              `\u26A1 [\u0634\u0631\u0627\u0621 \u0622\u0644\u064A - ${this.state.settings.targetExchange.toUpperCase()}] \u062A\u0645 \u0634\u0631\u0627\u0621 ${quantity} \u0645\u0646 ${symbol} \u0628\u0633\u0639\u0631 $${currentPrice.toLocaleString("en-US")}`,
              `\u0627\u0644\u0633\u0628\u0628: ${entryReason} | \u0648\u0642\u0641 \u0627\u0644\u062E\u0633\u0627\u0631\u0629: $${stopLoss} | \u0627\u0644\u0647\u062F\u0641: $${takeProfit}`
            );
          }
        } catch (symErr) {
        }
      }
      if (signalsFoundCount === 0 && this.state.totalScans % 3 === 0) {
        this.addLog(
          "scan",
          void 0,
          `\u{1F50D} [\u0641\u062D\u0635 \u062F\u0648\u0631\u064A] \u062A\u0645 \u0641\u062D\u0635 ${selectedSymbols.length} \u0623\u0632\u0648\u0627\u062C: \u0644\u0627 \u062A\u0648\u062C\u062F \u0625\u0634\u0627\u0631\u0627\u062A \u0634\u0631\u0627\u0621 \u062A\u0633\u062A\u0648\u0641\u064A \u0634\u0631\u0648\u0637 \u0627\u0644\u0627\u0633\u062A\u0631\u0627\u062A\u064A\u062C\u064A\u0629 \u062D\u0627\u0644\u064A\u0627\u064B.`
        );
      }
    } catch (err) {
      this.addLog("warning", void 0, `\u062A\u0646\u0628\u064A\u0647 \u0623\u062B\u0646\u0627\u0621 \u0627\u0644\u0645\u0633\u062D \u0627\u0644\u0622\u0644\u064A: ${err.message || err}`);
    } finally {
      this.isScanning = false;
    }
  }
  async manageActivePositions(mode) {
    const remainingPositions = [];
    for (const pos of this.state.activePositions) {
      try {
        const analysis = await getFullAnalysis(pos.symbol, "15m");
        const curPrice = analysis.currentPrice;
        let shouldExit = false;
        let exitReason = "";
        if (curPrice >= pos.takeProfit) {
          shouldExit = true;
          exitReason = `\u{1F3AF} [\u062C\u0646\u064A \u0623\u0631\u0628\u0627\u062D \u0622\u0644\u064A] \u0627\u0644\u0633\u0639\u0631 ($${curPrice}) \u0648\u0635\u0644 \u0644\u0644\u0647\u062F\u0641 \u0627\u0644\u0645\u062D\u062F\u062F ($${pos.takeProfit})`;
        } else if (curPrice <= pos.stopLoss) {
          shouldExit = true;
          exitReason = `\u{1F6D1} [\u0648\u0642\u0641 \u062E\u0633\u0627\u0631\u0629 \u0622\u0644\u064A] \u0627\u0644\u0633\u0639\u0631 ($${curPrice}) \u0648\u0635\u0644 \u0644\u0648\u0642\u0641 \u0627\u0644\u062E\u0633\u0627\u0631\u0629 ($${pos.stopLoss})`;
        } else if (this.state.settings.autoSellOnReversal && analysis.summary.overallSignal === "\u0628\u064A\u0639 \u0642\u0648\u064A") {
          shouldExit = true;
          exitReason = `\u{1F504} [\u062E\u0631\u0648\u062C \u0644\u0627\u0646\u0639\u0643\u0627\u0633 \u0627\u0644\u0625\u0634\u0627\u0631\u0629] \u062A\u062D\u0648\u0644\u062A \u0627\u0644\u0645\u0624\u0634\u0631\u0627\u062A \u0625\u0644\u0649 \u0628\u064A\u0639 \u0642\u0648\u064A`;
        }
        if (shouldExit) {
          const sellReq = {
            symbol: pos.symbol,
            side: "SELL",
            type: "MARKET",
            quantity: pos.quantity,
            mode
          };
          await executeOrder(sellReq);
          const profitUsdt = (curPrice - pos.entryPrice) * pos.quantity;
          const profitPct = (curPrice - pos.entryPrice) / pos.entryPrice * 100;
          this.addLog(
            "sell",
            pos.symbol,
            `${exitReason} - \u062A\u0645 \u0628\u064A\u0639 ${pos.quantity} ${pos.symbol}`,
            `\u0633\u0639\u0631 \u0627\u0644\u062F\u062E\u0648\u0644: $${pos.entryPrice} | \u0633\u0639\u0631 \u0627\u0644\u062E\u0631\u0648\u062C: $${curPrice} | \u0627\u0644\u0646\u062A\u064A\u062C\u0629: ${profitUsdt >= 0 ? "+" : ""}$${profitUsdt.toFixed(2)} (${profitPct.toFixed(2)}%)`
          );
        } else {
          remainingPositions.push(pos);
        }
      } catch {
        remainingPositions.push(pos);
      }
    }
    this.state.activePositions = remainingPositions;
  }
};
var tradingBot = new TradingBotEngine();

// src/server/journalAndAlerts.ts
var JournalAndAlertsEngine = class {
  constructor() {
    this.alerts = [];
    this.trades = [];
    this.checkInterval = null;
    this.initLiveDefaults();
    this.startChecker();
  }
  // Initialize defaults using REAL live prices from Binance public API
  async initLiveDefaults() {
    try {
      const btcTicker = await getSingleTicker("BTCUSDT");
      const btcPrice = btcTicker.price;
      const btcTarget = Math.round(btcPrice * 1.025);
      const btcSupport = Math.round(btcPrice * 0.985);
      const btcStop = Math.round(btcPrice * 0.965);
      const btcTp = Math.round(btcPrice * 1.035);
      this.alerts = [
        {
          id: "alert_btc_live",
          symbol: "BTCUSDT",
          type: "PRICE_ABOVE",
          targetPrice: btcTarget,
          conditionDescription: `\u0639\u0646\u062F \u062A\u062C\u0627\u0648\u0632 \u0633\u0639\u0631 \u0628\u064A\u062A\u0643\u0648\u064A\u0646 $${btcTarget.toLocaleString("en-US")} USDT (\u0628\u0646\u0627\u0621\u064B \u0639\u0644\u0649 \u0627\u0644\u0633\u0639\u0631 \u0627\u0644\u0644\u062D\u0638\u064A)`,
          isActive: true,
          isTriggered: false,
          createdAt: Date.now() - 36e5,
          note: "\u062A\u0646\u0628\u064A\u0647 \u0627\u062E\u062A\u0631\u0627\u0642 \u0641\u0646\u064A \u0645\u062A\u0635\u0644 \u0628\u0623\u0633\u0639\u0627\u0631 Binance \u0627\u0644\u062D\u064A\u0629"
        },
        {
          id: "alert_eth_live",
          symbol: "ETHUSDT",
          type: "STRONG_BUY_SIGNAL",
          conditionDescription: "\u0639\u0646\u062F \u0638\u0647\u0648\u0631 \u0625\u0634\u0627\u0631\u0629 \u0634\u0631\u0627\u0621 \u0642\u0648\u064A \u0639\u0644\u0649 \u0625\u0637\u0627\u0631 1h",
          isActive: true,
          isTriggered: false,
          createdAt: Date.now() - 36e5,
          note: "\u0645\u0631\u0627\u0642\u0628\u0629 \u0625\u0634\u0627\u0631\u0629 \u0627\u0644\u0632\u062E\u0645 \u0627\u0644\u0641\u0646\u064A\u0629 \u0644\u0625\u064A\u062B\u064A\u0631\u064A\u0648\u0645"
        }
      ];
      const diff = btcPrice - btcSupport;
      const qty = 0.05;
      this.trades = [
        {
          id: "trade_live_btc",
          symbol: "BTCUSDT",
          direction: "\u0634\u0631\u0627\u0621",
          entryPrice: btcSupport,
          currentPrice: btcPrice,
          stopLoss: btcStop,
          takeProfit: btcTp,
          quantity: qty,
          riskRewardRatio: Number(((btcTp - btcSupport) / (btcSupport - btcStop)).toFixed(2)),
          status: "OPEN",
          pnlUsdt: Number((diff * qty).toFixed(2)),
          pnlPercent: Number((diff / btcSupport * 100).toFixed(2)),
          entryTime: Date.now() - 36e5 * 4,
          notes: "\u0635\u0641\u0642\u0629 \u062A\u062C\u0631\u064A\u0628\u064A\u0629 \u0645\u0628\u0646\u064A\u0629 \u0639\u0644\u0649 \u0627\u0644\u0633\u0639\u0631 \u0627\u0644\u062D\u0642\u064A\u0642\u064A \u0644\u0628\u064A\u062A\u0643\u0648\u064A\u0646 \u0645\u0646 \u0645\u0646\u0635\u0629 Binance",
          strategyUsed: "\u0645\u0624\u0634\u0631\u0627\u062A \u0627\u0644\u062F\u0639\u0645 \u0648\u0627\u0644\u062A\u0648\u0627\u0641\u0642 \u0627\u0644\u0641\u0646\u064A \u0627\u0644\u062D\u0642\u064A\u0642\u064A"
        }
      ];
    } catch {
      this.alerts = [];
      this.trades = [];
    }
  }
  // --- Alerts API ---
  getAlerts() {
    return [...this.alerts];
  }
  addAlert(symbol, type, targetPrice, targetSignal, note) {
    const normSymbol = symbol.toUpperCase();
    let conditionDescription = "";
    if (type === "PRICE_ABOVE") {
      conditionDescription = `\u0639\u0646\u062F \u0627\u0631\u062A\u0641\u0627\u0639 \u0627\u0644\u0633\u0639\u0631 \u0641\u0648\u0642 $${targetPrice?.toLocaleString("en-US")}`;
    } else if (type === "PRICE_BELOW") {
      conditionDescription = `\u0639\u0646\u062F \u0647\u0628\u0648\u0637 \u0627\u0644\u0633\u0639\u0631 \u062A\u062D\u062A $${targetPrice?.toLocaleString("en-US")}`;
    } else if (type === "STRONG_BUY_SIGNAL") {
      conditionDescription = `\u0639\u0646\u062F \u0638\u0647\u0648\u0631 \u0625\u0634\u0627\u0631\u0629 \u0634\u0631\u0627\u0621 \u0642\u0648\u064A (\u062A\u0648\u0627\u0641\u0642 4-5 \u0645\u0624\u0634\u0631\u0627\u062A)`;
    } else {
      conditionDescription = `\u0639\u0646\u062F \u062A\u063A\u064A\u0631 \u0625\u0634\u0627\u0631\u0629 \u0627\u0644\u0623\u0635\u0644 \u0625\u0644\u0649 ${targetSignal || "\u0625\u0634\u0627\u0631\u0629 \u062C\u062F\u064A\u062F\u0629"}`;
    }
    const alert = {
      id: `alert_${Date.now()}_${Math.floor(Math.random() * 1e3)}`,
      symbol: normSymbol,
      type,
      targetPrice,
      targetSignal,
      conditionDescription,
      isActive: true,
      isTriggered: false,
      createdAt: Date.now(),
      note
    };
    this.alerts.unshift(alert);
    return alert;
  }
  toggleAlert(id) {
    const alert = this.alerts.find((a) => a.id === id);
    if (!alert) return null;
    alert.isActive = !alert.isActive;
    return alert;
  }
  deleteAlert(id) {
    const initLen = this.alerts.length;
    this.alerts = this.alerts.filter((a) => a.id !== id);
    return this.alerts.length < initLen;
  }
  // --- Journal API ---
  async getTrades() {
    await this.syncTradesWithMarket();
    const totalTrades = this.trades.length;
    const wonTrades = this.trades.filter((t) => t.status === "WON").length;
    const lostTrades = this.trades.filter((t) => t.status === "LOST").length;
    const openTrades = this.trades.filter((t) => t.status === "OPEN").length;
    const completed = wonTrades + lostTrades;
    const winRatePercent = completed > 0 ? Number((wonTrades / completed * 100).toFixed(1)) : 0;
    const totalProfitUsdt = Number(
      this.trades.reduce((sum, t) => sum + (t.pnlUsdt || 0), 0).toFixed(2)
    );
    const stats = {
      totalTrades,
      wonTrades,
      lostTrades,
      openTrades,
      winRatePercent,
      totalProfitUsdt
    };
    return { trades: [...this.trades], stats };
  }
  addTrade(symbol, direction, entryPrice, stopLoss, takeProfit, quantity, notes, strategyUsed) {
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(takeProfit - entryPrice);
    const riskRewardRatio = risk > 0 ? Number((reward / risk).toFixed(2)) : 1.5;
    const trade = {
      id: `trade_${Date.now()}_${Math.floor(Math.random() * 1e3)}`,
      symbol: symbol.toUpperCase(),
      direction,
      entryPrice,
      currentPrice: entryPrice,
      stopLoss,
      takeProfit,
      quantity: quantity || 1,
      riskRewardRatio,
      status: "OPEN",
      pnlUsdt: 0,
      pnlPercent: 0,
      entryTime: Date.now(),
      notes,
      strategyUsed: strategyUsed || "\u062A\u062D\u0644\u064A\u0644 \u0641\u0646\u064A \u064A\u062F\u0648\u064A"
    };
    this.trades.unshift(trade);
    return trade;
  }
  updateTradeStatus(id, status) {
    const trade = this.trades.find((t) => t.id === id);
    if (!trade) return null;
    trade.status = status;
    if (status !== "OPEN") {
      trade.exitTime = Date.now();
    }
    return trade;
  }
  deleteTrade(id) {
    const len = this.trades.length;
    this.trades = this.trades.filter((t) => t.id !== id);
    return this.trades.length < len;
  }
  // Sync open trades with live market prices to update PnL and trigger targets
  async syncTradesWithMarket() {
    for (const trade of this.trades) {
      if (trade.status !== "OPEN") continue;
      try {
        const ticker = await getSingleTicker(trade.symbol);
        const curPrice = ticker.price;
        trade.currentPrice = curPrice;
        const isBuy = trade.direction === "\u0634\u0631\u0627\u0621";
        const priceDiff = isBuy ? curPrice - trade.entryPrice : trade.entryPrice - curPrice;
        trade.pnlUsdt = Number((priceDiff * trade.quantity).toFixed(2));
        trade.pnlPercent = Number((priceDiff / trade.entryPrice * 100).toFixed(2));
        if (isBuy) {
          if (curPrice >= trade.takeProfit) {
            trade.status = "WON";
            trade.exitTime = Date.now();
          } else if (curPrice <= trade.stopLoss) {
            trade.status = "LOST";
            trade.exitTime = Date.now();
          }
        } else {
          if (curPrice <= trade.takeProfit) {
            trade.status = "WON";
            trade.exitTime = Date.now();
          } else if (curPrice >= trade.stopLoss) {
            trade.status = "LOST";
            trade.exitTime = Date.now();
          }
        }
      } catch {
      }
    }
  }
  // Periodic alert and trade checker
  startChecker() {
    this.checkInterval = setInterval(async () => {
      for (const alert of this.alerts) {
        if (!alert.isActive || alert.isTriggered) continue;
        try {
          const ticker = await getSingleTicker(alert.symbol);
          const curPrice = ticker.price;
          if (alert.type === "PRICE_ABOVE" && alert.targetPrice && curPrice >= alert.targetPrice) {
            alert.isTriggered = true;
            alert.triggeredAt = Date.now();
          } else if (alert.type === "PRICE_BELOW" && alert.targetPrice && curPrice <= alert.targetPrice) {
            alert.isTriggered = true;
            alert.triggeredAt = Date.now();
          } else if (alert.type === "STRONG_BUY_SIGNAL") {
            const analysis = await getFullAnalysis(alert.symbol, "1h");
            if (analysis.summary.overallSignal === "\u0634\u0631\u0627\u0621 \u0642\u0648\u064A") {
              alert.isTriggered = true;
              alert.triggeredAt = Date.now();
            }
          }
        } catch {
        }
      }
      await this.syncTradesWithMarket();
    }, 25e3);
  }
};
var journalAndAlerts = new JournalAndAlertsEngine();

// server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = Number(process.env.PORT) || 3e3;
var isProduction = process.env.NODE_ENV === "production";
app.use(express.json());
app.get("/api/status", (req, res) => {
  const status = getBinanceStatus();
  res.json({
    status: "ok",
    ...status,
    serverTime: Date.now()
  });
});
app.get("/api/watchlist", async (req, res) => {
  try {
    const data = await getWatchlistWithSignals();
    res.json({
      success: true,
      data,
      count: data.length,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(502).json({
      success: false,
      error: error.message || "\u062A\u0639\u0630\u0631 \u062C\u0644\u0628 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629 \u0645\u0646 \u0628\u064A\u0646\u0627\u0646\u0633",
      timestamp: Date.now()
    });
  }
});
app.get("/api/ticker/24hr", async (req, res) => {
  try {
    const symbolsParam = req.query.symbols;
    const symbols = symbolsParam ? symbolsParam.split(",").map((s) => s.trim().toUpperCase()) : DEFAULT_SYMBOLS;
    const { tickers, cached, lastUpdated } = await get24hTickers(symbols);
    res.json({
      success: true,
      data: tickers,
      cached,
      lastUpdated
    });
  } catch (error) {
    res.status(502).json({
      success: false,
      error: error.message || "\u062A\u0639\u0630\u0631 \u062C\u0644\u0628 \u0623\u0633\u0639\u0627\u0631 24 \u0633\u0627\u0639\u0629",
      timestamp: Date.now()
    });
  }
});
app.get("/api/klines", async (req, res) => {
  try {
    const symbol = (req.query.symbol || "BTCUSDT").toUpperCase();
    const interval = req.query.interval || "1h";
    const limit = Math.min(Number(req.query.limit) || 500, 1e3);
    const { candles, cached, lastUpdated } = await getKlines(symbol, interval, limit);
    res.json({
      success: true,
      symbol,
      interval,
      count: candles.length,
      cached,
      lastUpdated,
      candles
    });
  } catch (error) {
    res.status(502).json({
      success: false,
      error: error.message || "\u062A\u0639\u0630\u0631 \u062C\u0644\u0628 \u0634\u0645\u0648\u0639 \u0627\u0644\u062A\u062F\u0627\u0648\u0644 \u0645\u0646 \u0628\u064A\u0646\u0627\u0646\u0633",
      timestamp: Date.now()
    });
  }
});
app.get("/api/analysis", async (req, res) => {
  try {
    const symbol = (req.query.symbol || "BTCUSDT").toUpperCase();
    const interval = req.query.interval || "1h";
    if (!VALID_TIMEFRAMES.includes(interval)) {
      return res.status(400).json({
        success: false,
        error: `\u0627\u0644\u0625\u0637\u0627\u0631 \u0627\u0644\u0632\u0645\u0646\u064A '${interval}' \u063A\u064A\u0631 \u0645\u062F\u0639\u0648\u0645. \u0627\u0644\u0623\u0637\u0631 \u0627\u0644\u0645\u062A\u0627\u062D\u0629: 15m, 1h, 4h, 1d`
      });
    }
    const analysis = await getFullAnalysis(symbol, interval);
    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    res.status(502).json({
      success: false,
      error: error.message || "\u0641\u0634\u0644 \u062D\u0633\u0627\u0628 \u0627\u0644\u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u0641\u0646\u064A \u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0623\u0635\u0644",
      timestamp: Date.now()
    });
  }
});
app.get("/api/timeframes-summary", async (req, res) => {
  try {
    const symbol = (req.query.symbol || "BTCUSDT").toUpperCase();
    const data = await getTimeframesSummary(symbol);
    res.json({
      success: true,
      symbol,
      data,
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(502).json({
      success: false,
      error: error.message || "\u062A\u0639\u0630\u0631 \u062C\u0644\u0628 \u0645\u0644\u062E\u0635 \u0627\u0644\u0623\u0637\u0631 \u0627\u0644\u0632\u0645\u0646\u064A\u0629",
      timestamp: Date.now()
    });
  }
});
app.get("/api/pairs", async (req, res) => {
  try {
    const pairs = await getUsdtPairs();
    res.json({
      success: true,
      pairs,
      count: pairs.length
    });
  } catch (error) {
    res.status(502).json({
      success: false,
      error: error.message || "\u062A\u0639\u0630\u0631 \u062C\u0644\u0628 \u0642\u0627\u0626\u0645\u0629 \u0623\u0632\u0648\u0627\u062C USDT"
    });
  }
});
app.get("/api/trade/config", (req, res) => {
  const hasEnvKeys = Boolean(process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET);
  res.json({
    success: true,
    hasEnvKeys,
    useTestnet: process.env.BINANCE_USE_TESTNET === "true",
    defaultMode: hasEnvKeys ? "live" : "paper"
  });
});
app.get("/api/trade/account", async (req, res) => {
  try {
    const mode = req.query.mode || "paper";
    const customKey = req.headers["x-binance-apikey"];
    const customSecret = req.headers["x-binance-apisecret"];
    const account = await getAccountState(mode, customKey, customSecret);
    res.json({
      success: true,
      data: account
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message || "\u062A\u0639\u0630\u0631 \u062C\u0644\u0628 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u062D\u0641\u0638\u0629 \u0648\u0627\u0644\u062A\u062F\u0627\u0648\u0644"
    });
  }
});
app.post("/api/trade/order", async (req, res) => {
  try {
    const body = req.body;
    const customKey = req.headers["x-binance-apikey"];
    const customSecret = req.headers["x-binance-apisecret"];
    if (!body.symbol || !body.side || !body.type || !body.quantity || body.quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0623\u0645\u0631 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629 (\u0627\u0644\u0631\u0645\u0632\u060C \u0627\u0644\u0639\u0645\u0644\u064A\u0629\u060C \u0627\u0644\u0646\u0648\u0639\u060C \u0627\u0644\u0643\u0645\u064A\u0629 \u0645\u0637\u0644\u0648\u0628\u0629)"
      });
    }
    const order = await executeOrder(body, customKey, customSecret);
    res.json({
      success: true,
      message: `\u062A\u0645 \u062A\u0646\u0641\u064A\u0630 \u0623\u0645\u0631 ${body.side === "BUY" ? "\u0627\u0644\u0634\u0631\u0627\u0621" : "\u0627\u0644\u0628\u064A\u0639"} \u0628\u0646\u062C\u0627\u062D`,
      data: order
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message || "\u0641\u0634\u0644 \u062A\u0646\u0641\u064A\u0630 \u0627\u0644\u0623\u0645\u0631"
    });
  }
});
app.delete("/api/trade/order", async (req, res) => {
  try {
    const orderId = req.query.orderId;
    const symbol = req.query.symbol || "BTCUSDT";
    const mode = req.query.mode || "paper";
    const customKey = req.headers["x-binance-apikey"];
    const customSecret = req.headers["x-binance-apisecret"];
    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: "\u0631\u0642\u0645 \u0627\u0644\u0623\u0645\u0631 (orderId) \u0645\u0637\u0644\u0648\u0628 \u0644\u0644\u0625\u0644\u063A\u0627\u0621"
      });
    }
    const canceled = await cancelOrder(orderId, symbol, mode, customKey, customSecret);
    res.json({
      success: true,
      message: "\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0623\u0645\u0631 \u0628\u0646\u062C\u0627\u062D",
      data: canceled
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message || "\u0641\u0634\u0644 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u0623\u0645\u0631"
    });
  }
});
app.post("/api/trade/reset-paper", (req, res) => {
  const initial = Number(req.body.initialUsdt) || 1e4;
  paperTrading.reset(initial);
  res.json({
    success: true,
    message: `\u062A\u0645\u062A \u0625\u0639\u0627\u062F\u0629 \u062A\u0639\u064A\u064A\u0646 \u0627\u0644\u0645\u062D\u0641\u0638\u0629 \u0627\u0644\u062A\u062C\u0631\u064A\u0628\u064A\u0629 \u0628\u0631\u0635\u064A\u062F ${initial} USDT`,
    data: {
      balances: paperTrading.getBalances()
    }
  });
});
app.get("/api/bot/status", (req, res) => {
  res.json({
    success: true,
    data: tradingBot.getState()
  });
});
app.post("/api/bot/start", (req, res) => {
  const state = tradingBot.start();
  res.json({
    success: true,
    message: "\u062A\u0645 \u062A\u0634\u063A\u064A\u0644 \u0628\u0648\u062A \u0627\u0644\u062A\u062F\u0627\u0648\u0644 \u0627\u0644\u0622\u0644\u064A \u0628\u0646\u062C\u0627\u062D",
    data: state
  });
});
app.post("/api/bot/stop", (req, res) => {
  const state = tradingBot.stop();
  res.json({
    success: true,
    message: "\u062A\u0645 \u0625\u064A\u0642\u0627\u0641 \u0628\u0648\u062A \u0627\u0644\u062A\u062F\u0627\u0648\u0644 \u0627\u0644\u0622\u0644\u064A \u0628\u0646\u062C\u0627\u062D",
    data: state
  });
});
app.post("/api/bot/settings", (req, res) => {
  const updated = tradingBot.updateSettings(req.body);
  res.json({
    success: true,
    message: "\u062A\u0645 \u062D\u0641\u0638 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0628\u0648\u062A \u0628\u0646\u062C\u0627\u062D",
    data: updated
  });
});
app.post("/api/bot/clear-logs", (req, res) => {
  tradingBot.clearLogs();
  res.json({
    success: true,
    message: "\u062A\u0645 \u0645\u0633\u062D \u0633\u062C\u0644\u0627\u062A \u0627\u0644\u0628\u0648\u062A"
  });
});
app.post("/api/bot/exchange", (req, res) => {
  const { id, status, apiKeyMasked } = req.body;
  if (!id) return res.status(400).json({ success: false, error: "\u0645\u0639\u0631\u0641 \u0627\u0644\u0645\u0646\u0635\u0629 \u0645\u0637\u0644\u0648\u0628" });
  tradingBot.updateExchangeStatus(id, status || "connected", apiKeyMasked);
  res.json({
    success: true,
    message: `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0629 \u0645\u0646\u0635\u0629 ${id} \u0628\u0646\u062C\u0627\u062D`,
    data: tradingBot.getState().connectedExchanges
  });
});
app.post("/api/webhook/tradingview", async (req, res) => {
  try {
    const { symbol, action, quantity, price, secret, strategy, exchange } = req.body;
    const botState = tradingBot.getState();
    const expectedSecret = botState.settings.webhookSecret || "ais-trader-bot-secret";
    if (secret && secret !== expectedSecret) {
      return res.status(401).json({ success: false, error: "\u0631\u0645\u0632 \u0627\u0644\u0623\u0645\u0627\u0646 (Webhook Secret) \u063A\u064A\u0631 \u0645\u0637\u0627\u0628\u0642" });
    }
    const result = await tradingBot.handleWebhookSignal({
      symbol: symbol || "BTCUSDT",
      action: action === "SELL" ? "SELL" : "BUY",
      quantity: Number(quantity) || void 0,
      price: Number(price) || void 0,
      exchange: exchange || botState.settings.targetExchange || "binance",
      strategy: strategy || "TradingView Webhook Alert"
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.get("/api/alerts", (req, res) => {
  res.json({
    success: true,
    data: journalAndAlerts.getAlerts()
  });
});
app.post("/api/alerts", (req, res) => {
  try {
    const { symbol, type, targetPrice, targetSignal, note } = req.body;
    if (!symbol || !type) {
      return res.status(400).json({ success: false, error: "\u0627\u0644\u0631\u0645\u0632 \u0648\u0646\u0648\u0639 \u0627\u0644\u062A\u0646\u0628\u064A\u0647 \u0645\u0637\u0644\u0648\u0628\u0627\u0646" });
    }
    const alert = journalAndAlerts.addAlert(symbol, type, targetPrice, targetSignal, note);
    res.json({ success: true, message: "\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u062A\u0646\u0628\u064A\u0647 \u0628\u0646\u062C\u0627\u062D", data: alert });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/alerts/toggle", (req, res) => {
  const { id } = req.body;
  const alert = journalAndAlerts.toggleAlert(id);
  if (!alert) return res.status(404).json({ success: false, error: "\u0627\u0644\u062A\u0646\u0628\u064A\u0647 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F" });
  res.json({ success: true, data: alert });
});
app.delete("/api/alerts", (req, res) => {
  const id = req.query.id;
  const deleted = journalAndAlerts.deleteAlert(id);
  res.json({ success: deleted });
});
app.get("/api/journal", async (req, res) => {
  try {
    const result = await journalAndAlerts.getTrades();
    res.json({ success: true, data: result.trades, stats: result.stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/journal", (req, res) => {
  try {
    const { symbol, direction, entryPrice, stopLoss, takeProfit, quantity, notes, strategyUsed } = req.body;
    if (!symbol || !direction || !entryPrice) {
      return res.status(400).json({ success: false, error: "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0635\u0641\u0642\u0629 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644\u0629" });
    }
    const trade = journalAndAlerts.addTrade(
      symbol,
      direction,
      Number(entryPrice),
      Number(stopLoss),
      Number(takeProfit),
      Number(quantity || 1),
      notes,
      strategyUsed
    );
    res.json({ success: true, message: "\u062A\u0645 \u062D\u0641\u0638 \u0627\u0644\u0635\u0641\u0642\u0629 \u0641\u064A \u0627\u0644\u0633\u062C\u0644 \u0628\u0646\u062C\u0627\u062D", data: trade });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});
app.post("/api/journal/status", (req, res) => {
  const { id, status } = req.body;
  const trade = journalAndAlerts.updateTradeStatus(id, status);
  if (!trade) return res.status(404).json({ success: false, error: "\u0627\u0644\u0635\u0641\u0642\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629" });
  res.json({ success: true, data: trade });
});
app.delete("/api/journal", (req, res) => {
  const id = req.query.id;
  const deleted = journalAndAlerts.deleteTrade(id);
  res.json({ success: deleted });
});
app.get("/api/stream", (req, res) => {
  const symbol = (req.query.symbol || "BTCUSDT").toUpperCase();
  const interval = req.query.interval || "1h";
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  res.write(`data: ${JSON.stringify({ type: "connected", symbol, interval, time: Date.now() })}

`);
  const unsubscribe = streamManager.subscribe(symbol, interval, (klineData) => {
    res.write(`data: ${JSON.stringify({ type: "kline", ...klineData })}

`);
  });
  const pingInterval = setInterval(() => {
    res.write(`:ping

`);
  }, 15e3);
  req.on("close", () => {
    clearInterval(pingInterval);
    unsubscribe();
    res.end();
  });
});
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`\u{1F680} \u0642\u0627\u0631\u0626 \u0627\u0644\u062A\u062F\u0627\u0648\u0644 - Server running on http://0.0.0.0:${PORT}`);
  });
}
startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
