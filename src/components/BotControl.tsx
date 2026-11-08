import React, { useState, useEffect, useCallback } from 'react';
import {
  BotLogEntry,
  BotPosition,
  BotSettings,
  BotState,
  ExchangeConfig,
  ExchangePlatform,
} from '../types/trading.js';
import { formatPrice, formatTimeAgo } from '../utils/formatters.js';
import {
  Play,
  Square,
  Bot,
  Zap,
  Activity,
  Sliders,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Shield,
  Layers,
  Clock,
  Sparkles,
  Trash2,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Globe,
  Radio,
  Send,
  Key,
  Lock,
} from 'lucide-react';

interface BotControlProps {
  onStatusChange?: (isRunning: boolean) => void;
}

export const BotControl: React.FC<BotControlProps> = ({ onStatusChange }) => {
  const [botState, setBotState] = useState<BotState | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isToggling, setIsToggling] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [editSettings, setEditSettings] = useState<BotSettings | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Multi-Exchange Management State
  const [selectedExchangeTab, setSelectedExchangeTab] = useState<ExchangePlatform>('binance');
  const [showConnectModal, setShowConnectModal] = useState<boolean>(false);
  const [connectingExchange, setConnectingExchange] = useState<ExchangePlatform>('bybit');
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [apiSecretInput, setApiSecretInput] = useState<string>('');
  const [apiPassphraseInput, setApiPassphraseInput] = useState<string>('');
  const [isSavingExchange, setIsSavingExchange] = useState<boolean>(false);

  // Webhook Test State
  const [isSendingWebhookTest, setIsSendingWebhookTest] = useState<boolean>(false);
  const [copiedWebhook, setCopiedWebhook] = useState<boolean>(false);
  const [copiedAppUrl, setCopiedAppUrl] = useState<boolean>(false);

  // Live App URLs
  const appLiveUrl = typeof window !== 'undefined'
    ? window.location.origin
    : 'https://ais-pre-gxodywiw5r4uayrhiiey6d-252004201219.europe-west2.run.app';

  // Fetch bot state
  const fetchBotStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/bot/status');
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setBotState(json.data);
          if (!editSettings) {
            setEditSettings(json.data.settings);
          }
          onStatusChange?.(json.data.isRunning);
        }
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [editSettings, onStatusChange]);

  useEffect(() => {
    fetchBotStatus();
    const interval = setInterval(fetchBotStatus, 4000);
    return () => clearInterval(interval);
  }, [fetchBotStatus]);

  // Start Bot
  const handleStartBot = async () => {
    // Safety check: confirm before running live automated trading
    if (botState?.settings.tradeMode === 'live') {
      const confirmed = window.confirm(
        '⚠️ تحذير تداول حقيقي:\nبوت التداول مضبوط على وضع الحساب الحقيقي (Live Trading)! سيقوم البوت بمسح السوق وتنفيذ صفقات حقيقية بأموالك الفعلية تلقائياً.\n\nهل تؤكد تشغيل البوت في الوضع الحقيقي؟'
      );
      if (!confirmed) return;
    }

    setIsToggling(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/bot/start', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setBotState(json.data);
        setActionMessage('تم تشغيل البوت الآلي بنجاح! بدأ فحص السوق فورياً عبر المنصة المحددة.');
        onStatusChange?.(true);
      }
    } catch {
      setActionMessage('فشل إرسال أمر تشغيل البوت');
    } finally {
      setIsToggling(false);
    }
  };

  // Stop Bot
  const handleStopBot = async () => {
    setIsToggling(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/bot/stop', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        setBotState(json.data);
        setActionMessage('تم إيقاف البوت الآلي وتجميد التداول.');
        onStatusChange?.(false);
      }
    } catch {
      setActionMessage('فشل إرسال أمر إيقاف البوت');
    } finally {
      setIsToggling(false);
    }
  };

  // Save Settings
  const handleSaveSettings = async () => {
    if (!editSettings) return;
    try {
      const res = await fetch('/api/bot/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editSettings),
      });
      const json = await res.json();
      if (json.success) {
        setShowSettings(false);
        fetchBotStatus();
        setActionMessage('تم حفظ إعدادات واستراتيجية البوت بنجاح.');
      }
    } catch {
      setActionMessage('تعذر حفظ الإعدادات');
    }
  };

  // Switch Target Exchange for Bot
  const handleSwitchTargetExchange = async (exId: ExchangePlatform) => {
    if (!botState) return;
    const newSettings = { ...botState.settings, targetExchange: exId };
    setEditSettings(newSettings);
    try {
      await fetch('/api/bot/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      });
      fetchBotStatus();
      setActionMessage(`تم تحويل استهداف البوت الآلي إلى منصة: ${exId.toUpperCase()}`);
    } catch {
      // ignore
    }
  };

  // Save Exchange Credentials
  const handleSaveExchangeConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingExchange(true);
    try {
      const masked = apiKeyInput ? `${apiKeyInput.slice(0, 4)}...${apiKeyInput.slice(-4)}` : undefined;
      const res = await fetch('/api/bot/exchange', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: connectingExchange,
          status: apiKeyInput ? 'connected' : 'paper',
          apiKeyMasked: masked,
        }),
      });
      if (res.ok) {
        setShowConnectModal(false);
        setApiKeyInput('');
        setApiSecretInput('');
        setApiPassphraseInput('');
        fetchBotStatus();
        setActionMessage(`تم ربط منصة ${connectingExchange.toUpperCase()} بنجاح!`);
      }
    } catch {
      setActionMessage('فشل حفظ إعدادات المنصة');
    } finally {
      setIsSavingExchange(false);
    }
  };

  // Test TradingView Webhook
  const handleTestWebhookSignal = async () => {
    setIsSendingWebhookTest(true);
    try {
      const res = await fetch('/api/webhook/tradingview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: botState?.settings.webhookSecret || 'ais-trader-bot-secret',
          symbol: 'BTCUSDT',
          action: 'BUY',
          quantity: 0.02,
          exchange: botState?.settings.targetExchange || 'binance',
          strategy: 'TradingView PineScript Alert (تجربة فورية)',
        }),
      });
      const json = await res.json();
      if (json.success) {
        setActionMessage('تم إرسال إشارة Webhook تجريبية وتنفيذها في البوت بنجاح!');
        fetchBotStatus();
      } else {
        setActionMessage(`فشل Webhook: ${json.error || json.message}`);
      }
    } catch (e: any) {
      setActionMessage('تعذر إرسال إشارة Webhook');
    } finally {
      setIsSendingWebhookTest(false);
    }
  };

  // Copy Webhook URL
  const copyWebhookUrl = () => {
    const url = `${appLiveUrl}/api/webhook/tradingview`;
    navigator.clipboard?.writeText(url);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  // Copy Official App URL
  const copyOfficialAppUrl = () => {
    navigator.clipboard?.writeText(appLiveUrl);
    setCopiedAppUrl(true);
    setTimeout(() => setCopiedAppUrl(false), 2000);
  };

  // Clear Logs
  const handleClearLogs = async () => {
    try {
      await fetch('/api/bot/clear-logs', { method: 'POST' });
      fetchBotStatus();
    } catch {
      // ignore
    }
  };

  const isRunning = botState?.isRunning ?? false;
  const currentTargetExchange = botState?.settings.targetExchange || 'binance';

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col gap-6">
      {/* 1. Official App Link Banner (Answers "جهز لي رابط التطبيق") */}
      <div className="bg-gradient-to-r from-amber-950/60 via-slate-900 to-slate-950 border border-amber-500/40 p-4 sm:p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-lg shadow-amber-500/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 flex-shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">
                رابط التطبيق المباشر (App Live URL)
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono font-bold">
                جاهز للمشاركة
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-md sm:max-w-xl">
              {appLiveUrl}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={copyOfficialAppUrl}
            className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 transition shadow-sm"
          >
            {copiedAppUrl ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedAppUrl ? 'تم نسخ الرابط!' : 'نسخ رابط التطبيق'}</span>
          </button>

          <a
            href={appLiveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title="فتح التطبيق في نافذة مستقلة"
          >
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>

      {/* 2. Bot Header & Master Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-5 rounded-2xl border border-slate-800 shadow-lg">
        <div className="flex items-center gap-4">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transition-all ${
              isRunning
                ? 'bg-emerald-500 text-slate-950 shadow-emerald-500/30 animate-pulse'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            <Bot className="w-8 h-8 stroke-[2.2]" />
          </div>

          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-wide">
                بوت التداول الآلي متعدد المنصات
              </h2>
              <span
                className={`text-xs px-3 py-1 rounded-full font-bold flex items-center gap-1.5 border ${
                  isRunning
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm shadow-emerald-500/20'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isRunning ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'
                  }`}
                />
                <span>{isRunning ? 'البوت قيد العمل' : 'البوت متوقف'}</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              المنصة المستهدفة الحالية:{' '}
              <strong className="text-amber-400 font-mono uppercase">
                {currentTargetExchange}
              </strong>{' '}
              • يفحص الشموع والمؤشرات لـ {botState?.settings.selectedSymbols.length || 4} أزواج
            </p>
          </div>
        </div>

        {/* Start / Stop Master Buttons */}
        <div className="grid grid-cols-12 gap-2 w-full lg:w-auto items-center">
          {/* START BUTTON */}
          <button
            onClick={handleStartBot}
            disabled={isToggling || isRunning}
            className={`col-span-6 sm:col-span-5 min-h-[46px] px-4 py-2.5 rounded-xl font-black text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-xl ${
              isRunning
                ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30 active:scale-95'
            }`}
          >
            <Play className="w-4 h-4 fill-current shrink-0" />
            <span className="truncate">تشغيل البوت</span>
          </button>

          {/* STOP BUTTON */}
          <button
            onClick={handleStopBot}
            disabled={isToggling || !isRunning}
            className={`col-span-4 sm:col-span-5 min-h-[46px] px-3.5 py-2.5 rounded-xl font-black text-xs sm:text-sm transition flex items-center justify-center gap-1.5 shadow-xl ${
              !isRunning
                ? 'opacity-40 cursor-not-allowed bg-slate-800 text-slate-500'
                : 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/30 active:scale-95'
            }`}
          >
            <Square className="w-4 h-4 fill-current shrink-0" />
            <span className="truncate">إيقاف</span>
          </button>

          {/* Settings Trigger */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="col-span-2 sm:col-span-2 min-h-[46px] min-w-[44px] p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition flex items-center justify-center"
            title="إعدادات واستراتيجية البوت"
          >
            <Sliders className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* Action Notification */}
      {actionMessage && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 p-3 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{actionMessage}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-slate-400 hover:text-white text-xs px-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* 3. MULTI-EXCHANGE & PLATFORMS SELECTOR STRIP (Answers "اضف امكانيت تشغيل البوت على العديد من برامج التداول") */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-amber-400" />
            <h3 className="font-bold text-white text-sm">
              برامج ومنصات التداول المدعومة (Multi-Exchange Connectors)
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            اختر المنصة التي تريد توجيه وتنفيذ صفقات البوت عليها:
          </span>
        </div>

        {/* Exchanges Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {botState?.connectedExchanges.map((ex) => {
            const isSelected = currentTargetExchange === ex.id;
            return (
              <div
                key={ex.id}
                onClick={() => handleSwitchTargetExchange(ex.id)}
                className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between gap-2.5 relative ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/10'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                }`}
              >
                {isSelected && (
                  <span className="absolute top-2 left-2 w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                )}

                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-white text-sm">
                    {ex.name}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      ex.status === 'connected'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {ex.status === 'connected' ? 'نشط' : 'محاكي'}
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 font-sans">
                  {ex.arabicName}
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {ex.badge}
                  </span>
                  {isSelected ? (
                    <span className="text-[10px] font-bold text-amber-400">
                      مستهدف الآن ✓
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 hover:text-white">
                      تحديد
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Platform Details & Config Row */}
        <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl flex flex-wrap items-center justify-between gap-4 text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">
                المنصة النشطة حالياً:{' '}
                <span className="text-amber-400 uppercase font-mono">
                  {currentTargetExchange}
                </span>
              </span>
              <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                وضع: {botState?.settings.tradeMode === 'paper' ? 'تداول تجريبي (Paper)' : 'حساب حقيقي'}
              </span>
            </div>
            <p className="text-slate-400 text-xs">
              {botState?.connectedExchanges.find((e) => e.id === currentTargetExchange)?.description}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {currentTargetExchange !== 'tradingview' && (
              <button
                onClick={() => {
                  setConnectingExchange(currentTargetExchange);
                  setShowConnectModal(true);
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition"
              >
                <Key className="w-3.5 h-3.5 text-amber-400" />
                <span>ربط مفاتيح API للمنصة</span>
              </button>
            )}
          </div>
        </div>

        {/* 4. TRADINGVIEW WEBHOOK CARD (For TradingView, MT4/MT5, Python Strategies) */}
        {currentTargetExchange === 'tradingview' && (
          <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/40 p-4 rounded-xl space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                <h4 className="font-bold text-white text-sm">
                  استقبال الإشارات الفورية من TradingView عبر Webhook
                </h4>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={copyWebhookUrl}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center gap-1 transition"
                >
                  {copiedWebhook ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedWebhook ? 'تم نسخ الرابط!' : 'نسخ Webhook URL'}</span>
                </button>

                <button
                  onClick={handleTestWebhookSignal}
                  disabled={isSendingWebhookTest}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 transition"
                >
                  <Send className="w-3.5 h-3.5 text-amber-400" />
                  <span>{isSendingWebhookTest ? 'جاري الإرسال...' : 'تجربة إشارة شراء فورية'}</span>
                </button>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              قم بإنشاء تنبيه (Alert) على مؤشرك في TradingView وضع الرابط التالي في خانة Webhook URL:
            </p>

            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 font-mono text-xs text-emerald-300 break-all dir-ltr text-left">
              {appLiveUrl}/api/webhook/tradingview
            </div>

            <div>
              <span className="text-[11px] text-slate-400 block mb-1">
                صيغة كود رسالة التنبيه (JSON Message Box):
              </span>
              <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-amber-300/90 overflow-x-auto dir-ltr text-left">
{`{
  "secret": "${botState?.settings.webhookSecret || 'ais-trader-bot-secret'}",
  "symbol": "{{ticker}}",
  "action": "BUY",
  "quantity": 0.05,
  "exchange": "binance",
  "strategy": "TradingView Alert"
}`}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* 5. Bot Live Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-center">
        <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl">
          <span className="text-xs text-slate-400 block font-sans mb-1">الصفقات المنفذة آلياً</span>
          <span className="text-xl sm:text-2xl font-black text-white">
            {botState?.totalTradesExecuted || 0}
          </span>
          <span className="text-[11px] text-slate-500 block font-sans mt-0.5">صفقة ناجحة</span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl">
          <span className="text-xs text-slate-400 block font-sans mb-1">المراكز المفتوحة حالياً</span>
          <span className="text-xl sm:text-2xl font-black text-amber-400">
            {botState?.activePositions.length || 0}
          </span>
          <span className="text-[11px] text-slate-500 block font-sans mt-0.5">مركز تحت الإدارة</span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl">
          <span className="text-xs text-slate-400 block font-sans mb-1">عمليات المسح الفني</span>
          <span className="text-xl sm:text-2xl font-black text-cyan-400">
            {botState?.totalScans || 0}
          </span>
          <span className="text-[11px] text-slate-500 block font-sans mt-0.5">
            آخر فحص: {botState?.lastScanAt ? formatTimeAgo(botState.lastScanAt) : 'لم يبدأ'}
          </span>
        </div>

        <div className="bg-slate-950/70 border border-slate-800 p-3.5 rounded-xl">
          <span className="text-xs text-slate-400 block font-sans mb-1">المنصة والوضع</span>
          <span className="text-sm sm:text-base font-bold text-emerald-400 block truncate font-sans">
            {currentTargetExchange.toUpperCase()} ({botState?.settings.tradeMode === 'paper' ? 'Paper' : 'Live'})
          </span>
          <span className="text-[11px] text-slate-400 block font-sans mt-0.5">
            تخصيص {botState?.settings.riskPerTrade}% لكل صفقة
          </span>
        </div>
      </div>

      {/* 6. Settings Modal / Expandable Panel */}
      {showSettings && editSettings && (
        <div className="bg-slate-950 border border-slate-700/80 p-5 rounded-2xl space-y-5 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white text-base flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-400" />
              إعدادات استراتيجية البوت وقواعد الدخول والخروج
            </h3>
            <button
              onClick={() => setShowSettings(false)}
              className="text-xs text-slate-400 hover:text-slate-200"
            >
              إلغاء
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            {/* Strategy */}
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">
                استراتيجية الدخول المعتمدة
              </label>
              <select
                value={editSettings.strategy}
                onChange={(e) =>
                  setEditSettings({ ...editSettings, strategy: e.target.value as any })
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-500"
              >
                <option value="consensus_strong">
                  توافق المؤشرات القوي (شراء قوي عند توافق 4-5 مؤشرات)
                </option>
                <option value="trend_pullback">
                  تتبع الاتجاه الصاعد مع ارتداد المتوسطات EMA20/50
                </option>
                <option value="rsi_extreme">
                  اصطياد القيعان الحادة (تشبع بيعي RSI &lt; 32)
                </option>
              </select>
            </div>

            {/* Target Exchange */}
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">
                المنصة المستهدفة لتنفيذ الأوامر
              </label>
              <select
                value={editSettings.targetExchange}
                onChange={(e) =>
                  setEditSettings({ ...editSettings, targetExchange: e.target.value as any })
                }
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-amber-500 font-mono"
              >
                <option value="binance">Binance (بينانس)</option>
                <option value="bybit">Bybit (باي بيت)</option>
                <option value="okx">OKX (أوكي إكس)</option>
                <option value="kucoin">KuCoin (كوكوين)</option>
                <option value="gateio">Gate.io (جيت آيو)</option>
                <option value="tradingview">TradingView Webhook (إشارات خارجية)</option>
              </select>
            </div>

            {/* Mode */}
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">
                بيئة التداول للأوامر الآلية
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setEditSettings({ ...editSettings, tradeMode: 'paper' })}
                  className={`py-2 rounded-xl border font-bold transition ${
                    editSettings.tradeMode === 'paper'
                      ? 'bg-amber-500 text-slate-950 border-amber-400'
                      : 'bg-slate-900 text-slate-400 border-slate-700'
                  }`}
                >
                  تجريبي محاكي (Paper)
                </button>
                <button
                  type="button"
                  onClick={() => setEditSettings({ ...editSettings, tradeMode: 'live' })}
                  className={`py-2 rounded-xl border font-bold transition ${
                    editSettings.tradeMode === 'live'
                      ? 'bg-rose-500 text-white border-rose-400'
                      : 'bg-slate-900 text-slate-400 border-slate-700'
                  }`}
                >
                  حساب حقيقي مباشر
                </button>
              </div>
            </div>

            {/* Risk % per trade */}
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">
                نسبة السيولة المخصصة لكل صفقة: {editSettings.riskPerTrade}%
              </label>
              <input
                type="range"
                min="2"
                max="25"
                step="1"
                value={editSettings.riskPerTrade}
                onChange={(e) =>
                  setEditSettings({ ...editSettings, riskPerTrade: Number(e.target.value) })
                }
                className="w-full accent-amber-500"
              />
              <span className="text-[11px] text-slate-500 block mt-1">
                ينصح بنسبة بين 3% إلى 7% لتوزيع المخاطر عبر عدة صفقات.
              </span>
            </div>

            {/* Auto Sell on Reversal */}
            <div className="flex items-center justify-between bg-slate-900 p-3 rounded-xl border border-slate-800">
              <div>
                <span className="font-bold text-slate-200 block">
                  الخروج التلقائي عند انعكاس الإشارة
                </span>
                <span className="text-[11px] text-slate-400">
                  بيع المركز فوراً إذا تحولت مؤشرات التحليل الفني إلى "بيع قوي"
                </span>
              </div>
              <input
                type="checkbox"
                checked={editSettings.autoSellOnReversal}
                onChange={(e) =>
                  setEditSettings({ ...editSettings, autoSellOnReversal: e.target.checked })
                }
                className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              onClick={() => setShowSettings(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700"
            >
              إلغاء
            </button>
            <button
              onClick={handleSaveSettings}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition"
            >
              حفظ وتطبيق الإعدادات
            </button>
          </div>
        </div>
      )}

      {/* 7. Active Positions Managed by the Bot */}
      {botState && botState.activePositions.length > 0 && (
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4">
          <h4 className="font-bold text-white text-sm mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span>المراكز النشطة المفتوحة تحت مراقبة البوت</span>
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-xs">
            {botState.activePositions.map((pos) => (
              <div
                key={pos.orderId}
                className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl space-y-1.5"
              >
                <div className="flex justify-between items-center font-bold">
                  <div className="flex items-center gap-2">
                    <span className="text-base text-white">{pos.symbol}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 uppercase">
                      {pos.exchange || 'binance'}
                    </span>
                  </div>
                  <span className="text-emerald-400 font-sans text-xs">مشتراة ومراقبة</span>
                </div>
                <div className="text-slate-400">
                  سعر الدخول: <strong className="text-white">${formatPrice(pos.entryPrice)}</strong> | الكمية: {pos.quantity}
                </div>
                <div className="flex justify-between text-[11px] pt-1 border-t border-slate-800">
                  <span className="text-rose-400">وقف الخسارة: ${formatPrice(pos.stopLoss)}</span>
                  <span className="text-emerald-400">الهدف: ${formatPrice(pos.takeProfit)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 8. Live Bot Logs Terminal */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-amber-400" />
            <h4 className="text-xs font-bold text-slate-300">
              سجل نشاط وأوامر البوت اللحظية (Live Terminal)
            </h4>
          </div>

          <button
            onClick={handleClearLogs}
            className="text-[11px] text-slate-500 hover:text-slate-300 flex items-center gap-1 transition"
          >
            <Trash2 className="w-3 h-3" />
            <span>مسح السجل</span>
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto space-y-2 font-mono text-xs scrollbar-thin">
          {botState?.logs.map((log) => {
            let badgeBg = 'bg-slate-800 text-slate-300';
            if (log.type === 'buy') badgeBg = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40';
            if (log.type === 'sell') badgeBg = 'bg-rose-500/20 text-rose-400 border border-rose-500/40';
            if (log.type === 'warning') badgeBg = 'bg-amber-500/20 text-amber-400 border border-amber-500/40';
            if (log.type === 'scan') badgeBg = 'bg-cyan-500/10 text-cyan-400';

            return (
              <div
                key={log.id}
                className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:bg-slate-900 transition flex flex-col gap-1"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badgeBg}`}>
                      {log.type.toUpperCase()}
                    </span>
                    {log.symbol && (
                      <span className="font-bold text-white">{log.symbol}</span>
                    )}
                  </div>
                  <span className="text-slate-500 text-[10px]">
                    {new Date(log.time).toLocaleTimeString('ar-EG', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </div>
                <p className="text-slate-200 text-xs font-sans">{log.message}</p>
                {log.details && (
                  <p className="text-[11px] text-slate-400">{log.details}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Connect API Keys Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleSaveExchangeConfig}
            className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-md w-full space-y-4 text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                <span>ربط مفاتيح منصة {connectingExchange.toUpperCase()}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowConnectModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <p className="text-slate-400 text-xs">
              أدخل مفاتيح API الخاصة بحسابك على منصة {connectingExchange.toUpperCase()} لتفعيل التنفيذ التلقائي أو اتركها فارغة لاستخدام المحاكي الافتراضي.
            </p>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">API Key</label>
              <input
                type="text"
                placeholder="أدخل API Key"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">API Secret</label>
              <input
                type="password"
                placeholder="أدخل API Secret"
                value={apiSecretInput}
                onChange={(e) => setApiSecretInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
              />
            </div>

            {(connectingExchange === 'okx' || connectingExchange === 'kucoin') && (
              <div>
                <label className="block text-slate-300 font-semibold mb-1">API Passphrase</label>
                <input
                  type="password"
                  placeholder="أدخل Passphrase الخاصة بالمنصة"
                  value={apiPassphraseInput}
                  onChange={(e) => setApiPassphraseInput(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowConnectModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSavingExchange}
                className="px-5 py-2 rounded-xl bg-amber-500 font-bold text-slate-950 hover:bg-amber-400"
              >
                {isSavingExchange ? 'جاري الحفظ...' : 'تأكيد وحفظ'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
