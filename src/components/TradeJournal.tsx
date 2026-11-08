import React, { useState, useEffect, useCallback } from 'react';
import { JournalTrade, JournalTradeStatus } from '../types/journal.js';
import { formatPercent, formatPrice, formatTimeAgo } from '../utils/formatters.js';
import {
  BookOpen,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  Target,
  ShieldAlert,
  Percent,
  DollarSign,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
} from 'lucide-react';

export const TradeJournal: React.FC = () => {
  const [trades, setTrades] = useState<JournalTrade[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // New trade state
  const [symbol, setSymbol] = useState<string>('BTCUSDT');
  const [direction, setDirection] = useState<'شراء' | 'بيع'>('شراء');
  const [entryPrice, setEntryPrice] = useState<string>('');
  const [stopLoss, setStopLoss] = useState<string>('');
  const [takeProfit, setTakeProfit] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [notes, setNotes] = useState<string>('');
  const [strategyUsed, setStrategyUsed] = useState<string>('توافق المؤشرات 4 من 5');

  const fetchJournal = useCallback(async () => {
    try {
      const res = await fetch('/api/journal');
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setTrades(json.data);
          setStats(json.stats);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJournal();
    const interval = setInterval(fetchJournal, 10000);
    return () => clearInterval(interval);
  }, [fetchJournal]);

  const handleAddTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryPrice || !stopLoss || !takeProfit) {
      alert('يرجى ملء سعر الدخول ووقف الخسارة والهدف');
      return;
    }

    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          direction,
          entryPrice: Number(entryPrice),
          stopLoss: Number(stopLoss),
          takeProfit: Number(takeProfit),
          quantity: Number(quantity || 1),
          notes,
          strategyUsed,
        }),
      });

      if (res.ok) {
        setShowAddModal(false);
        setEntryPrice('');
        setStopLoss('');
        setTakeProfit('');
        setNotes('');
        fetchJournal();
      }
    } catch {
      // ignore
    }
  };

  const handleStatusChange = async (id: string, newStatus: JournalTradeStatus) => {
    try {
      await fetch('/api/journal/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      fetchJournal();
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/journal?id=${id}`, { method: 'DELETE' });
      fetchJournal();
    } catch {
      // ignore
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">سجل الصفقات وتحليل الأداء</h2>
            <p className="text-xs text-slate-400">
              تتبع الصفقات المحفوظة، وتحديثها تلقائياً مع حركة السوق وحساب نسبة النجاح
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddModal(!showAddModal)}
          className="px-4 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 transition shadow-md shadow-amber-500/20"
        >
          <Plus className="w-4 h-4" />
          <span>تدوين صفقة جديدة</span>
        </button>
      </div>

      {/* Stats Summary Bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center font-mono">
          <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl">
            <span className="text-xs text-slate-400 block font-sans mb-1">نسبة النجاح (Win Rate)</span>
            <span className="text-2xl font-black text-emerald-400">
              {stats.winRatePercent}%
            </span>
            <span className="text-[11px] text-slate-500 block font-sans mt-0.5">
              {stats.wonTrades} رابحة من أصل {stats.wonTrades + stats.lostTrades} منتهية
            </span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl">
            <span className="text-xs text-slate-400 block font-sans mb-1">إجمالي العائد (PnL)</span>
            <span
              className={`text-2xl font-black ${
                stats.totalProfitUsdt >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {stats.totalProfitUsdt >= 0 ? '+' : ''}${formatPrice(stats.totalProfitUsdt)}
            </span>
            <span className="text-[11px] text-slate-500 block font-sans mt-0.5">USDT</span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl">
            <span className="text-xs text-slate-400 block font-sans mb-1">الصفقات المفتوحة</span>
            <span className="text-2xl font-black text-amber-400">
              {stats.openTrades}
            </span>
            <span className="text-[11px] text-slate-500 block font-sans mt-0.5">تتحدث مع السعر اللحظي</span>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl">
            <span className="text-xs text-slate-400 block font-sans mb-1">إجمالي الصفقات المدونة</span>
            <span className="text-2xl font-black text-white">
              {stats.totalTrades}
            </span>
            <span className="text-[11px] text-slate-500 block font-sans mt-0.5">في السجل</span>
          </div>
        </div>
      )}

      {/* Add Trade Form Modal */}
      {showAddModal && (
        <form
          onSubmit={handleAddTrade}
          className="bg-slate-950 border border-slate-700/80 p-5 rounded-2xl space-y-4 animate-in fade-in text-xs"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="font-bold text-white text-sm">تدوين صفقة جديدة في السجل</h3>
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="text-slate-400 hover:text-slate-200"
            >
              إلغاء
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">الرمز</label>
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
              >
                {['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'TONUSDT'].map(
                  (s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">الاتجاه</label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
              >
                <option value="شراء">شراء (Long)</option>
                <option value="بيع">بيع (Short)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">الكمية</label>
              <input
                type="number"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">سعر الدخول (Entry)</label>
              <input
                type="number"
                step="any"
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-rose-300 mb-1">وقف الخسارة (Stop Loss)</label>
              <input
                type="number"
                step="any"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value)}
                className="w-full bg-slate-900 border border-rose-900/50 rounded-xl px-3 py-2 text-rose-300 font-mono"
                required
              />
            </div>

            <div>
              <label className="block font-semibold text-emerald-300 mb-1">الهدف (Take Profit)</label>
              <input
                type="number"
                step="any"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value)}
                className="w-full bg-slate-900 border border-emerald-900/50 rounded-xl px-3 py-2 text-emerald-300 font-mono"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">الاستراتيجية المعتمدة</label>
              <input
                type="text"
                value={strategyUsed}
                onChange={(e) => setStrategyUsed(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">ملاحظات التحليل</label>
              <input
                type="text"
                placeholder="أسباب الدخول ومؤشرات الدعم..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl font-bold bg-amber-500 text-slate-950"
            >
              حفظ في السجل
            </button>
          </div>
        </form>
      )}

      {/* Trades Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-right text-xs font-mono">
          <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-sans text-xs">
            <tr>
              <th className="py-3 px-3">الرمز</th>
              <th className="py-3 px-3">الاتجاه</th>
              <th className="py-3 px-3">الدخول</th>
              <th className="py-3 px-3">السعر الحالي</th>
              <th className="py-3 px-3">الوقف / الهدف</th>
              <th className="py-3 px-3">نسبة العائد R:R</th>
              <th className="py-3 px-3">الربح / الخسارة</th>
              <th className="py-3 px-3">الحالة</th>
              <th className="py-3 px-3 text-left">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {trades.map((trade) => {
              const isWin = trade.status === 'WON' || (trade.status === 'OPEN' && trade.pnlUsdt > 0);
              return (
                <tr key={trade.id} className="hover:bg-slate-800/40">
                  <td className="py-3 px-3 font-bold text-white">
                    <div>{trade.symbol}</div>
                    <div className="text-[10px] text-slate-500 font-sans">{trade.strategyUsed}</div>
                  </td>

                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                        trade.direction === 'شراء'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-rose-500/20 text-rose-400'
                      }`}
                    >
                      {trade.direction}
                    </span>
                  </td>

                  <td className="py-3 px-3 text-slate-200">${formatPrice(trade.entryPrice)}</td>

                  <td className="py-3 px-3 font-bold text-white">
                    ${formatPrice(trade.currentPrice)}
                  </td>

                  <td className="py-3 px-3 text-[11px]">
                    <div className="text-rose-400">وقف: ${formatPrice(trade.stopLoss)}</div>
                    <div className="text-emerald-400">هدف: ${formatPrice(trade.takeProfit)}</div>
                  </td>

                  <td className="py-3 px-3 text-amber-300 font-bold">1:{trade.riskRewardRatio}</td>

                  <td className="py-3 px-3">
                    <span
                      className={`font-bold ${
                        trade.pnlUsdt >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {trade.pnlUsdt >= 0 ? '+' : ''}${formatPrice(trade.pnlUsdt)} ({formatPercent(trade.pnlPercent)})
                    </span>
                  </td>

                  <td className="py-3 px-3 font-sans">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        trade.status === 'WON'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : trade.status === 'LOST'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      {trade.status === 'WON' ? 'رابحة' : trade.status === 'LOST' ? 'خاسرة' : 'مفتوحة'}
                    </span>
                  </td>

                  <td className="py-3 px-3 text-left">
                    <div className="flex items-center gap-1 justify-end">
                      {trade.status === 'OPEN' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(trade.id, 'WON')}
                            className="p-1 rounded bg-emerald-950/60 text-emerald-400 hover:bg-emerald-900 border border-emerald-800"
                            title="تحديد كرابحة"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleStatusChange(trade.id, 'LOST')}
                            className="p-1 rounded bg-rose-950/60 text-rose-400 hover:bg-rose-900 border border-rose-800"
                            title="تحديد كخاسرة"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleDelete(trade.id)}
                        className="p-1 rounded text-slate-500 hover:text-rose-400"
                        title="حذف من السجل"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {trades.length === 0 && (
          <div className="text-center py-10 text-slate-500 text-xs">
            لا توجد صفقات مدونة في السجل بعد. يمكنك إضافة صفقاتك لمتابعة نسبة النجاح.
          </div>
        )}
      </div>
    </div>
  );
};
