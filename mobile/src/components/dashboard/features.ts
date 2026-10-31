import type { Href } from 'expo-router';

import type { FeatureIconName } from '@/components/feature-icon';

export type Feature = { label: string; href: Href; icon: FeatureIconName };

// Everything Flowku can do, on the "Semua fitur" screen. Labels are short so each fits on one line under its icon.
export const FEATURES: Feature[] = [
  { label: 'Dompet', href: '/accounts', icon: 'wallet' },
  { label: 'Anggaran', href: '/budgets', icon: 'budget' },
  { label: 'Target', href: '/goals', icon: 'goal' },
  { label: 'Utang', href: '/debts', icon: 'debt' },
  { label: 'Aset', href: '/portfolio', icon: 'asset' },
  { label: 'Rutin', href: '/recurring', icon: 'recurring' },
  { label: 'Kategori', href: '/categories', icon: 'category' },
  { label: 'Kebiasaan', href: '/habits', icon: 'habit' },
  { label: 'Laporan', href: '/report', icon: 'report' },
  { label: 'Kalkulator', href: '/calculator', icon: 'calculator' },
  { label: 'Refleksi', href: '/weekly-review', icon: 'reflection' },
  { label: 'Cek harian', href: '/coach', icon: 'checkin' },
  { label: 'Pengaturan', href: '/settings', icon: 'settings' },
];

const MAIN: Feature['label'][] = ['Dompet', 'Anggaran', 'Target', 'Utang', 'Aset', 'Rutin', 'Laporan'];

// Beranda shows only the seven used most, like Gojek, and an eighth tile that opens everything. The rest are either
// set up once (Kategori), already one tap away elsewhere (Pengaturan tab, streak badge, to-do rows), or occasional.
export const HOME_FEATURES: Feature[] = [
  ...FEATURES.filter((f) => MAIN.includes(f.label)),
  { label: 'Lainnya', href: '/menu', icon: 'more' },
];
