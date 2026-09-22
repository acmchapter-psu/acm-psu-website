import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] || "_site";
const siteBase = "/acm-psu-website/";
/*
 * A root-absolute reference to something this site owns, rewritten to sit
 * under the Pages base.
 *
 * The trailing lookahead used to be [/?#"'`)] alone, which matches a path that
 * continues or ends — and misses the one that carries an extension. "/portal/"
 * was rewritten; "/index.html" was not, because the character after "index" is
 * a dot. So every root-absolute .html link shipped unrewritten and 404'd in
 * production: the portal's "Back to website" and "About membership" links, the
 * links on 404.html itself, and the <noscript> fallbacks on every portal and
 * admin page. A dot followed by an extension is now part of the match.
 */
const rootUrl =
  /(["'=(])\/(?!acm-psu-website\/)(assets|portal|admin|projects|team|join|contact|archive|positions|index|site\.webmanifest|robots|sitemap)(?=\.[a-z0-9]+\b|[/?#"'`)])/gi;
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
