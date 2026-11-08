import crypto from 'crypto';
import type {
  AssetBalance,
  OrderRequest,
  OrderSide,
  OrderStatus,
  OrderType,
  TradeOrder,
  TradingAccountState,
  TradingMode,
} from '../types/trading.ts';
import { getSingleTicker } from './binance.ts';

// Environment variables for Binance API
const ENV_API_KEY = process.env.BINANCE_API_KEY || '';
const ENV_API_SECRET = process.env.BINANCE_API_SECRET || '';
const ENV_USE_TESTNET = process.env.BINANCE_USE_TESTNET === 'true';

const LIVE_API_BASE = 'https://api.binance.com';
const TESTNET_API_BASE = 'https://testnet.binance.vision';

// In-Memory Paper Trading State
class PaperTradingEngine {
  private balances: Map<string, { free: number; locked: number }> = new Map();
  private orders: TradeOrder[] = [];

  constructor() {
    this.reset();
  }

  public reset(initialUsdt = 10000) {
    this.balances.clear();
    this.balances.set('USDT', { free: initialUsdt, locked: 0 });
    this.balances.set('BTC', { free: 0, locked: 0 });
    this.balances.set('ETH', { free: 0, locked: 0 });
    this.balances.set('BNB', { free: 0, locked: 0 });
    this.balances.set('SOL', { free: 0, locked: 0 });
    this.balances.set('XRP', { free: 0, locked: 0 });
    this.balances.set('ADA', { free: 0, locked: 0 });
    this.balances.set('DOGE', { free: 0, locked: 0 });
    this.balances.set('TON', { free: 0, locked: 0 });
    this.orders = [];
  }

  public getBalances(): AssetBalance[] {
    const list: AssetBalance[] = [];
    this.balances.forEach((val, asset) => {
      if (val.free > 0 || val.locked > 0 || asset === 'USDT') {
        list.push({
          asset,
          free: Number(val.free.toFixed(6)),
          locked: Number(val.locked.toFixed(6)),
        });
      }
    });
    return list;
  }

  public getOrders(): TradeOrder[] {
    return [...this.orders];
  }

  public async placeOrder(req: OrderRequest, currentMarketPrice: number): Promise<TradeOrder> {
    const baseAsset = req.symbol.replace('USDT', '').toUpperCase();
    const isBuy = req.side === 'BUY';
    const executionPrice = req.type === 'MARKET' ? currentMarketPrice : (req.price || currentMarketPrice);
    const orderCost = req.quantity * executionPrice;

    // Check balances
    const usdtBalance = this.balances.get('USDT') || { free: 0, locked: 0 };
    const baseBalance = this.balances.get(baseAsset) || { free: 0, locked: 0 };

    if (isBuy) {
      if (usdtBalance.free < orderCost) {
        throw new Error(
          `الرصيد المتاح من USDT غير كافٍ. المطلوب: $${orderCost.toFixed(2)} | المتاح: $${usdtBalance.free.toFixed(2)}`
        );
      }
    } else {
      if (baseBalance.free < req.quantity) {
        throw new Error(
          `الرصيد المتاح من ${baseAsset} غير كافٍ للبيع. المطلوب: ${req.quantity} | المتاح: ${baseBalance.free}`
        );
      }
    }

    const orderId = `paper_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    if (req.type === 'MARKET') {
      // Immediate execution
      if (isBuy) {
        usdtBalance.free -= orderCost;
        baseBalance.free += req.quantity;
      } else {
        baseBalance.free -= req.quantity;
        usdtBalance.free += orderCost;
      }

      this.balances.set('USDT', usdtBalance);
      this.balances.set(baseAsset, baseBalance);

      const order: TradeOrder = {
        orderId,
        symbol: req.symbol,
        side: req.side,
        type: 'MARKET',
        price: executionPrice,
        quantity: req.quantity,
        executedQty: req.quantity,
        cummulativeQuoteQty: orderCost,
        status: 'FILLED',
        time: Date.now(),
        mode: 'paper',
      };

      this.orders.unshift(order);
      return order;
    } else {
      // LIMIT order
      const isFilledImmediately =
        (isBuy && executionPrice >= currentMarketPrice) ||
        (!isBuy && executionPrice <= currentMarketPrice);

      if (isFilledImmediately) {
        if (isBuy) {
          usdtBalance.free -= orderCost;
          baseBalance.free += req.quantity;
        } else {
          baseBalance.free -= req.quantity;
          usdtBalance.free += orderCost;
        }

        this.balances.set('USDT', usdtBalance);
        this.balances.set(baseAsset, baseBalance);

        const order: TradeOrder = {
          orderId,
          symbol: req.symbol,
          side: req.side,
          type: 'LIMIT',
          price: executionPrice,
          quantity: req.quantity,
          executedQty: req.quantity,
          cummulativeQuoteQty: orderCost,
          status: 'FILLED',
          time: Date.now(),
          mode: 'paper',
        };
        this.orders.unshift(order);
        return order;
      } else {
        // Lock balance for pending order
        if (isBuy) {
          usdtBalance.free -= orderCost;
          usdtBalance.locked += orderCost;
        } else {
          baseBalance.free -= req.quantity;
          baseBalance.locked += req.quantity;
        }

        this.balances.set('USDT', usdtBalance);
        this.balances.set(baseAsset, baseBalance);

        const order: TradeOrder = {
          orderId,
          symbol: req.symbol,
          side: req.side,
          type: 'LIMIT',
          price: executionPrice,
          quantity: req.quantity,
          executedQty: 0,
          cummulativeQuoteQty: 0,
          status: 'NEW',
          time: Date.now(),
          mode: 'paper',
        };
        this.orders.unshift(order);
        return order;
      }
    }
  }

  public cancelOrder(orderId: string): TradeOrder {
    const order = this.orders.find((o) => o.orderId === orderId);
    if (!order) {
      throw new Error('لم يتم العثور على الأمر المطلوب إلغاؤه');
    }
    if (order.status !== 'NEW' && order.status !== 'PARTIALLY_FILLED') {
      throw new Error('لا يمكن إلغاء أمر تم تنفيذه بالفعل أو ملغي');
    }

    const baseAsset = order.symbol.replace('USDT', '');
    const isBuy = order.side === 'BUY';
    const orderCost = order.quantity * order.price;

    const usdtBalance = this.balances.get('USDT') || { free: 0, locked: 0 };
    const baseBalance = this.balances.get(baseAsset) || { free: 0, locked: 0 };

    if (isBuy) {
      usdtBalance.locked = Math.max(0, usdtBalance.locked - orderCost);
      usdtBalance.free += orderCost;
    } else {
      baseBalance.locked = Math.max(0, baseBalance.locked - order.quantity);
      baseBalance.free += order.quantity;
    }

    this.balances.set('USDT', usdtBalance);
    this.balances.set(baseAsset, baseBalance);

    order.status = 'CANCELED';
    return order;
  }
}

export const paperTrading = new PaperTradingEngine();

/**
 * Sign Binance API request with HMAC-SHA256
 */
function signBinanceRequest(params: Record<string, any>, secretKey: string) {
  const timestamp = Date.now();
  const queryParts = Object.entries({ ...params, timestamp }).map(
    ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`
  );
  const queryString = queryParts.join('&');
  const signature = crypto.createHmac('sha256', secretKey).update(queryString).digest('hex');
  return `${queryString}&signature=${signature}`;
}

