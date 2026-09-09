// Nightly one-way sync: Substack -> src/content/writing/*.md. Substack is the
// editor; this repo is the canonical archive. Posts are re-written on every
// run so edits made on Substack propagate — don't hand-edit synced files.
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Set via the SUBSTACK_FEED_URL repository variable (Settings -> Secrets and
// variables -> Actions -> Variables). Unset or empty means "nothing to sync",
// which is a clean no-op rather than a failed run.
const FEED_URL = (process.env.SUBSTACK_FEED_URL ?? '').trim();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../src/content/writing');

// ponytail: regex RSS parsing — Substack's feed is machine-generated RSS 2.0
// with CDATA everywhere; a real XML parser is a dependency this doesn't need.
function field(item, tag) {
  const m = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  if (!m) return '';
  return m[1].replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1').trim();
}

// Titles and descriptions arrive HTML-escaped (e.g. &#8217;); frontmatter is
// plain text, so decode them.
const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decodeEntities(text) {
  return String(text ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

function yamlString(value) {
  const flat = decodeEntities(value).replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
  return `"${flat.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

// Substack appends its own subscribe widgets to the post body: a
// <div class="subscription-widget-wrap-editor" ...> that nests several divs and
// a <form>. They are noise on a static site and their scripts do not run here,
// so remove each one as a depth-balanced <div> block (a plain regex cannot
// balance the nesting and would leave orphaned </form></div> tags behind).
function stripSubstackWidgets(html) {
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
    // Unbalanced (truncated feed): drop from the marker on and stop.
    out = end === -1 ? out.slice(0, start) : out.slice(0, start) + out.slice(end);
    if (end === -1) break;
  }
  return out
    .replace(/<\/?form[^>]*>/g, '') // stray form wrappers Substack leaves around the body
    .replace(/(\s*<div>\s*<hr\s*\/?>\s*<\/div>\s*)+$/g, '') // trailing separator
    .replace(/(\s*<hr\s*\/?>\s*)+$/g, '')
    .trim();
}

// Substack sits behind Cloudflare, which challenges requests from datacenter
// IPs (GitHub Actions runners) — especially with a non-browser User-Agent. Send
// browser-like headers and retry a few times on the transient block codes
// (403/429/5xx). A hard IP block can still win; when it does, run this script
// from a residential/office network instead and commit the result.
async function fetchFeed(url) {
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    Accept: 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  const RETRYABLE = new Set([403, 429, 500, 502, 503, 504]);
  let res;
  for (let attempt = 1; attempt <= 4; attempt++) {
    res = await fetch(url, { headers, redirect: 'follow' });
    if (res.ok || !RETRYABLE.has(res.status)) return res;
    if (attempt < 4) {
      const wait = 2000 * attempt;
      console.warn(`Feed returned ${res.status}; retry ${attempt}/3 in ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  return res;
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

  const res = await fetchFeed(FEED_URL);
  if (!res.ok) {
    // Substack's Cloudflare edge blocks datacenter IPs (GitHub-hosted runners)
    // with 403/429 no matter the headers. Nothing in this repo defeats that, so
    // treat it as a clean skip rather than a failed run: import instead by
    // running this script from a residential/office network and committing the
    // result. Any other status is a real error and still fails.
    if (res.status === 403 || res.status === 429) {
      console.warn(
        `Feed blocked by the upstream edge (${res.status}) after retries — expected from ` +
          `datacenter IPs such as GitHub-hosted runners. Skipping; import from another network.`,
      );
      return;
    }
    throw new Error(`Substack feed fetch failed: ${res.status} ${FEED_URL}`);
  }
  const xml = await res.text();
  if (!/^\s*(<\?xml|<rss)/.test(xml)) {
    // A profile URL such as https://NAME.substack.com redirects to substack.com/@NAME
    // and serves HTML. The feed lives on the publication, not the profile.
    throw new Error(
      `Response is not an RSS feed (${res.headers.get('content-type') ?? 'unknown type'}, resolved to ${res.url}). ` +
        `Use the publication feed, e.g. https://PUBLICATION.substack.com/feed`,
    );
  }

  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  if (items.length === 0) console.warn(`Feed has no <item> entries: ${FEED_URL}`);
  await mkdir(OUT_DIR, { recursive: true });

  let synced = 0;
  for (const item of items) {
    const link = field(item, 'link');
    const title = field(item, 'title');
    const html = stripSubstackWidgets(field(item, 'content:encoded'));
    const slug = link.split('/p/')[1]?.split(/[?#]/)[0]?.replace(/[^a-z0-9-]/gi, '');
    if (!slug || !title || !html) {
      console.warn(`Skipping item without slug/title/body: ${link || title || '(unknown)'}`);
      continue;
    }

    const date = new Date(field(item, 'pubDate')).toISOString().slice(0, 10);
    const summary = field(item, 'description').replace(/<[^>]+>/g, '');

    const md = [
      '---',
      `title: ${yamlString(title)}`,
      `date: ${date}`,
      summary ? `summary: ${yamlString(summary)}` : null,
      `substackUrl: ${yamlString(link)}`,
      '---',
      '',
      html,
      '',
    ].filter((l) => l !== null).join('\n');

    await writeFile(path.join(OUT_DIR, `${slug}.md`), md, 'utf8');
    console.log(`  ${slug}.md  <-  ${title}`);
    synced += 1;
  }

  console.log(`Synced ${synced} post(s) from ${FEED_URL}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
