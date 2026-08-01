// Nightly one-way sync: Substack -> src/content/writing/*.md. Substack is the
// editor; this repo is the canonical archive. Posts are re-written on every
// run so edits made on Substack propagate — don't hand-edit synced files.
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// TODO: set this to your publication feed once your Substack exists.
const FEED_URL = process.env.SUBSTACK_FEED_URL ?? 'https://YOURNAME.substack.com/feed';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../src/content/writing');

// ponytail: regex RSS parsing — Substack's feed is machine-generated RSS 2.0
// with CDATA everywhere; a real XML parser is a dependency this doesn't need.
function field(item, tag) {
  const m = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  if (!m) return '';
  return m[1].replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1').trim();
}

function yamlString(value) {
  const flat = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  return `"${flat.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

async function main() {
  const res = await fetch(FEED_URL, {
    headers: { 'User-Agent': 'praneeth-portfolio-sync/1.0 (+https://github.com/Nedjagang)' },
  });
  if (!res.ok) throw new Error(`Substack feed fetch failed: ${res.status} ${FEED_URL}`);
  const xml = await res.text();

  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  await mkdir(OUT_DIR, { recursive: true });

  let synced = 0;
  for (const item of items) {
    const link = field(item, 'link');
    const title = field(item, 'title');
    const html = field(item, 'content:encoded');
    const slug = link.split('/p/')[1]?.replace(/[^a-z0-9-]/gi, '');
    if (!slug || !title || !html) continue;

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
    synced += 1;
  }

  console.log(`Synced ${synced} post(s) from ${FEED_URL}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
