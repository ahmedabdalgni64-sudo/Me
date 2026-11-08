import React, { useState } from 'react';
import { SignalType, TickerData } from '../types/market.js';
import { ASSET_ARABIC_NAMES, formatPercent, formatPrice, formatTimeAgo, formatVolume } from '../utils/formatters.js';
import { QuickAlertModal } from './QuickAlertModal.js';
import {
  Search,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Zap,
  Bell,
} from 'lucide-react';

interface WatchlistProps {
  tickers: TickerData[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  isLoading: boolean;
  onRefresh: () => void;
  lastUpdated: number;
  availablePairs?: string[];
}

export const Watchlist: React.FC<WatchlistProps> = ({
  tickers,
  selectedSymbol,
  onSelectSymbol,
  isLoading,
  onRefresh,
  lastUpdated,
  availablePairs = [],
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [alertModalTicker, setAlertModalTicker] = useState<TickerData | null>(null);

  const filteredTickers = tickers.filter((t) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const arabic = (ASSET_ARABIC_NAMES[t.baseAsset] || '').toLowerCase();
    return (
      t.symbol.toLowerCase().includes(q) ||
      t.baseAsset.toLowerCase().includes(q) ||
      arabic.includes(q)
    );
  });

  const getSignalBadge = (signal?: SignalType) => {
    if (!signal) return null;
    switch (signal) {
      case 'شراء قوي':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm shadow-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            شراء قوي
          </span>
        );
      case 'شراء':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600/20 text-emerald-400 border border-emerald-600/40">
            شراء
          </span>
        );
      case 'بيع قوي':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-500/20 text-rose-300 border border-rose-500/50 shadow-sm shadow-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse"></span>
            بيع قوي
          </span>
        );
      case 'بيع':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-600/20 text-rose-400 border border-rose-600/40">
            بيع
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
            محايد
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Search & Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-slate-900/90 border border-slate-800 p-3 sm:p-3.5 rounded-2xl shadow-lg">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن أصل (BTC, إيثيريوم, SOL...)"
            className="w-full min-h-[44px] bg-slate-950/80 border border-slate-800 rounded-xl pr-10 pl-4 py-2.5 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500/60 transition"
          />
        </div>

