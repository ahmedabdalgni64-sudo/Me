export type TradingMode = 'paper' | 'testnet' | 'live';
export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT';
export type OrderStatus = 'NEW' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELED' | 'REJECTED';

export type ExchangePlatform = 'binance' | 'bybit' | 'okx' | 'kucoin' | 'gateio' | 'tradingview';

export interface ExchangeConfig {
  id: ExchangePlatform;
  name: string;
  arabicName: string;
  color: string;
  badge: string;
  status: 'connected' | 'paper' | 'ready';
  supportedModes: ('paper' | 'testnet' | 'live')[];
  apiKeyMasked?: string;
  description: string;
  webhookUrl?: string;
}

export interface OrderRequest {
  symbol: string;
  side: OrderSide;
  type: OrderType;
  quantity: number;
  price?: number;
  stopPrice?: number;
  mode?: TradingMode;
  exchange?: ExchangePlatform;
}

export interface TradeOrder {
  orderId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  price: number;
  quantity: number;
  executedQty: number;
  cummulativeQuoteQty: number;
  status: OrderStatus;
  time: number;
  mode: TradingMode;
  exchange?: ExchangePlatform;
}

export interface AssetBalance {
  asset: string;
  free: number;
  locked: number;
  valueInUsdt?: number;
}

export interface TradingAccountState {
  mode: TradingMode;
  exchange?: ExchangePlatform;
  isConfigured: boolean;
  canTrade: boolean;
  testnet: boolean;
  totalEquityUsdt: number;
  freeUsdt: number;
  balances: AssetBalance[];
  openOrders: TradeOrder[];
  recentTrades: TradeOrder[];
}

export type BotStrategy = 'consensus_strong' | 'trend_pullback' | 'rsi_extreme';

export interface BotSettings {
  selectedSymbols: string[];
  interval: string;
  tradeMode: TradingMode;
  targetExchange: ExchangePlatform;
  strategy: BotStrategy;
  riskPerTrade: number; // e.g. 5%
  takeProfitRatio: number; // e.g. 2.0
  stopLossAtrMult: number; // e.g. 1.5
  autoSellOnReversal: boolean;
  scanIntervalSec: number;
  webhookSecret?: string;
}

export interface BotLogEntry {
  id: string;
  time: number;
  type: 'info' | 'buy' | 'sell' | 'warning' | 'scan';
  symbol?: string;
  exchange?: ExchangePlatform;
  message: string;
  details?: string;
}

export interface BotPosition {
  symbol: string;
  exchange: ExchangePlatform;
  entryPrice: number;
  quantity: number;
  stopLoss: number;
  takeProfit: number;
  time: number;
  orderId: string;
}

export interface BotState {
  isRunning: boolean;
  startedAt: number | null;
  lastScanAt: number | null;
  totalScans: number;
  totalTradesExecuted: number;
  activePositions: BotPosition[];
  settings: BotSettings;
  logs: BotLogEntry[];
  connectedExchanges: ExchangeConfig[];
}
