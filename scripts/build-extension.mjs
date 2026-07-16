import { cp, mkdir, readFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'manifest.json'), 'utf8'));
const version = manifest.version;
const distDirectory = path.join(root, 'dist');
const stagingDirectory = path.join(distDirectory, `pino-fact-checker-${version}`);
const archivePath = path.join(distDirectory, `pino-fact-checker-${version}.zip`);

const files = [
  'background.js',
  'content.js',
  'core.js',
  'manifest.json',
  'popup.html',
  'popup.js',
  'styles.css',
];
const legalFiles = ['index.html', 'privacy.html', 'styles.css', 'terms.html'];

await rm(stagingDirectory, { recursive: true, force: true });
await rm(archivePath, { force: true });
await mkdir(stagingDirectory, { recursive: true });

for (const file of files) {
  await cp(path.join(root, file), path.join(stagingDirectory, file));
}
await cp(path.join(root, 'icons'), path.join(stagingDirectory, 'icons'), { recursive: true });
await mkdir(path.join(stagingDirectory, 'legal'), { recursive: true });
for (const file of legalFiles) {
  await cp(path.join(root, 'legal', file), path.join(stagingDirectory, 'legal', file));
}

const zip = spawnSync('zip', ['-qr', archivePath, '.'], {
  cwd: stagingDirectory,
  encoding: 'utf8',
});

if (zip.status !== 0) {
  throw new Error(zip.stderr || 'Could not create the extension archive.');
}

console.log(archivePath);
