import React, { useState } from 'react';
import { AlertType, PriceAlert } from '../types/journal.js';
import { formatPrice } from '../utils/formatters.js';
import { audioAlert } from '../utils/audioAlert.js';
import {
  Bell,
  X,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react';

interface QuickAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  currentPrice: number;
  initialTargetPrice?: number;
  initialType?: AlertType;
  nearestSupports?: number[];
  nearestResistances?: number[];
  onAlertCreated?: (alert: PriceAlert) => void;
}

export const QuickAlertModal: React.FC<QuickAlertModalProps> = ({
  isOpen,
  onClose,
  symbol,
  currentPrice,
  initialTargetPrice,
  initialType,
  nearestSupports = [],
  nearestResistances = [],
  onAlertCreated,
}) => {
  const [targetPrice, setTargetPrice] = useState<string>(
    initialTargetPrice
      ? initialTargetPrice.toString()
      : (currentPrice * 1.02).toFixed(2)
  );
  const [type, setType] = useState<AlertType>(
    initialType || (initialTargetPrice && initialTargetPrice < currentPrice ? 'PRICE_BELOW' : 'PRICE_ABOVE')
  );
  const [note, setNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle Preset Percentages
  const applyPercentPreset = (percent: number) => {
    const calculated = currentPrice * (1 + percent / 100);
    setTargetPrice(calculated > 1 ? calculated.toFixed(2) : calculated.toFixed(5));
    if (percent > 0) {
      setType('PRICE_ABOVE');
    } else {
      setType('PRICE_BELOW');
    }
    setErrorMsg(null);
  };

  // Handle Preset Support / Resistance
  const applyLevelPreset = (levelPrice: number, isSupport: boolean) => {
    setTargetPrice(levelPrice.toString());
    setType(isSupport ? 'PRICE_BELOW' : 'PRICE_ABOVE');
    setNote(isSupport ? `تنبيه عند اختبار الدعم $${formatPrice(levelPrice)}` : `تنبيه عند اختراق المقاومة $${formatPrice(levelPrice)}`);
    setErrorMsg(null);
  };

  // Submit Alert
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const priceNum = Number(targetPrice);
    if ((type === 'PRICE_ABOVE' || type === 'PRICE_BELOW') && (!priceNum || priceNum <= 0)) {
      setErrorMsg('يرجى تحديد سعر مستهدف صحيح وأكبر من الصفر');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          type,
          targetPrice: priceNum || undefined,
          note: note.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'تعذر إنشاء التنبيه');
      }

      audioAlert.playAlertChime();
      setSuccessMsg('تم تفعيل التنبيه السعري بنجاح!');
      if (onAlertCreated) {
        onAlertCreated(json.data);
      }

      setTimeout(() => {
        onClose();
        setSuccessMsg(null);
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'حدث خطأ أثناء حفظ التنبيه');
    } finally {
      setIsSubmitting(false);
    }
  };

  const baseAsset = symbol.replace('USDT', '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Bell className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">
                إضافة تنبيه سعر جديد
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                {symbol} • السعر الحالي: ${formatPrice(currentPrice)}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Condition Type */}
          <div>
            <label className="block font-semibold text-slate-300 mb-2">نوع شرط التنبيه</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setType('PRICE_ABOVE')}
                className={`py-2 px-3 rounded-xl border font-bold flex items-center justify-center gap-1.5 transition ${
                  type === 'PRICE_ABOVE'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-sm shadow-emerald-500/20'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <TrendingUp className="w-4 h-4" />
                <span>ارتفاع السعر فوق (≥)</span>
              </button>

              <button
                type="button"
                onClick={() => setType('PRICE_BELOW')}
                className={`py-2 px-3 rounded-xl border font-bold flex items-center justify-center gap-1.5 transition ${
                  type === 'PRICE_BELOW'
                    ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-sm shadow-rose-500/20'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <TrendingDown className="w-4 h-4" />
                <span>هبوط السعر تحت (≤)</span>
              </button>
            </div>
          </div>

          {/* Target Price */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="font-semibold text-slate-300">السعر المستهدف (USDT)</label>
              <span className="text-[11px] text-amber-400 font-mono font-medium">
                الحالي: ${formatPrice(currentPrice)}
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                step="any"
                required
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="أدخل السعر المستهدف"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2.5 px-3 text-white font-mono text-sm focus:outline-none focus:border-amber-500 text-left dir-ltr"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs pointer-events-none">
                USDT
              </span>
            </div>
          </div>

          {/* Quick Percentage Presets */}
          <div>
            <span className="block text-[11px] text-slate-400 mb-1.5">أزرار سريعة بالنسبة المئوية:</span>
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
                  onClick={() => applyPercentPreset(p.val)}
                  className={`px-2.5 py-1 rounded-lg font-mono text-xs font-bold transition border ${
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

          {/* Support / Resistance Quick Buttons */}
          {(nearestSupports.length > 0 || nearestResistances.length > 0) && (
            <div>
              <span className="block text-[11px] text-slate-400 mb-1.5">مستويات الدعم والمقاومة الفنية:</span>
              <div className="flex flex-wrap gap-1.5 font-mono">
                {nearestSupports.map((sup, idx) => (
                  <button
                    key={`sup-${idx}`}
                    type="button"
                    onClick={() => applyLevelPreset(sup, true)}
                    className="px-2.5 py-1 rounded-lg text-xs bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/60 transition"
                  >
                    دعم S{idx + 1}: ${formatPrice(sup)}
                  </button>
                ))}
                {nearestResistances.map((res, idx) => (
                  <button
                    key={`res-${idx}`}
                    type="button"
                    onClick={() => applyLevelPreset(res, false)}
                    className="px-2.5 py-1 rounded-lg text-xs bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/60 transition"
                  >
                    مقاومة R{idx + 1}: ${formatPrice(res)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Personal Note */}
          <div>
            <label className="block font-semibold text-slate-300 mb-1.5">ملاحظة التنبيه (اختياري)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="مثال: اختراق قمة الأسبوع أو نقطة دخول الشراء"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl py-2 px-3 text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-1.5 transition shadow-md shadow-amber-500/20 disabled:opacity-50"
            >
              <Bell className="w-4 h-4 fill-current" />
              <span>{isSubmitting ? 'جاري الحفظ...' : 'حفظ وتفعيل التنبيه'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
