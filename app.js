/* Public interactive runtime + F-EDITOR-UX-04 reader/preview layer. */
(() => {
  'use strict';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

  // Public copy cleanup only: keep evidence state/logic intact while removing
  // internal level/model terminology from the reader-facing DOM and a11y copy.
  const cleanReaderPresentation = () => {
    const replacements = [
      ['MÔ HÌNH BIÊN TẬP VỀ MỨC BẰNG CHỨNG', 'CÁCH ĐỌC MỨC ĐỘ CHẮC CHẮN CỦA THÔNG TIN'],
      ['MỨC BẰNG CHỨNG 1 — DẤU TÍCH ĐÁ CÒN TẠI CHỖ', 'DẤU TÍCH ĐÁ CÒN TẠI CHỖ'],
      ['MỨC BẰNG CHỨNG 4 — SUY DỰNG THEO BẰNG CHỨNG HIỆN CÓ', 'GIẢ THUYẾT SUY DỰNG THEO BẰNG CHỨNG HIỆN CÓ'],
      ['MỨC BẰNG CHỨNG 1', 'LỚP THÔNG TIN 1'],
      ['MỨC BẰNG CHỨNG 2', 'LỚP THÔNG TIN 2'],
      ['MỨC BẰNG CHỨNG 3', 'LỚP THÔNG TIN 3'],
      ['MỨC BẰNG CHỨNG 4', 'LỚP THÔNG TIN 4'],
      ['MỨC BẰNG CHỨNG 5', 'LỚP THÔNG TIN 5'],
      ['Nền/móng thuộc Mức bằng chứng 2.', 'Nền/móng thuộc nhóm dữ liệu khảo cổ đã được đo đạc.'],
      ['mức bằng chứng tương ứng', 'nhóm dữ liệu tương ứng'],
      ['Mức 4 luôn dùng nét đứt + nhãn SUY DỰNG. Mức 5 để trống hình học cụ thể.', 'Phần suy dựng luôn dùng nét đứt + nhãn SUY DỰNG. Phần chưa xác định để trống hình học cụ thể.'],
      ['Mức 4', 'Lớp suy dựng'],
      ['mức 5', 'phần chưa xác định'],
      ['Mức bằng chứng 2', 'dữ liệu khảo cổ'],
      ['Mức 2', 'lớp dữ liệu khảo cổ'],
      ['Mức 1', 'lớp dấu tích trực tiếp']
    ];
    const roots = ['#remains', '#evidence-tower', '#roof-case'];
    roots.forEach(selector => {
      const root = document.querySelector(selector);
      if (!root) return;
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      nodes.forEach(node => {
        let text = node.nodeValue;
        replacements.forEach(([from,to]) => { text = text.split(from).join(to); });
        node.nodeValue = text;
      });
      root.querySelectorAll('[aria-label],[aria-description]').forEach(el => {
        ['aria-label','aria-description'].forEach(attr => {
          if (!el.hasAttribute(attr)) return;
          let value = el.getAttribute(attr);
          replacements.forEach(([from,to]) => { value = value.split(from).join(to); });
          el.setAttribute(attr,value);
        });
      });
    });
  };
  cleanReaderPresentation();

  // B04 evidence tower — reader-facing terms only.
  const towerStates = {
    1:{title:'Lớp 1 — Còn tại chỗ',copy:'Những bộ phận vẫn tồn tại tại di tích và có thể quan sát trực tiếp.',insight:'Đây là lớp thông tin gần đối tượng nhất.',next:'Thêm lớp 2'},
    2:{title:'Lớp 2 — Đã đo / có vật chứng',copy:'Khảo cổ và hiện vật cho phép xác lập kích thước, vị trí hoặc đặc điểm cụ thể.',insight:'Đo được một phần không đồng nghĩa đã xác lập toàn bộ công trình.',next:'Thêm lớp 3'},
    3:{title:'Lớp 3 — Suy từ chứng cứ gián tiếp',copy:'Cấu kiện hoặc sử liệu cho manh mối về nguyên lý kiến trúc nhưng không còn là một bộ phận nguyên vẹn tại chỗ.',insight:'Từ đây, diễn giải bắt đầu đóng vai trò lớn hơn.',next:'Thêm lớp 4'},
    4:{title:'Lớp 4 — Suy dựng',copy:'Nhiều nguồn được ghép lại để tạo thành một phương án hình thái.',insight:'Có căn cứ nhưng vẫn còn lựa chọn diễn giải. Phần này luôn là suy dựng.',next:'Hiện lớp chưa xác định'},
    5:{title:'Chưa xác định',copy:'Hiện chưa đủ dữ liệu để thể hiện một hình dạng cụ thể.',insight:'Khoảng trống là một kết quả kiểm chứng, không phải phần cần được vẽ cho đầy.',next:'Khám phá tự do'}
  };
  let towerLevel = 1;
  const towerCopy = document.getElementById('tower-copy');
  const towerPrev = document.getElementById('tower-prev');
  const towerNext = document.getElementById('tower-next');
  function renderTower(level){
    if(!towerCopy) return;
    towerLevel = level;
    document.querySelectorAll('.tower-component').forEach(el=>el.classList.toggle('visible', Number(el.dataset.level) <= level));
    const s = towerStates[level];
    const eyebrow = towerCopy.querySelector('.eyebrow'); if(eyebrow) eyebrow.textContent = level===5 ? 'CHƯA XÁC ĐỊNH' : 'ĐỘ CHẮC CHẮN · LỚP '+level;
    const h3=towerCopy.querySelector('h3'); if(h3)h3.textContent=s.title;
    const ps=towerCopy.querySelectorAll('p'); if(ps[1])ps[1].textContent=s.copy;
    const insight=towerCopy.querySelector('.insight'); if(insight)insight.textContent=s.insight;
    if(towerPrev)towerPrev.disabled=level===1;
    if(towerNext){towerNext.textContent=s.next;towerNext.disabled=level===5;}
    document.querySelectorAll('[data-level-control]').forEach(btn=>btn.setAttribute('aria-pressed',String(Number(btn.dataset.levelControl)<=level)));
  }
  towerNext?.addEventListener('click',()=>renderTower(Math.min(5,towerLevel+1)));
  towerPrev?.addEventListener('click',()=>renderTower(Math.max(1,towerLevel-1)));
  document.querySelectorAll('[data-level-control]').forEach(btn=>btn.addEventListener('click',()=>renderTower(Number(btn.dataset.levelControl))));
  renderTower(1);

  // B01 hotspots. Editor may override item copy in preview mode below.
  const hotspotData = {
    them:{title:'Thềm rồng phía Nam',known_label:'DẤU TÍCH GỐC CHO BIẾT:',known:'Bộ phận đá còn tại chỗ và những đặc điểm có thể quan sát trực tiếp.',limit_label:'KHÔNG ĐỦ ĐỂ KẾT LUẬN:',limit:'Hệ cột, mái hay chiều cao toàn điện.',note:'DẤU TÍCH TRỰC TIẾP · ĐỒ HỌA CHỈ MINH HỌA, KHÔNG PHẢI BẰNG CHỨNG'},
    rong:{title:'Rồng đá phía Bắc',known_label:'DẤU TÍCH GỐC CHO BIẾT:',known:'Chi tiết điêu khắc, vật liệu và hiện trạng phần đá còn tồn tại.',limit_label:'KHÔNG ĐỦ ĐỂ KẾT LUẬN:',limit:'Niên đại của mọi chi tiết nếu không đối chiếu hồ sơ; không xác lập hình thái điện gỗ.',note:'DẤU TÍCH TRỰC TIẾP · ĐỒ HỌA CHỈ MINH HỌA'},
    nen:{title:'Nền / móng — dữ liệu khảo cổ',known_label:'KHẢO CỔ VÀ ĐO ĐẠC CÓ THỂ CHO BIẾT:',known:'Vị trí, kích thước hoặc đặc điểm của những dấu tích nền/móng đã được khảo sát.',limit_label:'KHÔNG ĐỦ ĐỂ KẾT LUẬN:',limit:'Hình dáng toàn bộ kiến trúc phía trên. Đồ họa này không thay bản vẽ đo hoặc hồ sơ địa tầng.',note:'DỮ LIỆU KHẢO CỔ · KHÔNG PHẢI ẢNH HIỆN TRẠNG'}
  };
  const renderHotspotCard = d => {
    const card=document.getElementById('hotspot-card'); if(!card||!d)return;
    card.innerHTML='<h3>'+esc(d.title)+'</h3><p><strong>'+esc(d.known_label)+'</strong> '+esc(d.known)+'</p><p><strong>'+esc(d.limit_label)+'</strong> '+esc(d.limit)+'</p>'+(d.note?'<p class="small">'+esc(d.note)+'</p>':'');
  };
  document.querySelectorAll('[data-hotspot]').forEach(btn=>btn.addEventListener('click',()=>renderHotspotCard(hotspotData[btn.dataset.hotspot])));

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
    document.querySelectorAll('.layer').forEach(x=>{x.classList.remove('active');x.setAttribute('aria-pressed','false');});
    btn.classList.add('active');btn.setAttribute('aria-pressed','true');
    const d=layerInfo[btn.dataset.layer],box=document.getElementById('layer-info');
    if(box&&d)box.innerHTML='<h3>'+esc(btn.dataset.layer)+'</h3><p><strong>Điều giúp hiểu:</strong> '+esc(d[0])+'</p><p><strong>Không suy quá:</strong> '+esc(d[1])+'</p>';
  }));

  document.querySelectorAll('[data-plan]').forEach(btn=>btn.addEventListener('click',()=>{
    btn.classList.toggle('is-on');btn.setAttribute('aria-pressed',String(btn.classList.contains('is-on')));
    const target=document.querySelector('.plan-shape.'+btn.dataset.plan);if(target)target.style.opacity=btn.classList.contains('is-on')?'1':'.18';
  }));

  const reasonData={tile:['Ngói thật','Cho biết loại vật liệu/trang trí mái từng tồn tại. Chưa cho biết toàn bộ hình thái mái.'],model:['Mô hình đất nung','Cung cấp thông tin về nguyên lý kiến trúc thời Lê sơ. Không mặc nhiên là bản thu nhỏ trực tiếp của Điện Kính Thiên.'],wood:['Cấu kiện gỗ','Giúp nhận diện một số kỹ thuật kết cấu. Chưa đủ để xác định trọn hệ khung.'],compare:['So sánh','Giúp kiểm tra giả thuyết bằng các truyền thống kiến trúc liên quan; giá trị giảm khi khoảng cách niên đại, địa lý và loại hình tăng.'],hypothesis:['Giả thuyết mái','GIẢ THUYẾT SUY DỰNG THEO BẰNG CHỨNG HIỆN CÓ. Không phải hình dạng lịch sử duy nhất đã xác định.']};
  const renderReason=key=>{const d=reasonData[key],box=document.getElementById('reason-info');if(d&&box)box.innerHTML='<h3>'+esc(d[0])+'</h3><p>'+esc(d[1])+'</p>';};
  document.querySelectorAll('[data-reason]').forEach(btn=>btn.addEventListener('click',()=>renderReason(btn.dataset.reason)));

  const verbData={'takes note':'Ghi nhận. Không đồng nghĩa phê duyệt.','considers':'Nhận định/xem xét rằng một hành động có thể tiến hành trong phạm vi được nêu.','supports in principle':'Ủng hộ về nguyên tắc; không đồng nghĩa phê duyệt thiết kế cụ thể.','confirms its agreement':'Xác nhận sự đồng ý trong phạm vi nêu tại quyết định; phải đọc cùng ngoại lệ và điều kiện.','requests':'Đưa ra yêu cầu tiếp theo mà phía quốc gia cần thực hiện.'};
  document.querySelectorAll('[data-verb]').forEach(btn=>btn.addEventListener('click',()=>{const box=document.getElementById('verb-info');if(box)box.innerHTML='<h3>'+esc(btn.dataset.verb)+'</h3><p>'+esc(verbData[btn.dataset.verb])+'</p>';}));

  // B05 tabs.
  const tabs=[...document.querySelectorAll('[role="tab"]')];
  function activateTab(tab,{focus=false}={}){
    tabs.forEach(t=>{t.setAttribute('aria-selected','false');t.setAttribute('tabindex','-1');const p=document.getElementById(t.getAttribute('aria-controls'));if(p)p.hidden=true;});
    tab.setAttribute('aria-selected','true');tab.setAttribute('tabindex','0');const p=document.getElementById(tab.getAttribute('aria-controls'));if(p)p.hidden=false;if(focus)tab.focus();
  }
  tabs.forEach((tab,i)=>{
    tab.addEventListener('click',()=>activateTab(tab));
    tab.addEventListener('keydown',e=>{
      let ni=null;
      if(e.key==='ArrowRight')ni=(i+1)%tabs.length;
      else if(e.key==='ArrowLeft')ni=(i-1+tabs.length)%tabs.length;
      else if(e.key==='Home')ni=0;
      else if(e.key==='End')ni=tabs.length-1;
      if(ni!==null){e.preventDefault();activateTab(tabs[ni],{focus:true});}
    });
  });

  // Source drawer remains disabled until its own provenance package is complete.
  const drawer=document.getElementById('evidence-drawer'),drawerPanel=drawer?.querySelector('.drawer-panel'),closeBtn=document.getElementById('drawer-close');let lastFocus=null;
  document.querySelectorAll('[data-component-open]').forEach(btn=>{btn.disabled=true;btn.setAttribute('aria-disabled','true');});
  function closeDrawer(){if(!drawer)return;drawer.classList.remove('open');drawer.setAttribute('aria-hidden','true');lastFocus?.focus();}
  closeBtn?.addEventListener('click',closeDrawer);drawer?.addEventListener('click',e=>{if(e.target===drawer)closeDrawer();});
  document.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&drawer?.classList.contains('open'))closeDrawer();
    if(e.key==='Tab'&&drawer?.classList.contains('open')&&drawerPanel){const items=[...drawerPanel.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(el=>!el.disabled&&el.offsetParent!==null);if(!items.length){e.preventDefault();drawerPanel.focus();return;}const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
  });

  // Reader/preview data. Public mode never loads editor.js.
  const params=new URLSearchParams(location.search),isPreview=params.get('preview')==='1';
  const STORAGE='dkt:editorial-console:v0.4:editorial/round-2a-v0.1.5';
  let draft=null;
  if(isPreview){try{const raw=localStorage.getItem(STORAGE);if(raw){const p=JSON.parse(raw);if(p.schema==='interactive-editorial-console/v0.4')draft=p.state||null;}}catch(e){draft=null;}}

  if(draft){
    Object.values(draft.text||{}).forEach(r=>{if(r.previewOnly)return;try{const el=document.querySelector(r.path);if(el)el.textContent=r.after;}catch(e){}});
    const pub=draft.publication||{};
    if(pub.title){document.title=pub.title;const h=document.querySelector('#s00 h1');if(h)h.textContent=pub.title;}
    if(pub.sapo){const d=document.querySelector('#s00 .dek');if(d)d.textContent=pub.sapo;}
    if(pub.masthead){const h=document.querySelector('.site-header strong');if(h)h.textContent=pub.masthead;}
    const b03=draft.structured?.B03,plan=document.querySelector('#plan-visual');
    if(b03&&plan){[['project','project'],['foundation','foundation'],['hall','hall'],['court','court']].forEach(([k,c])=>{const el=plan.querySelector('.'+c+' span');if(el)el.textContent=b03[k];});const note=document.querySelector('#measure .plan-controls .small');if(note)note.textContent=b03.note;plan.setAttribute('aria-label',b03.aria||plan.getAttribute('aria-label'));}
    const b01=draft.interactive?.B01;
    if(b01?.items)document.querySelectorAll('#remains [data-hotspot]').forEach((btn,i)=>btn.addEventListener('click',()=>queueMicrotask(()=>{const x=b01.items[i];if(x&&x.status!=='Ẩn tạm')renderHotspotCard(x);}))); 
    const b06=draft.interactive?.B06;
    if(b06?.items){b06.items.forEach(x=>{const btn=document.querySelector('#roof-case [data-reason="'+CSS.escape(x.key)+'"]');if(btn)btn.textContent=x.label;});document.querySelectorAll('#roof-case [data-reason]').forEach(btn=>btn.addEventListener('click',()=>queueMicrotask(()=>{const x=b06.items.find(i=>i.key===btn.dataset.reason),box=document.getElementById('reason-info');if(x&&box)box.innerHTML='<h3>'+esc(x.title)+'</h3><p>'+esc(x.copy)+'</p>';})));}
    const hero=draft.media?.HERO_MEDIA,cap=document.querySelector('#s00 figcaption');
    if(hero&&cap&&hero.timestamp){if(hero.show_caption&&hero.caption){cap.hidden=false;cap.textContent=hero.caption+(hero.credit?' — '+hero.credit:'');}else cap.hidden=true;}
  }

  // Data-driven footer. Empty optional rows render nothing.
  const footer=document.querySelector('.site-footer .wrap');
  if(footer){
    const f=draft?.footer||{authors:'',sources:'',photos:'',graphics:'Tòa soạn',editor:'',series:'',newsroom:'',publish_date:'',updated_at:'',method:''};
    const rows=[['Tác giả / Nhóm tác giả',f.authors],['Nguồn tài liệu / tư liệu',f.sources],['Ảnh',f.photos],['Đồ họa / Thiết kế',f.graphics],['Biên tập',f.editor],['Dòng bài / Chuyên đề',f.series],['Giới thiệu tòa soạn',f.newsroom],['Ngày xuất bản',f.publish_date],['Ngày cập nhật',f.updated_at],['Ghi chú phương pháp',f.method]].filter(([,v])=>String(v||'').trim());
    footer.replaceChildren();rows.forEach(([k,v])=>{const p=document.createElement('p'),strong=document.createElement('strong');strong.textContent=k+': ';p.append(strong,document.createTextNode(String(v)));footer.append(p);});
  }

  // Compact reader share: native share + copy link only.
  const share=draft?.share||{title:document.title,description:document.querySelector('meta[name="description"]')?.content||'',canonical:location.href.split('?')[0]};
  const header=document.querySelector('.site-header .header-inner');
  if(header&&!header.querySelector('.reader-share')){
    const box=document.createElement('div');box.className='reader-share';
    const native=document.createElement('button');native.type='button';native.textContent='Chia sẻ';native.dataset.shareNative='';
    const copy=document.createElement('button');copy.type='button';copy.textContent='Sao chép liên kết';copy.dataset.shareCopy='';
    const status=document.createElement('span');status.setAttribute('role','status');status.setAttribute('aria-live','polite');box.append(native,copy,status);header.append(box);
    native.addEventListener('click',async()=>{const data={title:share.title||document.title,text:share.description||'',url:share.canonical||location.href.split('?')[0]};if(navigator.share){try{await navigator.share(data);status.textContent='Đã mở chia sẻ.';}catch(e){status.textContent='Đã hủy chia sẻ.';}}else{try{await navigator.clipboard.writeText(data.url);status.textContent='Đã sao chép liên kết.';}catch(e){status.textContent='Không thể sao chép tự động.';}}});
    copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(share.canonical||location.href.split('?')[0]);status.textContent='Đã sao chép liên kết.';}catch(e){status.textContent='Không thể sao chép tự động.';}});
    const style=document.createElement('style');style.textContent='.reader-share{display:flex;gap:.35rem;align-items:center;flex-wrap:wrap}.reader-share button{border:1px solid currentColor;background:transparent;color:inherit;border-radius:999px;padding:.25rem .55rem;font:600 .72rem system-ui,sans-serif;cursor:pointer}.reader-share span{font-size:.68rem;opacity:.8}@media(max-width:720px){.reader-share{width:100%}}';document.head.append(style);
  }
})();
