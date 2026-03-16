-- Add ticket class and seat info to flights
alter table flights add column if not exists ticket_class text;
alter table flights add column if not exists seat_row text;
alter table flights add column if not exists seat_number text;
