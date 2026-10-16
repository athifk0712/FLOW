import { Platform } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

// Safe-area edges for a modal screen. On iOS a modal is a sheet below the status bar; on Android it fills the screen
// (edge-to-edge), so the header needs the top inset too or it runs into the status bar.
export const ModalEdges: Edge[] = Platform.OS === 'ios' ? ['bottom', 'left', 'right'] : ['top', 'bottom', 'left', 'right'];
