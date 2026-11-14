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
