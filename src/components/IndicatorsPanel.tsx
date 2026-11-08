import React from 'react';
import { IndicatorValues, SignalSummary } from '../types/market.js';
import { formatPrice } from '../utils/formatters.js';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Layers,
  BarChart2,
  Sliders,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface IndicatorsPanelProps {
  indicators: IndicatorValues;
  summary: SignalSummary;
  currentPrice: number;
}

export const IndicatorsPanel: React.FC<IndicatorsPanelProps> = ({
  indicators,
  summary,
  currentPrice,
}) => {
  const { rsi, macd, ema, bollinger, stochastic } = indicators;

  // Signal Badge Helper
  const renderSignalBadge = (sig: 'شراء' | 'بيع' | 'محايد') => {
    switch (sig) {
      case 'شراء':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
            <TrendingUp className="w-3.5 h-3.5" />
            شراء
          </span>
        );
      case 'بيع':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40">
            <TrendingDown className="w-3.5 h-3.5" />
            بيع
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-700/60 text-slate-300 border border-slate-600">
            <HelpCircle className="w-3.5 h-3.5" />
            محايد
          </span>
        );
    }
  };

  // Color mapping for overall signal
  const getOverallBadge = (overall: string) => {
    switch (overall) {
      case 'شراء قوي':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500 shadow-emerald-500/20';
      case 'شراء':
        return 'bg-emerald-600/20 text-emerald-400 border-emerald-600/50';
      case 'بيع قوي':
        return 'bg-rose-500/20 text-rose-300 border-rose-500 shadow-rose-500/20';
      case 'بيع':
        return 'bg-rose-600/20 text-rose-400 border-rose-600/50';
      default:
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Top Summary Banner: Consensus Ratio & Signal Breakdown */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                الملخص الفني العام للمؤشرات
              </span>
              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                5 مؤشرات رئيسية
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`text-xl sm:text-2xl font-black px-4 py-1.5 rounded-xl border shadow-lg ${getOverallBadge(
                  summary.overallSignal
                )}`}
              >
                {summary.overallSignal}
              </span>
              <span className="text-base text-slate-200 font-bold">
                {summary.consensusRatio}
              </span>
            </div>
          </div>

          {/* Counts Progress & Visual Meter */}
          <div className="flex items-center gap-4 bg-slate-950/80 px-4 py-3 rounded-xl border border-slate-800">
            <div className="flex flex-col items-center">
              <span className="text-xs text-slate-400 font-medium">شراء</span>
              <span className="text-lg font-bold text-emerald-400 font-mono">
                {summary.buyCount}
              </span>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div className="flex flex-col items-center">
              <span className="text-xs text-slate-400 font-medium">محايد</span>
              <span className="text-lg font-bold text-slate-300 font-mono">
                {summary.neutralCount}
              </span>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div className="flex flex-col items-center">
              <span className="text-xs text-slate-400 font-medium">بيع</span>
              <span className="text-lg font-bold text-rose-400 font-mono">
                {summary.sellCount}
              </span>
            </div>

            {/* Proportion Bar */}
            <div className="w-28 h-2.5 bg-slate-800 rounded-full overflow-hidden flex ml-2">
              <div
                style={{ width: `${(summary.buyCount / 5) * 100}%` }}
                className="bg-emerald-500 transition-all duration-500"
                title={`${summary.buyCount} شراء`}
              />
              <div
                style={{ width: `${(summary.neutralCount / 5) * 100}%` }}
                className="bg-slate-500 transition-all duration-500"
                title={`${summary.neutralCount} محايد`}
              />
              <div
                style={{ width: `${(summary.sellCount / 5) * 100}%` }}
                className="bg-rose-500 transition-all duration-500"
                title={`${summary.sellCount} بيع`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Grid of the 5 Indicators with exact rules & live values */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. RSI (14) Card */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4.5 flex flex-col justify-between hover:border-slate-700 transition">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-100 text-sm">مؤشر القوة النسبية RSI</h4>
                  <span className="text-[11px] text-slate-400 font-mono">فترة 14</span>
                </div>
              </div>
              {renderSignalBadge(rsi.signal)}
            </div>

            <div className="my-3">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-2xl font-black font-mono text-white">
                  {rsi.value.toFixed(1)}
                </span>
                <span className="text-[11px] text-slate-400">
                  {rsi.value < 30 ? 'تشبع بيعي (<30)' : rsi.value > 70 ? 'تشبع شرائي (>70)' : 'نطاق متوازن (30-70)'}
                </span>
              </div>

              {/* Gauge Bar */}
              <div className="relative w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                {/* Zone markers */}
                <div className="absolute left-[30%] top-0 bottom-0 w-0.5 bg-emerald-500/60 z-10" />
                <div className="absolute left-[70%] top-0 bottom-0 w-0.5 bg-rose-500/60 z-10" />
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    rsi.value < 30 ? 'bg-emerald-500' : rsi.value > 70 ? 'bg-rose-500' : 'bg-indigo-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, rsi.value))}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1 px-0.5">
                <span>0 (شراء &lt;30)</span>
                <span>50</span>
                <span>100 (بيع &gt;70)</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-300/90 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed">
            {rsi.interpretation}
          </p>
        </div>

        {/* 2. MACD (12, 26, 9) Card */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4.5 flex flex-col justify-between hover:border-slate-700 transition">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
                  <BarChart2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-100 text-sm">مؤشر الماكد MACD</h4>
                  <span className="text-[11px] text-slate-400 font-mono">(12, 26, 9)</span>
                </div>
              </div>
              {renderSignalBadge(macd.signal)}
            </div>

            <div className="my-3 space-y-1.5 font-mono text-xs">
              <div className="flex justify-between items-center bg-slate-950/60 px-2.5 py-1 rounded-lg">
                <span className="text-slate-400 font-sans">خط الماكد (MACD):</span>
                <span className={`font-bold ${macd.macd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {macd.macd.toFixed(3)}
                </span>
              </div>
              <div className="flex justify-between items-center bg-slate-950/60 px-2.5 py-1 rounded-lg">
                <span className="text-slate-400 font-sans">خط الإشارة (Signal):</span>
                <span className="text-slate-200 font-semibold">{macd.signalLine.toFixed(3)}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-950/60 px-2.5 py-1 rounded-lg">
                <span className="text-slate-400 font-sans">الهيستوغرام (Histogram):</span>
                <span className={`font-bold ${macd.histogram >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {macd.histogram > 0 ? `+${macd.histogram.toFixed(3)}` : macd.histogram.toFixed(3)}
                </span>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-300/90 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed">
            {macd.interpretation}
          </p>
        </div>

        {/* 3. EMA 20 & EMA 50 Card */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4.5 flex flex-col justify-between hover:border-slate-700 transition">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-100 text-sm">المتوسطات المتحركة EMA</h4>
                  <span className="text-[11px] text-slate-400 font-mono">EMA 20 & EMA 50</span>
                </div>
              </div>
              {renderSignalBadge(ema.signal)}
            </div>

            <div className="my-3 space-y-1.5 font-mono text-xs">
              <div className="flex justify-between items-center bg-slate-950/60 px-2.5 py-1 rounded-lg">
                <span className="text-slate-400 font-sans">السعر الحالي:</span>
                <span className="text-white font-bold">{formatPrice(currentPrice)}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-950/60 px-2.5 py-1 rounded-lg">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span className="text-slate-400 font-sans">EMA 20:</span>
                </div>
                <span className="text-amber-300 font-semibold">{formatPrice(ema.ema20)}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-950/60 px-2.5 py-1 rounded-lg">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-violet-400"></span>
                  <span className="text-slate-400 font-sans">EMA 50:</span>
                </div>
                <span className="text-violet-300 font-semibold">{formatPrice(ema.ema50)}</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-300/90 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed">
            {ema.interpretation}
          </p>
        </div>

        {/* 4. Bollinger Bands (20, 2) Card */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4.5 flex flex-col justify-between hover:border-slate-700 transition">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-teal-500/10 text-teal-400">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-100 text-sm">أشرطة بولينجر باندز</h4>
                  <span className="text-[11px] text-slate-400 font-mono">فترة 20 ، انحراف 2</span>
                </div>
              </div>
              {renderSignalBadge(bollinger.signal)}
            </div>

            <div className="my-3 space-y-1.5 font-mono text-xs">
              <div className="flex justify-between items-center bg-slate-950/60 px-2.5 py-1 rounded-lg">
                <span className="text-slate-400 font-sans">الحد العلوي:</span>
                <span className="text-rose-400 font-semibold">{formatPrice(bollinger.upper)}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-950/60 px-2.5 py-1 rounded-lg">
                <span className="text-slate-400 font-sans">الخط الأوسط (SMA20):</span>
                <span className="text-sky-300 font-semibold">{formatPrice(bollinger.middle)}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-950/60 px-2.5 py-1 rounded-lg">
                <span className="text-slate-400 font-sans">الحد السفلي:</span>
                <span className="text-emerald-400 font-semibold">{formatPrice(bollinger.lower)}</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-300/90 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed">
            {bollinger.interpretation}
          </p>
        </div>

        {/* 5. Stochastic (14, 3, 3) Card */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4.5 flex flex-col justify-between hover:border-slate-700 transition">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-100 text-sm">مؤشر ستوكاستيك</h4>
                  <span className="text-[11px] text-slate-400 font-mono">(14, 3, 3)</span>
                </div>
              </div>
              {renderSignalBadge(stochastic.signal)}
            </div>

            <div className="my-3 space-y-2">
              <div className="flex justify-between items-center font-mono text-xs">
                <div>
                  <span className="text-slate-400 font-sans ml-1">%K السريع:</span>
                  <span className="font-bold text-purple-300 text-base">{stochastic.k.toFixed(1)}</span>
                </div>
                <div>
                  <span className="text-slate-400 font-sans ml-1">%D البطيء:</span>
                  <span className="font-bold text-slate-200 text-base">{stochastic.d.toFixed(1)}</span>
                </div>
              </div>

              {/* Gauge */}
              <div className="relative w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div className="absolute left-[20%] top-0 bottom-0 w-0.5 bg-emerald-500/60 z-10" />
                <div className="absolute left-[80%] top-0 bottom-0 w-0.5 bg-rose-500/60 z-10" />
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    stochastic.k < 20 ? 'bg-emerald-500' : stochastic.k > 80 ? 'bg-rose-500' : 'bg-purple-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, stochastic.k))}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 font-mono px-0.5">
                <span>0 (شراء &lt;20)</span>
                <span>50</span>
                <span>100 (بيع &gt;80)</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-300/90 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed">
            {stochastic.interpretation}
          </p>
        </div>

        {/* Rules Reference Box */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 border border-slate-800/90 rounded-2xl p-4.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2 text-slate-300">
              <CheckCircle2 className="w-4 h-4 text-amber-400" />
              <h4 className="font-bold text-sm">قواعد الإشارة المعتمدة</h4>
            </div>
            <ul className="text-[11px] text-slate-400 space-y-1.5 list-disc list-inside">
              <li><strong className="text-slate-200">RSI(14):</strong> &lt; 30 شراء | &gt; 70 بيع</li>
              <li><strong className="text-slate-200">MACD:</strong> خط الماكد أعلى من الإشارة شراء</li>
              <li><strong className="text-slate-200">EMA:</strong> السعر &gt; EMA20 &gt; EMA50 شراء</li>
              <li><strong className="text-slate-200">بولينجر:</strong> السعر عند/تحت السفلي شراء</li>
              <li><strong className="text-slate-200">ستوكاستيك:</strong> &lt; 20 شراء | &gt; 80 بيع</li>
            </ul>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-800 text-[11px] text-amber-400/90 flex items-center gap-1.5 font-medium">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>يتم التحديث وإعادة الحساب تلقائياً مع كل شمعة</span>
          </div>
        </div>
      </div>
    </div>
  );
};
