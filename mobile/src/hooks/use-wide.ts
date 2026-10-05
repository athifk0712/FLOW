import { useWindowDimensions } from 'react-native';

/** From this window width the app switches to its desktop layout (sidebar, two columns). */
export const WIDE_BREAKPOINT = 960;

/** True on a laptop-sized window. Phones and tablets in portrait stay on the mobile layout. */
export function useWide() {
  return useWindowDimensions().width >= WIDE_BREAKPOINT;
}
