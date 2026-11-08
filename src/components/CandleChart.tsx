import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Candle } from '../types/market.js';
import { PriceAlert } from '../types/journal.js';
import { formatPercent, formatPrice, formatVolume } from '../utils/formatters.js';
import { QuickAlertModal } from './QuickAlertModal.js';
import {
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  RotateCcw,
  Bell,
  TrendingUp,
  TrendingDown,
  Layers,
  Ruler,
  BarChart2,
  LineChart,
  Trash2,
} from 'lucide-react';

interface CandleChartProps {
  candles: Candle[];
  ema20Series?: (number | null)[];
  ema50Series?: (number | null)[];
  bollingerUpper?: (number | null)[];
  bollingerMiddle?: (number | null)[];
  bollingerLower?: (number | null)[];
  symbol: string;
  interval: string;
  currentPrice?: number;
  nearestSupports?: number[];
  nearestResistances?: number[];
  alerts?: PriceAlert[];
  onDeleteAlert?: (id: string) => void;
  onQuickAlertCreated?: (alert: PriceAlert) => void;
}

export const CandleChart: React.FC<CandleChartProps> = ({
  candles,
  ema20Series = [],
  ema50Series = [],
  bollingerUpper = [],
  bollingerMiddle = [],
  bollingerLower = [],
  symbol,
  interval,
  currentPrice,
  nearestSupports = [],
  nearestResistances = [],
  alerts = [],
  onDeleteAlert,
  onQuickAlertCreated,
}) => {
  // Chart Display Modes & Toggles
  const [chartType, setChartType] = useState<'candles' | 'line'>('candles');
  const [visibleCount, setVisibleCount] = useState<number>(100);
  const [offsetEnd, setOffsetEnd] = useState<number>(0); // 0 = rightmost (latest)
  const [showEMA, setShowEMA] = useState<boolean>(true);
  const [showBollinger, setShowBollinger] = useState<boolean>(true);
  const [showVolume, setShowVolume] = useState<boolean>(true);
  const [showPivots, setShowPivots] = useState<boolean>(true);
  const [showPriceLine, setShowPriceLine] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Crosshair & Interaction
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [hoverPrice, setHoverPrice] = useState<number | null>(null);

  // Ruler / Measurement Tool
  const [isRulerActive, setIsRulerActive] = useState<boolean>(false);
  const [rulerStart, setRulerStart] = useState<{ index: number; price: number; time: number } | null>(null);
  const [rulerEnd, setRulerEnd] = useState<{ index: number; price: number; time: number } | null>(null);

  // Interactive Quick Alert Modal
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [selectedAlertPrice, setSelectedAlertPrice] = useState<number>(currentPrice || 0);

  // Dragging / Panning State
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartXRef = useRef<number>(0);
  const dragStartOffsetRef = useRef<number>(0);
  const hasDraggedRef = useRef<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);

  // Total candles available
  const total = candles.length;

  // Ensure offset is bounded
  const maxOffset = Math.max(0, total - visibleCount);
  const boundedOffset = Math.min(maxOffset, Math.max(0, offsetEnd));

  // Compute active sliced window
  const startIndex = Math.max(0, total - visibleCount - boundedOffset);
  const endIndex = Math.min(total, total - boundedOffset);

  const activeCandles = useMemo(() => candles.slice(startIndex, endIndex), [candles, startIndex, endIndex]);
  const activeEMA20 = useMemo(() => ema20Series.slice(startIndex, endIndex), [ema20Series, startIndex, endIndex]);
  const activeEMA50 = useMemo(() => ema50Series.slice(startIndex, endIndex), [ema50Series, startIndex, endIndex]);
  const activeUpper = useMemo(() => bollingerUpper.slice(startIndex, endIndex), [bollingerUpper, startIndex, endIndex]);
  const activeMiddle = useMemo(() => bollingerMiddle.slice(startIndex, endIndex), [bollingerMiddle, startIndex, endIndex]);
  const activeLower = useMemo(() => bollingerLower.slice(startIndex, endIndex), [bollingerLower, startIndex, endIndex]);

  // Compute scale boundaries
  const { minPrice, maxPrice, maxVolume } = useMemo(() => {
    let minP = Infinity;
    let maxP = -Infinity;
    let maxV = 0;

    activeCandles.forEach((c, idx) => {
      if (c.low < minP) minP = c.low;
      if (c.high > maxP) maxP = c.high;
      if (c.volume > maxV) maxV = c.volume;

      if (showBollinger) {
        const u = activeUpper[idx];
        const l = activeLower[idx];
        if (u !== null && u > maxP) maxP = u;
        if (l !== null && l < minP) minP = l;
      }
    });

    if (minP === Infinity) {
      minP = 0;
      maxP = 100;
    }

    // 4% padding on top & bottom
    const padding = (maxP - minP) * 0.04 || 1;
    return {
      minPrice: minP - padding,
      maxPrice: maxP + padding,
      maxVolume: maxV || 1,
    };
  }, [activeCandles, activeUpper, activeLower, showBollinger]);

  // Dimensions
  const chartHeight = 360;
  const volumeHeight = 60;
  const paddingRight = 72; // Price axis width
  const paddingBottom = 26; // Time scale height

  const priceRange = maxPrice - minPrice || 1;

  const getY = (price: number): number => {
    return chartHeight - ((price - minPrice) / priceRange) * chartHeight;
  };

  const getPriceFromY = (y: number): number => {
    const ratio = (chartHeight - y) / chartHeight;
    return minPrice + ratio * priceRange;
  };

  const getVolY = (vol: number): number => {
    const mainBottom = chartHeight;
    return mainBottom + volumeHeight - (vol / maxVolume) * volumeHeight;
  };

  const stepX = (1000 - paddingRight) / (activeCandles.length - 1 || 1);
  const candleWidth = Math.max(2, Math.min(15, ((1000 - paddingRight) / activeCandles.length) * 0.72));

  // Filter alerts for current symbol
  const activeSymbolAlerts = useMemo(() => {
    return alerts.filter((a) => a.symbol === symbol && a.isActive && a.targetPrice);
  }, [alerts, symbol]);

  // Generate SVG path for a line series
  const buildLinePath = (series: (number | null)[]): string => {
    let path = '';
    series.forEach((val, idx) => {
      if (val === null) return;
      const x = idx * stepX;
      const y = getY(val);
      if (path === '') {
        path += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      } else {
        path += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
    });
    return path;
  };

  // Generate SVG path for Area / Mountain close chart
  const buildAreaClosePath = (): { line: string; area: string } => {
    if (activeCandles.length === 0) return { line: '', area: '' };
    let line = '';
    let area = '';

    activeCandles.forEach((c, idx) => {
      const x = idx * stepX;
      const y = getY(c.close);
      if (idx === 0) {
        line += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
        area += `M ${x.toFixed(1)} ${chartHeight} L ${x.toFixed(1)} ${y.toFixed(1)}`;
      } else {
        line += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
        area += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
      }
    });

    const lastX = (activeCandles.length - 1) * stepX;
    area += ` L ${lastX.toFixed(1)} ${chartHeight} Z`;

    return { line, area };
  };

  // Generate shaded area for Bollinger Bands
  const buildBollingerAreaPath = (): string => {
    if (!showBollinger) return '';
    let upperPts: string[] = [];
    let lowerPts: string[] = [];

    activeCandles.forEach((_, idx) => {
      const u = activeUpper[idx];
      const l = activeLower[idx];
      if (u !== null && l !== null) {
        const x = (idx * stepX).toFixed(1);
        upperPts.push(`${x} ${getY(u).toFixed(1)}`);
        lowerPts.unshift(`${x} ${getY(l).toFixed(1)}`);
      }
    });

    if (upperPts.length === 0) return '';
    return `M ${upperPts[0]} L ${upperPts.join(' L ')} L ${lowerPts.join(' L ')} Z`;
  };

  // Mouse Move & Hover
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const width = rect.width - (paddingRight / 1000) * rect.width;
    const ratio = Math.max(0, Math.min(1, mouseX / width));
    const idx = Math.min(
      activeCandles.length - 1,
      Math.max(0, Math.round(ratio * (activeCandles.length - 1)))
    );

    setHoverIndex(idx);

    // Compute hovered price from vertical position
    const svgY = (mouseY / rect.height) * (chartHeight + (showVolume ? volumeHeight : 0) + paddingBottom);
    if (svgY <= chartHeight) {
      setHoverPrice(getPriceFromY(svgY));
    } else {
      setHoverPrice(null);
    }

    // Handle Dragging
    if (isDragging) {
      const deltaX = e.clientX - dragStartXRef.current;
      if (Math.abs(deltaX) > 4) {
        hasDraggedRef.current = true;
      }
      const candleStepPx = width / activeCandles.length;
      const candlesMoved = Math.round(deltaX / candleStepPx);
      setOffsetEnd(Math.max(0, Math.min(maxOffset, dragStartOffsetRef.current + candlesMoved)));
    }

    // Handle Ruler in progress
    if (isRulerActive && rulerStart && !rulerEnd) {
      const curCandle = activeCandles[idx];
      if (curCandle && svgY <= chartHeight) {
        // live preview
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    setIsDragging(true);
    hasDraggedRef.current = false;
    dragStartXRef.current = e.clientX;
    dragStartOffsetRef.current = boundedOffset;
  };

  const handleMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {
    setIsDragging(false);

    // If ruler is active, set ruler points
    if (isRulerActive && hoverIndex !== null && hoverPrice !== null && !hasDraggedRef.current) {
      const candle = activeCandles[hoverIndex];
      if (!rulerStart) {
        setRulerStart({ index: hoverIndex, price: hoverPrice, time: candle.time });
      } else if (!rulerEnd) {
        setRulerEnd({ index: hoverIndex, price: hoverPrice, time: candle.time });
      }
    }
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
    setHoverPrice(null);
    setIsDragging(false);
  };

  // Wheel Zoom
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      // Zoom In
      setVisibleCount((prev) => Math.max(25, prev - 15));
    } else {
      // Zoom Out
      setVisibleCount((prev) => Math.min(500, prev + 15));
    }
  };

  // Open Alert Modal from Chart Price
  const openAlertForPrice = (price: number) => {
    setSelectedAlertPrice(price);
    setModalOpen(true);
  };

  // Reset Navigation to Live
  const handleResetToLive = () => {
    setOffsetEnd(0);
    setVisibleCount(100);
    setHoverIndex(null);
  };

  const hoveredCandle =
    hoverIndex !== null && hoverIndex >= 0 && hoverIndex < activeCandles.length
      ? activeCandles[hoverIndex]
      : activeCandles[activeCandles.length - 1];

  const hoveredEMA20 =
    hoverIndex !== null && hoverIndex < activeEMA20.length
      ? activeEMA20[hoverIndex]
      : activeEMA20[activeEMA20.length - 1];
  const hoveredEMA50 =
    hoverIndex !== null && hoverIndex < activeEMA50.length
      ? activeEMA50[hoverIndex]
      : activeEMA50[activeEMA50.length - 1];
  const hoveredUpper =
    hoverIndex !== null && hoverIndex < activeUpper.length
      ? activeUpper[hoverIndex]
      : activeUpper[activeUpper.length - 1];
  const hoveredLower =
    hoverIndex !== null && hoverIndex < activeLower.length
      ? activeLower[hoverIndex]
      : activeLower[activeLower.length - 1];

  // Grid Lines
  const gridLines = useMemo(() => {
    const lines = [];
    const count = 5;
    for (let i = 0; i <= count; i++) {
      const p = minPrice + (priceRange / count) * i;
      lines.push(p);
    }
    return lines;
  }, [minPrice, priceRange]);

  // Current real-time price
  const livePrice = currentPrice || (candles.length > 0 ? candles[candles.length - 1].close : 0);
  const livePriceY = getY(livePrice);

  // Ruler Measurements
  const rulerMeasurement = useMemo(() => {
    if (!rulerStart) return null;
    const end = rulerEnd || (hoverIndex !== null && hoverPrice !== null
      ? { index: hoverIndex, price: hoverPrice, time: activeCandles[hoverIndex]?.time || 0 }
      : null);
    if (!end) return null;

    const priceDiff = end.price - rulerStart.price;
    const percentDiff = (priceDiff / rulerStart.price) * 100;
    const candleCount = Math.abs(end.index - rulerStart.index) + 1;
    const isUp = priceDiff >= 0;

    return {
      priceDiff,
      percentDiff,
      candleCount,
      isUp,
      startX: rulerStart.index * stepX,
      startY: getY(rulerStart.price),
      endX: end.index * stepX,
      endY: getY(end.price),
    };
  }, [rulerStart, rulerEnd, hoverIndex, hoverPrice, activeCandles, stepX]);

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      className={`bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl flex flex-col gap-3 transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none bg-slate-950 p-6 overflow-y-auto' : ''
      }`}
    >
      {/* Chart Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        {/* Left: Asset info & View Status */}
        <div className="flex items-center gap-2.5">
          <span className="font-bold text-white text-base tracking-wide font-mono">
            {symbol}
          </span>
          <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono font-medium">
            {interval}
          </span>

          {boundedOffset > 0 ? (
            <button
              onClick={handleResetToLive}
              className="text-xs px-2.5 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold flex items-center gap-1 transition animate-bounce shadow-md shadow-amber-500/20"
              title="العودة لأحدث الشموع اللحظية"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>العودة للحالي ({boundedOffset} شمعة سابقة)</span>
            </button>
          ) : (
            <span className="text-xs text-slate-400 font-sans hidden sm:inline">
              (معروض {activeCandles.length} شمعة)
            </span>
          )}
        </div>

        {/* Center / Right: Indicators & Tools Toggle Bar */}
        <div className="flex items-center flex-wrap gap-1.5 text-xs">
          {/* Chart Mode: Candles vs Line */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 mr-1">
            <button
              onClick={() => setChartType('candles')}
              className={`p-1.5 rounded text-xs transition flex items-center gap-1 ${
                chartType === 'candles'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="عرض الشموع اليابانية"
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span className="hidden md:inline">شموع</span>
            </button>
            <button
              onClick={() => setChartType('line')}
              className={`p-1.5 rounded text-xs transition flex items-center gap-1 ${
                chartType === 'line'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="عرض الرسم الخطي"
            >
              <LineChart className="w-3.5 h-3.5" />
              <span className="hidden md:inline">خطي</span>
            </button>
          </div>

          {/* Quick Alert from Button */}
          <button
            onClick={() => openAlertForPrice(livePrice)}
            className="px-2.5 py-1 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 font-bold hover:bg-amber-500/20 transition flex items-center gap-1"
            title="إضافة تنبيه سعر جديد"
          >
            <Bell className="w-3.5 h-3.5 fill-current" />
            <span>تنبيه سعر</span>
            {activeSymbolAlerts.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] flex items-center justify-center font-bold">
                {activeSymbolAlerts.length}
              </span>
            )}
          </button>

          {/* S/R Pivots Toggle */}
          <button
            onClick={() => setShowPivots(!showPivots)}
            className={`px-2 py-1 rounded-lg border font-medium transition flex items-center gap-1 ${
              showPivots
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="إظهار مستويات الدعم والمقاومة الفنية على الرسم"
          >
            <Layers className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">الدعوم والمقاومات</span>
          </button>

          {/* EMA Toggle */}
          <button
            onClick={() => setShowEMA(!showEMA)}
            className={`px-2 py-1 rounded-lg border font-medium transition flex items-center gap-1 ${
              showEMA
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            {showEMA ? <Eye className="w-3.5 h-3.5 text-amber-400" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>EMA</span>
          </button>

          {/* Bollinger Toggle */}
          <button
            onClick={() => setShowBollinger(!showBollinger)}
            className={`px-2 py-1 rounded-lg border font-medium transition flex items-center gap-1 ${
              showBollinger
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            {showBollinger ? <Eye className="w-3.5 h-3.5 text-cyan-400" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>بولينجر</span>
          </button>

          {/* Volume Toggle */}
          <button
            onClick={() => setShowVolume(!showVolume)}
            className={`px-2 py-1 rounded-lg border font-medium transition flex items-center gap-1 ${
              showVolume
                ? 'bg-slate-700 border-slate-600 text-slate-200'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
          >
            {showVolume ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>الحجم</span>
          </button>

          {/* Measurement Ruler Tool */}
          <button
            onClick={() => {
              setIsRulerActive(!isRulerActive);
              setRulerStart(null);
              setRulerEnd(null);
            }}
            className={`px-2 py-1 rounded-lg border font-medium transition flex items-center gap-1 ${
              isRulerActive
                ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
            }`}
            title="أداة مسطرة القياس: اضغط على نقطتين لقياس تغير السعر والنسبة"
          >
            <Ruler className="w-3.5 h-3.5" />
            <span className="hidden md:inline">مسطرة القياس</span>
          </button>

          {/* Zoom Buttons (+ / -) */}
          <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800">
            <button
              onClick={() => setVisibleCount((prev) => Math.max(25, prev - 25))}
              className="p-1 text-slate-400 hover:text-white"
              title="تكبير (Zoom In)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setVisibleCount((prev) => Math.min(500, prev + 25))}
              className="p-1 text-slate-400 hover:text-white"
              title="تصغير (Zoom Out)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            title={isFullscreen ? 'تصغير الشاشة' : 'ملء الشاشة'}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Floating / Active Ruler Info Banner */}
      {isRulerActive && (
        <div className="flex items-center justify-between text-xs bg-blue-950/40 border border-blue-800/60 p-2.5 rounded-xl text-blue-200">
          <div className="flex items-center gap-2">
            <Ruler className="w-4 h-4 text-blue-400 animate-pulse" />
            <span>
              {!rulerStart
                ? 'أداة القياس نشطة: اضغط على الشمعة الأولى لبدء القياس.'
                : !rulerEnd
                ? 'اضغط على الشمعة الثانية لتثبيت القياس.'
                : 'تم القياس بنجاح.'}
            </span>
          </div>

          {rulerMeasurement && (
            <div className="flex items-center gap-3 font-mono font-bold">
              <span className={rulerMeasurement.isUp ? 'text-emerald-400' : 'text-rose-400'}>
                {rulerMeasurement.isUp ? '+' : ''}${formatPrice(rulerMeasurement.priceDiff)} (
                {formatPercent(rulerMeasurement.percentDiff)})
              </span>
              <span className="text-slate-400">•</span>
              <span className="text-slate-300">{rulerMeasurement.candleCount} شموع</span>
            </div>
          )}

          <button
            onClick={() => {
              setRulerStart(null);
              setRulerEnd(null);
            }}
            className="text-xs text-blue-300 hover:text-white underline mr-2"
          >
            مسح القياس
          </button>
        </div>
      )}

      {/* Live / Hover Info Bar */}
      {hoveredCandle && (
        <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-950/70 p-2.5 rounded-xl border border-slate-800/80 font-mono text-slate-300">
          <span className="text-slate-400 font-sans">
            {new Date(hoveredCandle.time).toLocaleTimeString('ar-EG', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            })}{' '}
            {new Date(hoveredCandle.time).toLocaleDateString('ar-EG', {
              month: 'short',
              day: 'numeric',
            })}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-slate-500">افتتاح:</span>
            <span className="text-slate-100 font-semibold">{formatPrice(hoveredCandle.open)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-500">أعلى:</span>
            <span className="text-emerald-400 font-semibold">{formatPrice(hoveredCandle.high)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-500">أدنى:</span>
            <span className="text-rose-400 font-semibold">{formatPrice(hoveredCandle.low)}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-500">إغلاق:</span>
            <span
              className={`font-bold ${
                hoveredCandle.close >= hoveredCandle.open ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatPrice(hoveredCandle.close)}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-500">حجم:</span>
            <span className="text-slate-300">{formatVolume(hoveredCandle.volume)}</span>
          </div>

          {showEMA && hoveredEMA20 !== null && (
            <div className="flex items-center gap-1.5 mr-auto">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              <span className="text-amber-400">EMA20: {formatPrice(hoveredEMA20)}</span>
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-violet-400 mr-2"></span>
              <span className="text-violet-400">EMA50: {hoveredEMA50 ? formatPrice(hoveredEMA50) : '-'}</span>
            </div>
          )}
        </div>
      )}

      {/* SVG Candlestick Canvas */}
      <div className="relative w-full overflow-hidden select-none cursor-crosshair rounded-xl bg-slate-950/95 border border-slate-800">
        <svg
          viewBox={`0 0 1000 ${chartHeight + (showVolume ? volumeHeight : 0) + paddingBottom}`}
          className="w-full h-auto block"
          onMouseMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
        >
          {/* Horizontal Grid & Price Labels */}
          {gridLines.map((price, idx) => {
            const y = getY(price);
            return (
              <g key={`grid-${idx}`}>
                <line
                  x1="0"
                  y1={y}
                  x2={1000 - paddingRight}
                  y2={y}
                  stroke="#1e293b"
                  strokeDasharray="3 3"
                  strokeWidth="0.8"
                />
                <text
                  x={1000 - paddingRight + 6}
                  y={y + 3}
                  fill="#64748b"
                  fontSize="10"
                  fontFamily="JetBrains Mono"
                >
                  {formatPrice(price)}
                </text>
              </g>
            );
          })}

          {/* Volume Separator */}
          {showVolume && (
            <line
              x1="0"
              y1={chartHeight}
              x2={1000 - paddingRight}
              y2={chartHeight}
              stroke="#334155"
              strokeWidth="1"
            />
          )}

          {/* Bollinger Shaded Envelope */}
          {showBollinger && (
            <>
              <path d={buildBollingerAreaPath()} fill="rgba(6, 182, 212, 0.08)" />
              <path
                d={buildLinePath(activeUpper)}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="1.2"
                strokeDasharray="4 2"
                opacity="0.75"
              />
              <path
                d={buildLinePath(activeMiddle)}
                fill="none"
                stroke="#0284c7"
                strokeWidth="1"
                opacity="0.5"
              />
              <path
                d={buildLinePath(activeLower)}
                fill="none"
                stroke="#06b6d4"
                strokeWidth="1.2"
                strokeDasharray="4 2"
                opacity="0.75"
              />
            </>
          )}

          {/* Volume Bars */}
          {showVolume &&
            activeCandles.map((c, idx) => {
              const x = idx * stepX;
              const y = getVolY(c.volume);
              const barH = chartHeight + volumeHeight - y;
              const isBullish = c.close >= c.open;
              return (
                <rect
                  key={`vol-${c.time}-${idx}`}
                  x={x - candleWidth / 2}
                  y={y}
                  width={candleWidth}
                  height={Math.max(1, barH)}
                  fill={isBullish ? 'rgba(16, 185, 129, 0.35)' : 'rgba(244, 63, 94, 0.35)'}
                />
              );
            })}

          {/* Support & Resistance Horizontal Pivot Levels */}
          {showPivots && (
            <>
              {nearestSupports.map((sup, idx) => {
                const y = getY(sup);
                if (y < 0 || y > chartHeight) return null;
                return (
                  <g key={`sup-line-${idx}`}>
                    <line
                      x1="0"
                      y1={y}
                      x2={1000 - paddingRight}
                      y2={y}
                      stroke="#10b981"
                      strokeDasharray="4 3"
                      strokeWidth="1.2"
                      opacity="0.85"
                    />
                    <rect
                      x={4}
                      y={y - 8}
                      width="54"
                      height="16"
                      fill="#064e3b"
                      rx="3"
                      opacity="0.9"
                    />
                    <text
                      x={6}
                      y={y + 4}
                      fill="#6ee7b7"
                      fontSize="9"
                      fontFamily="JetBrains Mono"
                      fontWeight="bold"
                    >
                      دعم S{idx + 1}
                    </text>
                  </g>
                );
              })}

              {nearestResistances.map((res, idx) => {
                const y = getY(res);
                if (y < 0 || y > chartHeight) return null;
                return (
                  <g key={`res-line-${idx}`}>
                    <line
                      x1="0"
                      y1={y}
                      x2={1000 - paddingRight}
                      y2={y}
                      stroke="#f43f5e"
                      strokeDasharray="4 3"
                      strokeWidth="1.2"
                      opacity="0.85"
                    />
                    <rect
                      x={4}
                      y={y - 8}
                      width="64"
                      height="16"
                      fill="#881337"
                      rx="3"
                      opacity="0.9"
                    />
                    <text
                      x={6}
                      y={y + 4}
                      fill="#fda4af"
                      fontSize="9"
                      fontFamily="JetBrains Mono"
                      fontWeight="bold"
                    >
                      مقاومة R{idx + 1}
                    </text>
                  </g>
                );
              })}
            </>
          )}

          {/* Candlesticks OR Area Line Mode */}
          {chartType === 'line' ? (
            (() => {
              const { line, area } = buildAreaClosePath();
              return (
                <g>
                  <defs>
                    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  <path d={area} fill="url(#areaGradient)" />
                  <path d={line} fill="none" stroke="#f59e0b" strokeWidth="2.2" />
                </g>
              );
            })()
          ) : (
            activeCandles.map((c, idx) => {
              const x = idx * stepX;
              const openY = getY(c.open);
              const closeY = getY(c.close);
              const highY = getY(c.high);
              const lowY = getY(c.low);
              const isBullish = c.close >= c.open;
              const color = isBullish ? '#10b981' : '#f43f5e';

              const bodyTop = Math.min(openY, closeY);
              const bodyHeight = Math.max(1.5, Math.abs(closeY - openY));

              return (
                <g key={`candle-${c.time}-${idx}`}>
                  {/* High / Low Wick */}
                  <line x1={x} y1={highY} x2={x} y2={lowY} stroke={color} strokeWidth="1.2" />
                  {/* Candle Body */}
                  <rect
                    x={x - candleWidth / 2}
                    y={bodyTop}
                    width={candleWidth}
                    height={bodyHeight}
                    fill={color}
                    rx="1"
                  />
                </g>
              );
            })
          )}

          {/* EMA 20 Line */}
          {showEMA && (
            <path d={buildLinePath(activeEMA20)} fill="none" stroke="#f59e0b" strokeWidth="1.8" />
          )}

          {/* EMA 50 Line */}
          {showEMA && (
            <path d={buildLinePath(activeEMA50)} fill="none" stroke="#a855f7" strokeWidth="1.8" />
          )}

          {/* Active Price Alerts Visual Lines */}
          {activeSymbolAlerts.map((alert) => {
            if (!alert.targetPrice) return null;
            const y = getY(alert.targetPrice);
            if (y < 0 || y > chartHeight) return null;

            return (
              <g key={`alert-${alert.id}`} className="group/alert cursor-pointer">
                <line
                  x1="0"
                  y1={y}
                  x2={1000 - paddingRight}
                  y2={y}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  strokeWidth="1.5"
                />
                <rect
                  x={1000 - paddingRight}
                  y={y - 9}
                  width={paddingRight}
                  height="18"
                  fill="#78350f"
                  rx="3"
                />
                <text
                  x={1000 - paddingRight + 5}
                  y={y + 4}
                  fill="#fef3c7"
                  fontSize="9.5"
                  fontFamily="JetBrains Mono"
                  fontWeight="bold"
                >
                  🔔 {formatPrice(alert.targetPrice)}
                </text>
              </g>
            );
          })}

          {/* Real-time Live Price Indicator Line */}
          {showPriceLine && livePriceY >= 0 && livePriceY <= chartHeight && (
            <g>
              <line
                x1="0"
                y1={livePriceY}
                x2={1000 - paddingRight}
                y2={livePriceY}
                stroke="#38bdf8"
                strokeDasharray="2 2"
                strokeWidth="1.2"
              />
              <rect
                x={1000 - paddingRight}
                y={livePriceY - 10}
                width={paddingRight}
                height="20"
                fill="#0284c7"
                rx="3"
              />
              <text
                x={1000 - paddingRight + 4}
                y={livePriceY + 4}
                fill="#ffffff"
                fontSize="10"
                fontFamily="JetBrains Mono"
                fontWeight="black"
              >
                ${formatPrice(livePrice)}
              </text>
            </g>
          )}

          {/* Ruler Drawn Measurement Area */}
          {rulerMeasurement && (
            <g>
              <rect
                x={Math.min(rulerMeasurement.startX, rulerMeasurement.endX)}
                y={Math.min(rulerMeasurement.startY, rulerMeasurement.endY)}
                width={Math.abs(rulerMeasurement.endX - rulerMeasurement.startX)}
                height={Math.max(2, Math.abs(rulerMeasurement.endY - rulerMeasurement.startY))}
                fill={rulerMeasurement.isUp ? 'rgba(16, 185, 129, 0.15)' : 'rgba(244, 63, 94, 0.15)'}
                stroke={rulerMeasurement.isUp ? '#10b981' : '#f43f5e'}
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />
              <circle cx={rulerMeasurement.startX} cy={rulerMeasurement.startY} r="4" fill="#3b82f6" />
              <circle cx={rulerMeasurement.endX} cy={rulerMeasurement.endY} r="4" fill="#3b82f6" />
            </g>
          )}

          {/* Interactive Crosshair Overlay */}
          {hoverIndex !== null && hoverIndex >= 0 && hoverIndex < activeCandles.length && (
            <g>
              {/* Vertical line */}
              <line
                x1={hoverIndex * stepX}
                y1="0"
                x2={hoverIndex * stepX}
                y2={chartHeight + (showVolume ? volumeHeight : 0)}
                stroke="#94a3b8"
                strokeDasharray="2 2"
                strokeWidth="1"
              />

              {/* Horizontal line at hover cursor */}
              {hoverPrice !== null && (
                <>
                  <line
                    x1="0"
                    y1={getY(hoverPrice)}
                    x2={1000 - paddingRight}
                    y2={getY(hoverPrice)}
                    stroke="#94a3b8"
                    strokeDasharray="2 2"
                    strokeWidth="1"
                  />
                  {/* Cursor price badge */}
                  <rect
                    x={1000 - paddingRight}
                    y={getY(hoverPrice) - 9}
                    width={paddingRight}
                    height="18"
                    fill="#334155"
                    rx="3"
                  />
                  <text
                    x={1000 - paddingRight + 4}
                    y={getY(hoverPrice) + 4}
                    fill="#ffffff"
                    fontSize="10"
                    fontFamily="JetBrains Mono"
                    fontWeight="bold"
                  >
                    {formatPrice(hoverPrice)}
                  </text>
                </>
              )}
            </g>
          )}

          {/* Time axis labels */}
          {activeCandles
            .filter((_, idx) => idx % Math.max(1, Math.floor(activeCandles.length / 6)) === 0)
            .map((c) => {
              const originalIdx = activeCandles.indexOf(c);
              const x = originalIdx * stepX;
              return (
                <text
                  key={`time-${c.time}`}
                  x={x}
                  y={chartHeight + (showVolume ? volumeHeight : 0) + 16}
                  fill="#64748b"
                  fontSize="9.5"
                  fontFamily="JetBrains Mono"
                  textAnchor="middle"
                >
                  {new Date(c.time).toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false,
                  })}
                </text>
              );
            })}
        </svg>

        {/* Hovering Quick Alert Trigger Button on the right price scale */}
        {hoverPrice !== null && (
          <div
            className="absolute left-3 z-10"
            style={{
              top: `${Math.max(12, Math.min(320, (getY(hoverPrice) / chartHeight) * 100))}%`,
            }}
          >
            <button
              onClick={() => openAlertForPrice(hoverPrice)}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-2 py-1 rounded-md text-[11px] font-bold shadow-lg flex items-center gap-1 transition animate-in fade-in"
              title="وضع تنبيه سعري فوري عند هذه النقطة"
            >
              <Bell className="w-3 h-3 fill-current" />
              <span>تنبيه عند ${formatPrice(hoverPrice)}</span>
            </button>
          </div>
        )}
      </div>

      {/* Chart Footer Legend & Active Alerts Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 pt-1 border-t border-slate-800/60">
        <div className="flex items-center flex-wrap gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block"></span>
            <span>شمعة صاعدة</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-rose-500 inline-block"></span>
            <span>شمعة هابطة</span>
          </div>
          {showEMA && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-amber-400 inline-block"></span>
                <span>EMA 20</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-violet-400 inline-block"></span>
                <span>EMA 50</span>
              </div>
            </>
          )}
          {showPivots && (
            <>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-emerald-500 inline-block"></span>
                <span>دعوم S</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-0.5 bg-rose-500 inline-block"></span>
                <span>مقاومات R</span>
              </div>
            </>
          )}
        </div>

        {/* Active Alerts for this symbol */}
        {activeSymbolAlerts.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-amber-400 font-bold flex items-center gap-1">
              <Bell className="w-3.5 h-3.5 fill-current" />
              <span>تنبيهات {symbol} النشطة:</span>
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {activeSymbolAlerts.map((alt) => (
                <span
                  key={alt.id}
                  className="bg-amber-500/10 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded-lg font-mono text-[11px] flex items-center gap-1"
                >
                  <span>${formatPrice(alt.targetPrice || 0)}</span>
                  {onDeleteAlert && (
                    <button
                      onClick={() => onDeleteAlert(alt.id)}
                      className="text-slate-400 hover:text-rose-400 ml-0.5"
                      title="حذف التنبيه"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick Alert Modal */}
      <QuickAlertModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        symbol={symbol}
        currentPrice={livePrice}
        initialTargetPrice={selectedAlertPrice}
        nearestSupports={nearestSupports}
        nearestResistances={nearestResistances}
        onAlertCreated={(newAlert) => {
          if (onQuickAlertCreated) onQuickAlertCreated(newAlert);
        }}
      />
    </div>
  );
};
