/**
 * Export addons and blog posts as JSON into src/temp/.
 *
 * Each addon entry: { title, description, summary, category, features }
 * Each blog entry:  { title, description, summary, category }
 *
 * Run with: npm run content:json
 */
import {mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const ADDONS_DIR = path.join(ROOT, 'src', 'content', 'addons');
const BLOG_DIR = path.join(ROOT, 'src', 'content', 'blog');
const OUT_DIR = path.join(ROOT, 'src', 'temp');

function parseMd(file) {
    const src = readFileSync(file, 'utf8');
    const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(src);
    if (!m) throw new Error(`No frontmatter in ${file}`);
    const data = {};
    const lines = m[1].split(/\r?\n/);
    let i = 0;
    while (i < lines.length) {
        const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(lines[i].trim());
        if (!kv) {
            i++;
            continue;
        }
        const key = kv[1];
        let val = kv[2].trim();
        if (val === '') {
            // Block list: collect following indented "- item" lines.
            const items = [];
            let j = i + 1;
            while (j < lines.length && /^\s+-\s+/.test(lines[j])) {
                items.push(lines[j].replace(/^\s+-\s+/, '').replace(/^['"]|['"]$/g, '').trim());
                j++;
            }
            if (items.length > 0) {
                data[key] = items;
                i = j;
                continue;
            }
            data[key] = '';
        } else if (val.startsWith('[')) {
            data[key] = val.replace(/^\[|\]$/g, '').split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
        } else {
            data[key] = val.replace(/^['"]|['"]$/g, '');
        }
        i++;
    }
    return {data, body: (m[2] ?? '').trim()};
}

function stripMarkdown(text) {
    return text
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> label
        .replace(/[*_`#>]/g, '')
        .replace(/^\s*[-+]\s+/gm, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function paragraphs(body) {
    return body
        .split(/\n\s*\n/)
        .map((p) => stripMarkdown(p))
        .filter(Boolean);
}

// ---- Addons ----
const addons = readdirSync(ADDONS_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
        const {data, body} = parseMd(path.join(ADDONS_DIR, f));
        return {
            title: data.title,
            description: paragraphs(body).join('\n\n'),
            summary: data.summary,
            category: data.category,
            features: Array.isArray(data.features) ? data.features : [],
            order: Number(data.order ?? 0),
        };
    })
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
    .map(({order, ...entry}) => entry);

// ---- Blog ----
const blog = readdirSync(BLOG_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
        const {data, body} = parseMd(path.join(BLOG_DIR, f));
        if (data.draft === 'true') return null;
        const tags = Array.isArray(data.tags) ? data.tags : data.tags ? [data.tags] : [];
        const paras = paragraphs(body);
        const category = tags[0] ? tags[0].charAt(0).toUpperCase() + tags[0].slice(1) : 'Blog';
        return {
            title: data.title,
            description: data.description,
            summary: paras[0] ?? data.description,
            category,
        };
    })
    .filter(Boolean);

mkdirSync(OUT_DIR, {recursive: true});
writeFileSync(path.join(OUT_DIR, 'addons.json'), JSON.stringify(addons, null, 2) + '\n');
writeFileSync(path.join(OUT_DIR, 'blog.json'), JSON.stringify(blog, null, 2) + '\n');
console.log(`✓ src/temp/addons.json  (${addons.length} addons)`);
console.log(`✓ src/temp/blog.json  (${blog.length} posts)`);
