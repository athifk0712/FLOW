import type { Enums } from '@/lib/database.types';

export type Necessity = Enums<'necessity_level'>;

export const NECESSITY: Record<Necessity, { label: string; hint: string; color: string }> = {
  NEED: { label: 'Butuh', hint: 'Tidak bisa dihindari', color: '#30a46c' },
  IMPORTANT: { label: 'Penting', hint: 'Perlu, tapi bisa ditunda', color: '#f5a524' },
  WANT: { label: 'Ingin', hint: 'Direncanakan, tapi tidak perlu', color: '#3e8ef7' },
  IMPULSE: { label: 'Impulsif', hint: 'Tidak direncanakan', color: '#e5484d' },
};

export const NECESSITY_ORDER: Necessity[] = ['NEED', 'IMPORTANT', 'WANT', 'IMPULSE'];

export const UNREVIEWED_COLOR = '#8b8d98';
export const DANGER_COLOR = '#e5484d';
