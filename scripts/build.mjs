import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { siteMetadata, renderMetadata, robotsText, sitemapText } from './metadata.mjs';
const metadata = siteMetadata();
// Explicit allowlist: never publish source imports, guest data, previews, or tests.
await rm(new URL('../dist/', import.meta.url), { recursive: true, force: true });
await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
for (const path of ['index.html','favicon.svg','styles.css','motion.css','gallery-motion.css','refinements.css','app.js','interactions.js','invitation.js','assets/images','assets/fonts','vendor']) {
  await cp(new URL('../site/' + path, import.meta.url), new URL('../dist/' + path, import.meta.url), { recursive: true });
}
const index = new URL('../dist/index.html', import.meta.url);
await writeFile(index, renderMetadata(await readFile(index, 'utf8'), metadata));
await writeFile(new URL('../dist/robots.txt', import.meta.url), robotsText(metadata));
if (metadata.indexable) await writeFile(new URL('../dist/sitemap.xml', import.meta.url), sitemapText(metadata));
await writeFile(new URL('../dist/_headers', import.meta.url), `/*\n  X-Robots-Tag: ${metadata.indexable ? 'index, follow, max-image-preview:large' : 'noindex, nofollow'}\n`);
console.log(`Metadata: ${metadata.origin}/ (${metadata.indexable ? 'search indexing enabled' : 'preview, noindex'}).`);
console.log('Built public site in dist/.');
