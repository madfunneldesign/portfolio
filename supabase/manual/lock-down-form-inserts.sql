-- Run this ONLY after the contact form works through /api/contact (the bot check is live and a test message arrived).
-- It closes the side door: from now on the public key can no longer add rows directly, so every message has to pass the bot check.
-- It also adds a safety cap so a flood of fake messages cannot use up your email allowance: at most 30 messages per hour in total.
-- It is safe to run more than once. It is kept outside supabase/migrations on purpose, so it is never applied automatically.

revoke insert on public.inquiries from anon, authenticated;
drop policy if exists "Visitors can send a message" on public.inquiries;

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
  if (
    select count(*)
    from public.inquiries
    where created_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception 'Too many messages right now. Please try again later.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- To undo (go back to direct public inserts):
--   grant insert (name, email, business, website, project, budget, timeline, message, source_page) on public.inquiries to anon, authenticated;
--   create policy "Visitors can send a message" on public.inquiries for insert to anon, authenticated with check (true);
