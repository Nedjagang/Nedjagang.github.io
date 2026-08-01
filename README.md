# praneeth-vp — personal site

Personal portfolio and notebook of **Praneeth V P** — AI engineer building agents,
backend systems, and self-hosted LLM infrastructure, with the observability to keep
it all honest.

Built with [Astro](https://astro.build), Tailwind, and MDX. Static output, deployed to
**GitHub Pages** at <https://nedjagang.github.io> via `.github/workflows/deploy.yml`
on every push to `main`. (`_redirects` and `_headers` in `public/` additionally support
a Cloudflare Pages deploy if the site ever moves there.)

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
