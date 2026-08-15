/**
 * Generate Open Graph images for the site.
 *
 * 1. A unique 1200x630 card for every addon page, read from
 *    src/content/addons/*.md (title, category, icon, summary), written to
 *    public/images/og/<addon-id>.png.
 * 2. A card for every blog post, read from
 *    src/content/blog/*.md (title, description, date), written to
 *    public/images/og/<post-id>.png.
 * 3. The branded default card (public/images/og-default.png) used by pages
 *    without their own card (home, about, addons).
 *
 * Cards match the site's light-lavender look and are rendered via sharp.
 *
 * Run with: npm run og:images
 */
import sharp from 'sharp';
import {mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ADDONS_DIR = path.join(ROOT, 'src', 'content', 'addons');
const BLOG_DIR = path.join(ROOT, 'src', 'content', 'blog');
const ICONS_DIR = path.join(ROOT, 'src', 'icons');
const OUT_DIR = path.join(ROOT, 'public', 'images', 'og');

// Brand palette (public/scss/base/helper.scss)
const VIOLET = '#7C3AED';
const INK = '#111827';
const SLATE = '#4B5563';
const MUTED = '#6B7280';
const FAINT = '#9CA3AF';

const W = 1200;
const H = 630;
const FONT = "Arial, 'Helvetica Neue', Helvetica, sans-serif";

/** Parse the YAML frontmatter of a content markdown file. */
function parseFrontmatter(file) {
    const src = readFileSync(file, 'utf8');
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(src);
    if (!m) throw new Error(`No frontmatter in ${file}`);
    const data = {};
    for (const line of m[1].split(/\r?\n/)) {
        const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line.trim());
        if (kv) data[kv[1]] = kv[2].replace(/^['"]|['"]$/g, '');
    }
    return data;
}

/**
 * Embed an icon file as a nested <svg>. Icons use stroke/fill="currentColor",
 * so re-tinting is a straight string swap; the root keeps its viewBox/fill
 * while width/height are set by the caller.
 */
function embedIcon(name, x, y, w, h) {
    const file = path.join(ICONS_DIR, `${name}.svg`);
    if (!readdirSync(ICONS_DIR).includes(`${name}.svg`)) {
        throw new Error(`Missing icon: ${file}`);
    }
    let svg = readFileSync(file, 'utf8').replace(/currentColor/g, VIOLET);
    svg = svg.replace(/<svg([^>]*)>/, (m, attrs) => {
        const viewBox = /viewBox="[^"]*"/.exec(attrs)?.[0] ?? '';
        const fill = /fill="[^"]*"/.exec(attrs)?.[0] ?? '';
        return `<svg x="${x}" y="${y}" width="${w}" height="${h}" ${viewBox} ${fill}>`;
    });
    return svg;
}

/** Greedy word wrap to a pixel budget (approx 0.5em per char). */
function wrap(text, fontSize, maxWidth) {
    const width = (s) => s.length * fontSize * 0.5;
    const lines = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (width(candidate) > maxWidth && line) {
            lines.push(line);
            line = word;
        } else {
            line = candidate;
        }
    }
    if (line) lines.push(line);
    if (lines.length > 2) {
        const last = lines[2];
        lines.length = 2;
        let cut = last;
        while (cut.length > 1 && width(cut + '…') > maxWidth) cut = cut.slice(0, -1);
        lines[1] = cut + '…';
    }
    return lines;
}

