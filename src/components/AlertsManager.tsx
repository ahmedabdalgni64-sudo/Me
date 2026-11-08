import React, { useState, useEffect, useCallback } from 'react';
import { AlertType, PriceAlert } from '../types/journal.js';
import { formatPrice, formatTimeAgo } from '../utils/formatters.js';
import { audioAlert } from '../utils/audioAlert.js';
import {
  Bell,
  BellRing,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Volume2,
  Clock,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Filter,
  RefreshCw,
} from 'lucide-react';

export const AlertsManager: React.FC = () => {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'triggered'>('all');

  // New alert form fields with real live price
  const [symbol, setSymbol] = useState<string>('BTCUSDT');
  const [type, setType] = useState<AlertType>('PRICE_ABOVE');
  const [targetPrice, setTargetPrice] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [livePrice, setLivePrice] = useState<number>(0);
  const [isLoadingLivePrice, setIsLoadingLivePrice] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Fetch alerts from backend
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
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch real price for the selected symbol in form
  const fetchSymbolPrice = useCallback(async (sym: string) => {
    setIsLoadingLivePrice(true);
    try {
      const res = await fetch(`/api/ticker/24hr?symbol=${sym}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.price) {
          const p = Number(json.data.price);
          setLivePrice(p);
          if (!targetPrice || targetPrice === '') {
            setTargetPrice((p * 1.02).toFixed(p > 1 ? 2 : 5));
          }
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingLivePrice(false);
    }
  }, [targetPrice]);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 8000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  useEffect(() => {
    if (showAddForm) {
      fetchSymbolPrice(symbol);
    }
  }, [showAddForm, symbol, fetchSymbolPrice]);

  // Handle Percentage Shortcut
  const applyPercent = (pct: number) => {
    if (livePrice > 0) {
      const calculated = livePrice * (1 + pct / 100);
      setTargetPrice(calculated > 1 ? calculated.toFixed(2) : calculated.toFixed(5));
      if (pct > 0) {
        setType('PRICE_ABOVE');
      } else {
        setType('PRICE_BELOW');
      }
    }
  };

  // Create Alert
  const handleCreateAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((type === 'PRICE_ABOVE' || type === 'PRICE_BELOW') && (!targetPrice || Number(targetPrice) <= 0)) {
      setMessage({ text: 'يرجى إدخال السعر المستهدف بشكل صحيح وأكبر من 0', type: 'error' });
      return;
    }

    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          type,
          targetPrice: targetPrice ? Number(targetPrice) : undefined,
          note: note.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        audioAlert.playAlertChime();
        setMessage({ text: 'تم إنشاء التنبيه بنجاح وربطه بالأسعار الحية!', type: 'success' });
        setTargetPrice('');
        setNote('');
        setShowAddForm(false);
        fetchAlerts();
      }
    } catch {
      setMessage({ text: 'تعذر إنشاء التنبيه', type: 'error' });
    }
  };

  // Toggle Alert
  const handleToggle = async (id: string) => {
    try {
      await fetch('/api/alerts/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      fetchAlerts();
    } catch {
      // ignore
    }
  };

  // Delete Alert
  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/alerts?id=${id}`, { method: 'DELETE' });
      fetchAlerts();
    } catch {
      // ignore
    }
  };

  // Filter alerts
  const filteredAlerts = alerts.filter((a) => {
    if (filter === 'active') return a.isActive && !a.isTriggered;
    if (filter === 'triggered') return a.isTriggered;
    return true;
  });

  const activeCount = alerts.filter((a) => a.isActive && !a.isTriggered).length;
  const triggeredCount = alerts.filter((a) => a.isTriggered).length;

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
            <BellRing className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">إدارة التنبيهات السعرية المباشرة</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                Binance Live
              </span>
            </div>
            <p className="text-xs text-slate-400">
              تنبيهات فورية متصلة بأسعار بينانس الحقيقية مع إشعارات صوتية ومرئية
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => audioAlert.playBuyChime()}
            className="px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition"
            title="تجربة صوت التنبيه"
          >
            <Volume2 className="w-4 h-4 text-amber-400" />
            <span>تجربة الصوت</span>
          </button>

          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              if (!showAddForm) fetchSymbolPrice(symbol);
            }}
            className="px-4 py-2 rounded-xl text-xs font-black bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 transition shadow-md shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>تنبيه جديد</span>
          </button>
        </div>
      </div>

      {/* Stats and Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              filter === 'all'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>جميع التنبيهات</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-200">
              {alerts.length}
            </span>
          </button>

          <button
            onClick={() => setFilter('active')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              filter === 'active'
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>النشطة للمراقبة</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-200">
              {activeCount}
            </span>
          </button>

          <button
            onClick={() => setFilter('triggered')}
            className={`px-3 py-1.5 rounded-lg font-bold transition flex items-center gap-1.5 ${
              filter === 'triggered'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>تم التحقق منها</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-200">
              {triggeredCount}
            </span>
          </button>
        </div>

        <button
          onClick={fetchAlerts}
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
          title="تحديث قائمة التنبيهات"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
        </button>
      </div>

      {message && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center justify-between ${
            message.type === 'success'
              ? 'bg-emerald-950/30 text-emerald-300 border border-emerald-800/50'
              : 'bg-rose-950/30 text-rose-300 border border-rose-800/50'
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Add Alert Form Modal/Panel */}
      {showAddForm && (
        <form
          onSubmit={handleCreateAlert}
          className="bg-slate-950 border border-slate-700/80 p-5 rounded-2xl space-y-4 animate-in fade-in text-xs"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Plus className="w-4 h-4 text-amber-400" />
              <span>إضافة تنبيه سعر جديد متصل بـ Binance</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-slate-400 hover:text-slate-200"
            >
              إلغاء
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="font-semibold text-slate-300">الرمز المستهدف</label>
                {livePrice > 0 && (
                  <span className="text-[11px] text-emerald-400 font-mono">
                    ${formatPrice(livePrice)}
                  </span>
                )}
              </div>
              <select
                value={symbol}
                onChange={(e) => {
                  setSymbol(e.target.value);
                  fetchSymbolPrice(e.target.value);
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
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
              <label className="block font-semibold text-slate-300 mb-1.5">نوع الشرط</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AlertType)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
              >
                <option value="PRICE_ABOVE">ارتفاع السعر فوق القيمة (Price Above)</option>
                <option value="PRICE_BELOW">هبوط السعر تحت القيمة (Price Below)</option>
                <option value="STRONG_BUY_SIGNAL">ظهور إشارة شراء قوي (Strong Buy)</option>
              </select>
            </div>

            {(type === 'PRICE_ABOVE' || type === 'PRICE_BELOW') && (
              <div>
                <label className="block font-semibold text-slate-300 mb-1.5">السعر المستهدف (USDT)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="السعر المستهدف"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            )}
          </div>

          {/* Live Price Shortcut Pills */}
          {livePrice > 0 && (type === 'PRICE_ABOVE' || type === 'PRICE_BELOW') && (
            <div>
              <span className="block text-[11px] text-slate-400 mb-1.5">
                تحديد الهدف بنسبة من السعر الحقيقي الحالي (${formatPrice(livePrice)}):
              </span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: '+1%', val: 1 },
                  { label: '+2%', val: 2 },
                  { label: '+5%', val: 5 },
                  { label: '-1%', val: -1 },
                  { label: '-2%', val: -2 },
                  { label: '-5%', val: -5 },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => applyPercent(p.val)}
                    className={`px-2.5 py-1 rounded-lg font-mono font-bold transition border ${
                      p.val > 0
                        ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                        : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block font-semibold text-slate-300 mb-1.5">ملاحظة شخصية (اختياري)</label>
            <input
              type="text"
              placeholder="مثال: نقطة الدخول في حال ارتداد الدعم الفني"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20"
            >
              تأكيد وحفظ التنبيه
            </button>
          </div>
        </form>
      )}

      {/* Alerts List */}
      <div className="space-y-3">
        {filteredAlerts.length > 0 ? (
          filteredAlerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-4 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                alert.isTriggered
                  ? 'bg-amber-950/20 border-amber-800/50'
                  : alert.isActive
                  ? 'bg-slate-950/60 border-slate-800'
                  : 'bg-slate-950/30 border-slate-900 opacity-60'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-xl mt-0.5 ${
                    alert.isTriggered
                      ? 'bg-amber-500/20 text-amber-400 animate-pulse'
                      : alert.type === 'PRICE_ABOVE'
                      ? 'bg-emerald-500/10 text-emerald-400'
                      : 'bg-rose-500/10 text-rose-400'
                  }`}
                >
                  <Bell className="w-4 h-4" />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-white text-sm">{alert.symbol}</span>
                    <span className="text-xs text-slate-300">{alert.conditionDescription}</span>
                    {alert.isTriggered && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 animate-pulse">
                        تم التحقق!
                      </span>
                    )}
                  </div>
                  {alert.note && <p className="text-xs text-slate-400 mt-1">{alert.note}</p>}
                  <span className="text-[10px] text-slate-500 block mt-1">
                    أُنشئ {formatTimeAgo(alert.createdAt)}
                    {alert.triggeredAt && ` • تحقق ${formatTimeAgo(alert.triggeredAt)}`}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 self-end sm:self-center">
                <button
                  onClick={() => handleToggle(alert.id)}
                  className={`p-1.5 rounded-lg text-xs font-semibold transition ${
                    alert.isActive ? 'text-emerald-400 hover:text-emerald-300' : 'text-slate-500'
                  }`}
                  title={alert.isActive ? 'تعطيل التنبيه' : 'تفعيل التنبيه'}
                >
                  {alert.isActive ? (
                    <ToggleRight className="w-6 h-6" />
                  ) : (
                    <ToggleLeft className="w-6 h-6" />
                  )}
                </button>

                <button
                  onClick={() => handleDelete(alert.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 transition"
                  title="حذف التنبيه"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12 text-slate-500 text-xs">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <span>لا توجد تنبيهات تطابق التصفية الحالية. يمكنك إضافة تنبيه جديد بنقرة واحدة.</span>
          </div>
        )}
      </div>
    </div>
  );
};
