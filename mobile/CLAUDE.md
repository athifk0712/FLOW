@AGENTS.md

# Flowku Architecture & Guidelines

## Core Stack
- Expo SDK 57, React Native 0.86, React 19, TypeScript
- Backend: Supabase (migrasi aktif di produksi)

## Data Layer & State
- Fetching: `useFocusEffect` + direct Supabase queries ke `useState`.
- Saldo & Mutasi: Wajib lewat RPC Supabase (`create_transfer`, `record_debt_payment`, `buy_asset`).
- Pure Logic: Simpan di `lib/` untuk diuji via Jest.

## Rules & Conventions
1. Modal: Daftarkan di `app/_layout.tsx`, gunakan `ModalEdges` dan `closeModal`.
2. UI: Gunakan `ThemedText`, `ThemedView`, `useTheme`, token `Spacing`. Bahasa Indonesia.
3. Guardrails: Hindari file monolith dan query berlebih di Beranda.