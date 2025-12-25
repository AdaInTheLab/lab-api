import { Command } from 'commander';
import { loadMarkdown } from '../utils/loadMarkdown.js';
import { LabClient } from '../../src/sdk/LabClient.js';
import path from 'path';

const publish = new Command('publish')
    .description('Publish a Lab Note from a Markdown file')
    .argument('<file>', 'Markdown file to publish')
    .option('-u, --url <url>', 'API base URL', 'https://thehumanpatternlab.com/api')
    .option('-t, --token <token>', 'Auth token (if required)')
    .action(async (file, options) => {
        try {
            const filePath = path.resolve(process.cwd(), file);
            const { content, metadata } = loadMarkdown(filePath);

            if (!metadata.title || !metadata.slug) {
                console.error('Error: frontmatter must include at least: title, slug');
                process.exit(1);
            }

            const client = new LabClient(options.url, options.token);

            const payload = {
                ...metadata,
                content,
                tags: metadata.tags || [],
                artifacts: metadata.artifacts || []
            };

            const result = await client.createOrUpdateNote(payload);

            console.log(`✔ Published: ${metadata.title}`);
            console.log(`→ slug: ${metadata.slug}`);
            console.log(result.message);
        } catch (err: any) {
            console.error('Publish failed:', err.message);
            process.exit(1);
        }
    });

export default publish;
