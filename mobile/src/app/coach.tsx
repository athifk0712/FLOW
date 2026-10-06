import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppSymbol } from '@/components/app-symbol';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  applyTags,
  askCoach,
  type ChatMessage,
  type CoachMode,
  CoachUnavailable,
  loadTodaySession,
  loadUnlabeled,
  saveSession,
} from '@/lib/coach';
import { answerLocal, type LocalState, startLocal } from '@/lib/coach-local';
import { displayName } from '@/lib/display-name';
import { closeModal } from '@/lib/navigation';
import { useSession } from '@/providers/session-provider';

type Mode = 'ai' | 'local';
// "notice" is the app's own "it's all done" line under a reply; it isn't sent back to the AI.
type Bubble = { role: 'user' | 'assistant' | 'notice'; text: string };

const spoken = (all: Bubble[]) => all.filter((b): b is ChatMessage => b.role !== 'notice');

const FORGOT = 'Ada, tapi lupa dicatat';

// Two ways in: the companion on Beranda opens a free chat (?mode=chat) where Flowku answers whatever the user asks
// (and can move an expense to another category); "Cek harian" walks through the day's spending and labels it.
// AI when available; without it, the scripted daily check is the fallback for both.
export default function CoachScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ mode?: string }>();
  const coachMode: CoachMode = params.mode === 'chat' ? 'chat' : 'check';
  const { session } = useSession();
  const name = displayName(session?.user);
  const userName = name === 'Tamu Flowku' ? null : name;
  const scroll = useRef<ScrollView>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  // What the AI sees: its own turns as the JSON it produced, the user's answers as text.
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [local, setLocal] = useState<LocalState | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [finishedEarlier, setFinishedEarlier] = useState(false);
  const [busy, setBusy] = useState(true);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);

  async function start() {
    setBusy(true);
    setError(null);
    setBubbles([]);
    setHistory([]);
    setDone(false);
    setFinishedEarlier(false);
    setForgot(false);
    try {
      const turn = await askCoach([], null, coachMode, userName);
      setMode('ai');
      setHistory([{ role: 'assistant', text: JSON.stringify(turn) }]);
      setBubbles([{ role: 'assistant', text: turn.message }]);
      setOptions(turn.options);
      setDone(turn.done);
    } catch (e) {
      if (!(e instanceof CoachUnavailable)) setError(e instanceof Error ? e.message : 'Gagal memulai obrolan.');
      setAiNote(e instanceof CoachUnavailable ? e.message : null);
      try {
        const { state, turn } = startLocal(await loadUnlabeled());
        setMode('local');
        setLocal(state);
        setBubbles([{ role: 'assistant', text: turn.message }]);
        setOptions(turn.options);
      } catch (inner) {
        setError(inner instanceof Error ? inner.message : 'Gagal memuat transaksi.');
      }
    }
    setBusy(false);
  }

  useEffect(() => {
    // A chat always starts fresh; the daily check shows today's record once it is done.
    (coachMode === 'chat' ? Promise.resolve(null) : loadTodaySession()).then((session) => {
      if (session?.summary) {
        setMode(session.mode);
        setBubbles(session.messages);
        setDone(true);
        setFinishedEarlier(true);
        setBusy(false);
      } else {
        start();
      }
    });
    // Once, on open: the mode comes from the route and doesn't change while this screen is up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function reply(text: string) {
    const answer = text.trim();
    if (!answer || busy || done) return;
    setDraft('');
    setOptions([]);
    setError(null);
    const withUser = [...bubbles, { role: 'user' as const, text: answer }];
    setBubbles(withUser);
    setBusy(true);
    try {
      if (mode === 'ai') {
        const asked = [...history, { role: 'user' as const, text: answer }];
        const turn = await askCoach(asked, null, coachMode, userName);
        const all: Bubble[] = [...withUser, { role: 'assistant', text: turn.message }];
        if (turn.notice) all.push({ role: 'notice', text: turn.notice });
        setHistory([...asked, { role: 'assistant', text: JSON.stringify(turn) }]);
        setBubbles(all);
        setOptions(turn.options);
        if (turn.done) {
          setDone(true);
          // Only the daily check is kept as today's record; a chat is just a chat.
          if (coachMode === 'check') await saveSession('ai', spoken(all), turn.summary || turn.message);
        }
      } else if (local) {
        const before = local.tags.length;
        const { state, turn } = answerLocal(local, answer);
        await applyTags(state.tags.slice(before));
        const all: Bubble[] = [...withUser, { role: 'assistant', text: turn.message }];
        setLocal(state);
        setBubbles(all);
        setOptions(turn.options);
        if (answer === FORGOT) setForgot(true);
        if (turn.done) {
          setDone(true);
          await saveSession('local', spoken(all), turn.summary ?? turn.message);
        }
      }
    } catch (e) {
      // Put the options back so the user can try the same answer again.
      setBubbles(bubbles);
      setOptions(options);
      setError(e instanceof Error ? e.message : 'Gagal mengirim.');
    }
    setBusy(false);
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
          <View style={styles.header}>
            <View style={styles.headerTitle}>
              <View style={[styles.avatar, { backgroundColor: theme.primary }]}>
                {coachMode === 'chat' ? (
                  <View style={styles.face}>
                    <View style={[styles.eye, { backgroundColor: theme.onPrimary }]} />
                    <View style={[styles.eye, { backgroundColor: theme.onPrimary }]} />
                  </View>
                ) : (
                  <AppSymbol material="checklist" sf="checklist" size={18} color={theme.onPrimary} />
                )}
              </View>
              <View>
                <ThemedText type="smallBold">{coachMode === 'chat' ? 'Flowku' : 'Cek harian'}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {!mode
                    ? 'Menyiapkan…'
                    : coachMode === 'chat'
                      ? mode === 'ai'
                        ? 'Teman ngobrol soal uangmu'
                        : 'AI lagi istirahat, pakai cek cepat'
                      : 'Tandai pengeluaranmu'}
                </ThemedText>
              </View>
            </View>
            <Pressable onPress={closeModal} hitSlop={12}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Tutup
              </ThemedText>
            </Pressable>
          </View>

          <ScrollView
            ref={scroll}
            style={styles.flex}
            contentContainerStyle={styles.chat}
            onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled">
            {mode === 'local' && aiNote && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                Pakai versi cepat dulu. Labelmu tetap tersimpan.
              </ThemedText>
            )}
            {finishedEarlier && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
                Cek harian hari ini sudah selesai. Ini catatannya.
              </ThemedText>
            )}
            {bubbles.map((b, i) =>
              b.role === 'notice' ? (
                <View key={i} style={[styles.notice, { backgroundColor: theme.backgroundElement }]}>
                  <AppSymbol material="check_circle" sf="checkmark.circle.fill" size={16} color={theme.primary} />
                  <ThemedText type="smallBold" style={{ color: theme.primary }}>
                    {b.text}
                  </ThemedText>
                </View>
              ) : (
                <View
                  key={i}
                  style={[
                    styles.bubble,
                    b.role === 'user'
                      ? [styles.userBubble, { backgroundColor: theme.primary }]
                      : [styles.botBubble, { backgroundColor: theme.backgroundElement }],
                  ]}>
                  <ThemedText style={b.role === 'user' ? { color: theme.onPrimary } : undefined}>{b.text}</ThemedText>
                </View>
              ),
            )}
            {busy && (
              <View style={[styles.bubble, styles.botBubble, { backgroundColor: theme.backgroundElement }]}>
                <ActivityIndicator color={theme.textSecondary} />
              </View>
            )}
            {error && <ThemedText themeColor="danger">{error}</ThemedText>}
          </ScrollView>

          {!done && options.length > 0 && !busy && (
            <View style={styles.options}>
              {options.map((o) => (
                <Pressable
                  key={o}
                  onPress={() => reply(o)}
                  style={({ pressed }) => [
                    styles.option,
                    { borderColor: theme.primary, backgroundColor: theme.backgroundElement },
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText type="smallBold" style={{ color: theme.primary }}>
                    {o}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          )}

          {!done && mode === 'ai' && (
            <View style={[styles.inputRow, { backgroundColor: theme.backgroundElement }]}>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                value={draft}
                onChangeText={setDraft}
                onSubmitEditing={() => reply(draft)}
                placeholder={coachMode === 'chat' ? 'Tanya apa aja soal uangmu…' : 'Atau ketik jawabanmu…'}
                placeholderTextColor={theme.textSecondary}
                maxLength={500}
                editable={!busy}
                returnKeyType="send"
              />
              <Pressable
                onPress={() => reply(draft)}
                disabled={busy || !draft.trim()}
                hitSlop={8}
                style={[styles.send, { backgroundColor: theme.primary }, (busy || !draft.trim()) && styles.disabled]}>
                <AppSymbol material="arrow_upward" sf="arrow.up" size={20} color={theme.onPrimary} />
              </Pressable>
            </View>
          )}

          {done && (
            <View style={styles.footer}>
              {forgot && (
                <Pressable
                  onPress={() => router.replace('/quick-log')}
                  style={({ pressed }) => [styles.button, { backgroundColor: theme.primary }, pressed && styles.pressed]}>
                  <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                    Catat sekarang
                  </ThemedText>
                </Pressable>
              )}
              <Pressable
                onPress={closeModal}
                style={({ pressed }) => [
                  styles.button,
                  { backgroundColor: forgot ? theme.backgroundElement : theme.primary },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="smallBold" style={{ color: forgot ? theme.text : theme.onPrimary }}>
                  Selesai
                </ThemedText>
              </Pressable>
              {finishedEarlier && (
                <Pressable onPress={start} hitSlop={8} style={styles.again}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    Ulangi cek
                  </ThemedText>
                </Pressable>
              )}
            </View>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  face: {
    flexDirection: 'row',
    gap: 6,
  },
  eye: {
    width: 5,
    height: 8,
    borderRadius: 3,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chat: {
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  note: {
    textAlign: 'center',
    paddingHorizontal: Spacing.three,
  },
  notice: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Spacing.five,
  },
  bubble: {
    maxWidth: '85%',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: Spacing.four,
  },
  botBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: Spacing.one,
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: Spacing.one,
  },
  options: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  option: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
    borderWidth: 1.5,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.one + 2,
    paddingVertical: Spacing.one + 2,
    borderRadius: Spacing.five,
    marginBottom: Spacing.two,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: Spacing.two,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    gap: Spacing.two,
    paddingBottom: Spacing.three,
  },
  button: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  again: {
    alignSelf: 'center',
    padding: Spacing.two,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
});
