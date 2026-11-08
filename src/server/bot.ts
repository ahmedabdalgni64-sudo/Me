import type {
  BotLogEntry,
  BotPosition,
  BotSettings,
  BotState,
  OrderRequest,
  TradingMode,
} from '../types/trading.ts';
import { DEFAULT_SYMBOLS, getFullAnalysis } from './binance.ts';
import { executeOrder, getAccountState } from './trading.ts';

class TradingBotEngine {
  private state: BotState;
  private scanTimer: NodeJS.Timeout | null = null;
  private isScanning: boolean = false;

  constructor() {
    this.state = {
      isRunning: false,
      startedAt: null,
      lastScanAt: null,
      totalScans: 0,
      totalTradesExecuted: 0,
      activePositions: [],
      settings: {
        selectedSymbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT'],
        interval: '1h',
        tradeMode: 'paper',
        targetExchange: 'binance',
        strategy: 'consensus_strong',
        riskPerTrade: 5, // 5% of cash
        takeProfitRatio: 2.0,
        stopLossAtrMult: 1.5,
        autoSellOnReversal: true,
        scanIntervalSec: 20,
        webhookSecret: 'ais-trader-bot-secret',
      },
      connectedExchanges: [
        {
          id: 'binance',
          name: 'Binance',
          arabicName: 'بينانس',
          color: '#f59e0b',
          badge: 'الأساسية',
          status: 'connected',
          supportedModes: ['paper', 'testnet', 'live'],
          description: 'الربط المباشر مع أكبر منصة تداول في العالم عبر Public API و HMAC-SHA256.',
        },
        {
          id: 'bybit',
          name: 'Bybit',
          arabicName: 'باي بيت',
          color: '#f97316',
          badge: 'V5 API',
          status: 'paper',
          supportedModes: ['paper', 'live'],
          description: 'تنفيذ الأوامر الفورية والمستقبلية على Bybit مع دعم التداول التجريبي والحي.',
        },
        {
          id: 'okx',
          name: 'OKX',
          arabicName: 'أوكي إكس',
          color: '#3b82f6',
          badge: 'REST v5',
          status: 'paper',
          supportedModes: ['paper', 'live'],
          description: 'منصة OKX مع دعم أوامر السوق والحدود وإدارة السيولة.',
        },
        {
          id: 'kucoin',
          name: 'KuCoin',
          arabicName: 'كوكوين',
          color: '#10b981',
          badge: 'Spot v1',
          status: 'paper',
          supportedModes: ['paper', 'live'],
          description: 'التداول الآلي وتتبع أزواج العملات المتعددة على كوكوين.',
        },
        {
          id: 'gateio',
          name: 'Gate.io',
          arabicName: 'جيت آيو',
          color: '#ef4444',
          badge: 'v4 API',
          status: 'paper',
          supportedModes: ['paper', 'live'],
          description: 'تنفيذ استراتيجيات البوت اللحظية على Gate.io.',
        },
        {
          id: 'tradingview',
          name: 'TradingView Webhooks',
          arabicName: 'تريدنج فيو (Webhook)',
          color: '#22c55e',
          badge: 'Webhook مباشر',
          status: 'connected',
          supportedModes: ['paper', 'live'],
          description: 'استقبال الإشارات الفورية من استراتيجيات TradingView أو Python وتنفيذها آلياً.',
          webhookUrl: '/api/webhook/tradingview',
        },
      ],
      logs: [
        {
          id: `log_init_${Date.now()}`,
          time: Date.now(),
          type: 'info',
          message: 'تمت تهيئة محرك البوت الآلي متعدد المنصات (Binance, Bybit, OKX, KuCoin, Gate.io, TradingView). اضغط على "تشغيل البوت" لبدء المسح.',
        },
      ],
    };
  }

