import type { Enums } from '@/lib/database.types';

// Where Indonesians keep money: banks (and their m-banking apps), e-wallets, marketplace balances and
// pay-later lines, and cash. Picking one fills in the name and type; anything missing can be typed in.

export type AccountGroup = 'BANK' | 'EWALLET' | 'ECOMMERCE' | 'CASH';

export type CatalogEntry = {
  name: string;
  group: AccountGroup;
  /** Other names people search for: the m-banking app, the company, a common typo. */
  aliases?: string[];
  /** Brand-ish tint for the initials badge. */
  color: string;
  popular?: boolean;
};

export const GROUPS: { value: AccountGroup; label: string }[] = [
  { value: 'BANK', label: 'Bank' },
  { value: 'EWALLET', label: 'E-wallet' },
  { value: 'ECOMMERCE', label: 'E-commerce' },
  { value: 'CASH', label: 'Tunai' },
];

/** Stored account type for a catalog group; marketplace balances behave like e-wallets. */
export const GROUP_TYPE: Record<AccountGroup, Enums<'account_type'>> = {
  BANK: 'BANK',
  EWALLET: 'EWALLET',
  ECOMMERCE: 'EWALLET',
  CASH: 'CASH',
};

export const ACCOUNT_CATALOG: CatalogEntry[] = [
  // Banks — big four and BSI first, then the rest roughly by how many people use them.
  { name: 'BCA', group: 'BANK', aliases: ['myBCA', 'BCA mobile', 'KlikBCA', 'Bank Central Asia'], color: '#0060AF', popular: true },
  { name: 'Mandiri', group: 'BANK', aliases: ['Livin', "Livin' by Mandiri", 'Bank Mandiri'], color: '#003D79', popular: true },
  { name: 'BRI', group: 'BANK', aliases: ['BRImo', 'Bank Rakyat Indonesia'], color: '#00529C', popular: true },
  { name: 'BNI', group: 'BANK', aliases: ['wondr', 'BNI Mobile', 'Bank Negara Indonesia'], color: '#F15A23', popular: true },
  { name: 'BSI', group: 'BANK', aliases: ['BSI Mobile', 'Byond', 'Bank Syariah Indonesia'], color: '#00A39D', popular: true },
  { name: 'CIMB Niaga', group: 'BANK', aliases: ['OCTO', 'OCTO Mobile'], color: '#7A0019' },
  { name: 'Permata', group: 'BANK', aliases: ['PermataMobile X', 'PermataBank'], color: '#00843D' },
  { name: 'Danamon', group: 'BANK', aliases: ['D-Bank PRO', 'Bank Danamon'], color: '#F7941D' },
  { name: 'BTN', group: 'BANK', aliases: ['Bale by BTN', 'Bank Tabungan Negara'], color: '#004A98' },
  { name: 'OCBC', group: 'BANK', aliases: ['OCBC NISP', 'ONe Mobile', 'Nyala'], color: '#E2231A' },
  { name: 'Maybank', group: 'BANK', aliases: ['M2U', 'Maybank2u'], color: '#C8A200' },
  { name: 'Panin', group: 'BANK', aliases: ['Panin Bank', 'PaninMobile'], color: '#004B8D' },
  { name: 'Bank Mega', group: 'BANK', aliases: ['M-Smile', 'Mega'], color: '#F4A300' },
  { name: 'UOB', group: 'BANK', aliases: ['TMRW', 'UOB Indonesia'], color: '#0B3B8C' },
  { name: 'HSBC', group: 'BANK', color: '#DB0011' },
  { name: 'Citibank', group: 'BANK', aliases: ['Citi'], color: '#056DAE' },
  { name: 'Bank Sinarmas', group: 'BANK', aliases: ['SimobiPlus', 'Sinarmas'], color: '#D71920' },
  { name: 'Bank BJB', group: 'BANK', aliases: ['DIGI by bjb', 'Bank Jabar Banten'], color: '#0A4F9C' },
  { name: 'Bank DKI', group: 'BANK', aliases: ['JakOne Mobile'], color: '#E31E24' },
  { name: 'Bank Jatim', group: 'BANK', aliases: ['JConnect'], color: '#E31E24' },
  { name: 'Bank Jateng', group: 'BANK', aliases: ['Bima'], color: '#0054A6' },
  { name: 'Bank Muamalat', group: 'BANK', aliases: ['Muamalat DIN'], color: '#5B2C83' },
  { name: 'Bank Mega Syariah', group: 'BANK', color: '#F4A300' },
  { name: 'Bank Nagari', group: 'BANK', color: '#00843D' },
  { name: 'Bank Sumut', group: 'BANK', color: '#0067B1' },
  { name: 'Bank Kalbar', group: 'BANK', color: '#00843D' },
  { name: 'Bank BPD Bali', group: 'BANK', color: '#0067B1' },
  { name: 'Bank Aceh Syariah', group: 'BANK', color: '#00843D' },
  // Digital banks
  { name: 'Jago', group: 'BANK', aliases: ['Bank Jago', 'Jago Syariah'], color: '#F5A623', popular: true },
  { name: 'SeaBank', group: 'BANK', aliases: ['Sea Bank'], color: '#EE4D2D', popular: true },
  { name: 'blu', group: 'BANK', aliases: ['blu by BCA Digital', 'BCA Digital'], color: '#00AEEF', popular: true },
  { name: 'Jenius', group: 'BANK', aliases: ['SMBC Indonesia', 'BTPN'], color: '#00A7E1' },
  { name: 'Superbank', group: 'BANK', aliases: ['Super Bank'], color: '#6C2BD9' },
  { name: 'Neobank', group: 'BANK', aliases: ['Bank Neo Commerce', 'BNC'], color: '#F7B500' },
  { name: 'Allo Bank', group: 'BANK', aliases: ['Allo'], color: '#E4002B' },
  { name: 'Line Bank', group: 'BANK', aliases: ['LINE Bank by Hana Bank', 'Hana Bank'], color: '#06C755' },
  { name: 'Krom', group: 'BANK', aliases: ['Krom Bank'], color: '#3D2B8F' },
  { name: 'Bank Raya', group: 'BANK', aliases: ['Raya'], color: '#0071BC' },
  { name: 'motion', group: 'BANK', aliases: ['MotionBank', 'MNC Bank'], color: '#FF6F00' },
  { name: 'Hibank', group: 'BANK', aliases: ['Bank Hibank'], color: '#00A3E0' },
  { name: 'Aladin', group: 'BANK', aliases: ['Bank Aladin Syariah'], color: '#00A99D' },
  // E-wallets
  { name: 'GoPay', group: 'EWALLET', aliases: ['Gojek', 'GoPay Tabungan'], color: '#00AA13', popular: true },
  { name: 'OVO', group: 'EWALLET', aliases: ['Grab'], color: '#4C3494', popular: true },
  { name: 'DANA', group: 'EWALLET', color: '#118EEA', popular: true },
  { name: 'ShopeePay', group: 'EWALLET', aliases: ['Shopee Pay', 'Shopee'], color: '#EE4D2D', popular: true },
  { name: 'LinkAja', group: 'EWALLET', aliases: ['Link Aja'], color: '#E82127' },
  { name: 'i.saku', group: 'EWALLET', aliases: ['isaku', 'Indomaret'], color: '#E31E24' },
  { name: 'AstraPay', group: 'EWALLET', aliases: ['Astra Pay'], color: '#004B97' },
  { name: 'Sakuku', group: 'EWALLET', aliases: ['BCA Sakuku'], color: '#0060AF' },
  { name: 'Flip', group: 'EWALLET', aliases: ['Flip Saldo'], color: '#FD6542' },
  { name: 'DOKU', group: 'EWALLET', aliases: ['Doku Wallet'], color: '#E1251B' },
  { name: 'Paytren', group: 'EWALLET', color: '#1B9E4B' },
  { name: 'Jenius Pay', group: 'EWALLET', color: '#00A7E1' },
  { name: 'Brizzi', group: 'EWALLET', aliases: ['BRI Brizzi', 'kartu uang elektronik'], color: '#00529C' },
  { name: 'e-money Mandiri', group: 'EWALLET', aliases: ['emoney', 'Mandiri e-money', 'kartu tol'], color: '#003D79' },
  { name: 'Flazz', group: 'EWALLET', aliases: ['BCA Flazz', 'kartu uang elektronik'], color: '#0060AF' },
  { name: 'TapCash', group: 'EWALLET', aliases: ['BNI TapCash'], color: '#F15A23' },
  // Marketplace balances and pay-later lines
  { name: 'Shopee', group: 'ECOMMERCE', aliases: ['Saldo Shopee', 'Koin Shopee'], color: '#EE4D2D', popular: true },
  { name: 'SPayLater', group: 'ECOMMERCE', aliases: ['Shopee PayLater', 'paylater'], color: '#EE4D2D', popular: true },
  { name: 'Tokopedia', group: 'ECOMMERCE', aliases: ['Saldo Tokopedia', 'Tokped'], color: '#03AC0E', popular: true },
  { name: 'GoPayLater', group: 'ECOMMERCE', aliases: ['GoPay Later', 'paylater'], color: '#00AA13' },
  { name: 'TikTok Shop', group: 'ECOMMERCE', aliases: ['TikTok', 'Tiktok Shop PayLater'], color: '#111111', popular: true },
  { name: 'Lazada', group: 'ECOMMERCE', aliases: ['LazWallet', 'Lazada PayLater'], color: '#0F146D' },
  { name: 'Blibli', group: 'ECOMMERCE', aliases: ['Blibli Tiket Points', 'BlipPay'], color: '#0095DA' },
  { name: 'Bukalapak', group: 'ECOMMERCE', aliases: ['BukaDompet', 'Buka Dompet'], color: '#E31E52' },
  { name: 'Traveloka', group: 'ECOMMERCE', aliases: ['Traveloka PayLater', 'PayLater'], color: '#1BA0E2' },
  { name: 'tiket.com', group: 'ECOMMERCE', aliases: ['tiket'], color: '#0064D2' },
  { name: 'Kredivo', group: 'ECOMMERCE', aliases: ['paylater'], color: '#F26722' },
  { name: 'Akulaku', group: 'ECOMMERCE', aliases: ['paylater'], color: '#E5002D' },
  { name: 'Indodana', group: 'ECOMMERCE', aliases: ['paylater'], color: '#E6007E' },
  { name: 'Atome', group: 'ECOMMERCE', aliases: ['paylater'], color: '#F0FF5F' },
  { name: 'Home Credit', group: 'ECOMMERCE', aliases: ['paylater', 'cicilan'], color: '#E11931' },
  { name: 'Grab', group: 'ECOMMERCE', aliases: ['GrabPay', 'Grab PayLater'], color: '#00B14F' },
  // Cash
  { name: 'Tunai', group: 'CASH', aliases: ['cash', 'dompet', 'uang tunai'], color: '#2F9E68', popular: true },
  { name: 'Celengan', group: 'CASH', aliases: ['tabungan rumah', 'piggy'], color: '#E9A23B' },
  { name: 'Amplop', group: 'CASH', aliases: ['dana darurat', 'amplop'], color: '#B87A14' },
];

