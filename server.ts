import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  DEFAULT_SYMBOLS,
  VALID_TIMEFRAMES,
  get24hTickers,
  getBinanceStatus,
  getFullAnalysis,
  getKlines,
  getTimeframesSummary,
  getUsdtPairs,
  getWatchlistWithSignals,
  streamManager,
} from './src/server/binance.ts';
import {
  cancelOrder,
  executeOrder,
  getAccountState,
  paperTrading,
} from './src/server/trading.ts';
import { tradingBot } from './src/server/bot.ts';
import { journalAndAlerts } from './src/server/journalAndAlerts.ts';
import type { Timeframe } from './src/types/market.ts';
import type { OrderRequest, TradingMode } from './src/types/trading.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());

// API Routes
app.get('/api/status', (req: Request, res: Response) => {
  const status = getBinanceStatus();
  res.json({
    status: 'ok',
    ...status,
    serverTime: Date.now(),
  });
});

app.get('/api/watchlist', async (req: Request, res: Response) => {
  try {
    const data = await getWatchlistWithSignals();
    res.json({
      success: true,
      data,
      count: data.length,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    res.status(502).json({
      success: false,
      error: error.message || 'تعذر جلب قائمة المتابعة من بينانس',
      timestamp: Date.now(),
    });
  }
});

app.get('/api/ticker/24hr', async (req: Request, res: Response) => {
  try {
    const symbolsParam = req.query.symbols as string | undefined;
    const symbols = symbolsParam ? symbolsParam.split(',').map((s) => s.trim().toUpperCase()) : DEFAULT_SYMBOLS;
    const { tickers, cached, lastUpdated } = await get24hTickers(symbols);
    res.json({
      success: true,
      data: tickers,
      cached,
      lastUpdated,
    });
  } catch (error: any) {
    res.status(502).json({
      success: false,
      error: error.message || 'تعذر جلب أسعار 24 ساعة',
      timestamp: Date.now(),
    });
  }
});

app.get('/api/klines', async (req: Request, res: Response) => {
  try {
    const symbol = ((req.query.symbol as string) || 'BTCUSDT').toUpperCase();
    const interval = ((req.query.interval as string) || '1h') as Timeframe;
    const limit = Math.min(Number(req.query.limit) || 500, 1000);

    const { candles, cached, lastUpdated } = await getKlines(symbol, interval, limit);
    res.json({
      success: true,
      symbol,
      interval,
      count: candles.length,
      cached,
      lastUpdated,
      candles,
    });
  } catch (error: any) {
    res.status(502).json({
      success: false,
      error: error.message || 'تعذر جلب شموع التداول من بينانس',
      timestamp: Date.now(),
    });
  }
});

app.get('/api/analysis', async (req: Request, res: Response) => {
  try {
    const symbol = ((req.query.symbol as string) || 'BTCUSDT').toUpperCase();
    const interval = ((req.query.interval as string) || '1h') as Timeframe;

    if (!VALID_TIMEFRAMES.includes(interval)) {
      return res.status(400).json({
        success: false,
        error: `الإطار الزمني '${interval}' غير مدعوم. الأطر المتاحة: 15m, 1h, 4h, 1d`,
      });
    }

    const analysis = await getFullAnalysis(symbol, interval);
    res.json({
      success: true,
      data: analysis,
    });
  } catch (error: any) {
    res.status(502).json({
      success: false,
      error: error.message || 'فشل حساب التحليل الفني لبيانات الأصل',
      timestamp: Date.now(),
    });
  }
});

app.get('/api/timeframes-summary', async (req: Request, res: Response) => {
  try {
    const symbol = ((req.query.symbol as string) || 'BTCUSDT').toUpperCase();
    const data = await getTimeframesSummary(symbol);
    res.json({
      success: true,
      symbol,
      data,
      timestamp: Date.now(),
    });
  } catch (error: any) {
    res.status(502).json({
      success: false,
      error: error.message || 'تعذر جلب ملخص الأطر الزمنية',
      timestamp: Date.now(),
    });
  }
});

app.get('/api/pairs', async (req: Request, res: Response) => {
  try {
    const pairs = await getUsdtPairs();
    res.json({
      success: true,
      pairs,
      count: pairs.length,
    });
  } catch (error: any) {
    res.status(502).json({
      success: false,
      error: error.message || 'تعذر جلب قائمة أزواج USDT',
    });
  }
});

// Trading API Routes
app.get('/api/trade/config', (req: Request, res: Response) => {
  const hasEnvKeys = Boolean(process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET);
  res.json({
    success: true,
    hasEnvKeys,
    useTestnet: process.env.BINANCE_USE_TESTNET === 'true',
    defaultMode: hasEnvKeys ? 'live' : 'paper',
  });
});

app.get('/api/trade/account', async (req: Request, res: Response) => {
  try {
    const mode = (req.query.mode as TradingMode) || 'paper';
    const customKey = req.headers['x-binance-apikey'] as string | undefined;
    const customSecret = req.headers['x-binance-apisecret'] as string | undefined;

    const account = await getAccountState(mode, customKey, customSecret);
    res.json({
      success: true,
      data: account,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'تعذر جلب بيانات المحفظة والتداول',
    });
  }
});

app.post('/api/trade/order', async (req: Request, res: Response) => {
  try {
    const body: OrderRequest = req.body;
    const customKey = req.headers['x-binance-apikey'] as string | undefined;
    const customSecret = req.headers['x-binance-apisecret'] as string | undefined;

    if (!body.symbol || !body.side || !body.type || !body.quantity || body.quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'بيانات الأمر غير مكتملة (الرمز، العملية، النوع، الكمية مطلوبة)',
      });
    }

    const order = await executeOrder(body, customKey, customSecret);
    res.json({
      success: true,
      message: `تم تنفيذ أمر ${body.side === 'BUY' ? 'الشراء' : 'البيع'} بنجاح`,
      data: order,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'فشل تنفيذ الأمر',
    });
  }
});

