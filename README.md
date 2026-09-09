# praneeth-vp — personal site

Personal portfolio and notebook of **Praneeth V P** — AI engineer building agents,
backend systems, and self-hosted LLM infrastructure, with the observability to keep
it all honest.

Built with [Astro](https://astro.build), Tailwind, and MDX. Static output. Every push to
`main` runs `.github/workflows/deploy.yml`, which builds once and publishes to two places:

- **Cloudflare Worker** `praneeth-dev` (static assets, config in `wrangler.jsonc`) →
  <https://dev.praneethveep.me> (canonical; `SITE.url` in `src/lib/site.ts`). Needs the
  `CLOUDFLARE_API_TOKEN` repo secret: a token with *Account → Workers Scripts → Edit* plus
  *Zone → Workers Routes → Edit* and *Zone → DNS → Edit* on `praneethveep.me` (the custom
  domain route). Without it the `cloudflare` job is skipped; with a token missing those
  permissions it fails with "Authentication error [code: 10000]" and GitHub Pages still
  deploys. Manual deploy: `npm run build && npx wrangler deploy`.
- **GitHub Pages** → <https://nedjagang.github.io> (mirror; its canonical tags point at the
  Cloudflare domain).

`_redirects` and `_headers` in `public/` are honored by Cloudflare's static assets; GitHub
Pages gets the equivalent from Astro's `redirects` config.

## Develop

```sh
npm install
npm run dev      # local dev server
npm run build    # static build into dist/
```

## Structure

- `src/pages/` — routes: `/` (about), `/writing`, `/projects`
- `src/content/writing/` — notes and write-ups (MDX; one collection, optional `kind` label)
- `src/content/projects/` — project pages (MDX)
- `src/lib/site.ts` — single source of identity (name, links, domain)
- `scripts/sync-substack.mjs` — one-way import of a Substack feed into
  `src/content/writing/`, converting each post's HTML into clean Markdown (headings feed
  the table of contents; the site's prose styles apply, so a synced post looks identical
  to a hand-written one). Set the `SUBSTACK_FEED_URL` repo variable (a publication feed,
  `https://NAME.substack.com/feed`) to enable it; while unset the job is skipped.
  `.github/workflows/sync-substack.yml` runs it nightly and after each Substack publish it
  picks the post up automatically. Substack's Cloudflare edge returns 403 to GitHub-hosted
  runners (datacenter IPs), so on CI the script fetches through the rss2json proxy instead;
  the direct feed and the proxy produce byte-identical Markdown, so runs are idempotent.
  Run it locally the same way (`SUBSTACK_FORCE_PROXY=1` reproduces the CI path exactly):

  ```sh
  SUBSTACK_FEED_URL=https://NAME.substack.com/feed node scripts/sync-substack.mjs
  ```
