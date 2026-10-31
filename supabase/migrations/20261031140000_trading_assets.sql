-- Forex and gold spot as asset kinds, tracked per trading account: money deposited at the broker (buy), the account's
-- current equity (valuation) and withdrawals (sell). Everything else about assets stays the same.
alter table public.assets drop constraint assets_category_check;
alter table public.assets add constraint assets_category_check
  check (category in ('GAME', 'GOLD', 'GOLD_SPOT', 'FOREX', 'STOCK', 'CRYPTO', 'COLLECTIBLE', 'BUSINESS', 'OTHER'));
