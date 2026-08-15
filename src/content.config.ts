import {defineCollection} from "astro:content";
import {glob} from "astro/loaders";
import {z} from "astro/zod";

const addonsCollection = defineCollection({
    loader: glob({pattern: "**/*.md", base: "./src/content/addons"}),
    schema: z.object({
        title: z.string(),
        category: z.string(),
        icon: z.string(),
        summary: z.string(),
        features: z.array(z.string()).optional(),
        order: z.number().default(0),
    })
});

const blogCollection = defineCollection({
    loader: glob({pattern: "**/*.md", base: "./src/content/blog"}),
    schema: z.object({
        title: z.string(),
        short_title: z.string(),
        description: z.string(),
        date: z.coerce.date(),
        author: z.string().default("Jetexir Team"),
        tags: z.array(z.string()).optional(),
        addons: z.array(z.string()).optional(),
        draft: z.boolean().default(false),
    })
});

export const collections = {
    addons: addonsCollection,
    blog: blogCollection,
};