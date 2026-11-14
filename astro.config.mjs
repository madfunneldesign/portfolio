import { defineConfig } from "astro/config";

// Output matches the current site: about.html, services.html, ... with clean URLs served by Vercel (see vercel.json).
export default defineConfig({
  site: "https://www.madfunneldesign.com",
  trailingSlash: "never",
  build: { format: "file" },
  compressHTML: false,
});
