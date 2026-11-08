import type {
  Candle,
  FullAnalysis,
  IndicatorSignal,
  IndicatorValues,
  SignalSummary,
  SignalType,
  Timeframe,
  TradeProposal,
} from '../types/market.ts';

// Helper: Calculate EMA array
export function calculateEMA(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return result;

  // Initial SMA for first EMA point
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

// Helper: Calculate SMA array
export function calculateSMA(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
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

// Standard Wilder's RMA RSI(14)
export function calculateRSI(closes: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length <= period) return result;

  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
  }

  // First avg gain/loss is SMA
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  avgGain /= period;
  avgLoss /= period;

  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  // Subsequent values using Wilder's smoothing
  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result[i + 1] = avgLoss === 0 ? 100 : 100 - 100 / (1 + rs);
  }

  return result;
}

// MACD (12, 26, 9)
export function calculateMACD(
  closes: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
) {
  const fastEMA = calculateEMA(closes, fastPeriod);
  const slowEMA = calculateEMA(closes, slowPeriod);

  const macdLine: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = 0; i < closes.length; i++) {
    if (fastEMA[i] !== null && slowEMA[i] !== null) {
      macdLine[i] = (fastEMA[i] as number) - (slowEMA[i] as number);
    }
  }

  // Filter valid numbers for signal calculation
  const validStartIndex = macdLine.findIndex((v) => v !== null);
  const validMacd = validStartIndex !== -1 ? (macdLine.slice(validStartIndex) as number[]) : [];
  const validSignal = calculateEMA(validMacd, signalPeriod);

  const signalLine: (number | null)[] = new Array(closes.length).fill(null);
  const histogram: (number | null)[] = new Array(closes.length).fill(null);

  if (validStartIndex !== -1) {
    for (let i = 0; i < validSignal.length; i++) {
      const originalIdx = validStartIndex + i;
      signalLine[originalIdx] = validSignal[i];
      if (macdLine[originalIdx] !== null && validSignal[i] !== null) {
        histogram[originalIdx] = (macdLine[originalIdx] as number) - (validSignal[i] as number);
      }
    }
  }

  return { macdLine, signalLine, histogram };
}

// Bollinger Bands (20, 2)
export function calculateBollingerBands(closes: number[], period = 20, multiplier = 2) {
  const middle = calculateSMA(closes, period);
  const upper: (number | null)[] = new Array(closes.length).fill(null);
  const lower: (number | null)[] = new Array(closes.length).fill(null);

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

// Stochastic Oscillator (14, 3, 3)
export function calculateStochastic(
  candles: Candle[],
  kPeriod = 14,
  kSmoothing = 3,
  dPeriod = 3
) {
  const fastK: number[] = [];
  const fastKIndices: number[] = [];

  for (let i = kPeriod - 1; i < candles.length; i++) {
    let lowest = Infinity;
    let highest = -Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (candles[j].low < lowest) lowest = candles[j].low;
      if (candles[j].high > highest) highest = candles[j].high;
    }
    const diff = highest - lowest;
    const currentClose = candles[i].close;
    const kVal = diff === 0 ? 50 : ((currentClose - lowest) / diff) * 100;
    fastK.push(kVal);
    fastKIndices.push(i);
  }

  // Smooth fastK with SMA3 to get %K
  const smoothedKValues = calculateSMA(fastK, kSmoothing);
  const smoothedKAll: (number | null)[] = new Array(candles.length).fill(null);
  const validSmoothedK: number[] = [];
  const validSmoothedKIndices: number[] = [];

  for (let i = 0; i < smoothedKValues.length; i++) {
    const val = smoothedKValues[i];
    const targetIdx = fastKIndices[i];
    smoothedKAll[targetIdx] = val;
    if (val !== null) {
      validSmoothedK.push(val);
      validSmoothedKIndices.push(targetIdx);
    }
  }

  // Smooth %K with SMA3 to get %D
  const dValues = calculateSMA(validSmoothedK, dPeriod);
  const dAll: (number | null)[] = new Array(candles.length).fill(null);

  for (let i = 0; i < dValues.length; i++) {
    const val = dValues[i];
    const targetIdx = validSmoothedKIndices[i];
    dAll[targetIdx] = val;
  }

  return { stochK: smoothedKAll, stochD: dAll };
}

