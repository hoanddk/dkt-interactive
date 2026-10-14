import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import chokidar from 'chokidar';
import { build } from './build.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);
const clients = new Set();
let building = false;
let pending = false;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

async function rebuild() {
  if (building) {
    pending = true;
    return;
  }
  building = true;
  try {
    const report = await build();
    console.log(`[POC] build ready=${report.summary.ready} warning=${report.summary.warning} missing=${report.summary.missing} error=${report.summary.error}`);
    for (const response of clients) response.write('event: reload\ndata: now\n\n');
  } catch (error) {
    console.error('[POC] build failed:', error);
  } finally {
    building = false;
    if (pending) {
      pending = false;
      setTimeout(rebuild, 50);
    }
  }
}

await rebuild();

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  if (requestUrl.pathname === '/__reload') {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive'
    });
    response.write('retry: 1000\n\n');
    clients.add(response);
    request.on('close', () => clients.delete(response));
    return;
  }

  const relative = requestUrl.pathname === '/' ? 'preview.html' : decodeURIComponent(requestUrl.pathname.slice(1));
  const file = path.resolve(root, relative);
  if (!file.startsWith(root + path.sep) && file !== path.join(root, 'preview.html')) {
    response.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const data = await fs.readFile(file);
    response.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    response.end(data);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[POC] preview: http://127.0.0.1:${port}`);
  console.log('[POC] edit CONTENT.md or drop a correctly named file into ASSETS/; rebuild + browser reload are automatic.');
});

const watcher = chokidar.watch([
  path.join(root, 'CONTENT.md'),
  path.join(root, 'asset-manifest.json'),
  path.join(root, 'ASSETS')
], { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 180, pollInterval: 50 } });

let debounce;
watcher.on('all', () => {
  clearTimeout(debounce);
  debounce = setTimeout(rebuild, 120);
});
