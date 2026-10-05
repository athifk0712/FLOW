import { StyleSheet, View } from 'react-native';

import { AppSymbol } from '@/components/app-symbol';
import { iconColor, iconFor } from '@/constants/category-icons';

type Props = {
  icon: string | null | undefined;
  size?: number;
};

// A category's icon on a soft circle tinted with its group color.
export function CategoryIcon({ icon, size = 36 }: Props) {
  const def = iconFor(icon);
  const color = iconColor(icon);
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: `${color}22` }]}>
      <AppSymbol material={def.material} sf={def.sf} size={size * 0.56} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
