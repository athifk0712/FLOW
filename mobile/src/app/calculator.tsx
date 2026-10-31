import { router } from 'expo-router';
import { useEffect, useEffectEvent, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppSymbol } from '@/components/app-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModalEdges } from '@/constants/safe-area';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  type CalcKey,
  dropLast,
  evaluate,
  formatExpression,
  formatResult,
  pressKey,
  resultToAmount,
  resultToExpression,
} from '@/lib/calculator';
import { useCurrency } from '@/lib/money';
import { closeModal } from '@/lib/navigation';

type Key = CalcKey | 'C' | 'back' | '=';

const ROWS: Key[][] = [
  ['C', 'back', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['000', '0', ',', '='],
];

const KEY_LABEL: Partial<Record<Key, string>> = {
  C: 'Hapus semua',
  back: 'Hapus satu',
  '%': 'Persen',
  '÷': 'Bagi',
  '×': 'Kali',
  '−': 'Kurang',
  '+': 'Tambah',
  '=': 'Sama dengan',
  ',': 'Koma',
  '000': 'Tiga nol',
};

const SHEET_WIDTH = 480;
// A laptop keyboard types the usual symbols.
const KEYBOARD: Record<string, Key> = { '*': '×', x: '×', '/': '÷', '-': '−', '+': '+', '.': ',', ',': ',', '%': '%', '=': '=', Enter: '=', Backspace: 'back', Delete: 'C' };

// A plain calculator for working out an amount: splitting a bill, a discount, a total. The result can go straight into
// Catat. Nothing here is saved.
export default function CalculatorScreen() {
  const theme = useTheme();
  const currency = useCurrency();
  const [expr, setExpr] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const value = evaluate(expr);
  const amount = resultToAmount(value, currency.decimals);

  function press(key: Key) {
    setProblem(null);
    if (key === 'C') setExpr('');
    else if (key === 'back') setExpr(dropLast);
    else if (key === '=') {
      if (value !== null) setExpr(resultToExpression(value));
      else if (expr) setProblem('Tidak bisa dihitung. Coba periksa lagi, misalnya pembagian dengan nol.');
    } else setExpr((current) => pressKey(current, key));
  }

  const onKey = useEffectEvent((e: KeyboardEvent) => {
    const key = /^\d$/.test(e.key) ? (e.key as Key) : KEYBOARD[e.key];
    if (e.key === 'Escape') closeModal();
    else if (key) press(key);
    else return;
    e.preventDefault();
    e.stopPropagation();
  });
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const listener = (e: KeyboardEvent) => onKey(e);
    // Capture phase: Enter must not also press whichever button has focus.
    window.addEventListener('keydown', listener, true);
    return () => window.removeEventListener('keydown', listener, true);
  }, []);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={ModalEdges}>
        <View style={styles.header}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            KALKULATOR
          </ThemedText>
          <Pressable onPress={closeModal} hitSlop={12}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Tutup
            </ThemedText>
          </Pressable>
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.display}>
          <ThemedText themeColor="textSecondary" style={styles.expression} testID="calc-expression">
            {formatExpression(expr)}
          </ThemedText>
          <ThemedText
            numberOfLines={1}
            adjustsFontSizeToFit
            testID="calc-result"
            themeColor={value === null ? 'textSecondary' : 'text'}
            style={styles.result}>
            {value === null ? '0' : formatResult(value)}
          </ThemedText>
          {problem && (
            <ThemedText type="small" themeColor="warning" style={styles.right}>
              {problem}
            </ThemedText>
          )}
        </ScrollView>

        <Pressable
          disabled={amount === null}
          onPress={() => amount !== null && router.replace({ pathname: '/quick-log', params: { amount: String(amount) } })}
          style={({ pressed }) => [
            styles.log,
            { backgroundColor: theme.backgroundSelected },
            amount === null && styles.disabled,
            pressed && styles.pressed,
          ]}>
          <AppSymbol material="add" sf="plus" size={18} color={theme.primary} />
          <ThemedText type="smallBold" themeColor="primary">
            Catat sebagai transaksi
          </ThemedText>
        </Pressable>

        <View style={styles.pad}>
          {ROWS.map((row) => (
            <View key={row.join()} style={styles.row}>
              {row.map((key) => {
                const isEquals = key === '=';
                const isOperator = '÷×−+%'.includes(key);
                const isClear = key === 'C' || key === 'back';
                return (
                  <Pressable
                    key={key}
                    onPress={() => press(key)}
                    onLongPress={key === 'back' ? () => press('C') : undefined}
                    accessibilityRole="button"
                    accessibilityLabel={KEY_LABEL[key] ?? key}
                    style={({ pressed }) => [
                      styles.key,
                      {
                        backgroundColor: isEquals
                          ? theme.primary
                          : isOperator || isClear
                            ? theme.backgroundSelected
                            : theme.backgroundElement,
                      },
                      pressed && styles.pressed,
                    ]}>
                    {key === 'back' ? (
                      <AppSymbol material="backspace" sf="delete.left" size={24} color={theme.text} />
                    ) : (
                      <ThemedText
                        style={[
                          styles.keyText,
                          isOperator && { color: theme.primary },
                          isClear && { color: theme.danger },
                          isEquals && { color: theme.onPrimary },
                        ]}>
                        {key}
                      </ThemedText>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    width: '100%',
    maxWidth: SHEET_WIDTH,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  display: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    gap: Spacing.one,
  },
  expression: {
    fontSize: 20,
    lineHeight: 28,
    textAlign: 'right',
  },
  result: {
    fontSize: 52,
    lineHeight: 64,
    fontWeight: 700,
    textAlign: 'right',
  },
  right: {
    textAlign: 'right',
  },
  log: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two + 2,
    borderRadius: Spacing.three,
  },
  pad: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  key: {
    flex: 1,
    height: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
  },
  keyText: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: 600,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
});
