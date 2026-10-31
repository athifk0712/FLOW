import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { Platform, type View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

// Story size, so the picture fills a WhatsApp or Instagram status.
const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;

/**
 * Turns a view into a picture and hands it to the phone's share sheet. The user always chooses where it goes. In a
 * browser it uses the browser's share sheet when it can take files, otherwise the picture is downloaded.
 */
export async function shareViewAsImage(view: RefObject<View | null>, fileName: string): Promise<'shared' | 'saved'> {
  if (Platform.OS !== 'web') {
    const uri = await captureRef(view, { format: 'png', quality: 1, result: 'tmpfile', width: STORY_WIDTH, height: STORY_HEIGHT });
    await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Bagikan rekap' });
    return 'shared';
  }
  const dataUri = await captureRef(view, { format: 'png', quality: 1, result: 'data-uri' });
  const blob = await (await fetch(dataUri)).blob();
  const file = new File([blob], fileName, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return 'shared';
    } catch (e) {
      // Closing the sheet is an answer too; anything else falls through to a download.
      if (e instanceof DOMException && e.name === 'AbortError') return 'shared';
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
  return 'saved';
}
