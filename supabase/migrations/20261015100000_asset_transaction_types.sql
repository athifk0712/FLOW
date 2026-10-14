-- Asset management, part 1: two cash movement types for buying and selling assets.
-- They move money like any transaction (balances stay computed from transactions), but they are neither consumption
-- (EXPENSE) nor income (INCOME): reports, budgets, charts and Safe to Spend's spending figures only look at those two.
-- Separate migration: a new enum value cannot be used in the same transaction that adds it.
alter type public.transaction_type add value if not exists 'ASSET_BUY';
alter type public.transaction_type add value if not exists 'ASSET_SELL';
