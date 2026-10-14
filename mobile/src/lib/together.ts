// Flowku Together: what a shared target looks like from its contributions. Only VERIFIED contributions count
// towards the target and the ranking; PENDING ones are shown separately until the group owner confirms them.
// Each member's fair share is the target split evenly (rounded up), which decides their status:
//   Lunas       verified >= share
//   Berjalan    something paid or waiting for confirmation, but not the full share yet
//   Belum Setor nothing yet

export type MemberStatus = 'LUNAS' | 'BERJALAN' | 'BELUM';

export const STATUS_LABEL: Record<MemberStatus, string> = {
  LUNAS: 'Lunas',
  BERJALAN: 'Berjalan',
  BELUM: 'Belum Setor',
};

export type GroupMember = { user_id: string; display_name: string; role: string };
export type Contribution = { user_id: string; amount: number; status: string };
export type TargetInput = { target_amount: number; deadline: string | null; status: string };

export type MemberProgress = {
  user_id: string;
  name: string;
  role: string;
  verified: number;
  pending: number;
  share: number;
  status: MemberStatus;
  rank: number | null; // 1 = most contributed; null when nothing verified yet
};

export type TargetProgress = {
  verified: number;
  pending: number;
  remaining: number;
  percent: number; // 0-100, of the verified total
  reached: boolean;
  daysLeft: number | null; // null = no deadline
  deadlineText: string | null; // "12 hari lagi", "Hari ini", "Lewat 3 hari"
  members: MemberProgress[]; // ranking order
};

const DAY = 86_400_000;

function daysUntil(deadline: string, now: Date) {
  const [y, m, d] = deadline.split('-').map(Number);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((new Date(y, m - 1, d).getTime() - today.getTime()) / DAY);
}

export function deadlineText(days: number | null, reached: boolean) {
  if (days === null) return null;
  if (reached) return 'Target tercapai';
  if (days > 1) return `${days} hari lagi`;
  if (days === 1) return 'Besok';
  if (days === 0) return 'Hari ini';
  return `Lewat ${-days} hari dari tenggat`;
}

export function targetProgress(
  target: TargetInput,
  members: GroupMember[],
  contributions: Contribution[],
  now = new Date(),
): TargetProgress {
  const verifiedBy = new Map<string, number>();
  const pendingBy = new Map<string, number>();
  for (const c of contributions) {
    const into = c.status === 'VERIFIED' ? verifiedBy : c.status === 'PENDING' ? pendingBy : null;
    if (into) into.set(c.user_id, (into.get(c.user_id) ?? 0) + c.amount);
  }
  const verified = [...verifiedBy.values()].reduce((s, v) => s + v, 0);
  const pending = [...pendingBy.values()].reduce((s, v) => s + v, 0);
  const share = members.length > 0 ? Math.ceil(target.target_amount / members.length) : target.target_amount;
  const reached = verified >= target.target_amount;
  const days = target.deadline ? daysUntil(target.deadline, now) : null;

  const rows = members
    .map((m) => {
      const v = verifiedBy.get(m.user_id) ?? 0;
      const p = pendingBy.get(m.user_id) ?? 0;
      const status: MemberStatus = v >= share ? 'LUNAS' : v + p > 0 ? 'BERJALAN' : 'BELUM';
      return { user_id: m.user_id, name: m.display_name, role: m.role, verified: v, pending: p, share, status, rank: null as number | null };
    })
    .sort((a, b) => b.verified - a.verified || a.name.localeCompare(b.name, 'id'));

  // Equal totals share a rank (1, 2, 2, 4): transparent and fair.
  rows.forEach((r, i) => {
    if (r.verified <= 0) return;
    r.rank = i > 0 && rows[i - 1].verified === r.verified ? rows[i - 1].rank : i + 1;
  });

  return {
    verified,
    pending,
    remaining: Math.max(0, target.target_amount - verified),
    percent: Math.min(100, Math.round((verified / target.target_amount) * 100)),
    reached,
    daysLeft: days,
    deadlineText: deadlineText(days, reached),
    members: rows,
  };
}

/** A friendly reminder without AI (used when the AI is unavailable). Never names who hasn't paid. */
export function fallbackReminder(groupName: string, targetName: string, remainingText: string, deadline: string | null) {
  return (
    `Halo, teman-teman ${groupName}! Sedikit pengingat untuk patungan "${targetName}", ya. ` +
    `Kurang ${remainingText} lagi${deadline ? ` (${deadline.toLowerCase()})` : ''}. ` +
    'Kalau sudah setor, jangan lupa catat di Flowku supaya bisa dikonfirmasi. Semoga cepat tercapai! 🙌'
  );
}
