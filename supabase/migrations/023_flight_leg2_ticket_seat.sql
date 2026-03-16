-- Add ticket class and seat info for leg 2 (stopover flights)
alter table flights add column if not exists leg2_ticket_class text;
alter table flights add column if not exists leg2_seat_row text;
alter table flights add column if not exists leg2_seat_number text;