/** "Bank Jago" -> "BJ", "BCA" -> "BCA", "i.saku" -> "IS". At most three letters for the badge. */
export function initials(name: string) {
  const clean = name.replace(/[^\p{L}\p{N} ]/gu, ' ').trim();
  if (/^[A-Z]{2,4}$/.test(clean)) return clean.slice(0, 3);
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/** Matches name or alias, case- and punctuation-insensitive. Empty query: popular ones of the group. */
export function searchCatalog(query: string, group: AccountGroup | 'ALL'): CatalogEntry[] {
  const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  const q = norm(query);
  const inGroup = ACCOUNT_CATALOG.filter((e) => group === 'ALL' || e.group === group);
  if (!q) return group === 'ALL' ? inGroup.filter((e) => e.popular) : inGroup;
  const scored = inGroup
    .map((e) => {
      const names = [e.name, ...(e.aliases ?? [])].map(norm);
      const score = names.some((n) => n.startsWith(q)) ? 0 : names.some((n) => n.includes(q)) ? 1 : -1;
      return { e, score };
    })
    .filter((x) => x.score >= 0);
  return scored.sort((a, b) => a.score - b.score).map((x) => x.e);
}

/** The catalog entry for a stored account name, if it came from the catalog. */
export function catalogEntry(name: string) {
  const n = name.trim().toLowerCase();
  return ACCOUNT_CATALOG.find((e) => e.name.toLowerCase() === n);
}
