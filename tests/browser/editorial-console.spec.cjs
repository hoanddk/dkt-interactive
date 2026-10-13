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
  await expect(page.locator('#editor-console')).toContainText('BẢNG BIÊN TẬP BÀI TƯƠNG TÁC');
}
async function editVisible(page,selector,text){
  const target=page.locator(selector);
  await target.click();
  await expect(target).toHaveAttribute('contenteditable','plaintext-only');
  await target.fill(text);
  await target.press('Tab'); // blur commits to the draft
  await expect(target).toHaveText(text);
  return target;
}
async function finishDraftSave(page){
  await action(page,'save').click();
  await expect(page.locator('#ec-notice')).toContainText('Đã lưu toàn bộ bản nháp');
}
async function editHeroTitle(page,text){
  return editVisible(page,'#s00 h1[data-editorial-policy="EDITABLE"]',text);
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
  await page.locator('#s00 .asset-frame').click({position:{x:10,y:10}});
  await expect(page.locator('#editor-panel')).toBeVisible();
  await expect(page.locator('#ec-panel-title')).toContainText('THAY ẢNH / VIDEO');
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

test('12 B04 interaction logic locked; heading uses shared copy editor', async ({page})=>{
  await expect(page.locator('#evidence-tower .tower-visual-wrap [data-editorial-policy="EDITABLE"]')).toHaveCount(0);
  await editVisible(page,'#evidence-tower .narrow h2','QA — Mức chắc chắn');
  await page.locator('#evidence-tower [data-level-control="4"]').click();
  await expect(page.locator('#tower-copy h3')).toContainText('Lớp 4');
});

test('13 B05 wording editable on canvas while HOLD stays locked', async ({page})=>{
  const h2=page.locator('#models h2');const original=await h2.textContent();
  await expect(h2).toHaveAttribute('data-editorial-policy','HOLD_FOR_RESEARCH');
  await editVisible(page,'#models h2','QA — Câu chữ B05');
  await expect(page.locator('#models .ec-block-warning')).toHaveCount(1);
  const record=await page.evaluate(()=>Object.values(window.__editorialConsoleV04.state.text).find(x=>x.section==='B05'));
  expect(record.previewOnly).toBe(true);expect(record.policy).toBe('HOLD_FOR_RESEARCH');
  await action(page,'save').click();await page.goto('/?preview=1');
  await expect(page.locator('#models h2')).toHaveText(original);
});

test('14 B08 wording editable while research status remains HOLD', async ({page})=>{
  await expect(page.locator('#control-gates h2')).toHaveAttribute('data-editorial-policy','HOLD_FOR_RESEARCH');
  await editVisible(page,'#control-gates h2','QA — Câu chữ B08');
  await expect(page.locator('#control-gates .ec-block-warning')).toHaveCount(1);
  const record=await page.evaluate(()=>Object.values(window.__editorialConsoleV04.state.text).find(x=>x.section==='B08'));
  expect(record.previewOnly).toBe(true);expect(record.policy).toBe('HOLD_FOR_RESEARCH');
});

test('15 B06 click interacts and double-click enables native caret', async ({page})=>{
  const btn=page.locator('#roof-case [data-reason="wood"]');
  await btn.click();await expect(page.locator('#reason-info h3')).toContainText('Cấu kiện gỗ');
  await btn.dblclick();await expect(btn).toHaveAttribute('contenteditable','plaintext-only');
  await btn.press('Escape');await expect(btn).not.toHaveAttribute('contenteditable','plaintext-only');
});

test('16 B06 tab labels direct edit while keys and Undo/Redo stay stable', async ({page})=>{
  const btn=page.locator('#roof-case [data-reason="tile"]');
  await btn.dblclick();await btn.fill('1 · Ngói khảo cổ');await btn.press('Tab');
  await expect(btn).toHaveText('1 · Ngói khảo cổ');
  const item=await page.evaluate(()=>window.__editorialConsoleV04.state.interactive.B06.items[0]);
  expect(item.key).toBe('tile');
  await action(page,'undo').click();await expect(btn).toContainText('Ngói thật');
  await action(page,'redo').click();await expect(btn).toHaveText('1 · Ngói khảo cổ');
});

test('17 B03 mapped copy uses native direct edit without geometry change', async ({page})=>{
  const target=page.locator('#plan-visual .project span');
  await target.click();await expect(target).toHaveAttribute('contenteditable','plaintext-only');
  await expect(page.locator('#editor-panel')).toBeHidden();
  await target.press('Escape');
});

test('18 B03 copy edits preserve interactive plan toggle', async ({page})=>{
  await editVisible(page,'#plan-visual .project span','PHẠM VI DỰ ÁN ≈ 10.700 m²');
  const toggle=page.locator('#measure [data-plan="project"]');
  const initial=await toggle.getAttribute('aria-pressed');await toggle.click();
  await expect(toggle).toHaveAttribute('aria-pressed',initial==='true'?'false':'true');
});

test('19 B03 changed numeric evidence impact remains protected', async ({page})=>{
  await editVisible(page,'#plan-visual .project span','TOÀN DỰ ÁN ≈ 10.701 m²');
  const d=await page.evaluate(()=>window.__editorialConsoleV04.state.structured.B03);
  expect(d.evidence_impact).toBe('EVIDENCE_AFFECTING');
});

test('20 B03 image replacement uses shared media flow', async ({page})=>{
  await page.getByRole('button',{name:'THAY ẢNH / VIDEO'}).last().click();
  await expect(page.locator('#ec-panel-title')).toHaveText('THAY ẢNH / VIDEO');
  await expect(page.locator('#ec-media-file')).toBeVisible();
});

test('21 B01 hotspot title opens the same text editor', async ({page})=>{
  await page.locator('#remains [data-hotspot="them"]').click();
  await editVisible(page,'#hotspot-card [data-ec-copy="B01:title:0"]','QA — Điểm 1');
  await page.locator('#remains [data-hotspot="rong"]').click();
  await expect(page.locator('#hotspot-card h3')).not.toHaveText('QA — Điểm 1');
});

test('22 B01 direct body edit preserves evidence level and independent items', async ({page})=>{
  await page.locator('#remains [data-hotspot="them"]').click();
  await editVisible(page,'#hotspot-card [data-ec-copy="B01:known:0"]','QA — Thông tin điểm 1');
  const items=await page.evaluate(()=>window.__editorialConsoleV04.state.interactive.B01.items);
  expect(items[0].known).toBe('QA — Thông tin điểm 1');
  expect(items[1].known).not.toBe('QA — Thông tin điểm 1');
  expect(items[0].evidence_level).toBe('1');expect(items[2].evidence_level).toBe('2');
});

test('23 B01 one component editor covers main and all three hotspot images', async ({page})=>{
  await page.getByRole('button',{name:'CHỈNH ĐỒ HỌA TƯƠNG TÁC'}).click();
  await expect(page.locator('#ec-panel-title')).toHaveText('ĐỒ HỌA TƯƠNG TÁC — B01');
  await expect(page.locator('[data-b01-file]')).toHaveCount(4);
  await expect(page.locator('[data-b01-field]')).toHaveCount(12);
  await expect(page.locator('#b01-save')).toHaveText('LƯU THAY ĐỔI');
  await expect(page.locator('#editor-panel')).not.toContainText('evidence_level:');
});

test('24 Hero media defaults to minimal editor and hides advanced fields', async ({page})=>{
  await openHeroMedia(page);const p=page.locator('#editor-panel');
  for(const label of ['Chọn ảnh / video','Chú thích','Tác giả / Nguồn','Hiển thị chú thích'])await expect(p).toContainText(label);
  await expect(p.locator('#ec-media-alt')).toBeHidden();
  await expect(p.locator('#ec-media-impact')).toBeHidden();
  await expect(p.locator('.ec-media-advanced')).not.toHaveAttribute('open','');
  await expect(p.locator('#ec-media-save')).toHaveText('LƯU THAY ĐỔI');
});

test('25 Image upload replaces hero placeholder with real media', async ({page})=>{
  await openHeroMedia(page);
  await page.locator('#ec-media-file').setInputFiles(file('hero-qa.png'));
  await page.locator('#ec-media-caption').fill('Chú thích QA');
  await page.locator('#ec-media-credit').fill('Tác giả QA');
  await page.locator('.ec-media-advanced summary').click();
  await page.locator('#ec-media-alt').fill('Mô tả QA');
  await page.locator('#ec-media-show-caption').check();
  await page.locator('#ec-media-save').click();
  await expect(page.locator('#editor-panel')).toBeHidden();
  await expect(page.locator('#s00 .ec-slot-media .ec-preview-image')).toBeVisible();
  await expect(page.locator('#s00 .placeholder-art')).toBeHidden();
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

test('27 Media caption edit participates in Undo/Redo', async ({page})=>{
  await openHeroMedia(page);await page.locator('#ec-media-file').setInputFiles(file('undo-media.png'));
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
  await expect(page.locator('#ec-media-poster')).toBeVisible();
  await expect(page.locator('#ec-media-ratio')).toBeHidden();
  await page.locator('.ec-video-advanced summary').click();
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

test('29 Publication info prioritizes six newsroom fields and masthead', async ({page})=>{
  await openPublication(page);const p=page.locator('#editor-panel');
  for(const label of ['Tên tòa soạn','Logo / Măng-sét ảnh','Hiển thị ở đầu bài','Chuyên mục','Tác giả','Biên tập','Ảnh','Đồ họa','Nguồn tài liệu']) await expect(p).toContainText(label);
  await expect(p.locator('.ec-publication-extra')).not.toHaveAttribute('open','');
  await expect(p.locator('[data-pub="slug"]')).toBeHidden();
});

test('30 Publication title/sapo and footer synchronize from advanced fields', async ({page})=>{
  await openPublication(page);
  await page.locator('.ec-publication-extra summary').click();
  await page.locator('[data-pub="title"]').fill('QA — Tiêu đề xuất bản');
  await page.locator('[data-pub="sapo"]').fill('QA — Sapo xuất bản');
  await page.locator('[data-pub="authors"]').fill('Nhóm tác giả QA');
  await page.locator('[data-pub="graphics"]').fill('');
  await savePublication(page);
  await expect(page.locator('#s00 h1')).toHaveText('QA — Tiêu đề xuất bản');
  await expect(page.locator('#s00 .dek')).toHaveText('QA — Sapo xuất bản');
  await expect(page.locator('.site-footer')).toContainText('Nhóm tác giả QA');
  await expect(page.locator('.site-footer')).not.toContainText('Đồ họa / Thiết kế');
});

test('31 Empty optional footer rows stay hidden in preview', async ({page})=>{
  await openPublication(page);
  for(const key of ['authors','editor','photos','graphics'])await page.locator('[data-pub="'+key+'"]').fill('');
  await page.locator('[data-footer="sources"]').fill('');
  await page.locator('.ec-publication-extra summary').click();
  for(const el of await page.locator('[data-footer]').all())await el.fill('');
  await savePublication(page);await action(page,'save').click();
  await page.goto('/?preview=1');await expect(page.locator('#editor-console')).toHaveCount(0);
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

test('37 No uncaught errors during direct text editor routes', async ({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.reload();
  await action(page,'publication').click();await page.keyboard.press('Escape');
  const shape=page.locator('#plan-visual .project span');await shape.click();await shape.press('Escape');
  await page.locator('#remains [data-hotspot="nen"]').click();
  const title=page.locator('#hotspot-card [data-ec-copy="B01:title:2"]');await title.click();await title.press('Escape');
  expect(errors).toEqual([]);
});

test('38 Masthead logo upload renders in editor and saved preview',async ({page})=>{
  await openPublication(page);
  await page.locator('[data-pub="masthead"]').fill('BÁO THỬ NGHIỆM');
  await page.locator('#ec-masthead-file').setInputFiles(file('logo.png'));
  await savePublication(page);
  await expect(page.locator('.site-header .ec-masthead-logo')).toBeVisible();
  await action(page,'save').click();await page.goto('/?preview=1');
  await expect(page.locator('.site-header .ec-masthead-logo')).toBeVisible();
  await expect(page.locator('.site-header strong')).toBeHidden();
});
test('39 Masthead without logo falls back to newsroom text',async ({page})=>{
  await openPublication(page);await page.locator('[data-pub="masthead"]').fill('TÒA SOẠN QA');
  await savePublication(page);await expect(page.locator('.site-header strong')).toHaveText('TÒA SOẠN QA');
  await expect(page.locator('.site-header .ec-masthead-logo')).toBeHidden();
});
test('40 Masthead visibility can be disabled and undone',async ({page})=>{
  await openPublication(page);await page.locator('#ec-masthead-visible').uncheck();
  await savePublication(page);await expect(page.locator('.site-header .header-inner > div').first()).toBeHidden();
  await action(page,'undo').click();
  await expect(page.locator('.site-header .header-inner > div').first()).toBeVisible();
});
test('41 Editor canvas shows one research warning per held block',async ({page})=>{
  for(const section of ['#models','#control-gates']){
    await expect(page.locator(section+' .ec-block-warning')).toHaveCount(1);
    await expect(page.locator(section+' [data-editorial-policy="HOLD_FOR_RESEARCH"]')).not.toHaveCount(0);
  }
  const visible=await page.locator('main').innerText();expect(visible).not.toContain('HOLD_FOR_RESEARCH');
});

test('42 Headline sapo and paragraph share one copy editor',async ({page})=>{
  await editVisible(page,'#s00 h1','QA — Tiêu đề thống nhất');
  await editVisible(page,'#s00 .dek','QA — Sapo thống nhất');
  await editVisible(page,'#remains .narrow > p:nth-of-type(2)','QA — Đoạn văn thống nhất');
  await expect(page.locator('#editor-panel')).toBeHidden();
});
test('43 Hero media binary survives saved Reader Preview', async ({page})=>{
  await openHeroMedia(page);
  await page.locator('#ec-media-file').setInputFiles(file('hero-preview.png'));
  await page.locator('#ec-media-caption').fill('Chú thích ảnh xem trước');
  await page.locator('#ec-media-show-caption').check();
  await page.locator('#ec-media-save').click();
  await expect(page.locator('#s00 .ec-slot-media .ec-preview-image')).toBeVisible();
  await finishDraftSave(page);await page.goto('/?preview=1');
  await expect(page.locator('#s00 .asset-frame .ec-slot-media img')).toBeVisible();
  await expect(page.locator('#s00 .placeholder-art')).toBeHidden();
  await expect(page.locator('#s00 .ec-reader-caption')).toContainText('Chú thích ảnh xem trước');
});

test('44 Tab and verb labels direct-edit while interaction keys stay fixed', async ({page})=>{
  const tab=page.locator('#tab-a');await tab.dblclick();
  await tab.fill('QA — Mô hình A');await tab.press('Tab');
  await expect(tab).toHaveText('QA — Mô hình A');
  const verb=page.locator('#control-gates [data-verb="requests"]');await verb.dblclick();
  await verb.fill('QA — yêu cầu');await verb.press('Tab');
  await expect(verb).toHaveAttribute('data-verb','requests');
  await expect(verb).toHaveText('QA — yêu cầu');
  await expect(page.locator('#control-gates .ec-block-warning')).toHaveCount(1);
});

test('45 Masthead section can be edited directly on the canvas',async ({page})=>{
  await editVisible(page,'.ec-publication-section','QA — CHUYÊN MỤC');
  await expect(page.locator('.ec-publication-section')).toHaveText('QA — CHUYÊN MỤC');
  await action(page,'undo').click();
  await expect(page.locator('.ec-publication-section')).toHaveText('Bài tương tác');
});
test('46 HOLD image remains editorial-only in reader preview',async ({page})=>{
  await page.locator('#model-a .model-schematic').click();
  await page.locator('#ec-media-file').setInputFiles(file('hold-model.png'));
  await page.locator('#ec-media-save').click();
  await expect(page.locator('#editor-panel')).toBeHidden(); // FileReader-backed save is asynchronous.
  const m=await page.evaluate(()=>window.__editorialConsoleV04.state.media.B05_MODEL_A);
  expect(m.review_status).toBe('HOLD_FOR_RESEARCH');
  expect(m.evidence_impact).toBe('EVIDENCE_AFFECTING');
  await action(page,'save').click();await page.goto('/?preview=1');
  await expect(page.locator('#model-a .ec-preview-image')).toHaveCount(0);
});

test('47 caret stays in native editable element and accepts selection',async ({page})=>{
  const h=page.locator('#s00 h1');await h.click({position:{x:90,y:15}});
  await expect(h).toHaveAttribute('contenteditable','plaintext-only');
  await h.press('Home');await h.press('Shift+ArrowRight');await h.press('Shift+ArrowRight');
  const selection=await page.evaluate(()=>({text:window.getSelection().toString(),active:document.activeElement?.tagName}));
  expect(selection.text.length).toBeGreaterThan(0);expect(selection.active).toBe('H1');
  await h.press('Escape');
});
test('48 native editing supports Backspace, paste and Unicode Vietnamese',async ({page})=>{
  const h=page.locator('#s00 h1');await h.click();await h.fill('Điện Kính Thiên');
  await h.press('End');await h.press('Backspace');await h.type('n');
  await h.press('Tab');await expect(h).toHaveText('Điện Kính Thiên');
});
test('49 media survives Edit Preview Edit and browser reload',async ({page})=>{
  await openHeroMedia(page);await page.locator('#ec-media-file').setInputFiles(file('persistent.png'));
  await page.locator('#ec-media-caption').fill('Ảnh tồn tại sau tải lại');
  await page.locator('#ec-media-save').click();await expect(page.locator('#editor-panel')).toBeHidden();
  await finishDraftSave(page);
  await page.goto('/?preview=1');await expect(page.locator('#s00 .ec-slot-media img')).toBeVisible();
  await page.goto('/?edit=1');await expect(page.locator('#s00 .ec-slot-media img')).toBeVisible();
  await page.reload();await expect(page.locator('#s00 .ec-slot-media img')).toBeVisible();
  await expect(page.locator('#ec-notice')).not.toContainText('cần chọn lại');
});
test('50 large image binary is stored without dataURL size limit',async ({page})=>{
  await openHeroMedia(page);
  await page.locator('#ec-media-file').setInputFiles(file('large.png','image/png',Buffer.concat([PNG,Buffer.alloc(1100000)])));
  await page.locator('#ec-media-save').click();await expect(page.locator('#editor-panel')).toBeHidden();
  await finishDraftSave(page);await page.reload();
  const binary=await page.evaluate(()=>window.__dktMediaStore.get('HERO_MEDIA').then(r=>r?.blob?.size||0));
  expect(binary).toBeGreaterThan(1024*1024);
});
test('51 video binary persists across Preview and reload',async ({page})=>{
  await openHeroMedia(page);
  await page.locator('#ec-media-file').setInputFiles(file('test.mp4','video/mp4',Buffer.alloc(4096)));
  await page.locator('#ec-media-save').click();await expect(page.locator('#editor-panel')).toBeHidden();
  await finishDraftSave(page);await page.goto('/?preview=1');
  await expect(page.locator('#s00 .ec-slot-media video')).toHaveCount(1);
  await page.reload();await expect(page.locator('#s00 .ec-slot-media video')).toHaveCount(1);
});
test('52 B01 main image replaces placeholder without moving hotspots',async ({page})=>{
  const before=await page.locator('#remains [data-hotspot]').evaluateAll(els=>els.map(x=>x.getAttribute('style')));
  await page.getByRole('button',{name:'CHỈNH ĐỒ HỌA TƯƠNG TÁC'}).click();
  await page.locator('[data-b01-file="B01_BACKGROUND"]').setInputFiles(file('main-b01.png'));
  await page.locator('#b01-save').click();await expect(page.locator('#editor-panel')).toBeHidden();
  await expect(page.locator('#remains .photo-fallback .ec-slot-media img')).toBeVisible();
  await expect(page.locator('#remains .placeholder-label')).toBeHidden();
  const after=await page.locator('#remains [data-hotspot]').evaluateAll(els=>els.map(x=>x.getAttribute('style')));
  expect(after).toEqual(before);
});
test('53 B01 all three hotspot copy and media survive Reader Preview',async ({page})=>{
  await page.getByRole('button',{name:'CHỈNH ĐỒ HỌA TƯƠNG TÁC'}).click();
  for(let i=0;i<3;i++){
    await page.locator('[data-b01-field="'+i+':title"]').fill('QA — Điểm '+(i+1));
    await page.locator('[data-b01-file="B01_HOTSPOT_0'+(i+1)+'"]').setInputFiles(file('point'+i+'.png'));
  }
  await page.locator('#b01-save').click();await finishDraftSave(page);await page.goto('/?preview=1');
  for(let i=0;i<3;i++){
    await page.locator('#remains [data-hotspot]').nth(i).click();
    await expect(page.locator('#hotspot-card h3')).toHaveText('QA — Điểm '+(i+1));
    await expect(page.locator('#hotspot-card .ec-slot-media img')).toBeVisible();
  }
});
test('54 history labels and reader content persist without changing tab key',async ({page})=>{
  const tab=page.locator('.layer-stack .layer').nth(0);
  const key=await tab.getAttribute('data-layer');await tab.dblclick();
  await tab.fill('QA — Tiền Thăng Long');await tab.press('Tab');
  await tab.click();
  await editVisible(page,'#layer-info [data-ec-copy="HISTORY:intro:0"]','QA — Thông tin lịch sử');
  await finishDraftSave(page);await page.goto('/?preview=1');
  await expect(page.locator('.layer-stack .layer').first()).toHaveText('QA — Tiền Thăng Long');
  await page.locator('.layer-stack .layer').first().click();
  await expect(page.locator('#layer-info')).toContainText('QA — Thông tin lịch sử');
  expect(await page.locator('.layer-stack .layer').first().getAttribute('data-layer')).toBe(key);
});
test('55 Reader Preview excludes editor-only notes and controls',async ({page})=>{
  await finishDraftSave(page);await page.goto('/?preview=1');
  await expect(page.locator('.representation-banner')).toBeHidden();
  await expect(page.locator('.ec-block-warning')).toHaveCount(0);
  await expect(page.locator('#editor-panel')).toHaveCount(0);
  const visible=await page.locator('main').innerText();
  for(const code of ['HOLD_FOR_RESEARCH','NOT_CHECKED','asset_id','CHUỖI LẬP LUẬN BIÊN TẬP'])expect(visible).not.toContain(code);
});
test('56 B01 component editor Cancel makes no changes',async ({page})=>{
  const before=await page.evaluate(()=>JSON.stringify(window.__editorialConsoleV04.state.interactive.B01));
  await page.getByRole('button',{name:'CHỈNH ĐỒ HỌA TƯƠNG TÁC'}).click();
  await page.locator('[data-b01-field="0:title"]').fill('KHÔNG LƯU');
  await page.locator('#b01-cancel').click();
  const after=await page.evaluate(()=>JSON.stringify(window.__editorialConsoleV04.state.interactive.B01));
  expect(after).toBe(before);
});

test('57 B08 interactive reader copy remains editable but HOLD is preserved',async ({page})=>{
  await page.locator('#control-gates [data-verb="requests"]').click();
  await editVisible(page,'#verb-info [data-ec-copy="B08:copy:4"]','QA — giải thích biên tập đang chờ');
  const item=await page.evaluate(()=>window.__editorialConsoleV04.state.interactive.B08.items[4]);
  expect(item.key).toBe('requests');
  expect(item.review_status).toBe('HOLD_FOR_RESEARCH');
  await finishDraftSave(page);await page.goto('/?preview=1');
  await page.locator('#control-gates [data-verb="requests"]').click();
  await expect(page.locator('#verb-info')).not.toContainText('QA — giải thích biên tập đang chờ');
});
test('58 reader view suppresses empty editorial image placeholder labels',async ({page})=>{
  await page.goto('/?preview=1');
  const visible=await page.locator('main').innerText();
  expect(visible).not.toContain('SƠ ĐỒ BIÊN TẬP');
  expect(visible).not.toContain('ĐỒ HỌA BIÊN TẬP');
  expect(visible).not.toContain('Chưa có ảnh chính');
  await expect(page.locator('.placeholder-label')).toBeHidden();
});
test('59 preview toolbar saves current unsaved text and opens reader draft',async ({page})=>{
  await editHeroTitle(page,'QA — Xem trước chưa lưu nháp');
  const popupPromise=page.waitForEvent('popup');
  await action(page,'preview').click();
  const preview=await popupPromise;await preview.waitForLoadState('domcontentloaded');
  await expect(preview.locator('#s00 h1')).toHaveText('QA — Xem trước chưa lưu nháp');
  await expect(preview.locator('#editor-console')).toHaveCount(0);
  await preview.close();
});
