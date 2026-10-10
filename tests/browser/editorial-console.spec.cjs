const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aFqkAAAAASUVORK5CYII=','base64');
const action = (page,name) => page.locator('#editor-console [data-ec-action="'+name+'"]');
const file = (name,mimeType='image/png',buffer=PNG) => ({name,mimeType,buffer});

async function cleanEdit(page){
  await page.goto('/');
  await page.evaluate(()=>localStorage.clear());
  await page.goto('/?edit=1');
  await expect(page.locator('#editor-console')).toBeVisible();
  await expect(page.locator('#editor-console')).toContainText('BẢNG BIÊN TẬP INTERACTIVE');
}
async function editHeroTitle(page,text){
  const h1=page.locator('#s00 h1[data-editorial-policy="EDITABLE"]');
  await h1.click();
  await expect(h1).toHaveAttribute('contenteditable','plaintext-only');
  await h1.fill(text);
  await h1.press('Enter');
  await expect(h1).toHaveText(text);
  return h1;
}
async function openPublication(page){
  await action(page,'publication').click();
  await expect(page.locator('#editor-panel')).toBeVisible();
  await expect(page.locator('#ec-panel-title')).toHaveText('THÔNG TIN XUẤT BẢN');
}
async function savePublication(page){
  await page.locator('#ec-publication-save').click();
  await expect(page.locator('#editor-panel')).toBeHidden();
}
async function openHeroMedia(page){
  await page.getByRole('button',{name:'CHỈNH MEDIA'}).first().click();
  await expect(page.locator('#editor-panel')).toBeVisible();
  await expect(page.locator('#ec-panel-title')).toContainText('HERO');
}
async function exportPayload(page){
  const details=page.locator('#editor-console .ec-tools');
  if(!(await details.getAttribute('open'))) await details.locator('summary').click();
  const pending=page.waitForEvent('download');
  await action(page,'export').click();
  const dl=await pending;
  return JSON.parse(await fs.readFile(await dl.path(),'utf8'));
}

test.beforeEach(async ({page})=>{ await cleanEdit(page); });

test('01 public mode has no Editorial Console', async ({page})=>{
  await page.goto('/');
  await expect(page.locator('#editor-console')).toHaveCount(0);
  await expect(page.locator('#editor-panel')).toHaveCount(0);
  await expect(page.locator('.ec-visual-control')).toHaveCount(0);
});

test('02 primary toolbar is Vietnamese and simple', async ({page})=>{
  const bar=page.locator('#editor-console');
  for(const label of ['LƯU NHÁP','HOÀN TÁC','LÀM LẠI','LỊCH SỬ','THÔNG TIN XUẤT BẢN','XEM TRƯỚC','THOÁT BIÊN TẬP']) await expect(bar).toContainText(label);
  await expect(bar.locator('.ec-actions')).not.toContainText('EXPORT CHANGES');
  await expect(bar.locator('.ec-actions')).not.toContainText('EDIT ASSET');
  await expect(bar.locator('.ec-actions')).not.toContainText('RESTORE BASELINE');
  await expect(bar).toContainText('ĐANG BIÊN TẬP');
  await expect(bar).toContainText('HOÀN THIỆN BIÊN TẬP');
});

test('03 advanced tools contain restore and technical export', async ({page})=>{
  const tools=page.locator('#editor-console .ec-tools');
  await expect(tools.locator('summary')).toHaveText('CÔNG CỤ NÂNG CAO');
  await tools.locator('summary').click();
  await expect(action(page,'restore')).toHaveText('KHÔI PHỤC BẢN GỐC');
  await expect(action(page,'export')).toHaveText('XUẤT GÓI THAY ĐỔI');
});

test('04 inline visible copy edits directly', async ({page})=>{
  await editHeroTitle(page,'QA — tiêu đề đang biên tập');
  await expect(page.locator('#ec-count')).toContainText('thay đổi');
});

test('05 Save Draft survives reload', async ({page})=>{
  await editHeroTitle(page,'QA — tiêu đề đã lưu');
  await action(page,'save').click();
  await page.reload();
  await expect(page.locator('#s00 h1')).toHaveText('QA — tiêu đề đã lưu');
  await expect(page.locator('#ec-count')).toContainText('đã lưu');
});

test('06 Undo and Redo work for text edits', async ({page})=>{
  const original=await page.locator('#s00 h1').textContent();
  await editHeroTitle(page,'QA — hoàn tác/làm lại');
  await action(page,'undo').click();
  await expect(page.locator('#s00 h1')).toHaveText(original);
  await action(page,'redo').click();
  await expect(page.locator('#s00 h1')).toHaveText('QA — hoàn tác/làm lại');
});