function escapeXml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderCard({title, category, icon, summary}) {
    const iconSize = 56;
    const chip = {x: 84, y: 142, size: 132, r: 34};
    const iconX = chip.x + (chip.size - iconSize) / 2;
    const iconY = chip.y + (chip.size - iconSize) / 2;
    const textX = 256;

    // Title size scales down with length; the longest title ("Custom Order
    // Statuses") still fits comfortably in the available 860px.
    const titleSize = Math.min(84, Math.max(54, Math.floor(860 / (title.length * 0.58))));
    const summarySize = 29;
    const summaryLines = wrap(summary, summarySize, 860);

    let defs = `
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#EDE9FE"/>
    <stop offset="100%" stop-color="#FEFEFF"/>
  </linearGradient>
  <radialGradient id="glow1" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="${VIOLET}" stop-opacity="0.14"/>
    <stop offset="100%" stop-color="${VIOLET}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="glow2" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#A78BFA" stop-opacity="0.22"/>
    <stop offset="100%" stop-color="#A78BFA" stop-opacity="0"/>
  </radialGradient>`;

    let body = '';

    // Background + decorative glows
    body += `
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="1050" cy="30" r="300" fill="url(#glow1)"/>
  <circle cx="110" cy="620" r="340" fill="url(#glow2)"/>`;

    // Icon chip
    body += `
  <rect x="${chip.x}" y="${chip.y}" width="${chip.size}" height="${chip.size}" rx="${chip.r}" fill="#FFFFFF" stroke="#E4DCFB" stroke-width="2"/>
  ${embedIcon(icon, iconX, iconY, iconSize, iconSize)}`;

    // Category + title
    body += `
  <text x="${textX}" y="170" font-family="${FONT}" font-size="30" font-weight="700" fill="${VIOLET}" letter-spacing="3">${escapeXml(category.toUpperCase())}</text>
  <text x="${textX}" y="262" font-family="${FONT}" font-size="${titleSize}" font-weight="800" fill="${INK}">${escapeXml(title)}</text>`;

    // Summary (max two lines)
    summaryLines.forEach((line, i) => {
        body += `
  <text x="${textX}" y="${316 + i * 36}" font-family="${FONT}" font-size="${summarySize}" font-weight="400" fill="${SLATE}">${escapeXml(line)}</text>`;
    });

    // Footer: divider + brand row
    const logoSize = 40;
    const logoScale = logoSize / 942.2;
    body += `
  <line x1="84" y1="488" x2="1116" y2="488" stroke="#E4DCFB" stroke-width="2"/>
  ${embedIcon('jetexir', 84, 506, Math.round(611.12 * logoScale * 10) / 10, logoSize)}
  <text x="122" y="540" font-family="${FONT}" font-size="34">
    <tspan font-weight="800" fill="${INK}">Jetexir</tspan> <tspan font-weight="400" fill="${MUTED}"> for WooCommerce</tspan>
  </text>
  <text x="1116" y="540" text-anchor="end" font-family="${FONT}" font-size="28" font-weight="400" fill="${FAINT}">jetexir.com</text>`;

    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>${defs}
  </defs>${body}
</svg>`;
}

function renderBlogCard({title, description, date, author}) {
    const textX = 84;

    // Blog titles are often long ("Jetexir V1.0 has landed. 17 addons to
    // supercharge your WooCommerce store"), so the font scales harder.
    const titleSize = Math.min(72, Math.max(44, Math.floor(1032 / (title.length * 0.62))));
    const summarySize = 30;
    const summaryLines = wrap(description, summarySize, 1032);

    let defs = `
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0%" stop-color="#EDE9FE"/>
    <stop offset="100%" stop-color="#FEFEFF"/>
  </linearGradient>
  <radialGradient id="glow1" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="${VIOLET}" stop-opacity="0.14"/>
    <stop offset="100%" stop-color="${VIOLET}" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="glow2" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#A78BFA" stop-opacity="0.22"/>
    <stop offset="100%" stop-color="#A78BFA" stop-opacity="0"/>
  </radialGradient>`;

    let body = '';

    // Background + decorative glows
    body += `
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="1050" cy="30" r="300" fill="url(#glow1)"/>
  <circle cx="110" cy="620" r="340" fill="url(#glow2)"/>`;

    // Category + title
    body += `
  <text x="${textX}" y="170" font-family="${FONT}" font-size="30" font-weight="700" fill="${VIOLET}" letter-spacing="3">JETEXIR BLOG</text>
  <text x="${textX}" y="262" font-family="${FONT}" font-size="${titleSize}" font-weight="800" fill="${INK}">${escapeXml(title)}</text>`;

    // Summary (max two lines)
    summaryLines.forEach((line, i) => {
        body += `
  <text x="${textX}" y="${316 + i * 40}" font-family="${FONT}" font-size="${summarySize}" font-weight="400" fill="${SLATE}">${escapeXml(line)}</text>`;
    });

    // Footer: divider + brand row with date & author
    const logoSize = 40;
    const logoScale = logoSize / 942.2;
    body += `
  <line x1="84" y1="488" x2="1116" y2="488" stroke="#E4DCFB" stroke-width="2"/>
  ${embedIcon('jetexir', 84, 506, Math.round(611.12 * logoScale * 10) / 10, logoSize)}
  <text x="122" y="540" font-family="${FONT}" font-size="34">
    <tspan font-weight="800" fill="${INK}">Jetexir</tspan> <tspan font-weight="400" fill="${MUTED}"> for WooCommerce</tspan>
  </text>
  <text x="1116" y="540" text-anchor="end" font-family="${FONT}" font-size="28" font-weight="400" fill="${FAINT}">${escapeXml(`${author} · ${date}`)}</text>`;

    return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>${defs}
  </defs>${body}
</svg>`;
}

mkdirSync(OUT_DIR, {recursive: true});

const files = readdirSync(ADDONS_DIR).filter((f) => f.endsWith('.md'));
let generated = 0;
for (const file of files) {
    const id = file.replace(/\.md$/, '');
    const {title, category, icon, summary} = parseFrontmatter(path.join(ADDONS_DIR, file));
    const svg = renderCard({title, category, icon, summary: summary ?? ''});
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const out = path.join(OUT_DIR, `${id}.png`);
    writeFileSync(out, png);
    const meta = await sharp(png).metadata();
    console.log(`✓ ${out}  ${meta.width}x${meta.height}  ${(png.length / 1024).toFixed(1)} KB`);
    generated++;
}

// Blog post cards.
const postFiles = readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'));
for (const file of postFiles) {
    const id = file.replace(/\.md$/, '');
    const {title, short_title, description, date, author} = parseFrontmatter(path.join(BLOG_DIR, file));
    const formattedDate = new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
        year: 'numeric', month: 'short', day: 'numeric',
    });
    const svg = renderBlogCard({
        title: short_title ?? title,
        description: description ?? '',
        author: author ?? 'Jetexir Team',
        date: formattedDate,
    });
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    const out = path.join(OUT_DIR, `${id}.png`);
    writeFileSync(out, png);
    const meta = await sharp(png).metadata();
    console.log(`✓ ${out}  ${meta.width}x${meta.height}  ${(png.length / 1024).toFixed(1)} KB`);
    generated++;
}

// Default card for pages without their own card (home, about, addons).
const defaultSvg = renderCard({
    title: 'Jetexir for WooCommerce',
    category: 'Open Source',
    icon: 'jetexir',
    summary: 'Free & open source WooCommerce enhancement suite, visual polish, engagement tools, and streamlined shopping.',
});
const defaultPng = await sharp(Buffer.from(defaultSvg)).png().toBuffer();
const defaultOut = path.join(ROOT, 'public', 'images', 'og-default.png');
writeFileSync(defaultOut, defaultPng);
const defaultMeta = await sharp(defaultPng).metadata();
console.log(`✓ ${defaultOut}  ${defaultMeta.width}x${defaultMeta.height}  ${(defaultPng.length / 1024).toFixed(1)} KB`);

console.log(`\nGenerated ${generated} og images in public/images/og/`);