        {/* Refresh & Last Updated Status */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="text-[11px] sm:text-xs text-slate-400 hidden sm:flex items-center gap-1.5 font-mono">
            <span>آخر تحديث:</span>
            <span className="text-slate-200 font-semibold">{formatTimeAgo(lastUpdated)}</span>
          </div>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="min-h-[44px] flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
            <span>تحديث</span>
          </button>
        </div>
      </div>

      {/* Quick Pair Selector Pills for Default Coins (Touch target >= 44px) */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 text-xs -mx-1 px-1">
        <span className="text-slate-400 text-xs font-medium whitespace-nowrap pl-1 shrink-0">
          الأصول الافتراضية:
        </span>
        {['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'TONUSDT'].map(
          (sym) => {
            const base = sym.replace('USDT', '');
            const isSelected = selectedSymbol === sym;
            return (
              <button
                key={sym}
                onClick={() => onSelectSymbol(sym)}
                className={`min-h-[44px] px-3.5 py-2.5 rounded-xl font-mono text-xs font-semibold whitespace-nowrap shrink-0 transition flex items-center gap-1.5 border ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20 font-bold'
                    : 'bg-slate-900/90 hover:bg-slate-850 border-slate-800 text-slate-300'
                }`}
              >
                <span>{base}</span>
                <span className="text-[10px] opacity-80 font-sans">
                  {ASSET_ARABIC_NAMES[base] || ''}
                </span>
              </button>
            );
          }
        )}
      </div>

      {/* MOBILE CARD VIEW (< md, 360px-400px optimized, 100% responsive, no overflow) */}
      <div className="md:hidden flex flex-col gap-3">
        {filteredTickers.map((ticker) => {
          const isSelected = selectedSymbol === ticker.symbol;
          const isPositive = ticker.priceChangePercent24h >= 0;
          const arabicName = ASSET_ARABIC_NAMES[ticker.baseAsset] || ticker.baseAsset;

          return (
            <div
              key={ticker.symbol}
              onClick={() => onSelectSymbol(ticker.symbol)}
              className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-3 shadow-md ${
                isSelected
                  ? 'bg-amber-500/10 border-amber-500/50 shadow-amber-500/10'
                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Card Header: Asset Logo + Name & Signal Badge */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center font-bold text-amber-400 font-mono text-xs shrink-0">
                    {ticker.baseAsset.slice(0, 3)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-100 font-mono tracking-wide text-sm truncate">
                        {ticker.symbol}
                      </span>
                      <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono shrink-0">
                        Spot
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-sans block truncate">
                      {arabicName}
                    </span>
                  </div>
                </div>

                {/* Technical Signal Badge on Mobile Card */}
                <div className="shrink-0">
                  {getSignalBadge(ticker.signal)}
                </div>
              </div>

              {/* Price & 24h Change Row */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                <div>
                  <span className="text-[10px] text-slate-400 block">السعر الفوري (USDT):</span>
                  <span className="text-base font-black font-mono text-white">
                    ${formatPrice(ticker.price)}
                  </span>
                </div>

                <div className="text-left">
                  <span className="text-[10px] text-slate-400 block">تغير 24 ساعة:</span>
                  <div
                    className={`inline-flex items-center gap-1 font-bold text-xs px-2 py-1 rounded-lg font-mono ${
                      isPositive
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                    }`}
                  >
                    {isPositive ? (
                      <TrendingUp className="w-3.5 h-3.5" />
                    ) : (
                      <TrendingDown className="w-3.5 h-3.5" />
                    )}
                    <span>{formatPercent(ticker.priceChangePercent24h)}</span>
                  </div>
                </div>
              </div>

              {/* High / Low / Volume Strip */}
              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 bg-slate-950/60 p-2 rounded-xl">
                <span>أعلى: <strong className="text-emerald-400">${formatPrice(ticker.high24h)}</strong></span>
                <span>•</span>
                <span>أدنى: <strong className="text-rose-400">${formatPrice(ticker.low24h)}</strong></span>
                <span>•</span>
                <span>حجم: <strong className="text-slate-200">{formatVolume(ticker.volume24h)}</strong></span>
              </div>

              {/* Mobile Card Action Buttons (Min 44px Touch Target) */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectSymbol(ticker.symbol);
                  }}
                  className={`flex-1 min-h-[44px] px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/20'
                      : 'bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700'
                  }`}
                >
                  <span>عرض الرسم والتحليل</span>
                  <ArrowRight className="w-4 h-4 rotate-180" />
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAlertModalTicker(ticker);
                  }}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-800 hover:bg-amber-500/20 text-slate-400 hover:text-amber-400 border border-slate-700 transition"
                  title={`إضافة تنبيه سعر لـ ${ticker.symbol}`}
                >
                  <Bell className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* DESKTOP TABLE VIEW (>= md, full multi-column layout) */}
      <div className="hidden md:block bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs sm:text-sm">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-semibold text-xs">
              <tr>
                <th className="py-3 px-4">الأصل</th>
                <th className="py-3 px-4">السعر الفوري (USDT)</th>
                <th className="py-3 px-4">تغير 24 ساعة</th>
                <th className="py-3 px-4 hidden md:table-cell">أعلى / أدنى 24س</th>
                <th className="py-3 px-4 hidden lg:table-cell">حجم التداول</th>
                <th className="py-3 px-4">الإشارة الفنية (1h)</th>
                <th className="py-3 px-4 text-left">التفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredTickers.map((ticker) => {
                const isSelected = selectedSymbol === ticker.symbol;
                const isPositive = ticker.priceChangePercent24h >= 0;
                const arabicName = ASSET_ARABIC_NAMES[ticker.baseAsset] || ticker.baseAsset;

                return (
                  <tr
                    key={ticker.symbol}
                    onClick={() => onSelectSymbol(ticker.symbol)}
                    className={`cursor-pointer transition-colors group ${
                      isSelected ? 'bg-amber-500/10' : 'hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Asset Name & Icon */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center font-bold text-amber-400 font-mono text-sm">
                          {ticker.baseAsset.slice(0, 3)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-100 font-mono tracking-wide">
                              {ticker.symbol}
                            </span>
                            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                              Spot
                            </span>
                          </div>
                          <span className="text-xs text-slate-400 font-sans">
                            {arabicName}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Real-time Price */}
                    <td className="py-3.5 px-4 font-mono">
                      <div className="text-sm sm:text-base font-bold text-white">
                        ${formatPrice(ticker.price)}
                      </div>
                    </td>

                    {/* 24h Change */}
                    <td className="py-3.5 px-4 font-mono">
                      <div
                        className={`inline-flex items-center gap-1 font-bold text-xs sm:text-sm px-2 py-0.5 rounded-lg ${
                          isPositive
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-rose-500/10 text-rose-400'
                        }`}
                      >
                        {isPositive ? (
                          <TrendingUp className="w-3.5 h-3.5" />
                        ) : (
                          <TrendingDown className="w-3.5 h-3.5" />
                        )}
                        <span>{formatPercent(ticker.priceChangePercent24h)}</span>
                      </div>
                    </td>

                    {/* High / Low */}
                    <td className="py-3.5 px-4 font-mono hidden md:table-cell text-xs">
                      <div className="text-emerald-400/90 font-medium">
                        أعلى: {formatPrice(ticker.high24h)}
                      </div>
                      <div className="text-rose-400/90 font-medium">
                        أدنى: {formatPrice(ticker.low24h)}
                      </div>
                    </td>

                    {/* Volume */}
                    <td className="py-3.5 px-4 font-mono hidden lg:table-cell text-xs text-slate-300">
                      {formatVolume(ticker.volume24h)} {ticker.baseAsset}
                    </td>

                    {/* Signal Badge */}
                    <td className="py-3.5 px-4">
                      {getSignalBadge(ticker.signal)}
                    </td>

                    {/* Action button & Quick Alert */}
                    <td className="py-3.5 px-4 text-left">
                      <div className="flex items-center gap-1.5 justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAlertModalTicker(ticker);
                          }}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-slate-800 hover:bg-amber-500/20 text-slate-400 hover:text-amber-400 border border-slate-700 hover:border-amber-500/40 transition"
                          title={`إضافة تنبيه سعر لـ ${ticker.symbol}`}
                        >
                          <Bell className="w-4 h-4" />
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectSymbol(ticker.symbol);
                          }}
                          className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-amber-500 text-slate-950 font-black'
                              : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                          }`}
                        >
                          <span>قراءة الأصل</span>
                          <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredTickers.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <p className="text-sm font-medium">لم يتم العثور على أصل يطابق بحثك</p>
            <p className="text-xs text-slate-500 mt-1">تأكد من كتابة الرمز أو الاسم بشكل صحيح</p>
          </div>
        )}
      </div>

      {/* Quick Alert Modal */}
      {alertModalTicker && (
        <QuickAlertModal
          isOpen={Boolean(alertModalTicker)}
          onClose={() => setAlertModalTicker(null)}
          symbol={alertModalTicker.symbol}
          currentPrice={alertModalTicker.price}
        />
      )}
    </div>
  );
};