/**
 * Call Binance Private API with signature
 */
async function callBinancePrivateApi<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  params: Record<string, any>,
  apiKey: string,
  secretKey: string,
  useTestnet = false
): Promise<T> {
  const baseUrl = useTestnet ? TESTNET_API_BASE : LIVE_API_BASE;
  const signedQuery = signBinanceRequest(params, secretKey);

  let url = `${baseUrl}${path}`;
  let body: string | undefined;
  const headers: Record<string, string> = {
    'X-MBX-APIKEY': apiKey,
    Accept: 'application/json',
  };

  if (method === 'GET' || method === 'DELETE') {
    url += `?${signedQuery}`;
  } else {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    body = signedQuery;
  }

  const res = await fetch(url, {
    method,
    headers,
    body,
  });

  const json = await res.json();
  if (!res.ok) {
    const errorMsg = json.msg || `خطأ من بينانس (${json.code || res.status})`;
    throw new Error(`خطأ في تنفيذ الأمر على بينانس: ${errorMsg}`);
  }

  return json as T;
}

/**
 * Get account state for UI
 */
export async function getAccountState(
  mode: TradingMode = 'paper',
  customKey?: string,
  customSecret?: string
): Promise<TradingAccountState> {
  const apiKey = customKey || ENV_API_KEY;
  const apiSecret = customSecret || ENV_API_SECRET;
  const isConfigured = Boolean(apiKey && apiSecret);

  if (mode === 'live' || mode === 'testnet') {
    if (!isConfigured) {
      // Fallback gracefully to paper trading state with notice
      const paperBalances = paperTrading.getBalances();
      const usdt = paperBalances.find((b) => b.asset === 'USDT')?.free || 0;
      return {
        mode: 'paper',
        isConfigured: false,
        canTrade: true,
        testnet: mode === 'testnet',
        totalEquityUsdt: usdt,
        freeUsdt: usdt,
        balances: paperBalances,
        openOrders: paperTrading.getOrders().filter((o) => o.status === 'NEW'),
        recentTrades: paperTrading.getOrders(),
      };
    }

    try {
      const useTestnet = mode === 'testnet' || ENV_USE_TESTNET;
      const accountData = await callBinancePrivateApi<any>(
        'GET',
        '/api/v3/account',
        {},
        apiKey,
        apiSecret,
        useTestnet
      );

      const balances: AssetBalance[] = (accountData.balances || [])
        .map((b: any) => ({
          asset: b.asset,
          free: Number(b.free),
          locked: Number(b.locked),
        }))
        .filter((b: AssetBalance) => b.free > 0 || b.locked > 0 || b.asset === 'USDT');

      // Fetch open orders
      const openOrdersRaw = await callBinancePrivateApi<any[]>(
        'GET',
        '/api/v3/openOrders',
        {},
        apiKey,
        apiSecret,
        useTestnet
      ).catch(() => []);

      const openOrders: TradeOrder[] = (openOrdersRaw || []).map((o: any) => ({
        orderId: String(o.orderId),
        symbol: o.symbol,
        side: o.side as OrderSide,
        type: o.type as OrderType,
        price: Number(o.price),
        quantity: Number(o.origQty),
        executedQty: Number(o.executedQty),
        cummulativeQuoteQty: Number(o.cummulativeQuoteQty),
        status: o.status as OrderStatus,
        time: o.time,
        mode,
      }));

      const freeUsdt = balances.find((b) => b.asset === 'USDT')?.free || 0;

      return {
        mode,
        isConfigured: true,
        canTrade: accountData.canTrade !== false,
        testnet: useTestnet,
        totalEquityUsdt: freeUsdt, // Base USDT
        freeUsdt,
        balances,
        openOrders,
        recentTrades: [],
      };
    } catch (err: any) {
      throw new Error(`تعذر جلب تفاصيل حساب بينانس: ${err.message}`);
    }
  }

  // Paper Trading Mode
  const balances = paperTrading.getBalances();
  const freeUsdt = balances.find((b) => b.asset === 'USDT')?.free || 0;
  const allOrders = paperTrading.getOrders();
  const openOrders = allOrders.filter((o) => o.status === 'NEW');

  return {
    mode: 'paper',
    isConfigured: true,
    canTrade: true,
    testnet: false,
    totalEquityUsdt: freeUsdt,
    freeUsdt,
    balances,
    openOrders,
    recentTrades: allOrders.slice(0, 50),
  };
}

