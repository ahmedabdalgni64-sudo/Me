export function formatPrice(price: number): string {
  if (price === undefined || price === null || isNaN(price)) return '0.00';
  if (price >= 1000) {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  if (price >= 1) {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  }
  return price.toLocaleString('en-US', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  });
}

export function formatPercent(val: number): string {
  if (val === undefined || val === null || isNaN(val)) return '0.00%';
  const prefix = val > 0 ? '+' : '';
  return `${prefix}${val.toFixed(2)}%`;
}

export function formatVolume(vol: number): string {
  if (!vol || isNaN(vol)) return '0';
  if (vol >= 1_000_000_000) {
    return `${(vol / 1_000_000_000).toFixed(2)}B`;
  }
  if (vol >= 1_000_000) {
    return `${(vol / 1_000_000).toFixed(2)}M`;
  }
  if (vol >= 1_000) {
    return `${(vol / 1_000).toFixed(2)}K`;
  }
  return vol.toFixed(2);
}

export function formatTimeAgo(timestampMs: number): string {
  if (!timestampMs) return 'غير متوفر';
  const diffSec = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));
  if (diffSec < 5) return 'الآن';
  if (diffSec < 60) return `منذ ${diffSec} ثانية`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
  const diffHours = Math.floor(diffMin / 60);
  return `منذ ${diffHours} ساعة`;
}

export const ASSET_ARABIC_NAMES: Record<string, string> = {
  BTC: 'بيتكوين',
  ETH: 'إيثيريوم',
  BNB: 'بينانس كوين',
  SOL: 'سولانا',
  XRP: 'ريبل',
  ADA: 'كاردانو',
  DOGE: 'دوجكوين',
  TON: 'تون كوين',
  AVAX: 'أفالانش',
  LINK: 'تشين لينك',
  DOT: 'بولكادوت',
  NEAR: 'نير بروتوكول',
  SUI: 'سوي',
  PEPE: 'بيبي',
};