test('07 keyboard Ctrl+Z and Ctrl+Shift+Z work', async ({page})=>{
  const original=await page.locator('#s00 h1').textContent();
  await editHeroTitle(page,'QA — keyboard undo');
  await page.keyboard.press('Control+z');
  await expect(page.locator('#s00 h1')).toHaveText(original);
  await page.keyboard.press('Control+Shift+z');
  await expect(page.locator('#s00 h1')).toHaveText('QA — keyboard undo');
});

test('08 History is readable and technical details collapsed', async ({page})=>{
  const original=await page.locator('#s00 h1').textContent();
  await editHeroTitle(page,'QA — lịch sử dễ đọc');
  await action(page,'history').click();
  const p=page.locator('#editor-panel');
  await expect(p).toContainText('LỊCH SỬ CHỈNH SỬA');
  await expect(p).toContainText('TRƯỚC');
  await expect(p).toContainText('SAU');
  await expect(p).toContainText(original);
  await expect(p).toContainText('QA — lịch sử dễ đọc');
  await expect(p.locator('.ec-asset-advanced pre').first()).toBeHidden();
});

test('09 Export stays advanced and downloads a non-publishing changeset', async ({page})=>{
  await editHeroTitle(page,'QA — export');
  const data=await exportPayload(page);
  expect(data.schema).toBe('interactive-editorial-changeset/v0.4');
  expect(data.source.branch).toBe('editorial/round-2a-v0.1.5');
  expect(data.review.mergeAllowed).toBe(false);
  expect(data.review.publishAllowed).toBe(false);
});

test('10 Restore baseline keeps an undo path', async ({page})=>{
  const original=await page.locator('#s00 h1').textContent();
  await editHeroTitle(page,'QA — restore');
  await page.locator('#editor-console .ec-tools summary').click();
  page.once('dialog',d=>d.accept());
  await action(page,'restore').click();
  await expect(page.locator('#s00 h1')).toHaveText(original);
  await action(page,'undo').click();
  await expect(page.locator('#s00 h1')).toHaveText('QA — restore');
});

test('11 clean Exit Edit Mode removes edit query without false warning', async ({page})=>{
  await action(page,'exit').click();
  await expect(page).not.toHaveURL(/edit=1/);
  await expect(page.locator('#editor-console')).toHaveCount(0);
});

test('12 B04 remains structurally locked while interaction works', async ({page})=>{
  await expect(page.locator('#evidence-tower [data-editorial-policy="EDITABLE"]')).toHaveCount(0);
  const h2=page.locator('#evidence-tower h2');
  await expect(h2).toHaveAttribute('data-editorial-policy','LOCKED');
  await page.locator('#evidence-tower [data-level-control="4"]').click();
  await expect(page.locator('#tower-copy h3')).toContainText('Lớp 4');
});

test('13 B05 allows wording proposal but retains HOLD state', async ({page})=>{
  const h2=page.locator('#models h2');
  const original=await h2.textContent();
  await expect(h2).toHaveAttribute('data-editorial-policy','HOLD_FOR_RESEARCH');
  await h2.click();
  await expect(page.locator('#editor-panel')).toContainText('CHỜ BỔ SUNG NGHIÊN CỨU');
  await page.locator('#ec-proposed').fill('QA — đề xuất câu chữ B05');
  await page.locator('#ec-proposed-save').click();
  await expect(h2).toHaveText(original);
  const record=await page.evaluate(()=>Object.values(window.__editorialConsoleV04.state.text).find(x=>x.section==='B05'));
  expect(record.previewOnly).toBe(true);
  expect(record.policy).toBe('HOLD_FOR_RESEARCH');
});

test('14 B08 allows wording proposal without changing research hold', async ({page})=>{
  const h2=page.locator('#control-gates h2');
  await expect(h2).toHaveAttribute('data-editorial-policy','HOLD_FOR_RESEARCH');
  await h2.click();
  await page.locator('#ec-proposed').fill('QA — đề xuất câu chữ B08');
  await page.locator('#ec-proposed-save').click();
  const record=await page.evaluate(()=>Object.values(window.__editorialConsoleV04.state.text).find(x=>x.section==='B08'));
  expect(record.previewOnly).toBe(true);
  expect(record.policy).toBe('HOLD_FOR_RESEARCH');
});

