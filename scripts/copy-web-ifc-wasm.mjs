import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const srcDir = resolve('node_modules/web-ifc');
const destDir = resolve('public/web-ifc');
const files = ['web-ifc.wasm', 'web-ifc-mt.wasm'];

if (!existsSync(srcDir)) {
  console.warn('[postinstall] web-ifc not found, skipping wasm copy.');
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });

files.forEach((file) => {
  const src = join(srcDir, file);
  const dest = join(destDir, file);
  if (!existsSync(src)) {
    console.warn(`[postinstall] Missing ${file}, skipping.`);
    return;
  }
  copyFileSync(src, dest);
});