// ATR(14)
export function calculateATR(candles: Candle[], period = 14): number {
  if (candles.length < 2) return 0;
  const trs: number[] = [];
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

// Pivot Supports and Resistances from last 100 candles
export function findPivots(candles: Candle[], currentPrice: number, lookback = 100) {
  const subset = candles.slice(-lookback);
  const pivotsHigh: number[] = [];
  const pivotsLow: number[] = [];
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

  // Filter distinct resistances above current price
  const resistances = pivotsHigh
    .filter((p) => p > currentPrice * 1.001)
    .sort((a, b) => a - b); // ascending from closest

  // Filter distinct supports below current price
  const supports = pivotsLow
    .filter((p) => p < currentPrice * 0.999)
    .sort((a, b) => b - a); // descending from closest

  // Cluster levels within 0.3%
  const cleanLevels = (levels: number[]): number[] => {
    const res: number[] = [];
    for (const lvl of levels) {
      if (!res.some((existing) => Math.abs(existing - lvl) / existing < 0.003)) {
        res.push(lvl);
      }
      if (res.length >= 2) break;
    }
    return res;
  };

  const nearestResistances = cleanLevels(resistances);
  const nearestSupports = cleanLevels(supports);

  // Fallbacks if not enough pivots found
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

// Compute all indicators, signals and trade reading
export function analyzeMarketData(
  symbol: string,
  interval: Timeframe,
  candles: Candle[],
  tickerMeta?: {
    priceChange24h?: number;
    priceChangePercent24h?: number;
    high24h?: number;
    low24h?: number;
    volume24h?: number;
  }
): FullAnalysis {
  if (candles.length < 50) {
    throw new Error(`عدد الشموع المستلمة (${candles.length}) غير كافٍ لإجراء التحليل الفني الدقيق (الحد الأدنى 50).`);
  }

  const closes = candles.map((c) => c.close);
  const lastIndex = candles.length - 1;
  const currentPrice = candles[lastIndex].close;

  // 1. EMA 20 & 50
  const ema20Series = calculateEMA(closes, 20);
  const ema50Series = calculateEMA(closes, 50);
  const curEMA20 = ema20Series[lastIndex] ?? currentPrice;
  const curEMA50 = ema50Series[lastIndex] ?? currentPrice;

  let emaSignal: IndicatorSignal = 'محايد';
  let emaInterpretation = 'السعر ومتوسطات EMA في نطاق متداخل';
  if (currentPrice > curEMA20 && curEMA20 > curEMA50) {
    emaSignal = 'شراء';
    emaInterpretation = 'السعر فوق EMA20 وEMA20 فوق EMA50 (ترتيب صاعد قوي)';
  } else if (currentPrice < curEMA20 && curEMA20 < curEMA50) {
    emaSignal = 'بيع';
    emaInterpretation = 'السعر تحت EMA20 وEMA20 تحت EMA50 (ترتيب هابط)';
  }

  // 2. RSI (14)
  const rsiSeries = calculateRSI(closes, 14);
  const curRSI = rsiSeries[lastIndex] ?? 50;

  let rsiSignal: IndicatorSignal = 'محايد';
  let rsiInterpretation = 'في المنطقة المحايدة الطبيعية (30 - 70)';
  if (curRSI < 30) {
    rsiSignal = 'شراء';
    rsiInterpretation = `ذروة بيع مفرطة (${curRSI.toFixed(1)} < 30) تشير لاحتمال ارتداد صاعد`;
  } else if (curRSI > 70) {
    rsiSignal = 'بيع';
    rsiInterpretation = `ذروة شراء مفرطة (${curRSI.toFixed(1)} > 70) تشير لتشبع شرائي وجني أرباح`;
  }

  // 3. MACD (12, 26, 9)
  const { macdLine, signalLine, histogram } = calculateMACD(closes, 12, 26, 9);
  const curMacd = macdLine[lastIndex] ?? 0;
  const curSignal = signalLine[lastIndex] ?? 0;
  const curHist = histogram[lastIndex] ?? 0;

  let macdSignal: IndicatorSignal = 'محايد';
  let macdInterpretation = 'خط الماكد قريب من خط الإشارة';
  if (curMacd > curSignal) {
    macdSignal = 'شراء';
    macdInterpretation = `خط الماكد (${curMacd.toFixed(2)}) أعلى من خط الإشارة (${curSignal.toFixed(2)}) مع هيستوغرام إيجابي`;
  } else if (curMacd < curSignal) {
    macdSignal = 'بيع';
    macdInterpretation = `خط الماكد (${curMacd.toFixed(2)}) أدنى من خط الإشارة (${curSignal.toFixed(2)}) مع هيستوغرام سلبي`;
  }

  // 4. Bollinger Bands (20, 2)
  const { upper, middle, lower } = calculateBollingerBands(closes, 20, 2);
  const curUpper = upper[lastIndex] ?? currentPrice * 1.05;
  const curMiddle = middle[lastIndex] ?? currentPrice;
  const curLower = lower[lastIndex] ?? currentPrice * 0.95;
  const bandWidth = curUpper - curLower;
  const percentB = bandWidth > 0 ? (currentPrice - curLower) / bandWidth : 0.5;

  let bollingerSignal: IndicatorSignal = 'محايد';
  let bollingerInterpretation = 'السعر يتحرك داخل حدود نطاق بولينجر الطبيعي';
  if (currentPrice <= curLower) {
    bollingerSignal = 'شراء';
    bollingerInterpretation = `السعر عند الحد السفلي أو تحته (${curLower.toFixed(2)}) يرجح الارتداد`;
  } else if (currentPrice >= curUpper) {
    bollingerSignal = 'بيع';
    bollingerInterpretation = `السعر عند الحد العلوي أو فوقه (${curUpper.toFixed(2)}) يرجح التصحيح`;
  }

  // 5. Stochastic (14, 3, 3)
  const { stochK, stochD } = calculateStochastic(candles, 14, 3, 3);
  const curK = stochK[lastIndex] ?? 50;
  const curD = stochD[lastIndex] ?? 50;

  let stochasticSignal: IndicatorSignal = 'محايد';
  let stochasticInterpretation = 'المؤشر في النطاق المتوسط (20 - 80)';
  if (curK < 20) {
    stochasticSignal = 'شراء';
    stochasticInterpretation = `قيمة %K عند (${curK.toFixed(1)} < 20) في منطقة تشبع بيعي`;
  } else if (curK > 80) {
    stochasticSignal = 'بيع';
    stochasticInterpretation = `قيمة %K عند (${curK.toFixed(1)} > 80) في منطقة تشبع شرائي`;
  }

  // Overall Consensus Calculation
  const indicatorSignals: IndicatorSignal[] = [
    rsiSignal,
    macdSignal,
    emaSignal,
    bollingerSignal,
    stochasticSignal,
  ];

  let buyCount = 0;
  let sellCount = 0;
  let neutralCount = 0;

  for (const s of indicatorSignals) {
    if (s === 'شراء') buyCount++;
    else if (s === 'بيع') sellCount++;
    else neutralCount++;
  }

  let overallSignal: SignalType = 'محايد';
  if (buyCount >= 4) {
    overallSignal = 'شراء قوي';
  } else if (buyCount === 3 && buyCount > sellCount) {
    overallSignal = 'شراء';
  } else if (sellCount >= 4) {
    overallSignal = 'بيع قوي';
  } else if (sellCount === 3 && sellCount > buyCount) {
    overallSignal = 'بيع';
  } else {
    overallSignal = 'محايد';
  }

  const majorityCount = Math.max(buyCount, sellCount, neutralCount);
  const consensusRatio = `${majorityCount} من 5 مؤشرات تتفق`;
  const agreementPercentage = Math.round((majorityCount / 5) * 100);

  const summary: SignalSummary = {
    overallSignal,
    buyCount,
    sellCount,
    neutralCount,
    consensusRatio,
    agreementPercentage,
  };

  // Trend determination from EMA50 slope and current price
  const prev5Index = Math.max(0, lastIndex - 5);
  const prevEMA50 = ema50Series[prev5Index] ?? curEMA50;
  const ema50SlopePercent = ((curEMA50 - prevEMA50) / (prevEMA50 || 1)) * 100;

  let trend: 'صاعد' | 'هابط' | 'عرضي' = 'عرضي';
  if (ema50SlopePercent > 0.05 && currentPrice > curEMA50) {
    trend = 'صاعد';
  } else if (ema50SlopePercent < -0.05 && currentPrice < curEMA50) {
    trend = 'هابط';
  } else {
    trend = 'عرضي';
  }

  // Support & Resistance Pivots
  const { nearestSupports, nearestResistances } = findPivots(candles, currentPrice, 100);

  // ATR(14)
  const atr14 = calculateATR(candles, 14);

  // Trade Proposal logic
  let direction: 'شراء' | 'بيع' | 'لا توجد صفقة واضحة' = 'لا توجد صفقة واضحة';
  let isValid = false;
  let entryPrice = currentPrice;
  let stopLoss = 0;
  let takeProfit = 0;
  let riskRewardRatio = 0;
  let rejectionReason: string | undefined;

  const primarySupport = nearestSupports[0] || currentPrice * 0.98;
  const primaryResistance = nearestResistances[0] || currentPrice * 1.02;

  if (overallSignal === 'شراء قوي' || overallSignal === 'شراء') {
    direction = 'شراء';
    entryPrice = currentPrice;
    // SL under nearest support by 1.5 * ATR
    const baseStop = primarySupport < currentPrice ? primarySupport : currentPrice - atr14;
    stopLoss = Number((baseStop - 1.5 * atr14).toFixed(4));
    takeProfit = Number(primaryResistance.toFixed(4));

    const risk = entryPrice - stopLoss;
    const reward = takeProfit - entryPrice;

    if (risk <= 0 || reward <= 0) {
      direction = 'لا توجد صفقة واضحة';
      isValid = false;
      rejectionReason = 'المستويات الفنية متقاربة جداً أو غير متسقة';
    } else {
      riskRewardRatio = Number((reward / risk).toFixed(2));
      if (riskRewardRatio < 1.5) {
        direction = 'لا توجد صفقة واضحة';
        isValid = false;
        rejectionReason = `نسبة العائد للمخاطرة (1:${riskRewardRatio}) أقل من الحد الأدنى المطلوب 1:1.5`;
      } else {
        isValid = true;
      }
    }
  } else if (overallSignal === 'بيع قوي' || overallSignal === 'بيع') {
    direction = 'بيع';
    entryPrice = currentPrice;
    const baseStop = primaryResistance > currentPrice ? primaryResistance : currentPrice + atr14;
    stopLoss = Number((baseStop + 1.5 * atr14).toFixed(4));
    takeProfit = Number(primarySupport.toFixed(4));

    const risk = stopLoss - entryPrice;
    const reward = entryPrice - takeProfit;

    if (risk <= 0 || reward <= 0) {
      direction = 'لا توجد صفقة واضحة';
      isValid = false;
      rejectionReason = 'المستويات الفنية متقاربة جداً أو غير متسقة';
    } else {
      riskRewardRatio = Number((reward / risk).toFixed(2));
      if (riskRewardRatio < 1.5) {
        direction = 'لا توجد صفقة واضحة';
        isValid = false;
        rejectionReason = `نسبة العائد للمخاطرة (1:${riskRewardRatio}) أقل من الحد الأدنى المطلوب 1:1.5`;
      } else {
        isValid = true;
      }
    }
  } else {
    direction = 'لا توجد صفقة واضحة';
    isValid = false;
    rejectionReason = 'المؤشرات الفنية في حالة تباين وحياد، يفضل الانتظار حتى اكتمال إشارة واضحة';
  }

  // Confidence
  let confidence: 'عالية' | 'متوسطة' | 'منخفضة' = 'منخفضة';
  if (majorityCount >= 4 && (trend === 'صاعد' || trend === 'هابط')) {
    confidence = 'عالية';
  } else if (majorityCount >= 3) {
    confidence = 'متوسطة';
  }

  // Arabic dynamic explanation constructed from exact values
  const fmt = (num: number) =>
    num >= 1000
      ? num.toLocaleString('en-US', { maximumFractionDigits: 2 })
      : num.toFixed(num < 1 ? 4 : 2);

  let explanationAr = '';
  if (direction === 'شراء' && isValid) {
    explanationAr = `مؤشر RSI عند ${curRSI.toFixed(1)} (${rsiSignal})، والسعر الحالي ${fmt(currentPrice)} يتمركز فوق دعم ${fmt(primarySupport)}. الاتجاه العام ${trend} مع توافق ${buyCount} من 5 مؤشرات على الصعود. نسبة العائد للمخاطرة ممتازة 1:${riskRewardRatio}.`;
  } else if (direction === 'بيع' && isValid) {
    explanationAr = `مؤشر RSI عند ${curRSI.toFixed(1)} (${rsiSignal})، والسعر الحالي ${fmt(currentPrice)} يواجه مقاومة قوية عند ${fmt(primaryResistance)}. الاتجاه العام ${trend} مع توافق ${sellCount} من 5 مؤشرات على الهبوط. نسبة العائد للمخاطرة 1:${riskRewardRatio}.`;
  } else {
    explanationAr = `مؤشر RSI عند ${curRSI.toFixed(1)}، السعر الحالي ${fmt(currentPrice)} قرب دعم ${fmt(primarySupport)} ومقاومة ${fmt(primaryResistance)}. الاتجاه العام ${trend} مع حالة ${overallSignal}. ${rejectionReason || 'لا توجد صفقة مستوفية للشروط حالياً'}.`;
  }

  const trade: TradeProposal = {
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
    nearestResistances,
  };

  const indicators: IndicatorValues = {
    rsi: {
      value: Number(curRSI.toFixed(2)),
      signal: rsiSignal,
      interpretation: rsiInterpretation,
    },
    macd: {
      macd: Number(curMacd.toFixed(4)),
      signalLine: Number(curSignal.toFixed(4)),
      histogram: Number(curHist.toFixed(4)),
      signal: macdSignal,
      interpretation: macdInterpretation,
    },
    ema: {
      ema20: Number(curEMA20.toFixed(4)),
      ema50: Number(curEMA50.toFixed(4)),
      currentPrice: Number(currentPrice.toFixed(4)),
      signal: emaSignal,
      interpretation: emaInterpretation,
    },
    bollinger: {
      upper: Number(curUpper.toFixed(4)),
      middle: Number(curMiddle.toFixed(4)),
      lower: Number(curLower.toFixed(4)),
      percentB: Number(percentB.toFixed(4)),
      signal: bollingerSignal,
      interpretation: bollingerInterpretation,
    },
    stochastic: {
      k: Number(curK.toFixed(2)),
      d: Number(curD.toFixed(2)),
      signal: stochasticSignal,
      interpretation: stochasticInterpretation,
    },
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
      stochD,
    },
    summary,
    trade,
  };
}
