-- Contact form messages from the website.
-- The public (anon) key can add a message and nothing else: it cannot read, change or delete any row.
-- You read the messages in the Supabase dashboard (Table Editor > inquiries).

create table if not exists public.inquiries (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),

  name        text not null check (char_length(btrim(name)) between 1 and 120),
  email       text not null check (char_length(email) <= 254 and email ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  business    text check (business is null or char_length(business) <= 160),
  website     text check (website is null or char_length(website) <= 300),
  project     text not null check (char_length(project) between 1 and 120),
  budget      text check (budget is null or char_length(budget) <= 60),
  timeline    text not null check (char_length(timeline) between 1 and 60),
  message     text not null check (char_length(btrim(message)) between 10 and 4000),
  source_page text check (source_page is null or char_length(source_page) <= 200),

  -- for you: follow up here
  status      text not null default 'new' check (status in ('new', 'read', 'replied', 'archived')),
  notes       text
);

create index if not exists inquiries_created_at_idx on public.inquiries (created_at desc);
create index if not exists inquiries_email_idx on public.inquiries (lower(email), created_at desc);

alter table public.inquiries enable row level security;

-- Visitors may only insert, and only the columns the form fills in.
revoke all on public.inquiries from anon, authenticated;
grant insert (name, email, business, website, project, budget, timeline, message, source_page)
  on public.inquiries to anon, authenticated;

drop policy if exists "Visitors can send a message" on public.inquiries;
create policy "Visitors can send a message"
  on public.inquiries
  for insert
  to anon, authenticated
  with check (true);

-- Simple spam brake: at most 3 messages per email address per hour.
create or replace function public.inquiries_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(*)
    from public.inquiries
    where lower(email) = lower(new.email)
      and created_at > now() - interval '1 hour'
  ) >= 3 then
    raise exception 'Too many messages from this email address. Please try again later.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists inquiries_rate_limit on public.inquiries;
create trigger inquiries_rate_limit
  before insert on public.inquiries
  for each row execute function public.inquiries_rate_limit();