app.delete('/api/trade/order', async (req: Request, res: Response) => {
  try {
    const orderId = req.query.orderId as string;
    const symbol = (req.query.symbol as string) || 'BTCUSDT';
    const mode = (req.query.mode as TradingMode) || 'paper';
    const customKey = req.headers['x-binance-apikey'] as string | undefined;
    const customSecret = req.headers['x-binance-apisecret'] as string | undefined;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: 'رقم الأمر (orderId) مطلوب للإلغاء',
      });
    }

    const canceled = await cancelOrder(orderId, symbol, mode, customKey, customSecret);
    res.json({
      success: true,
      message: 'تم إلغاء الأمر بنجاح',
      data: canceled,
    });
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message || 'فشل إلغاء الأمر',
    });
  }
});

app.post('/api/trade/reset-paper', (req: Request, res: Response) => {
  const initial = Number(req.body.initialUsdt) || 10000;
  paperTrading.reset(initial);
  res.json({
    success: true,
    message: `تمت إعادة تعيين المحفظة التجريبية برصيد ${initial} USDT`,
    data: {
      balances: paperTrading.getBalances(),
    },
  });
});

// Bot Control API Routes
app.get('/api/bot/status', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: tradingBot.getState(),
  });
});

app.post('/api/bot/start', (req: Request, res: Response) => {
  const state = tradingBot.start();
  res.json({
    success: true,
    message: 'تم تشغيل بوت التداول الآلي بنجاح',
    data: state,
  });
});

app.post('/api/bot/stop', (req: Request, res: Response) => {
  const state = tradingBot.stop();
  res.json({
    success: true,
    message: 'تم إيقاف بوت التداول الآلي بنجاح',
    data: state,
  });
});

app.post('/api/bot/settings', (req: Request, res: Response) => {
  const updated = tradingBot.updateSettings(req.body);
  res.json({
    success: true,
    message: 'تم حفظ إعدادات البوت بنجاح',
    data: updated,
  });
});

app.post('/api/bot/clear-logs', (req: Request, res: Response) => {
  tradingBot.clearLogs();
  res.json({
    success: true,
    message: 'تم مسح سجلات البوت',
  });
});

// Update exchange connection / status
app.post('/api/bot/exchange', (req: Request, res: Response) => {
  const { id, status, apiKeyMasked } = req.body;
  if (!id) return res.status(400).json({ success: false, error: 'معرف المنصة مطلوب' });
  tradingBot.updateExchangeStatus(id, status || 'connected', apiKeyMasked);
  res.json({
    success: true,
    message: `تم تحديث حالة منصة ${id} بنجاح`,
    data: tradingBot.getState().connectedExchanges,
  });
});

