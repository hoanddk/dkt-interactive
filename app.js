const towerStates = {
  1:{title:'Mức 1 — Còn tại chỗ',copy:'Những bộ phận vẫn tồn tại tại di tích và có thể quan sát trực tiếp.',insight:'Đây là lớp bằng chứng gần đối tượng nhất.',next:'Thêm mức 2'},
  2:{title:'Mức 2 — Đã đo / có vật chứng',copy:'Khảo cổ và hiện vật cho phép xác lập kích thước, vị trí hoặc đặc điểm cụ thể.',insight:'Đo được một phần không đồng nghĩa đã xác lập toàn bộ công trình.',next:'Thêm mức 3'},
  3:{title:'Mức 3 — Suy từ chứng cứ gián tiếp',copy:'Cấu kiện hoặc sử liệu cho manh mối về nguyên lý kiến trúc nhưng không còn là một bộ phận nguyên vẹn tại chỗ.',insight:'Từ đây, diễn giải bắt đầu đóng vai trò lớn hơn.',next:'Thêm mức 4'},
  4:{title:'Mức 4 — Suy dựng',copy:'Nhiều nguồn được ghép lại để tạo thành một phương án hình thái.',insight:'Có căn cứ nhưng vẫn còn lựa chọn diễn giải. Mức 4 luôn là suy dựng.',next:'Hiện mức 5'},
  5:{title:'Mức 5 — Chưa xác định',copy:'Hiện chưa đủ dữ liệu để thể hiện một hình dạng cụ thể.',insight:'Khoảng trống là một kết quả kiểm chứng, không phải phần cần được vẽ cho đầy.',next:'Khám phá tự do'}
};
let towerLevel=1;
const towerCopy=document.getElementById('tower-copy');
const towerPrev=document.getElementById('tower-prev');
const towerNext=document.getElementById('tower-next');
function renderTower(level){
  towerLevel=level;
  document.querySelectorAll('.tower-component').forEach(el=>{
    const lv=Number(el.dataset.level);
    el.classList.toggle('visible', lv<=level);
  });
  const s=towerStates[level];
  towerCopy.querySelector('.eyebrow').textContent=`MỨC BẰNG CHỨNG ${level}`;
  towerCopy.querySelector('h3').textContent=s.title;
  const ps=towerCopy.querySelectorAll('p');
  ps[1].textContent=s.copy;
  towerCopy.querySelector('.insight').textContent=s.insight;
  towerPrev.disabled=level===1;
  towerNext.textContent=s.next;
  towerNext.disabled=level===5;
  document.querySelectorAll('[data-level-control]').forEach(btn=>btn.setAttribute('aria-pressed', String(Number(btn.dataset.levelControl)<=level)));
}
towerNext?.addEventListener('click',()=>renderTower(Math.min(5,towerLevel+1)));
towerPrev?.addEventListener('click',()=>renderTower(Math.max(1,towerLevel-1)));
document.querySelectorAll('[data-level-control]').forEach(btn=>btn.addEventListener('click',()=>renderTower(Number(btn.dataset.levelControl))));
renderTower(1);

const hotspotData={
  them:{title:'Thềm rồng phía Nam',html:'<p><strong>DẤU TÍCH GỐC CHO BIẾT:</strong> Bộ phận đá còn tại chỗ và những đặc điểm có thể quan sát trực tiếp.</p><p><strong>KHÔNG ĐỦ ĐỂ KẾT LUẬN:</strong> Hệ cột, mái hay chiều cao toàn điện.</p><p class="small">MỨC BẰNG CHỨNG 1 · ĐỒ HỌA CHỈ MINH HỌA, KHÔNG PHẢI BẰNG CHỨNG</p>'},
  rong:{title:'Rồng đá phía Bắc',html:'<p><strong>DẤU TÍCH GỐC CHO BIẾT:</strong> Chi tiết điêu khắc, vật liệu và hiện trạng phần đá còn tồn tại.</p><p><strong>KHÔNG ĐỦ ĐỂ KẾT LUẬN:</strong> Niên đại của mọi chi tiết nếu không đối chiếu hồ sơ; không xác lập hình thái điện gỗ.</p><p class="small">MỨC BẰNG CHỨNG 1 · ĐỒ HỌA CHỈ MINH HỌA</p>'},
  nen:{title:'Nền / móng — dữ liệu khảo cổ',html:'<p><strong>KHẢO CỔ VÀ ĐO ĐẠC CÓ THỂ CHO BIẾT:</strong> Vị trí, kích thước hoặc đặc điểm của những dấu tích nền/móng đã được khảo sát.</p><p><strong>KHÔNG ĐỦ ĐỂ KẾT LUẬN:</strong> Hình dáng toàn bộ kiến trúc phía trên. Đồ họa này không thay bản vẽ đo hoặc hồ sơ địa tầng.</p><p class="small">MỨC BẰNG CHỨNG 2 · DỮ LIỆU KHẢO CỔ, KHÔNG PHẢI ẢNH HIỆN TRẠNG</p>'}
};
document.querySelectorAll('[data-hotspot]').forEach(btn=>btn.addEventListener('click',()=>{
  const d=hotspotData[btn.dataset.hotspot];
  const card=document.getElementById('hotspot-card'); card.innerHTML=`<h3>${d.title}</h3>${d.html}`;
}));

