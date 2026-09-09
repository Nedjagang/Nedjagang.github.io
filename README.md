# praneeth-vp — personal site

Personal portfolio and notebook of **Praneeth V P** — AI engineer building agents,
backend systems, and self-hosted LLM infrastructure, with the observability to keep
it all honest.

Built with [Astro](https://astro.build), Tailwind, and MDX. Static output. Every push to
`main` runs `.github/workflows/deploy.yml`, which builds once and publishes to two places:

- **Cloudflare Pages** project `praneethveep-dev` → <https://dev.praneethveep.me> (canonical;
  `SITE.url` in `src/lib/site.ts`). Needs the `CLOUDFLARE_API_TOKEN` repo secret (a token
  with *Cloudflare Pages: Edit* on the account); without it that step is skipped.
- **GitHub Pages** → <https://nedjagang.github.io> (mirror; its canonical tags point at the
  Cloudflare domain).

`_redirects` and `_headers` in `public/` are honored by Cloudflare Pages; GitHub Pages gets
the equivalent from Astro's `redirects` config.

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
- `scripts/sync-substack.mjs` — optional nightly one-way sync from a Substack feed
  into `src/content/writing/` (set the `SUBSTACK_FEED_URL` repo variable to enable;
  see `.github/workflows/sync-substack.yml`)
