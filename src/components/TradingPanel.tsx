import React, { useState, useEffect, useCallback } from 'react';
import {
  AssetBalance,
  OrderRequest,
  OrderSide,
  OrderType,
  TradeOrder,
  TradingAccountState,
  TradingMode,
  ExchangePlatform,
} from '../types/trading.js';
import { formatPrice } from '../utils/formatters.js';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  RotateCcw,
  Zap,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Layers,
  ArrowRightLeft,
  ShieldAlert,
  Bot,
  Play,
  Square,
} from 'lucide-react';

interface TradingPanelProps {
  symbol: string;
  currentPrice: number;
  proposedTrade?: {
    direction: 'شراء' | 'بيع' | 'لا توجد صفقة واضحة';
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
  };
  onOrderExecuted?: () => void;
}

export const TradingPanel: React.FC<TradingPanelProps> = ({
  symbol,
  currentPrice,
  proposedTrade,
  onOrderExecuted,
}) => {
  const [mode, setMode] = useState<TradingMode>('paper');
  const [side, setSide] = useState<OrderSide>('BUY');
  const [orderType, setOrderType] = useState<OrderType>('MARKET');
  const [price, setPrice] = useState<number>(currentPrice);
  const [quantity, setQuantity] = useState<string>('');
  const [selectedExchange, setSelectedExchange] = useState<ExchangePlatform>('binance');
  const [account, setAccount] = useState<TradingAccountState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [hasEnvKeys, setHasEnvKeys] = useState<boolean>(false);
  const [isBotRunning, setIsBotRunning] = useState<boolean>(false);

  const baseAsset = symbol.replace('USDT', '');

  // Check bot status
  const checkBot = useCallback(async () => {
    try {
      const res = await fetch('/api/bot/status');
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setIsBotRunning(json.data.isRunning);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    checkBot();
    const botTimer = setInterval(checkBot, 4000);
    return () => clearInterval(botTimer);
  }, [checkBot]);

  const handleStartBot = async () => {
    try {
      const res = await fetch('/api/bot/start', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setIsBotRunning(true);
        setMessage({ text: 'تم تشغيل بوت التداول الآلي بنجاح!', type: 'success' });
      }
    } catch {
      setMessage({ text: 'تعذر تشغيل البوت', type: 'error' });
    }
  };

  const handleStopBot = async () => {
    try {
      const res = await fetch('/api/bot/stop', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setIsBotRunning(false);
        setMessage({ text: 'تم إيقاف بوت التداول الآلي.', type: 'error' });
      }
    } catch {
      setMessage({ text: 'تعذر إيقاف البوت', type: 'error' });
    }
  };

  // Check config and fetch account state
  const fetchAccount = useCallback(async () => {
    setIsLoading(true);
    try {
      // Check config
      const configRes = await fetch('/api/trade/config');
      if (configRes.ok) {
        const configJson = await configRes.json();
        setHasEnvKeys(configJson.hasEnvKeys);
      }

      const res = await fetch(`/api/trade/account?mode=${mode}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setAccount(json.data);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    fetchAccount();
  }, [fetchAccount]);

  useEffect(() => {
    if (orderType === 'LIMIT' && (!price || price === 0)) {
      setPrice(currentPrice);
    }
  }, [currentPrice, orderType, price]);

  // Balances
  const usdtBalance = account?.balances.find((b) => b.asset === 'USDT')?.free || 0;
  const baseBalance = account?.balances.find((b) => b.asset === baseAsset)?.free || 0;

  // Calculate order total
  const executionPrice = orderType === 'MARKET' ? currentPrice : price;
  const numQuantity = parseFloat(quantity) || 0;
  const totalCost = numQuantity * executionPrice;

  // Quick percent calculation
  const setPercentage = (pct: number) => {
    if (side === 'BUY') {
      const budget = (usdtBalance * pct) / 100;
      if (executionPrice > 0) {
        const calculatedQty = budget / executionPrice;
        setQuantity(calculatedQty >= 1 ? calculatedQty.toFixed(4) : calculatedQty.toFixed(6));
      }
    } else {
      const calculatedQty = (baseBalance * pct) / 100;
      setQuantity(calculatedQty >= 1 ? calculatedQty.toFixed(4) : calculatedQty.toFixed(6));
    }
  };

  // Submit Order
  const handleExecute = async () => {
    if (!numQuantity || numQuantity <= 0) {
      setMessage({ text: 'يرجى إدخال كمية صحيحة للتداول', type: 'error' });
      return;
    }

    if (side === 'BUY' && totalCost > usdtBalance) {
      setMessage({ text: 'رصيد USDT المتاح غير كافٍ لتنفيذ العملية', type: 'error' });
      return;
    }

    if (side === 'SELL' && numQuantity > baseBalance) {
      setMessage({ text: `رصيد ${baseAsset} المتاح غير كافٍ للبيع`, type: 'error' });
      return;
    }

    // Strict Security Warning before any real live execution
    if (mode === 'live') {
      const confirmed = window.confirm(
        `⚠️ تحذير تداول حقيقي:\nأنت على وشك إرسال أمر ${side === 'BUY' ? 'شراء' : 'بيع'} حقيقي بأموال فعلية على منصة ${selectedExchange.toUpperCase()}!\n\n• الأصل: ${symbol}\n• الكمية: ${numQuantity} ${baseAsset}\n• القيمة المقدرة: $${totalCost.toFixed(2)} USDT\n\nهل تؤكد التنفيذ الفعلي؟`
      );
      if (!confirmed) return;
    }

    setIsSubmitting(true);
    setMessage(null);

    try {
      const orderReq: OrderRequest = {
        symbol,
        side,
        type: orderType,
        quantity: numQuantity,
        price: orderType === 'LIMIT' ? price : undefined,
        mode,
        exchange: selectedExchange,
      };

      const res = await fetch('/api/trade/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderReq),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'فشل تنفيذ الأمر على بينانس');
      }

      setMessage({
        text: `تم تنفيذ أمر ${side === 'BUY' ? 'شراء' : 'بيع'} ${numQuantity} ${baseAsset} بنجاح!`,
        type: 'success',
      });
      setQuantity('');
      fetchAccount();
      onOrderExecuted?.();
    } catch (err: any) {
      setMessage({ text: err.message || 'حدث خطأ أثناء تنفيذ الأمر', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel an open order
  const handleCancelOrder = async (orderId: string) => {
    try {
      const res = await fetch(`/api/trade/order?orderId=${orderId}&symbol=${symbol}&mode=${mode}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        setMessage({ text: 'تم إلغاء الأمر بنجاح واسترجاع الرصيد المعلق', type: 'success' });
        fetchAccount();
      }
    } catch {
      setMessage({ text: 'تعذر إلغاء الأمر', type: 'error' });
    }
  };

  // Reset Virtual Balance
  const handleResetPaper = async () => {
    if (!confirm('هل تريد إعادة تعيين المحفظة الافتراضية إلى 10,000 USDT؟')) return;
    try {
      const res = await fetch('/api/trade/reset-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialUsdt: 10000 }),
      });
      if (res.ok) {
        fetchAccount();
        setMessage({ text: 'تمت استعادة رصيد 10,000 USDT في المحفظة الافتراضية بنجاح', type: 'success' });
      }
    } catch {
      // ignore
    }
  };

  // Quick fill from technical analysis recommendation
  const fillFromProposal = () => {
    if (!proposedTrade || proposedTrade.direction === 'لا توجد صفقة واضحة') return;
    setSide(proposedTrade.direction === 'شراء' ? 'BUY' : 'SELL');
    setOrderType('MARKET');
    // Allocate 25% of budget
    setPercentage(25);
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col gap-5">
      {/* Trading Header & Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-base">تنفيذ الصفقات وإدارة الأوامر</h3>
            <p className="text-xs text-slate-400">
              تداول مباشر على أسعار بينانس الفورية (أوامر Market و Limit)
            </p>
          </div>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
          <button
            onClick={() => setMode('paper')}
            className={`min-h-[44px] px-3.5 py-2 rounded-lg font-bold transition flex items-center gap-1.5 ${
              mode === 'paper'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>تجريبي محاكي (Paper)</span>
          </button>

          <button
            onClick={() => {
              const ok = window.confirm('⚠️ تنبيه: هل تريد التبديل إلى وضع التداول الحقيقي (Live Real Orders)؟');
              if (ok) setMode('live');
            }}
            className={`min-h-[44px] px-3.5 py-2 rounded-lg font-bold transition flex items-center gap-1.5 ${
              mode === 'live'
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/20'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${hasEnvKeys ? 'bg-emerald-400' : 'bg-slate-500'}`}></span>
            <span>حساب Binance الحقيقي</span>
          </button>
        </div>
      </div>

      {/* Multi-Exchange Platform Selector */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 text-xs -mx-1 px-1">
        <span className="text-slate-400 font-semibold whitespace-nowrap pl-1 shrink-0">
          منصة التنفيذ:
        </span>
        {[
          { id: 'binance', label: 'Binance', ar: 'بينانس', color: 'text-amber-400' },
          { id: 'bybit', label: 'Bybit', ar: 'باي بيت', color: 'text-orange-400' },
          { id: 'okx', label: 'OKX', ar: 'أوكي إكس', color: 'text-blue-400' },
          { id: 'kucoin', label: 'KuCoin', ar: 'كوكوين', color: 'text-emerald-400' },
          { id: 'gateio', label: 'Gate.io', ar: 'جيت آيو', color: 'text-rose-400' },
        ].map((ex) => (
          <button
            key={ex.id}
            type="button"
            onClick={() => setSelectedExchange(ex.id as any)}
            className={`min-h-[44px] px-3.5 py-2.5 rounded-xl font-mono text-xs font-bold whitespace-nowrap shrink-0 transition flex items-center gap-1.5 border ${
              selectedExchange === ex.id
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-sm font-black'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
            }`}
          >
            <span className={selectedExchange === ex.id ? 'text-slate-950' : ex.color}>●</span>
            <span>{ex.label}</span>
            <span className="text-[10px] opacity-75 font-sans">({ex.ar})</span>
          </button>
        ))}
      </div>

      {/* Mode Status Notice */}
      {mode === 'paper' ? (
        <div className="flex items-center justify-between bg-emerald-950/20 border border-emerald-900/40 px-3.5 py-2.5 rounded-xl text-xs text-emerald-300">
          <div className="flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>
              أنت في <strong>وضع المحاكاة التجريبي</strong> بأسعار بينانس الحية. رأس مالك آمن تماماً وبدون مخاطرة.
            </span>
          </div>
          <button
            onClick={handleResetPaper}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-900/40 hover:bg-emerald-900/70 border border-emerald-800 text-emerald-200 font-semibold transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>إعادة تعيين الرصيد</span>
          </button>
        </div>
      ) : (
        <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl text-xs text-slate-300">
          {hasEnvKeys ? (
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle className="w-4 h-4" />
              <span>مفاتيح حساب Binance مفعلة في بيئة الخادم. يمكنك إرسال الأوامر المباشرة الآن.</span>
            </div>
          ) : (
            <div className="flex items-start gap-2 text-amber-300">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <span>
                  لم يتم ضبط متغيرات <code>BINANCE_API_KEY</code> و <code>BINANCE_API_SECRET</code> في الخادم.
                  لتفعيل التداول الحقيقي اضبط المفاتيح في <code>.env</code>، أو يمكنك استخدام وضع المحاكاة التجريبي الفوري بالأعلى.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bot Master Controls Strip inside Trading Panel */}
      <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-xl transition ${
              isBotRunning ? 'bg-emerald-500/20 text-emerald-400 animate-pulse' : 'bg-slate-800 text-slate-400'
            }`}
          >
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-xs sm:text-sm">بوت التداول الآلي</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                  isBotRunning
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isBotRunning ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                <span>{isBotRunning ? 'قيد التشغيل والمراقبة' : 'متوقف'}</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isBotRunning
                ? 'يقوم البوت بمسح السوق كل 20 ثانية وإرسال الصفقات تلقائياً'
                : 'يمكنك تشغيل البوت لتنفيذ صفقات الشراء والبيع بشكل آلي'}
            </p>
          </div>
        </div>

        {/* Start / Stop Bot Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleStartBot}
            disabled={isBotRunning}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
              isBotRunning
                ? 'opacity-30 cursor-not-allowed bg-slate-800 text-slate-500'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>تشغيل البوت</span>
          </button>

          <button
            onClick={handleStopBot}
            disabled={!isBotRunning}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition flex items-center gap-1.5 ${
              !isBotRunning
                ? 'opacity-30 cursor-not-allowed bg-slate-800 text-slate-500'
                : 'bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-500/20'
            }`}
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            <span>إيقاف البوت</span>
          </button>
        </div>
      </div>

      {/* Quick Trade Trigger from Analysis Proposal */}
      {proposedTrade && proposedTrade.direction !== 'لا توجد صفقة واضحة' && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-slate-900 border border-amber-500/30 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-slate-200 font-bold">
              توصية التحليل الفني الحالية:
            </span>
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold ${
                proposedTrade.direction === 'شراء'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'bg-rose-500/20 text-rose-400'
              }`}
            >
              {proposedTrade.direction}
            </span>
            <span className="text-xs font-mono text-slate-400">
              دخول: ${formatPrice(proposedTrade.entryPrice)} | وقف: ${formatPrice(proposedTrade.stopLoss)} | هدف: ${formatPrice(proposedTrade.takeProfit)}
            </span>
          </div>
          <button
            onClick={fillFromProposal}
            className="px-3 py-1 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition flex items-center gap-1.5"
          >
            <span>تجهيز أمر التوصية (25% من الرصيد)</span>
          </button>
        </div>
      )}

      {/* Main Order Form Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Order Form */}
        <div className="lg:col-span-2 space-y-4">
          {/* Side Tabs: Buy / Sell */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-950 rounded-xl border border-slate-800">
            <button
              onClick={() => setSide('BUY')}
              className={`min-h-[46px] py-2.5 rounded-lg text-sm font-black transition flex items-center justify-center gap-2 ${
                side === 'BUY'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>شراء {baseAsset}</span>
            </button>

            <button
              onClick={() => setSide('SELL')}
              className={`min-h-[46px] py-2.5 rounded-lg text-sm font-black transition flex items-center justify-center gap-2 ${
                side === 'SELL'
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingDown className="w-4 h-4" />
              <span>بيع {baseAsset}</span>
            </button>
          </div>

          {/* Order Type: Market / Limit */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setOrderType('MARKET')}
              className={`min-h-[44px] px-4 py-2 rounded-xl font-bold border transition ${
                orderType === 'MARKET'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              سعر السوق (Market)
            </button>
            <button
              onClick={() => setOrderType('LIMIT')}
              className={`min-h-[44px] px-4 py-2 rounded-xl font-bold border transition ${
                orderType === 'LIMIT'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-slate-950 border-slate-800 text-slate-400'
              }`}
            >
              أمر محدد بسعر (Limit)
            </button>
          </div>

          {/* Price Input (if Limit) */}
          {orderType === 'LIMIT' && (
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>سعر التنفيذ المستهدف (USDT)</span>
                <span className="font-mono">السعر اللحظي: ${formatPrice(currentPrice)}</span>
              </div>
              <input
                type="number"
                step="any"
                value={price || ''}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                className="w-full min-h-[44px] bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          {/* Quantity Input */}
          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>الكمية المراد تداولها ({baseAsset})</span>
              <span className="font-mono">
                المتاح: {side === 'BUY' ? `${formatPrice(usdtBalance)} USDT` : `${baseBalance} ${baseAsset}`}
              </span>
            </div>
            <input
              type="number"
              step="any"
              placeholder={`0.00 ${baseAsset}`}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full min-h-[44px] bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none focus:border-amber-500"
            />

            {/* Quick Percentage Buttons */}
            <div className="grid grid-cols-4 gap-2 mt-2">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setPercentage(pct)}
                  className="min-h-[44px] py-2 rounded-xl bg-slate-850 hover:bg-slate-800 border border-slate-800 text-xs font-mono text-slate-300 transition font-bold"
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Total & Summary */}
          <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 font-mono text-xs space-y-1.5">
            <div className="flex justify-between items-center text-slate-400 font-sans">
              <span>القيمة الإجمالية المقدرة:</span>
              <span className="font-mono text-sm font-bold text-white">
                ${formatPrice(totalCost)} USDT
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-500 text-[11px]">
              <span>رسوم الصرف المقدرة (0.075%):</span>
              <span>${formatPrice(totalCost * 0.00075)} USDT</span>
            </div>
          </div>

          {/* Execution Button */}
          <button
            onClick={handleExecute}
            disabled={isSubmitting || !numQuantity}
            className={`w-full min-h-[48px] py-3.5 rounded-xl font-black text-sm tracking-wide transition shadow-lg flex items-center justify-center gap-2 ${
              side === 'BUY'
                ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                : 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/20'
            } disabled:opacity-50`}
          >
            {isSubmitting ? (
              <span>جاري الإرسال والتنفيذ...</span>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                <span>
                  {side === 'BUY' ? 'تأكيد وتنفيذ أمر الشراء' : 'تأكيد وتنفيذ أمر البيع'}
                </span>
              </>
            )}
          </button>

          {/* Feedback message */}
          {message && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                message.type === 'success'
                  ? 'bg-emerald-950/30 text-emerald-300 border border-emerald-800/50'
                  : 'bg-rose-950/30 text-rose-300 border border-rose-800/50'
              }`}
            >
              {message.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              <span>{message.text}</span>
            </div>
          )}
        </div>

        {/* Right Col: Account Balances & Portfolio Overview */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-slate-200 font-bold text-sm mb-3">
              <Wallet className="w-4 h-4 text-amber-400" />
              <span>أرصدة المحفظة ({mode === 'paper' ? 'افتراضية' : 'بينانس'})</span>
            </div>

            <div className="space-y-2 font-mono text-xs">
              <div className="flex justify-between items-center bg-slate-900/90 px-3 py-2 rounded-lg border border-slate-800">
                <span className="text-slate-400 font-sans">سيولة USDT:</span>
                <span className="text-emerald-400 font-bold text-sm">
                  ${formatPrice(usdtBalance)}
                </span>
              </div>

              <div className="flex justify-between items-center bg-slate-900/90 px-3 py-2 rounded-lg border border-slate-800">
                <span className="text-slate-400 font-sans">رصيد {baseAsset}:</span>
                <span className="text-white font-bold">
                  {baseBalance} {baseAsset}
                </span>
              </div>

              {/* Other asset balances */}
              {account?.balances
                .filter((b) => b.asset !== 'USDT' && b.asset !== baseAsset && (b.free > 0 || b.locked > 0))
                .map((b) => (
                  <div
                    key={b.asset}
                    className="flex justify-between items-center bg-slate-900/40 px-3 py-1.5 rounded-lg text-slate-300"
                  >
                    <span>{b.asset}:</span>
                    <span className="font-semibold">{b.free}</span>
                  </div>
                ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 leading-relaxed font-sans">
            تتم معالجة جميع الأوامر من خلال محرك المطابقة المباشر، وتنعكس الصفقات فورياً على رصيدك وسجل الأوامر.
          </div>
        </div>
      </div>

      {/* Open Orders & History */}
      <div className="border-t border-slate-800 pt-4 mt-2">
        <h4 className="font-bold text-slate-200 text-sm mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          <span>الأوامر المعلقة وسجل الصفقات المنفذة</span>
        </h4>

        {account && account.recentTrades.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs font-mono">
              <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 font-sans text-xs">
                <tr>
                  <th className="py-2.5 px-3">الرمز</th>
                  <th className="py-2.5 px-3">العملية</th>
                  <th className="py-2.5 px-3">النوع</th>
                  <th className="py-2.5 px-3">سعر التنفيذ</th>
                  <th className="py-2.5 px-3">الكمية</th>
                  <th className="py-2.5 px-3">الإجمالي USDT</th>
                  <th className="py-2.5 px-3">الحالة</th>
                  <th className="py-2.5 px-3">الوقت</th>
                  <th className="py-2.5 px-3 text-left">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {account.recentTrades.map((order) => (
                  <tr key={order.orderId} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-bold text-white">{order.symbol}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`font-bold px-2 py-0.5 rounded text-[11px] ${
                          order.side === 'BUY'
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-rose-500/20 text-rose-400'
                        }`}
                      >
                        {order.side === 'BUY' ? 'شراء' : 'بيع'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{order.type}</td>
                    <td className="py-2.5 px-3 font-bold">${formatPrice(order.price)}</td>
                    <td className="py-2.5 px-3 text-slate-200">{order.quantity}</td>
                    <td className="py-2.5 px-3 text-amber-300">
                      ${formatPrice(order.cummulativeQuoteQty || order.quantity * order.price)}
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                          order.status === 'FILLED'
                            ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40'
                            : order.status === 'NEW'
                            ? 'bg-amber-950/40 text-amber-300 border border-amber-800/40'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {order.status === 'FILLED' ? 'تم التنفيذ' : order.status === 'NEW' ? 'معلق' : 'ملغي'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                      {new Date(order.time).toLocaleTimeString('ar-EG', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="py-2.5 px-3 text-left">
                      {order.status === 'NEW' && (
                        <button
                          onClick={() => handleCancelOrder(order.orderId)}
                          className="px-2 py-1 rounded bg-rose-900/30 text-rose-300 border border-rose-800/50 hover:bg-rose-900/60 transition text-[11px]"
                        >
                          إلغاء الأمر
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 text-slate-500 text-xs">
            لا توجد أوامر منفذة أو معلقة حالياً في هذا الوضع
          </div>
        )}
      </div>
    </div>
  );
};
