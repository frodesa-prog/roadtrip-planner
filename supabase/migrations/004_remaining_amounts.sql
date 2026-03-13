-- Legg til "gjenstår å betale"-felt på alle kostnadstabeller
alter table hotels       add column if not exists remaining_amount numeric(10,2);
alter table activities   add column if not exists remaining_amount numeric(10,2);
alter table budget_items add column if not exists remaining_amount numeric(10,2);
