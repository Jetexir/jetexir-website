/**
 * Generate featured images for addon and blog pages.
 *
 * Style: playful hand-drawn editorial illustration in the spirit of Fly.io's
 * connector/agent artwork. Wobbly dark-ink outlines, a two-tone lavender/cyan palette, rough risograph
 * texture, and the real Jetexir SVG mark used as the mascot body. Minimal
 * compositions, isolated subjects, generous negative space, no text, transparent
 * background.
 *
 * Output: public/images/featured/<id>.webp (1600x900, transparent) for every
 * addon in src/content/addons/*.md and every published post in
 * src/content/blog/*.md.
 *
 * Run with: npm run featured:images
 */
import sharp from 'sharp';
import {mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ADDONS_DIR = path.join(ROOT, 'src', 'content', 'addons');
const BLOG_DIR = path.join(ROOT, 'src', 'content', 'blog');
const OUT_DIR = path.join(ROOT, 'public', 'images', 'featured');
const LOGO_FILE = path.join(ROOT, 'src', 'icons', 'jetexir.svg');

// ---- Palette (hand-drawn riso: ink + lavender + cyan) ----
const INK = '#251D38';
const PURPLE = '#720EEC';
const LAVENDER = '#9B70D8';
const PALE_LAV = '#E7DDF5';
const PAPER = '#FCFAFF';
const CYAN = '#55C1D3';
const PALE_CYAN = '#D8F0F3';
const DEEP = '#4A347A';

const W = 1600;
const H = 900;

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------

function mulberry32(seed) {
    let t = seed >>> 0;
    return function () {
        t = (t + 0x6d2b79f5) >>> 0;
        let r = Math.imul(t ^ (t >>> 15), t | 1);
        r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

function hashStr(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

// ---------------------------------------------------------------------------
// Point generators (wobbly, organic)
// ---------------------------------------------------------------------------

function wobble(pts, rnd, amp) {
    return pts.map(([x, y]) => [x + (rnd() - 0.5) * 2 * amp, y + (rnd() - 0.5) * 2 * amp]);
}

function circlePts(cx, cy, r, {n = 36, amp = 0.05, seed = 1} = {}) {
    const rnd = mulberry32(seed);
    const pts = [];
    for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rr = r * (1 + (rnd() - 0.5) * 2 * amp);
        pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    return pts;
}

function rrectPts(x, y, w, h, r, {seed = 1, amp = 6} = {}) {
    const rnd = mulberry32(seed);
    const k = Math.min(r, w / 2, h / 2);
    const pts = [];
    const arc = (ax, ay, a0, a1) => {
        const N = Math.max(3, Math.round((k * Math.abs(a1 - a0)) / 14));
        for (let i = 0; i <= N; i++) {
            const a = a0 + (a1 - a0) * (i / N);
            pts.push([ax + Math.cos(a) * k, ay + Math.sin(a) * k]);
        }
    };
    const edge = (len) => Math.max(2, Math.round(len / 26));
    arc(x + k, y + k, Math.PI, Math.PI * 1.5); // top-left
    const nT = edge(w - 2 * k);
    for (let i = 1; i < nT; i++) pts.push([x + k + ((w - 2 * k) * i) / nT, y]);
    arc(x + w - k, y + k, Math.PI * 1.5, Math.PI * 2); // top-right
    const nR = edge(h - 2 * k);
    for (let i = 1; i < nR; i++) pts.push([x + w, y + k + ((h - 2 * k) * i) / nR]);
    arc(x + w - k, y + h - k, 0, Math.PI / 2); // bottom-right
    const nB = edge(w - 2 * k);
    for (let i = 1; i < nB; i++) pts.push([x + w - k - ((w - 2 * k) * i) / nB, y + h]);
    arc(x + k, y + h - k, Math.PI / 2, Math.PI); // bottom-left
    const nL = edge(h - 2 * k);
    for (let i = 1; i < nL; i++) pts.push([x, y + h - k - ((h - 2 * k) * i) / nL]);
    return wobble(pts, rnd, amp);
}

function quadPts(p0, p1, p2, {n = 20, seed = 1, amp = 4} = {}) {
    const rnd = mulberry32(seed);
    const pts = [];
    for (let i = 0; i <= n; i++) {
        const t = i / n;
        const u = 1 - t;
        pts.push([
            u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
            u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
        ]);
    }
    return wobble(pts, rnd, amp);
}

function linePts(x1, y1, x2, y2, {n = 10, seed = 1, amp = 3} = {}) {
    const rnd = mulberry32(seed);
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const pts = [];
    for (let i = 0; i <= n; i++) {
        const t = i / n;
        const off = (rnd() - 0.5) * 2 * amp;
        pts.push([x1 + dx * t + nx * off, y1 + dy * t + ny * off]);
    }
    return pts;
}

function wavePts(x1, y1, x2, y2, a, {n = 16, seed = 1, amp = 3} = {}) {
    const rnd = mulberry32(seed);
    const pts = [];
    for (let i = 0; i <= n; i++) {
        const t = i / n;
        pts.push([
            x1 + (x2 - x1) * t + (rnd() - 0.5) * 2 * amp,
            y1 + (y2 - y1) * t + Math.sin(t * Math.PI * 3) * a + (rnd() - 0.5) * 2 * amp,
        ]);
    }
    return pts;
}

function arcPts(cx, cy, r, a0, a1, {n = 12, seed = 1, amp = 3} = {}) {
    const rnd = mulberry32(seed);
    const pts = [];
    for (let i = 0; i <= n; i++) {
        const a = a0 + (a1 - a0) * (i / n);
        const rr = r + (rnd() - 0.5) * 2 * amp;
        pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    return pts;
}

function starPts(cx, cy, R, {n = 4, r = 0.42, seed = 1, amp = 6} = {}) {
    const rnd = mulberry32(seed);
    const pts = [];
    const spikes = n * 2;
    for (let i = 0; i < spikes; i++) {
        const a = (i / spikes) * Math.PI * 2 - Math.PI / 2;
        const rad = i % 2 === 0 ? R : R * r;
        pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
    }
    return wobble(pts, rnd, amp);
}

function heartPts(cx, cy, s, seed = 1) {
    const b = s * 0.6, w = s * 0.55;
    const cubic = (P0, P1, P2, P3, t) => {
        const u = 1 - t;
        return [
            u * u * u * P0[0] + 3 * u * u * t * P1[0] + 3 * u * t * t * P2[0] + t * t * t * P3[0],
            u * u * u * P0[1] + 3 * u * u * t * P1[1] + 3 * u * t * t * P2[1] + t * t * t * P3[1],
        ];
    };
    const p0 = [cx, cy + b], p1 = [cx - w, cy + b * 0.1], p2 = [cx - w * 0.6, cy - b * 0.75], p3 = [cx, cy - b * 0.28];
    const q1 = [cx + w * 0.6, cy - b * 0.75], q2 = [cx + w, cy + b * 0.1];
    const pts = [];
    for (let i = 0; i <= 14; i++) pts.push(cubic(p0, p1, p2, p3, i / 14));
    for (let i = 1; i < 14; i++) pts.push(cubic(p3, q1, q2, p0, i / 14));
    return wobble(pts, mulberry32(seed), 4);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function buildD(pts, close = true) {
    let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i][0].toFixed(1)} ${pts[i][1].toFixed(1)}`;
    if (close) d += ' Z';
    return d;
}

function renderPath(pts, {fill = 'none', stroke = INK, sw = 10, opacity = 1, close = true, dash = null, sh = false, shDx = 7, shDy = 12, shOpacity = 0.12} = {}) {
    const d = buildD(pts, close);
    let out = '';
    if (sh && fill !== 'none') {
        out += `<path d="${d}" fill="${DEEP}" opacity="${shOpacity}" transform="translate(${shDx} ${shDy})"/>`;
    }
    out += `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
    return out;
}

// ---------------------------------------------------------------------------
// Paper grain + pigment flecks (risograph texture)
// ---------------------------------------------------------------------------

function grainFilter(id, seed = 7) {
    // Keep the grain inside the alpha of the artwork. Never paint a full
    // canvas texture because the final WebP is intentionally transparent.
    return `<filter id="${id}" x="-8%" y="-8%" width="116%" height="116%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.72" numOctaves="2" seed="${seed}" stitchTiles="stitch" result="noise"/>
        <feColorMatrix in="noise" type="saturate" values="0" result="mono"/>
        <feComponentTransfer in="mono" result="grainAlpha">
            <feFuncA type="table" tableValues="0 0.20"/>
        </feComponentTransfer>
        <feComposite in="grainAlpha" in2="SourceAlpha" operator="in" result="grain"/>
        <feBlend in="SourceGraphic" in2="grain" mode="multiply"/>
    </filter>`;
}

// ---------------------------------------------------------------------------
// Jetexir character — original SVG cartoon mascot
// ---------------------------------------------------------------------------
// The Fly.io references work because the characters are NOT perfect logos or
// generic blobs. They are simple illustrated creatures with a strong silhouette,
// oversized faces, tiny limbs, expressive poses and a few imperfect details.
// Keep the character as SVG so it remains crisp and deterministic.

const CHARACTER_BODY = `
<path d="M 0,-190
    C -92,-188 -154,-126 -150,-42
    C -147,18 -126,63 -94,92
    C -66,118 -56,142 -70,170
    C -38,158 -17,147 2,155
    C 24,164 49,177 82,182
    C 67,151 73,126 101,94
    C 132,58 151,14 145,-47
    C 138,-132 86,-184 0,-190 Z"
    fill="${PURPLE}" stroke="${INK}" stroke-width="12"
    stroke-linecap="round" stroke-linejoin="round"/>
<!-- soft printed highlight -->
<path d="M -57,-133 C -86,-88 -82,-29 -60,11 C -42,43 -43,77 -57,103"
    fill="none" stroke="#B99BFF" stroke-width="24" opacity=".48"
    stroke-linecap="round"/>
<!-- belly patch -->
<path d="M -51,64 C -27,48 25,49 51,67 C 63,84 54,112 30,126
         C 2,141 -36,132 -49,110 C -59,94 -62,76 -51,64 Z"
    fill="${PALE_LAV}" stroke="${INK}" stroke-width="8"/>
<!-- tiny Jetexir flame mark -->
<path d="M 0,68 C -13,82 -12,99 2,106 C 16,98 17,82 0,68 Z"
    fill="${CYAN}" stroke="${INK}" stroke-width="5"/>
`;

function hand({x, y, flip = 1}) {
    return `<g transform="translate(${x} ${y}) scale(${flip} 1)">
        <path d="M 0,0 C 10,-7 22,-7 28,1 C 34,10 29,18 20,19
                 C 28,24 24,32 16,31 C 9,30 5,24 1,19
                 C -7,15 -9,7 0,0 Z"
              fill="${PALE_CYAN}" stroke="${INK}" stroke-width="8"
              stroke-linejoin="round"/>
    </g>`;
}

function character({
                       cx,
                       cy,
                       s = 1,
                       seed = 1,
                       pose = 'happy',
                       rotate = 0,
                       mirror = false,
                   } = {}) {
    const scale = Math.abs(s) <= 3 ? s : s / 420;
    const sx = mirror ? -scale : scale;
    const eyeY = -48;
    const eyeGap = 42;

    let eyes;
    let mouth;
    let brows = '';

    if (pose === 'wow') {
        eyes = `
            <ellipse cx="${-eyeGap}" cy="${eyeY}" rx="25" ry="32" fill="${PALE_CYAN}" stroke="${INK}" stroke-width="9"/>
            <ellipse cx="${eyeGap}" cy="${eyeY}" rx="25" ry="32" fill="${PALE_CYAN}" stroke="${INK}" stroke-width="9"/>
            <circle cx="${-eyeGap + 3}" cy="${eyeY + 5}" r="11" fill="${INK}"/>
            <circle cx="${eyeGap + 3}" cy="${eyeY + 5}" r="11" fill="${INK}"/>`;
        mouth = `<ellipse cx="0" cy="5" rx="25" ry="34" fill="${INK}"/>`;
    } else if (pose === 'curious') {
        eyes = `
            <ellipse cx="${-eyeGap}" cy="${eyeY}" rx="24" ry="30" fill="${PALE_CYAN}" stroke="${INK}" stroke-width="9"/>
            <ellipse cx="${eyeGap + 4}" cy="${eyeY - 9}" rx="28" ry="34" fill="${PALE_CYAN}" stroke="${INK}" stroke-width="9"/>
            <circle cx="${-eyeGap + 4}" cy="${eyeY - 2}" r="10" fill="${INK}"/>
            <circle cx="${eyeGap + 10}" cy="${eyeY - 14}" r="12" fill="${INK}"/>`;
        brows = `<path d="M -69,-87 Q -42,-104 -20,-92 M 17,-99 Q 45,-113 70,-91"
            fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>`;
        mouth = `<path d="M -18,9 Q 4,22 25,4" fill="none" stroke="${INK}" stroke-width="8" stroke-linecap="round"/>`;
    } else {
        eyes = `
            <ellipse cx="${-eyeGap}" cy="${eyeY}" rx="24" ry="30" fill="${PALE_CYAN}" stroke="${INK}" stroke-width="9"/>
            <ellipse cx="${eyeGap}" cy="${eyeY}" rx="24" ry="30" fill="${PALE_CYAN}" stroke="${INK}" stroke-width="9"/>
            <circle cx="${-eyeGap + 5}" cy="${eyeY + 3}" r="10" fill="${INK}"/>
            <circle cx="${eyeGap + 5}" cy="${eyeY + 3}" r="10" fill="${INK}"/>`;
        mouth = `<path d="M -25,8 Q 0,31 27,5" fill="none" stroke="${INK}" stroke-width="9" stroke-linecap="round"/>`;
    }

    const armL = pose === 'wave'
        ? `<path d="M -120,40 Q -183,-6 -175,-70" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round"/>
           ${hand(-176, -72, -1)}`
        : `<path d="M -112,35 Q -174,73 -164,119" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round"/>
           ${hand(-165, 116, -1)}`;

    const armR = pose === 'point'
        ? `<path d="M 111,35 Q 170,-4 191,-42" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round"/>
           <path d="M 184,-47 L 220,-58" stroke="${INK}" stroke-width="11" stroke-linecap="round"/>
           ${hand(188, -45, 1)}`
        : `<path d="M 112,35 Q 174,70 165,118" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round"/>
           ${hand(164, 115, 1)}`;

    const feet = `
        <path d="M -58,159 Q -70,214 -105,225 Q -125,231 -128,214 Q -127,198 -98,183 L -70,153 Z"
              fill="${PALE_CYAN}" stroke="${INK}" stroke-width="10" stroke-linejoin="round"/>
        <path d="M 53,164 Q 68,211 105,223 Q 126,229 128,212 Q 127,195 96,180 L 69,153 Z"
              fill="${PALE_CYAN}" stroke="${INK}" stroke-width="10" stroke-linejoin="round"/>`;

    const cheek = `<circle cx="-69" cy="7" r="8" fill="${CYAN}" opacity=".85"/>
                   <circle cx="69" cy="7" r="8" fill="${CYAN}" opacity=".85"/>`;

    return `<g transform="translate(${cx} ${cy}) rotate(${rotate}) scale(${sx})">
        ${feet}
        ${armL}${armR}
        ${CHARACTER_BODY}
        ${brows}
        ${eyes}
        ${cheek}
        ${mouth}
    </g>`;
}

// Backwards-compatible name used by the scene definitions.
function mascot(opts = {}) {
    return character(opts);
}

// ---------------------------------------------------------------------------
// Props (hand-drawn)
// ---------------------------------------------------------------------------

function sparkle({cx, cy, R = 30, seed = 1, fill = PALE_LAV} = {}) {
    return renderPath(starPts(cx, cy, R, {seed, amp: 5}), {fill, sw: 7});
}

function motionLines({x1, x2, y, n = 4, seed = 1} = {}) {
    let out = '';
    for (let i = 0; i < n; i++) {
        const yy = y - i * 26;
        out += renderPath(linePts(x1 + i * ((x2 - x1) / n), yy, x1 + i * ((x2 - x1) / n) + 44 + i * 14, yy, {seed: seed + i, amp: 3}), {stroke: INK, sw: 8});
    }
    return out;
}

function propMegaphone({cx, cy, s = 360, seed = 101} = {}) {
    const h = s * 0.62;
    const yTop = cy - h / 2, yBot = cy + h / 2;
    const rightX = cx + s / 2, leftX = cx - s / 2;
    const bellW = s * 0.5, mouthW = s * 0.2;
    const rnd = mulberry32(seed);
    const pts = [
        [rightX, yTop + h * 0.2],
        [leftX + bellW * 0.55, yTop],
        [leftX, cy - bellW * 0.28],
        [leftX, cy + bellW * 0.28],
        [leftX + bellW * 0.55, yBot],
        [rightX, yBot - h * 0.2],
    ];
    const bell = renderPath(wobble(pts, rnd, 7), {fill: PALE_CYAN, sw: 11, sh: true});
    const handle = renderPath(quadPts([rightX - 8, yTop + h * 0.2 + 10], [rightX + s * 0.16, cy], [rightX - 8, yBot - h * 0.2 - 10], {seed: seed + 1, amp: 4}), {stroke: INK, sw: 10});
    let arcs = '';
    for (let i = 0; i < 3; i++) {
        const ax = leftX - s * 0.13 - i * s * 0.17;
        arcs += renderPath(arcPts(ax, cy, s * 0.10 + i * s * 0.05, -0.9, 0.9, {seed: seed + 2 + i, amp: 4}), {stroke: INK, sw: 8});
    }
    return `${bell}${handle}${arcs}`;
}

function propPhone({cx, cy, s = 360, seed = 102} = {}) {
    const w = s * 0.56, h = s * 1.0;
    const body = renderPath(rrectPts(cx - w / 2, cy - h / 2, w, h, w * 0.18, {seed, amp: 6}), {fill: PALE_LAV, sw: 11, sh: true});
    const screen = renderPath(rrectPts(cx - w / 2 + w * 0.11, cy - h / 2 + h * 0.13, w * 0.78, h * 0.6, w * 0.1, {seed: seed + 1, amp: 4}), {fill: PALE_CYAN, sw: 7});
    const home = renderPath(circlePts(cx, cy + h * 0.42, w * 0.05, {seed: seed + 2, amp: 0.2, n: 12}), {stroke: INK, sw: 6});
    let arcs = '';
    for (let i = 0; i < 3; i++) {
        const ax = cx - w * 0.62 - i * w * 0.24;
        arcs += renderPath(arcPts(ax, cy - h * 0.28, w * 0.2 + i * w * 0.08, -1.1, -0.2, {seed: seed + 3 + i, amp: 3}), {stroke: INK, sw: 8});
    }
    return `${body}${screen}${home}${arcs}`;
}

function propForm({cx, cy, w = 420, h = 500, seed = 103} = {}) {
    const card = renderPath(rrectPts(cx - w / 2, cy - h / 2, w, h, 34, {seed, amp: 6}), {fill: PAPER, sw: 12, sh: true});
    const title = renderPath(wavePts(cx - w * 0.3, cy - h * 0.34, cx + w * 0.1, cy - h * 0.34, 0, {seed: seed + 1, amp: 2}), {stroke: INK, sw: 9});
    let fields = '';
    for (let i = 0; i < 3; i++) {
        const fy = cy - h * 0.12 + i * h * 0.16;
        fields += renderPath(rrectPts(cx - w * 0.36, fy - 26, w * 0.72, 52, 16, {seed: seed + 2 + i, amp: 4}), {stroke: INK, sw: 8});
        fields += renderPath(linePts(cx - w * 0.28, fy, cx + w * 0.22, fy, {seed: seed + 6 + i, amp: 3}), {stroke: INK, sw: 7, dash: i === 2 ? '12 18' : null});
    }
    const btn = renderPath(rrectPts(cx - w * 0.3, cy + h * 0.28, w * 0.6, 64, 20, {seed: seed + 9, amp: 5}), {fill: PURPLE, sw: 10, sh: true});
    const btnLine = renderPath(wavePts(cx - w * 0.14, cy + h * 0.28, cx + w * 0.14, cy + h * 0.28, 0, {seed: seed + 10, amp: 2}), {stroke: PALE_LAV, sw: 8});
    return `${card}${title}${fields}${btn}${btnLine}`;
}

function propCoin({cx, cy, r = 90, seed = 104, glyph = '$', fill = PALE_LAV} = {}) {
    const coin = renderPath(circlePts(cx, cy, r, {seed, amp: 0.05, n: 36}), {fill, sw: 11, sh: true});
    const inner = renderPath(circlePts(cx, cy, r * 0.78, {seed: seed + 1, amp: 0.07, n: 30}), {stroke: INK, sw: 7});
    let g = '';
    if (glyph === '$') {
        g = renderPath(quadPts([cx - r * 0.16, cy - r * 0.55], [cx + r * 0.22, cy - r * 0.2], [cx - r * 0.22, cy + r * 0.15], {seed: seed + 2, amp: 3}), {stroke: INK, sw: 9})
            + renderPath(quadPts([cx - r * 0.22, cy + r * 0.15], [cx + r * 0.22, cy + r * 0.52], [cx - r * 0.16, cy + r * 0.58], {seed: seed + 3, amp: 3}), {stroke: INK, sw: 9})
            + renderPath(linePts(cx - r * 0.12, cy - r * 0.66, cx + r * 0.12, cy - r * 0.58, {seed: seed + 4, amp: 2}), {stroke: INK, sw: 8})
            + renderPath(linePts(cx - r * 0.12, cy + r * 0.66, cx + r * 0.12, cy + r * 0.58, {seed: seed + 5, amp: 2}), {stroke: INK, sw: 8});
    } else if (glyph === '€') {
        g = renderPath(linePts(cx - r * 0.4, cy, cx + r * 0.4, cy, {seed: seed + 2, amp: 2}), {stroke: INK, sw: 9})
            + renderPath(quadPts([cx + r * 0.16, cy - r * 0.42], [cx - r * 0.28, cy - r * 0.14], [cx - r * 0.3, cy], {seed: seed + 3, amp: 3}), {stroke: INK, sw: 9})
            + renderPath(quadPts([cx - r * 0.3, cy], [cx - r * 0.28, cy + r * 0.14], [cx + r * 0.16, cy + r * 0.42], {seed: seed + 4, amp: 3}), {stroke: INK, sw: 9})
            + renderPath(linePts(cx - r * 0.22, cy - r * 0.16, cx + r * 0.3, cy - r * 0.16, {seed: seed + 5, amp: 2}), {stroke: INK, sw: 7});
    } else if (glyph === '£') {
        g = renderPath(quadPts([cx + r * 0.1, cy - r * 0.62], [cx + r * 0.38, cy - r * 0.3], [cx + r * 0.1, cy - r * 0.16], {seed: seed + 2, amp: 3}), {stroke: INK, sw: 9})
            + renderPath(linePts(cx - r * 0.34, cy - r * 0.12, cx + r * 0.3, cy - r * 0.12, {seed: seed + 3, amp: 2}), {stroke: INK, sw: 9})
            + renderPath(quadPts([cx - r * 0.34, cy - r * 0.1], [cx + r * 0.2, cy + r * 0.1], [cx - r * 0.2, cy + r * 0.34], {seed: seed + 4, amp: 3}), {stroke: INK, sw: 9})
            + renderPath(linePts(cx - r * 0.26, cy + r * 0.3, cx + r * 0.26, cy + r * 0.34, {seed: seed + 5, amp: 2}), {stroke: INK, sw: 9});
    }
    return `${coin}${inner}${g}`;
}

function propTag({cx, cy, w = 230, seed = 105, dot = CYAN} = {}) {
    const pill = renderPath(rrectPts(cx - w / 2, cy - 34, w, 68, 30, {seed, amp: 5}), {fill: PAPER, sw: 9, sh: true});
    const d = renderPath(circlePts(cx - w / 2 + 40, cy, 12, {seed: seed + 1, amp: 0.2, n: 14}), {fill: dot, sw: 5});
    const l1 = renderPath(wavePts(cx - w / 2 + 70, cy - 6, cx + w / 2 - 24, cy - 6, 0, {seed: seed + 2, amp: 2}), {stroke: INK, sw: 7});
    const l2 = renderPath(wavePts(cx - w / 2 + 70, cy + 14, cx + w / 2 - 40, cy + 14, 0, {seed: seed + 3, amp: 2}), {stroke: INK, sw: 7});
    return `${pill}${d}${l1}${l2}`;
}

function propQuestion({cx, cy, s = 300, seed = 106} = {}) {
    const r = s * 0.36;
    const top = renderPath(arcPts(cx, cy - r * 0.15, r, -0.4, Math.PI * 0.72, {seed: seed + 1, amp: 4}), {stroke: INK, sw: s * 0.15});
    const stem = renderPath(quadPts([cx - r * 0.9, cy + r * 0.55], [cx - r * 0.2, cy + r * 0.95], [cx - r * 0.1, cy + r * 1.05], {seed: seed + 2, amp: 4}), {stroke: INK, sw: s * 0.15});
    const dot = renderPath(circlePts(cx - r * 0.1, cy + r * 1.28, r * 0.13, {seed: seed + 3, amp: 0.2, n: 12}), {fill: INK});
    return `${top}${stem}${dot}`;
}

function propBubble({cx, cy, w = 320, h = 210, seed = 107, fill = PAPER, tail = 'bottom'} = {}) {
    const b = renderPath(rrectPts(cx - w / 2, cy - h / 2, w, h, h / 2, {seed, amp: 6}), {fill, sw: 11, sh: true});
    let t = '';
    if (tail === 'bottom') {
        const tri = [...linePts(cx - 32, cy + h / 2 - 8, cx, cy + h / 2 + 36, {seed: seed + 1, amp: 4}), ...linePts(cx, cy + h / 2 + 36, cx + 32, cy + h / 2 - 8, {seed: seed + 2, amp: 4})];
        t = renderPath(tri, {fill, sw: 10});
    }
    return `${b}${t}`;
}

function propCart({cx, cy, s = 340, seed = 108, fill = PALE_CYAN, contents = false} = {}) {
    const w = s * 0.86, h = s * 0.7;
    const yTop = cy - h / 2, yBot = cy + h / 2;
    const topW = w, botW = w * 0.74;
    const rnd = mulberry32(seed);
    const basket = renderPath(wobble([
        [cx - topW / 2, yTop],
        [cx + topW / 2, yTop],
        [cx + botW / 2, yBot],
        [cx - botW / 2, yBot],
    ], rnd, 7), {fill, sw: 11, sh: true});
    const handle = renderPath(quadPts([cx - topW * 0.42, yTop], [cx, yTop - s * 0.34], [cx + topW * 0.42, yTop], {seed: seed + 1, amp: 5}), {stroke: INK, sw: 10});
    const wl = renderPath(circlePts(cx - topW * 0.3, yBot + 12, s * 0.075, {seed: seed + 2, amp: 0.15, n: 16}), {stroke: INK, sw: 7});
    const wr = renderPath(circlePts(cx + topW * 0.3, yBot + 12, s * 0.075, {seed: seed + 3, amp: 0.15, n: 16}), {stroke: INK, sw: 7});
    let extra = '';
    if (contents) {
        extra = renderPath(rrectPts(cx - w * 0.16, yTop + 30, w * 0.32, h * 0.42, 12, {seed: seed + 4, amp: 4}), {fill: PURPLE, sw: 8, sh: true})
            + renderPath(linePts(cx - w * 0.14, yBot - 26, cx + w * 0.14, yBot - 26, {seed: seed + 5, amp: 3}), {stroke: INK, sw: 7});
    }
    return `${handle}${basket}${extra}${wl}${wr}`;
}

function propTicket({cx, cy, w = 420, h = 300, seed = 109} = {}) {
    const body = renderPath(rrectPts(cx - w / 2, cy - h / 2, w, h, 26, {seed, amp: 6}), {fill: PAPER, sw: 11, sh: true});
    const perfo = renderPath(linePts(cx - w / 2 + 30, cy, cx + w / 2 - 30, cy, {seed: seed + 1, amp: 2}), {stroke: INK, sw: 6, dash: '14 18'});
    const n1 = renderPath(circlePts(cx - w / 2, cy, 18, {seed: seed + 2, amp: 0.2, n: 14}), {fill: CYAN, sw: 6});
    const n2 = renderPath(circlePts(cx + w / 2, cy, 18, {seed: seed + 3, amp: 0.2, n: 14}), {fill: CYAN, sw: 6});
    let bars = '';
    for (let i = 0; i < 9; i++) {
        const bx = cx - w * 0.3 + i * w * 0.068;
        const bh = h * 0.16 + (i % 3) * h * 0.05;
        bars += renderPath(linePts(bx, cy - h * 0.32, bx, cy - h * 0.32 + bh, {seed: seed + 4 + i, amp: 2}), {stroke: INK, sw: 7});
    }
    const stub = renderPath(wavePts(cx - w * 0.32, cy + h * 0.3, cx + w * 0.32, cy + h * 0.3, 0, {seed: seed + 13, amp: 2}), {stroke: INK, sw: 7});
    return `${body}${perfo}${n1}${n2}${bars}${stub}`;
}

function propPriceTag({cx, cy, s = 240, seed = 110, fill = PALE_LAV} = {}) {
    const w = s * 0.9, h = s * 1.15;
    const rnd = mulberry32(seed);
    const body = renderPath(wobble([
        [cx - w / 2 + w * 0.16, cy - h / 2],
        [cx + w / 2, cy - h / 2],
        [cx + w / 2, cy + h / 2],
        [cx - w / 2 + w * 0.16, cy + h / 2],
        [cx - w / 2, cy],
    ], rnd, 6), {fill, sw: 11, sh: true});
    const hole = renderPath(circlePts(cx - w * 0.28, cy - h * 0.3, w * 0.11, {seed: seed + 1, amp: 0.2, n: 14}), {stroke: INK, sw: 7});
    const l1 = renderPath(wavePts(cx - w * 0.12, cy - h * 0.05, cx + w * 0.26, cy - h * 0.05, 10, {seed: seed + 2, amp: 3}), {stroke: INK, sw: 8});
    const l2 = renderPath(wavePts(cx - w * 0.12, cy + h * 0.1, cx + w * 0.18, cy + h * 0.1, 8, {seed: seed + 3, amp: 3}), {stroke: INK, sw: 8});
    return `${body}${hole}${l1}${l2}`;
}

function propCompare({cxL, cxR, cy, s = 380, seed = 111} = {}) {
    const w = s * 0.5, h = s * 0.72;
    const boxA = renderPath(rrectPts(cxL - w / 2, cy - h / 2, w, h, 24, {seed, amp: 6}), {fill: PALE_LAV, sw: 11, sh: true});
    const boxB = renderPath(rrectPts(cxR - w / 2, cy - h / 2, w, h, 24, {seed: seed + 1, amp: 6}), {fill: PALE_CYAN, sw: 11, sh: true});
    const lA = renderPath(wavePts(cxL - w * 0.28, cy - h * 0.1, cxL + w * 0.28, cy - h * 0.1, 0, {seed: seed + 2, amp: 2}), {stroke: INK, sw: 8});
    const lB = renderPath(wavePts(cxR - w * 0.28, cy - h * 0.1, cxR + w * 0.28, cy - h * 0.1, 0, {seed: seed + 3, amp: 2}), {stroke: INK, sw: 8});
    const mid = (cxL + cxR) / 2;
    const burst = renderPath(starPts(mid, cy - h * 0.12, 46, {seed: seed + 4, amp: 6}), {fill: PURPLE, sw: 8});
    const chk = renderPath([...linePts(mid - s * 0.26, cy + h * 0.42, mid - s * 0.2, cy + h * 0.5, {seed: seed + 5, amp: 2}), ...linePts(mid - s * 0.2, cy + h * 0.5, mid - s * 0.06, cy + h * 0.34, {seed: seed + 6, amp: 2})], {stroke: INK, sw: 9});
    const x1 = renderPath(linePts(mid + s * 0.06, cy + h * 0.36, mid + s * 0.2, cy + h * 0.52, {seed: seed + 7, amp: 2}), {stroke: INK, sw: 9});
    const x2 = renderPath(linePts(mid + s * 0.2, cy + h * 0.36, mid + s * 0.06, cy + h * 0.52, {seed: seed + 8, amp: 2}), {stroke: INK, sw: 9});
    return `${boxA}${boxB}${lA}${lB}${burst}${chk}${x1}${x2}`;
}

function propStepper({cx, cy, w = 460, seed = 112} = {}) {
    const h = 150;
    const bar = renderPath(rrectPts(cx - w / 2, cy - h / 2, w, h, h / 2, {seed, amp: 6}), {fill: PAPER, sw: 11, sh: true});
    const minus = renderPath(circlePts(cx - w * 0.3, cy, h * 0.42, {seed: seed + 1, amp: 0.12, n: 20}), {fill: PALE_CYAN, sw: 9})
        + renderPath(linePts(cx - w * 0.44, cy, cx - w * 0.16, cy, {seed: seed + 2, amp: 3}), {stroke: INK, sw: 10});
    let dots = '';
    for (let i = 0; i < 3; i++) {
        dots += `<circle cx="${(cx - w * 0.06 + i * w * 0.06).toFixed(1)}" cy="${cy.toFixed(1)}" r="13" fill="${INK}"/>`;
    }
    const plus = renderPath(circlePts(cx + w * 0.3, cy, h * 0.42, {seed: seed + 3, amp: 0.12, n: 20}), {fill: PURPLE, sw: 9})
        + renderPath(linePts(cx + w * 0.16, cy, cx + w * 0.44, cy, {seed: seed + 4, amp: 3}), {stroke: PALE_LAV, sw: 10})
        + renderPath(linePts(cx + w * 0.3, cy - h * 0.14, cx + w * 0.3, cy + h * 0.14, {seed: seed + 5, amp: 3}), {stroke: PALE_LAV, sw: 10});
    return `${bar}${minus}${dots}${plus}`;
}

function propCard({cx, cy, w = 190, h = 210, seed = 113, fill = PALE_LAV, feat = false} = {}) {
    const body = renderPath(rrectPts(cx - w / 2, cy - h / 2, w, h, 16, {seed, amp: 5}), {fill: feat ? PURPLE : fill, sw: 9, sh: true});
    const thumb = renderPath(rrectPts(cx - w * 0.24, cy - h * 0.22, w * 0.48, w * 0.48, 10, {seed: seed + 1, amp: 4}), {fill: feat ? PALE_LAV : PALE_CYAN, sw: 7});
    const l1 = renderPath(wavePts(cx - w * 0.3, cy + h * 0.14, cx + w * 0.3, cy + h * 0.14, 0, {seed: seed + 2, amp: 2}), {stroke: feat ? PALE_LAV : INK, sw: 6});
    const l2 = renderPath(wavePts(cx - w * 0.3, cy + h * 0.26, cx + w * 0.14, cy + h * 0.26, 0, {seed: seed + 3, amp: 2}), {stroke: feat ? PALE_LAV : INK, sw: 6, dash: '8 10'});
    return `${body}${thumb}${l1}${l2}`;
}

function propBadge({cx, cy, R = 150, seed = 114, fill = PALE_LAV} = {}) {
    const burst = renderPath(starPts(cx, cy, R, {n: 6, r: 0.55, seed, amp: 7}), {fill, sw: 11, sh: true});
    const inner = renderPath(circlePts(cx, cy, R * 0.5, {seed: seed + 1, amp: 0.08, n: 22}), {fill: PURPLE, sw: 8});
    const star = renderPath(starPts(cx, cy, R * 0.26, {n: 4, r: 0.4, seed: seed + 2, amp: 4}), {fill: PALE_LAV, sw: 6});
    return `${burst}${inner}${star}`;
}

function propProgress({cx, cy, w = 680, seed = 115} = {}) {
    const h = 110;
    const track = renderPath(rrectPts(cx - w / 2, cy - h / 2, w, h, h / 2, {seed, amp: 6}), {stroke: INK, sw: 11});
    const fill = renderPath(rrectPts(cx - w / 2 + 12, cy - h / 2 + 12, w * 0.72, h - 24, (h - 24) / 2, {seed: seed + 1, amp: 5}), {fill: PURPLE, sw: 8});
    const knob = renderPath(circlePts(cx - w / 2 + 12 + w * 0.72, cy, h * 0.42, {seed: seed + 2, amp: 0.08, n: 20}), {fill: CYAN, sw: 8, sh: true});
    let ticks = '';
    for (let i = 0; i < 5; i++) {
        ticks += renderPath(linePts(cx - w * 0.3 + i * w * 0.15, cy + h * 0.42, cx - w * 0.3 + i * w * 0.15, cy + h * 0.42 + 14, {seed: seed + 3 + i, amp: 2}), {stroke: INK, sw: 6});
    }
    return `${track}${fill}${knob}${ticks}`;
}

function propShare({cx, cy, r = 64, seed = 116, kind = 'heart', fill = PALE_LAV} = {}) {
    const c = renderPath(circlePts(cx, cy, r, {seed, amp: 0.09, n: 24}), {fill, sw: 10, sh: true});
    let g = '';
    if (kind === 'heart') {
        g = renderPath(heartPts(cx, cy, r * 0.9, seed + 1), {stroke: INK, sw: 7});
    } else if (kind === 'star') {
        g = renderPath(starPts(cx, cy, r * 0.62, {n: 4, r: 0.42, seed: seed + 1, amp: 4}), {fill: INK, sw: 5});
    } else if (kind === 'plane') {
        g = renderPath([...linePts(cx - r * 0.5, cy - r * 0.18, cx + r * 0.42, cy + r * 0.05, {seed: seed + 1, amp: 3}), ...linePts(cx + r * 0.42, cy + r * 0.05, cx - r * 0.5, cy + r * 0.3, {seed: seed + 2, amp: 3}), ...linePts(cx - r * 0.34, cy + r * 0.12, cx - r * 0.12, cy + r * 0.06, {seed: seed + 3, amp: 2})], {stroke: INK, sw: 7});
    }
    return `${c}${g}`;
}

function propHeart({cx, cy, s = 260, seed = 117, fill = PALE_LAV} = {}) {
    const body = renderPath(heartPts(cx, cy, s, seed), {fill, sw: 12, sh: true});
    const star = renderPath(starPts(cx, cy - s * 0.06, s * 0.22, {n: 4, r: 0.4, seed: seed + 1, amp: 4}), {fill: CYAN, sw: 6});
    return `${body}${star}`;
}

function propBanner({cx, cy, w = 540, h = 170, seed = 118} = {}) {
    const rnd = mulberry32(seed);
    const n = 22;
    const pts = [];
    for (let i = 0; i <= n; i++) {
        const t = i / n;
        pts.push([cx - w / 2 + w * t, cy - h / 2 + Math.sin(t * Math.PI * 2.2) * h * 0.1]);
    }
    pts.push([cx + w / 2, cy + h * 0.08]);
    pts.push([cx + w / 2 - w * 0.07, cy + h * 0.26]);
    pts.push([cx + w / 2, cy + h * 0.44]);
    for (let i = n; i >= 0; i--) {
        const t = i / n;
        pts.push([cx - w / 2 + w * t, cy + h / 2 + Math.sin(t * Math.PI * 2.2 + 0.7) * h * 0.1]);
    }
    const body = renderPath(wobble(pts, rnd, 5), {fill: PALE_CYAN, sw: 11, sh: true});
    const star = renderPath(starPts(cx - w * 0.04, cy, h * 0.3, {n: 4, r: 0.4, seed: seed + 1, amp: 5}), {fill: PURPLE, sw: 7});
    return `${body}${star}`;
}

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------

const SCENES = {
    'announcement-bar': (seed) => `
        ${propMegaphone({cx: 470, cy: 480, s: 420, seed: seed + 1})}
        ${character({cx: 1230, cy: 500, s: 1.05, seed: seed + 2, pose: 'wave', rotate: 5})}
        ${sparkle({cx: 280, cy: 210, R: 34, seed: seed + 3})}
        ${sparkle({cx: 1400, cy: 230, R: 26, seed: seed + 4, fill: PALE_CYAN})}
        ${sparkle({cx: 980, cy: 690, R: 22, seed: seed + 5})}
    `,

    'call-for-price': (seed) => `
        ${propPhone({cx: 470, cy: 470, s: 400, seed: seed + 1})}
        ${mascot({cx: 1230, cy: 510, s: 450, seed: seed + 2})}
        ${sparkle({cx: 240, cy: 200, R: 30, seed: seed + 3})}
        ${sparkle({cx: 1420, cy: 700, R: 30, seed: seed + 4, fill: PALE_CYAN})}
        ${sparkle({cx: 800, cy: 240, R: 20, seed: seed + 5})}
    `,

    'checkout-fields': (seed) => `
        ${propForm({cx: 470, cy: 470, seed: seed + 1})}
        <g transform="translate(660 260) rotate(14)">${renderPath([...linePts(-24, 10, -10, 26, {seed: seed + 6, amp: 2}), ...linePts(-10, 26, 22, -16, {seed: seed + 7, amp: 2})], {stroke: INK, sw: 10})}</g>
        ${mascot({cx: 1210, cy: 500, s: 440, seed: seed + 2})}
        ${sparkle({cx: 240, cy: 230, R: 30, seed: seed + 3})}
        ${sparkle({cx: 1450, cy: 250, R: 26, seed: seed + 4, fill: PALE_CYAN})}
    `,

    'currency-symbols': (seed) => `
        ${propCoin({cx: 320, cy: 400, r: 105, seed: seed + 1, glyph: '$'})}
        ${propCoin({cx: 560, cy: 590, r: 100, seed: seed + 2, glyph: '€', fill: PALE_CYAN})}
        ${propCoin({cx: 205, cy: 655, r: 78, seed: seed + 3, glyph: '£'})}
        ${mascot({cx: 1130, cy: 510, s: 470, seed: seed + 4})}
        ${sparkle({cx: 1420, cy: 250, R: 30, seed: seed + 5})}
        ${sparkle({cx: 760, cy: 250, R: 22, seed: seed + 6, fill: PALE_CYAN})}
    `,

    'custom-order-statuses': (seed) => `
        ${propTag({cx: 300, cy: 240, seed: seed + 1, dot: CYAN})}
        ${propTag({cx: 300, cy: 660, seed: seed + 2, dot: PURPLE})}
        ${propTag({cx: 590, cy: 450, seed: seed + 3, dot: LAVENDER})}
        ${mascot({cx: 1100, cy: 500, s: 460, seed: seed + 4})}
        ${renderPath(linePts(430, 250, 620, 320, {seed: seed + 5, amp: 3}), {stroke: INK, sw: 7, dash: '10 16'})}
        ${renderPath(linePts(430, 640, 620, 570, {seed: seed + 6, amp: 3}), {stroke: INK, sw: 7, dash: '10 16'})}
        ${sparkle({cx: 1380, cy: 240, R: 26, seed: seed + 7, fill: PALE_CYAN})}
    `,

    'faq-section': (seed) => `
        ${propBubble({cx: 460, cy: 470, w: 360, h: 260, seed: seed + 1})}
        ${propQuestion({cx: 460, cy: 470, s: 240, seed: seed + 2})}
        ${mascot({cx: 1190, cy: 510, s: 460, seed: seed + 3})}
        ${sparkle({cx: 280, cy: 250, R: 28, seed: seed + 4})}
        ${sparkle({cx: 760, cy: 690, R: 24, seed: seed + 5, fill: PALE_CYAN})}
        ${sparkle({cx: 1420, cy: 300, R: 22, seed: seed + 6})}
    `,

    'fly-cart': (seed) => `
        <g transform="rotate(-10 480 400)">
            ${propCart({cx: 480, cy: 400, s: 380, seed: seed + 1, fill: PALE_LAV})}
        </g>
        ${motionLines({x1: 130, x2: 320, y: 210, n: 5, seed: seed + 7})}
        ${renderPath(quadPts([310, 300], [240, 220], [300, 160], {seed: seed + 8, amp: 5}), {stroke: INK, sw: 9})}
        ${renderPath(quadPts([650, 300], [720, 220], [660, 160], {seed: seed + 9, amp: 5}), {stroke: INK, sw: 9})}
        ${character({cx: 1130, cy: 520, s: 1.05, seed: seed + 2, pose: 'wow', rotate: -8})}
        ${sparkle({cx: 700, cy: 650, R: 26, seed: seed + 3})}
        ${sparkle({cx: 1440, cy: 260, R: 30, seed: seed + 4, fill: PALE_CYAN})}
    `,

    'menu-cart': (seed) => `
        ${propCart({cx: 480, cy: 480, s: 380, seed: seed + 1, fill: PALE_LAV, contents: true})}
        <g transform="translate(700 300) rotate(8)">${renderPath([...linePts(-20, 0, -8, 0, {seed: seed + 8, amp: 2}), ...linePts(-14, -6, -14, 6, {seed: seed + 9, amp: 2})], {stroke: INK, sw: 10})}</g>
        ${character({cx: 1150, cy: 520, s: 1.08, seed: seed + 2, pose: 'happy', rotate: 7})}
        ${sparkle({cx: 620, cy: 190, R: 26, seed: seed + 3})}
        ${sparkle({cx: 1420, cy: 680, R: 30, seed: seed + 4, fill: PALE_CYAN})}
    `,

    'order-numbers': (seed) => `
        <g transform="rotate(-5 480 480)">
            ${propTicket({cx: 480, cy: 480, w: 460, h: 340, seed: seed + 1})}
        </g>
        ${mascot({cx: 1180, cy: 510, s: 460, seed: seed + 2})}
        ${sparkle({cx: 300, cy: 240, R: 28, seed: seed + 3})}
        ${sparkle({cx: 1420, cy: 250, R: 26, seed: seed + 4, fill: PALE_CYAN})}
        ${sparkle({cx: 900, cy: 690, R: 20, seed: seed + 5})}
    `,

    'price-variations': (seed) => `
        ${propPriceTag({cx: 340, cy: 400, s: 250, seed: seed + 1})}
        ${propPriceTag({cx: 620, cy: 600, s: 210, seed: seed + 2, fill: PALE_CYAN})}
        <g transform="rotate(12 950 380)">
            ${propPriceTag({cx: 950, cy: 380, s: 280, seed: seed + 3})}
        </g>
        ${mascot({cx: 1280, cy: 520, s: 440, seed: seed + 4})}
        ${sparkle({cx: 250, cy: 210, R: 26, seed: seed + 5, fill: PALE_CYAN})}
        ${sparkle({cx: 1150, cy: 250, R: 30, seed: seed + 6})}
    `,

    'product-comparison': (seed) => `
        ${propCompare({cxL: 400, cxR: 900, cy: 470, s: 400, seed: seed + 1})}
        ${mascot({cx: 1440, cy: 210, s: 210, seed: seed + 2})}
        ${sparkle({cx: 260, cy: 240, R: 26, seed: seed + 3, fill: PALE_CYAN})}
        ${sparkle({cx: 1150, cy: 160, R: 20, seed: seed + 4})}
    `,

    'quantity-fields': (seed) => `
        ${propStepper({cx: 480, cy: 480, w: 520, seed: seed + 1})}
        ${mascot({cx: 1180, cy: 520, s: 460, seed: seed + 2})}
        ${sparkle({cx: 300, cy: 240, R: 28, seed: seed + 3})}
        ${sparkle({cx: 1420, cy: 260, R: 26, seed: seed + 4, fill: PALE_CYAN})}
        ${sparkle({cx: 820, cy: 680, R: 20, seed: seed + 5})}
    `,

    'related-products': (seed) => `
        ${[0, 1, 2].map((c) => propCard({cx: 330 + c * 300, cy: 280, seed: seed + c + 1, feat: c === 0})).join('')}
        ${[0, 1, 2].map((c) => propCard({cx: 330 + c * 300, cy: 600, seed: seed + c + 4, feat: c === 2})).join('')}
        ${mascot({cx: 1330, cy: 460, s: 420, seed: seed + 7})}
        ${renderPath(linePts(930, 420, 1080, 430, {seed: seed + 8, amp: 3}), {stroke: INK, sw: 7, dash: '10 16'})}
        ${renderPath(linePts(930, 560, 1080, 550, {seed: seed + 9, amp: 3}), {stroke: INK, sw: 7, dash: '10 16'})}
        ${sparkle({cx: 250, cy: 130, R: 26, seed: seed + 10, fill: PALE_CYAN})}
        ${sparkle({cx: 1210, cy: 150, R: 22, seed: seed + 11})}
    `,

    'sale-badges': (seed) => `
        ${propBadge({cx: 390, cy: 470, R: 200, seed: seed + 1})}
        <g transform="rotate(12 1320 680)">
            ${propBadge({cx: 1320, cy: 680, R: 130, seed: seed + 2, fill: PALE_CYAN})}
        </g>
        ${character({cx: 920, cy: 470, s: 1.0, seed: seed + 3, pose: 'wow', rotate: -6})}
        ${sparkle({cx: 150, cy: 250, R: 26, seed: seed + 4})}
        ${sparkle({cx: 1250, cy: 230, R: 30, seed: seed + 5, fill: PALE_CYAN})}
    `,

    'sale-progress-bar': (seed) => `
        ${propProgress({cx: 480, cy: 480, w: 720, seed: seed + 1})}
        ${mascot({cx: 1240, cy: 510, s: 450, seed: seed + 2})}
        ${sparkle({cx: 280, cy: 240, R: 28, seed: seed + 3})}
        ${sparkle({cx: 1420, cy: 240, R: 26, seed: seed + 4, fill: PALE_CYAN})}
        ${sparkle({cx: 900, cy: 690, R: 22, seed: seed + 5})}
    `,

    'social-sharing': (seed) => `
        ${propShare({cx: 350, cy: 350, r: 74, seed: seed + 1, kind: 'heart', fill: PALE_LAV})}
        ${propShare({cx: 560, cy: 470, r: 74, seed: seed + 2, kind: 'star', fill: PALE_CYAN})}
        ${propShare({cx: 770, cy: 340, r: 74, seed: seed + 3, kind: 'plane', fill: PAPER})}
        ${mascot({cx: 1170, cy: 500, s: 450, seed: seed + 4})}
        ${sparkle({cx: 230, cy: 600, R: 24, seed: seed + 5, fill: PALE_CYAN})}
        ${sparkle({cx: 1420, cy: 270, R: 28, seed: seed + 6})}
        ${sparkle({cx: 950, cy: 180, R: 20, seed: seed + 7})}
    `,

    'wishlist': (seed) => `
        ${propHeart({cx: 480, cy: 480, s: 320, seed: seed + 1})}
        ${character({cx: 1210, cy: 520, s: 1.08, seed: seed + 2, pose: 'happy', rotate: 4})}
        ${sparkle({cx: 290, cy: 230, R: 30, seed: seed + 3})}
        ${sparkle({cx: 680, cy: 640, R: 24, seed: seed + 4, fill: PALE_CYAN})}
        ${sparkle({cx: 1420, cy: 250, R: 26, seed: seed + 5})}
    `,

    'release-v1-0': (seed) => `
        <g transform="rotate(-5 460 430)">
            ${propBanner({cx: 460, cy: 430, w: 560, h: 190, seed: seed + 1})}
        </g>
        ${character({cx: 1200, cy: 510, s: 1.08, seed: seed + 2, pose: 'wave', rotate: -4})}
        ${sparkle({cx: 250, cy: 230, R: 34, seed: seed + 3})}
        ${sparkle({cx: 850, cy: 240, R: 26, seed: seed + 4, fill: PALE_CYAN})}
        ${sparkle({cx: 1420, cy: 260, R: 30, seed: seed + 5})}
        ${sparkle({cx: 1000, cy: 690, R: 24, seed: seed + 6, fill: PALE_CYAN})}
        ${sparkle({cx: 300, cy: 660, R: 22, seed: seed + 7})}
    `,
};

// ---------------------------------------------------------------------------
// Generic fallback scene (icon chip + character)
// ---------------------------------------------------------------------------

function genericScene(iconSvg, seed) {
    return `
    <g transform="rotate(-8 440 420)">
        ${renderPath(rrectPts(300, 280, 280, 280, 50, {seed: seed + 1, amp: 7}), {fill: PAPER, sw: 12, sh: true})}
        <g transform="translate(440 420) scale(2.6)" fill="${INK}">${iconSvg}</g>
    </g>
    ${mascot({cx: 1050, cy: 520, s: 450, seed: seed + 2})}
    ${sparkle({cx: 1440, cy: 260, R: 30, seed: seed + 3})}
    `;
}

// ---------------------------------------------------------------------------
// Frontmatter parsing
// ---------------------------------------------------------------------------

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

function readIcon(name) {
    const file = path.join(ROOT, 'src', 'icons', `${name}.svg`);
    let svg = readFileSync(file, 'utf8').replace(/currentColor/g, INK);
    svg = svg.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '');
    return svg;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

mkdirSync(OUT_DIR, {recursive: true});
const jobs = [];

for (const file of readdirSync(ADDONS_DIR).filter((f) => f.endsWith('.md'))) {
    const id = file.replace(/\.md$/, '');
    const {icon} = parseFrontmatter(path.join(ADDONS_DIR, file));
    const seed = hashStr(id);
    jobs.push({id, scene: SCENES[id] ? SCENES[id](seed) : genericScene(readIcon(icon ?? 'jetexir'), seed)});
}
for (const file of readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'))) {
    const id = file.replace(/\.md$/, '');
    const fm = parseFrontmatter(path.join(BLOG_DIR, file));
    if (fm.draft === 'true') continue;
    const seed = hashStr(id);
    jobs.push({id, scene: SCENES[id] ? SCENES[id](seed) : genericScene(readIcon('jetexir'), seed)});
}

let generated = 0;
for (const {id, scene} of jobs) {
    const h = hashStr(id);
    const gid = `g${(h >>> 0).toString(36)}`;
    const svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
<defs>${grainFilter(gid, h % 997)}</defs>
<g filter="url(#${gid})">${scene}</g>
</svg>`;
    const img = await sharp(Buffer.from(svg), {density: 72}).webp({quality: 88, effort: 5}).toBuffer();
    const out = path.join(OUT_DIR, `${id}.webp`);
    writeFileSync(out, img);
    console.log(`✓ ${out}  ${(img.length / 1024).toFixed(1)} KB`);
    generated++;
}
console.log(`\nGenerated ${generated} featured images in public/images/featured/`);