test('15 B06 normal click keeps interaction; double click opens wording editor', async ({page})=>{
  const btn=page.locator('#roof-case [data-reason="wood"]');
  await btn.click();
  await expect(page.locator('#reason-info h3')).toContainText('Cấu kiện gỗ');
  await btn.dblclick();
  await expect(page.locator('#ec-panel-title')).toHaveText('CHỈNH NỘI DUNG TƯƠNG TÁC — B06');
  await expect(page.locator('#b06-label')).toBeVisible();
});

test('16 B06 tab labels are editable but item key/order remain locked', async ({page})=>{
  const btn=page.locator('#roof-case [data-reason="tile"]');
  await btn.dblclick();
  await page.locator('#b06-label').fill('1 · Ngói khảo cổ');
  await page.locator('#b06-save').click();
  await expect(btn).toHaveText('1 · Ngói khảo cổ');
  const item=await page.evaluate(()=>window.__editorialConsoleV04.state.interactive.B06.items[0]);
  expect(item.key).toBe('tile');
  await action(page,'undo').click();
  await expect(btn).toContainText('Ngói thật');
  await action(page,'redo').click();
  await expect(btn).toHaveText('1 · Ngói khảo cổ');
});

test('17 B03 routes to structured graphic editor by default', async ({page})=>{
  await page.getByRole('button',{name:'CHỈNH NỘI DUNG ĐỒ HỌA'}).click();
  await expect(page.locator('#ec-panel-title')).toHaveText('CHỈNH ĐỒ HỌA — B03');
  await expect(page.locator('#editor-panel')).toContainText('ĐỒ HỌA CÓ CẤU TRÚC');
  await expect(page.locator('#b03-project')).toBeVisible();
  await expect(page.locator('#ec-media-file')).toHaveCount(0);
  await expect(page.getByRole('button',{name:'THAY TOÀN BỘ ĐỒ HỌA'})).toBeVisible();
});

test('18 B03 field edit preserves plan interaction', async ({page})=>{
  await page.getByRole('button',{name:'CHỈNH NỘI DUNG ĐỒ HỌA'}).click();
  await page.locator('#b03-project').fill('PHẠM VI DỰ ÁN ≈ 10.700 m²');
  await page.locator('#b03-save').click();
  await expect(page.locator('#plan-visual .project span')).toHaveText('PHẠM VI DỰ ÁN ≈ 10.700 m²');
  const toggle=page.locator('#measure [data-plan="project"]');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed','true');
});

test('19 B03 numeric change becomes evidence-affecting', async ({page})=>{
  await page.getByRole('button',{name:'CHỈNH NỘI DUNG ĐỒ HỌA'}).click();
  await page.locator('#b03-project').fill('TOÀN DỰ ÁN ≈ 10.701 m²');
  await page.locator('#b03-save').click();
  const d=await page.evaluate(()=>window.__editorialConsoleV04.state.structured.B03);
  expect(d.evidence_impact).toBe('EVIDENCE_AFFECTING');
});

test('20 B03 whole-graphic replacement is a secondary media flow', async ({page})=>{
  await page.getByRole('button',{name:'CHỈNH NỘI DUNG ĐỒ HỌA'}).click();
  await page.getByRole('button',{name:'THAY TOÀN BỘ ĐỒ HỌA'}).click();
  await expect(page.locator('#ec-panel-title')).toHaveText('THAY TOÀN BỘ ĐỒ HỌA — B03');
  await expect(page.locator('#ec-media-file')).toBeVisible();
});

test('21 clicking B01 hotspot opens the matching contextual item action', async ({page})=>{
  for(const [i,key] of ['them','rong','nen'].entries()){
    const btn=page.locator('#remains [data-hotspot="'+key+'"]');
    await btn.click();
    await expect(btn).toHaveClass(/ec-hotspot-selected/);
    const edit=page.locator('#hotspot-card [data-ec-hotspot-edit]');
    await expect(edit).toContainText('ĐIỂM TƯƠNG TÁC '+(i+1));
    await edit.click();
    await expect(page.locator('#ec-panel-title')).toHaveText('CHỈNH THÀNH PHẦN TƯƠNG TÁC — B01');
    await expect(page.locator('#b01-item-form h3')).toHaveText('ĐIỂM TƯƠNG TÁC '+(i+1));
    await page.keyboard.press('Escape');
  }
});

test('22 B01 items edit independently and evidence level stays locked', async ({page})=>{
  await page.locator('#remains [data-hotspot="them"]').click();
  await page.locator('#hotspot-card [data-ec-hotspot-edit]').click();
  await page.locator('#b01-title').fill('QA — Điểm 1');
  await page.locator('#b01-save').click();
  const items=await page.evaluate(()=>window.__editorialConsoleV04.state.interactive.B01.items);
  expect(items[0].title).toBe('QA — Điểm 1');
  expect(items[1].title).not.toBe('QA — Điểm 1');
  expect(items[0].evidence_level).toBe('1');
  expect(items[2].evidence_level).toBe('2');
});

