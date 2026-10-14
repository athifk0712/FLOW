import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppSymbol } from '@/components/app-symbol';
import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { type Currency, findCurrency } from '@/lib/currencies';
import { dateFromToday, formatDay } from '@/lib/debts';
import {
  addTarget,
  contribute,
  createGroup,
  deleteContribution,
  deleteGroup,
  draftReminder,
  type GroupDetail,
  joinGroup,
  leaveGroup,
  listGroups,
  loadGroup,
  rememberedGroup,
  rememberGroup,
  reviewContribution,
  setTargetStatus,
  type Target,
} from '@/lib/groups';
import { formatDigits, formatMoney, toDigits } from '@/lib/money';
import { shareText } from '@/lib/share-text';
import { fallbackReminder, type MemberStatus, STATUS_LABEL, targetProgress } from '@/lib/together';

type Props = { userId: string; displayName: string };

const DEADLINES = [
  { label: 'Tanpa tenggat', days: null },
  { label: '1 bulan', days: 30 },
  { label: '3 bulan', days: 91 },
  { label: '6 bulan', days: 182 },
];

// Group Space (Flowku Together): shared savings targets with friends. Separate from personal money: nothing here
// changes anyone's accounts. Members record their deposits; the owner confirms them, and only confirmed deposits
// count. Every permission is enforced by the database, the buttons only reflect it.
export function GroupSpace({ userId, displayName }: Props) {
  const theme = useTheme();
  const [groups, setGroups] = useState<{ id: string; name: string }[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<GroupDetail | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    (focus?: string | null) =>
      loadSpace(focus ?? null).then(
        (loaded) => {
          setError(null);
          setGroups(loaded.list);
          setSelected(loaded.id);
          setDetail(loaded.detail);
        },
        (e) => setError(e instanceof Error ? e.message : 'Gagal memuat grup.'),
      ),
    [],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function open(id: string) {
    setSelected(id);
    rememberGroup(id);
    setAdding(false);
    try {
      setDetail(await loadGroup(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat grup.');
    }
  }

  if (groups === null) {
    return error ? <ThemedText themeColor="danger">{error}</ThemedText> : <ActivityIndicator style={styles.loading} />;
  }

  if (groups.length === 0 || adding) {
    return (
      <View style={styles.stack}>
        {groups.length === 0 && (
          <ThemedView type="backgroundElement" style={styles.card}>
            <AppSymbol material="groups" sf="person.3.fill" size={36} color={theme.accent} />
            <ThemedText type="subtitle" style={styles.title}>
              Patungan bareng teman
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              Buat grup untuk liburan, kado, atau acara bersama. Tiap orang mencatat setorannya, pembuat grup
              mengonfirmasi, dan semua bisa lihat progresnya. Uang di akun pribadimu tidak ikut berubah.
            </ThemedText>
          </ThemedView>
        )}
        <StartGroup
          displayName={displayName}
          onDone={(id) => {
            setAdding(false);
            refresh(id);
          }}
          onCancel={groups.length > 0 ? () => setAdding(false) : undefined}
        />
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <View style={styles.wrap}>
        {groups.map((g) => (
          <Pressable
            key={g.id}
            onPress={() => open(g.id)}
            accessibilityState={{ selected: g.id === selected }}
            style={[styles.chip, { backgroundColor: g.id === selected ? theme.primary : theme.backgroundElement }]}>
            <ThemedText type="smallBold" style={{ color: g.id === selected ? theme.onPrimary : theme.text }}>
              {g.name}
            </ThemedText>
          </Pressable>
        ))}
        <Pressable
          onPress={() => setAdding(true)}
          style={[styles.chip, styles.dashed, { borderColor: theme.text, backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">+ Grup</ThemedText>
        </Pressable>
      </View>
      {error && <ThemedText themeColor="danger">{error}</ThemedText>}
      {!detail ? (
        <ActivityIndicator style={styles.loading} />
      ) : (
        <GroupDashboard
          key={detail.group.id}
          detail={detail}
          userId={userId}
          onChanged={() => open(detail.group.id)}
          onGone={() => refresh(null)}
        />
      )}
    </View>
  );
}

/** The user's groups and the one to open: the one asked for, else the remembered one, else the first. */
async function loadSpace(focus: string | null) {
  const list = await listGroups();
  const wanted = focus ?? rememberedGroup();
  const id = list.find((g) => g.id === wanted)?.id ?? list[0]?.id ?? null;
  rememberGroup(id);
  return { list, id, detail: id ? await loadGroup(id) : null };
}

function StartGroup({ displayName, onDone, onCancel }: { displayName: string; onDone: (id: string) => void; onCancel?: () => void }) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = [styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }];

  async function go(action: () => Promise<string>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onDone(await action());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">Buat grup baru</ThemedText>
      <View style={styles.row}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Nama grup, mis. Liburan Bali"
          placeholderTextColor={theme.textSecondary}
          maxLength={60}
          style={[...input, styles.flex]}
        />
        <Button label="Buat" disabled={!name.trim() || busy} onPress={() => go(() => createGroup(name.trim(), displayName))} />
      </View>
      <ThemedText type="smallBold">Atau gabung dengan kode undangan</ThemedText>
      <View style={styles.row}>
        <TextInput
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
          placeholder="Kode 8 huruf"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="characters"
          style={[...input, styles.flex]}
        />
        <Button label="Gabung" disabled={code.length !== 8 || busy} onPress={() => go(() => joinGroup(code, displayName))} />
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        Anggota lain akan melihatmu sebagai “{displayName}”.
      </ThemedText>
      {busy && <ActivityIndicator />}
      {error && <ThemedText themeColor="danger">{error}</ThemedText>}
      {onCancel && (
        <Pressable onPress={onCancel} hitSlop={8} style={styles.end}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Batal
          </ThemedText>
        </Pressable>
      )}
    </ThemedView>
  );
}

function GroupDashboard({
  detail,
  userId,
  onChanged,
  onGone,
}: {
  detail: GroupDetail;
  userId: string;
  onChanged: () => void;
  onGone: () => void;
}) {
  const theme = useTheme();
  const { group, members, targets } = detail;
  const currency = findCurrency(group.currency);
  const isOwner = members.some((m) => m.user_id === userId && m.role === 'owner');
  const [newTarget, setNewTarget] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function invite() {
    const how = await shareText(
      `Yuk patungan bareng di Flowku! Buka Flowku > Beranda > Grup > + Grup, lalu masukkan kode undangan: ${group.invite_code}`,
    ).catch(() => 'cancelled' as const);
    if (how === 'copied') setNote('Kode undangan disalin.');
  }

  async function exit() {
    if (!confirmExit) return setConfirmExit(true);
    try {
      if (isOwner) await deleteGroup(group.id);
      else await leaveGroup(group.id, userId);
      onGone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal.');
    }
  }

  return (
    <View style={styles.stack}>
      <ThemedView type="backgroundElement" style={styles.card}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <ThemedText type="subtitle" style={styles.title} numberOfLines={1}>
              {group.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {members.length} anggota · {isOwner ? 'kamu pembuat grup' : 'kamu anggota'}
            </ThemedText>
          </View>
          <Pressable
            onPress={invite}
            accessibilityLabel="Bagikan kode undangan"
            style={({ pressed }) => [styles.codePill, { backgroundColor: theme.backgroundSelected }, pressed && styles.pressed]}>
            <AppSymbol material="group_add" sf="person.badge.plus" size={18} color={theme.text} />
            <ThemedText type="smallBold">{group.invite_code}</ThemedText>
          </Pressable>
        </View>
        {note && (
          <ThemedText type="small" themeColor="textSecondary">
            {note}
          </ThemedText>
        )}
      </ThemedView>

      {targets.length === 0 && !newTarget && (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">Belum ada target bersama</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {isOwner
              ? 'Buat target pertama: berapa yang mau dikumpulkan, dan sampai kapan.'
              : 'Tunggu pembuat grup membuat target, lalu catat setoranmu di sini.'}
          </ThemedText>
        </ThemedView>
      )}

      {targets.map((t) => (
        <TargetCard key={t.id} target={t} detail={detail} userId={userId} isOwner={isOwner} currency={currency} onChanged={onChanged} />
      ))}

      {isOwner &&
        (newTarget ? (
          <NewTarget groupId={group.id} currency={currency} onDone={() => {
            setNewTarget(false);
            onChanged();
          }} onCancel={() => setNewTarget(false)} />
        ) : (
          <Pressable onPress={() => setNewTarget(true)} style={[styles.add, { borderColor: theme.textSecondary }]}>
            <ThemedText type="smallBold">+ Target bersama</ThemedText>
          </Pressable>
        ))}

      {error && <ThemedText themeColor="danger">{error}</ThemedText>}
      <Pressable onPress={exit} hitSlop={8} style={styles.center}>
        <ThemedText type="small" themeColor="danger">
          {confirmExit
            ? isOwner
              ? 'Ketuk lagi: hapus grup ini untuk semua anggota'
              : 'Ketuk lagi: keluar (setoranmu ikut terhapus dari grup)'
            : isOwner
              ? 'Hapus grup'
              : 'Keluar dari grup'}
        </ThemedText>
      </Pressable>
    </View>
  );
}

const STATUS_TONE: Record<MemberStatus, 'positive' | 'warning' | 'textSecondary'> = {
  LUNAS: 'positive',
  BERJALAN: 'warning',
  BELUM: 'textSecondary',
};

function TargetCard({
  target,
  detail,
  userId,
  isOwner,
  currency,
  onChanged,
}: {
  target: Target;
  detail: GroupDetail;
  userId: string;
  isOwner: boolean;
  currency: Currency;
  onChanged: () => void;
}) {
  const theme = useTheme();
  const contributions = detail.contributions.filter((c) => c.target_id === target.id);
  const p = targetProgress(target, detail.members, contributions);
  const money = (n: number) => formatMoney(n, currency);
  const pending = contributions.filter((c) => c.status === 'PENDING');
  const nameOf = (id: string) => (id === userId ? 'Kamu' : (detail.members.find((m) => m.user_id === id)?.display_name ?? 'Anggota'));
  const [paying, setPaying] = useState(false);
  const [digits, setDigits] = useState('');
  const [memo, setMemo] = useState('');
  const [remind, setRemind] = useState<{ memberId: string | null } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const done = target.status === 'DONE';

  async function act(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await action();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView type="backgroundElement" style={[styles.card, done && styles.dim]}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <ThemedText type="smallBold" numberOfLines={2}>
            {target.name}
            {done ? ' · selesai' : ''}
          </ThemedText>
          {target.deadline && (
            <ThemedText type="small" themeColor={p.daysLeft !== null && p.daysLeft < 0 && !p.reached ? 'danger' : 'textSecondary'}>
              {formatDay(target.deadline)} · {p.deadlineText}
            </ThemedText>
          )}
        </View>
        <ThemedText type="smallBold">{p.percent}%</ThemedText>
      </View>

      <View>
        <ThemedText style={styles.big}>{money(p.verified)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          terkumpul dari {money(target.target_amount)} · {p.reached ? 'target tercapai 🎉' : `kurang ${money(p.remaining)}`}
        </ThemedText>
      </View>
      <ProgressBar
        total={target.target_amount}
        segments={[
          { value: p.verified, color: theme.accent },
          { value: Math.min(p.pending, p.remaining), color: theme.backgroundSelected },
        ]}
      />
      {p.pending > 0 && (
        <ThemedText type="small" themeColor="textSecondary">
          {money(p.pending)} menunggu konfirmasi pembuat grup.
        </ThemedText>
      )}

      <ThemedText type="small" themeColor="textSecondary">
        Setoran anggota · bagian tiap orang {money(p.members[0]?.share ?? target.target_amount)}
      </ThemedText>
      {p.members.map((m) => (
        <View key={m.user_id} style={styles.member}>
          <View style={[styles.rank, { backgroundColor: m.rank === 1 ? theme.accent : theme.backgroundSelected }]}>
            <ThemedText type="smallBold" style={{ color: m.rank === 1 ? theme.onAccent : theme.text }}>
              {m.rank ?? '–'}
            </ThemedText>
          </View>
          <View style={styles.flex}>
            <ThemedText type="small" numberOfLines={1}>
              {m.user_id === userId ? `${m.name} (kamu)` : m.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {money(m.verified)}
              {m.pending > 0 ? ` (+${money(m.pending)} menunggu)` : ''}
            </ThemedText>
          </View>
          <ThemedText type="smallBold" themeColor={STATUS_TONE[m.status]}>
            {STATUS_LABEL[m.status]}
          </ThemedText>
          {!done && m.status !== 'LUNAS' && m.user_id !== userId && (
            <Pressable onPress={() => setRemind({ memberId: m.user_id })} hitSlop={8} accessibilityLabel={`Ingatkan ${m.name}`}>
              <AppSymbol material="auto_awesome" sf="sparkles" size={18} color={theme.primary} />
            </Pressable>
          )}
        </View>
      ))}

      {isOwner && pending.length > 0 && (
        <View style={styles.stackTight}>
          <ThemedText type="smallBold">Perlu dikonfirmasi</ThemedText>
          {pending.map((c) => (
            <View key={c.id} style={styles.member}>
              <ThemedText type="small" style={styles.flex} numberOfLines={2}>
                {nameOf(c.user_id)} · {money(c.amount)}
                {c.note ? ` · ${c.note}` : ''}
              </ThemedText>
              <Pressable onPress={() => act(() => reviewContribution(c.id, 'REJECTED'))} hitSlop={8}>
                <ThemedText type="smallBold" themeColor="danger">
                  Tolak
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => act(() => reviewContribution(c.id, 'VERIFIED'))}
                style={[styles.smallButton, { backgroundColor: theme.primary }]}>
                <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                  Konfirmasi
                </ThemedText>
              </Pressable>
            </View>
          ))}
        </View>
      )}
      {!isOwner &&
        pending
          .filter((c) => c.user_id === userId)
          .map((c) => (
            <View key={c.id} style={styles.member}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
                Setoranmu {money(c.amount)} menunggu konfirmasi.
              </ThemedText>
              <Pressable onPress={() => act(() => deleteContribution(c.id))} hitSlop={8}>
                <ThemedText type="small" themeColor="danger">
                  Batalkan
                </ThemedText>
              </Pressable>
            </View>
          ))}

      {!done &&
        (paying ? (
          <View style={styles.stackTight}>
            <View style={[styles.money, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="smallBold">{currency.symbol.trim()}</ThemedText>
              <TextInput
                value={formatDigits(digits, currency)}
                onChangeText={(t) => setDigits(toDigits(t))}
                placeholder="Jumlah setoran"
                placeholderTextColor={theme.textSecondary}
                keyboardType="number-pad"
                autoFocus
                style={[styles.moneyInput, { color: theme.text }]}
              />
            </View>
            <TextInput
              value={memo}
              onChangeText={setMemo}
              placeholder="Catatan (opsional), mis. transfer BCA"
              placeholderTextColor={theme.textSecondary}
              maxLength={140}
              style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
            />
            <View style={[styles.row, styles.end]}>
              <Pressable onPress={() => setPaying(false)} hitSlop={8}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  Batal
                </ThemedText>
              </Pressable>
              <Button
                label="Catat setoran"
                disabled={!Number(digits) || busy}
                onPress={() =>
                  act(async () => {
                    await contribute(detail.group.id, target.id, Number(digits), memo.trim() || null);
                    setPaying(false);
                    setDigits('');
                    setMemo('');
                  })
                }
              />
            </View>
            <ThemedText type="small" themeColor="textSecondary">
              Ini hanya catatan grup; saldo akun pribadimu tidak berubah. Kalau perlu, catat juga pengeluarannya di Catat.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.row}>
            <Button label="Setor" onPress={() => setPaying(true)} />
            <Pressable
              onPress={() => setRemind({ memberId: null })}
              style={({ pressed }) => [styles.ghost, { borderColor: theme.primary }, pressed && styles.pressed]}>
              <AppSymbol material="auto_awesome" sf="sparkles" size={16} color={theme.primary} />
              <ThemedText type="smallBold" themeColor="primary">
                Ingatkan via AI
              </ThemedText>
            </Pressable>
          </View>
        ))}

      {remind && (
        <ReminderPanel
          target={target}
          groupName={detail.group.name}
          remainingText={money(p.remaining)}
          deadlineText={p.deadlineText}
          memberId={remind.memberId}
          memberName={remind.memberId ? nameOf(remind.memberId) : null}
          onClose={() => setRemind(null)}
        />
      )}

      {isOwner && (
        <View style={[styles.row, styles.end]}>
          <Pressable onPress={() => act(() => setTargetStatus(target.id, done ? 'ACTIVE' : 'DONE'))} hitSlop={8}>
            <ThemedText type="small" themeColor="textSecondary">
              {done ? 'Aktifkan lagi' : 'Tandai selesai'}
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => (confirm === target.id ? act(() => setTargetStatus(target.id, 'CANCELLED')) : setConfirm(target.id))}
            hitSlop={8}>
            <ThemedText type="small" themeColor="danger">
              {confirm === target.id ? 'Yakin hapus target?' : 'Hapus target'}
            </ThemedText>
          </Pressable>
        </View>
      )}
      {busy && <ActivityIndicator />}
      {error && <ThemedText themeColor="danger">{error}</ThemedText>}
    </ThemedView>
  );
}

function ReminderPanel({
  target,
  groupName,
  remainingText,
  deadlineText,
  memberId,
  memberName,
  onClose,
}: {
  target: Target;
  groupName: string;
  remainingText: string;
  deadlineText: string | null;
  memberId: string | null;
  memberName: string | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [text, setText] = useState<string | null>(null);
  const [fallback, setFallback] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // State is only set once the draft arrives (AI, or the plain template when the AI can't answer).
  const request = useCallback(
    () =>
      draftReminder(target.id, memberId).then(
        (message) => {
          setText(message);
          setFallback(false);
        },
        () => {
          setText(fallbackReminder(groupName, target.name, remainingText, deadlineText));
          setFallback(true);
        },
      ),
    [target.id, target.name, memberId, groupName, remainingText, deadlineText],
  );

  useEffect(() => {
    request();
  }, [request]);

  function generate() {
    setText(null);
    setStatus(null);
    request();
  }

  async function share() {
    if (!text) return;
    const how = await shareText(text).catch(() => 'cancelled' as const);
    if (how === 'copied') setStatus('Pesan disalin. Tempel di grup chat kalian.');
  }

  return (
    <ThemedView type="backgroundSelected" style={styles.panel}>
      <ThemedText type="smallBold">{memberName ? `Pengingat untuk ${memberName}` : 'Pengingat untuk grup'}</ThemedText>
      {text === null ? (
        <View style={styles.row}>
          <ActivityIndicator />
          <ThemedText type="small" themeColor="textSecondary">
            Flowku sedang menulis pesan yang santai…
          </ThemedText>
        </View>
      ) : (
        <>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            maxLength={600}
            style={[styles.input, styles.message, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          />
          {fallback && (
            <ThemedText type="small" themeColor="textSecondary">
              AI sedang tidak tersedia, jadi ini versi standar. Silakan ubah dulu.
            </ThemedText>
          )}
          <ThemedText type="small" themeColor="textSecondary">
            Pesan tidak terkirim otomatis. Kamu yang memilih mau dibagikan ke mana.
          </ThemedText>
          <View style={styles.row}>
            <Button label="Bagikan" onPress={share} />
            <Pressable onPress={generate} hitSlop={8}>
              <ThemedText type="smallBold" themeColor="primary">
                Tulis ulang
              </ThemedText>
            </Pressable>
            <View style={styles.flex} />
            <Pressable onPress={onClose} hitSlop={8}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Tutup
              </ThemedText>
            </Pressable>
          </View>
          {status && (
            <ThemedText type="small" themeColor="textSecondary">
              {status}
            </ThemedText>
          )}
        </>
      )}
    </ThemedView>
  );
}

function NewTarget({ groupId, currency, onDone, onCancel }: { groupId: string; currency: Currency; onDone: () => void; onCancel: () => void }) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [digits, setDigits] = useState('');
  const [days, setDays] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const can = !!name.trim() && Number(digits) > 0 && !busy;

  async function save() {
    if (!can) return;
    setBusy(true);
    setError(null);
    try {
      await addTarget(groupId, { name: name.trim(), target_amount: Number(digits), deadline: days === null ? null : dateFromToday(days) });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal.');
      setBusy(false);
    }
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">Target bersama baru</ThemedText>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Untuk apa? mis. Sewa villa"
        placeholderTextColor={theme.textSecondary}
        maxLength={80}
        autoFocus
        style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundSelected }]}
      />
      <View style={[styles.money, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="smallBold">{currency.symbol.trim()}</ThemedText>
        <TextInput
          value={formatDigits(digits, currency)}
          onChangeText={(t) => setDigits(toDigits(t))}
          placeholder="Total yang dikumpulkan"
          placeholderTextColor={theme.textSecondary}
          keyboardType="number-pad"
          style={[styles.moneyInput, { color: theme.text }]}
        />
      </View>
      <View style={styles.wrap}>
        {DEADLINES.map((d) => (
          <Pressable
            key={d.label}
            onPress={() => setDays(d.days)}
            style={[styles.chip, { backgroundColor: days === d.days ? theme.primary : theme.backgroundSelected }]}>
            <ThemedText type="small" style={{ color: days === d.days ? theme.onPrimary : theme.text }}>
              {d.label}
            </ThemedText>
          </Pressable>
        ))}
      </View>
      {error && <ThemedText themeColor="danger">{error}</ThemedText>}
      <View style={[styles.row, styles.end]}>
        <Pressable onPress={onCancel} hitSlop={8}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Batal
          </ThemedText>
        </Pressable>
        <Button label="Simpan target" disabled={!can} onPress={save} />
      </View>
    </ThemedView>
  );
}

function Button({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, { backgroundColor: theme.primary }, disabled && styles.disabled, pressed && styles.pressed]}>
      <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: Spacing.three,
  },
  stackTight: {
    gap: Spacing.two,
  },
  loading: {
    padding: Spacing.five,
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.four,
  },
  panel: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  dim: {
    opacity: 0.7,
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
  },
  big: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: 700,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  end: {
    justifyContent: 'flex-end',
    alignSelf: 'flex-end',
    gap: Spacing.three,
  },
  center: {
    alignSelf: 'center',
    padding: Spacing.two,
  },
  chip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
  },
  dashed: {
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  codePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 40,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
  },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 40,
  },
  rank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: Spacing.three,
  },
  message: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  money: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  moneyInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 18,
    fontWeight: 600,
    paddingVertical: Spacing.two,
  },
  add: {
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  button: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
  },
  ghost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
  },
  smallButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
});
