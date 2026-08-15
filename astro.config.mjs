import {defineConfig} from 'astro/config';
import icon from "astro-icon";
import compressor from "astro-compressor";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
    site: 'https://jetexir.ir',
    prefetch: {
        defaultStrategy: 'viewport'
    },
    integrations: [
        icon(),
        sitemap({
            changefreq: 'monthly',
            priority: 0.7,

            serialize(item) {
                // Don't stamp every URL with "today" on each rebuild, a
                // meaningless lastmod can trigger pointless recrawls. The
                // sitemap is regenerated from content collections, so the
                // lastmod field is simply omitted.
                item.changefreq = 'weekly';
                item.priority = 1;

                if (/addons/.test(item.url)) {
                    item.priority = 0.9;
                }
                if (/blog/.test(item.url)) {
                    item.priority = 0.7;
                }

                return item;
            },
        }),
        compressor({
            gzip: true,
            brotli: true
        })
    ],
    devToolbar: {
        enabled: false
    },
    server: {
        watch: {
            // Poll for file changes, native watching on this Windows setup
            // can miss rapid edits, leaving stale CSS in the dev server.
            usePolling: true
        }
    }
    /*output: "server",
    adapter: vercel({
        imageService: true,
        webAnalytics: {enabled: true},
        isr: {
            // caches all pages on first request and saves for 1 day
            expiration: 60 * 60 * 24,
        },
    })*/
});