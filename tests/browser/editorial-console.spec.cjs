const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aFqkAAAAASUVORK5CYII=',
  'base64'
);
const editURL = '/?edit=1';
const action = (page, name) => page.locator('#editor-console [data-ec-action="' + name + '"]');
const slot = (page, id) => page.locator('[data-editorial-slot="' + id + '"]');
const assetButton = (page, id) => slot(page, id).locator('.ec-asset-control');
const getAssets = page => page.evaluate(() => window.__editorialAssets?.getChanges() || []);
const file = name => ({ name, mimeType: 'image/png', buffer: PNG });

async function editText(page, text) {
  const field = page.locator('#s00 h1[data-editorial-policy="EDITABLE"]');
  await field.click();
  await expect(field).toHaveAttribute('contenteditable', 'plaintext-only');
  await field.fill(text);
  await field.press('Enter');
  await expect(field).toHaveText(text);
  return field;
}
async function openAsset(page, id) {
  await assetButton(page, id).click();
  await expect(page.locator('#editor-panel')).toBeVisible();
  await expect(page.locator('#ec-panel-title')).toContainText('CHỈNH SỬA ẢNH');
}
async function saveAsset(page, fields = {}) {
  if (fields.file) await page.locator('#ec-asset-file').setInputFiles(file(fields.file));
  if (fields.caption !== undefined) await page.locator('#ec-asset-caption').fill(fields.caption);
  if (fields.credit !== undefined) await page.locator('#ec-asset-credit').fill(fields.credit);
  if (fields.alt !== undefined) await page.locator('#ec-asset-alt').fill(fields.alt);
  if (fields.source !== undefined) await page.locator('#ec-asset-source').fill(fields.source);
  if (fields.reason !== undefined) await page.locator('#ec-asset-reason').fill(fields.reason);
  if (fields.rights !== undefined) await page.locator('#ec-asset-rights').selectOption(fields.rights);
  if (fields.provenance !== undefined) await page.locator('#ec-asset-provenance').selectOption(fields.provenance);
  if (fields.impact !== undefined) await page.locator('#ec-asset-impact').selectOption(fields.impact);
  if (fields.type !== undefined) await page.locator('#ec-asset-type').selectOption(fields.type);
  if (fields.representation !== undefined) await page.locator('#ec-asset-representation').selectOption(fields.representation);
  await page.locator('#ec-asset-save').click();
  await expect(page.locator('#editor-panel')).toBeHidden();
}
async function exported(page) {
  const pending = page.waitForEvent('download');
  await action(page, 'export').click();
  const download = await pending;
  const raw = await fs.readFile(await download.path(), 'utf8');
  return JSON.parse(raw);
}

test.beforeEach(async ({ page }) => {
  await page.goto(editURL);
  await expect(page.locator('#editor-console')).toBeVisible();
  await expect(page.locator('[data-editorial-slot="HERO_IMAGE"] .ec-asset-control')).toBeVisible();
});

test('01 public mode excludes editorial controls and draft overlays', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#editor-console')).toHaveCount(0);
  await expect(page.locator('.ec-asset-control')).toHaveCount(0);
  await expect(page.locator('#s00 h1')).toBeVisible();
});

test('02 inline text editing commits on Enter', async ({ page }) => {
  await editText(page, 'QA EDIT TEST — không phải nội dung xuất bản');
  await expect(page.locator('#s00 h1')).toHaveClass(/ec-changed/);
  await expect(page.locator('#ec-count')).toContainText('1 changes');
});

test('03 Escape cancels active inline text edit', async ({ page }) => {
  const h1 = page.locator('#s00 h1');
  const before = await h1.textContent();
  await h1.click();
  await h1.fill('QA CANCELED');
  await h1.press('Escape');
  await expect(h1).toHaveText(before);
  await expect(h1).not.toHaveAttribute('contenteditable', /.+/);
});

