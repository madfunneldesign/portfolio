// Daily keep-alive (Vercel Cron). Supabase pauses free projects that see no activity for a week, which would stop the
// contact form from saving messages. This makes one tiny read each day so the project always counts as active.
//
// Only Vercel Cron may call it: Vercel sends "Authorization: Bearer <CRON_SECRET>" when the CRON_SECRET variable is set.
// Needs these environment variables in Vercel: CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY.
import { timingSafeEqual } from "node:crypto";

const same = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const cron = process.env.CRON_SECRET;
  const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  if (!cron || !supabaseUrl || !serviceKey) {
    console.log("keepalive: not configured (missing CRON_SECRET, SUPABASE_URL or SUPABASE_SERVICE_KEY)");
    return res.status(503).json({ error: "not_configured" });
  }
  if (req.method !== "GET" || !same(req.headers.authorization || "", "Bearer " + cron)) {
    console.log("keepalive: rejected, wrong or missing authorization");
    return res.status(401).json({ error: "unauthorized" });
  }

  try {
    const r = await fetch(supabaseUrl + "/rest/v1/inquiries?select=id&limit=1", {
      headers: Object.assign(
        { apikey: serviceKey },
        serviceKey.startsWith("eyJ") ? { Authorization: "Bearer " + serviceKey } : {} // newer sb_secret_ keys go in apikey only
      ),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) {
      console.log("keepalive: Supabase answered " + r.status);
      return res.status(502).json({ error: "supabase_" + r.status });
    }
  } catch {
    console.log("keepalive: Supabase could not be reached");
    return res.status(502).json({ error: "supabase_unreachable" });
  }
  console.log("keepalive: ok, Supabase reached");
  return res.status(200).json({ ok: true });
}
