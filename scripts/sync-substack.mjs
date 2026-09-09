// One-way import: Substack -> src/content/writing/*.md. Substack is the editor,
// this repo is the canonical archive. Posts are re-derived on every run so edits
// on Substack propagate; don't hand-edit synced files.
//
// The body is converted from Substack's HTML into clean Markdown (not dumped as
// raw HTML) so a synced post renders exactly like a hand-written one: real
// headings feed the table of contents, and the site's prose styles apply.
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Set via the SUBSTACK_FEED_URL repository variable. Unset/empty is a clean no-op.
const FEED_URL = (process.env.SUBSTACK_FEED_URL ?? '').trim();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../src/content/writing');

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', shy: '',
  hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘', rdquo: '”',
  ldquo: '“', middot: '·', deg: '°', copy: '©', reg: '®', trade: '™',
};
function decodeEntities(text) {
  return String(text ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z0-9]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

function yamlString(value) {
  const flat = decodeEntities(value).replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  return `"${flat.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

// Read one tag's inner text from an RSS <item> block.
function field(item, tag) {
  const m = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  if (!m) return '';
  return m[1].replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1').trim();
}

// Remove Substack subscribe widgets: <div class="subscription-widget..."> that
// nests divs and a <form>. Depth-balanced so no orphan tags are left behind.
function stripWidgets(html) {
  let out = html;
  const marker = '<div class="subscription-widget';
  let start;
  while ((start = out.indexOf(marker)) !== -1) {
    const tagRe = /<(\/?)div\b[^>]*>/g;
    tagRe.lastIndex = start;
    let depth = 0;
    let end = -1;
    let m;
    while ((m = tagRe.exec(out)) !== null) {
      depth += m[1] ? -1 : 1;
      if (depth === 0) {
        end = m.index + m[0].length;
        break;
      }
    }
    out = end === -1 ? out.slice(0, start) : out.slice(0, start) + out.slice(end);
    if (end === -1) break;
  }
  return out.replace(/<\/?form[^>]*>/g, '');
}

// Inline HTML -> Markdown (bold/italic/code/links). Entities are decoded by the
// caller once, at the end, so encoded ampersands in URLs survive until then.
function inline(html) {
  return html
    .replace(/<\s*(strong|b)\b[^>]*>([\s\S]*?)<\/\s*\1\s*>/gi, (_, _t, s) => `**${s.trim()}**`)
    .replace(/<\s*(em|i)\b[^>]*>([\s\S]*?)<\/\s*\1\s*>/gi, (_, _t, s) => `*${s.trim()}*`)
    .replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => `\`${decodeEntities(c).replace(/`/g, '')}\``)
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, t) => `[${t.trim()}](${href})`)
    .replace(/<br\s*\/?>/gi, '  \n')
    .replace(/<\/?(span|mark|u|sub|sup)\b[^>]*>/gi, '')
    .trim();
}

function listItems(innerHtml, ordered) {
  let n = 0;
  return [...innerHtml.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)]
    .map((m) => {
      n += 1;
      const text = inline(m[1].replace(/<\/?p\b[^>]*>/gi, ' ').replace(/\s+/g, ' '));
      return `${ordered ? `${n}.` : '-'} ${text}`;
    })
    .join('\n');
}

// Substack body starts headings at <h3>; shift so the shallowest becomes <h2>,
// matching how hand-written posts on this site are structured.
function normalizeHeadingLevels(html) {
  const levels = [...html.matchAll(/<h([1-6])\b/gi)].map((m) => Number(m[1]));
  if (levels.length === 0) return html;
  const shift = Math.min(...levels) - 2;
  if (shift <= 0) return html;
  return html.replace(/<(\/?)h([1-6])\b/gi, (_, slash, lvl) => `<${slash}h${Math.min(6, Number(lvl) - shift)}`);
}

function htmlToMarkdown(rawHtml) {
  let html = normalizeHeadingLevels(stripWidgets(rawHtml));

  // Fenced code blocks first, so their contents skip inline processing.
  const codeBlocks = [];
  html = html.replace(/<pre\b[^>]*>\s*(?:<code\b[^>]*>)?([\s\S]*?)(?:<\/code>)?\s*<\/pre>/gi, (_, code) => {
    codeBlocks.push(decodeEntities(code).replace(/\s+$/, ''));
    return `\n\n@@CODEBLOCK${codeBlocks.length - 1}@@\n\n`;
  });

  html = html
    .replace(/<figure\b[^>]*>[\s\S]*?<img\b[^>]*?src="([^"]*)"[^>]*?(?:alt="([^"]*)")?[^>]*>[\s\S]*?(?:<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>)?[\s\S]*?<\/figure>/gi,
      (_, src, alt = '', cap = '') => `\n\n![${(alt || '').trim()}](${src})\n\n${cap ? `*${inline(cap)}*\n\n` : ''}`)
    .replace(/<img\b[^>]*?src="([^"]*)"[^>]*?(?:alt="([^"]*)")?[^>]*>/gi, (_, src, alt = '') => `\n\n![${(alt || '').trim()}](${src})\n\n`)
    .replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, lvl, t) => `\n\n${'#'.repeat(Number(lvl))} ${inline(t)}\n\n`)
    .replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner) => {
      const text = inline(inner.replace(/<\/?p\b[^>]*>/gi, '\n')).trim();
      return `\n\n${text.split('\n').map((l) => `> ${l}`.trimEnd()).join('\n')}\n\n`;
    })
    .replace(/<ul\b[^>]*>([\s\S]*?)<\/ul>/gi, (_, inner) => `\n\n${listItems(inner, false)}\n\n`)
    .replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner) => `\n\n${listItems(inner, true)}\n\n`)
    .replace(/<hr\s*\/?>/gi, '\n\n---\n\n')
    .replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (_, t) => `\n\n${inline(t)}\n\n`);

  html = inline(html).replace(/<\/?[a-z][^>]*>/gi, ''); // drop any leftover tags
  html = decodeEntities(html);
  html = html.replace(/@@CODEBLOCK(\d+)@@/g, (_, i) => `\`\`\`\n${codeBlocks[Number(i)]}\n\`\`\``);

  return html
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/(?:\n+-{3,})+\s*$/, '') // drop trailing separator rule(s)
    .trim();
}

