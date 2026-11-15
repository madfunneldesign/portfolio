-- Email you when someone sends the contact form.
-- Every new row in public.inquiries triggers one email through Resend (resend.com).
-- The Resend API key is NOT stored in this file or in git: it lives in Supabase Vault (see the README).
-- If the key is missing, or Resend is down, the message is still saved and the visitor still sees "sent".

create extension if not exists pg_net with schema extensions;

create or replace function public.inquiries_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  api_key   text;
  mail_from text;
  mail_to   text;
  body_text text;
begin
  select decrypted_secret into api_key
    from vault.decrypted_secrets where name = 'resend_api_key' limit 1;
  if api_key is null then
    return new;
  end if;

  -- Optional overrides stored in Vault. Without them the defaults below are used.
  select decrypted_secret into mail_from
    from vault.decrypted_secrets where name = 'notify_from' limit 1;
  select decrypted_secret into mail_to
    from vault.decrypted_secrets where name = 'notify_to' limit 1;
  mail_from := coalesce(mail_from, 'MAD Funnel Design <onboarding@resend.dev>');
  mail_to   := coalesce(mail_to, 'madfunneldesign@gmail.com');

  body_text :=
    'New message from the website contact form' || E'\n\n' ||
    'Name:      ' || new.name || E'\n' ||
    'Email:     ' || new.email || E'\n' ||
    'Business:  ' || coalesce(new.business, '-') || E'\n' ||
    'Website:   ' || coalesce(new.website, '-') || E'\n' ||
    'Project:   ' || new.project || E'\n' ||
    'Budget:    ' || coalesce(new.budget, '-') || E'\n' ||
    'Timeline:  ' || new.timeline || E'\n' ||
    'Page:      ' || coalesce(new.source_page, '-') || E'\n\n' ||
    new.message || E'\n\n' ||
    '---' || E'\n' ||
    'Reply to this email to answer ' || new.name || ' directly.';

  perform net.http_post(
    url     := 'https://api.resend.com/emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || api_key
    ),
    body    := jsonb_build_object(
      'from', mail_from,
      'to', jsonb_build_array(mail_to),
      'reply_to', new.email,
      'subject', left('New inquiry: ' || regexp_replace(new.name, '[\r\n]+', ' ', 'g') || ' (' || regexp_replace(new.project, '[\r\n]+', ' ', 'g') || ')', 150),
      'text', body_text
    )
  );
  return new;
exception when others then
  -- Never block the visitor's message because the email could not be queued.
  raise warning 'inquiries_notify failed: %', sqlerrm;
  return new;
end;
$$;

-- Only the database itself runs this; the public keys cannot call it.
revoke all on function public.inquiries_notify() from public, anon, authenticated;

drop trigger if exists inquiries_notify on public.inquiries;
create trigger inquiries_notify
  after insert on public.inquiries
  for each row execute function public.inquiries_notify();
