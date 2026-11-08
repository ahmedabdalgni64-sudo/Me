import React, { useState, useEffect, useCallback } from 'react';
import { formatPrice } from '../utils/formatters.js';
import { Calculator, DollarSign, Percent, ShieldCheck, Target, ArrowDownCircle, RefreshCw } from 'lucide-react';

interface RiskCalculatorProps {
  initialPrice?: number;
  selectedSymbol?: string;
}

const DEFAULT_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'TONUSDT'];

export const RiskCalculator: React.FC<RiskCalculatorProps> = ({
  initialPrice,
  selectedSymbol: propSymbol = 'BTCUSDT',
}) => {
  const [symbol, setSymbol] = useState<string>(propSymbol);
  const [capital, setCapital] = useState<number>(10000);
  const [riskPercent, setRiskPercent] = useState<number>(2);
  const [entryPrice, setEntryPrice] = useState<number>(initialPrice || 0);
  const [stopLoss, setStopLoss] = useState<number>(initialPrice ? initialPrice * 0.98 : 0);
  const [takeProfit, setTakeProfit] = useState<number>(initialPrice ? initialPrice * 1.04 : 0);
  const [isLoadingPrice, setIsLoadingPrice] = useState<boolean>(false);
  const [liveMarketPrice, setLiveMarketPrice] = useState<number>(initialPrice || 0);

  // Fetch real live price from Binance for the chosen symbol
  const fetchRealPrice = useCallback(async (sym: string) => {
    setIsLoadingPrice(true);
    try {
      const res = await fetch(`/api/ticker/24hr?symbol=${sym}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data?.price) {
          const realPrice = Number(json.data.price);
          setLiveMarketPrice(realPrice);
          setEntryPrice(realPrice);
          setStopLoss(Number((realPrice * 0.98).toFixed(realPrice > 1 ? 2 : 5)));
          setTakeProfit(Number((realPrice * 1.04).toFixed(realPrice > 1 ? 2 : 5)));
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingPrice(false);
    }
  }, []);

  // Sync when initialPrice is passed or symbol changes
  useEffect(() => {
    if (initialPrice && initialPrice > 0) {
      setLiveMarketPrice(initialPrice);
      setEntryPrice(initialPrice);
      setStopLoss(Number((initialPrice * 0.98).toFixed(initialPrice > 1 ? 2 : 5)));
      setTakeProfit(Number((initialPrice * 1.04).toFixed(initialPrice > 1 ? 2 : 5)));
    } else {
      fetchRealPrice(symbol);
    }
  }, [initialPrice, symbol, fetchRealPrice]);

  const handleSymbolChange = (newSymbol: string) => {
    setSymbol(newSymbol);
    fetchRealPrice(newSymbol);
  };

  // Calculations
  const riskAmount = (capital * riskPercent) / 100;
  const priceDistance = Math.abs(entryPrice - stopLoss);
  const stopLossPercent = entryPrice > 0 ? (priceDistance / entryPrice) * 100 : 0;

  // Position size in units and total USDT
  const positionUnits = priceDistance > 0 ? riskAmount / priceDistance : 0;
  const positionValueUsdt = positionUnits * entryPrice;

  // Reward calculation
  const rewardDistance = Math.abs(takeProfit - entryPrice);
  const totalRewardUsdt = positionUnits * rewardDistance;
  const riskRewardRatio = priceDistance > 0 ? (rewardDistance / priceDistance).toFixed(2) : '0';

  const baseAsset = symbol.replace('USDT', '');

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">حاسبة حجم الصفقة وإدارة المخاطر</h2>
            <p className="text-xs text-slate-400">
              احسب حجم مركزك بدقة بناءً على أسعار Binance الحقيقية ونسبة المخاطرة المسموح بها
            </p>
          </div>
        </div>

        {/* Real Live Price Badge from Binance */}
        <div className="flex items-center gap-2 bg-slate-950 p-1.5 px-3 rounded-xl border border-slate-800 text-xs">
          <span className="text-slate-400">سعر {symbol} الفوري:</span>
          {isLoadingPrice ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-400" />
          ) : (
            <strong className="text-emerald-400 font-mono text-sm font-bold">
              ${formatPrice(liveMarketPrice)}
            </strong>
          )}
          <button
            onClick={() => fetchRealPrice(symbol)}
            className="text-slate-400 hover:text-white mr-1"
            title="تحديث السعر الحقيقي"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Symbol Selector Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-400 font-medium whitespace-nowrap">العملة:</span>
        {DEFAULT_SYMBOLS.map((s) => (
          <button
            key={s}
            onClick={() => handleSymbolChange(s)}
            className={`px-3 py-1 rounded-lg font-mono font-bold transition border ${
              symbol === s
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            {s.replace('USDT', '')}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Inputs */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              إجمالي رأس المال المتاح (USDT)
            </label>
            <div className="relative">
              <input
                type="number"
                value={capital || ''}
                onChange={(e) => setCapital(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-amber-500"
              />
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-mono">
                USDT
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              نسبة المخاطرة القصوى للصفقة (%)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="10"
                value={riskPercent || ''}
                onChange={(e) => setRiskPercent(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-amber-500"
              />
              <span className="text-xs text-slate-400 font-mono">%</span>
            </div>
            <div className="flex gap-2 mt-2">
              {[1, 2, 3, 5].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setRiskPercent(pct)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium border ${
                    riskPercent === pct
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-semibold text-slate-300">
                سعر الدخول (Entry Price)
              </label>
              <button
                type="button"
                onClick={() => setEntryPrice(liveMarketPrice)}
                className="text-[11px] text-amber-400 hover:underline font-mono"
              >
                استخدم السعر اللحظي (${formatPrice(liveMarketPrice)})
              </button>
            </div>
            <input
              type="number"
              step="any"
              value={entryPrice || ''}
              onChange={(e) => setEntryPrice(Number(e.target.value))}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-rose-300 mb-1.5">
              سعر وقف الخسارة (Stop Loss)
            </label>
            <input
              type="number"
              step="any"
              value={stopLoss || ''}
              onChange={(e) => setStopLoss(Number(e.target.value))}
              className="w-full bg-slate-950 border border-rose-900/50 rounded-xl px-4 py-2.5 text-sm font-mono text-rose-400 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-emerald-300 mb-1.5">
              سعر الهدف (Take Profit)
            </label>
            <input
              type="number"
              step="any"
              value={takeProfit || ''}
              onChange={(e) => setTakeProfit(Number(e.target.value))}
              className="w-full bg-slate-950 border border-emerald-900/50 rounded-xl px-4 py-2.5 text-sm font-mono text-emerald-400 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Calculated Results */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
          <h3 className="font-bold text-sm text-slate-200 border-b border-slate-800 pb-2">
            مخرجات الحساب الفعلي (Binance Real Data)
          </h3>

          <div className="space-y-4 my-4 font-mono text-xs">
            <div className="flex justify-between items-center bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 font-sans">الخسارة القصوى بالمبلغ:</span>
              <span className="text-rose-400 font-bold text-base">
                ${formatPrice(riskAmount)} USDT
              </span>
            </div>

            <div className="flex justify-between items-center bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 font-sans">حجم الصفقة بالدولار (Position Value):</span>
              <span className="text-amber-400 font-bold text-base">
                ${formatPrice(positionValueUsdt)}
              </span>
            </div>

            <div className="flex justify-between items-center bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 font-sans">حجم المركز بالوحدات ({baseAsset}):</span>
              <span className="text-white font-bold text-base">
                {positionUnits.toFixed(4)} {baseAsset}
              </span>
            </div>

            <div className="flex justify-between items-center bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 font-sans">نسبة هبوط الوقف عن الدخول:</span>
              <span className="text-slate-300 font-bold">
                {stopLossPercent.toFixed(2)}%
              </span>
            </div>

            <div className="flex justify-between items-center bg-slate-900/90 p-3 rounded-xl border border-slate-800">
              <span className="text-slate-400 font-sans">الربح المتوقع عند الهدف:</span>
              <span className="text-emerald-400 font-bold text-base">
                +${formatPrice(totalRewardUsdt)} USDT
              </span>
            </div>

            <div className="flex justify-between items-center bg-emerald-950/20 p-3 rounded-xl border border-emerald-800/40">
              <span className="text-emerald-300 font-sans font-bold">نسبة العائد إلى المخاطرة (R:R):</span>
              <span className="text-emerald-400 font-black text-lg">
                1 : {riskRewardRatio}
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-900 text-slate-400 text-[11px] leading-relaxed border border-slate-800">
            قاعدة الأمان الذهبية: لا تخاطر أبداً بأكثر من 1-2% من إجمالي محفظتك في صفقة واحدة لحماية رأس المال من تقلبات السوق العنيفة.
          </div>
        </div>
      </div>
    </div>
  );
};
