import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TickerData } from './types/market.js';
import { PriceAlert } from './types/journal.js';
import { Navbar } from './components/Navbar.js';
import { Watchlist } from './components/Watchlist.js';
import { AssetDetail } from './components/AssetDetail.js';
import { RiskCalculator } from './components/RiskCalculator.js';
import { EducationalGuide } from './components/EducationalGuide.js';
import { PrivacyPolicy } from './components/PrivacyPolicy.js';
import { TradingPanel } from './components/TradingPanel.js';
import { BotControl } from './components/BotControl.js';
import { AlertsManager } from './components/AlertsManager.js';
import { TradeJournal } from './components/TradeJournal.js';
import { SettingsPage } from './components/SettingsPage.js';
import { formatTimeAgo } from './utils/formatters.js';
import { audioAlert } from './utils/audioAlert.js';
import {
  AlertCircle,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  WifiOff,
  Bot,
  Play,
  Square,
  ArrowRight,
  Bell,
} from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<'watchlist' | 'detail' | 'trade' | 'bot' | 'alerts' | 'journal' | 'calculator' | 'guide' | 'settings' | 'privacy'>('watchlist');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTCUSDT');
  const [tickers, setTickers] = useState<TickerData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isBotRunning, setIsBotRunning] = useState<boolean>(false);
  const [triggeredNotification, setTriggeredNotification] = useState<PriceAlert | null>(null);
  const acknowledgedAlertsRef = useRef<Set<string>>(new Set());

  // Check Bot Status
  const checkBotStatus = useCallback(async () => {
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

  // Quick Toggle Bot (Start / Stop)
  const handleToggleBot = async () => {
    try {
      const endpoint = isBotRunning ? '/api/bot/stop' : '/api/bot/start';
      const res = await fetch(endpoint, { method: 'POST' });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setIsBotRunning(json.data.isRunning);
        }
      }
    } catch {
      // ignore
    }
  };

  // Fetch watchlist from backend
  const fetchWatchlist = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/watchlist');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `خطأ في الاتصال (${res.status})`);
      }
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setTickers(json.data);
        setLastUpdated(json.timestamp || Date.now());
        setErrorMsg(null);
      } else {
        throw new Error(json.error || 'تعذر استلام بيانات الأسعار');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'تعذر الاتصال بخادم بينانس للأسعار');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Check triggered alerts for live toasts
  const checkAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          const triggered = (json.data as PriceAlert[]).find(
            (a) => a.isTriggered && !acknowledgedAlertsRef.current.has(a.id)
          );
          if (triggered) {
            acknowledgedAlertsRef.current.add(triggered.id);
            setTriggeredNotification(triggered);
            audioAlert.playAlertChime();
          }
        }
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchWatchlist();
    checkBotStatus();
    checkAlerts();
    // Auto-refresh watchlist every 10 seconds (backend has 5s cache)
    const intervalId = setInterval(fetchWatchlist, 10000);
    const botInterval = setInterval(checkBotStatus, 4000);
    const alertInterval = setInterval(checkAlerts, 8000);
    return () => {
      clearInterval(intervalId);
      clearInterval(botInterval);
      clearInterval(alertInterval);
    };
  }, [fetchWatchlist, checkBotStatus, checkAlerts]);

  // Handle asset selection from watchlist or selector
  const handleSelectSymbol = (sym: string) => {
    setSelectedSymbol(sym);
    setCurrentTab('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResetPaper = async () => {
    try {
      await fetch('/api/trade/reset-paper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialUsdt: 10000 }),
      });
      fetchWatchlist();
      alert('تمت استعادة رصيد 10,000 USDT في المحفظة التجريبية بنجاح.');
    } catch {
      // ignore
    }
  };

  const currentSelectedTicker = tickers.find((t) => t.symbol === selectedSymbol);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500/20 selection:text-amber-300">
      {/* Navigation Header */}
      <Navbar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        selectedSymbol={selectedSymbol}
        isBotRunning={isBotRunning}
        onToggleBot={handleToggleBot}
        topTickers={tickers}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Error message banner if backend is unreachable */}
        {errorMsg && (
          <div className="mb-6 p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60 flex items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3 text-rose-300">
              <WifiOff className="w-5 h-5 flex-shrink-0" />
              <div>
                <strong className="font-bold block text-sm">تعذر الاتصال ببيانات السوق المباشرة</strong>
                <span>{errorMsg} • آخر تحديث {formatTimeAgo(lastUpdated)} (لا يتم عرض بيانات وهمية)</span>
              </div>
            </div>
            <button
              onClick={fetchWatchlist}
              className="px-3.5 py-1.5 rounded-xl bg-rose-800 hover:bg-rose-700 text-white font-bold transition flex items-center gap-1.5 flex-shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>إعادة المحاولة</span>
            </button>
          </div>
        )}

        {/* Active Bot Running Persistent Alert Banner */}
        {isBotRunning && currentTab !== 'bot' && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-950 border border-emerald-500/40 flex flex-wrap items-center justify-between gap-4 shadow-lg shadow-emerald-500/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40 flex-shrink-0">
                <Bot className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm">بوت التداول الآلي قيد العمل والمسح الآن</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black animate-pulse">
                    نشط
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  يقوم البوت بمسح شموع ومؤشرات العملات تلقائياً وتنفيذ أوامر الشراء وجني الأرباح ووقف الخسارة.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => setCurrentTab('bot')}
                className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition flex items-center justify-center"
              >
                عرض لوحة وسجل البوت
              </button>
              <button
                onClick={handleToggleBot}
                className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2 rounded-xl text-xs font-black bg-rose-500 hover:bg-rose-600 text-white transition flex items-center justify-center gap-1.5 shadow-md shadow-rose-500/20"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>إيقاف البوت</span>
              </button>
            </div>
          </div>
        )}

        {/* Live Triggered Price Alert Toast Banner */}
        {triggeredNotification && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-amber-950/80 via-slate-900 to-amber-950/80 border-2 border-amber-500 flex flex-wrap items-center justify-between gap-4 shadow-xl shadow-amber-500/10 animate-in slide-in-from-top-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold flex-shrink-0 animate-bounce">
                <Bell className="w-5 h-5 fill-current" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white text-sm truncate">
                    🔔 تحقق تنبيه السعر اللحظي: {triggeredNotification.symbol}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black animate-pulse shrink-0">
                    مباشر
                  </span>
                </div>
                <p className="text-xs text-amber-200/90 font-mono truncate">
                  {triggeredNotification.conditionDescription}
                  {triggeredNotification.note && ` • "${triggeredNotification.note}"`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <button
                onClick={() => {
                  handleSelectSymbol(triggeredNotification.symbol);
                  setTriggeredNotification(null);
                }}
                className="flex-1 sm:flex-initial min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition shadow-md shadow-amber-500/20 flex items-center justify-center"
              >
                عرض الرسم والتحليل
              </button>
              <button
                onClick={() => setTriggeredNotification(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 transition border border-slate-700 flex items-center justify-center"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}

        {/* Tab Views */}
        {currentTab === 'watchlist' && (
          <Watchlist
            tickers={tickers}
            selectedSymbol={selectedSymbol}
            onSelectSymbol={handleSelectSymbol}
            isLoading={isLoading}
            onRefresh={fetchWatchlist}
            lastUpdated={lastUpdated}
          />
        )}

        {currentTab === 'detail' && (
          <AssetDetail
            symbol={selectedSymbol}
            onBackToWatchlist={() => setCurrentTab('watchlist')}
          />
        )}

        {currentTab === 'bot' && (
          <BotControl onStatusChange={setIsBotRunning} />
        )}

        {currentTab === 'trade' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <TradingPanel
              symbol={selectedSymbol}
              currentPrice={currentSelectedTicker?.price || (tickers.length > 0 ? tickers[0].price : 0)}
              onOrderExecuted={() => {
                fetchWatchlist();
              }}
            />
          </div>
        )}

        {currentTab === 'alerts' && <AlertsManager />}

        {currentTab === 'journal' && <TradeJournal />}

        {currentTab === 'calculator' && (
          <RiskCalculator
            selectedSymbol={selectedSymbol}
            initialPrice={currentSelectedTicker?.price}
          />
        )}

        {currentTab === 'guide' && <EducationalGuide />}

        {currentTab === 'settings' && (
          <SettingsPage onResetPaper={handleResetPaper} />
        )}

        {currentTab === 'privacy' && <PrivacyPolicy />}
      </main>

      {/* Mandatory Financial Disclaimer & Safety Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/90 py-5 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-slate-400">
            <ShieldAlert className="w-4 h-4 text-amber-500/80 flex-shrink-0" />
            <span className="font-medium text-[11px] sm:text-xs">
              التحليل الفني وأدوات التداول لأغراض تعليمية وإرشادية • تأكد من إدارة رأس مالك ومخاطرك بدقة.
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-400 text-xs">
            <button
              onClick={() => setCurrentTab('privacy')}
              className="hover:text-amber-400 transition underline underline-offset-4"
            >
              سياسة الخصوصية والأمان
            </button>
            <span>•</span>
            <span className="font-mono text-[11px] text-slate-500">
              Binance Public API v3
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
