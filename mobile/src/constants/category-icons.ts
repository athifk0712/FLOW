// Icons a category can carry (categories.icon stores the key). Material Symbols render on Android and
// web, SF Symbols on iOS. `words` feeds the icon search, in Indonesian and English.

export type IconGroup = 'food' | 'transport' | 'shopping' | 'bills' | 'home' | 'health' | 'fun' | 'growth' | 'money' | 'other';

export type CategoryIcon = {
  key: string;
  group: IconGroup;
  material: string;
  sf: string;
  words: string;
};

export const ICON_GROUPS: { value: IconGroup; label: string; color: string }[] = [
  { value: 'food', label: 'Makan & minum', color: '#E07A2E' },
  { value: 'transport', label: 'Transportasi', color: '#3A82E0' },
  { value: 'shopping', label: 'Belanja', color: '#C2477A' },
  { value: 'bills', label: 'Tagihan', color: '#7A5AC8' },
  { value: 'home', label: 'Rumah & keluarga', color: '#B87A14' },
  { value: 'health', label: 'Kesehatan', color: '#DC4B4B' },
  { value: 'fun', label: 'Hiburan', color: '#D4559B' },
  { value: 'growth', label: 'Pendidikan & ibadah', color: '#2E8C9E' },
  { value: 'money', label: 'Keuangan', color: '#2F9E68' },
  { value: 'other', label: 'Lainnya', color: '#6B7C79' },
];