test('04 Undo restores original text', async ({ page }) => {
  const before = await page.locator('#s00 h1').textContent();
  await editText(page, 'QA UNDO');
  await action(page, 'undo').click();
  await expect(page.locator('#s00 h1')).toHaveText(before);
});

test('05 Restore Baseline clears text and draft storage', async ({ page }) => {
  const before = await page.locator('#s00 h1').textContent();
  await editText(page, 'QA RESTORE');
  await action(page, 'save').click();
  page.once('dialog', d => d.accept());
  await action(page, 'restore').click();
  await expect(page.locator('#s00 h1')).toHaveText(before);
  const draft = await page.evaluate(() => localStorage.getItem('dkt:editorial-console:v0.1:editorial/round-2a-v0.1.5'));
  expect(draft).toBeNull();
});

test('06 Compare shows before, after, classification and QC', async ({ page }) => {
  await editText(page, 'QA COMPARE');
  await action(page, 'compare').click();
  const panel = page.locator('#editor-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.ec-before')).toContainText('BEFORE');
  await expect(panel.locator('.ec-after')).toContainText('QA COMPARE');
  await expect(panel.locator('[data-ec-kind]')).toHaveValue('COPY_ONLY');
  await expect(panel).toContainText('EDITORIAL_DIFF');
});

test('07 Export downloads parseable changeset with source and text diff', async ({ page }) => {
  await editText(page, 'QA EXPORT');
  const data = await exported(page);
  expect(data.schema).toBe('interactive-editorial-changeset/v0.1');
  expect(data.source.branch).toBe('editorial/round-2a-v0.1.5');
  expect(data.source.repository).toBe('hoanddk/dkt-interactive');
  expect(data.changes.some(c => c.after === 'QA EXPORT' && c.before && c.timestamp)).toBe(true);
  expect(data.review.publishAllowed).toBe(false);
});

test('08 Save Draft survives reload and remains preview only', async ({ page }) => {
  await editText(page, 'QA PERSISTED DRAFT');
  await action(page, 'save').click();
  await page.reload();
  await expect(page.locator('#s00 h1')).toHaveText('QA PERSISTED DRAFT');
  await expect(page.locator('#ec-count')).toContainText('saved');
});

test('09 Exit Edit Mode returns to public page without controls', async ({ page }) => {
  await action(page, 'exit').click();
  await expect(page).not.toHaveURL(/edit=1/);
  await expect(page.locator('#editor-console')).toHaveCount(0);
  await expect(page.locator('.ec-asset-control')).toHaveCount(0);
});

test('10 Hero upload previews file, alt, caption and credit', async ({ page }) => {
  await openAsset(page, 'HERO_IMAGE');
  await saveAsset(page, { file:'hero-qa.png',caption:'QA caption',credit:'QA credit',alt:'QA alt',source:'QA fixture',reason:'QA upload' });
  const s = slot(page, 'HERO_IMAGE');
  await expect(s.locator('.ec-preview-image')).toBeVisible();
  await expect(s.locator('.ec-preview-image')).toHaveAttribute('alt','QA alt');
  await expect(s.locator('.ec-asset-display')).toContainText('QA caption');
  await expect(s.locator('.ec-asset-display')).toContainText('QA credit');
  expect((await getAssets(page)).find(r=>r.slot_id==='HERO_IMAGE').type).toBe('IMAGE_REPLACE');
});

test('11 Replace image updates upload manifest', async ({ page }) => {
  await openAsset(page, 'HERO_IMAGE');
  await saveAsset(page, {file:'first-qa.png',alt:'first',reason:'QA first'});
  await openAsset(page, 'HERO_IMAGE');
  await saveAsset(page, {file:'second-qa.png',alt:'second',reason:'QA replace'});
  const rec = (await getAssets(page)).find(r=>r.slot_id==='HERO_IMAGE');
  expect(rec.upload_manifest.file_name).toBe('second-qa.png');
  await expect(slot(page,'HERO_IMAGE').locator('.ec-preview-image')).toHaveAttribute('alt','second');
});

