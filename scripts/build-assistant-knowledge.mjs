/* Builds the public AI guide's knowledge of the chapter from the website itself.
 *
 * The guide (supabase/functions/prospective-member-assistant) can only answer
 * what it is told. Rather than keep a second, hand-written copy of the FAQ,
 * team, projects and contact details that drifts from the site, this reads the
 * public pages and writes their text into knowledge.ts, which the function
 * imports. `npm run build` runs it, so redeploying the function after editing a
 * page is all it takes for the guide to know the change.
 *
 * Only public pages are read. Nothing under portal/ or admin/ belongs here.
 *
 *   node scripts/build-assistant-knowledge.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const OUT = 'supabase/functions/prospective-member-assistant/knowledge.ts';

/* Order matters a little: the model weighs what comes first. The workshop
 * handouts under ai-programming-jam-26/workshop-content are teaching material
 * thousands of words long; the guide links to them instead of reciting them. */
const PAGES = [
  ['/index.html', 'index.html'],
  ['/join.html', 'join.html'],
  ['/contact.html', 'contact.html'],
  ['/positions.html', 'positions.html'],
  ['/team.html', 'team.html'],
  ['/projects.html', 'projects.html'],
  ['/archive.html', 'archive.html'],
  ['/projects/ctfs/ctf-3.0/index.html', 'projects/ctfs/ctf-3.0/index.html'],
  ['/projects/ctfs/ctf-3.0/workshops.html', 'projects/ctfs/ctf-3.0/workshops.html'],
  ['/projects/ctfs/ctf-2.0/index.html', 'projects/ctfs/ctf-2.0/index.html'],
  ['/projects/ctfs/ctf-2.0/results/presentation/index.html', 'projects/ctfs/ctf-2.0/results/presentation/index.html'],
  ['/projects/hackathons/psu-ai-hackathon-2.0/index.html', 'projects/hackathons/psu-ai-hackathon-2.0/index.html'],
  ['/projects/hackathons/psu-ai-hackathon-2.0/event-site.html', 'projects/hackathons/psu-ai-hackathon-2.0/event-site.html'],
  ['/projects/programming-jams/ai-programming-jam-26/index.html', 'projects/programming-jams/ai-programming-jam-26/index.html'],
];

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', rarr: '→', larr: '←', copy: '©',
  middot: '·', times: '×', bull: '•', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', zwj: '', shy: '' };

function decode(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (match, name) => ENTITIES[name.toLowerCase()] ?? match);
}

/** Absolute site path for a link found on `pagePath`, or null to drop it. */
function resolveHref(href, pagePath) {
  if (!href || href.startsWith('#') || href.startsWith('javascript:')) return null;
  if (/^(mailto:|tel:|https?:)/i.test(href)) return href;
  try {
    const url = new URL(href, `https://site${pagePath}`);
    return url.pathname + url.search;
  } catch {
    return null;
  }
}

function pageText(html, pagePath) {
  const title = decode((html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim());
  let body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;

  body = body
    // Chrome repeated on every page, and things that are not prose.
    .replace(/<(script|style|svg|noscript|template|nav|footer)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    // Keep link targets so the guide can point people to the right page.
    .replace(/<a\b[^>]*?href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, inner) => {
      const label = inner.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      const target = resolveHref(decode(href), pagePath);
      if (!label) return ' ';
      return target && !label.includes(target) ? ` ${label} (${target}) ` : ` ${label} `;
    })
    .replace(/<img\b[^>]*alt="([^"]+)"[^>]*>/gi, ' [image: $1] ')
    // Structure the model can use.
    .replace(/<h([1-4])\b[^>]*>/gi, (_, level) => `\n\n${'#'.repeat(Number(level) + 1)} `)
    .replace(/<\/h[1-4]>/gi, '\n')
    .replace(/<button\b[^>]*class="[^"]*faq-trigger[^"]*"[^>]*>/gi, '\nQ: ')
    .replace(/<div\b[^>]*class="[^"]*faq-content[^"]*"[^>]*>/gi, '\nA: ')
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<(tr)\b[^>]*>/gi, '\n')
    .replace(/<\/(td|th)>/gi, ' | ')
    .replace(/<(br|\/p|\/div|\/section|\/article|\/li|\/dd|\/dt|\/tr|\/button)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');

  const lines = decode(body)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line && !/^[-|:]+$/.test(line) && line !== 'Skip to content');

  // Collapse runs of the same line (decorative labels repeated in cards).
  const deduped = lines.filter((line, i) => line !== lines[i - 1]);
  return `# PAGE ${pagePath} — ${title}\n${deduped.join('\n')}`;
}

const sections = PAGES.map(([sitePath, file]) => pageText(readFileSync(file, 'utf8'), sitePath));
const knowledge = sections.join('\n\n').replace(/\n{3,}/g, '\n\n');

writeFileSync(
  OUT,
  '// GENERATED by scripts/build-assistant-knowledge.mjs from the public pages.\n' +
  '// Do not edit by hand: change the page, then run `npm run build`.\n' +
  `export const SITE_KNOWLEDGE = ${JSON.stringify(knowledge)};\n`,
);

const words = knowledge.split(/\s+/).length;
console.log(`assistant knowledge: ${PAGES.length} pages, ~${words} words -> ${OUT}`);
