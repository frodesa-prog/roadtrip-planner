-- Add second stopover (leg 3) support to the flights table
alter table flights
  add column if not exists has_second_stopover boolean not null default false,
  add column if not exists leg3_flight_nr      text,
  add column if not exists leg3_departure      text,
  add column if not exists leg3_to             text,
  add column if not exists leg3_arrival        text,
  add column if not exists leg3_ticket_class   text,
  add column if not exists leg3_seat_row       text,
  add column if not exists leg3_seat_number    text;
