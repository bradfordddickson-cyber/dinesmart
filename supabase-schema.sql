-- ─── DineSmart — Supabase Schema ─────────────────────────────────────────────
-- Run this in your Supabase project: Dashboard → SQL Editor → New Query → Run

-- ─── Tables ───────────────────────────────────────────────────────────────────

create table if not exists halls (
  id                   text primary key,
  name                 text not null,
  location             text default '',
  hours                text default '',
  allergen_free_station text default '',
  created_at           timestamptz default now()
);

create table if not exists menu_items (
  id                      text primary key,
  hall_id                 text not null references halls(id) on delete cascade,
  menu_date               date not null default current_date,
  dish_name               text not null,
  ingredients             text default '',
  allergens               text[] default '{}',
  cross_contact_allergens text[] default '{}',
  dietary_labels          text[] default '{}',
  station                 text default '',
  meal_period             text default 'Lunch',
  calories                int,
  protein_g               numeric,
  created_at              timestamptz default now()
);

create index if not exists menu_items_hall_date on menu_items(hall_id, menu_date);

-- ─── Row Level Security ────────────────────────────────────────────────────────

alter table halls      enable row level security;
alter table menu_items enable row level security;

-- Public can read everything (students don't need to log in)
create policy "Public read halls"
  on halls for select using (true);

create policy "Public read menu_items"
  on menu_items for select using (true);

-- Only authenticated users (admins) can write
create policy "Auth insert halls"
  on halls for insert with check (auth.role() = 'authenticated');

create policy "Auth update halls"
  on halls for update using (auth.role() = 'authenticated');

create policy "Auth delete halls"
  on halls for delete using (auth.role() = 'authenticated');

create policy "Auth insert menu_items"
  on menu_items for insert with check (auth.role() = 'authenticated');

create policy "Auth update menu_items"
  on menu_items for update using (auth.role() = 'authenticated');

create policy "Auth delete menu_items"
  on menu_items for delete using (auth.role() = 'authenticated');

-- ─── Seed: Harvard dining halls ───────────────────────────────────────────────
-- Optional: uncomment and run to pre-populate with all 13 Harvard houses

/*
insert into halls (id, name, location, hours, allergen_free_station) values
  ('h1',  'Annenberg Hall',               'Memorial Hall, 45 Quincy St, Cambridge, MA 02138',     'Mon–Fri 7:30am–8:00pm · Sat–Sun 9:00am–7:00pm',  'Simple Servings'),
  ('h2',  'Adams House Dining Hall',       '26 Plympton St, Cambridge, MA 02138',                  'Mon–Fri 7:30am–7:30pm · Sat–Sun 9:00am–7:30pm',  'Simple Servings'),
  ('h3',  'Cabot House Dining Hall',       'Moors Hall, 60 Linnaean St, Cambridge, MA 02138',      'Mon–Fri 7:30am–7:30pm · Sat–Sun 9:00am–7:30pm',  'Simple Servings'),
  ('h4',  'Currier House Dining Hall',     'Moors Hall, 64 Linnaean St, Cambridge, MA 02138',      'Mon–Fri 7:30am–7:30pm · Sat–Sun 9:00am–7:30pm',  'Simple Servings'),
  ('h5',  'Dunster House Dining Hall',     '945 Memorial Dr, Cambridge, MA 02138',                 'Mon–Fri 7:30am–7:30pm · Sat–Sun 9:00am–7:30pm',  'Simple Servings'),
  ('h6',  'Eliot House Dining Hall',       '101 Dunster St, Cambridge, MA 02138',                  'Mon–Fri 7:30am–7:30pm · Sat–Sun 9:00am–7:30pm',  'Simple Servings'),
  ('h7',  'Kirkland House Dining Hall',    '95 Dunster St, Cambridge, MA 02138',                   'Mon–Fri 7:30am–7:30pm · Sat–Sun 9:00am–7:30pm',  'Simple Servings'),
  ('h8',  'Leverett House Dining Hall',    '28 DeWolfe St, Cambridge, MA 02138',                   'Mon–Fri 7:30am–7:30pm · Sat–Sun 9:00am–7:30pm',  'Simple Servings'),
  ('h9',  'Lowell House Dining Hall',      '10 Holyoke Place, Cambridge, MA 02138',                'Mon–Fri 7:30am–7:30pm · Sat–Sun 9:00am–7:30pm',  'Simple Servings'),
  ('h10', 'Mather House Dining Hall',      '10 Cowperthwaite St, Cambridge, MA 02138',             'Mon–Fri 7:30am–7:30pm · Sat–Sun 9:00am–7:30pm',  'Simple Servings'),
  ('h11', 'Pforzheimer House Dining Hall', '56 Linnaean St, Cambridge, MA 02138',                  'Mon–Fri 7:30am–7:30pm · Sat–Sun 9:00am–7:30pm',  'Simple Servings'),
  ('h12', 'Quincy House Dining Hall',      '58 Plympton St, Cambridge, MA 02138',                  'Mon–Fri 7:30am–7:30pm · Sat–Sun 9:00am–7:30pm',  'Simple Servings'),
  ('h13', 'Winthrop House Dining Hall',    'Gore Hall, Mill St, Cambridge, MA 02138',              'Mon–Fri 7:30am–7:30pm · Sat–Sun 9:00am–7:30pm',  'Simple Servings')
on conflict (id) do nothing;
*/
