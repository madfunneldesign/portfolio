# MAD Funnel Design 

Same site as before, Every page looks and behaves the same; the nav, menu, footer, loading screen and
`<head>` setup are shared so a change is made once.

## Deploy on Vercel
1. Put this folder in a GitHub repo (do not upload `node_modules` or `dist`; `.gitignore` already skips them).
2. Vercel > Add New > Project > import the repo. Framework preset: **Astro** (auto-detected). Build command `npm run build`, output directory `dist`.
3. Settings > General > Node.js Version: pick 22.x or 24.x (Astro 7 needs Node 22.23 or newer). Then deploy. Add the domain under Settings > Domains.
`vercel.json` keeps the clean URLs (`/about`) and the same cache headers as before.

## Run it locally
```
npm install
npm run dev       # http://localhost:4321
npm run build     # writes dist/
```

## Where things live
- `src/layouts/Base.astro` shared `<head>`, scripts, loading screen, nav and footer
- `src/components/` Nav, Footer, Contact, Preloader
- `src/pages/*.astro` one file per page (page content, search/social tags and structured data)
- `public/assets/` CSS, JS, images, fonts, GSAP/Lenis (served as-is at the same paths as before)
- `public/sitemap.xml`, `robots.txt`, `llms.txt`, favicons

## Notes
- Output is `about.html`, `services.html`, ... (`build.format: "file"`), so URLs match the old site.
- Do not turn on Astro's page transitions (ClientRouter): the loading screen and scroll animations expect a normal page load.
- To change the nav links, edit `src/components/Nav.astro` (and `Footer.astro` for the footer list).
- The FAQ text lives in `src/pages/faq.astro` and in the FAQ section of `src/pages/index.astro`; the FAQ structured data is next to each.

## Contact form and Supabase
Messages from the contact form are saved to a Supabase table called `inquiries`.
1. The table, its security rules and a spam limit (3 messages per email per hour) are in `supabase/migrations/`. With the Supabase GitHub integration on, pushing to `main` applies them; otherwise paste the file into Supabase > SQL Editor and run it once.
2. In Vercel > Project > Settings > Environment Variables add `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` (both under Supabase > Project Settings > API; see `.env.example`), then redeploy.
3. Read the messages in Supabase > Table Editor > `inquiries`. Use the `status` and `notes` columns to track your follow-up.

### Email alert for new messages
Each new row in `inquiries` sends you an email through Resend (resend.com). Replying to that email replies straight to the visitor.
1. Create a free Resend account with the email that should receive alerts, then API Keys > Create API key (Sending access).
2. Run `supabase/migrations/20261115120000_email_notification.sql` once in Supabase > SQL Editor (safe to run again).
3. Store the key in Supabase Vault (never in git). In the SQL Editor run: `select vault.create_secret('re_YOUR_KEY', 'resend_api_key');`
4. Test by adding a row (SQL Editor, `insert into public.inquiries (name, email, project, timeline, message) values ('Test', 'test@example.com', 'Website', 'Soon', 'Testing the email alert.');`), then check your inbox. To see what Resend answered: `select status_code, content from net._http_response order by created desc limit 1;`
5. Optional, once your domain is verified in Resend: `select vault.create_secret('MAD Funnel Design <hello@madfunneldesign.com>', 'notify_from');` and, to change the recipient, `select vault.create_secret('someone@example.com', 'notify_to');`
If the key is missing or Resend is down, the message is still saved and the visitor still sees the confirmation.

The anon key is public by design. The table only lets it add a message: it cannot read, edit or delete anything. Until the two variables are set, the form falls back to opening the visitor's email app.

## Loading screen and analytics
- The loading screen plays on arrival and refresh, and is skipped when moving between pages, for reduced motion, and for links that land on a section. Add `?preloader` to an address to force it.
- Google Analytics, Clarity and the Meta Pixel start on the first touch, scroll or key press, or 5 seconds after load, so they stay out of the way of the first paint and the PageSpeed score.
