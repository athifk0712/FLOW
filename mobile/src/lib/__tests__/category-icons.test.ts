import { CATEGORY_ICONS, guessIcon, iconColor, iconFor, ICON_GROUPS, searchIcons } from '@/constants/category-icons';

describe('category icons', () => {
  it('covers every icon key the database seeds for new users', () => {
    for (const key of ['utensils', 'coffee', 'car', 'cookie', 'shopping-bag', 'receipt', 'heart-pulse', 'gamepad', 'dots', 'wallet']) {
      expect(iconFor(key).key).toBe(key);
    }
  });

  it('falls back to "dots" for unknown or empty keys', () => {
    expect(iconFor('nope').key).toBe('dots');
    expect(iconFor(null).key).toBe('dots');
  });

  it('gives every icon a group color', () => {
    const groups = new Set(ICON_GROUPS.map((g) => g.value));
    expect(CATEGORY_ICONS.every((i) => groups.has(i.group))).toBe(true);
    expect(iconColor('coffee')).toMatch(/^#[0-9A-F]{6}$/i);
  });

  it('searches Indonesian words and filters by group', () => {
    expect(searchIcons('bensin', 'ALL').map((i) => i.key)).toContain('fuel');
    expect(searchIcons('', 'bills').every((i) => i.group === 'bills')).toBe(true);
    expect(searchIcons('', 'ALL').length).toBe(CATEGORY_ICONS.length);
  });

  it('guesses an icon from a typed category name', () => {
    expect(guessIcon('Bensin motor')).toBe('fuel');
    expect(guessIcon('Pulsa')).toBe('phone');
    expect(guessIcon('Kopi susu')).toBe('coffee');
    expect(guessIcon('Xyzzy')).toBe('dots');
  });
});
