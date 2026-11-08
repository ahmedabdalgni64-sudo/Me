import type { JournalTrade, PriceAlert } from '../types/journal.ts';
import { getFullAnalysis, getSingleTicker } from './binance.ts';

class JournalAndAlertsEngine {
  private alerts: PriceAlert[] = [];
  private trades: JournalTrade[] = [];
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initLiveDefaults();
    this.startChecker();
  }

  // Initialize defaults using REAL live prices from Binance public API
  private async initLiveDefaults() {
    try {
      const btcTicker = await getSingleTicker('BTCUSDT');
      const btcPrice = btcTicker.price;
      const btcTarget = Math.round(btcPrice * 1.025); // Target +2.5% above real price
      const btcSupport = Math.round(btcPrice * 0.985); // Entry near support
      const btcStop = Math.round(btcPrice * 0.965);
      const btcTp = Math.round(btcPrice * 1.035);

      this.alerts = [
        {
          id: 'alert_btc_live',
          symbol: 'BTCUSDT',
          type: 'PRICE_ABOVE',
          targetPrice: btcTarget,
          conditionDescription: `عند تجاوز سعر بيتكوين $${btcTarget.toLocaleString('en-US')} USDT (بناءً على السعر اللحظي)`,
          isActive: true,
          isTriggered: false,
          createdAt: Date.now() - 3600000,
          note: 'تنبيه اختراق فني متصل بأسعار Binance الحية',
        },
        {
          id: 'alert_eth_live',
          symbol: 'ETHUSDT',
          type: 'STRONG_BUY_SIGNAL',
          conditionDescription: 'عند ظهور إشارة شراء قوي على إطار 1h',
          isActive: true,
          isTriggered: false,
          createdAt: Date.now() - 3600000,
          note: 'مراقبة إشارة الزخم الفنية لإيثيريوم',
        },
      ];

      const diff = btcPrice - btcSupport;
      const qty = 0.05;
      this.trades = [
        {
          id: 'trade_live_btc',
          symbol: 'BTCUSDT',
          direction: 'شراء',
          entryPrice: btcSupport,
          currentPrice: btcPrice,
          stopLoss: btcStop,
          takeProfit: btcTp,
          quantity: qty,
          riskRewardRatio: Number(((btcTp - btcSupport) / (btcSupport - btcStop)).toFixed(2)),
          status: 'OPEN',
          pnlUsdt: Number((diff * qty).toFixed(2)),
          pnlPercent: Number(((diff / btcSupport) * 100).toFixed(2)),
          entryTime: Date.now() - 3600000 * 4,
          notes: 'صفقة تجريبية مبنية على السعر الحقيقي لبيتكوين من منصة Binance',
          strategyUsed: 'مؤشرات الدعم والتوافق الفني الحقيقي',
        },
      ];
    } catch {
      // If network fails on initialization, start with empty list rather than fake numbers
      this.alerts = [];
      this.trades = [];
    }
  }

  // --- Alerts API ---
  public getAlerts(): PriceAlert[] {
    return [...this.alerts];
  }

  public addAlert(
    symbol: string,
    type: PriceAlert['type'],
    targetPrice?: number,
    targetSignal?: string,
    note?: string
  ): PriceAlert {
    const normSymbol = symbol.toUpperCase();
    let conditionDescription = '';

    if (type === 'PRICE_ABOVE') {
      conditionDescription = `عند ارتفاع السعر فوق $${targetPrice?.toLocaleString('en-US')}`;
    } else if (type === 'PRICE_BELOW') {
      conditionDescription = `عند هبوط السعر تحت $${targetPrice?.toLocaleString('en-US')}`;
    } else if (type === 'STRONG_BUY_SIGNAL') {
      conditionDescription = `عند ظهور إشارة شراء قوي (توافق 4-5 مؤشرات)`;
    } else {
      conditionDescription = `عند تغير إشارة الأصل إلى ${targetSignal || 'إشارة جديدة'}`;
    }

    const alert: PriceAlert = {
      id: `alert_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      symbol: normSymbol,
      type,
      targetPrice,
      targetSignal,
      conditionDescription,
      isActive: true,
      isTriggered: false,
      createdAt: Date.now(),
      note,
    };

    this.alerts.unshift(alert);
    return alert;
  }

  public toggleAlert(id: string): PriceAlert | null {
    const alert = this.alerts.find((a) => a.id === id);
    if (!alert) return null;
    alert.isActive = !alert.isActive;
    return alert;
  }

  public deleteAlert(id: string): boolean {
    const initLen = this.alerts.length;
    this.alerts = this.alerts.filter((a) => a.id !== id);
    return this.alerts.length < initLen;
  }

  // --- Journal API ---
  public async getTrades(): Promise<{ trades: JournalTrade[]; stats: any }> {
    await this.syncTradesWithMarket();

    const totalTrades = this.trades.length;
    const wonTrades = this.trades.filter((t) => t.status === 'WON').length;
    const lostTrades = this.trades.filter((t) => t.status === 'LOST').length;
    const openTrades = this.trades.filter((t) => t.status === 'OPEN').length;

    const completed = wonTrades + lostTrades;
    const winRatePercent = completed > 0 ? Number(((wonTrades / completed) * 100).toFixed(1)) : 0;

    const totalProfitUsdt = Number(
      this.trades.reduce((sum, t) => sum + (t.pnlUsdt || 0), 0).toFixed(2)
    );

    const stats = {
      totalTrades,
      wonTrades,
      lostTrades,
      openTrades,
      winRatePercent,
      totalProfitUsdt,
    };

    return { trades: [...this.trades], stats };
  }

  public addTrade(
    symbol: string,
    direction: 'شراء' | 'بيع',
    entryPrice: number,
    stopLoss: number,
    takeProfit: number,
    quantity: number,
    notes?: string,
    strategyUsed?: string
  ): JournalTrade {
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(takeProfit - entryPrice);
    const riskRewardRatio = risk > 0 ? Number((reward / risk).toFixed(2)) : 1.5;

    const trade: JournalTrade = {
      id: `trade_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      symbol: symbol.toUpperCase(),
      direction,
      entryPrice,
      currentPrice: entryPrice,
      stopLoss,
      takeProfit,
      quantity: quantity || 1,
      riskRewardRatio,
      status: 'OPEN',
      pnlUsdt: 0,
      pnlPercent: 0,
      entryTime: Date.now(),
      notes,
      strategyUsed: strategyUsed || 'تحليل فني يدوي',
    };

    this.trades.unshift(trade);
    return trade;
  }

  public updateTradeStatus(id: string, status: JournalTrade['status']): JournalTrade | null {
    const trade = this.trades.find((t) => t.id === id);
    if (!trade) return null;
    trade.status = status;
    if (status !== 'OPEN') {
      trade.exitTime = Date.now();
    }
    return trade;
  }

  public deleteTrade(id: string): boolean {
    const len = this.trades.length;
    this.trades = this.trades.filter((t) => t.id !== id);
    return this.trades.length < len;
  }

  // Sync open trades with live market prices to update PnL and trigger targets
  private async syncTradesWithMarket() {
    for (const trade of this.trades) {
      if (trade.status !== 'OPEN') continue;

      try {
        const ticker = await getSingleTicker(trade.symbol);
        const curPrice = ticker.price;
        trade.currentPrice = curPrice;

        const isBuy = trade.direction === 'شراء';
        const priceDiff = isBuy ? curPrice - trade.entryPrice : trade.entryPrice - curPrice;

        trade.pnlUsdt = Number((priceDiff * trade.quantity).toFixed(2));
        trade.pnlPercent = Number(((priceDiff / trade.entryPrice) * 100).toFixed(2));

        // Auto mark as WON or LOST if target reached
        if (isBuy) {
          if (curPrice >= trade.takeProfit) {
            trade.status = 'WON';
            trade.exitTime = Date.now();
          } else if (curPrice <= trade.stopLoss) {
            trade.status = 'LOST';
            trade.exitTime = Date.now();
          }
        } else {
          if (curPrice <= trade.takeProfit) {
            trade.status = 'WON';
            trade.exitTime = Date.now();
          } else if (curPrice >= trade.stopLoss) {
            trade.status = 'LOST';
            trade.exitTime = Date.now();
          }
        }
      } catch {
        // ticker sync error
      }
    }
  }

  // Periodic alert and trade checker
  private startChecker() {
    this.checkInterval = setInterval(async () => {
      // 1. Check alerts
      for (const alert of this.alerts) {
        if (!alert.isActive || alert.isTriggered) continue;

        try {
          const ticker = await getSingleTicker(alert.symbol);
          const curPrice = ticker.price;

          if (alert.type === 'PRICE_ABOVE' && alert.targetPrice && curPrice >= alert.targetPrice) {
            alert.isTriggered = true;
            alert.triggeredAt = Date.now();
          } else if (alert.type === 'PRICE_BELOW' && alert.targetPrice && curPrice <= alert.targetPrice) {
            alert.isTriggered = true;
            alert.triggeredAt = Date.now();
          } else if (alert.type === 'STRONG_BUY_SIGNAL') {
            const analysis = await getFullAnalysis(alert.symbol, '1h');
            if (analysis.summary.overallSignal === 'شراء قوي') {
              alert.isTriggered = true;
              alert.triggeredAt = Date.now();
            }
          }
        } catch {
          // alert evaluation error
        }
      }

      // 2. Sync open trades
      await this.syncTradesWithMarket();
    }, 25000);
  }
}

export const journalAndAlerts = new JournalAndAlertsEngine();
