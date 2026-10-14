import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import sharp from 'sharp';

const here = path.dirname(fileURLToPath(import.meta.url));
const DEFAULTS = {
  rootDir: here,
  contentPath: path.join(here, 'CONTENT.md'),
  manifestPath: path.join(here, 'asset-manifest.json'),
  assetsDir: path.join(here, 'ASSETS'),
  distDir: path.join(here, 'dist')
};

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

function ratioValue(ratio) {
  const [w, h] = String(ratio).split(':').map(Number);
  return w > 0 && h > 0 ? w / h : null;
}

async function resolveSource(slot, manifest, assetsDir) {
  const allowed = new Set(manifest.allowed_extensions.map((ext) => ext.toLowerCase()));
  let entries = [];
  try {
    entries = await fs.readdir(assetsDir, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return { kind: 'missing' };
    throw error;
  }

  const matches = entries
    .filter((entry) => entry.isFile())
    .filter((entry) => {
      const parsed = path.parse(entry.name);
      return parsed.name === slot.id && allowed.has(parsed.ext.toLowerCase());
    })
    .map((entry) => path.join(assetsDir, entry.name));

  if (matches.length === 0) return { kind: 'missing' };
  if (matches.length > 1) return { kind: 'duplicate', files: matches.map((f) => path.basename(f)) };
  return { kind: 'file', file: matches[0] };
}

function placeholder(slot, message = '') {
  return `<div class="asset-placeholder" data-slot="${slot.id}" style="aspect-ratio:${slot.ratio.replace(':', '/')}" role="img" aria-label="Placeholder ${slot.id}">
    <strong>${slot.id}</strong>
    <span>Ảnh ${slot.ratio}</span>
    <span>Khuyến nghị tối thiểu ${slot.min_width} px</span>
    ${message ? `<small>${escapeHtml(message)}</small>` : ''}
  </div>`;
}

function assetVisual(slot, state) {
  if (!state || state.status === 'missing') return placeholder(slot);
  if (state.status === 'error') return placeholder(slot, state.messages.join(' · '));
  const warning = state.messages?.length
    ? `<div class="asset-warning" role="status">${state.messages.map(escapeHtml).join(' · ')}</div>`
    : '';
  return `<div class="asset-ready" data-slot="${slot.id}" data-asset-status="${state.status}">
    <img src="${state.output}" alt="${escapeHtml(slot.alt)}" loading="lazy" />
    ${warning}
  </div>`;
}

function renderAsset(slot, state) {
  return `<figure class="asset-frame asset-${slot.layout}" data-slot-frame="${slot.id}">
    ${assetVisual(slot, state)}
    <figcaption><strong>${slot.id}</strong> · ${slot.layout} · ${slot.ratio}</figcaption>
  </figure>`;
}

function renderB01(slotsById, statesById) {
  const main = slotsById.get('B01_MAIN');
  const hotspot = slotsById.get('B01_H01');
  if (!main || !hotspot) return '<div class="component-error">B01 manifest incomplete.</div>';

  return `<section class="b01-poc" data-component="B01" aria-label="POC B01 interactive component">
    <div class="b01-stage">
      ${assetVisual(main, statesById.get(main.id))}
      <button class="b01-hotspot" type="button" aria-expanded="false" aria-controls="b01-hotspot-panel">1</button>
    </div>
    <aside class="b01-hotspot-panel" id="b01-hotspot-panel" hidden>
      <div class="b01-panel-copy"><strong>B01_H01</strong><span>Hotspot 1</span></div>
      ${assetVisual(hotspot, statesById.get(hotspot.id))}
    </aside>
    <p class="component-note">B01_MAIN luôn ở stage chính; B01_H01 chỉ xuất hiện trong panel hotspot 1.</p>
  </section>`;
}

export async function build(options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  await fs.mkdir(cfg.assetsDir, { recursive: true });
  await fs.rm(cfg.distDir, { recursive: true, force: true });
  await fs.mkdir(path.join(cfg.distDir, 'assets'), { recursive: true });

  const [manifestRaw, contentRaw] = await Promise.all([
    fs.readFile(cfg.manifestPath, 'utf8'),
    fs.readFile(cfg.contentPath, 'utf8')
  ]);
  const manifest = JSON.parse(manifestRaw);
  const states = [];

  for (const slot of manifest.slots) {
    const source = await resolveSource(slot, manifest, cfg.assetsDir);
    if (source.kind === 'missing') {
      states.push({ id: slot.id, status: 'missing', source: null, output: null, messages: [] });
      continue;
    }
    if (source.kind === 'duplicate') {
      states.push({
        id: slot.id,
        status: 'error',
        source: source.files,
        output: null,
        messages: [`DUPLICATE_SOURCE: chỉ giữ một file có basename ${slot.id}`]
      });
      continue;
    }

    const metadata = await sharp(source.file).metadata();
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    const expectedRatio = ratioValue(slot.ratio);
    const actualRatio = width && height ? width / height : null;
    const messages = [];
    if (width < slot.min_width) messages.push(`TOO_SMALL: ${width}px < ${slot.min_width}px`);
    if (expectedRatio && actualRatio && Math.abs(actualRatio - expectedRatio) / expectedRatio > 0.08) {
      messages.push(`RATIO_MISMATCH: thực tế ${actualRatio.toFixed(2)}, yêu cầu ${slot.ratio}`);
    }

    const outputName = `${slot.id}.webp`;
    const outputPath = path.join(cfg.distDir, 'assets', outputName);
    await sharp(source.file)
      .rotate()
      .resize({ width: slot.max_output_width, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toFile(outputPath);

    states.push({
      id: slot.id,
      status: messages.length ? 'warning' : 'ready',
      source: path.basename(source.file),
      output: `dist/assets/${outputName}`,
      width,
      height,
      messages
    });
  }

  const slotsById = new Map(manifest.slots.map((slot) => [slot.id, slot]));
  const statesById = new Map(states.map((state) => [state.id, state]));

  let expanded = contentRaw.replace(/\[\[ASSET:([A-Z0-9_]+)\]\]/g, (_match, id) => {
    const slot = slotsById.get(id);
    return slot ? `\n${renderAsset(slot, statesById.get(id))}\n` : `\n<div class="component-error">UNKNOWN SLOT ${escapeHtml(id)}</div>\n`;
  });

  expanded = expanded.replace(/\[\[COMPONENT:B01\]\]/g, `\n${renderB01(slotsById, statesById)}\n`);

  const html = marked.parse(expanded, { gfm: true });
  const report = {
    generated_at: new Date().toISOString(),
    contract: manifest.contract,
    slots: states,
    summary: {
      total: states.length,
      ready: states.filter((s) => s.status === 'ready').length,
      warning: states.filter((s) => s.status === 'warning').length,
      missing: states.filter((s) => s.status === 'missing').length,
      error: states.filter((s) => s.status === 'error').length
    }
  };

  await Promise.all([
    fs.writeFile(path.join(cfg.distDir, 'content.html'), html, 'utf8'),
    fs.writeFile(path.join(cfg.distDir, 'build-report.json'), JSON.stringify(report, null, 2), 'utf8')
  ]);

  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await build();
  console.log(`POC build: ready=${report.summary.ready}, warning=${report.summary.warning}, missing=${report.summary.missing}, error=${report.summary.error}`);
  if (report.summary.error > 0) process.exitCode = 1;
}
