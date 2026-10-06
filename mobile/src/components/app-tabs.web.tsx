import { router } from 'expo-router';
import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps, type TabListProps } from 'expo-router/ui';
import { createContext, useContext } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppSymbol } from './app-symbol';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { Wordmark } from './wordmark';

import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useWide } from '@/hooks/use-wide';

const WideContext = createContext(false);

const TABS = [
  { name: 'home', href: '/', label: 'Beranda', icon: 'home' },
  { name: 'history', href: '/history', label: 'Riwayat', icon: 'history' },
  { name: 'flowku', href: '/flowku', label: 'Flowku', icon: 'forum' },
  { name: 'calendar', href: '/calendar', label: 'Kalender', icon: 'calendar_month' },
  { name: 'charts', href: '/charts', label: 'Diagram', icon: 'pie_chart' },
] as const;

// Web: on a phone, a bottom bar in normal layout flow (not overlaid), so screens never sit underneath it.
// On a laptop-wide window, a sidebar on the left with the main actions, like a desktop app.
export default function AppTabs() {
  const wide = useWide();
  return (
    <WideContext.Provider value={wide}>
      <Tabs style={[styles.root, wide && styles.rootWide]}>
        {wide ? (
          <>
            <TabList asChild>
              <Sidebar>
                {TABS.map((t) => (
                  <TabTrigger key={t.name} name={t.name} href={t.href} asChild>
                    <TabButton icon={t.icon}>{t.label}</TabButton>
                  </TabTrigger>
                ))}
              </Sidebar>
            </TabList>
            <TabSlot style={styles.slot} />
          </>
        ) : (
          <>
            <TabSlot style={styles.slot} />
            <TabList asChild>
              <CustomTabList>
                {TABS.map((t) => (
                  <TabTrigger key={t.name} name={t.name} href={t.href} asChild>
                    <TabButton icon={t.icon}>{t.label}</TabButton>
                  </TabTrigger>
                ))}
              </CustomTabList>
            </TabList>
          </>
        )}
      </Tabs>
    </WideContext.Provider>
  );
}

export function TabButton({ children, isFocused, icon, ...props }: TabTriggerSlotProps & { icon: string }) {
  const theme = useTheme();
  const wide = useContext(WideContext);
  const color = isFocused ? theme.primary : theme.textSecondary;
  return (
    <Pressable {...props} style={({ pressed }) => [!wide && styles.tab, pressed && styles.pressed]}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={wide ? styles.sideButton : styles.tabButtonView}>
        {wide && <AppSymbol material={icon} sf={icon} size={22} color={color} />}
        <ThemedText
          type={isFocused ? 'smallBold' : 'small'}
          themeColor={isFocused ? 'primary' : 'textSecondary'}
          style={!wide && styles.label}
          numberOfLines={1}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        {props.children}
      </ThemedView>
    </View>
  );
}

function Sidebar(props: TabListProps) {
  const theme = useTheme();
  return (
    <ThemedView {...props} type="backgroundElement" style={styles.sidebar}>
      <View style={styles.brand}>
        <Wordmark />
      </View>
      <Pressable
        onPress={() => router.push('/quick-log')}
        style={({ pressed }) => [styles.logButton, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
        <AppSymbol material="add" sf="plus" size={22} color={theme.onPrimary} />
        <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
          Catat transaksi
        </ThemedText>
      </Pressable>
      <View style={styles.sideNav}>{props.children}</View>
      <Pressable
        onPress={() => router.push('/settings')}
        style={({ pressed }) => [styles.sideButton, pressed && styles.pressed]}>
        <AppSymbol material="settings" sf="gearshape" size={22} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary">
          Pengaturan
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  rootWide: {
    flexDirection: 'row',
  },
  slot: {
    flex: 1,
  },
  tabListContainer: {
    width: '100%',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.one,
    alignItems: 'center',
  },
  innerContainer: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: MaxContentWidth,
    padding: Spacing.one,
    gap: Spacing.half,
    borderRadius: Spacing.four,
  },
  tab: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  label: {
    fontSize: 13,
  },
  sidebar: {
    width: 240,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  brand: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  sideNav: {
    flex: 1,
    gap: Spacing.one,
  },
  sideButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + Spacing.one,
    borderRadius: Spacing.three,
  },
});
