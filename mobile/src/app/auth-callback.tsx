import { router } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';

// Where Google sends the phone back to ("flow://auth-callback?code=..." or "...#error=..."). The login result is
// read by the screen that started it (lib/oauth.ts, via WebBrowser.openAuthSessionAsync); expo-router also opens
// this deep link, so this route only steps back out of the way. Without it the link went to "/", which closed
// Profil before it could show "this Google account already has a Flowku account".
export default function AuthCallbackScreen() {
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);
  return <View />;
}