  public getState(): BotState {
    return {
      ...this.state,
      activePositions: [...this.state.activePositions],
      settings: { ...this.state.settings },
      logs: [...this.state.logs],
      connectedExchanges: [...this.state.connectedExchanges],
    };
  }

  public updateExchangeStatus(id: string, status: 'connected' | 'paper' | 'ready', apiKeyMasked?: string) {
    const ex = this.state.connectedExchanges.find((e) => e.id === id);
    if (ex) {
      ex.status = status;
      if (apiKeyMasked) ex.apiKeyMasked = apiKeyMasked;
      this.addLog('info', undefined, `تم تحديث ربط منصة ${ex.name} (${ex.arabicName}) إلى وضع ${status}.`);
    }
  }

  // Handle incoming TradingView or external Webhook signal
  public async handleWebhookSignal(data: {
    symbol: string;
    action: 'BUY' | 'SELL';
    quantity?: number;
    exchange?: string;
    price?: number;
    secret?: string;
    strategy?: string;
  }): Promise<{ success: boolean; message: string; order?: any }> {
    const symbol = (data.symbol || 'BTCUSDT').toUpperCase();
    const action = data.action === 'SELL' ? 'SELL' : 'BUY';
    const exchange = (data.exchange as any) || this.state.settings.targetExchange || 'binance';

    try {
      const account = await getAccountState(this.state.settings.tradeMode);
      const curPrice = data.price || 76000;
      const qty = data.quantity || Number((100 / curPrice).toFixed(4));

      const orderReq: OrderRequest = {
        symbol,
        side: action,
        type: 'MARKET',
        quantity: qty,
        mode: this.state.settings.tradeMode,
        exchange,
      };

      const order = await executeOrder(orderReq);
      this.state.totalTradesExecuted += 1;

      this.addLog(
        action === 'BUY' ? 'buy' : 'sell',
        symbol,
        `📡 [Webhook Signal] تنفيذ أمر ${action === 'BUY' ? 'شراء' : 'بيع'} لـ ${symbol} على منصة ${exchange.toUpperCase()}`,
        `المصدر: ${data.strategy || 'TradingView Webhook'} | الكمية: ${qty} | السعر: $${curPrice}`
      );

      if (action === 'BUY') {
        this.state.activePositions.push({
          symbol,
          exchange,
          entryPrice: curPrice,
          quantity: qty,
          stopLoss: Number((curPrice * 0.98).toFixed(2)),
          takeProfit: Number((curPrice * 1.04).toFixed(2)),
          time: Date.now(),
          orderId: order.orderId,
        });
      }

      return { success: true, message: `تم تنفيذ إشارة Webhook بنجاح لـ ${symbol}`, order };
    } catch (err: any) {
      this.addLog('warning', symbol, `فشل تنفيذ إشارة Webhook: ${err.message}`);
      return { success: false, message: err.message };
    }
  }

  public updateSettings(newSettings: Partial<BotSettings>): BotSettings {
    this.state.settings = {
      ...this.state.settings,
      ...newSettings,
    };
    this.addLog('info', undefined, 'تم تحديث إعدادات البوت واستراتيجية التداول.');
    return this.state.settings;
  }

  public start(): BotState {
    if (this.state.isRunning) return this.getState();

    this.state.isRunning = true;
    this.state.startedAt = Date.now();

    this.addLog(
      'info',
      undefined,
      `🟢 تم تشغيل بوت التداول الآلي بنجاح! يتم فحص ${this.state.settings.selectedSymbols.length} أزواج كل ${this.state.settings.scanIntervalSec} ثانية.`
    );

    // Run first scan immediately
    this.scanCycle().catch(() => {});

    // Set recurring timer
    const intervalMs = Math.max(10, this.state.settings.scanIntervalSec) * 1000;
    this.scanTimer = setInterval(() => {
      this.scanCycle().catch(() => {});
    }, intervalMs);

    return this.getState();
  }

  public stop(): BotState {
    if (!this.state.isRunning) return this.getState();

    this.state.isRunning = false;
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }

