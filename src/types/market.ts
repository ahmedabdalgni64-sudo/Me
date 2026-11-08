export interface Candle {
  time: number; // Unix timestamp in ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

export type SignalType = 'شراء قوي' | 'شراء' | 'محايد' | 'بيع' | 'بيع قوي';
export type IndicatorSignal = 'شراء' | 'بيع' | 'محايد';
export type Timeframe = '15m' | '1h' | '4h' | '1d';

export interface IndicatorValues {
  rsi: {
    value: number;
    signal: IndicatorSignal;
    interpretation: string;
  };
  macd: {
    macd: number;
    signalLine: number;
    histogram: number;
    signal: IndicatorSignal;
    interpretation: string;
  };
  ema: {
    ema20: number;
    ema50: number;
    currentPrice: number;
    signal: IndicatorSignal;
    interpretation: string;
  };
  bollinger: {
    upper: number;
    middle: number;
    lower: number;
    percentB: number;
    signal: IndicatorSignal;
    interpretation: string;
  };
  stochastic: {
    k: number;
    d: number;
    signal: IndicatorSignal;
    interpretation: string;
  };
}

export interface SignalSummary {
  overallSignal: SignalType;
  buyCount: number;
  sellCount: number;
  neutralCount: number;
  consensusRatio: string; // e.g. "4 من 5 مؤشرات تتفق"
  agreementPercentage: number;
}

export interface PivotLevel {
  price: number;
  type: 'support' | 'resistance';
  distancePercent: number;
}

export interface TradeProposal {
  direction: 'شراء' | 'بيع' | 'لا توجد صفقة واضحة';
  isValid: boolean;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
  atr14: number;
  rejectionReason?: string;
  explanationAr: string;
  confidence: 'عالية' | 'متوسطة' | 'منخفضة';
  trend: 'صاعد' | 'هابط' | 'عرضي';
  nearestSupports: number[];
  nearestResistances: number[];
}

export interface FullAnalysis {
  symbol: string;
  interval: Timeframe;
  currentPrice: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  lastUpdated: number;
  cached: boolean;
  candles: Candle[];
  indicators: IndicatorValues;
  series: {
    ema20: (number | null)[];
    ema50: (number | null)[];
    bollingerUpper: (number | null)[];
    bollingerMiddle: (number | null)[];
    bollingerLower: (number | null)[];
    rsi: (number | null)[];
    macdLine: (number | null)[];
    macdSignal: (number | null)[];
    macdHist: (number | null)[];
    stochK: (number | null)[];
    stochD: (number | null)[];
  };
  summary: SignalSummary;
  trade: TradeProposal;
}

export interface TimeframeSignalItem {
  timeframe: Timeframe;
  signal: SignalType;
  buyCount: number;
  sellCount: number;
  price: number;
  rsi: number;
  trend: 'صاعد' | 'هابط' | 'عرضي';
}

export interface TickerData {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  price: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  signal?: SignalType;
  lastUpdated: number;
}
