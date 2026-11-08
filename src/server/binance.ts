import { WebSocket } from 'ws';
import type {
  Candle,
  FullAnalysis,
  SignalType,
  TickerData,
  Timeframe,
  TimeframeSignalItem,
} from '../types/market.ts';
import { analyzeMarketData } from './indicators.ts';

const PRIMARY_BINANCE_URL = 'https://api.binance.com';
const FALLBACK_BINANCE_URL = 'https://data-api.binance.vision';
const WS_BASE_URL = 'wss://stream.binance.com:9443/ws';

export const DEFAULT_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'XRPUSDT',
  'ADAUSDT',
  'DOGEUSDT',
  'TONUSDT',
];

export const VALID_TIMEFRAMES: Timeframe[] = ['15m', '1h', '4h', '1d'];

// Cache structures (5 seconds TTL)
interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_TTL_MS = 5000;
const klineCache = new Map<string, CacheEntry<Candle[]>>();
let tickerCache: CacheEntry<TickerData[]> | null = null;
const singleTickerCache = new Map<string, CacheEntry<TickerData>>();
let exchangeInfoCache: CacheEntry<string[]> | null = null;

// Track last successful Binance update
let lastSuccessfulBinanceContact: number = 0;
let lastBinanceError: string | null = null;

/**
 * Robust fetch with automatic failover to fallback URL
 */
async function fetchBinanceApi<T>(path: string): Promise<T> {
  // Try primary endpoint first
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${PRIMARY_BINANCE_URL}${path}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'BinanceMarketReader/1.0',
        Accept: 'application/json',
      },
    });
    clearTimeout(timeout);

    if (res.ok) {
      lastSuccessfulBinanceContact = Date.now();
      lastBinanceError = null;
      return (await res.json()) as T;
    }
    // Non-200, throw to try fallback
    const errText = await res.text();
    console.warn(`Primary Binance API returned status ${res.status}: ${errText.slice(0, 100)}`);
  } catch (err: any) {
    console.warn(`Primary Binance API failed (${err?.message || err}), switching to fallback...`);
  }

  // Fallback endpoint
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${FALLBACK_BINANCE_URL}${path}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'BinanceMarketReader/1.0',
        Accept: 'application/json',
      },
    });
    clearTimeout(timeout);

    if (res.ok) {
      lastSuccessfulBinanceContact = Date.now();
      lastBinanceError = null;
      return (await res.json()) as T;
    }
    const errText = await res.text();
    throw new Error(`كلا الخادمين غير متاحين حالياً (${res.status}): ${errText.slice(0, 100)}`);
  } catch (err: any) {
    lastBinanceError = err?.message || 'فشل الاتصال بـ Binance';
    throw new Error(`تعذر الاتصال بخوادم بينانس العامة: ${lastBinanceError}`);
  }
}

/**
 * Fetch 500 klines with 5s cache
 */
export async function getKlines(
  symbol: string,
  interval: Timeframe = '1h',
  limit = 500
): Promise<{ candles: Candle[]; cached: boolean; lastUpdated: number }> {
  const normSymbol = symbol.toUpperCase();
  const cacheKey = `${normSymbol}_${interval}_${limit}`;
  const now = Date.now();

  const cached = klineCache.get(cacheKey);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return {
      candles: cached.data,
      cached: true,
      lastUpdated: cached.timestamp,
    };
  }

  const raw = await fetchBinanceApi<any[]>(
    `/api/v3/klines?symbol=${encodeURIComponent(normSymbol)}&interval=${interval}&limit=${limit}`
  );

  if (!Array.isArray(raw) || raw.length === 0) {
    throw new Error(`لم يتم استلام أي شموع للزوج ${normSymbol}`);
  }

  const candles: Candle[] = raw.map((item) => ({
    time: Number(item[0]),
    open: Number(item[1]),
    high: Number(item[2]),
    low: Number(item[3]),
    close: Number(item[4]),
    volume: Number(item[5]),
    closeTime: Number(item[6]),
  }));

  klineCache.set(cacheKey, { data: candles, timestamp: now });
  return { candles, cached: false, lastUpdated: now };
}

/**
 * Fetch 24hr ticker for symbols
 */
export async function get24hTickers(
  symbols: string[] = DEFAULT_SYMBOLS
): Promise<{ tickers: TickerData[]; cached: boolean; lastUpdated: number }> {
  const now = Date.now();

  if (tickerCache && now - tickerCache.timestamp < CACHE_TTL_MS) {
    const filtered = tickerCache.data.filter((t) => symbols.includes(t.symbol));
    return {
      tickers: filtered,
      cached: true,
      lastUpdated: tickerCache.timestamp,
    };
  }

  const raw = await fetchBinanceApi<any[]>('/api/v3/ticker/24hr');

  if (!Array.isArray(raw)) {
    throw new Error('فشل جلب بيانات أسعار السوق');
  }

  const allTickers: TickerData[] = raw
    .filter((item) => item.symbol.endsWith('USDT'))
    .map((item) => {
      const sym = item.symbol;
      const baseAsset = sym.replace('USDT', '');
      return {
        symbol: sym,
        baseAsset,
        quoteAsset: 'USDT',
        price: Number(item.lastPrice),
        priceChange24h: Number(item.priceChange),
        priceChangePercent24h: Number(item.priceChangePercent),
        high24h: Number(item.highPrice),
        low24h: Number(item.lowPrice),
        volume24h: Number(item.volume),
        lastUpdated: now,
      };
    });

  tickerCache = { data: allTickers, timestamp: now };

  const filtered = allTickers.filter((t) => symbols.includes(t.symbol));
  return { tickers: filtered, cached: false, lastUpdated: now };
}

/**
 * Fetch a single ticker
 */
