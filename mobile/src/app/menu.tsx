import { FEATURES } from '@/components/dashboard/features';
import { MenuGrid } from '@/components/dashboard/menu-grid';
import { SubScreen } from '@/components/sub-screen';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

// Everything Flowku can do. Beranda shows the same grid; this screen stays for links that still open it.
export default function MenuScreen() {
  return (
    <SubScreen title="Semua menu">
      <ThemedView type="backgroundElement" style={{ padding: Spacing.three, borderRadius: Spacing.four }}>
        <MenuGrid items={FEATURES} />
      </ThemedView>
    </SubScreen>
  );
}