test('12 Remove image marks draft, Restore Baseline removes visual draft', async ({ page }) => {
  await openAsset(page, 'HERO_IMAGE');
  await saveAsset(page, {file:'remove-qa.png',alt:'removable',reason:'QA remove'});
  await openAsset(page, 'HERO_IMAGE');
  await page.locator('#ec-asset-remove').click();
  await page.locator('#ec-asset-save').click();
  await expect(slot(page,'HERO_IMAGE').locator('.ec-asset-empty')).toContainText('Ảnh đã được gỡ trong bản nháp');
  await openAsset(page, 'HERO_IMAGE');
  await page.locator('#ec-asset-restore').click();
  await expect(slot(page,'HERO_IMAGE').locator('.ec-asset-display')).toBeHidden();
  expect((await getAssets(page)).some(r=>r.slot_id==='HERO_IMAGE')).toBe(false);
});

test('13 Asset Undo reverts most recent visual edit', async ({ page }) => {
  await openAsset(page, 'HERO_IMAGE');
  await saveAsset(page, {file:'undo-qa.png',alt:'QA undo',reason:'QA undo'});
  await action(page,'undo').click();
  expect((await getAssets(page)).some(r=>r.slot_id==='HERO_IMAGE')).toBe(false);
});

test('14 Metadata round-trip across Save Draft and reload', async ({ page }) => {
  await openAsset(page, 'HERO_IMAGE');
  await saveAsset(page, {file:'metadata-qa.png',caption:'QA caption retained',credit:'QA credit retained',alt:'QA alt retained',source:'QA source retained',rights:'CLEARED',provenance:'COMPLETE',reason:'QA metadata'});
  await action(page,'save').click();
  await page.reload();
  await openAsset(page,'HERO_IMAGE');
  await expect(page.locator('#ec-asset-caption')).toHaveValue('QA caption retained');
  await expect(page.locator('#ec-asset-credit')).toHaveValue('QA credit retained');
  await expect(page.locator('#ec-asset-alt')).toHaveValue('QA alt retained');
  await expect(page.locator('#ec-asset-source')).toHaveValue('QA source retained');
  await expect(page.locator('#ec-asset-rights')).toHaveValue('CLEARED');
  await expect(page.locator('#ec-asset-provenance')).toHaveValue('COMPLETE');
  await page.locator('#ec-asset-cancel').click();
  await expect(slot(page,'HERO_IMAGE').locator('.ec-asset-display')).toContainText('Chưa có binary');
});

test('15 Unified Export contains image upload manifest and text change', async ({ page }) => {
  await editText(page,'QA MIXED EXPORT');
  await openAsset(page,'HERO_IMAGE');
  await saveAsset(page,{file:'manifest-qa.png',alt:'manifest',reason:'QA export'});
  const data = await exported(page);
  expect(data.changes.some(c=>c.after==='QA MIXED EXPORT')).toBe(true);
  expect(data.changes.some(c=>c.slot_id==='HERO_IMAGE')).toBe(true);
  expect(data.assetUploadManifest.some(x=>x.slot_id==='HERO_IMAGE'&&x.file_name==='manifest-qa.png')).toBe(true);
  expect(data.review.publishAllowed).toBe(false);
});

test('16 B04 Evidence Tower structurally locked in Edit Mode', async ({ page }) => {
  const b04=page.locator('#evidence-tower');
  await expect(b04.locator('[data-editorial-policy="EDITABLE"]')).toHaveCount(0);
  await expect(b04.locator('.ec-asset-control')).toHaveCount(0);
  const title=b04.locator('h2');
  const original=await title.textContent();
  await title.click();
  await expect(title).toHaveText(original);
  await expect(title).not.toHaveAttribute('contenteditable', /.+/);
});