export async function getSingleTicker(symbol: string): Promise<TickerData> {
  const normSymbol = symbol.toUpperCase();
  const now = Date.now();

  const cached = singleTickerCache.get(normSymbol);
  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return cached.data;
  }

  const raw = await fetchBinanceApi<any>(
    `/api/v3/ticker/24hr?symbol=${encodeURIComponent(normSymbol)}`
  );

  const baseAsset = normSymbol.replace('USDT', '');
  const data: TickerData = {
    symbol: normSymbol,
    baseAsset,
    quoteAsset: 'USDT',
    price: Number(raw.lastPrice),
    priceChange24h: Number(raw.priceChange),
    priceChangePercent24h: Number(raw.priceChangePercent),
    high24h: Number(raw.highPrice),
    low24h: Number(raw.lowPrice),
    volume24h: Number(raw.volume),
    lastUpdated: now,
  };

  singleTickerCache.set(normSymbol, { data, timestamp: now });
  return data;
}

/**
 * Get USDT symbols list from exchangeInfo
 */
export async function getUsdtPairs(): Promise<string[]> {
  const now = Date.now();
  if (exchangeInfoCache && now - exchangeInfoCache.timestamp < 3600000) {
    return exchangeInfoCache.data;
  }

  const raw = await fetchBinanceApi<any>('/api/v3/exchangeInfo');
  const symbols = (raw?.symbols || [])
    .filter((s: any) => s.status === 'TRADING' && s.quoteAsset === 'USDT')
    .map((s: any) => s.symbol as string);

  exchangeInfoCache = { data: symbols, timestamp: now };
  return symbols;
}

/**
 * Get full technical analysis for a pair and interval
 */
export async function getFullAnalysis(
  symbol: string,
  interval: Timeframe = '1h'
): Promise<FullAnalysis> {
  const normSymbol = symbol.toUpperCase();
  const [klinesResult, ticker] = await Promise.all([
    getKlines(normSymbol, interval, 500),
    getSingleTicker(normSymbol).catch(() => null),
  ]);

  const analysis = analyzeMarketData(normSymbol, interval, klinesResult.candles, {
    priceChange24h: ticker?.priceChange24h,
    priceChangePercent24h: ticker?.priceChangePercent24h,
    high24h: ticker?.high24h,
    low24h: ticker?.low24h,
    volume24h: ticker?.volume24h,
  });

  analysis.cached = klinesResult.cached;
  analysis.lastUpdated = klinesResult.lastUpdated;
  return analysis;
}

/**
 * Get summary across all 4 timeframes (15m, 1h, 4h, 1d)
 */
export async function getTimeframesSummary(symbol: string): Promise<TimeframeSignalItem[]> {
  const normSymbol = symbol.toUpperCase();
  const timeframes: Timeframe[] = ['15m', '1h', '4h', '1d'];

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
          trend: analysis.trade.trend,
        };
      } catch (err) {
        return {
          timeframe: tf,
          signal: 'محايد' as SignalType,
          buyCount: 0,
          sellCount: 0,
          price: 0,
          rsi: 50,
          trend: 'عرضي' as const,
        };
      }
    })
  );

  return results;
}

/**
 * Watchlist quick signals for default symbols
 */
export async function getWatchlistWithSignals(): Promise<TickerData[]> {
  const { tickers, lastUpdated } = await get24hTickers(DEFAULT_SYMBOLS);

  // Compute 1h signal for each default symbol (using cached klines if available)
  const tickersWithSignals = await Promise.all(
    tickers.map(async (t) => {
      try {
        const { candles } = await getKlines(t.symbol, '1h', 100);
        const analysis = analyzeMarketData(t.symbol, '1h', candles);
        return {
          ...t,
          signal: analysis.summary.overallSignal,
          lastUpdated,
        };
      } catch {
        return {
          ...t,
          signal: 'محايد' as SignalType,
          lastUpdated,
        };
      }
    })
  );

  return tickersWithSignals;
}

/**
 * WebSocket Kline Broadcaster for SSE streaming
 */
export class BinanceStreamManager {
  private activeStreams = new Map<string, WebSocket>();
  private listeners = new Map<string, Set<(data: any) => void>>();

  public subscribe(symbol: string, interval: string, listener: (data: any) => void) {
    const key = `${symbol.toLowerCase()}@kline_${interval}`;

    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);

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

  private startBinanceWs(symbol: string, interval: string, key: string) {
    const url = `${WS_BASE_URL}/${key}`;
    try {
      const ws = new WebSocket(url);

      ws.on('open', () => {
        // Connected to Binance WS
      });

      ws.on('message', (data: Buffer | string) => {
        try {
          const parsed = JSON.parse(data.toString());
          if (parsed.e === 'kline') {
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
              lastUpdated: Date.now(),
            };

            const set = this.listeners.get(key);
            if (set) {
              set.forEach((cb) => cb(candleUpdate));
            }
          }
        } catch {
          // ignore parse error
        }
      });

      ws.on('error', () => {
        // will handle reconnect in close
      });

      ws.on('close', () => {
        this.activeStreams.delete(key);
        // Reconnect if listeners still exist
        if (this.listeners.has(key) && this.listeners.get(key)!.size > 0) {
          setTimeout(() => {
            if (this.listeners.has(key)) {
              this.startBinanceWs(symbol, interval, key);
            }
          }, 3000);
        }
      });

      this.activeStreams.set(key, ws);
    } catch {
      // WS initiation error
    }
  }
}

export const streamManager = new BinanceStreamManager();

export function getBinanceStatus() {
  return {
    lastContact: lastSuccessfulBinanceContact,
    lastError: lastBinanceError,
    primaryUrl: PRIMARY_BINANCE_URL,
    fallbackUrl: FALLBACK_BINANCE_URL,
  };
}
