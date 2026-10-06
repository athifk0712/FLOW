import type { User } from '@supabase/supabase-js';

import { displayName, initials } from '@/lib/display-name';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const user = (fields: Partial<User>) => ({ user_metadata: {}, is_anonymous: false, ...fields }) as User;

describe('displayName', () => {
  it('prefers the name the user picked, then Google, then the email', () => {
    expect(displayName(user({ user_metadata: { display_name: ' Athif ', full_name: 'A K' } }))).toBe('Athif');
    expect(displayName(user({ user_metadata: { full_name: 'Athif Khairullah' }, email: 'a@x.id' }))).toBe('Athif Khairullah');
    expect(displayName(user({ email: 'athif@x.id' }))).toBe('athif');
  });

  it('calls a guest without a name Tamu Flowku, but uses a picked name', () => {
    expect(displayName(null)).toBe('Tamu Flowku');
    expect(displayName(user({ is_anonymous: true }))).toBe('Tamu Flowku');
    expect(displayName(user({ is_anonymous: true, user_metadata: { display_name: 'Rina' } }))).toBe('Rina');
  });
});

describe('initials', () => {
  it('takes two words or the first two letters', () => {
    expect(initials('Athif Khairullah')).toBe('AK');
    expect(initials('rina')).toBe('RI');
  });
});
