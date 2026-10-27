import { FEATURES } from '@/components/dashboard/features';
import { MenuGrid } from '@/components/dashboard/menu-grid';
import { SubScreen } from '@/components/sub-screen';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

// Everything Flowku can do, opened from the "Lainnya" tile on Beranda.
export default function MenuScreen() {
  return (
    <SubScreen title="Semua fitur">
      <ThemedView type="backgroundElement" style={{ padding: Spacing.three, borderRadius: Spacing.four }}>
        <MenuGrid items={FEATURES} />
      </ThemedView>
    </SubScreen>
  );
}