test('23 B01 item has its own media editor', async ({page})=>{
  await page.locator('#remains [data-hotspot="rong"]').click();
  await page.locator('#hotspot-card [data-ec-hotspot-edit]').click();
  await page.getByRole('button',{name:'CHỈNH MEDIA CỦA ĐIỂM'}).click();
  await expect(page.locator('#ec-panel-title')).toContainText('ĐIỂM TƯƠNG TÁC 2');
  const technical=page.locator('#editor-panel .ec-asset-advanced');
  await technical.locator('summary').click();
  await expect(technical.locator('pre')).toContainText('B01_HOTSPOT_02');
});

test('24 Hero media editor is Vietnamese-first and has no fake Rights gate', async ({page})=>{
  await openHeroMedia(page);
  const p=page.locator('#editor-panel');
  await expect(p).toContainText('Ảnh hoặc video');
  await expect(p).toContainText('Chú thích');
  await expect(p).toContainText('Tác giả / Nguồn');
  await expect(p).toContainText('Nguồn tư liệu / Bối cảnh');
  await expect(p).not.toContainText('Rights status');
  await expect(p).not.toContainText('Quyền sử dụng');
});

test('25 image upload/replace produces an editor preview', async ({page})=>{
  await openHeroMedia(page);
  await page.locator('#ec-media-file').setInputFiles(file('hero-qa.png'));
  await page.locator('#ec-media-caption').fill('Chú thích QA');
  await page.locator('#ec-media-credit').fill('Tác giả QA');
  await page.locator('#ec-media-alt').fill('Mô tả QA');
  await page.locator('#ec-media-show-caption').check();
  await page.locator('#ec-media-save').click();
  await expect(page.locator('#s00 .ec-media-draft .ec-preview-image')).toBeVisible();
  await expect(page.locator('#s00 .ec-reader-caption')).toHaveText('Chú thích QA');
  await expect(page.locator('#s00 .ec-reader-credit')).toHaveText('Tác giả QA');
});

test('26 optional caption hides cleanly', async ({page})=>{
  await openHeroMedia(page);
  await page.locator('#ec-media-file').setInputFiles(file('hero-no-caption.png'));
  await page.locator('#ec-media-caption').fill('Không hiển thị dòng này');
  await page.locator('#ec-media-show-caption').uncheck();
  await page.locator('#ec-media-save').click();
  await expect(page.locator('#s00 .ec-reader-caption')).toHaveCount(0);
});

test('27 media metadata edit participates in Undo/Redo', async ({page})=>{
  await openHeroMedia(page);
  await page.locator('#ec-media-caption').fill('QA media metadata');
  await page.locator('#ec-media-show-caption').check();
  await page.locator('#ec-media-save').click();
  await expect(page.locator('#s00 .ec-reader-caption')).toHaveText('QA media metadata');
  await action(page,'undo').click();
  await expect(page.locator('#s00 .ec-reader-caption')).toHaveCount(0);
  await action(page,'redo').click();
  await expect(page.locator('#s00 .ec-reader-caption')).toHaveText('QA media metadata');
});

test('28 video slot smoke test exposes practical options and soft guidance', async ({page})=>{
  await openHeroMedia(page);
  await page.locator('#ec-media-file').setInputFiles(file('clip.mp4','video/mp4',Buffer.alloc(2048)));
  await expect(page.locator('.ec-video-options')).toBeVisible();
  await expect(page.locator('#ec-media-ratio')).toBeVisible();
  await expect(page.locator('#ec-media-autoplay')).toBeVisible();
  await expect(page.locator('#ec-media-loop')).toBeVisible();
  await page.locator('#ec-media-autoplay').check();
  await page.locator('#ec-media-save').click();
  const media=await page.evaluate(()=>window.__editorialConsoleV04.state.media.HERO_MEDIA);
  expect(media.media_type).toBe('VIDEO');
  expect(media.warnings.some(x=>x.includes('poster'))).toBe(true);
  expect(media.warnings.some(x=>x.includes('Tự phát'))).toBe(true);
});

test('29 Publication metadata panel exposes newsroom fields', async ({page})=>{
  await openPublication(page);
  const p=page.locator('#editor-panel');
  for(const label of ['Cơ quan báo chí / Măng-sét','Chuyên mục','Tiêu đề','Sapo','Tác giả / Nhóm tác giả','Ngày xuất bản','Giờ xuất bản','Ngày cập nhật gần nhất','URL slug']) await expect(p).toContainText(label);
});

