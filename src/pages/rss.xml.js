import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';
import { SITE } from '../lib/site';

// One combined feed: writing + projects, newest first. This is a one-person
// notebook site — readers want "everything new," not per-section feeds.
export async function GET(context) {
  const [writing, projects] = await Promise.all([
    getCollection('writing'),
    getCollection('projects'),
  ]);

  const items = [
    ...writing.filter((e) => !e.data.draft).map((e) => ({
      title: e.data.title,
      pubDate: e.data.date,
      description: e.data.summary ?? e.data.purpose ?? e.data.problem ?? '',
      link: `/writing/${e.slug}/`,
    })),
    ...projects.filter((e) => !e.data.draft).map((e) => ({
      title: e.data.title,
      pubDate: e.data.date,
      description: e.data.overview,
      link: `/projects/${e.slug}/`,
    })),
  ].sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());

  return rss({
    title: SITE.name,
    description: SITE.description,
    site: context.site,
    items,
  });
}
