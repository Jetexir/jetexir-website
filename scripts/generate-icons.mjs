/**
 * Generate every site icon from src/icons/jetexir.svg with one consistent
 * treatment: the mark is centered on a square canvas and spans 84% of the
 * canvas height (matching public/images/logo.png and android-chrome icons).
 *
 * Outputs:
 *   - public/android-chrome-192x192.png  (transparent)
 *   - public/android-chrome-512x512.png  (transparent)
 *   - public/favicon-16x16.png           (transparent)
 *   - public/favicon-32x32.png           (transparent)
 *   - public/favicon-16x16-inactive.png  (grayscale variant)
 *   - public/favicon-32x32-inactive.png  (grayscale variant)
 *   - public/apple-touch-icon.png        (white background, iOS convention)
 *   - public/favicon.ico                 (PNG-embedded 16/32/48 frames)
 *   - public/images/logo.png             (512x512, same as android-chrome-512)
 *
 * Run with: npm run icons
 */
import sharp from 'sharp';
import {readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const SVG = readFileSync(path.join(ROOT, 'src', 'icons', 'jetexir.svg'));

// jetexir.svg viewBox: 611.12 x 942.2
const SVG_W = 611.12;
const SVG_H = 942.2;

/** Fraction of the canvas height the mark should occupy. */
const MARK_FILL = 0.84;

/**
 * Render the mark at `canvasSize` px, scaled so it spans MARK_FILL of the
 * canvas height. Returns the PNG buffer plus the mark's canvas dimensions.
 */
async function renderMark(canvasSize) {
    const h = Math.round(canvasSize * MARK_FILL);
    const w = Math.round((h * SVG_W) / SVG_H);
    const png = await sharp(SVG, {density: 300}).resize(w, h).png().toBuffer();
    return {png, w, h};
}

/** Composite the mark centered onto a `size`x`size` canvas. */
async function makeIcon(size, {background = null, grayscale = false} = {}) {
    const {png, w, h} = await renderMark(size);
    let layer = png;
    if (grayscale) {
        layer = await sharp(layer).grayscale().png().toBuffer();
    }
    const bg = background ?? {r: 0, g: 0, b: 0, alpha: 0};
    return sharp({create: {width: size, height: size, channels: 4, background: bg}})
        .composite([{input: layer, left: Math.round((size - w) / 2), top: Math.round((size - h) / 2)}])
        .png()
        .toBuffer();
}

/**
 * Assemble PNG-embedded ICO (favicon.ico). Modern browsers accept PNG frames
 * inside ICO; each entry is a standard PNG with the size recorded in the dir.
 */
function makeIco(entries) {
    const header = Buffer.alloc(6);
    header.writeUInt16LE(0, 0); // reserved
    header.writeUInt16LE(1, 2); // type: icon
    header.writeUInt16LE(entries.length, 4);

    const dirs = [];
    const blobs = [];
    let offset = 6 + entries.length * 16;
    for (const {size, png} of entries) {
        const dir = Buffer.alloc(16);
        dir[0] = size >= 256 ? 0 : size; // width
        dir[1] = size >= 256 ? 0 : size; // height
        dir[2] = 0; // palette
        dir[3] = 0; // reserved
        dir.writeUInt16LE(1, 4);  // color planes
        dir.writeUInt16LE(32, 6); // bits per pixel
        dir.writeUInt32LE(png.length, 8);
        dir.writeUInt32LE(offset, 12);
        offset += png.length;
        dirs.push(dir);
        blobs.push(png);
    }
    return Buffer.concat([header, ...dirs, ...blobs]);
}

const jobs = [
    ['android-chrome-192x192.png', 192, {}],
    ['android-chrome-512x512.png', 512, {}],
    ['favicon-16x16.png', 16, {}],
    ['favicon-32x32.png', 32, {}],
    ['favicon-16x16-inactive.png', 16, {grayscale: true}],
    ['favicon-32x32-inactive.png', 32, {grayscale: true}],
    ['apple-touch-icon.png', 180, {background: {r: 255, g: 255, b: 255, alpha: 1}}],
];

for (const [name, size, opts] of jobs) {
    const out = path.join(PUBLIC, name);
    const png = await makeIcon(size, opts);
    writeFileSync(out, png);
    console.log(`✓ ${out}  ${size}x${size}  ${(png.length / 1024).toFixed(1)} KB`);
}

// favicon.ico: PNG-embedded 16/32/48 frames (full canvas, not just the mark)
const icoFrames = [];
for (const size of [16, 32, 48]) {
    icoFrames.push({size, png: await makeIcon(size)});
}
const ico = makeIco(icoFrames);
writeFileSync(path.join(PUBLIC, 'favicon.ico'), ico);
console.log(`✓ ${path.join(PUBLIC, 'favicon.ico')}  (16/32/48)  ${(ico.length / 1024).toFixed(1)} KB`);

// logo.png: same art as android-chrome-512x512.png
const logo = await makeIcon(512);
writeFileSync(path.join(ROOT, 'public', 'images', 'logo.png'), logo);
console.log(`✓ ${path.join(ROOT, 'public', 'images', 'logo.png')}  512x512  ${(logo.length / 1024).toFixed(1)} KB`);

console.log('\nAll icons regenerated from src/icons/jetexir.svg.');
