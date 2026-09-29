import { router } from 'expo-router';

/** Closes a modal screen. Opened from a link or after a web refresh there is nothing to go back to, so go home. */
export function closeModal() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
