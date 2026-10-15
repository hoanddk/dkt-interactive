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

function assetPlaceholder(id) {
  const [ratio, min] = slots[id] || ['?', '?'];
  return `<div class="asset-placeholder" data-slot="${id}"><strong>${id}</strong><span>Ảnh ${ratio}</span><span>Khuyến nghị tối thiểu ${min}</span></div>`;
}

function componentB01() {
  return `<section class="component-static" data-component="B01">
    <strong>B01 — STATIC PLACEHOLDER DEMO</strong>
    ${assetPlaceholder('B01_MAIN')}
    <div class="hotspot-demo"><strong>Hotspot 1 → B01_H01</strong>${assetPlaceholder('B01_H01')}</div>
  </section>`;
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

if (location.protocol === 'file:') {
  status.textContent = 'CHẾ ĐỘ FILE TRỰC TIẾP';
  loadStatus.textContent = 'Chọn CONTENT.md để render.';
} else {
  dropzone.hidden = true;
  loadStatus.textContent = 'Đang tự nạp CONTENT.md…';
  await loadLocalContent();
  setInterval(() => loadLocalContent({ silent: true }), 1500);
}
