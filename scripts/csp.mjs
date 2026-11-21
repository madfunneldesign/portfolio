// Keeps the security policy in vercel.json in step with the page scripts.
//
// The policy does not allow inline scripts in general. It allows only the exact inline scripts the pages contain,
// by hash. If someone edits an inline <script> in src/layouts/Base.astro, its hash changes and the policy must change too.
//
//   node scripts/csp.mjs --check   fail (exit 1) when vercel.json does not match dist/  (runs after every build)
//   node scripts/csp.mjs --write   update vercel.json to match dist/
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";

const write = process.argv.includes("--write");
const hashes = new Set();
for (const f of readdirSync("dist").filter((n) => n.endsWith(".html"))) {
  const html = readFileSync(`dist/${f}`, "utf8");
  for (const m of html.matchAll(/<script(?![^>]*\ssrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/application\/ld\+json/.test(m[1])) continue; // data blocks do not run
    hashes.add("'sha256-" + createHash("sha256").update(m[2]).digest("base64") + "'");
  }
}
const want = [...hashes].sort();

const cfg = JSON.parse(readFileSync("vercel.json", "utf8"));
const header = cfg.headers.flatMap((h) => h.headers).find((h) => h.key === "Content-Security-Policy");
if (!header) throw new Error("No Content-Security-Policy header in vercel.json");
const parts = header.value.split(";").map((p) => p.trim());
const i = parts.findIndex((p) => p.startsWith("script-src "));
if (i < 0) throw new Error("No script-src in the Content-Security-Policy");
const tokens = parts[i].split(/\s+/).slice(1);
const have = tokens.filter((t) => t.startsWith("'sha256-")).sort();

if (JSON.stringify(have) === JSON.stringify(want)) {
  console.log(`CSP check: ${want.length} inline script hash(es) match vercel.json`);
  process.exit(0);
}
if (!write) {
  console.error("CSP check failed: the inline scripts in the pages changed, so the hashes in vercel.json are out of date.");
  console.error("  pages need:", want.join(" "));
  console.error("  vercel.json has:", have.join(" ") || "(none)");
  console.error("Run:  node scripts/csp.mjs --write   then commit vercel.json.");
  process.exit(1);
}
parts[i] = "script-src " + [...tokens.filter((t) => !t.startsWith("'sha256-")).slice(0, 1), ...want, ...tokens.filter((t) => !t.startsWith("'sha256-")).slice(1)].join(" ");
header.value = parts.join("; ");
writeFileSync("vercel.json", JSON.stringify(cfg, null, 2) + "\n");
console.log("vercel.json updated with", want.length, "hash(es)");