const layerInfo={
  'Tiền Thăng Long':['Dấu tích sớm trước kinh thành Thăng Long.','Không suy trực tiếp hình thái Kính Thiên Lê sơ.'],
  'Lý':['Dấu tích thời Lý trong khu trung tâm.','Giá trị chủ yếu là bối cảnh lịch sử và so sánh có điều kiện.'],
  'Trần':['Dấu tích thời Trần trong chuỗi sử dụng khu vực.','Không mặc nhiên là tiền thân trực tiếp có cùng hình thái.'],
  'Lê sơ':['Lớp trung tâm đối với câu hỏi về Điện Kính Thiên.','Cần tách phần đo được với phần suy dựng phía trên.'],
  'Lê Trung hưng':['Dấu tích đại trùng tu và sử dụng lại một phần nền móng.','Không đồng nhất mọi dấu tích với Lê sơ.'],
  'Nguyễn':['Điện Long Thiên là lớp kiến trúc khác.','Ảnh cuối thế kỷ XIX không được dùng như ảnh trực tiếp của Kính Thiên thời Lê.'],
  'Pháp / hiện đại':['Lớp phủ kiến trúc thời Pháp và hiện đại.','Không dùng để suy hình thái nguyên gốc của chính điện Lê.']
};
document.querySelectorAll('.layer').forEach(btn=>btn.addEventListener('click',()=>{
  document.querySelectorAll('.layer').forEach(x=>{x.classList.remove('active');x.setAttribute('aria-pressed','false');});btn.classList.add('active');btn.setAttribute('aria-pressed','true');
  const d=layerInfo[btn.dataset.layer];
  document.getElementById('layer-info').innerHTML=`<h3>${btn.dataset.layer}</h3><p><strong>Điều giúp hiểu:</strong> ${d[0]}</p><p><strong>Không suy quá:</strong> ${d[1]}</p>`;
}));

document.querySelectorAll('[data-plan]').forEach(btn=>btn.addEventListener('click',()=>{
  btn.classList.toggle('is-on'); btn.setAttribute('aria-pressed', String(btn.classList.contains('is-on'))); const target=document.querySelector('.plan-shape.'+btn.dataset.plan); target.style.opacity=btn.classList.contains('is-on')?'1':'.18';
}));

const reasonData={tile:['Ngói thật','Cho biết loại vật liệu/trang trí mái từng tồn tại. Chưa cho biết toàn bộ hình thái mái.'],model:['Mô hình đất nung','Cung cấp thông tin về nguyên lý kiến trúc thời Lê sơ. Không mặc nhiên là bản thu nhỏ trực tiếp của Điện Kính Thiên.'],wood:['Cấu kiện gỗ','Giúp nhận diện một số kỹ thuật kết cấu. Chưa đủ để xác định trọn hệ khung.'],compare:['So sánh','Giúp kiểm tra giả thuyết bằng các truyền thống kiến trúc liên quan; giá trị giảm khi khoảng cách niên đại, địa lý và loại hình tăng.'],hypothesis:['Giả thuyết mái','MỨC BẰNG CHỨNG 4 — SUY DỰNG THEO BẰNG CHỨNG HIỆN CÓ. Không phải hình dạng lịch sử duy nhất đã xác định.']};
document.querySelectorAll('[data-reason]').forEach(btn=>btn.addEventListener('click',()=>{const d=reasonData[btn.dataset.reason];document.getElementById('reason-info').innerHTML=`<h3>${d[0]}</h3><p>${d[1]}</p>`;}));

