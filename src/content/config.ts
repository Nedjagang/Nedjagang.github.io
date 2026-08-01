import { defineCollection, z } from 'astro:content';

// One writing collection; the old notes/analyses/architecture flavor lives on
// as an optional `kind` label. The schema is a superset — kind-specific
// fields are optional and the post template renders whichever are present.
const writing = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.date(),
    updated: z.date().optional(),
    kind: z.enum(['Note', 'Analysis', 'Architecture']).optional(),
    summary: z.string().optional(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    // set by scripts/sync-substack.mjs on imported posts; links back to the original
    substackUrl: z.string().url().optional(),
    // analysis-flavored extras
    repository: z.string().optional(),
    purpose: z.string().optional(),
    architecture: z.string().optional(),
    folderStructure: z.string().optional(),
    designDecisions: z.array(z.string()).default([]),
    patterns: z.array(z.string()).default([]),
    learned: z.array(z.string()).default([]),
    improve: z.array(z.string()).default([]),
    // architecture-flavored extras
    problem: z.string().optional(),
    tradeoffs: z.array(z.string()).default([]),
    scaling: z.string().optional(),
    failureModes: z.array(z.string()).default([]),
    observations: z.array(z.string()).default([]),
    questions: z.array(z.string()).default([]),
    references: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
  }),
});

const projects = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.date(),
    updated: z.date().optional(),
    status: z.enum(['building', 'completed', 'archived']),
    overview: z.string(),
    problem: z.string(),
    techStack: z.array(z.string()),
    tags: z.array(z.string()).default([]),
    demoUrl: z.string().optional(),
    githubUrl: z.string().optional(),
    timeline: z
      .array(
        z.object({
          date: z.date(),
          label: z.string(),
        })
      )
      .default([]),
    related: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

export const collections = { writing, projects };
