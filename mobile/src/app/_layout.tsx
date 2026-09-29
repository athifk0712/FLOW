import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Colors } from '@/constants/theme';
import { Notifications, REMINDER_ROUTES, REMINDERS_SUPPORTED } from '@/lib/reminders';
import { SessionProvider, useSession } from '@/providers/session-provider';

SplashScreen.preventAutoHideAsync();

// React Navigation themes in Flowku colors, so stack and modal backgrounds match the screens.
const navigationTheme = (base: typeof DefaultTheme, colors: (typeof Colors)['light' | 'dark']) => ({
  ...base,
  colors: {
    ...base.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.backgroundElement,
    text: colors.text,
    border: colors.backgroundSelected,
  },
});
const LIGHT_THEME = navigationTheme(DefaultTheme, Colors.light);
const DARK_THEME = navigationTheme(DarkTheme, Colors.dark);

// Tapping a review reminder opens that review, including when it launched the app.
function useNativeReminderNavigation(enabled: boolean) {
  const response = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!enabled || !response) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const url = REMINDER_ROUTES.find((route) => route === response.notification.request.content.data?.url);
    if (!url) return;
    router.push(url);
    Notifications.clearLastNotificationResponse();
  }, [enabled, response]);
}

// Chosen once at module load, so the hook call order never changes between renders.
const useReminderNavigation: (enabled: boolean) => void = REMINDERS_SUPPORTED ? useNativeReminderNavigation : () => {};

function RootNavigator() {
  const { session, isLoading } = useSession();
  useReminderNavigation(!!session);

  // Keep the native splash up until the stored session has been restored.
  if (isLoading) return null;

  return (
    <>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(app)" />
          <Stack.Screen name="quick-log" options={{ presentation: 'modal' }} />
          <Stack.Screen name="review" options={{ presentation: 'modal' }} />
          <Stack.Screen name="weekly-review" options={{ presentation: 'modal' }} />
          <Stack.Screen name="intent-new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="transaction/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="accounts" options={{ presentation: 'modal' }} />
          <Stack.Screen name="categories" options={{ presentation: 'modal' }} />
          <Stack.Screen name="budgets" options={{ presentation: 'modal' }} />
          <Stack.Screen name="report" options={{ presentation: 'modal' }} />
          <Stack.Screen name="recurring" options={{ presentation: 'modal' }} />
          <Stack.Screen name="goals" options={{ presentation: 'modal' }} />
        </Stack.Protected>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DARK_THEME : LIGHT_THEME}>
      <SessionProvider>
        <RootNavigator />
      </SessionProvider>
    </ThemeProvider>
  );
}