// TradingView & External Strategy Webhook Receiver
app.post('/api/webhook/tradingview', async (req: Request, res: Response) => {
  try {
    const { symbol, action, quantity, price, strategy, exchange } = req.body || {};
    const botState = tradingBot.getState();
    const expectedSecret = botState.settings.webhookSecret || 'ais-trader-bot-secret';

    // Strictly verify secret token before executing any order
    const providedSecret =
      (req.headers['x-webhook-secret'] as string) ||
      req.body?.secret ||
      (req.query?.secret as string);

    if (!providedSecret || providedSecret !== expectedSecret) {
      return res.status(401).json({
        success: false,
        error: 'مرفوض: رمز الأمان (Webhook Secret Token) مفقود أو غير صحيح. يجب تمرير المفتاح السري المعتمد في إعدادات البوت قبل التنفيذ.',
      });
    }

    const result = await tradingBot.handleWebhookSignal({
      symbol: symbol || 'BTCUSDT',
      action: action === 'SELL' ? 'SELL' : 'BUY',
      quantity: Number(quantity) || undefined,
      price: Number(price) || undefined,
      exchange: exchange || botState.settings.targetExchange || 'binance',
      strategy: strategy || 'TradingView Webhook Alert',
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Alerts API Routes
app.get('/api/alerts', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: journalAndAlerts.getAlerts(),
  });
});

app.post('/api/alerts', (req: Request, res: Response) => {
  try {
    const { symbol, type, targetPrice, targetSignal, note } = req.body;
    if (!symbol || !type) {
      return res.status(400).json({ success: false, error: 'الرمز ونوع التنبيه مطلوبان' });
    }
    const alert = journalAndAlerts.addAlert(symbol, type, targetPrice, targetSignal, note);
    res.json({ success: true, message: 'تم إنشاء التنبيه بنجاح', data: alert });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/alerts/toggle', (req: Request, res: Response) => {
  const { id } = req.body;
  const alert = journalAndAlerts.toggleAlert(id);
  if (!alert) return res.status(404).json({ success: false, error: 'التنبيه غير موجود' });
  res.json({ success: true, data: alert });
});

app.delete('/api/alerts', (req: Request, res: Response) => {
  const id = req.query.id as string;
  const deleted = journalAndAlerts.deleteAlert(id);
  res.json({ success: deleted });
});

// Trade Journal API Routes
app.get('/api/journal', async (req: Request, res: Response) => {
  try {
    const result = await journalAndAlerts.getTrades();
    res.json({ success: true, data: result.trades, stats: result.stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/journal', (req: Request, res: Response) => {
  try {
    const { symbol, direction, entryPrice, stopLoss, takeProfit, quantity, notes, strategyUsed } = req.body;
    if (!symbol || !direction || !entryPrice) {
      return res.status(400).json({ success: false, error: 'بيانات الصفقة غير مكتملة' });
    }
    const trade = journalAndAlerts.addTrade(
      symbol,
      direction,
      Number(entryPrice),
      Number(stopLoss),
      Number(takeProfit),
      Number(quantity || 1),
      notes,
      strategyUsed
    );
    res.json({ success: true, message: 'تم حفظ الصفقة في السجل بنجاح', data: trade });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/journal/status', (req: Request, res: Response) => {
  const { id, status } = req.body;
  const trade = journalAndAlerts.updateTradeStatus(id, status);
  if (!trade) return res.status(404).json({ success: false, error: 'الصفقة غير موجودة' });
  res.json({ success: true, data: trade });
});

app.delete('/api/journal', (req: Request, res: Response) => {
  const id = req.query.id as string;
  const deleted = journalAndAlerts.deleteTrade(id);
  res.json({ success: deleted });
});

// SSE Live Stream for candlestick updates
app.get('/api/stream', (req: Request, res: Response) => {
  const symbol = ((req.query.symbol as string) || 'BTCUSDT').toUpperCase();
  const interval = (req.query.interval as string) || '1h';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ type: 'connected', symbol, interval, time: Date.now() })}\n\n`);

  const unsubscribe = streamManager.subscribe(symbol, interval, (klineData) => {
    res.write(`data: ${JSON.stringify({ type: 'kline', ...klineData })}\n\n`);
  });

  // Heartbeat ping every 15s to keep connection alive
  const pingInterval = setInterval(() => {
    res.write(`:ping\n\n`);
  }, 15000);

  req.on('close', () => {
    clearInterval(pingInterval);
    unsubscribe();
    res.end();
  });
});

// Setup Vite or static serving
async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 الاسم_الجديد - Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
