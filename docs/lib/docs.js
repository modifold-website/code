import fs from 'node:fs';
import path from 'node:path';

import matter from 'gray-matter';

const DOCS_ROOT = path.join(process.cwd(), 'src/content/docs');

function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files = [];

    for(const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if(entry.isDirectory()) {
            files.push(...walk(fullPath));
            continue;
        }

        if(entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
            files.push(fullPath);
        }
    }

    return files;
}

function toSlug(filePath) {
    const relative = path.relative(DOCS_ROOT, filePath);
    const noExt = relative.replace(/\.(md|mdx)$/i, '');
    if(noExt === 'index') {
        return [];
    }

    return noExt.split(path.sep);
}

export function getAllDocs() {
    return walk(DOCS_ROOT).map((filePath) => {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = matter(raw);
        const title = typeof parsed.data.title === 'string' ? parsed.data.title : toSlug(filePath).join(' / ') || 'Docs';
        const description = typeof parsed.data.description === 'string' ? parsed.data.description : undefined;
        const order = typeof parsed.data.order === 'number' ? parsed.data.order : Number.POSITIVE_INFINITY;
        const hideHeader = parsed.data.hideHeader === true;

        return {
            slug: toSlug(filePath),
            title,
            description,
            order,
            hideHeader,
            content: parsed.content,
        };
    });
}

export function getDocBySlug(slug) {
    const all = getAllDocs();
    return all.find((doc) => doc.slug.join('/') === slug.join('/')) ?? null;
}
