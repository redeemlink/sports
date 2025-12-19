import { defineCollection, z } from 'astro:content';

const newsCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.string(),
    image: z.string().optional(),
    link: z.string(),
    source: z.string(),
  }),
});

export const collections = { news: newsCollection };