export const CATEGORY_ICONS: CategoryIcon[] = [
  // Food & drink
  { key: 'utensils', group: 'food', material: 'restaurant', sf: 'fork.knife', words: 'makan restoran warung food meal' },
  { key: 'coffee', group: 'food', material: 'local_cafe', sf: 'cup.and.saucer.fill', words: 'kopi cafe ngopi coffee teh' },
  { key: 'cookie', group: 'food', material: 'cookie', sf: 'birthday.cake.fill', words: 'jajan camilan snack kue' },
  { key: 'burger', group: 'food', material: 'lunch_dining', sf: 'takeoutbag.and.cup.and.straw.fill', words: 'burger fast food gofood grabfood' },
  { key: 'noodle', group: 'food', material: 'ramen_dining', sf: 'fork.knife.circle.fill', words: 'mie bakso ramen soto' },
  { key: 'bakery', group: 'food', material: 'bakery_dining', sf: 'birthday.cake', words: 'roti bakery sarapan' },
  { key: 'icecream', group: 'food', material: 'icecream', sf: 'snowflake', words: 'es krim dessert boba minuman' },
  { key: 'groceries', group: 'food', material: 'local_grocery_store', sf: 'cart.fill', words: 'belanja dapur sayur pasar groceries' },
  // Transport
  { key: 'car', group: 'transport', material: 'directions_car', sf: 'car.fill', words: 'mobil transport' },
  { key: 'motorbike', group: 'transport', material: 'two_wheeler', sf: 'bicycle', words: 'motor ojek gojek grab ojol' },
  { key: 'fuel', group: 'transport', material: 'local_gas_station', sf: 'fuelpump.fill', words: 'bensin bbm pertamina pertalite' },
  { key: 'bus', group: 'transport', material: 'directions_bus', sf: 'bus.fill', words: 'bus transjakarta angkot' },
  { key: 'train', group: 'transport', material: 'train', sf: 'tram.fill', words: 'kereta krl mrt lrt commuter' },
  { key: 'taxi', group: 'transport', material: 'local_taxi', sf: 'car.side.fill', words: 'taksi taxi bluebird' },
  { key: 'parking', group: 'transport', material: 'local_parking', sf: 'parkingsign.circle.fill', words: 'parkir tol' },
  { key: 'flight', group: 'transport', material: 'flight', sf: 'airplane', words: 'pesawat tiket mudik liburan' },
  // Shopping
  { key: 'shopping-bag', group: 'shopping', material: 'shopping_bag', sf: 'bag.fill', words: 'belanja shopping online' },
  { key: 'clothes', group: 'shopping', material: 'checkroom', sf: 'tshirt.fill', words: 'baju pakaian fashion sepatu' },
  { key: 'mall', group: 'shopping', material: 'local_mall', sf: 'storefront.fill', words: 'mall toko' },
  { key: 'gadget', group: 'shopping', material: 'smartphone', sf: 'iphone', words: 'hp gadget elektronik' },
  { key: 'gift', group: 'shopping', material: 'redeem', sf: 'gift.fill', words: 'hadiah kado gift' },
  { key: 'beauty', group: 'shopping', material: 'spa', sf: 'sparkles', words: 'skincare kecantikan salon perawatan' },
  // Bills
  { key: 'receipt', group: 'bills', material: 'receipt_long', sf: 'doc.text.fill', words: 'tagihan bill' },
  { key: 'electricity', group: 'bills', material: 'bolt', sf: 'bolt.fill', words: 'listrik pln token' },
  { key: 'water', group: 'bills', material: 'water_drop', sf: 'drop.fill', words: 'air pdam' },
  { key: 'internet', group: 'bills', material: 'wifi', sf: 'wifi', words: 'internet wifi indihome' },
  { key: 'phone', group: 'bills', material: 'phone_android', sf: 'phone.fill', words: 'pulsa kuota paket data' },
  { key: 'subscription', group: 'bills', material: 'subscriptions', sf: 'play.rectangle.fill', words: 'langganan netflix spotify youtube' },
  { key: 'tv', group: 'bills', material: 'tv', sf: 'tv.fill', words: 'tv tv kabel' },
  // Home & family
  { key: 'home', group: 'home', material: 'home', sf: 'house.fill', words: 'rumah kos kontrakan sewa' },
  { key: 'family', group: 'home', material: 'family_restroom', sf: 'figure.2.and.child.holdinghands', words: 'keluarga orang tua kiriman' },
  { key: 'baby', group: 'home', material: 'child_care', sf: 'figure.and.child.holdinghands', words: 'anak bayi susu popok' },
  { key: 'pet', group: 'home', material: 'pets', sf: 'pawprint.fill', words: 'hewan kucing anjing pet' },
  { key: 'laundry', group: 'home', material: 'local_laundry_service', sf: 'washer.fill', words: 'laundry cuci' },
  { key: 'repair', group: 'home', material: 'build', sf: 'wrench.and.screwdriver.fill', words: 'servis perbaikan bengkel' },
  { key: 'cleaning', group: 'home', material: 'cleaning_services', sf: 'bubbles.and.sparkles.fill', words: 'kebersihan sabun' },
  // Health
  { key: 'heart-pulse', group: 'health', material: 'favorite', sf: 'heart.fill', words: 'kesehatan health' },
  { key: 'hospital', group: 'health', material: 'local_hospital', sf: 'cross.case.fill', words: 'rumah sakit dokter klinik bpjs' },
  { key: 'medicine', group: 'health', material: 'medication', sf: 'pills.fill', words: 'obat apotek vitamin' },
  { key: 'fitness', group: 'health', material: 'fitness_center', sf: 'dumbbell.fill', words: 'gym olahraga fitness' },
  { key: 'dentist', group: 'health', material: 'dentistry', sf: 'mouth.fill', words: 'gigi dokter gigi' },
  // Fun
  { key: 'gamepad', group: 'fun', material: 'sports_esports', sf: 'gamecontroller.fill', words: 'game hiburan topup' },
  { key: 'movie', group: 'fun', material: 'movie', sf: 'film.fill', words: 'film bioskop nonton' },
  { key: 'music', group: 'fun', material: 'music_note', sf: 'music.note', words: 'musik konser' },
  { key: 'travel', group: 'fun', material: 'beach_access', sf: 'beach.umbrella.fill', words: 'liburan jalan-jalan wisata' },
  { key: 'hotel', group: 'fun', material: 'hotel', sf: 'bed.double.fill', words: 'hotel penginapan' },
  { key: 'sport', group: 'fun', material: 'sports_soccer', sf: 'soccerball', words: 'futsal bola badminton' },
  { key: 'party', group: 'fun', material: 'celebration', sf: 'party.popper.fill', words: 'pesta nongkrong acara' },
  // Learning & giving
  { key: 'school', group: 'growth', material: 'school', sf: 'graduationcap.fill', words: 'sekolah kuliah spp pendidikan' },
  { key: 'book', group: 'growth', material: 'menu_book', sf: 'book.fill', words: 'buku kursus belajar' },
  { key: 'mosque', group: 'growth', material: 'mosque', sf: 'building.columns.fill', words: 'masjid zakat infaq sedekah ibadah' },
  { key: 'charity', group: 'growth', material: 'volunteer_activism', sf: 'hands.sparkles.fill', words: 'donasi sedekah amal' },
  { key: 'work', group: 'growth', material: 'work', sf: 'briefcase.fill', words: 'kerja kantor bisnis usaha' },
  // Money
  { key: 'wallet', group: 'money', material: 'account_balance_wallet', sf: 'wallet.bifold.fill', words: 'gaji dompet salary' },
  { key: 'payments', group: 'money', material: 'payments', sf: 'banknote.fill', words: 'uang tunai bayar' },
  { key: 'savings', group: 'money', material: 'savings', sf: 'dollarsign.circle.fill', words: 'tabungan nabung celengan' },
  { key: 'invest', group: 'money', material: 'trending_up', sf: 'chart.line.uptrend.xyaxis', words: 'investasi saham reksadana emas crypto' },
  { key: 'bonus', group: 'money', material: 'card_giftcard', sf: 'giftcard.fill', words: 'bonus thr hadiah' },
  { key: 'store', group: 'money', material: 'storefront', sf: 'storefront', words: 'jualan dagang usaha toko' },
  { key: 'credit-card', group: 'money', material: 'credit_card', sf: 'creditcard.fill', words: 'kartu kredit cicilan paylater' },
  { key: 'bank', group: 'money', material: 'account_balance', sf: 'building.columns', words: 'bank admin biaya transfer' },
  { key: 'tax', group: 'money', material: 'percent', sf: 'percent', words: 'pajak bunga' },
  // Other
  { key: 'dots', group: 'other', material: 'more_horiz', sf: 'ellipsis', words: 'lainnya lain other' },
  { key: 'star', group: 'other', material: 'star', sf: 'star.fill', words: 'favorit spesial' },
  { key: 'flag', group: 'other', material: 'flag', sf: 'flag.fill', words: 'target tujuan' },
  { key: 'tag', group: 'other', material: 'sell', sf: 'tag.fill', words: 'label tag diskon' },
];

