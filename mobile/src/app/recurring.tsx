import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  NECESSITY,
  NECESSITY_ORDER,
  type Necessity,
} from "@/constants/necessity";
import { MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { Tables } from "@/lib/database.types";
import { formatDigits, formatMoney, getCurrency, toDigits } from "@/lib/money";
import { closeModal } from "@/lib/navigation";
import { syncDueReminders } from "@/lib/reminders";
import { supabase } from "@/lib/supabase";

type Rule = Tables<"recurring_transactions">;
type Kind = "EXPENSE" | "INCOME";
type Account = Pick<Tables<"accounts">, "id" | "name">;
type Category = Pick<Tables<"categories">, "id" | "name" | "kind">;
// 'new' = the add form; an id = editing that rule.
type Editing = "new" | string | null;

const dueFormat = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
});

/** "2026-10-05" -> local Date (a plain date string would otherwise parse as UTC midnight). */
function localDate(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// Monthly rules (rent, subscriptions, salary). The dashboard posts due ones via post_due_recurring().
export default function RecurringScreen() {
  const theme = useTheme();
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<Editing>(null);

  const [kind, setKind] = useState<Kind>("EXPENSE");
  const [name, setName] = useState("");
  const [digits, setDigits] = useState("");
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [necessity, setNecessity] = useState<Necessity | null>(null);
  const [day, setDay] = useState("");
  const [active, setActive] = useState(true);

  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [r, a, c] = await Promise.all([
      supabase.from("recurring_transactions").select("*").order("day_of_month"),
      supabase
        .from("accounts")
        .select("id, name")
        .is("archived_at", null)
        .order("created_at"),
      supabase.from("categories").select("id, name, kind").order("created_at"),
    ]);
    const failed = r.error ?? a.error ?? c.error;
    if (failed) return setError(failed.message);
    setRules(r.data ?? []);
    syncDueReminders();
    setAccounts(a.data ?? []);
    setCategories(c.data ?? []);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function openForm(target: Editing) {
    const rule = rules?.find((r) => r.id === target);
    setEditing(target);
    setKind(rule?.type === "INCOME" ? "INCOME" : "EXPENSE");
    setName(rule?.name ?? "");
    setDigits(rule ? String(rule.amount) : "");
    setAccountId(rule?.account_id ?? accounts[0]?.id ?? null);
    setCategoryId(rule?.category_id ?? null);
    setNecessity(rule?.necessity ?? null);
    setDay(rule ? String(rule.day_of_month) : String(new Date().getDate()));
    setActive(rule?.active ?? true);
    setConfirmDelete(false);
    setError(null);
  }

  function switchKind(next: Kind) {
    setKind(next);
    setCategoryId(null);
    if (next === "INCOME") setNecessity(null);
  }

  const dayNumber = Number(day);
  const dayValid =
    Number.isInteger(dayNumber) && dayNumber >= 1 && dayNumber <= 31;
  const canSave =
    name.trim().length > 0 &&
    Number(digits) > 0 &&
    !!accountId &&
    dayValid &&
    !saving;

  async function run(
    action: () => PromiseLike<{ error: { message: string } | null }>,
  ) {
    setSaving(true);
    setError(null);
    const { error } = await action();
    setSaving(false);
    if (error) return setError(error.message);
    setEditing(null);
    await load();
  }

  function save() {
    if (!canSave || !accountId) return;
    const values = {
      type: kind,
      name: name.trim(),
      amount: Number(digits),
      account_id: accountId,
      category_id: categoryId,
      necessity: kind === "EXPENSE" ? necessity : null,
      day_of_month: dayNumber,
      active,
    };
    run(() =>
      editing === "new"
        ? supabase.from("recurring_transactions").insert(values)
        : supabase
            .from("recurring_transactions")
            .update(values)
            .eq("id", editing!),
    );
  }

  function remove(id: string) {
    if (!confirmDelete) return setConfirmDelete(true);
    // Transactions already posted stay; they just lose the link to this rule.
    run(() => supabase.from("recurring_transactions").delete().eq("id", id));
  }

  const chip = (selected: boolean) => [
    styles.chip,
    { backgroundColor: selected ? theme.primary : theme.backgroundSelected },
  ];
  const chipText = (selected: boolean) => ({
    color: selected ? theme.onPrimary : theme.text,
  });
  const inputStyle = [
    styles.input,
    { color: theme.text, backgroundColor: theme.backgroundSelected },
  ];

  const form = (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View
        style={[styles.modes, { backgroundColor: theme.backgroundSelected }]}
      >
        {(["EXPENSE", "INCOME"] as const).map((k) => (
          <Pressable
            key={k}
            onPress={() => switchKind(k)}
            style={[styles.mode, k === kind && { backgroundColor: theme.primary }]}
          >
            <ThemedText type="smallBold" style={chipText(k === kind)}>
              {k === "EXPENSE" ? "Pengeluaran" : "Pemasukan"}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <TextInput
        style={inputStyle}
        value={name}
        onChangeText={setName}
        placeholder={
          kind === "EXPENSE" ? "Nama, mis. Kos atau Netflix" : "Nama, mis. Gaji"
        }
        placeholderTextColor={theme.textSecondary}
        maxLength={100}
        autoFocus={editing === "new"}
      />

      <View style={styles.inline}>
        <View
          style={[
            styles.priceRow,
            styles.flex,
            { backgroundColor: theme.backgroundSelected },
          ]}
        >
          <ThemedText type="smallBold">{getCurrency().symbol.trim()}</ThemedText>
          <TextInput
            style={[styles.priceInput, { color: theme.text }]}
            value={formatDigits(digits)}
            onChangeText={(t) => setDigits(toDigits(t))}
            placeholder="0"
            placeholderTextColor={theme.textSecondary}
            keyboardType="number-pad"
          />
        </View>
        <View
          style={[
            styles.priceRow,
            { backgroundColor: theme.backgroundSelected },
          ]}
        >
          <ThemedText type="small" themeColor="textSecondary">
            Tgl
          </ThemedText>
          <TextInput
            style={[styles.dayInput, { color: theme.text }]}
            value={day}
            onChangeText={(t) => setDay(t.replace(/\D/g, "").slice(0, 2))}
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>
      </View>
      {!dayValid && day !== "" && (
        <ThemedText themeColor="danger">Tanggal harus 1–31.</ThemedText>
      )}
      {dayValid && dayNumber > 28 && (
        <ThemedText type="small" themeColor="textSecondary">
          Di bulan yang lebih pendek, dicatat di hari terakhir bulan itu.
        </ThemedText>
      )}

      <ThemedText type="small" themeColor="textSecondary">
        {kind === "EXPENSE" ? "Dibayar dari" : "Masuk ke"}
      </ThemedText>
      <View style={styles.chips}>
        {accounts.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => setAccountId(a.id)}
            style={chip(a.id === accountId)}
          >
            <ThemedText type="small" style={chipText(a.id === accountId)}>
              {a.name}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <ThemedText type="small" themeColor="textSecondary">
        Kategori
      </ThemedText>
      <View style={styles.chips}>
        {categories
          .filter((c) => c.kind === kind)
          .map((c) => (
            <Pressable
              key={c.id}
              onPress={() => setCategoryId(c.id === categoryId ? null : c.id)}
              style={chip(c.id === categoryId)}
            >
              <ThemedText type="small" style={chipText(c.id === categoryId)}>
                {c.name}
              </ThemedText>
            </Pressable>
          ))}
      </View>

      {kind === "EXPENSE" && (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            Penilaian (opsional, supaya tidak masuk review malam)
          </ThemedText>
          <View style={styles.chips}>
            {NECESSITY_ORDER.map((n) => {
              const selected = n === necessity;
              return (
                <Pressable
                  key={n}
                  onPress={() => setNecessity(selected ? null : n)}
                  style={[
                    styles.chip,
                    styles.necessity,
                    { borderColor: NECESSITY[n].color },
                    selected && { backgroundColor: NECESSITY[n].color },
                  ]}
                >
                  <ThemedText
                    type="small"
                    style={selected ? styles.white : undefined}
                  >
                    {NECESSITY[n].label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </>
      )}

      {editing !== "new" && (
        <View style={styles.inline}>
          <ThemedText type="small" style={styles.flex}>
            Aktif{active ? "" : " (dijeda, tidak dicatat otomatis)"}
          </ThemedText>
          <Switch value={active} onValueChange={setActive} />
        </View>
      )}

      {error && <ThemedText themeColor="danger">{error}</ThemedText>}

      <View style={styles.inline}>
        {editing !== "new" ? (
          <Pressable
            onPress={() => remove(editing!)}
            disabled={saving}
            hitSlop={8}
          >
            <ThemedText type="smallBold" themeColor="danger">
              {confirmDelete ? "Ketuk lagi untuk hapus" : "Hapus"}
            </ThemedText>
          </Pressable>
        ) : (
          <View />
        )}
        <View style={[styles.inline, styles.right]}>
          <Pressable onPress={() => setEditing(null)} hitSlop={8}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Batal
            </ThemedText>
          </Pressable>
          <Pressable
            disabled={!canSave}
            onPress={save}
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.primary },
              !canSave && !saving && styles.disabled,
              (pressed || saving) && styles.pressed,
            ]}
          >
            {saving ? (
              <ActivityIndicator color={theme.onPrimary} />
            ) : (
              <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                Simpan
              </ThemedText>
            )}
          </Pressable>
        </View>
      </View>
    </ThemedView>
  );

  function renderRule(rule: Rule) {
    if (editing === rule.id) return <View key={rule.id}>{form}</View>;
    const account = accounts.find((a) => a.id === rule.account_id)?.name;
    return (
      <Pressable
        key={rule.id}
        onPress={() => openForm(rule.id)}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <ThemedView
          type="backgroundElement"
          style={[styles.row, !rule.active && styles.paused]}
        >
          <View style={styles.flex}>
            <ThemedText numberOfLines={1}>{rule.name}</ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              numberOfLines={1}
            >
              Tiap tgl {rule.day_of_month}
              {account ? ` · ${account}` : ""}
              {rule.active
                ? ` · berikutnya ${dueFormat.format(localDate(rule.next_due))}`
                : " · dijeda"}
            </ThemedText>
          </View>
          <ThemedText type="smallBold">
            {rule.type === "INCOME" ? "+" : "-"}
            {formatMoney(rule.amount)}
          </ThemedText>
        </ThemedView>
      </Pressable>
    );
  }

  const monthlyOut = (rules ?? [])
    .filter((r) => r.active && r.type === "EXPENSE")
    .reduce((s, r) => s + r.amount, 0);

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SafeAreaView
          style={styles.safeArea}
          edges={["bottom", "left", "right"]}
        >
          <View style={styles.header}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              TRANSAKSI RUTIN
            </ThemedText>
            <Pressable onPress={closeModal} hitSlop={12}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Tutup
              </ThemedText>
            </Pressable>
          </View>

          {rules === null ? (
            error ? (
              <ThemedText themeColor="danger">{error}</ThemedText>
            ) : (
              <ActivityIndicator style={styles.flex} />
            )
          ) : (
            <ScrollView
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
            >
              <ThemedText type="small" themeColor="textSecondary">
                Tagihan dan pemasukan yang datang tiap bulan dicatat otomatis
                saat jatuh tempo, begitu aplikasi dibuka.
              </ThemedText>
              {monthlyOut > 0 && (
                <ThemedText type="smallBold">
                  Pengeluaran rutin: {formatMoney(monthlyOut)} / bulan
                </ThemedText>
              )}

              {rules.map(renderRule)}

              {accounts.length === 0 ? (
                <ThemedText themeColor="textSecondary">
                  Tambahkan akun dulu di Pengaturan → Akun & dompet.
                </ThemedText>
              ) : editing === "new" ? (
                form
              ) : (
                <Pressable
                  onPress={() => openForm("new")}
                  style={({ pressed }) => [
                    styles.add,
                    { borderColor: theme.textSecondary },
                    pressed && styles.pressed,
                  ]}
                >
                  <ThemedText type="smallBold">
                    + Tambah transaksi rutin
                  </ThemedText>
                </Pressable>
              )}
            </ScrollView>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
  },
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  list: {
    gap: Spacing.two,
    paddingBottom: Spacing.four,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  paused: {
    opacity: 0.5,
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  modes: {
    flexDirection: "row",
    padding: Spacing.one,
    borderRadius: Spacing.three,
  },
  mode: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  input: {
    fontSize: 18,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  inline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  right: {
    gap: Spacing.three,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  priceInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: 600,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
  },
  dayInput: {
    width: 36,
    fontSize: 18,
    fontWeight: 600,
    paddingVertical: Spacing.two,
    paddingLeft: Spacing.two,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
  },
  necessity: {
    borderWidth: 1.5,
    backgroundColor: "transparent",
  },
  white: {
    color: "#ffffff",
  },
  button: {
    alignItems: "center",
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Spacing.three,
  },
  add: {
    alignItems: "center",
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  disabled: {
    opacity: 0.35,
  },
  pressed: {
    opacity: 0.7,
  },
});
