#!/usr/bin/env node
/**
 * Jetexir Featured Illustration Generator
 *
 * Generates transparent 1600x900 WebP illustrations using SVG composition.
 * No characters, mascots, logos, UI screenshots, or readable text.
 *
 * Style:
 * - hand-drawn editorial / technical doodle
 * - lavender + cyan limited palette
 * - dark imperfect ink outlines
 * - subtle risograph/paper texture
 * - pseudo-isometric geometry
 *
 * Usage:
 *   npm i sharp
 *   node generate-featured.mjs
 *   node generate-featured.mjs --only="sale-badges,fly-cart"
 *   node generate-featured.mjs --blog
 *   node generate-featured.mjs --force
 *
 * Existing images are skipped unless --force is passed, which regenerates
 * every selected image from scratch.
 */

import fs from "node:fs/promises";
import {existsSync} from "node:fs";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const W = 1600;
const H = 900;
const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'public', 'images', 'featured');

const C = {
    ink: "#21172d",
    purple: "#7B45C7",
    purple2: "#9B72D5",
    lavender: "#D9CCED",
    lavender2: "#EEE8F7",
    cyan: "#55C7D6",
    cyan2: "#AEE8EE",
    cream: "#FFF7D1",
    paper: "#F8F5F1",
    darkCyan: "#2D7F8C",
};

const FONT = "Arial, 'Helvetica Neue', Helvetica, sans-serif";

const STYLE = `
<style>
  .ink{stroke:${C.ink};stroke-width:18;stroke-linecap:round;stroke-linejoin:round}
  .thin{stroke:${C.ink};stroke-width:11;stroke-linecap:round;stroke-linejoin:round}
  .purple{fill:${C.purple}}
  .purple2{fill:${C.purple2}}
  .lav{fill:${C.lavender}}
  .lav2{fill:${C.lavender2}}
  .cyan{fill:${C.cyan}}
  .cyan2{fill:${C.cyan2}}
  .cream{fill:${C.cream}}
  .paper{fill:${C.paper}}
  .none{fill:none}
</style>`;

