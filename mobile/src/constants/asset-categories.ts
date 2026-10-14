// Asset kinds and what each needs. A game account is one item (bought and sold whole, no unit); gold, stocks and
// crypto are counted in units and can be sold in part. The user can still change the unit on a new asset.

export type AssetCategory = 'GAME' | 'GOLD' | 'STOCK' | 'CRYPTO' | 'COLLECTIBLE' | 'BUSINESS' | 'OTHER';

export type AssetCategoryInfo = {
  value: AssetCategory;
  label: string;
  material: string;
  sf: string;
  color: string;
  /** Counted in units and sellable in part by default. */
  divisible: boolean;
  /** Suggested unit for divisible kinds. */
  unit: string | null;
  /** Placeholder for the name field. */
  example: string;
};

export const ASSET_CATEGORIES: AssetCategoryInfo[] = [
  { value: 'GAME', label: 'Akun game', material: 'sports_esports', sf: 'gamecontroller.fill', color: '#7A5AC8', divisible: false, unit: null, example: 'mis. Akun Free Fire Sultan' },
  { value: 'GOLD', label: 'Emas', material: 'diamond', sf: 'diamond.fill', color: '#B87A14', divisible: true, unit: 'gram', example: 'mis. Emas Antam' },
  { value: 'STOCK', label: 'Saham', material: 'trending_up', sf: 'chart.line.uptrend.xyaxis', color: '#2F9E68', divisible: true, unit: 'lembar', example: 'mis. BBCA' },
  { value: 'CRYPTO', label: 'Kripto', material: 'currency_bitcoin', sf: 'bitcoinsign.circle.fill', color: '#E07A2E', divisible: true, unit: 'koin', example: 'mis. Bitcoin' },
  { value: 'COLLECTIBLE', label: 'Koleksi', material: 'star', sf: 'star.fill', color: '#C2477A', divisible: false, unit: null, example: 'mis. Sepatu edisi terbatas' },
  { value: 'BUSINESS', label: 'Aset usaha', material: 'storefront', sf: 'storefront', color: '#3A82E0', divisible: false, unit: null, example: 'mis. Mesin kopi warung' },
  { value: 'OTHER', label: 'Lainnya', material: 'category', sf: 'square.grid.2x2', color: '#6B7C79', divisible: false, unit: null, example: 'Nama aset' },
];

export function assetCategory(value: string | null | undefined): AssetCategoryInfo {
  return ASSET_CATEGORIES.find((c) => c.value === value) ?? ASSET_CATEGORIES[ASSET_CATEGORIES.length - 1];
}
