export type AlertType = 'PRICE_ABOVE' | 'PRICE_BELOW' | 'SIGNAL_CHANGE' | 'STRONG_BUY_SIGNAL';

export interface PriceAlert {
  id: string;
  symbol: string;
  type: AlertType;
  targetPrice?: number;
  targetSignal?: string;
  conditionDescription: string;
  isActive: boolean;
  isTriggered: boolean;
  createdAt: number;
  triggeredAt?: number;
  note?: string;
}

export type JournalTradeStatus = 'OPEN' | 'WON' | 'LOST' | 'CANCELED';

export interface JournalTrade {
  id: string;
  symbol: string;
  direction: 'شراء' | 'بيع';
  entryPrice: number;
  currentPrice: number;
  stopLoss: number;
  takeProfit: number;
  quantity: number;
  riskRewardRatio: number;
  status: JournalTradeStatus;
  pnlUsdt: number;
  pnlPercent: number;
  entryTime: number;
  exitTime?: number;
  notes?: string;
  strategyUsed?: string;
}

export interface UserPreferences {
  defaultTimeframe: '15m' | '1h' | '4h' | '1d';
  soundAlertsEnabled: boolean;
  browserNotificationsEnabled: boolean;
  defaultRiskPercentage: number;
  preferredTheme: 'dark';
  favoriteSymbols: string[];
}
