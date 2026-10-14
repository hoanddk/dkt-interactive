import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from './build.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'dkt-file-poc-'));
const assetsDir = path.join(tmp, 'ASSETS');
const distDir = path.join(tmp, 'dist');
await fs.mkdir(assetsDir, { recursive: true });

function svg(width, height, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#d9d0c0"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="54" fill="#302c27">${label}</text></svg>`;
}

try {
  await fs.writeFile(path.join(assetsDir, 'HERO_01.svg'), svg(1600, 900, 'HERO_01'));
  await fs.writeFile(path.join(assetsDir, 'B01_MAIN.svg'), svg(1600, 900, 'B01_MAIN'));
  await fs.writeFile(path.join(assetsDir, 'B01_H01.svg'), svg(1200, 675, 'B01_H01'));

  let report = await build({
    contentPath: path.join(root, 'CONTENT.md'),
    manifestPath: path.join(root, 'asset-manifest.json'),
    assetsDir,
    distDir
  });

  const byId = new Map(report.slots.map((slot) => [slot.id, slot]));
  assert.equal(report.summary.total, 5);
  assert.equal(byId.get('HERO_01').status, 'ready');
  assert.equal(byId.get('B01_MAIN').status, 'ready');
  assert.equal(byId.get('B01_H01').status, 'ready');
  assert.equal(byId.get('IMG_01').status, 'missing');
  assert.equal(byId.get('IMG_02').status, 'missing');

  const html = await fs.readFile(path.join(distDir, 'content.html'), 'utf8');
  assert.match(html, /data-component="B01"/);
  assert.match(html, /data-slot="B01_MAIN"/);
  assert.match(html, /data-slot="B01_H01"/);
  assert.match(html, /IMG_01/);

  await fs.writeFile(path.join(assetsDir, 'IMG_02.svg'), svg(320, 240, 'IMG_02 SMALL'));
  report = await build({
    contentPath: path.join(root, 'CONTENT.md'),
    manifestPath: path.join(root, 'asset-manifest.json'),
    assetsDir,
    distDir
  });
  const img02 = report.slots.find((slot) => slot.id === 'IMG_02');
  assert.equal(img02.status, 'warning');
  assert.ok(img02.messages.some((message) => message.startsWith('TOO_SMALL')));
  await fs.access(path.join(distDir, 'assets', 'IMG_02.webp'));

  await fs.writeFile(path.join(assetsDir, 'IMG_02.png'), Buffer.from('not-used'));
  report = await build({
    contentPath: path.join(root, 'CONTENT.md'),
    manifestPath: path.join(root, 'asset-manifest.json'),
    assetsDir,
    distDir
  });
  assert.equal(report.slots.find((slot) => slot.id === 'IMG_02').status, 'error');

  console.log('FILE-ORIENTED POC SELFTEST: PASS');
} finally {
  await fs.rm(tmp, { recursive: true, force: true });
}
