import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue, StyleProp, ViewStyle } from 'react-native';

type Names = Extract<SymbolViewProps['name'], object>;

type Props = {
  /** Material Symbols name, used on Android and web. */
  material: string;
  /** SF Symbols name, used on iOS. */
  sf: string;
  size?: number;
  color: ColorValue;
  style?: StyleProp<ViewStyle>;
};

// One icon, native on each platform: SF Symbols on iOS, Material Symbols (bundled font) elsewhere.
export function AppSymbol({ material, sf, size = 22, color, style }: Props) {
  const name = { ios: sf, android: material, web: material } as Names;
  return <SymbolView name={name} size={size} tintColor={color} style={style} />;
}
