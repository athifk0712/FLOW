-- Lending and borrowing money moves a wallet, but it is neither spending nor income: the money comes back or has to
-- be paid back. Two cash movement types, like ASSET_BUY / ASSET_SELL: reports, budgets, charts and Safe to Spend's
-- spending figures only look at EXPENSE and INCOME.
-- Separate migration: a new enum value cannot be used in the same transaction that adds it.
alter type public.transaction_type add value if not exists 'DEBT_OUT';
alter type public.transaction_type add value if not exists 'DEBT_IN';