test('30 Publication title/sapo and optional footer are data-driven', async ({page})=>{
  await openPublication(page);
  await page.locator('[data-pub="title"]').fill('QA — Tiêu đề xuất bản');
  await page.locator('[data-pub="sapo"]').fill('QA — Sapo xuất bản');
  await page.locator('[data-footer="authors"]').fill('Nhóm tác giả QA');
  await page.locator('[data-footer="graphics"]').fill('');
  await savePublication(page);
  await expect(page.locator('#s00 h1')).toHaveText('QA — Tiêu đề xuất bản');
  await expect(page.locator('#s00 .dek')).toHaveText('QA — Sapo xuất bản');
  await expect(page.locator('.site-footer')).toContainText('Nhóm tác giả QA');
  await expect(page.locator('.site-footer')).not.toContainText('Đồ họa / Thiết kế');
});

test('31 empty footer fields render nothing in reader preview', async ({page})=>{
  await openPublication(page);
  for(const el of await page.locator('[data-footer]').all()) await el.fill('');
  await savePublication(page);
  await action(page,'save').click();
  await page.goto('/?preview=1');
  await expect(page.locator('#editor-console')).toHaveCount(0);
  await expect(page.locator('.site-footer .wrap p')).toHaveCount(0);
});

test('32 Preview opens reader mode and share is available', async ({page})=>{
  const href=await page.locator('[data-ec-action="preview"]').getAttribute('href');
  expect(href).toContain('preview=1');
  expect(href).not.toContain('edit=1');
  await page.goto('/?preview=1');
  await expect(page.locator('#editor-console')).toHaveCount(0);
  await expect(page.locator('.reader-share [data-share-native]')).toHaveText('Chia sẻ');
  await expect(page.locator('.reader-share [data-share-copy]')).toHaveText('Sao chép liên kết');
});

test('33 Reader view does not expose internal workflow codes', async ({page})=>{
  await page.goto('/');
  const visible=await page.locator('body').innerText();
  for(const raw of ['HOLD_FOR_RESEARCH','EVIDENCE-SENSITIVE','B01_HOTSPOT_01','RIGHTS_NOT_CLEARED','PROVENANCE_NOT_COMPLETE','asset_id','slot_id']) expect(visible).not.toContain(raw);
  expect(visible).not.toContain('MÔ HÌNH BIÊN TẬP VỀ MỨC BẰNG CHỨNG');
  expect(visible).not.toContain('MỨC BẰNG CHỨNG 5');
});

test('34 B01/B03/B05/B06/B08 reader interactions still work', async ({page})=>{
  await page.goto('/');
  await page.locator('#remains [data-hotspot="them"]').click();
  await expect(page.locator('#hotspot-card h3')).toContainText('Thềm rồng');
  await page.locator('#measure [data-plan="court"]').click();
  await expect(page.locator('#measure [data-plan="court"]')).toHaveAttribute('aria-pressed','true');
  await page.locator('#tab-b').click();
  await expect(page.locator('#tab-b')).toHaveAttribute('aria-selected','true');
  await page.locator('#roof-case [data-reason="wood"]').click();
  await expect(page.locator('#reason-info h3')).toContainText('Cấu kiện gỗ');
  await page.locator('#control-gates [data-verb="requests"]').click();
  await expect(page.locator('#verb-info')).toContainText('Đưa ra yêu cầu');
});

test('35 editor panel Escape closes and returns focus', async ({page})=>{
  await action(page,'publication').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#editor-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#editor-panel')).toBeHidden();
  await expect(action(page,'publication')).toBeFocused();
});

test('36 page has no horizontal overflow at configured viewport', async ({page})=>{
  const d=await page.evaluate(()=>({client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,toolbar:document.querySelector('#editor-console').getBoundingClientRect().width}));
  expect(d.scroll).toBeLessThanOrEqual(d.client+1);
  expect(d.toolbar).toBeLessThanOrEqual(d.client+1);
});

test('37 no uncaught page errors during core editor routing', async ({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.reload();
  await action(page,'publication').click();await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'CHỈNH NỘI DUNG ĐỒ HỌA'}).click();await page.keyboard.press('Escape');
  await page.locator('#remains [data-hotspot="nen"]').click();
  await page.locator('#hotspot-card [data-ec-hotspot-edit]').click();await page.keyboard.press('Escape');
  expect(errors).toEqual([]);
});
