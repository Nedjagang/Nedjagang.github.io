import { getCollection, type CollectionEntry } from 'astro:content';
import { readingMinutes } from './readingTime';

export function byDateDesc<T extends { data: { date: Date } }>(a: T, b: T): number {
  return b.data.date.valueOf() - a.data.date.valueOf();
}

export function publishedOnly<C extends CollectionEntry<'writing' | 'projects'>>(entries: C[]): C[] {
  return entries.filter((e) => !e.data.draft);
}

export interface Post {
  title: string;
  date: Date;
  href: string;
  slug: string;
  kind?: 'Note' | 'Analysis' | 'Architecture';
  summary: string;
  tags: string[];
  minutes: number;
}

// The old notes/analyses/architecture collections carried the summary under
// different names; merged files may still use purpose/problem.
export function writingSummary(data: CollectionEntry<'writing'>['data']): string {
  return data.summary ?? data.purpose ?? data.problem ?? '';
}

// The homepage feed: every writing entry, date-sorted. Projects live on /projects.
export async function allPosts(): Promise<Post[]> {
  const writing = await getCollection('writing');
  return publishedOnly(writing)
    .map((e): Post => ({
      title: e.data.title,
      date: e.data.date,
      href: `/writing/${e.slug}`,
      slug: e.slug,
      kind: e.data.kind,
      summary: writingSummary(e.data),
      tags: e.data.tags,
      minutes: readingMinutes(e.body),
    }))
    .sort((a, b) => b.date.valueOf() - a.date.valueOf());
}

export async function allProjects(): Promise<CollectionEntry<'projects'>[]> {
  const projects = await getCollection('projects');
  return publishedOnly(projects).sort(byDateDesc);
}
