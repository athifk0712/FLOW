import type { Enums } from '@/lib/database.types';

export type Necessity = Enums<'necessity_level'>;

export const NECESSITY: Record<Necessity, { label: string; hint: string; color: string }> = {
  NEED: { label: 'Butuh', hint: 'Tidak bisa dihindari', color: '#2f9e68' },
  IMPORTANT: { label: 'Penting', hint: 'Perlu, tapi bisa ditunda', color: '#b87a14' },
  WANT: { label: 'Ingin', hint: 'Direncanakan, tapi tidak perlu', color: '#3a82e0' },
  IMPULSE: { label: 'Impulsif', hint: 'Tidak direncanakan', color: '#dc4b4b' },
};

export const NECESSITY_ORDER: Necessity[] = ['NEED', 'IMPORTANT', 'WANT', 'IMPULSE'];

export const UNREVIEWED_COLOR = '#8C9391';
export const DANGER_COLOR = '#B83A36';