const esc = s => String(s).replace(/[&<>"]/g, m => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[m]));

/** Slightly irregular SVG path helpers. */
function path2(d, cls = "") {
    return `<path d="${d}" class="${cls}"/>`;
}

function rect(x, y, w, h, rx = 24, cls = "") {
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" class="${cls}"/>`;
}

function circle(cx, cy, r, cls = "") {
    return `<circle cx="${cx}" cy="${cy}" r="${r}" class="${cls}"/>`;
}

function line(x1, y1, x2, y2, cls = "thin") {
    return `<path d="M${x1} ${y1} L${x2} ${y2}" class="${cls} none"/>`;
}

function polygon(points, cls = "") {
    return `<polygon points="${points}" class="${cls}"/>`;
}

/**
 * Texture is clipped to the illustration bounds rather than painted over
 * the complete transparent canvas. This preserves transparent output.
 */
function defs() {
    return `
<defs>
  <filter id="paperNoise" x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="2" seed="17" result="n"/>
    <feColorMatrix in="n" type="saturate" values="0" result="g"/>
    <feComponentTransfer in="g">
      <feFuncA type="table" tableValues="0 .075"/>
    </feComponentTransfer>
  </filter>
  <filter id="rough">
    <feTurbulence type="fractalNoise" baseFrequency=".018" numOctaves="2" seed="9" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <pattern id="dots" width="34" height="34" patternUnits="userSpaceOnUse">
    <circle cx="5" cy="9" r="1.6" fill="${C.ink}" opacity=".12"/>
    <circle cx="23" cy="27" r="1.2" fill="${C.ink}" opacity=".09"/>
    <circle cx="31" cy="8" r="1" fill="${C.ink}" opacity=".08"/>
  </pattern>
</defs>`;
}

function texture() {
    return `
<g opacity=".55">
  <rect x="140" y="100" width="1320" height="700" rx="80" fill="url(#dots)"/>
  <rect x="140" y="100" width="1320" height="700" rx="80" filter="url(#paperNoise)" opacity=".8"/>
</g>`;
}

function svg(content) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
${defs()}${STYLE}
<g filter="url(#rough)">
${content}
</g>
${texture()}
</svg>`;
}

/**
 * Approximate the painted bounds of a scene's SVG markup so the composition
 * can be centered on the canvas. Covers the primitives the scenes use:
 * rect, circle, polygon, and path (M/L/C command pairs).
 */
function contentBounds(markup) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const extend = (x1, y1, x2, y2) => {
        minX = Math.min(minX, x1);
        minY = Math.min(minY, y1);
        maxX = Math.max(maxX, x2);
        maxY = Math.max(maxY, y2);
    };

    for (const m of markup.matchAll(/<rect\s+x="([\d.]+)"\s+y="([\d.]+)"\s+width="([\d.]+)"\s+height="([\d.]+)"/g)) {
        extend(+m[1], +m[2], +m[1] + +m[3], +m[2] + +m[4]);
    }
    for (const m of markup.matchAll(/<circle\s+cx="([\d.]+)"\s+cy="([\d.]+)"\s+r="([\d.]+)"/g)) {
        extend(+m[1] - +m[3], +m[2] - +m[3], +m[1] + +m[3], +m[2] + +m[3]);
    }
    for (const m of markup.matchAll(/<polygon\s+points="([^"]+)"/g)) {
        for (const p of m[1].trim().split(/\s+/)) {
            const [x, y] = p.split(',').map(Number);
            extend(x, y, x, y);
        }
    }
    for (const m of markup.matchAll(/<path\s+d="([^"]+)"/g)) {
        const nums = m[1].match(/-?\d+(?:\.\d+)?/g) || [];
        for (let i = 0; i + 1 < nums.length; i += 2) {
            extend(+nums[i], +nums[i + 1], +nums[i], +nums[i + 1]);
        }
    }

    return {minX, minY, maxX, maxY};
}

/**
 * Wrap a scene's markup in a group translated so its painted bounds sit
 * centered on the canvas (horizontal center 800, vertical center 450).
 */
function centered(content) {
    const b = contentBounds(content);
    if (!isFinite(b.minX)) return content;
    const dx = Math.round(W / 2 - (b.minX + b.maxX) / 2);
    const dy = Math.round(H / 2 - (b.minY + b.maxY) / 2);
    if (dx === 0 && dy === 0) return content;
    return `<g transform="translate(${dx} ${dy})">\n${content}\n</g>`;
}

function tag(x, y, w, h, fill = C.purple, angle = 0) {
    return `<g transform="rotate(${angle} ${x + w / 2} ${y + h / 2})">
    ${rect(x, y, w, h, 28, `${fill === C.cyan ? "cyan" : "purple"} ink`)}
    ${circle(x + 34, y + h / 2, 9, "cream")}
  </g>`;
}

function cube(x, y, s, fill = C.cyan) {
    const top = `${x},${y} ${x + s * .48},${y - s * .28} ${x + s},${y} ${x + s * .5},${y + s * .3}`;
    const left = `${x},${y} ${x + s * .5},${y + s * .3} ${x + s * .5},${y + s * 1.02} ${x},${y + s * .72}`;
    const right = `${x + s * .5},${y + s * .3} ${x + s},${y} ${x + s},${y + s * .72} ${x + s * .5},${y + s * 1.02}`;
    return polygon(top, "cyan ink") + polygon(left, "purple2 ink") + polygon(right, "lav ink") + line(x + s * .18, y + s * .18, x + s * .42, y + s * .32, "thin");
}

function card(x, y, w, h, angle = 0, fill = C.lav2) {
    return `<g transform="rotate(${angle} ${x + w / 2} ${y + h / 2})">
    ${rect(x, y, w, h, 34, `${fill === C.cyan2 ? "cyan2" : "lav2"} ink`)}
  </g>`;
}

function slider(x, y, w, value = .65) {
    return line(x, y, x + w, y, "ink") + circle(x + w * value, y, 22, "cyan ink") + circle(x, y, 11, "cream") + circle(x + w, y, 11, "cream");
}

function windowFrame(x, y, w, h, angle = 0) {
    return `<g transform="rotate(${angle} ${x + w / 2} ${y + h / 2})">
    ${rect(x, y, w, h, 28, "paper ink")}
    ${circle(x + 30, y + 30, 8, "purple")}
    ${circle(x + 58, y + 30, 8, "cyan")}
    ${circle(x + 86, y + 30, 8, "lav")}
  </g>`;
}

/** Four-point star burst used as confetti/sparkle accents. */
function sparkle(cx, cy, r, cls = "purple ink") {
    const points = [`${cx} ${cy - r}`, `${cx + r * 0.3} ${cy - r * 0.3}`, `${cx + r} ${cy}`, `${cx + r * 0.3} ${cy + r * 0.3}`, `${cx} ${cy + r}`, `${cx - r * 0.3} ${cy + r * 0.3}`, `${cx - r} ${cy}`, `${cx - r * 0.3} ${cy - r * 0.3}`,].join(" ");
    return polygon(points, cls);
}

/* ---- Illustration scenes. No characters are used anywhere. ---- */

const scenes = {
    "sale-badges": () => `
    ${card(520, 235, 560, 370, -3)}
    ${circle(800, 415, 150, "lav ink")}
    ${circle(800, 415, 106, "paper thin")}
    ${tag(650, 280, 300, 120, C.purple, -7)}
    ${tag(770, 520, 260, 105, C.cyan, 5)}
    ${line(600, 600, 1020, 600, "thin")}
    ${circle(1120, 320, 30, "cyan ink")}
    ${line(1100, 350, 1060, 405, "thin")}
  `,

    "price-variations": () => `
    ${cube(570, 310, 230, C.cyan)}
    ${cube(850, 430, 180, C.purple)}
    ${line(620, 590, 1080, 590, "ink")}
    ${line(690, 650, 1010, 650, "thin")}
    ${circle(590, 590, 22, "cream ink")}
    ${circle(1080, 590, 22, "cream ink")}
    ${tag(500, 185, 250, 92, C.purple, -5)}
    ${tag(920, 190, 250, 92, C.cyan, 4)}
  `,

    "product-comparison": () => `
    ${card(420, 220, 320, 430, -5)}
    ${card(640, 185, 320, 480, 1)}
    ${card(860, 240, 320, 410, 5)}
    ${line(480, 330, 680, 330, "thin")}
    ${line(700, 300, 900, 300, "thin")}
    ${line(920, 350, 1120, 350, "thin")}
    ${circle(520, 410, 24, "cyan ink")}
    ${circle(740, 380, 24, "cyan ink")}
    ${circle(960, 430, 24, "cyan ink")}
    ${line(520, 410, 560, 450, "thin")}
    ${line(740, 380, 780, 420, "thin")}
    ${line(960, 430, 1000, 470, "thin")}
    ${cube(675, 535, 95, C.purple)}
  `,

    "wishlist": () => `
    ${card(510, 210, 580, 480, -2)}
    ${path2("M800 590 C760 548 620 480 620 370 C620 305 700 278 750 330 L800 380 L850 330 C900 278 980 305 980 370 C980 480 840 548 800 590Z", "purple ink")}
    ${circle(690, 290, 18, "cyan")}
    ${circle(930, 620, 20, "cyan ink")}
    ${line(1080, 300, 1160, 245, "thin")}
    ${circle(1170, 235, 26, "lav ink")}
  `,

    "social-sharing": () => `
    ${circle(800, 440, 125, "lav ink")}
    ${circle(800, 440, 65, "paper thin")}
    ${circle(570, 300, 55, "cyan ink")}
    ${circle(1030, 300, 55, "purple ink")}
    ${circle(1050, 590, 55, "cyan ink")}
    ${circle(550, 590, 55, "purple ink")}
    ${line(610, 330, 720, 400, "ink")}
    ${line(880, 400, 990, 330, "ink")}
    ${line(880, 480, 1000, 560, "ink")}
    ${line(720, 480, 600, 560, "ink")}
    ${circle(800, 440, 22, "cream ink")}
  `,

    "faq-section": () => `
    ${card(500, 210, 600, 500, 2)}
    ${rect(570, 290, 460, 80, 20, "lav ink")}
    ${rect(570, 405, 460, 80, 20, "cyan2 ink")}
    ${rect(570, 520, 460, 80, 20, "lav ink")}
    ${circle(980, 330, 22, "purple ink")}
    ${circle(980, 445, 22, "purple ink")}
    ${circle(980, 560, 22, "purple ink")}
    ${line(610, 330, 850, 330, "thin")}
    ${line(610, 445, 850, 445, "thin")}
    ${line(610, 560, 850, 560, "thin")}
  `,

    "related-products": () => `
    ${cube(480, 370, 180, C.purple)}
    ${cube(720, 280, 210, C.cyan)}
    ${cube(970, 390, 180, C.purple2)}
    ${line(650, 430, 720, 390, "ink")}
    ${line(930, 390, 970, 430, "ink")}
    ${circle(800, 610, 55, "lav ink")}
    ${line(800, 610, 850, 560, "thin")}
    ${circle(850, 560, 16, "cream ink")}
  `,

    "call-for-price": () => `
    ${card(570, 245, 460, 390, -4)}
    ${circle(800, 385, 100, "cyan ink")}
    ${circle(800, 385, 55, "paper thin")}
    ${path2("M800 330 L800 440 M765 355 C785 320 845 335 845 365 C845 410 770 395 770 435 C770 470 825 475 850 445", "thin")}
    ${tag(650, 535, 300, 95, C.purple, 3)}
  `,

    "quantity-fields": () => `
    ${rect(530, 290, 540, 260, 45, "lav ink")}
    ${circle(610, 420, 62, "cyan ink")}
    ${circle(990, 420, 62, "cyan ink")}
    ${line(595, 420, 625, 420, "thin")}
    ${line(975, 420, 1005, 420, "thin")}
    ${line(990, 405, 990, 435, "thin")}
    ${rect(690, 350, 220, 140, 30, "paper ink")}
    ${line(735, 420, 865, 420, "thin")}
    ${circle(800, 420, 35, "purple ink")}
    ${line(785, 420, 815, 420, "thin")}
  `,

    "fly-cart": () => `
    ${rect(560, 190, 480, 520, 38, "lav ink")}
    ${circle(610, 235, 10, "purple")}
    ${circle(640, 235, 10, "cyan")}
    ${circle(670, 235, 10, "lav")}
    ${cube(670, 320, 180, C.cyan)}
    ${line(640, 560, 930, 560, "thin")}
    ${tag(690, 600, 230, 75, C.purple, 0)}
    ${line(520, 280, 450, 250, "ink")}
    ${line(520, 320, 420, 320, "thin")}
    ${polygon("430,318 558,352 558,462 452,496", "purple2 ink")}
    ${polygon("1170,318 1042,352 1042,462 1148,496", "purple2 ink")}
    ${line(478, 370, 528, 388, "thin")}
    ${line(1122, 370, 1072, 388, "thin")}
  `,

    "menu-cart": () => `
    ${rect(500, 270, 600, 120, 35, "lav ink")}
    ${circle(650, 330, 42, "cyan ink")}
    ${path2("M635 315 L650 350 L690 350 L705 325 L645 325", "thin")}
    ${circle(670, 360, 7, "cream")}
    ${circle(690, 360, 7, "cream")}
    ${circle(760, 330, 28, "purple ink")}
    ${line(820, 330, 1010, 330, "thin")}
    ${line(820, 365, 950, 365, "thin")}
    ${rect(900, 430, 220, 180, 28, "paper ink")}
    ${cube(950, 465, 80, C.cyan)}
  `,

    "checkout-fields": () => `
    ${card(500, 190, 600, 530, 0)}
    ${rect(570, 280, 460, 75, 18, "paper ink")}
    ${rect(570, 390, 460, 75, 18, "cyan2 ink")}
    ${rect(570, 500, 460, 75, 18, "paper ink")}
    ${circle(1010, 317, 16, "purple ink")}
    ${circle(1010, 427, 16, "purple ink")}
    ${circle(1010, 537, 16, "purple ink")}
    ${line(610, 317, 900, 317, "thin")}
    ${line(610, 427, 900, 427, "thin")}
    ${line(610, 537, 900, 537, "thin")}
    ${circle(1130, 250, 28, "cyan ink")}
  `,

    "custom-order-statuses": () => `
    ${cube(500, 390, 170, C.purple)}
    ${cube(720, 300, 190, C.cyan)}
    ${cube(970, 390, 170, C.purple2)}
    ${line(670, 450, 720, 400, "ink")}
    ${line(910, 400, 970, 450, "ink")}
    ${circle(800, 590, 52, "cream ink")}
    ${path2("M770 590 L790 612 L832 565", "ink")}
  `,

    "announcement-bar": () => `
    ${rect(350, 280, 900, 145, 38, "purple ink")}
    ${circle(410, 352, 25, "cream ink")}
    ${line(470, 330, 930, 330, "thin")}
    ${line(470, 375, 820, 375, "thin")}
    ${tag(1000, 305, 180, 80, C.cyan, 4)}
    ${line(450, 470, 1150, 470, "thin")}
    ${circle(470, 470, 12, "cyan ink")}
    ${circle(1130, 470, 12, "cyan ink")}
  `,

    "currency-symbols": () => `
    ${circle(800, 430, 180, "cyan ink")}
    ${circle(800, 430, 125, "paper thin")}
    ${path2("M860 350 C810 315 740 335 735 385 C730 435 815 430 835 470 C855 510 790 545 735 500", "purple ink")}
    ${line(790, 310, 790, 555, "thin")}
    ${line(850, 325, 850, 535, "thin")}
    ${circle(1090, 300, 38, "lav ink")}
    ${circle(1150, 360, 26, "purple ink")}
  `,

    "sale-progress-bar": () => `
    ${rect(430, 360, 740, 120, 45, "lav ink")}
    ${rect(470, 400, 510, 40, 20, "cyan")}
    ${circle(1000, 420, 42, "purple ink")}
    ${circle(1000, 420, 17, "cream")}
    ${line(500, 550, 1080, 550, "thin")}
    ${circle(500, 550, 18, "cyan ink")}
    ${circle(1080, 550, 18, "purple ink")}
    ${tag(620, 240, 360, 90, C.purple, -3)}
  `,

    "order-numbers": () => `
    ${cube(620, 300, 220, C.cyan)}
    ${rect(695, 380, 190, 125, 25, "paper ink")}
    ${circle(735, 420, 18, "purple")}
    ${circle(800, 420, 18, "cyan")}
    ${circle(865, 420, 18, "purple")}
    ${line(700, 560, 900, 560, "thin")}
    ${line(700, 600, 840, 600, "thin")}
    ${circle(1040, 350, 55, "lav ink")}
    ${path2("M1020 350 L1035 365 L1065 330", "ink")}
  `,

    "release-v1-0": () => `
    ${circle(800, 350, 170, "lav ink")}
    ${circle(800, 350, 128, "paper thin")}

    <text x="800" y="405" text-anchor="middle" font-family="${FONT}" font-size="190" font-weight="800" fill="${C.ink}">${esc("V1.0")}</text>

    ${tag(580, 460, 440, 95, C.purple, -3)}

    ${sparkle(470, 300, 26, "cream ink")}
    ${sparkle(1150, 300, 30, "cyan ink")}

    ${circle(420, 220, 24, "cyan ink")}
    ${card(350, 330, 46, 46, -18, C.cyan2)}
    ${card(430, 540, 42, 42, 20, C.purple2)}
    ${circle(330, 470, 20, "cream ink")}
    ${circle(470, 650, 24, "cyan ink")}
    ${sparkle(540, 700, 22, "purple ink")}

    ${circle(1180, 230, 24, "purple ink")}
    ${card(1230, 340, 48, 48, 16, C.purple2)}
    ${card(1150, 540, 42, 42, -14, C.cyan2)}
    ${circle(1270, 480, 20, "cream ink")}
    ${circle(1130, 650, 24, "cyan ink")}
    ${sparkle(1060, 700, 22, "purple ink")}

    ${card(620, 150, 38, 38, 22, C.cyan2)}
    ${sparkle(700, 190, 20, "purple ink")}
    ${card(990, 145, 40, 40, -18, C.purple2)}
    ${sparkle(930, 185, 18, "cyan ink")}

    ${line(500, 190, 590, 150, "thin")}
    ${line(1310, 200, 1220, 150, "thin")}

    ${cube(745, 640, 110, C.cyan)}
  `,
};

const addonData = [["sale-badges", "Sale Badges"], ["price-variations", "Price Variations"], ["product-comparison", "Product Comparison"], ["wishlist", "Wishlist"], ["social-sharing", "Social Sharing"], ["faq-section", "FAQ Section"], ["related-products", "Related Products"], ["call-for-price", "Call for Price"], ["quantity-fields", "Quantity Fields"], ["fly-cart", "Fly Cart"], ["menu-cart", "Menu Cart"], ["checkout-fields", "Checkout Fields"], ["custom-order-statuses", "Custom Order Statuses"], ["announcement-bar", "Announcement Bar"], ["currency-symbols", "Currency Symbols"], ["sale-progress-bar", "Sale Progress Bar"], ["order-numbers", "Order Numbers"],];

const blogData = [["release-v1-0", "Jetexir V1.0 has landed. 17 addons to supercharge your WooCommerce store"]];

function slug(s) {
    return s.toLowerCase()
        .replace(/['’]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

async function render(name, title, {force = false} = {}) {
    const scene = scenes[name];
    if (!scene) throw new Error(`Missing SVG scene: ${name}`);

    await fs.mkdir(OUT, {recursive: true});
    const file = path.join(OUT, `${name}.webp`);

    // Skip images that already exist unless force regenerates them.
    if (!force && existsSync(file)) {
        console.log(`· skip ${title} (already exists)`);
        return;
    }

    const markup = svg(centered(scene()));

    await sharp(Buffer.from(markup))
        .resize(W, H, {fit: "contain"})
        .webp({quality: 88, effort: 6})
        .toFile(file);

    console.log(`✓ ${title} -> ${file}`);
}

async function main() {
    await fs.mkdir(OUT, {recursive: true});

    const arg = process.argv.find(a => a.startsWith("--only="));
    const only = arg ? arg.slice(7).split(",").map(s => slug(s.trim())) : null;
    const blogOnly = process.argv.includes("--blog");
    const addonOnly = process.argv.includes("--addon");
    const force = process.argv.includes("--force");

    let items;
    if (blogOnly) items = blogData;
    else if (addonOnly) items = addonData;
    else items = [...addonData, ...blogData];

    for (const [name, title] of items) {
        if (only && !only.includes(name) && !only.includes(slug(title))) continue;
        await render(name, title, {force});
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
