import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] || "_site";
const siteBase = "/acm-psu-website/";
const rootUrl =
  /(["'=(])\/(?!acm-psu-website\/)(assets|portal|admin|projects|team|join|contact|archive|positions|index|site\.webmanifest|robots|sitemap)(?=[/?#"'`)])/g;
const baseUrl = /(<base\s+href=["'])\//gi;

function visit(directory) {
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) {
      visit(path);
      continue;
    }
    if (!/\.(?:html|css|js|mjs)$/i.test(entry)) continue;
    const original = readFileSync(path, "utf8");
    const updated = original
      .replace(rootUrl, `$1${siteBase}$2`)
      .replace(baseUrl, `$1${siteBase}`);
    if (updated !== original) writeFileSync(path, updated);
  }
}

visit(root);
console.log(`Prepared GitHub Pages artifact at ${root}`);
