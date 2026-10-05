import { ACCOUNT_CATALOG, catalogEntry, initials, searchCatalog } from '@/lib/account-catalog';

describe('account catalog', () => {
  it('shows only popular entries on the first tab', () => {
    const popular = searchCatalog('', 'ALL');
    expect(popular.length).toBeGreaterThan(5);
    expect(popular.every((e) => e.popular)).toBe(true);
  });

  it('lists a whole group without a query', () => {
    expect(searchCatalog('', 'ECOMMERCE').every((e) => e.group === 'ECOMMERCE')).toBe(true);
  });

  it('finds by m-banking app name and ignores case and punctuation', () => {
    expect(searchCatalog('brimo', 'ALL')[0].name).toBe('BRI');
    expect(searchCatalog("livin'", 'ALL')[0].name).toBe('Mandiri');
    expect(searchCatalog('isaku', 'ALL')[0].name).toBe('i.saku');
  });

  it('ranks prefix matches before substring matches', () => {
    const names = searchCatalog('jago', 'ALL').map((e) => e.name);
    expect(names[0]).toBe('Jago');
  });

  it('searches across groups even when a tab is set', () => {
    expect(searchCatalog('gopay', 'BANK').length).toBe(0);
    expect(searchCatalog('gopay', 'ALL').map((e) => e.name)).toContain('GoPay');
  });

  it('has unique names', () => {
    const names = ACCOUNT_CATALOG.map((e) => e.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
  });

  it('makes short initials for the badge', () => {
    expect(initials('BCA')).toBe('BCA');
    expect(initials('Bank Jago')).toBe('BJ');
    expect(initials('GoPay')).toBe('GO');
    expect(initials('i.saku')).toBe('IS');
  });

  it('matches a stored account name back to the catalog', () => {
    expect(catalogEntry(' bca ')?.group).toBe('BANK');
    expect(catalogEntry('Dompet Ayah')).toBeUndefined();
  });
});