const verbData={'takes note':'Ghi nhận. Không đồng nghĩa phê duyệt.','considers':'Nhận định/xem xét rằng một hành động có thể tiến hành trong phạm vi được nêu.','supports in principle':'Ủng hộ về nguyên tắc; không đồng nghĩa phê duyệt thiết kế cụ thể.','confirms its agreement':'Xác nhận sự đồng ý trong phạm vi nêu tại quyết định; phải đọc cùng ngoại lệ và điều kiện.','requests':'Đưa ra yêu cầu tiếp theo mà phía quốc gia cần thực hiện.'};
document.querySelectorAll('[data-verb]').forEach(btn=>btn.addEventListener('click',()=>{document.getElementById('verb-info').innerHTML=`<h3>${btn.dataset.verb}</h3><p>${verbData[btn.dataset.verb]}</p>`;}));

// Tabs: B05
const tabs=[...document.querySelectorAll('[role="tab"]')];
function activateTab(tab,{focus=false}={}){
  tabs.forEach(t=>{t.setAttribute('aria-selected','false');t.setAttribute('tabindex','-1');document.getElementById(t.getAttribute('aria-controls')).hidden=true;});
  tab.setAttribute('aria-selected','true');tab.setAttribute('tabindex','0');document.getElementById(tab.getAttribute('aria-controls')).hidden=false;if(focus)tab.focus();
}
tabs.forEach((tab,i)=>{
  tab.addEventListener('click',()=>activateTab(tab));
  tab.addEventListener('keydown',e=>{
    let ni=null;if(e.key==='ArrowRight')ni=(i+1)%tabs.length;else if(e.key==='ArrowLeft')ni=(i-1+tabs.length;else if(e.key==='Home')ni=0;else if(e.key==='End')ni=tabs.length-1;
    if(ni!==null){e.preventDefault();activateTab(tabs[ni],{focus:true});}
  });
});

// Evidence Drawer
let evidenceData=null;const drawerTriggers=document.querySelectorAll('[data-component-open]');if(drawerTriggers.length){fetch('data/evidence-tower.json').then(r=>r.ok?r.json():null).then(d=>evidenceData=d).catch(()=>{});}
const drawer=document.getElementById('evidence-drawer'),panel=drawer.querySelector('.drawer-panel'),closeBtn=document.getElementById('drawer-close');let lastFocus=null;
function openDrawer(id){if(!evidenceData)return;const c=evidenceData.components.find(x=>x.id===id);if(!c)return;lastFocus=document.activeElement;document.getElementById('drawer-content').innerHTML=`<p class="badge">${c.reader_label}</p><h3>${c.name}</h3><p><strong>Mức bằng chứng:</strong> ${c.level}</p><p><strong>Loại thể hiện:</strong> ${c.representation_status}</p><p><strong>Biết được:</strong> ${c.supports}</p><p><strong>Không được suy ra:</strong> ${c.does_not_support}</p><p><strong>Mã nhận định:</strong> ${c.claim_id}</p><p><strong>Nguồn:</strong> ${c.source_ids.length?c.source_ids.join(', '):'Chưa có dữ liệu hình học đủ để xác định'}</p>`;drawer.classList.add('open');drawer.setAttribute('aria-hidden','false');panel.focus();}
function closeDrawer(){drawer.classList.remove('open');drawer.setAttribute('aria-hidden','true');lastFocus?.focus();}
// v0.1.2: component-level Source Drawer disabled in publish candidate until provenance_status COMPLETE.
document.querySelectorAll('[data-component-open]').forEach(btn=>{btn.disabled=true;btn.setAttribute('aria-disabled','true');});closeBtn.addEventListener('click',closeDrawer);drawer.addEventListener('click',e=>{if(e.target===drawer)closeDrawer();});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&drawer.classList.contains('open'))closeDrawer();});

// v0.1.1: keyboard focus management for modal drawer
function getDrawerFocusable(){return [...panel.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(el=>!el.disabled && el.offsetParent!==null);}
document.addEventListener('keydown',e=>{
  if(e.key==='Tab' && drawer.classList.contains('open')){
    const items=getDrawerFocusable(); if(!items.length){e.preventDefault();panel.focus();return;}
    const first=items[0], last=items[items.length-1];
    if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}
    else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}
  }
});