// Not pickable: shown for transfers, which have no category.
const TRANSFER_ICON: CategoryIcon = { key: 'transfer', group: 'money', material: 'swap_horiz', sf: 'arrow.left.arrow.right', words: '' };

const BY_KEY = new Map([...CATEGORY_ICONS, TRANSFER_ICON].map((i) => [i.key, i]));
const GROUP_COLOR = new Map(ICON_GROUPS.map((g) => [g.value, g.color]));

/** The icon for a stored key; unknown or empty keys fall back to "dots". */
export function iconFor(key: string | null | undefined): CategoryIcon {
  return BY_KEY.get(key ?? '') ?? BY_KEY.get('dots')!;
}

export function iconColor(key: string | null | undefined) {
  return GROUP_COLOR.get(iconFor(key).group)!;
}

/** Search by Indonesian/English words, or list one group. */
export function searchIcons(query: string, group: IconGroup | 'ALL'): CategoryIcon[] {
  const q = query.trim().toLowerCase();
  if (q) return CATEGORY_ICONS.filter((i) => i.words.includes(q) || i.key.includes(q));
  return group === 'ALL' ? CATEGORY_ICONS : CATEGORY_ICONS.filter((i) => i.group === group);
}

/** A sensible icon for a category name the user typed, e.g. "Bensin" -> fuel. */
export function guessIcon(name: string): string {
  const words = name.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
  for (const w of words) {
    const hit = CATEGORY_ICONS.find((i) => i.words.split(' ').some((x) => x.startsWith(w) || w.startsWith(x)));
    if (hit) return hit.key;
  }
  return 'dots';
}
