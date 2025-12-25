import fs from 'fs';
import matter from 'gray-matter';

export function loadMarkdown(filePath: string) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = matter(raw);

    return {
        content: parsed.content.trim(),
        metadata: parsed.data
    };
}
