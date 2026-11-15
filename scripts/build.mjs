import { cp, mkdir, rm } from 'node:fs/promises';
// Explicit allowlist: never publish source imports, guest data, previews, or tests.
await rm(new URL('../dist/', import.meta.url), { recursive: true, force: true });
await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
for (const path of ['index.html','styles.css','motion.css','gallery-motion.css','refinements.css','app.js','interactions.js','invitation.js','assets/images','assets/fonts','vendor']) {
  await cp(new URL('../site/' + path, import.meta.url), new URL('../dist/' + path, import.meta.url), { recursive: true });
}
console.log('Built public site in dist/.');