/**
 * Place Order
 */
export async function executeOrder(
  req: OrderRequest,
  customKey?: string,
  customSecret?: string
): Promise<TradeOrder> {
  const mode = req.mode || 'paper';
  const apiKey = customKey || ENV_API_KEY;
  const apiSecret = customSecret || ENV_API_SECRET;

  const ticker = await getSingleTicker(req.symbol);
  const currentPrice = ticker.price;

  if (mode === 'paper' || (!apiKey && mode !== 'live')) {
    return await paperTrading.placeOrder(req, currentPrice);
  }

  // Live / Testnet Execution on Binance
  const useTestnet = mode === 'testnet' || ENV_USE_TESTNET;
  const params: Record<string, any> = {
    symbol: req.symbol.toUpperCase(),
    side: req.side,
    type: req.type,
    quantity: req.quantity,
  };

  if (req.type === 'LIMIT') {
    if (!req.price) throw new Error('يجب تحديد السعر لأمر Limit');
    params.price = req.price;
    params.timeInForce = 'GTC'; // Good 'til canceled
  }

  const raw = await callBinancePrivateApi<any>(
    'POST',
    '/api/v3/order',
    params,
    apiKey,
    apiSecret,
    useTestnet
  );

  return {
    orderId: String(raw.orderId),
    symbol: raw.symbol,
    side: raw.side as OrderSide,
    type: raw.type as OrderType,
    price: Number(raw.price || currentPrice),
    quantity: Number(raw.origQty),
    executedQty: Number(raw.executedQty),
    cummulativeQuoteQty: Number(raw.cummulativeQuoteQty),
    status: raw.status as OrderStatus,
    time: raw.transactTime || Date.now(),
    mode,
  };
}

/**
 * Cancel Order
 */
export async function cancelOrder(
  orderId: string,
  symbol: string,
  mode: TradingMode = 'paper',
  customKey?: string,
  customSecret?: string
): Promise<TradeOrder | { success: boolean; orderId: string }> {
  if (mode === 'paper') {
    return paperTrading.cancelOrder(orderId);
  }

  const apiKey = customKey || ENV_API_KEY;
  const apiSecret = customSecret || ENV_API_SECRET;
  const useTestnet = mode === 'testnet' || ENV_USE_TESTNET;

  const raw = await callBinancePrivateApi<any>(
    'DELETE',
    '/api/v3/order',
    {
      symbol: symbol.toUpperCase(),
      orderId,
    },
    apiKey,
    apiSecret,
    useTestnet
  );

  return {
    orderId: String(raw.orderId),
    symbol: raw.symbol,
    side: raw.side as OrderSide,
    type: raw.type as OrderType,
    price: Number(raw.price),
    quantity: Number(raw.origQty),
    executedQty: Number(raw.executedQty),
    cummulativeQuoteQty: Number(raw.cummulativeQuoteQty),
    status: raw.status as OrderStatus,
    time: Date.now(),
    mode,
  };
}