// Substack sits behind Cloudflare, which challenges datacenter IPs. Try the feed
// directly with browser-like headers and retries; on a persistent 403/429 fall
// back to a public RSS-to-JSON proxy that fetches from an unblocked IP.
async function fetchDirect(url) {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  const RETRYABLE = new Set([403, 429, 500, 502, 503, 504]);
  let res;
  for (let attempt = 1; attempt <= 3; attempt++) {
    res = await fetch(url, { headers, redirect: 'follow' });
    if (res.ok || !RETRYABLE.has(res.status)) return res;
    if (attempt < 3) await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
  return res;
}

function parseRssItems(xml) {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => {
    const item = m[1];
    return {
      link: field(item, 'link'),
      title: field(item, 'title'),
      pubDate: field(item, 'pubDate'),
      description: field(item, 'description'),
      html: field(item, 'content:encoded'),
    };
  });
}

async function fetchViaRss2json(url) {
  // No &count= — that parameter needs a paid api key; the free endpoint returns
  // the feed's recent items, which is all a personal publication needs.
  const api = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`;
  const res = await fetch(api, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`rss2json proxy failed: ${res.status}`);
  const data = await res.json();
  if (data.status !== 'ok') throw new Error(`rss2json returned status ${data.status}`);
  return (data.items ?? []).map((it) => ({
    link: it.link ?? it.guid ?? '',
    title: it.title ?? '',
    pubDate: it.pubDate ?? '',
    description: it.description ?? '',
    html: it.content ?? it.description ?? '',
  }));
}

// Returns a list of posts, using the proxy only if the direct feed is edge-blocked.
// SUBSTACK_FORCE_PROXY=1 forces the proxy path — useful for reproducing locally
// exactly what CI produces (CI is always edge-blocked and uses the proxy).
async function loadItems(url) {
  if (process.env.SUBSTACK_FORCE_PROXY === '1') {
    console.warn('SUBSTACK_FORCE_PROXY=1; using the rss2json proxy.');
    return fetchViaRss2json(url);
  }
  const res = await fetchDirect(url);
  if (res.ok) {
    const xml = await res.text();
    if (!/^\s*(<\?xml|<rss)/.test(xml)) {
      throw new Error(
        `Response is not an RSS feed (${res.headers.get('content-type') ?? 'unknown type'}, ` +
          `resolved to ${res.url}). Use the publication feed, e.g. https://PUBLICATION.substack.com/feed`,
      );
    }
    return parseRssItems(xml);
  }
  if (res.status === 403 || res.status === 429) {
    // Expected from datacenter IPs (GitHub runners). Try the proxy; if that too
    // is unavailable, skip cleanly rather than fail a nightly cron on a transient
    // third-party outage — the archive is unchanged and the next run retries.
    console.warn(`Direct feed blocked (${res.status}); falling back to the rss2json proxy.`);
    try {
      return await fetchViaRss2json(url);
    } catch (err) {
      console.warn(`Proxy also unavailable (${err.message}); skipping this run.`);
      return [];
    }
  }
  throw new Error(`Substack feed fetch failed: ${res.status} ${url}`);
}

async function main() {
  if (!FEED_URL) {
    console.log('SUBSTACK_FEED_URL is not set; nothing to sync.');
    return;
  }
  try {
    new URL(FEED_URL);
  } catch {
    throw new Error(`SUBSTACK_FEED_URL is not a valid URL: "${FEED_URL}"`);
  }

  const items = await loadItems(FEED_URL);
  if (items.length === 0) console.warn(`Feed has no items: ${FEED_URL}`);
  await mkdir(OUT_DIR, { recursive: true });

  let synced = 0;
  for (const item of items) {
    const slug = item.link.split('/p/')[1]?.split(/[?#]/)[0]?.replace(/[^a-z0-9-]/gi, '');
    const body = htmlToMarkdown(item.html);
    if (!slug || !item.title || !body) {
      console.warn(`Skipping item without slug/title/body: ${item.link || item.title || '(unknown)'}`);
      continue;
    }

    const date = new Date(item.pubDate).toISOString().slice(0, 10);
    const summary = decodeEntities(item.description.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

    const md = [
      '---',
      `title: ${yamlString(item.title)}`,
      `date: ${date}`,
      summary ? `summary: ${yamlString(summary)}` : null,
      `substackUrl: ${yamlString(item.link)}`,
      '---',
      '',
      body,
      '',
    ]
      .filter((l) => l !== null)
      .join('\n');

    await writeFile(path.join(OUT_DIR, `${slug}.md`), md, 'utf8');
    console.log(`  ${slug}.md  <-  ${item.title}`);
    synced += 1;
  }

  console.log(`Synced ${synced} post(s) from ${FEED_URL}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
