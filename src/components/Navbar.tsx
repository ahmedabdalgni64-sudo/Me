import React, { useState, useEffect, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Shield,
  Wifi,
  BarChart3,
  BookOpen,
  Calculator,
  Lock,
  Layers,
  Bot,
  Play,
  Square,
  Bell,
  BookMarked,
  Settings,
  Share2,
  Copy,
  Check,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { audioAlert } from '../utils/audioAlert.js';
import { TickerData } from '../types/market.js';
import { formatPercent, formatPrice } from '../utils/formatters.js';

interface NavbarProps {
  currentTab: 'watchlist' | 'detail' | 'trade' | 'bot' | 'alerts' | 'journal' | 'calculator' | 'guide' | 'settings' | 'privacy';
  onSelectTab: (tab: 'watchlist' | 'detail' | 'trade' | 'bot' | 'alerts' | 'journal' | 'calculator' | 'guide' | 'settings' | 'privacy') => void;
  selectedSymbol: string;
  isBotRunning?: boolean;
  onToggleBot?: () => void;
  topTickers?: TickerData[];
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  selectedSymbol,
  isBotRunning = false,
  onToggleBot,
  topTickers = [],
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Copy app share URL
  const handleCopyLink = async () => {
    try {
      const url = window.location.href;
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      } else {
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      // fallback
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    audioAlert.setSoundEnabled(isMuted); // if was muted, now enable
  };

  const mobileActiveTabRef = useRef<HTMLButtonElement | null>(null);

  // Auto-scroll active tab into view on mobile
  useEffect(() => {
    if (mobileActiveTabRef.current) {
      mobileActiveTabRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [currentTab]);

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/95 backdrop-blur-md sticky top-0 z-50">
      {/* Top Live Ticker Tape Bar */}
      {topTickers.length > 0 && (
        <div className="bg-slate-900/90 border-b border-slate-800/60 py-1.5 px-3 overflow-x-auto text-[11px] font-mono no-scrollbar flex items-center gap-4 justify-between">
          <div className="flex items-center gap-4 overflow-x-auto whitespace-nowrap no-scrollbar">
            <span className="text-[10px] uppercase font-bold text-slate-400 font-sans flex items-center gap-1.5 shrink-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              بينانس مباشر:
            </span>
            {topTickers.slice(0, 8).map((t) => {
              const isPos = t.priceChangePercent24h >= 0;
              return (
                <button
                  key={t.symbol}
                  onClick={() => onSelectTab('detail')}
                  className="inline-flex items-center gap-1.5 hover:opacity-80 transition shrink-0 text-right"
                >
                  <span className="text-slate-300 font-bold">{t.symbol.replace('USDT', '')}</span>
                  <span className="text-slate-100 font-semibold">${formatPrice(t.price)}</span>
                  <span className={`text-[10px] flex items-center font-bold ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isPos ? '+' : ''}{t.priceChangePercent24h.toFixed(2)}%
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick Share Link in Ticker Bar (Hidden on tiny screens) */}
          <div className="hidden md:flex items-center gap-2 shrink-0">
            <button
              onClick={handleCopyLink}
              className="text-[11px] font-sans px-3 py-1 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition flex items-center gap-1.5"
              title="نسخ رابط التطبيق للمشاركة"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'تم نسخ الرابط!' : 'رابط التطبيق'}</span>
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* DESKTOP & TABLET HEADER (sm:flex) */}
        <div className="hidden sm:flex items-center justify-between h-16 gap-4">
          {/* Logo & Brand */}
          <div
            className="flex items-center gap-3 cursor-pointer shrink-0"
            onClick={() => onSelectTab('watchlist')}
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 shrink-0">
              <BarChart3 className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-black text-lg lg:text-xl text-white tracking-tight leading-snug">
                  رادار العملات
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  Coin Radar Pro
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-tight mt-0.5">
                تحليل لحظي للأسواق الرقمية • مؤشرات فنية • بوت تداول تجريبي
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1 text-xs font-semibold">
            <button
              onClick={() => onSelectTab('watchlist')}
              className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 ${
                currentTab === 'watchlist'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>المتابعة</span>
            </button>

            <button
              onClick={() => onSelectTab('detail')}
              className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 ${
                currentTab === 'detail'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>الرسم والمؤشرات</span>
            </button>

            <button
              onClick={() => onSelectTab('bot')}
              className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 ${
                currentTab === 'bot'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Bot className="w-4 h-4 text-amber-400" />
              <span>بوت التداول</span>
              {isBotRunning && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              )}
            </button>

            <button
              onClick={() => onSelectTab('trade')}
              className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 ${
                currentTab === 'trade'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span>التداول اليدوي</span>
            </button>

            <button
              onClick={() => onSelectTab('alerts')}
              className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 ${
                currentTab === 'alerts'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Bell className="w-4 h-4 text-cyan-400" />
              <span>التنبيهات</span>
            </button>

            <button
              onClick={() => onSelectTab('journal')}
              className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 ${
                currentTab === 'journal'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <BookMarked className="w-4 h-4 text-purple-400" />
              <span>سجل الصفقات</span>
            </button>

            <button
              onClick={() => onSelectTab('calculator')}
              className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 ${
                currentTab === 'calculator'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Calculator className="w-4 h-4" />
              <span>حاسبة المخاطر</span>
            </button>

            <button
              onClick={() => onSelectTab('guide')}
              className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 ${
                currentTab === 'guide'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>التعليم</span>
            </button>

            <button
              onClick={() => onSelectTab('settings')}
              className={`px-3 py-2 rounded-xl transition flex items-center gap-1.5 ${
                currentTab === 'settings'
                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>الإعدادات</span>
            </button>
          </nav>

          {/* Quick Actions (Audio, Share, Start/Stop Bot) */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={toggleMute}
              className={`min-h-[44px] min-w-[44px] p-2.5 rounded-xl border text-xs transition flex items-center justify-center ${
                isMuted
                  ? 'bg-rose-950/40 text-rose-400 border-rose-800/60'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
              }`}
              title={isMuted ? 'تفعيل أصوات التنبيهات' : 'كتم أصوات التنبيهات'}
            >
              {isMuted ? <VolumeX className="w-4.5 h-4.5" /> : <Volume2 className="w-4.5 h-4.5" />}
            </button>

            <button
              onClick={handleCopyLink}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${
                copiedLink
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white hover:bg-slate-800'
              }`}
              title="نسخ رابط التطبيق المباشر"
            >
              {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
              <span>{copiedLink ? 'تم النسخ!' : 'رابط التطبيق'}</span>
            </button>

            {onToggleBot && (
              <button
                onClick={onToggleBot}
                className={`min-h-[44px] flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition shadow-md ${
                  isBotRunning
                    ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/30 animate-pulse'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30'
                }`}
                title={isBotRunning ? 'اضغط لإيقاف البوت' : 'اضغط لتشغيل البوت'}
              >
                {isBotRunning ? (
                  <>
                    <Square className="w-4 h-4 fill-current" />
                    <span>إيقاف البوت</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current" />
                    <span>تشغيل البوت</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* MOBILE SPECIFIC HEADER (sm:hidden) - Strictly 2 Rows */}
        <div className="sm:hidden py-2.5 flex flex-col gap-2.5">
          {/* Row 1: Brand Wordmark & Title + Live Status Badge */}
          <div className="flex items-center justify-between gap-2">
            <div
              className="flex items-center gap-2.5 cursor-pointer min-w-0"
              onClick={() => onSelectTab('watchlist')}
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-slate-950 shadow-md shadow-amber-500/20 shrink-0">
                <BarChart3 className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h1 className="font-black text-base text-white tracking-tight truncate leading-tight">
                    رادار العملات
                  </h1>
                </div>
                {/* Solved Title / Description Overlap: Clean block with clear line-height and margin */}
                <p className="text-[10px] text-slate-400 truncate leading-tight mt-0.5">
                  Coin Radar • تحليل فني وبوت تداول
                </p>
              </div>
            </div>

            {/* Live Indicator Pill on Mobile Row 1 */}
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-400 font-bold shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>LIVE</span>
            </div>
          </div>

          {/* Row 2: Action Buttons (Two-Col Grid: Big Bot Start/Stop + Share + Sound) */}
          <div className="grid grid-cols-12 gap-1.5 pt-0.5">
            {/* Primary Bot Button (7 columns on mobile for dominant touch target) */}
            {onToggleBot && (
              <button
                onClick={onToggleBot}
                className={`col-span-6 min-h-[44px] flex items-center justify-center gap-1.5 px-2.5 py-2.5 rounded-xl text-xs font-black transition shadow-md ${
                  isBotRunning
                    ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/30 animate-pulse'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/30'
                }`}
                title={isBotRunning ? 'اضغط لإيقاف البوت' : 'اضغط لتشغيل البوت'}
              >
                {isBotRunning ? (
                  <>
                    <Square className="w-4 h-4 fill-current shrink-0" />
                    <span className="truncate">إيقاف البوت</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-current shrink-0" />
                    <span className="truncate">تشغيل البوت</span>
                  </>
                )}
              </button>
            )}

            {/* Share App Link Button (4 columns on mobile) */}
            <button
              onClick={handleCopyLink}
              className={`col-span-4 min-h-[44px] px-2 py-2.5 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1 ${
                copiedLink
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                  : 'bg-slate-900 text-slate-200 border-slate-800 hover:bg-slate-800'
              }`}
              title="نسخ رابط التطبيق"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Share2 className="w-3.5 h-3.5 shrink-0" />}
              <span className="truncate">{copiedLink ? 'تم النسخ!' : 'رابط التطبيق'}</span>
            </button>

            {/* Mute/Sound Toggle (2 columns on mobile) */}
            <button
              onClick={toggleMute}
              className={`col-span-2 min-h-[44px] p-2.5 rounded-xl border text-xs transition flex items-center justify-center ${
                isMuted
                  ? 'bg-rose-950/40 text-rose-400 border-rose-800/60'
                  : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
              }`}
              title={isMuted ? 'تفعيل أصوات التنبيهات' : 'كتم أصوات التنبيهات'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* MOBILE HORIZONTALLY SCROLLABLE TABS BAR (sm:hidden) */}
        <nav
          aria-label="أقسام التطبيق"
          className="sm:hidden flex overflow-x-auto no-scrollbar scroll-smooth py-2 -mx-3 px-3 gap-1.5 border-t border-slate-800/80 bg-slate-950/60 text-xs font-semibold"
        >
          {[
            { id: 'watchlist', label: 'المتابعة', icon: BarChart3 },
            { id: 'detail', label: 'الرسم والمؤشرات', icon: Layers },
            { id: 'bot', label: 'بوت التداول', icon: Bot, isBot: true },
            { id: 'trade', label: 'التداول اليدوي', icon: TrendingUp },
            { id: 'alerts', label: 'التنبيهات', icon: Bell },
            { id: 'journal', label: 'سجل الصفقات', icon: BookMarked },
            { id: 'calculator', label: 'الحاسبة', icon: Calculator },
            { id: 'guide', label: 'التعليم', icon: BookOpen },
            { id: 'settings', label: 'الإعدادات', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={isActive ? mobileActiveTabRef : null}
                onClick={() => onSelectTab(tab.id as any)}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl whitespace-nowrap shrink-0 flex items-center gap-1.5 transition text-xs font-bold border ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/25 font-black'
                    : 'bg-slate-900/90 text-slate-300 hover:text-white border-slate-800/90 hover:bg-slate-850'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-slate-950 stroke-[2.5]' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
                {tab.isBot && isBotRunning && (
                  <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-slate-950' : 'bg-emerald-400'} animate-ping shrink-0`}></span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
