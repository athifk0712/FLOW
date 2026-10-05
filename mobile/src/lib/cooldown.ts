import { formatMoney } from '@/lib/money';

// Tunda Beli pause, relative to the daily safe limit. The server (public.intent_cooldown) is the authority;
// this mirror only previews the pause while the price is being typed.
//   ratio = price / daily safe limit:  < 0.5 none,  ≤ 1 one hour,  ≤ 3 six hours,  else (or nothing safe) 24 hours

export function cooldownHours(cost: number, dailyLimit: number) {
  if (dailyLimit <= 0) return 24;
  if (cost < dailyLimit * 0.5) return 0;
  if (cost <= dailyLimit) return 1;
  if (cost <= dailyLimit * 3) return 6;
  return 24;
}

/** One calm sentence explaining the pause, in terms of the daily limit the user sees on the dashboard. */
export function describeCooldown(hours: number, dailyLimit: number | null) {
  const limit = dailyLimit && dailyLimit > 0 ? formatMoney(dailyLimit) : null;
  if (hours <= 0) return limit ? `Tanpa jeda: masih jauh di bawah batas amanmu ${limit}/hari.` : 'Tanpa jeda.';
  if (!limit) return 'Dijeda 24 jam: belum ada ruang aman untuk belanja sampai periode ini selesai.';
  if (hours === 1) return `Dijeda 1 jam: mendekati batas amanmu ${limit}/hari. Sebentar saja, lalu putuskan.`;
  if (hours === 6) return `Dijeda 6 jam: di atas batas amanmu ${limit}/hari. Lihat lagi nanti, dengan kepala dingin.`;
  return `Dijeda 24 jam: lebih dari 3 kali batas amanmu ${limit}/hari. Tidur dulu, putuskan besok.`;
}
