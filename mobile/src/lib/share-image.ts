import * as Sharing from 'expo-sharing';
import type { RefObject } from 'react';
import { Platform, type View } from 'react-native';
import { captureRef, releaseCapture } from 'react-native-view-shot';

// Story size, so the picture fills a WhatsApp or Instagram status.
const STORY_WIDTH = 1080;
const STORY_HEIGHT = 1920;
// A browser fetches the download after the click, at a moment we aren't told about.
const REVOKE_DOWNLOAD_AFTER_MS = 60_000;

let lastCapture: string | null = null;

/**
 * Removes the last picture from the phone's cache; it can hold the user's finances. Not done right after sharing,
 * since the app it went to may still be reading the file, so it happens at the next picture or on leaving the screen.
 */
export function releaseSharedImage() {
  if (lastCapture) releaseCapture(lastCapture);
  lastCapture = null;
}

/**
 * Turns a view into a picture and hands it to the phone's share sheet. The user always chooses where it goes. In a
 * browser it uses the browser's share sheet when it can take files, otherwise the picture is downloaded.
 */
export async function shareViewAsImage(view: RefObject<View | null>, fileName: string): Promise<'shared' | 'saved'> {
  const size = { format: 'png', quality: 1, width: STORY_WIDTH, height: STORY_HEIGHT } as const;
  if (Platform.OS !== 'web') {
    releaseSharedImage();
    const uri = await captureRef(view, { ...size, result: 'tmpfile' });
    lastCapture = uri;
    await Sharing.shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Bagikan gambar' });
    return 'shared';
  }
  const dataUri = await captureRef(view, { ...size, result: 'data-uri' });
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
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DOWNLOAD_AFTER_MS);
  return 'saved';
}
