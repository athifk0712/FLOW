import { MenuGrid, type MenuItem } from '@/components/dashboard/menu-grid';
import { SubScreen } from '@/components/sub-screen';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

const ITEMS: MenuItem[] = [
  { label: 'Akun & dompet', href: '/accounts', material: 'account_balance_wallet', sf: 'wallet.bifold' },
  { label: 'Anggaran', href: '/budgets', material: 'donut_large', sf: 'chart.pie' },
  { label: 'Target tabungan', href: '/goals', material: 'flag', sf: 'flag' },
  { label: 'Utang & piutang', href: '/debts', material: 'handshake', sf: 'person.2' },
  { label: 'Aset', href: '/portfolio', material: 'savings', sf: 'dollarsign.circle' },
  { label: 'Transaksi rutin', href: '/recurring', material: 'event_repeat', sf: 'repeat' },
  { label: 'Kategori', href: '/categories', material: 'category', sf: 'square.grid.2x2' },
  { label: 'Kebiasaan', href: '/habits', material: 'self_improvement', sf: 'leaf' },
  { label: 'Laporan', href: '/report', material: 'bar_chart', sf: 'chart.bar' },
  { label: 'Refleksi mingguan', href: '/weekly-review', material: 'rate_review', sf: 'text.bubble' },
  { label: 'Cek harian', href: '/coach', material: 'checklist', sf: 'checklist' },
  { label: 'Pengaturan', href: '/settings', material: 'settings', sf: 'gearshape' },
];

// Everything Flowku can do, one tap from Beranda's "Semua menu". Beranda itself keeps only the few shortcuts that are
// used most, so it stays short.
export default function MenuScreen() {
  return (
    <SubScreen title="Semua menu">
      <ThemedView type="backgroundElement" style={{ padding: Spacing.three, borderRadius: Spacing.four }}>
        <MenuGrid items={ITEMS} />
      </ThemedView>
    </SubScreen>
  );
}
