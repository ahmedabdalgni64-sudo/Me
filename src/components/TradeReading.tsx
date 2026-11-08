import React from 'react';
import { TradeProposal } from '../types/market.js';
import { formatPrice } from '../utils/formatters.js';
import {
  Compass,
  ShieldAlert,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  CheckCircle,
  HelpCircle,
  TrendingUp,
  TrendingDown,
  Percent,
  BookMarked,
} from 'lucide-react';

interface TradeReadingProps {
  trade: TradeProposal;
  currentPrice: number;
  symbol?: string;
}

export const TradeReading: React.FC<TradeReadingProps> = ({ trade, currentPrice, symbol = 'BTCUSDT' }) => {
  const [savedFeedback, setSavedFeedback] = React.useState<string | null>(null);

  const handleSaveToJournal = async () => {
    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          direction: trade.direction,
          entryPrice: trade.entryPrice,
          stopLoss: trade.stopLoss,
          takeProfit: trade.takeProfit,
          quantity: 1,
          notes: trade.explanationAr,
          strategyUsed: 'قراءة الصفقة الآلية',
        }),
      });
      if (res.ok) {
        setSavedFeedback('تم حفظ الصفقة في السجل للمتابعة!');
        setTimeout(() => setSavedFeedback(null), 3000);
      }
    } catch {
      // ignore
    }
  };

  const {
    direction,
    isValid,
    entryPrice,
    stopLoss,
    takeProfit,
    riskRewardRatio,
    atr14,
    rejectionReason,
    explanationAr,
    confidence,
    trend,
    nearestSupports,
    nearestResistances,
  } = trade;

  const getConfidenceBadge = (c: 'عالية' | 'متوسطة' | 'منخفضة') => {
    switch (c) {
      case 'عالية':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
      case 'متوسطة':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/40';
      default:
        return 'bg-slate-700/60 text-slate-400 border-slate-600';
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-base">قراءة الصفقة الفنية الآلية</h3>
            <p className="text-xs text-slate-400">
              مبنية على Pivots لآخر 100 شمعة ومؤشر ATR(14) وميل المتوسطات
            </p>
          </div>
        </div>

        {/* Degree of Confidence */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">درجة الثقة:</span>
          <span className={`px-2.5 py-1 rounded-lg font-bold border ${getConfidenceBadge(confidence)}`}>
            {confidence}
          </span>
          <span className="text-slate-400 mr-2">الاتجاه العام:</span>
          <span
            className={`px-2.5 py-1 rounded-lg font-bold border ${
              trend === 'صاعد'
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                : trend === 'هابط'
                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}
          >
            {trend}
          </span>
        </div>
      </div>

      {/* Dynamic Arabic Explanation Banner */}
      <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 mt-0.5 flex-shrink-0">
            <HelpCircle className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-amber-400 block mb-1">
              القراءة التحليلية للمشهد:
            </span>
            <p className="text-sm text-slate-200 leading-relaxed font-sans">
              {explanationAr}
            </p>
          </div>
        </div>
      </div>

      {/* Supports & Resistances Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
        {/* Supports (الدعوم) */}
        <div className="bg-slate-950/60 border border-emerald-900/30 rounded-xl p-3.5">
          <div className="flex items-center justify-between text-emerald-400 mb-2 font-sans font-bold">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4" />
              أقرب مستويات الدعم (Pivots Low)
            </span>
            <span className="text-[11px] text-slate-500 font-normal">من آخر 100 شمعة</span>
          </div>
          <div className="space-y-1.5">
            {nearestSupports.slice(0, 2).map((sup, idx) => (
              <div
                key={`sup-${idx}`}
                className="flex items-center justify-between bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800"
              >
                <span className="text-slate-400 font-sans">دعم {idx + 1}:</span>
                <span className="text-emerald-300 font-bold">{formatPrice(sup)} USDT</span>
              </div>
            ))}
          </div>
        </div>

        {/* Resistances (المقاومات) */}
        <div className="bg-slate-950/60 border border-rose-900/30 rounded-xl p-3.5">
          <div className="flex items-center justify-between text-rose-400 mb-2 font-sans font-bold">
            <span className="flex items-center gap-1.5">
              <Target className="w-4 h-4" />
              أقرب مستويات المقاومة (Pivots High)
            </span>
            <span className="text-[11px] text-slate-500 font-normal">من آخر 100 شمعة</span>
          </div>
          <div className="space-y-1.5">
            {nearestResistances.slice(0, 2).map((res, idx) => (
              <div
                key={`res-${idx}`}
                className="flex items-center justify-between bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800"
              >
                <span className="text-slate-400 font-sans">مقاومة {idx + 1}:</span>
                <span className="text-rose-300 font-bold">{formatPrice(res)} USDT</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trade Proposal Card */}
      {isValid ? (
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-emerald-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-lg text-xs font-black bg-emerald-500 text-slate-950">
                اقتراح صفقة: {direction}
              </span>
              <span className="text-xs text-slate-400">
                قيمة ATR(14) الحالية: <strong className="text-slate-200 font-mono">{formatPrice(atr14)}</strong>
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/30">
              <Percent className="w-3.5 h-3.5" />
              <span>نسبة العائد/المخاطرة: 1:{riskRewardRatio}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-center">
            {/* Entry */}
            <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
              <span className="text-xs text-slate-400 block font-sans mb-1">سعر الدخول المقترح</span>
              <span className="text-base sm:text-lg font-bold text-white">
                {formatPrice(entryPrice)}
              </span>
              <span className="text-[11px] text-slate-500 block font-sans mt-0.5">السعر الحالي / أقرب دعم</span>
            </div>

            {/* Stop Loss */}
            <div className="bg-rose-950/20 border border-rose-800/40 p-3 rounded-xl">
              <span className="text-xs text-rose-300 block font-sans mb-1">وقف الخسارة (Stop Loss)</span>
              <span className="text-base sm:text-lg font-bold text-rose-400">
                {formatPrice(stopLoss)}
              </span>
              <span className="text-[11px] text-rose-400/80 block font-sans mt-0.5">
                الدعم - 1.5×ATR
              </span>
            </div>

            {/* Take Profit */}
            <div className="bg-emerald-950/20 border border-emerald-800/40 p-3 rounded-xl">
              <span className="text-xs text-emerald-300 block font-sans mb-1">الهدف (Take Profit)</span>
              <span className="text-base sm:text-lg font-bold text-emerald-400">
                {formatPrice(takeProfit)}
              </span>
              <span className="text-[11px] text-emerald-400/80 block font-sans mt-0.5">
                أقرب مستوى مقاومة
              </span>
            </div>
          </div>

          {/* Quick Action to Save in Journal */}
          <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-400">
              يمكنك حفظ هذه الصفقة لمتابعة نجاحها وربحها في سجل الصفقات تلقائياً.
            </span>
            <button
              onClick={handleSaveToJournal}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition flex items-center gap-1.5"
            >
              <BookMarked className="w-3.5 h-3.5" />
              <span>{savedFeedback || 'حفظ في سجل الصفقات'}</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-sm text-slate-200 block">
                لا توجد صفقة واضحة حالياً
              </span>
              <p className="text-xs text-slate-400 mt-0.5">
                {rejectionReason || 'نسبة العائد للمخاطرة أقل من 1:1.5 أو إشارة المؤشرات محايدة ومتضاربة'}
              </p>
            </div>
          </div>
          <span className="text-xs bg-slate-800 text-slate-400 px-3 py-1.5 rounded-lg border border-slate-700 whitespace-nowrap">
            الانتظار هو القرار الأنسب
          </span>
        </div>
      )}
    </div>
  );
};