test('17 B05 and B08 visual proposals retain HOLD_FOR_RESEARCH', async ({ page }) => {
  for(const id of ['B05_MODEL_A','B08_LEGAL_VISUAL']){
    await openAsset(page,id);
    await expect(page.locator('#ec-panel-body')).toContainText('Đang chờ xác minh tư liệu');
    await saveAsset(page,{caption:'QA hold proposal',alt:'QA hold',reason:'QA hold'});
    const r=(await getAssets(page)).find(x=>x.slot_id===id);
    expect(r.review_status).toBe('HOLD_FOR_RESEARCH');
    expect(r.publish_eligible).toBe(false);
    expect(r.gate_reasons).toContain('HOLD_FOR_RESEARCH');
  }
});

test('18 Evidence impact cannot downgrade below slot minimum', async ({ page }) => {
  for(const [id,minimum] of [['B01_REMAINS_VISUAL','EVIDENCE_SUPPORTING'],['B05_MODEL_A','EVIDENCE_AFFECTING'],['B08_LEGAL_VISUAL','CLAIM_AFFECTING']]){
    await openAsset(page,id);
    await saveAsset(page,{impact:'PRESENTATION_ONLY',caption:'QA impact',reason:'QA minimum'});
    const r=(await getAssets(page)).find(x=>x.slot_id===id);
    expect(r.evidence_impact).toBe(minimum);
  }
});

test('19 Reconstruction uncertainty cannot be removed from final gates', async ({ page }) => {
  await openAsset(page,'B06_ROOF_VISUAL');
  await saveAsset(page,{type:'RECONSTRUCTION',representation:'DOCUMENTARY_PHOTO',caption:'QA reconstructed roof',reason:'QA representation'});
  const r=(await getAssets(page)).find(x=>x.slot_id==='B06_ROOF_VISUAL');
  expect(r.gate_reasons).toContain('RECONSTRUCTION_LABEL_REQUIRED');
  expect(r.publish_eligible).toBe(false);
  expect(r.evidence_impact).toBe('EVIDENCE_AFFECTING');
});

test('20 Rights, provenance, placeholder and alt gates prohibit final', async ({ page }) => {
  await openAsset(page,'HERO_IMAGE');
  await saveAsset(page,{type:'PLACEHOLDER',alt:'',rights:'UNKNOWN',provenance:'MISSING',reason:'QA gate'});
  const r=(await getAssets(page)).find(x=>x.slot_id==='HERO_IMAGE');
  expect(r.gate_reasons).toEqual(expect.arrayContaining(['RIGHTS_NOT_CLEARED','PROVENANCE_NOT_COMPLETE','PLACEHOLDER_NOT_FINAL','ALT_REQUIRED']));
  expect(r.publish_eligible).toBe(false);
});

test('21 B01 hotspot remains interactive in edit mode', async ({ page }) => {
  await page.locator('#remains [data-hotspot="them"]').click();
  await expect(page.locator('#hotspot-card')).not.toContainText('Chạm một điểm để xem bằng chứng.');
});

test('22 B02 layer switch remains interactive', async ({ page }) => {
  await page.locator('#beneath [data-layer="Trần"]').click();
  await expect(page.locator('#beneath [data-layer="Trần"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#layer-info')).toContainText('Trần');
});

test('23 B03 plan toggle remains interactive', async ({ page }) => {
  await page.locator('#measure [data-plan="court"]').click();
  await expect(page.locator('#measure [data-plan="court"]')).toHaveAttribute('aria-pressed','true');
});

