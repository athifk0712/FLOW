-- The currency a user keeps their books in. Amounts stay integers in the currency's smallest unit
-- (whole rupiah for IDR, cents for USD); the app formats them. Changing it does not convert old amounts.

alter table public.profiles
  add column currency char(3) not null default 'IDR' check (currency ~ '^[A-Z]{3}$');
