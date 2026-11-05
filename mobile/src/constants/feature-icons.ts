import type { FeatureIconName } from '@/components/feature-icon';

// The "Normal" icon of every feature: a line symbol, Material Symbols on Android and web, SF Symbols on iOS.
// A Record, so a new feature without a symbol here is a type error instead of a blank circle.
export const NORMAL_SYMBOLS: Record<FeatureIconName, { material: string; sf: string }> = {
  wallet: { material: 'account_balance_wallet', sf: 'wallet.bifold' },
  pocket: { material: 'inventory_2', sf: 'tray.2' },
  budget: { material: 'donut_large', sf: 'chart.pie' },
  goal: { material: 'flag', sf: 'flag' },
  debt: { material: 'handshake', sf: 'person.2' },
  asset: { material: 'trending_up', sf: 'chart.line.uptrend.xyaxis' },
  recurring: { material: 'autorenew', sf: 'arrow.triangle.2.circlepath' },
  category: { material: 'label', sf: 'tag' },
  habit: { material: 'local_fire_department', sf: 'flame' },
  report: { material: 'bar_chart', sf: 'chart.bar' },
  calculator: { material: 'calculate', sf: 'plus.forwardslash.minus' },
  reflection: { material: 'auto_stories', sf: 'book' },
  checkin: { material: 'event_available', sf: 'checkmark.circle' },
  settings: { material: 'settings', sf: 'gearshape' },
  ai: { material: 'auto_awesome', sf: 'sparkles' },
  more: { material: 'apps', sf: 'square.grid.2x2' },
};
