const fileInput = document.getElementById('content-file');
const dropzone = document.getElementById('dropzone');
const target = document.getElementById('poc-content');
const status = document.getElementById('static-status');
const loadStatus = document.getElementById('load-status');

const slots = {
  HERO_01: ['16:9', '1600 px'],
  IMG_01: ['3:2', '1400 px'],
  B01_MAIN: ['16:9', '1600 px'],
  B01_H01: ['16:9', '1200 px'],
  IMG_02: ['4:3', '1200 px']
};

const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.avif', '.svg'];
const legacyEditorialPrefixes = [
  'POC này chỉ kiểm chứng cơ chế ánh xạ media của B01.',
  'Khi một slot chưa có file tương ứng,',
  'Nội dung POC dừng tại đây.'
];
const legacyEditorialHeadings = new Set([
  '## B01 — Một ảnh chính, một hotspot',
  '## Phần tiếp theo'
]);
let lastText = null;

function escapeHtml(text='') {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function inlineFormat(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
}

function placeholderMarkup(id) {
  const [ratio, min] = slots[id] || ['?', '?'];
  return `<strong>${id}</strong><span>Ảnh ${ratio}</span><span>Khuyến nghị tối thiểu ${min}</span>`;
}

function assetPlaceholder(id) {
  return `<div class="asset-placeholder" data-slot="${id}">${placeholderMarkup(id)}</div>`;
}

function editorialGuidanceB01() {
  return `<aside data-editorial-only="true" style="margin:0 0 14px;padding:10px 12px;border:1px dashed #9f9382;border-radius:8px;background:#fffaf0;color:#655f56;font:600 12px/1.45 ui-monospace,monospace">
    CHỈ DẪN BIÊN TẬP · B01: B01_MAIN = ảnh chính; B01_H01 = ảnh hotspot H01. Khối này chỉ dành cho preview biên tập và không thuộc nội dung độc giả.
  </aside>`;
}

function componentB01() {
  return `<section class="component-static" data-component="B01">
    ${editorialGuidanceB01()}
    ${assetPlaceholder('B01_MAIN')}
    <div class="hotspot-demo"><strong data-editorial-only="true">Hotspot H01</strong>${assetPlaceholder('B01_H01')}</div>
  </section>`;
}

function isLegacyEditorialLine(line) {
  const trimmed = line.trim();
  if (legacyEditorialHeadings.has(trimmed)) return true;
  return legacyEditorialPrefixes.some((prefix) => trimmed.startsWith(prefix));
}

function markdownToHtml(markdown) {
  const normalized = markdown.replace(/\r\n?/g, '\n');
  const lines = normalized.split('\n');
  const out = [];
  let paragraph = [];

  const flush = () => {
    if (!paragraph.length) return;
    out.push(`<p>${inlineFormat(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      flush();
      continue;
    }
    if (isLegacyEditorialLine(line)) {
      flush();
      continue;
    }
    const asset = line.match(/^\[\[ASSET:([A-Z0-9_]+)\]\]$/);
    if (asset) {
      flush();
      out.push(assetPlaceholder(asset[1]));
      continue;
    }
    if (line === '[[COMPONENT:B01]]') {
      flush();
      out.push(componentB01());
      continue;
    }
    if (line.startsWith('# ')) {
      flush();
      out.push(`<h1>${inlineFormat(line.slice(2))}</h1>`);
      continue;
    }
    if (line.startsWith('## ')) {
      flush();
      out.push(`<h2>${inlineFormat(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('> ')) {
      flush();
      out.push(`<blockquote>${inlineFormat(line.slice(2))}</blockquote>`);
      continue;
    }
    paragraph.push(line.trim());
  }
  flush();
  return out.join('\n');
}

function renderText(text, label = 'CONTENT.md') {
  target.innerHTML = markdownToHtml(text);
  status.textContent = 'CONTENT.md ĐÃ NẠP';
  loadStatus.textContent = `Đã render ${label} · ${new Date().toLocaleTimeString('vi-VN')}`;
  lastText = text;
  if (location.protocol !== 'file:') scanAssets().catch(() => {});
}

async function loadFile(file) {
  if (!file) return;
  try {
    renderText(await file.text(), file.name);
  } catch (error) {
    status.textContent = 'LỖI ĐỌC FILE';
    loadStatus.textContent = error.message;
  }
}

async function loadLocalContent({ silent = false } = {}) {
  if (location.protocol === 'file:') return false;
  try {
    const response = await fetch(`CONTENT.md?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    if (text !== lastText) renderText(text, 'CONTENT.md');
    else if (!silent) loadStatus.textContent = `CONTENT.md chưa thay đổi · ${new Date().toLocaleTimeString('vi-VN')}`;
    return true;
  } catch (error) {
    status.textContent = 'KHÔNG ĐỌC ĐƯỢC CONTENT.md';
    loadStatus.textContent = `Có thể dùng nút chọn file dự phòng · ${error.message}`;
    return false;
  }
}

function setMissingAsset(element, id) {
  if (element.dataset.assetState === 'missing') return;
  element.className = 'asset-placeholder';
  element.innerHTML = placeholderMarkup(id);
  element.dataset.assetState = 'missing';
  delete element.dataset.assetSignature;
}

function setDuplicateAsset(element, id, matches) {
  const signature = `duplicate:${matches.join('|')}`;
  if (element.dataset.assetSignature === signature) return;
  element.className = 'asset-placeholder';
  element.innerHTML = `<strong>${id}</strong><span style="color:#8a2d20">Lỗi: có nhiều file cùng slot</span><span>${matches.map(escapeHtml).join(' · ')}</span>`;
  element.dataset.assetState = 'duplicate';
  element.dataset.assetSignature = signature;
}

async function fileSignature(filename) {
  try {
    const response = await fetch(`ASSETS/${encodeURIComponent(filename)}?probe=${Date.now()}`, {
      method: 'HEAD',
      cache: 'no-store'
    });
    if (!response.ok) return `${filename}:unknown`;
    return [filename, response.headers.get('last-modified') || '', response.headers.get('content-length') || ''].join('|');
  } catch (_) {
    return `${filename}:unknown`;
  }
}

function setResolvedAsset(element, id, filename, signature) {
  if (element.dataset.assetSignature === signature && element.dataset.assetState === 'resolved') return;

  const [ratioText, minText] = slots[id] || ['?', '0 px'];
  const minWidth = parseInt(minText, 10) || 0;
  const ratioParts = ratioText.split(':').map(Number);
  const expectedRatio = ratioParts.length === 2 && ratioParts[1] ? ratioParts[0] / ratioParts[1] : null;

  element.className = 'asset-resolved';
  element.innerHTML = '';
  element.style.margin = '36px auto';
  element.style.maxWidth = '980px';

  const image = document.createElement('img');
  image.alt = id;
  image.src = `ASSETS/${encodeURIComponent(filename)}?v=${encodeURIComponent(signature)}`;
  image.style.display = 'block';
  image.style.width = '100%';
  image.style.height = 'auto';
  image.style.borderRadius = '8px';

  const info = document.createElement('div');
  info.dataset.editorialOnly = 'true';
  info.style.marginTop = '8px';
  info.style.font = '600 12px/1.4 ui-monospace, monospace';
  info.style.color = '#655f56';
  info.textContent = `${id} · ${filename}`;

  image.addEventListener('load', () => {
    const warnings = [];
    if (minWidth && image.naturalWidth < minWidth) warnings.push(`ảnh nhỏ hơn ${minWidth}px`);
    if (expectedRatio && image.naturalHeight) {
      const actualRatio = image.naturalWidth / image.naturalHeight;
      if (Math.abs(actualRatio / expectedRatio - 1) > 0.08) warnings.push(`tỷ lệ lệch ${ratioText}`);
    }
    info.textContent = `${id} · ${filename} · ${image.naturalWidth}×${image.naturalHeight}px`;
    if (warnings.length) {
      const warning = document.createElement('div');
      warning.style.marginTop = '4px';
      warning.style.color = '#8a2d20';
      warning.textContent = `Cảnh báo: ${warnings.join('; ')}`;
      info.appendChild(warning);
    }
  });

  element.appendChild(image);
  element.appendChild(info);
  element.dataset.assetState = 'resolved';
  element.dataset.assetSignature = signature;
}

async function listAssetFiles() {
  const response = await fetch(`ASSETS/?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`ASSETS HTTP ${response.status}`);
  const html = await response.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return Array.from(doc.querySelectorAll('a'))
    .map((a) => (a.textContent || '').trim())
    .filter(Boolean);
}

async function scanAssets() {
  if (location.protocol === 'file:') return;
  const files = await listAssetFiles();
  const elements = Array.from(document.querySelectorAll('[data-slot]'));

  for (const element of elements) {
    const id = element.dataset.slot;
    const matches = files.filter((filename) => allowedExtensions.some((ext) => filename === `${id}${ext}`));

    if (matches.length === 0) {
      setMissingAsset(element, id);
      continue;
    }
    if (matches.length > 1) {
      setDuplicateAsset(element, id, matches);
      continue;
    }

    const signature = await fileSignature(matches[0]);
    setResolvedAsset(element, id, matches[0], signature);
  }
}

fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));
['dragenter', 'dragover'].forEach((eventName) => dropzone.addEventListener(eventName, (event) => {
  event.preventDefault();
  dropzone.classList.add('drag');
}));
['dragleave', 'drop'].forEach((eventName) => dropzone.addEventListener(eventName, (event) => {
  event.preventDefault();
  dropzone.classList.remove('drag');
}));
dropzone.addEventListener('drop', (event) => loadFile(event.dataTransfer.files[0]));

async function refreshLocalPreview() {
  await loadLocalContent({ silent: true });
  await scanAssets();
}

async function bootstrap() {
  if (location.protocol === 'file:') {
    status.textContent = 'CHẾ ĐỘ FILE TRỰC TIẾP';
    loadStatus.textContent = 'Chọn CONTENT.md để render.';
    return;
  }

  dropzone.hidden = true;
  loadStatus.textContent = 'Đang tự nạp CONTENT.md…';
  await loadLocalContent();
  await scanAssets();
  setInterval(() => refreshLocalPreview().catch(() => {}), 1500);
}

bootstrap().catch((error) => {
  status.textContent = 'LỖI KHỞI ĐỘNG PREVIEW';
  loadStatus.textContent = error.message;
});