/* F-EDITOR-UX-04 reader/public layer: reader view is intentionally free of editor codes. */
(() => {
  'use strict';
  const params=new URLSearchParams(location.search);
  const isPreview=params.get('preview')==='1';
  const STORAGE='dkt:editorial-console:v0.4:editorial/round-2a-v0.1.5';
  const footerBaseline={authors:'',sources:'',photos:'',graphics:'Tòa soạn',editor:'',series:'',newsroom:'',publish_date:'',updated_at:'',method:''};
  let draft=null;
  if(isPreview){try{const raw=localStorage.getItem(STORAGE);if(raw){const p=JSON.parse(raw);if(p.schema==='interactive-editorial-console/v0.4')draft=p.state||null;}}catch(e){draft=null;}}
  const replacements=[
    [/MỨC BẰNG CHỨNG 1\s*·?/gi,'DẤU TÍCH TRỰC TIẾP ·'],
    [/MỨC BẰNG CHỨNG 2\s*·?/gi,'DỮ LIỆU KHẢO CỔ ·'],
    [/MỨC BẰNG CHỨNG 3\s*·?/gi,'CHỨNG CỨ GIÁN TIẾP ·'],
    [/MỨC BẰNG CHỨNG 4\s*[—-]?\s*/gi,'GIẢ THUYẾT SUY DỰNG — '],
    [/MỨC BẰNG CHỨNG 5\s*·?/gi,'CHƯA XÁC ĐỊNH ·'],
    [/MÔ HÌNH BIÊN TẬP VỀ MỨC BẰNG CHỨNG/gi,'CÁC LỚP ĐỘ CHẮC CHẮN CỦA THÔNG TIN'],
    [/CHUỖI LẬP LUẬN BIÊN TẬP/gi,'CHUỖI LẬP LUẬN MINH HỌA']
  ];
  const cleanTextNode=node=>{if(node.nodeType!==Node.TEXT_NODE)return;let v=node.nodeValue;replacements.forEach(([r,to])=>{v=v.replace(r,to);});node.nodeValue=v;};
  const cleanReaderCopy=root=>{
    const walker=document.createTreeWalker(root||document.body,NodeFilter.SHOW_TEXT);const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);nodes.forEach(cleanTextNode);
    const banner=document.querySelector('#evidence-tower .representation-banner');if(banner)banner.textContent='CÁC LỚP ĐỘ CHẮC CHẮN CỦA THÔNG TIN';
    const eyebrow=document.querySelector('#tower-copy .eyebrow');if(eyebrow&&/MỨC BẰNG CHỨNG/i.test(eyebrow.textContent))eyebrow.textContent=eyebrow.textContent.replace(/MỨC BẰNG CHỨNG/i,'ĐỘ CHẮC CHẮN · LỚP');
    const towerTitle=document.querySelector('#tower-copy h3');if(towerTitle)towerTitle.textContent=towerTitle.textContent.replace(/^Mức\s+(\d+)/i,'Lớp $1');
  };
  cleanReaderCopy(document.body);
  const observer=new MutationObserver(muts=>muts.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===Node.TEXT_NODE)cleanTextNode(n);else if(n.nodeType===Node.ELEMENT_NODE)cleanReaderCopy(n);})));observer.observe(document.body,{subtree:true,childList:true});

  if(draft){
    Object.values(draft.text||{}).forEach(r=>{if(r.previewOnly)return;try{const el=document.querySelector(r.path);if(el)el.textContent=r.after;}catch(e){}});
    const pub=draft.publication||{};if(pub.title){document.title=pub.title;const h=document.querySelector('#s00 h1');if(h)h.textContent=pub.title;}if(pub.sapo){const d=document.querySelector('#s00 .dek');if(d)d.textContent=pub.sapo;}if(pub.masthead){const h=document.querySelector('.site-header strong');if(h)h.textContent=pub.masthead;}
    const b03=draft.structured?.B03,plan=document.querySelector('#plan-visual');if(b03&&plan){[['project','project'],['foundation','foundation'],['hall','hall'],['court','court']].forEach(([k,c])=>{const el=plan.querySelector('.'+c+' span');if(el)el.textContent=b03[k];});const note=document.querySelector('#measure .plan-controls .small');if(note)note.textContent=b03.note;plan.setAttribute('aria-label',b03.aria||plan.getAttribute('aria-label'));}
    const b01=draft.interactive?.B01;if(b01?.items){document.querySelectorAll('#remains [data-hotspot]').forEach((btn,i)=>btn.addEventListener('click',()=>queueMicrotask(()=>{const x=b01.items[i],card=document.querySelector('#hotspot-card');if(!x||!card)return;card.innerHTML='<h3>'+x.title+'</h3><p><strong>'+x.known_label+'</strong> '+x.known+'</p><p><strong>'+x.limit_label+'</strong> '+x.limit+'</p>'+(x.note?'<p class="small">'+x.note+'</p>':'');cleanReaderCopy(card);})));}
    const b06=draft.interactive?.B06;if(b06?.items){b06.items.forEach(x=>{const btn=document.querySelector('#roof-case [data-reason="'+CSS.escape(x.key)+'"]');if(btn)btn.textContent=x.label;});document.querySelectorAll('#roof-case [data-reason]').forEach(btn=>btn.addEventListener('click',()=>queueMicrotask(()=>{const x=b06.items.find(i=>i.key===btn.dataset.reason),box=document.querySelector('#reason-info');if(x&&box){box.innerHTML='<h3>'+x.title+'</h3><p>'+x.copy+'</p>';cleanReaderCopy(box);}})));}
    const hero=draft.media?.HERO_MEDIA,cap=document.querySelector('#s00 figcaption');if(hero&&cap){if(hero.show_caption&&hero.caption){cap.hidden=false;cap.textContent=hero.caption+(hero.credit?' — '+hero.credit:'');}else if(hero.timestamp){cap.hidden=true;}}
  }

  const footer=document.querySelector('.site-footer .wrap');if(footer){const f=draft?.footer||footerBaseline;const rows=[['Tác giả / Nhóm tác giả',f.authors],['Nguồn tài liệu / tư liệu',f.sources],['Ảnh',f.photos],['Đồ họa / Thiết kế',f.graphics],['Biên tập',f.editor],['Dòng bài / Chuyên đề',f.series],['Giới thiệu tòa soạn',f.newsroom],['Ngày xuất bản',f.publish_date],['Ngày cập nhật',f.updated_at],['Ghi chú phương pháp',f.method]].filter(([,v])=>String(v||'').trim());footer.innerHTML=rows.map(([k,v])=>'<p><strong>'+k+':</strong> '+v+'</p>').join('');}

  const share=draft?.share||{title:document.title,description:document.querySelector('meta[name="description"]')?.content||'',thumbnail:'',canonical:location.href.split('?')[0]};
  const header=document.querySelector('.site-header .header-inner');if(header&&!header.querySelector('.reader-share')){const box=document.createElement('div');box.className='reader-share';box.innerHTML='<button type="button" data-share-native>Chia sẻ</button><button type="button" data-share-copy>Sao chép liên kết</button><span role="status" aria-live="polite"></span>';header.append(box);const status=box.querySelector('[role="status"]');box.querySelector('[data-share-native]').addEventListener('click',async()=>{const data={title:share.title||document.title,text:share.description||'',url:share.canonical||location.href.split('?')[0]};if(navigator.share){try{await navigator.share(data);status.textContent='Đã mở chia sẻ.';}catch(e){status.textContent='Đã hủy chia sẻ.';}}else{try{await navigator.clipboard.writeText(data.url);status.textContent='Đã sao chép liên kết.';}catch(e){status.textContent='Không thể sao chép tự động.';}}});box.querySelector('[data-share-copy]').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(share.canonical||location.href.split('?')[0]);status.textContent='Đã sao chép liên kết.';}catch(e){status.textContent='Không thể sao chép tự động.';}});const style=document.createElement('style');style.textContent='.reader-share{display:flex;gap:.35rem;align-items:center;flex-wrap:wrap}.reader-share button{border:1px solid currentColor;background:transparent;color:inherit;border-radius:999px;padding:.25rem .55rem;font:600 .72rem system-ui,sans-serif;cursor:pointer}.reader-share span{font-size:.68rem;opacity:.8}@media(max-width:720px){.reader-share{width:100%}}';document.head.append(style);}
})();
