// Contact form endpoint (Vercel Function).
// 1. Checks the Cloudflare Turnstile token, so only real visitors get through.
// 2. Saves the message in Supabase with the service key, which never reaches the browser.
// The email alert is sent by the database trigger (see supabase/migrations).
//
// Needs these environment variables in Vercel:
//   TURNSTILE_SECRET_KEY   from Cloudflare > Turnstile > your widget
//   SUPABASE_URL           https://<project>.supabase.co
//   SUPABASE_SERVICE_KEY   Supabase > Project Settings > API Keys > Secret key (sb_secret_...)

const limits = { name: [1, 120], email: [3, 254], business: [0, 160], website: [0, 300], project: [1, 120], budget: [0, 60], timeline: [1, 60], message: [10, 4000] };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const clean = (v) => (typeof v === "string" ? v.trim() : "");

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method" });
  }

  const secret = process.env.TURNSTILE_SECRET_KEY;
  const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!secret || !supabaseUrl || !serviceKey) return res.status(503).json({ error: "not_configured" });

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return res.status(400).json({ error: "invalid" });

  // The hidden trap field: only a bot fills it. Pretend it worked.
  if (clean(body.company_site)) return res.status(200).json({ ok: true });

  const token = clean(body["cf-turnstile-response"]);
  if (!token || token.length > 2048) return res.status(403).json({ error: "captcha" });

  const row = {};
  for (const [key, [min, max]] of Object.entries(limits)) {
    const value = clean(body[key]);
    if (value.length < min || value.length > max) return res.status(400).json({ error: "invalid", field: key });
    row[key] = value || null;
  }
  if (!EMAIL.test(row.email)) return res.status(400).json({ error: "invalid", field: "email" });
  const page = clean(body.source_page);
  row.source_page = page ? page.slice(0, 200) : null;

  // Cloudflare confirms the token belongs to a real, passed check on this site.
  const ip = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const form = new URLSearchParams({ secret, response: token });
  if (ip) form.set("remoteip", ip);
  let verdict;
  try {
    const check = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form, signal: AbortSignal.timeout(8000) });
    verdict = await check.json();
  } catch {
    return res.status(502).json({ error: "captcha_unavailable" });
  }
  if (!verdict || verdict.success !== true) return res.status(403).json({ error: "captcha" });

  let saved;
  try {
    saved = await fetch(supabaseUrl + "/rest/v1/inquiries", {
      method: "POST",
      headers: Object.assign(
        { "Content-Type": "application/json", apikey: serviceKey, Prefer: "return=minimal" },
        serviceKey.startsWith("eyJ") ? { Authorization: "Bearer " + serviceKey } : {} // newer sb_secret_ keys go in apikey only
      ),
      body: JSON.stringify(row),
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return res.status(502).json({ error: "save_failed" });
  }
  if (!saved.ok) {
    const detail = await saved.text().catch(() => "");
    if (/too many/i.test(detail)) return res.status(429).json({ error: "limited" });
    return res.status(502).json({ error: "save_failed" });
  }
  return res.status(200).json({ ok: true });
}