    this.addLog('warning', undefined, '🔴 تم إيقاف بوت التداول الآلي وتجميد إرسال الأوامر الجديدة.');
    return this.getState();
  }

  public clearLogs() {
    this.state.logs = [
      {
        id: `log_${Date.now()}`,
        time: Date.now(),
        type: 'info',
        message: 'تم مسح السجلات.',
      },
    ];
  }

  private addLog(
    type: 'info' | 'buy' | 'sell' | 'warning' | 'scan',
    symbol: string | undefined,
    message: string,
    details?: string
  ) {
    const entry: BotLogEntry = {
      id: `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      time: Date.now(),
      type,
      symbol,
      message,
      details,
    };
    this.state.logs.unshift(entry);
    // Keep last 150 logs
    if (this.state.logs.length > 150) {
      this.state.logs.pop();
    }
  }

  private async scanCycle() {
    if (!this.state.isRunning || this.isScanning) return;
    this.isScanning = true;
    this.state.lastScanAt = Date.now();
    this.state.totalScans += 1;

    try {
      const { selectedSymbols, interval, tradeMode, riskPerTrade, strategy } = this.state.settings;

      // 1. Get current balance
      const account = await getAccountState(tradeMode);
      const freeUsdt = account.freeUsdt;

      // 2. First, manage existing open positions (Check Take-Profit & Stop-Loss)
      await this.manageActivePositions(tradeMode);

      // 3. Scan symbols for new entry signals
      let signalsFoundCount = 0;

      for (const symbol of selectedSymbols) {
        if (!this.state.isRunning) break;

        // Skip if already holding an active position in this symbol
        const alreadyHolding = this.state.activePositions.some((p) => p.symbol === symbol);
        if (alreadyHolding) continue;

        try {
          const analysis = await getFullAnalysis(symbol, interval as any);
          const currentPrice = analysis.currentPrice;
          const signal = analysis.summary.overallSignal;
          const rsi = analysis.indicators.rsi.value;

          // Check strategy entry condition
          let shouldBuy = false;
          let entryReason = '';

          if (strategy === 'consensus_strong') {
            if (signal === 'شراء قوي' || (signal === 'شراء' && analysis.summary.buyCount >= 3)) {
              shouldBuy = true;
              entryReason = `توافق إيجابي قوي (${analysis.summary.consensusRatio}) مع اتجاه ${analysis.trade.trend}`;
            }
          } else if (strategy === 'rsi_extreme') {
            if (rsi <= 32) {
              shouldBuy = true;
              entryReason = `تشبع بيعي حاد لمؤشر RSI (${rsi.toFixed(1)} < 32)`;
            }
          } else if (strategy === 'trend_pullback') {
            if (analysis.trade.trend === 'صاعد' && (signal === 'شراء' || signal === 'شراء قوي')) {
              shouldBuy = true;
              entryReason = `تأكيد اتجاه صاعد مع إشارة شراء إيجابية`;
            }
          }

          if (shouldBuy) {
            signalsFoundCount++;

            // Calculate budget for this trade
            const budget = Math.max(15, (freeUsdt * riskPerTrade) / 100);

            if (freeUsdt < budget || budget < 10) {
              this.addLog(
                'warning',
                symbol,
                `تم رصد إشارة شراء لـ ${symbol} ولكن السيولة المتاحة ($${freeUsdt.toFixed(2)}) غير كافية.`
              );
              continue;
            }

            const rawQty = budget / currentPrice;
            const quantity = rawQty >= 1 ? Number(rawQty.toFixed(4)) : Number(rawQty.toFixed(6));

            if (quantity <= 0) continue;

            // Execute BUY order
            const orderReq: OrderRequest = {
              symbol,
              side: 'BUY',
              type: 'MARKET',
              quantity,
              mode: tradeMode,
              exchange: this.state.settings.targetExchange,
            };

            const executedOrder = await executeOrder(orderReq);
            this.state.totalTradesExecuted += 1;

            // Compute TP and SL based on ATR
            const atr = analysis.trade.atr14 || currentPrice * 0.02;
            const stopLoss = Number((currentPrice - 1.5 * atr).toFixed(4));
            const takeProfit = Number((currentPrice + 2.0 * 1.5 * atr).toFixed(4));

            const position: BotPosition = {
              symbol,
              exchange: this.state.settings.targetExchange,
              entryPrice: currentPrice,
              quantity,
              stopLoss,
              takeProfit,
              time: Date.now(),
              orderId: executedOrder.orderId,
            };

            this.state.activePositions.push(position);

            this.addLog(
              'buy',
              symbol,
              `⚡ [شراء آلي - ${this.state.settings.targetExchange.toUpperCase()}] تم شراء ${quantity} من ${symbol} بسعر $${currentPrice.toLocaleString('en-US')}`,
              `السبب: ${entryReason} | وقف الخسارة: $${stopLoss} | الهدف: $${takeProfit}`
            );
          }
        } catch (symErr: any) {
          // ignore individual symbol fetch error in loop
        }
      }

      // Periodic heartbeat scan log if no trades were executed
      if (signalsFoundCount === 0 && this.state.totalScans % 3 === 0) {
        this.addLog(
          'scan',
          undefined,
          `🔍 [فحص دوري] تم فحص ${selectedSymbols.length} أزواج: لا توجد إشارات شراء تستوفي شروط الاستراتيجية حالياً.`
        );
      }
    } catch (err: any) {
      this.addLog('warning', undefined, `تنبيه أثناء المسح الآلي: ${err.message || err}`);
    } finally {
      this.isScanning = false;
    }
  }

  private async manageActivePositions(mode: TradingMode) {
    const remainingPositions: BotPosition[] = [];

    for (const pos of this.state.activePositions) {
      try {
        const analysis = await getFullAnalysis(pos.symbol, '15m' as any);
        const curPrice = analysis.currentPrice;

        let shouldExit = false;
        let exitReason = '';

        if (curPrice >= pos.takeProfit) {
          shouldExit = true;
          exitReason = `🎯 [جني أرباح آلي] السعر ($${curPrice}) وصل للهدف المحدد ($${pos.takeProfit})`;
        } else if (curPrice <= pos.stopLoss) {
          shouldExit = true;
          exitReason = `🛑 [وقف خسارة آلي] السعر ($${curPrice}) وصل لوقف الخسارة ($${pos.stopLoss})`;
        } else if (this.state.settings.autoSellOnReversal && analysis.summary.overallSignal === 'بيع قوي') {
          shouldExit = true;
          exitReason = `🔄 [خروج لانعكاس الإشارة] تحولت المؤشرات إلى بيع قوي`;
        }

        if (shouldExit) {
          const sellReq: OrderRequest = {
            symbol: pos.symbol,
            side: 'SELL',
            type: 'MARKET',
            quantity: pos.quantity,
            mode,
          };
          await executeOrder(sellReq);

          const profitUsdt = (curPrice - pos.entryPrice) * pos.quantity;
          const profitPct = ((curPrice - pos.entryPrice) / pos.entryPrice) * 100;

          this.addLog(
            'sell',
            pos.symbol,
            `${exitReason} - تم بيع ${pos.quantity} ${pos.symbol}`,
            `سعر الدخول: $${pos.entryPrice} | سعر الخروج: $${curPrice} | النتيجة: ${
              profitUsdt >= 0 ? '+' : ''
            }$${profitUsdt.toFixed(2)} (${profitPct.toFixed(2)}%)`
          );
        } else {
          remainingPositions.push(pos);
        }
      } catch {
        remainingPositions.push(pos);
      }
    }

    this.state.activePositions = remainingPositions;
  }
}

export const tradingBot = new TradingBotEngine();
