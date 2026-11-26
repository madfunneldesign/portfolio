// The sitemap is built with the site, so the dates stay current. The date is the day of the latest change to the pages (from git),
// or the build day when git history is not available.
import { execSync } from "node:child_process";

const SITE = "https://www.madfunneldesign.com";
const pages: [string, string, string][] = [
  ["/", "monthly", "1.0"],
  ["/services", "monthly", "0.9"],
  ["/projects", "monthly", "0.9"],
  ["/about", "monthly", "0.8"],
  ["/faq", "monthly", "0.7"],
  ["/contact", "yearly", "0.7"],
  ["/terms", "yearly", "0.3"],
  ["/privacy", "yearly", "0.3"],
  ["/case-nicro-industrial", "yearly", "0.6"],
  ["/case-construction-website", "yearly", "0.6"],
  ["/case-interior-design-website", "yearly", "0.6"],
  ["/case-brightwater-legal", "yearly", "0.6"],
  ["/case-clothing-ecommerce", "yearly", "0.6"],
  ["/case-black-chauffeur", "yearly", "0.6"],
];

function lastChange(): string {
  try {
    const d = execSync("git log -1 --format=%cs -- src public/llms.txt", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  } catch (e) {}
  return new Date().toISOString().slice(0, 10);
}

export const GET = () => {
  const date = lastChange();
  const urls = pages
    .map(([path, freq, prio]) => `  <url>\n    <loc>${SITE}${path === "/" ? "/" : path}</loc>\n    <lastmod>${date}</lastmod>\n    <changefreq>${freq}</changefreq>\n    <priority>${prio}</priority>\n  </url>`)
    .join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
