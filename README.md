# Jetexir Website

The official website for [Jetexir](https://jetexir.ir) — a free, open source enhancement suite for WooCommerce. Built with [Astro](https://astro.build/).

Jetexir provides visual enhancements, customer engagement tools, flexible product display options, streamlined shopping cart features, checkout optimization, and branding tools — all in one plugin.

## Tech Stack

- **[Astro](https://astro.build/)** — Static site generator
- **[TypeScript](https://www.typescriptlang.org/)** — Type-safe JavaScript
- **[SCSS/Sass](https://sass-lang.com/)** — Stylesheet authoring
- **[astro-icon](https://www.astroicon.dev/)** — SVG icon system
- **[Three.js](https://threejs.org/)** — 3D hero background animation
- **[astro-compressor](https://github.com/nicholasgillespie/astro-compressor)** — Gzip & Brotli compression
- **[@astrojs/sitemap](https://docs.astro.build/en/guides/integrations-guide/sitemap/)** — Auto-generated sitemap

## Project Structure

```
├── public/
│   ├── css/                  # Compiled CSS
│   ├── scss/                 # SCSS source files
│   ├── images/               # Static images
│   └── fonts/                # Font files
├── src/
│   ├── components/           # Astro components (Header, Footer, CtaBand, etc.)
│   ├── content/
│   │   ├── addons/           # Addon collection (markdown)
│   │   └── blog/             # Blog posts (markdown)
│   ├── icons/                # SVG icons
│   ├── layouts/              # Page layouts
│   ├── pages/                # Route pages
│   │   ├── index.astro       # Home page
│   │   ├── about.astro       # About page
│   │   ├── donate.astro      # Donate page
│   │   ├── addons/           # Addon pages
│   │   └── blog/             # Blog pages
│   └── consts.ts             # Global constants
├── scripts/                  # Build-time generation scripts
│   ├── generate-og.mjs       # Open Graph image generation
│   ├── generate-featured.mjs # Featured image generation
│   ├── generate-content-json.mjs
│   └── generate-icons.mjs
└── astro.config.mjs
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [npm](https://www.npmjs.com/)

### Install Dependencies

```bash
npm install
```

### Development Server

```bash
npm run dev
```

The site will be available at [http://localhost:4321](http://localhost:4321).

### Build for Production

```bash
npm run build
```

Output is written to `dist/`.

### Preview Production Build

```bash
npm run preview
```

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Astro dev server |
| `npm run build` | Generate OG images and build the site |
| `npm run preview` | Preview the production build |
| `npm run check` | Run Astro type checking |
| `npm run og:images` | Generate Open Graph images |
| `npm run featured:images` | Generate featured images for all content |
| `npm run featured:blog-images` | Generate featured images for blog posts only |
| `npm run featured:addons-images` | Generate featured images for addons only |
| `npm run icons` | Generate icon assets |

## Content

### Addons

Addon pages live in `src/content/addons/` as Markdown files with YAML frontmatter.

### Blog

Blog posts live in `src/content/blog/` as Markdown files with YAML frontmatter.

## License

Open source project by [Parsa.ws](https://parsa.ws).

## Links

- **Website:** [jetexir.ir](https://jetexir.ir)
- **WordPress Plugin:** [wordpress.org/plugins/jetexir](https://wordpress.org/plugins/jetexir/)
- **GitHub:** [github.com/Jetexir/jetexir-wp-plugin](https://github.com/Jetexir/jetexir-wp-plugin)
