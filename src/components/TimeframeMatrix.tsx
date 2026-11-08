import React from 'react';
import { Timeframe, TimeframeSignalItem } from '../types/market.js';
import { formatPrice } from '../utils/formatters.js';
import { Clock, TrendingUp, TrendingDown, ArrowRightLeft, Sparkles } from 'lucide-react';

interface TimeframeMatrixProps {
  timeframeData: TimeframeSignalItem[];
  activeTimeframe: Timeframe;
  onSelectTimeframe: (tf: Timeframe) => void;
  isLoading?: boolean;
}

export const TimeframeMatrix: React.FC<TimeframeMatrixProps> = ({
  timeframeData,
  activeTimeframe,
  onSelectTimeframe,
  isLoading = false,
}) => {
  const getArabicTfName = (tf: Timeframe) => {
    switch (tf) {
      case '15m':
        return '15 دقيقة (مضاربة لحظية)';
      case '1h':
        return 'ساعة واحدة (يومي قصير)';
      case '4h':
        return '4 ساعات (متوسط الأجل)';
      case '1d':
        return 'يومي (سوينغ واستراتيجي)';
    }
  };

  const getSignalBadgeClass = (signal: string) => {
    switch (signal) {
      case 'شراء قوي':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50';
      case 'شراء':
        return 'bg-emerald-600/20 text-emerald-400 border-emerald-600/40';
      case 'بيع قوي':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/50';
      case 'بيع':
        return 'bg-rose-600/20 text-rose-400 border-rose-600/40';
      default:
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    }
  };

  const getTrendIcon = (trend: 'صاعد' | 'هابط' | 'عرضي') => {
    switch (trend) {
      case 'صاعد':
        return (
          <span className="flex items-center gap-1 text-emerald-400 text-xs font-semibold">
            <TrendingUp className="w-3.5 h-3.5" />
            صاعد
          </span>
        );
      case 'هابط':
        return (
          <span className="flex items-center gap-1 text-rose-400 text-xs font-semibold">
            <TrendingDown className="w-3.5 h-3.5" />
            هابط
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1 text-slate-400 text-xs font-semibold">
            <ArrowRightLeft className="w-3.5 h-3.5" />
            عرضي
          </span>
        );
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-base">ملخص الإشارات عبر الأطر الأربعة</h3>
            <p className="text-xs text-slate-400">توافق الاتجاه بين المضاربة اللحظية والاستثمار اليومي</p>
          </div>
        </div>
        <span className="text-xs font-mono bg-slate-800 text-slate-300 px-2.5 py-1 rounded-lg">
          15m • 1h • 4h • 1d
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-right text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 text-xs font-semibold">
              <th className="pb-3 pr-2">الإطار الزمني</th>
              <th className="pb-3 px-3">الإشارة الفنية</th>
              <th className="pb-3 px-3">ميزان القوى (شراء : بيع)</th>
              <th className="pb-3 px-3">مؤشر RSI</th>
              <th className="pb-3 px-3">الاتجاه العام</th>
              <th className="pb-3 pl-2 text-left">الإجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {timeframeData.map((item) => {
              const isActive = activeTimeframe === item.timeframe;
              return (
                <tr
                  key={item.timeframe}
                  onClick={() => onSelectTimeframe(item.timeframe)}
                  className={`cursor-pointer transition-colors ${
                    isActive ? 'bg-amber-500/10' : 'hover:bg-slate-800/40'
                  }`}
                >
                  <td className="py-3.5 pr-2 font-mono">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded font-bold text-xs ${
                        isActive ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-200'
                      }`}>
                        {item.timeframe}
                      </span>
                      <span className="text-slate-400 text-xs hidden sm:inline">
                        {getArabicTfName(item.timeframe)}
                      </span>
                    </div>
                  </td>

                  <td className="py-3.5 px-3">
                    <span
                      className={`inline-block px-3 py-1 rounded-lg font-bold text-xs border ${getSignalBadgeClass(
                        item.signal
                      )}`}
                    >
                      {item.signal}
                    </span>
                  </td>

                  <td className="py-3.5 px-3 font-mono">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-bold">{item.buyCount} شراء</span>
                      <span className="text-slate-600">:</span>
                      <span className="text-rose-400 font-bold">{item.sellCount} بيع</span>
                    </div>
                  </td>

                  <td className="py-3.5 px-3 font-mono">
                    <span className={`font-semibold ${
                      item.rsi < 30 ? 'text-emerald-400' : item.rsi > 70 ? 'text-rose-400' : 'text-slate-300'
                    }`}>
                      {item.rsi ? item.rsi.toFixed(1) : '-'}
                    </span>
                  </td>

                  <td className="py-3.5 px-3">
                    {getTrendIcon(item.trend)}
                  </td>

                  <td className="py-3.5 pl-2 text-left">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTimeframe(item.timeframe);
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                        isActive
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                    >
                      {isActive ? 'الإطار الحالي' : 'عرض الرسم'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
