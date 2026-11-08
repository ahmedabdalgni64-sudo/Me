import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FullAnalysis, Timeframe, TimeframeSignalItem } from '../types/market.js';
import { PriceAlert } from '../types/journal.js';
import { ASSET_ARABIC_NAMES, formatPercent, formatPrice, formatTimeAgo, formatVolume } from '../utils/formatters.js';
import { CandleChart } from './CandleChart.js';
import { IndicatorsPanel } from './IndicatorsPanel.js';
import { TimeframeMatrix } from './TimeframeMatrix.js';
import { TradeReading } from './TradeReading.js';
import { TradingPanel } from './TradingPanel.js';
import { QuickAlertModal } from './QuickAlertModal.js';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Clock,
  Wifi,
  WifiOff,
  AlertTriangle,
  ArrowRight,
  ShieldAlert,
  Layers,
  Bell,
} from 'lucide-react';

interface AssetDetailProps {
  symbol: string;
  onBackToWatchlist: () => void;
}

export const AssetDetail: React.FC<AssetDetailProps> = ({
  symbol,
  onBackToWatchlist,
}) => {
  const [interval, setInterval] = useState<Timeframe>('1h');
  const [analysis, setAnalysis] = useState<FullAnalysis | null>(null);
  const [timeframeData, setTimeframeData] = useState<TimeframeSignalItem[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isError, setIsError] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<number>(0);

  const eventSourceRef = useRef<EventSource | null>(null);

  // Fetch full analysis for current symbol and timeframe
  const fetchAnalysis = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const res = await fetch(`/api/analysis?symbol=${symbol}&interval=${interval}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `خطأ في استجابة الخادم (${res.status})`);
      }
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'تعذر حساب التحليل الفني');
      }

      setAnalysis(data.data);
      setLastUpdated(data.data.lastUpdated || Date.now());
      setIsConnected(true);
      setIsError(false);
    } catch (err: any) {
      setIsError(true);
      setIsConnected(false);
      setErrorMessage(err.message || 'تعذر الاتصال ببيانات منصة بينانس');
    } finally {
      setIsLoading(false);
    }
  }, [symbol, interval]);

  // Fetch timeframes summary (15m, 1h, 4h, 1d)
  const fetchTimeframeMatrix = useCallback(async () => {
    try {
      const res = await fetch(`/api/timeframes-summary?symbol=${symbol}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setTimeframeData(data.data);
        }
      }
    } catch {
      // ignore non-fatal matrix fetch error
    }
  }, [symbol]);

  // Fetch active alerts
  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setAlerts(json.data);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const handleDeleteAlert = async (id: string) => {
    try {
      await fetch(`/api/alerts?id=${id}`, { method: 'DELETE' });
      fetchAlerts();
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchAnalysis();
    fetchTimeframeMatrix();
    fetchAlerts();
  }, [fetchAnalysis, fetchTimeframeMatrix, fetchAlerts]);

  // Real-time live updates via Server-Sent Events (SSE)
  useEffect(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const sse = new EventSource(`/api/stream?symbol=${symbol}&interval=${interval}`);
    eventSourceRef.current = sse;

    sse.onopen = () => {
      setIsConnected(true);
    };

    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'kline') {
          // Update last candle or re-fetch analysis if candle closed
          setAnalysis((prev) => {
            if (!prev) return prev;
            const updatedCandles = [...prev.candles];
            const lastCandle = updatedCandles[updatedCandles.length - 1];

            if (lastCandle && lastCandle.time === data.time) {
              updatedCandles[updatedCandles.length - 1] = {
                ...lastCandle,
                high: Math.max(lastCandle.high, data.high),
                low: Math.min(lastCandle.low, data.low),
                close: data.close,
                volume: data.volume,
              };
            } else if (lastCandle && data.time > lastCandle.time) {
              updatedCandles.push({
                time: data.time,
                open: data.open,
                high: data.high,
                low: data.low,
                close: data.close,
                volume: data.volume,
                closeTime: data.closeTime,
              });
            }

            return {
              ...prev,
              currentPrice: data.close,
              lastUpdated: Date.now(),
              candles: updatedCandles,
            };
          });

          // If candle is closed, refresh complete indicators calculation
          if (data.isClosed) {
            fetchAnalysis();
            fetchTimeframeMatrix();
          }
        }
      } catch {
        // ignore parse error
      }
    };

    sse.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      sse.close();
    };
  }, [symbol, interval, fetchAnalysis, fetchTimeframeMatrix]);

  const baseAsset = symbol.replace('USDT', '');
  const arabicName = ASSET_ARABIC_NAMES[baseAsset] || baseAsset;

  const isPositive = (analysis?.priceChangePercent24h ?? 0) >= 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Top Navigation & Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 p-4 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToWatchlist}
            className="min-h-[44px] flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة للمتابعة</span>
          </button>

          <div className="h-6 w-px bg-slate-800 hidden sm:block" />

          {/* Asset Title */}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center font-bold text-amber-400 font-mono text-base">
              {baseAsset.slice(0, 3)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-white font-mono tracking-wide">
                  {symbol}
                </h1>
                <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                  Binance Spot
                </span>
              </div>
              <span className="text-xs text-slate-400 font-sans">
                {arabicName} / تيثر دولار
              </span>
            </div>
          </div>
        </div>

        {/* Live Price & 24h Change */}
        {analysis && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <div className="text-right">
              <div className="text-xl sm:text-2xl font-black font-mono text-white">
                ${formatPrice(analysis.currentPrice)}
              </div>
              <div
                className={`text-xs font-mono font-bold flex items-center gap-1 justify-end ${
                  isPositive ? 'text-emerald-400' : 'text-rose-400'
                }`}
              >
                {isPositive ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                <span>
                  {formatPercent(analysis.priceChangePercent24h)} ($
                  {formatPrice(analysis.priceChange24h)})
                </span>
              </div>
            </div>

            {/* Quick Price Alert Button */}
            <button
              onClick={() => setIsAlertModalOpen(true)}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              title="إضافة تنبيه سعر للعملة"
            >
              <Bell className="w-4 h-4 fill-current" />
              <span>تنبيه سعر</span>
            </button>

            {/* Timeframe selector buttons */}
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              {(['15m', '1h', '4h', '1d'] as Timeframe[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setInterval(tf)}
                  className={`min-h-[44px] px-3 py-2 rounded-lg text-xs font-mono font-bold transition ${
                    interval === tf
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>

            {/* Refresh / Status */}
            <button
              onClick={() => {
                fetchAnalysis();
                fetchTimeframeMatrix();
              }}
              disabled={isLoading}
              className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center justify-center"
              title="تحديث البيانات"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {/* Connection & Update status notice */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs px-2 text-slate-400">
        <div className="flex items-center gap-2">
          {isConnected ? (
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <Wifi className="w-3.5 h-3.5" />
              <span>اتصال مباشر بـ Binance WebSocket</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-rose-400 font-medium">
              <WifiOff className="w-3.5 h-3.5" />
              <span>انقطع الاتصال اللحظي</span>
            </span>
          )}
          <span>•</span>
          <span className="font-mono">
            آخر تحديث {formatTimeAgo(lastUpdated)}
          </span>
          {analysis?.cached && (
            <span className="text-[11px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
              مخزن مؤقتاً (5 ثوانٍ للحماية)
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 font-mono text-xs">
          {analysis && (
            <>
              <span className="text-slate-400">
                أعلى 24س: <strong className="text-slate-200">${formatPrice(analysis.high24h)}</strong>
              </span>
              <span>•</span>
              <span className="text-slate-400">
                أدنى 24س: <strong className="text-slate-200">${formatPrice(analysis.low24h)}</strong>
              </span>
              <span>•</span>
              <span className="text-slate-400">
                الحجم: <strong className="text-slate-200">{formatVolume(analysis.volume24h)} {baseAsset}</strong>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Offline Error Screen (Never shows fake data) */}
      {isError && !analysis && (
        <div className="bg-rose-950/20 border border-rose-800/40 rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-3">
          <AlertTriangle className="w-10 h-10 text-rose-400" />
          <h3 className="text-lg font-bold text-slate-100">
            تعذر الاتصال ببيانات منصة بينانس
          </h3>
          <p className="text-sm text-slate-400 max-w-md">
            {errorMessage || 'يرجى التحقق من اتصال الشبكة وإعادة المحاولة. لا نعرض أي أرقام وهمية أو تجريبية.'}
          </p>
          <div className="text-xs text-slate-400 mt-2">
            آخر محاولة اتصال: {formatTimeAgo(lastUpdated)}
          </div>
          <button
            onClick={() => {
              fetchAnalysis();
              fetchTimeframeMatrix();
            }}
            className="mt-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>إعادة المحاولة</span>
          </button>
        </div>
      )}

      {/* Loading Skeleton */}
      {isLoading && !analysis && (
        <div className="space-y-4 animate-pulse">
          <div className="h-96 bg-slate-900 rounded-2xl border border-slate-800" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-44 bg-slate-900 rounded-2xl border border-slate-800" />
            <div className="h-44 bg-slate-900 rounded-2xl border border-slate-800" />
            <div className="h-44 bg-slate-900 rounded-2xl border border-slate-800" />
          </div>
        </div>
      )}

      {/* Main Content when Analysis is Loaded */}
      {analysis && (
        <div className="space-y-6">
          {/* 1. Candlestick Chart (with EMA, Bollinger, Pivots & Interactive Alerts) */}
          <CandleChart
            candles={analysis.candles}
            ema20Series={analysis.series.ema20}
            ema50Series={analysis.series.ema50}
            bollingerUpper={analysis.series.bollingerUpper}
            bollingerMiddle={analysis.series.bollingerMiddle}
            bollingerLower={analysis.series.bollingerLower}
            symbol={symbol}
            interval={interval}
            currentPrice={analysis.currentPrice}
            nearestSupports={analysis.trade.nearestSupports}
            nearestResistances={analysis.trade.nearestResistances}
            alerts={alerts}
            onDeleteAlert={handleDeleteAlert}
            onQuickAlertCreated={(newAlert) => setAlerts((prev) => [newAlert, ...prev])}
          />

          {/* 2. Indicators & Consensus Summary Panel */}
          <IndicatorsPanel
            indicators={analysis.indicators}
            summary={analysis.summary}
            currentPrice={analysis.currentPrice}
          />

          {/* 3. Multi-Timeframe Matrix (15m, 1h, 4h, 1d) */}
          <TimeframeMatrix
            timeframeData={timeframeData}
            activeTimeframe={interval}
            onSelectTimeframe={(tf) => setInterval(tf)}
          />

          {/* 4. Full Trade Reading (Trend, S/R Pivots, ATR Risk/Reward Proposal, Arabic Narrative) */}
          <TradeReading
            trade={analysis.trade}
            currentPrice={analysis.currentPrice}
            symbol={symbol}
          />

          {/* 5. Live / Paper Trading Execution Panel */}
          <TradingPanel
            symbol={symbol}
            currentPrice={analysis.currentPrice}
            proposedTrade={{
              direction: analysis.trade.direction,
              entryPrice: analysis.trade.entryPrice,
              stopLoss: analysis.trade.stopLoss,
              takeProfit: analysis.trade.takeProfit,
            }}
            onOrderExecuted={() => {
              fetchAnalysis();
            }}
          />
        </div>
      )}

      {/* Quick Alert Modal */}
      {analysis && (
        <QuickAlertModal
          isOpen={isAlertModalOpen}
          onClose={() => setIsAlertModalOpen(false)}
          symbol={symbol}
          currentPrice={analysis.currentPrice}
          nearestSupports={analysis.trade.nearestSupports}
          nearestResistances={analysis.trade.nearestResistances}
          onAlertCreated={(newAlert) => setAlerts((prev) => [newAlert, ...prev])}
        />
      )}
    </div>
  );
};