test('24 B04 five evidence levels remain interactive', async ({ page }) => {
  await page.locator('#evidence-tower [data-level-control="4"]').click();
  await expect(page.locator('#evidence-tower [data-level-control="4"]')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#tower-copy')).toContainText('Suy dựng');
});

test('25 B05 tabs remain interactive', async ({ page }) => {
  await page.locator('#tab-b').click();
  await expect(page.locator('#tab-b')).toHaveAttribute('aria-selected','true');
  await expect(page.locator('#model-b')).toBeVisible();
  await expect(page.locator('#model-a')).toBeHidden();
});

test('26 B06 reasoning and B08 verb ladder remain interactive', async ({ page }) => {
  await page.locator('#roof-case [data-reason="wood"]').click();
  await expect(page.locator('#reason-info')).not.toBeEmpty();
  await page.locator('#control-gates [data-verb="requests"]').click();
  await expect(page.locator('#verb-info')).not.toBeEmpty();
});

test('27 Keyboard Tab/Enter opens inline editor and Escape cancels', async ({ page }) => {
  const h1=page.locator('#s00 h1');
  const before=await h1.textContent();
  await h1.focus();
  await expect(h1).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(h1).toHaveAttribute('contenteditable','plaintext-only');
  await h1.fill('QA KEYBOARD');
  await page.keyboard.press('Escape');
  await expect(h1).toHaveText(before);
});

test('28 Asset panel Escape closes and keyboard focus remains usable', async ({ page }) => {
  await openAsset(page,'HERO_IMAGE');
  await expect(page.locator('#ec-asset-file')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#editor-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#editor-panel')).toBeHidden();
});

test('29 Compare panel Escape closes and returns focus', async ({ page }) => {
  await action(page,'compare').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#editor-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#editor-panel')).toBeHidden();
  await expect(action(page,'compare')).toBeFocused();
});

test('30 Viewport has no document-level horizontal overflow', async ({ page }) => {
  const dimensions=await page.evaluate(()=>({
    width:document.documentElement.clientWidth,
    scrollWidth:document.documentElement.scrollWidth,
    toolbar:document.querySelector('#editor-console').getBoundingClientRect().width
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width+1);
  expect(dimensions.toolbar).toBeLessThanOrEqual(dimensions.width+1);
});

test('31 Asset preview and caption wrap inside viewport', async ({ page }) => {
  await openAsset(page,'HERO_IMAGE');
  await saveAsset(page,{file:'responsive-qa.png',caption:'QA '.repeat(60),alt:'QA image',reason:'QA responsive'});
  const bounds=await slot(page,'HERO_IMAGE').locator('.ec-asset-display').boundingBox();
  expect(bounds).toBeTruthy();
  const width=page.viewportSize().width;
  expect(bounds.x).toBeGreaterThanOrEqual(-1);
  expect(bounds.x+bounds.width).toBeLessThanOrEqual(width+1);
});

test('32 No page errors on editor startup and core interactions', async ({ page }) => {
  const errors=[];
  page.on('pageerror',err=>errors.push(err.message));
  await page.reload();
  await action(page,'compare').click();
  await page.locator('#ec-close').click();
  await openAsset(page,'B01_REMAINS_VISUAL');
  await page.locator('#ec-asset-cancel').click();
  expect(errors).toEqual([]);
});


test('33 Asset default summary hides raw IDs, gate codes and technical manifest', async ({ page }) => {
  await openAsset(page,'HERO_IMAGE');
  await saveAsset(page,{file:'ux-qa.png',caption:'Chú thích ảnh QA',credit:'Tác giả QA',alt:'Mô tả ảnh QA',reason:'Kiểm tra UX'});
  const display=slot(page,'HERO_IMAGE').locator('.ec-asset-display');
  await expect(display.locator('.ec-preview-image')).toBeVisible();
  await expect(display.locator('.ec-asset-caption')).toContainText('Chú thích ảnh QA');
  await expect(display.locator('.ec-asset-credit')).toContainText('Tác giả QA');
  await expect(display.locator('.ec-asset-status')).toContainText('Not Final');
  await expect(display.locator('.ec-asset-warning')).toContainText('Chưa xác nhận quyền sử dụng');
  await expect(display.locator('.ec-asset-warning')).not.toContainText('RIGHTS_NOT_CLEARED');
  await expect(display.locator('.ec-asset-compact')).toContainText('Đồ họa biên tập');
  await expect(display.locator('.ec-asset-compact')).toContainText('Đã có');
  await expect(display.locator('.ec-asset-technical-data')).toBeHidden();
  await expect(display.locator('.ec-asset-advanced summary')).toHaveText('CHI TIẾT KỸ THUẬT');
  const children=await display.evaluate(el=>Array.from(el.children).map(n=>n.className));
  expect(children[0]).toContain('ec-preview-image');
});

test('34 Advanced toggle reveals technical metadata and closes on second click', async ({ page }) => {
  await openAsset(page,'HERO_IMAGE');
  await saveAsset(page,{file:'advanced-qa.png',alt:'Mô tả QA',reason:'QA advanced'});
  const details=slot(page,'HERO_IMAGE').locator('.ec-asset-advanced');
  await expect(details).not.toHaveAttribute('open',/.+/);
  await details.locator('summary').click();
  await expect(details).toHaveAttribute('open','');
  const technical=details.locator('.ec-asset-technical-data');
  await expect(technical).toContainText('asset_id');
  await expect(technical).toContainText('slot_id');
  await expect(technical).toContainText('RIGHTS_NOT_CLEARED');
  await expect(technical).toContainText('upload_manifest');
  await details.locator('summary').click();
  await expect(technical).toBeHidden();
});

test('35 Rights/provenance and accessibility warnings are editorial language', async ({ page }) => {
  await openAsset(page,'HERO_IMAGE');
  await saveAsset(page,{type:'PLACEHOLDER',alt:'',rights:'RESTRICTED',provenance:'PARTIAL',reason:''});
  const display=slot(page,'HERO_IMAGE').locator('.ec-asset-display');
  const warning=display.locator('.ec-asset-warning');
  await expect(warning).toContainText('Ảnh này chưa đủ điều kiện xuất bản');
  await expect(warning).toContainText('Chưa xác nhận quyền sử dụng');
  await expect(warning).toContainText('Thông tin nguồn gốc chưa đầy đủ');
  await expect(warning).toContainText('Chưa có mô tả ảnh cho accessibility');
  await expect(warning).toContainText('Cần ghi lý do thay ảnh');
  await expect(warning).not.toContainText('ALT_REQUIRED');
  await expect(display.locator('.ec-asset-compact')).toContainText('Bị hạn chế');
  await expect(display.locator('.ec-asset-compact')).toContainText('Một phần');
  const record=(await getAssets(page)).find(x=>x.slot_id==='HERO_IMAGE');
  expect(record.gate_reasons).toContain('RIGHTS_NOT_CLEARED');
  expect(record.publish_eligible).toBe(false);
});

test('36 Edit Asset panel keeps full fields and collapses technical details', async ({ page }) => {
  await openAsset(page,'B05_MODEL_A');
  await expect(page.locator('#ec-panel-body')).toContainText('Đang chờ xác minh tư liệu');
  for(const id of ['ec-asset-file','ec-asset-caption','ec-asset-credit','ec-asset-alt','ec-asset-source','ec-asset-rights','ec-asset-provenance','ec-asset-representation','ec-asset-impact','ec-asset-reason']){
    await expect(page.locator('#'+id)).toBeAttached();
  }
  const details=page.locator('#editor-panel .ec-asset-panel-advanced');
  await expect(details.locator('.ec-asset-technical-data')).toBeHidden();
  await details.locator('summary').click();
  await expect(details.locator('.ec-asset-technical-data')).toContainText('baseline_asset_id');
  await expect(details.locator('.ec-asset-technical-data')).toContainText('slot_id');
  await page.keyboard.press('Escape');
  await expect(page.locator('#editor-panel')).toBeHidden();
});

test('37 Caption and compact warning fit viewport after upload', async ({ page }) => {
  await openAsset(page,'HERO_IMAGE');
  await saveAsset(page,{file:'mobile-ux-qa.png',caption:'Chú thích dài '.repeat(40),credit:'Tòa soạn',alt:'QA',reason:'Kiểm tra mobile'});
  const display=slot(page,'HERO_IMAGE').locator('.ec-asset-display');
  const caption=display.locator('.ec-asset-caption');
  const bounds=await caption.boundingBox();
  expect(bounds).toBeTruthy();
  expect(bounds.x).toBeGreaterThanOrEqual(-1);
  expect(bounds.x+bounds.width).toBeLessThanOrEqual(page.viewportSize().width+1);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});


test('38 B01 hotspot click exposes the correct contextual asset editor and highlight', async ({ page }) => {
  const hotspots=['them','rong','nen'];
  for(let i=0;i<hotspots.length;i++){
    const hotspot=page.locator('#remains [data-hotspot="'+hotspots[i]+'"]');
    await hotspot.click();
    await expect(hotspot).toHaveClass(/ec-hotspot-selected/);
    const context=page.locator('#hotspot-card .ec-hotspot-context-action');
    await expect(context).toHaveCount(1);
    await expect(context).toContainText('ĐIỂM TƯƠNG TÁC '+(i+1));
    await context.click();
    await expect(page.locator('#ec-panel-title')).toHaveText('CHỈNH ẢNH — ĐIỂM TƯƠNG TÁC '+(i+1));
    await expect(page.locator('#editor-panel .ec-asset-section')).toContainText('B01 — Dấu tích còn lại');
    await expect(slot(page,'B01_HOTSPOT_0'+(i+1))).toHaveClass(/ec-hotspot-asset-selected/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#editor-panel')).toBeHidden();
  }
});

test('39 B01 hotspot asset slots save, reload and export independently', async ({ page }) => {
  for(let i=1;i<=3;i++){
    const id='B01_HOTSPOT_0'+i;
    await openAsset(page,id);
    await expect(page.locator('#ec-panel-title')).toContainText('ĐIỂM TƯƠNG TÁC '+i);
    await saveAsset(page,{file:'hotspot-'+i+'.png',caption:'Ảnh riêng điểm '+i,credit:'Tác giả '+i,alt:'Mô tả điểm '+i,reason:'Kiểm tra slot '+i});
  }
  const records=await getAssets(page);
  expect(records.filter(x=>x.slot_id.startsWith('B01_HOTSPOT_'))).toHaveLength(3);
  expect(records.find(x=>x.slot_id==='B01_REMAINS_VISUAL')).toBeUndefined();
  for(let i=1;i<=3;i++){
    const id='B01_HOTSPOT_0'+i;
    const rec=records.find(x=>x.slot_id===id);
    expect(rec.new.caption).toBe('Ảnh riêng điểm '+i);
    expect(rec.evidence_impact).toBe('EVIDENCE_SUPPORTING');
    expect(rec.publish_eligible).toBe(false);
  }
  const data=await exported(page);
  for(let i=1;i<=3;i++)expect(data.changes.some(x=>x.slot_id==='B01_HOTSPOT_0'+i)).toBe(true);
  await action(page,'save').click();
  await page.reload();
  for(let i=1;i<=3;i++){
    const id='B01_HOTSPOT_0'+i;
    await expect(slot(page,id).locator('.ec-asset-caption')).toContainText('Ảnh riêng điểm '+i);
    await openAsset(page,id);
    await expect(page.locator('#ec-asset-caption')).toHaveValue('Ảnh riêng điểm '+i);
    await page.locator('#ec-asset-cancel').click();
  }
});

test('40 Asset editor uses Vietnamese labels and options without exposing raw codes by default', async ({ page }) => {
  await openAsset(page,'B01_HOTSPOT_02');
  const panel=page.locator('#ec-panel-body');
  for(const label of ['Loại hình ảnh','Chú thích ảnh','Nguồn / Tác giả','Mô tả ảnh cho người dùng khiếm thị','Ảnh trang trí','Nguồn tư liệu / Bối cảnh','Quyền sử dụng','Nguồn gốc tư liệu','Nhãn hiển thị','Mức ảnh hưởng đến bằng chứng','Lý do thay đổi']){
    await expect(panel.locator('label').filter({hasText:label}).first()).toBeVisible();
  }
  await expect(page.locator('#ec-asset-type option[value="EDITORIAL_GRAPHIC"]')).toHaveText('Đồ họa biên tập');
  await expect(page.locator('#ec-asset-type option[value="PHOTO_CURRENT"]')).toHaveText('Ảnh hiện trạng');
  await expect(page.locator('#ec-asset-type option[value="RECONSTRUCTION"]')).toHaveText('Hình phục dựng');
  await expect(page.locator('#ec-asset-type option[value="SCHEMATIC"]')).toHaveText('Sơ đồ minh họa');
  await expect(page.locator('#ec-asset-rights option[value="NOT_CHECKED"]')).toHaveText('Chưa kiểm tra');
  await expect(page.locator('#ec-asset-provenance option[value="MISSING"]')).toHaveText('Thiếu thông tin');
  await expect(page.locator('#ec-asset-impact option[value="PRESENTATION_ONLY"]')).toHaveText('Chỉ thay đổi trình bày');
  await expect(page.locator('#ec-asset-impact option[value="EVIDENCE_SUPPORTING"]')).toHaveText('Hỗ trợ bằng chứng');
  await expect(page.locator('#ec-asset-impact option[value="EVIDENCE_AFFECTING"]')).toHaveText('Có ảnh hưởng đến bằng chứng');
  await expect(page.locator('#ec-asset-impact option[value="CLAIM_AFFECTING"]')).toHaveText('Có ảnh hưởng đến nhận định');
  const visible=await panel.evaluate(el=>el.innerText);
  expect(visible).not.toContain('BASELINE_PLACEHOLDER_B01_HOTSPOT_02');
  expect(visible).not.toContain('NOT_CHECKED');
  expect(visible).not.toContain('EVIDENCE_SUPPORTING');
  const advanced=panel.locator('.ec-asset-panel-advanced');
  await advanced.locator('summary').click();
  await expect(advanced.locator('pre')).toContainText('B01_HOTSPOT_02');
  await expect(advanced.locator('pre')).toContainText('NOT_CHECKED');
});

test('41 Hotspot minimum evidence impact remains enforced; public mode stays clean', async ({ page }) => {
  await openAsset(page,'B01_HOTSPOT_03');
  await saveAsset(page,{impact:'PRESENTATION_ONLY',caption:'Đề xuất ảnh điểm 3',reason:'QA evidence guard'});
  const rec=(await getAssets(page)).find(x=>x.slot_id==='B01_HOTSPOT_03');
  expect(rec.evidence_impact).toBe('EVIDENCE_SUPPORTING');
  expect(rec.new.evidence_level).toBe('2');
  expect(rec.publish_eligible).toBe(false);
  await page.goto('/');
  await expect(page.locator('.ec-hotspot-asset-group')).toHaveCount(0);
  await expect(page.locator('.ec-hotspot-context-action')).toHaveCount(0);
  await expect(page.locator('#remains [data-hotspot]')).toHaveCount(3);
});

test('42 B01 hotspot contextual edit action supports keyboard and mobile width', async ({ page }) => {
  const hotspot=page.locator('#remains [data-hotspot="rong"]');
  await hotspot.focus();
  await page.keyboard.press('Enter');
  const actionButton=page.locator('#hotspot-card .ec-hotspot-context-action');
  await expect(actionButton).toBeVisible();
  await actionButton.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#ec-panel-title')).toContainText('ĐIỂM TƯƠNG TÁC 2');
  await page.keyboard.press('Escape');
  await expect(page.locator('#editor-panel')).toBeHidden();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
