import { Platform, Share } from 'react-native';

/**
 * Hands text to the phone's share sheet (WhatsApp, Telegram, copy, ...). On a browser without a share sheet it is
 * copied instead. Returns what happened so the UI can say so. The user always chooses where it goes.
 */
export async function shareText(message: string): Promise<'shared' | 'copied' | 'cancelled'> {
  if (Platform.OS === 'web') {
    const nav = globalThis.navigator as Navigator | undefined;
    if (nav?.share) {
      try {
        await nav.share({ text: message });
        return 'shared';
      } catch {
        return 'cancelled';
      }
    }
    await nav?.clipboard?.writeText(message);
    return 'copied';
  }
  const result = await Share.share({ message });
  return result.action === Share.dismissedAction ? 'cancelled' : 'shared';
}
