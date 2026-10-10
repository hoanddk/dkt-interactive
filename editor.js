/* F-EDITOR-UX-04 — newsroom-first Editorial Console v0.1.4
   Pilot-local browser editor. No Git API writes, merge or publish capability. */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  if (params.get('edit') !== '1') return;
  const BRANCH = 'editorial/round-2a-v0.1.5';
  const STORAGE = 'dkt:editorial-console:v0.4:' + BRANCH;
  const MODE = params.get('editorial_mode') || 'live';
  const MODE_LABEL = MODE === 'post_publish' ? 'CHỈNH SỬA SAU XUẤT BẢN' : MODE === 'controlled' ? 'BIÊN TẬP CÓ KIỂM SOÁT' : 'ĐANG BIÊN TẬP';
  const PRODUCT_LABEL = 'HOÀN THIỆN BIÊN TẬP';
  const main = document.querySelector('main');
  if (!main) return;

  const clone = value => JSON.parse(JSON.stringify(value));
  const now = () => new Date().toISOString();
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const hash = str => { let n=2166136261; for(let i=0;i<str.length;i++){n^=str.charCodeAt(i);n=Math.imul(n,16777619);} return ('00000000'+(n>>>0).toString(16)).slice(-8); };
  const sectionOf = el => el.closest('section');
  const selectorFor = (el, section) => {
    const parts=[]; let node=el;
    while(node && node!==section){
      const tag=node.tagName.toLowerCase();
      const siblings=[...node.parentElement.children].filter(x=>x.tagName===node.tagName);
      parts.unshift(tag+':nth-of-type('+(siblings.indexOf(node)+1)+')'); node=node.parentElement;
    }
    return '#'+section.id+' > '+parts.join(' > ');
  };
  const emptyMedia = (slotId, caption='') => ({
    slot_id:slotId, media_type:'IMAGE', asset_type:'EDITORIAL_GRAPHIC', representation_status:'EDITORIAL_ILLUSTRATION',
    file_name:null, file_type:null, file_size:0, object_url:null, poster_name:null, poster_url:null,
    caption, show_caption:!!caption, credit:'', source_context:'', alt_text:'', decorative:false,
    aspect_ratio:'AUTO', autoplay:false, loop:false, subtitle_name:null,
    duration:null, width:null, height:null, warnings:[], change_reason:'', removed:false,
    evidence_impact:'PRESENTATION_ONLY', review_status:'DRAFT', timestamp:null
  });
  const typeLabels = {
    PHOTO_CURRENT:'Ảnh hiện trạng', ARCHIVAL_PHOTO:'Ảnh tư liệu', EDITORIAL_GRAPHIC:'Đồ họa biên tập',
    SCHEMATIC:'Sơ đồ minh họa', RECONSTRUCTION:'Hình phục dựng', MAP:'Bản đồ', DATA_VISUAL:'Đồ họa dữ liệu', PLACEHOLDER:'Ảnh tạm'
  };
  const representationLabels = {
    EDITORIAL_ILLUSTRATION:'Đồ họa minh họa biên tập', NOT_CURRENT_PHOTO:'Không phải ảnh hiện trạng',
    RECONSTRUCTION_HYPOTHESIS:'Hình phục dựng giả định', SCHEMATIC_NOT_TO_SCALE:'Sơ đồ minh họa, không theo tỷ lệ',
    DOCUMENTARY_PHOTO:'Ảnh tư liệu thực địa', ARCHIVAL_WITH_CONTEXT:'Ảnh lưu trữ có bối cảnh', PLACEHOLDER_NOT_FINAL:'Ảnh tạm — chưa hoàn thiện'
  };
  const impactLabels = {
    PRESENTATION_ONLY:'Chỉ thay đổi trình bày', EVIDENCE_SUPPORTING:'Hỗ trợ bằng chứng',
    EVIDENCE_AFFECTING:'Có ảnh hưởng đến bằng chứng', CLAIM_AFFECTING:'Có ảnh hưởng đến nhận định'
  };
  const policyLabels = { EDITABLE:'Có thể sửa', REVIEW_REQUIRED:'Cần duyệt', HOLD_FOR_RESEARCH:'Chờ bổ sung nghiên cứu', LOCKED:'Đã khóa' };
  const optionHtml = (obj, selected) => Object.entries(obj).map(([v,l])=>'<option value="'+esc(v)+'"'+(v===selected?' selected':'')+'>'+esc(l)+'</option>').join('');

  const baseline = {
    publication: {
      masthead:(document.querySelector('.site-header strong')?.textContent||'').trim(),
      section:'Bài tương tác', title:(document.querySelector('#s00 h1')?.textContent||document.title).trim(),
      sapo:(document.querySelector('#s00 .dek')?.textContent||'').trim(), authors:'', publish_date:'', publish_time:'', updated_at:'',
      slug:location.pathname.split('/').filter(Boolean).pop()||'dien-kinh-thien', editor:'', photos:'', graphics:'Tòa soạn', design:'', team:''
    },
    footer: { authors:'', photos:'', graphics:'Tòa soạn', editor:'', sources:'', newsroom:'', series:'', publish_date:'', updated_at:'', method:'' },
    share: { title:document.title, description:document.querySelector('meta[name="description"]')?.content||'', thumbnail:'', canonical:location.href.split('?')[0] },
    structured:{ B03:null }, interactive:{ B01:null, B06:null }, media:{}
  };
  const state = { text:{}, publication:clone(baseline.publication), footer:clone(baseline.footer), share:clone(baseline.share), structured:{}, interactive:{}, media:{} };
  let savedState = '';
  let undoStack=[];
  let redoStack=[];
  const sessionFiles=new Map();
  const sessionPosters=new Map();
  let activeText=null;
  let panelOpen=false;
  let lastFocused=null;

  const bar=document.createElement('aside');
  bar.id='editor-console';
  bar.setAttribute('aria-label','Bảng biên tập Interactive');
  bar.innerHTML='<div class="ec-heading"><strong>BẢNG BIÊN TẬP INTERACTIVE</strong><span id="ec-count">Chưa có thay đổi</span></div>'+ 
    '<div class="ec-state">'+PRODUCT_LABEL+' · '+MODE_LABEL+' · Bản nháp trên trình duyệt</div>'+ 
    '<div class="ec-actions">'+
      '<button type="button" data-ec-action="save">LƯU NHÁP</button>'+ 
      '<button type="button" data-ec-action="undo">HOÀN TÁC</button>'+ 
      '<button type="button" data-ec-action="redo">LÀM LẠI</button>'+ 
      '<button type="button" data-ec-action="history">LỊCH SỬ</button>'+ 
      '<button type="button" data-ec-action="publication">THÔNG TIN XUẤT BẢN</button>'+ 
      '<a class="ec-preview-link" data-ec-action="preview" target="_blank" rel="noopener">XEM TRƯỚC</a>'+ 
      '<button type="button" data-ec-action="exit">THOÁT BIÊN TẬP</button>'+ 
    '</div>'+ 
    '<details class="ec-tools"><summary>CÔNG CỤ NÂNG CAO</summary><div>'+ 
      '<button type="button" data-ec-action="restore">KHÔI PHỤC BẢN GỐC</button>'+ 
      '<button type="button" data-ec-action="export">XUẤT GÓI THAY ĐỔI</button>'+ 
    '</div></details>'+ 
    '<div id="ec-notice" role="status" aria-live="polite">Nhấp vào câu chữ để sửa. Nhấp đúp nhãn nút tương tác để sửa nhãn.</div>';
  document.body.prepend(bar);
  const panel=document.createElement('section');
  panel.id='editor-panel'; panel.hidden=true; panel.setAttribute('role','dialog'); panel.setAttribute('aria-modal','true'); panel.setAttribute('aria-labelledby','ec-panel-title');
  panel.innerHTML='<div class="ec-panel-head"><h2 id="ec-panel-title">Bảng biên tập</h2><button type="button" id="ec-close" aria-label="Đóng bảng">×</button></div><div id="ec-panel-body"></div>';
  document.body.append(panel);
  const panelBody=panel.querySelector('#ec-panel-body');
  const notice=bar.querySelector('#ec-notice');
  const count=bar.querySelector('#ec-count');
  const previewLink=bar.querySelector('[data-ec-action="preview"]');
  const previewUrl=new URL(location.href); previewUrl.searchParams.delete('edit'); previewUrl.searchParams.delete('editorial_mode'); previewUrl.searchParams.set('preview','1'); previewLink.href=previewUrl.toString();

  const fields=new Map();
  const contentSelector='h1,h2,h3,p,figcaption,li,.reasoning-chain button,[role="tab"]';
  const fieldPolicy=(el,section)=>{
    const id=section.id;
    if(id==='evidence-tower') return 'LOCKED';
    if(el.closest('.status-badge,.badge,.representation-banner')) return 'LOCKED';
    if(id==='measure' && (el.closest('.plan-grid')||el.closest('.plan-controls'))) return 'LOCKED';
    if(id==='remains' && el.closest('.hotspot-stage')) return 'LOCKED';
    if(id==='roof-case' && el.closest('#reason-info')) return 'LOCKED';
    if(id==='preserve' && el.closest('.status-grid') && el.matches('h3')) return 'LOCKED';
    if(id==='models'||id==='control-gates') return 'HOLD_FOR_RESEARCH';
    if(el.matches('[data-editorial-hold]')||el.closest('[data-editorial-hold]')) return 'HOLD_FOR_RESEARCH';
    if(id==='closure' && el.matches('li')) return 'REVIEW_REQUIRED';
    return 'EDITABLE';
  };
  const scanFields=()=>{
    main.querySelectorAll(contentSelector).forEach(el=>{
      const section=sectionOf(el); if(!section||!section.id) return;
      const value=(el.textContent||'').trim(); if(!value) return;
      if(el.closest('#hotspot-card')) return;
      const path=selectorFor(el,section); const id=section.id+':'+hash(path);
      if(fields.has(id)) return;
      const interactiveControl=el.matches('button,[role="tab"]');
      const rich=el.children.length>0 && !interactiveControl;
      let policy=fieldPolicy(el,section);
      if(rich && policy==='EDITABLE') policy='LOCKED';
      const field={id,path,node:el,section:section.dataset.block||section.dataset.screen||section.id,baseline:value,policy,interactiveControl};
      fields.set(id,field); el.dataset.editorialField=id; el.dataset.editorialPolicy=policy;
      if(policy==='LOCKED'){ el.title='ĐÃ KHÓA — giữ nguyên logic, cấu trúc hoặc trạng thái bằng chứng'; return; }
      el.tabIndex=0;
      el.setAttribute('aria-label',(policy==='HOLD_FOR_RESEARCH'?'Đề xuất câu chữ, đang chờ bổ sung nghiên cứu: ':'Chỉnh sửa câu chữ: ')+value.slice(0,100));
      if(interactiveControl) el.title='Nhấp đúp để sửa nhãn; nhấp một lần vẫn dùng tương tác';
    });
  };
  scanFields();

  const captureB03=()=>{
    const root=document.querySelector('#plan-visual'); if(!root) return null;
    return {
      project:root.querySelector('.project span')?.textContent.trim()||'', foundation:root.querySelector('.foundation span')?.textContent.trim()||'',
      hall:root.querySelector('.hall span')?.textContent.trim()||'', court:root.querySelector('.court span')?.textContent.trim()||'',
      note:document.querySelector('#measure .plan-controls .small')?.textContent.trim()||'', aria:root.getAttribute('aria-label')||'',
      timestamp:null, reason:'', evidence_impact:'EVIDENCE_SUPPORTING'
    };
  };
  baseline.structured.B03=captureB03(); state.structured.B03=clone(baseline.structured.B03);

  const stripPrefix=(p)=>{
    const strong=p?.querySelector('strong'); if(!p) return {label:'',text:''};
    const label=strong?.textContent.trim()||''; const text=(p.textContent||'').replace(label,'').trim(); return {label,text};
  };
  const captureB01=()=>{
    const card=document.querySelector('#hotspot-card'); const buttons=[...document.querySelectorAll('#remains [data-hotspot]')]; if(!card||buttons.length!==3) return null;
    const original=card.innerHTML; const items=[];
    buttons.forEach((btn,i)=>{
      btn.click(); const ps=[...card.querySelectorAll('p')]; const a=stripPrefix(ps[0]), b=stripPrefix(ps[1]);
      items.push({id:'B01_HOTSPOT_0'+(i+1),key:btn.dataset.hotspot,number:i+1,title:card.querySelector('h3')?.textContent.trim()||btn.getAttribute('aria-label')||'',known_label:a.label,known:a.text,limit_label:b.label,limit:b.text,note:ps[2]?.textContent.trim()||'',evidence_level:i===2?'2':'1',status:'Đang dùng',media:emptyMedia('B01_HOTSPOT_0'+(i+1)),timestamp:null,reason:''});
    });
    card.innerHTML=original; return {items};
  };
  baseline.interactive.B01=captureB01(); state.interactive.B01=clone(baseline.interactive.B01);

  const captureB06=()=>{
    const box=document.querySelector('#reason-info'); const buttons=[...document.querySelectorAll('#roof-case [data-reason]')]; if(!box||!buttons.length) return null;
    const original=box.innerHTML; const items=[];
    buttons.forEach((btn,i)=>{ btn.click(); items.push({key:btn.dataset.reason,number:i+1,label:btn.textContent.trim(),title:box.querySelector('h3')?.textContent.trim()||'',copy:box.querySelector('p')?.textContent.trim()||'',timestamp:null,reason:''}); });
    box.innerHTML=original; return {items};
  };
  baseline.interactive.B06=captureB06(); state.interactive.B06=clone(baseline.interactive.B06);

  const heroCaption=document.querySelector('#s00 figcaption')?.textContent.trim()||'';
  baseline.media.HERO_MEDIA=emptyMedia('HERO_MEDIA',heroCaption);
  baseline.media.B03_GRAPHIC_REPLACEMENT=emptyMedia('B03_GRAPHIC_REPLACEMENT','');
  state.media=clone(baseline.media);
  if(state.interactive.B01?.items) state.interactive.B01.items.forEach(item=>{ baseline.media[item.id]=clone(item.media); state.media[item.id]=clone(item.media); });

  const serial=()=>JSON.stringify(state);
  const sessionSnapshot=()=>({ state:clone(state), files:new Map(sessionFiles), posters:new Map(sessionPosters) });
  const restoreSession=snap=>{
    Object.keys(state).forEach(k=>delete state[k]); Object.assign(state,clone(snap.state));
    sessionFiles.clear(); snap.files.forEach((v,k)=>sessionFiles.set(k,v)); sessionPosters.clear(); snap.posters.forEach((v,k)=>sessionPosters.set(k,v));
    renderAll(); refresh();
  };
  const checkpoint=()=>{ undoStack.push(sessionSnapshot()); if(undoStack.length>80) undoStack.shift(); redoStack=[]; };
  const isDirty=()=>serial()!==savedState;
  const changedCount=()=>Object.keys(state.text).length + Object.values(state.media).filter(m=>m.timestamp).length +
    (JSON.stringify(state.structured.B03)!==JSON.stringify(baseline.structured.B03)?1:0) +
    (JSON.stringify(state.interactive.B01)!==JSON.stringify(baseline.interactive.B01)?1:0) +
    (JSON.stringify(state.interactive.B06)!==JSON.stringify(baseline.interactive.B06)?1:0) +
    (JSON.stringify(state.publication)!==JSON.stringify(baseline.publication)?1:0) +
    (JSON.stringify(state.footer)!==JSON.stringify(baseline.footer)?1:0) + (JSON.stringify(state.share)!==JSON.stringify(baseline.share)?1:0);
  const showNotice=message=>{ notice.textContent=message; };
  const refresh=()=>{
    const n=changedCount(); count.textContent=n?(n+' thay đổi · '+(isDirty()?'chưa lưu':'đã lưu')):'Chưa có thay đổi';
    bar.querySelector('[data-ec-action="undo"]').disabled=!undoStack.length;
    bar.querySelector('[data-ec-action="redo"]').disabled=!redoStack.length;
  };

  const applyText=()=>{
    fields.forEach(field=>{
      const rec=state.text[field.id];
      if(field.policy==='HOLD_FOR_RESEARCH'||field.policy==='REVIEW_REQUIRED'){
        field.node.textContent=field.baseline; field.node.classList.toggle('ec-proposal',!!rec); return;
      }
      field.node.textContent=rec?.after||field.baseline; field.node.classList.toggle('ec-changed',!!rec);
    });
    const h1=document.querySelector('#s00 h1'), dek=document.querySelector('#s00 .dek');
    if(h1 && state.publication.title && !Object.values(state.text).some(r=>r.path&&document.querySelector(r.path)===h1)) h1.textContent=state.publication.title;
    if(dek && state.publication.sapo && !Object.values(state.text).some(r=>r.path&&document.querySelector(r.path)===dek)) dek.textContent=state.publication.sapo;
  };
  const applyB03=()=>{
    const d=state.structured.B03, root=document.querySelector('#plan-visual'); if(!d||!root)return;
    [['project','project'],['foundation','foundation'],['hall','hall'],['court','court']].forEach(([key,cls])=>{const el=root.querySelector('.'+cls+' span');if(el)el.textContent=d[key];});
    const note=document.querySelector('#measure .plan-controls .small'); if(note)note.textContent=d.note; root.setAttribute('aria-label',d.aria);
  };
  const renderB01Card=(idx)=>{
    const card=document.querySelector('#hotspot-card'), item=state.interactive.B01?.items?.[idx]; if(!card||!item)return;
    card.innerHTML='<h3>'+esc(item.title)+'</h3><p><strong>'+esc(item.known_label)+'</strong> '+esc(item.known)+'</p><p><strong>'+esc(item.limit_label)+'</strong> '+esc(item.limit)+'</p>'+(item.note?'<p class="small">'+esc(item.note)+'</p>':'')+'<button type="button" class="ec-hotspot-context-action" data-ec-hotspot-edit="'+idx+'">CHỈNH NỘI DUNG — ĐIỂM TƯƠNG TÁC '+(idx+1)+'</button>';
  };
  const applyB06=(selectedKey=null)=>{
    const data=state.interactive.B06; if(!data)return;
    data.items.forEach(item=>{const btn=document.querySelector('#roof-case [data-reason="'+CSS.escape(item.key)+'"]');if(btn)btn.textContent=item.label;});
    if(selectedKey){ const item=data.items.find(x=>x.key===selectedKey), box=document.querySelector('#reason-info'); if(item&&box)box.innerHTML='<h3>'+esc(item.title)+'</h3><p>'+esc(item.copy)+'</p>'; }
  };
  const renderMediaSummary=(slotId,target)=>{
    if(!target)return; target.querySelectorAll(':scope > .ec-media-draft').forEach(el=>el.remove());
    const m=state.media[slotId]; if(!m||!m.timestamp)return;
    const wrap=document.createElement('div'); wrap.className='ec-media-draft'; wrap.dataset.mediaSlot=slotId;
    if(m.removed){wrap.innerHTML='<p class="ec-asset-empty">Media đã được gỡ trong bản nháp.</p>';target.append(wrap);return;}
    const file=sessionFiles.get(slotId);
    if(file && m.object_url){
      if(m.media_type==='VIDEO'){
        const v=document.createElement('video'); v.src=m.object_url; v.controls=true; v.preload='metadata'; v.loop=!!m.loop; v.muted=!!m.autoplay; v.autoplay=!!m.autoplay; if(m.poster_url)v.poster=m.poster_url; v.className='ec-preview-video'; wrap.append(v);
      } else { const img=document.createElement('img'); img.src=m.object_url; img.alt=m.decorative?'':m.alt_text; img.className='ec-preview-image'; wrap.append(img); }
    } else if(m.file_name){ const p=document.createElement('p'); p.className='ec-asset-empty'; p.textContent='Tệp media cần chọn lại sau khi tải lại trang.'; wrap.append(p); }
    if(m.show_caption&&m.caption){const p=document.createElement('p');p.className='ec-reader-caption';p.textContent=m.caption;wrap.append(p);}
    if(m.credit){const p=document.createElement('p');p.className='ec-reader-credit';p.textContent=m.credit;wrap.append(p);}
    if(m.warnings?.length){const w=document.createElement('div');w.className='ec-media-warning';w.innerHTML='<strong>Gợi ý tối ưu</strong><ul>'+m.warnings.map(x=>'<li>'+esc(x)+'</li>').join('')+'</ul>';wrap.append(w);}
    target.append(wrap);
  };
  const renderFooter=()=>{
    const footer=document.querySelector('.site-footer .wrap'); if(!footer)return; const f=state.footer;
    const rows=[['Tác giả / Nhóm tác giả',f.authors],['Nguồn tài liệu / tư liệu',f.sources],['Ảnh',f.photos],['Đồ họa / Thiết kế',f.graphics],['Biên tập',f.editor],['Dòng bài / Chuyên đề',f.series],['Giới thiệu tòa soạn',f.newsroom],['Ngày xuất bản',f.publish_date],['Ngày cập nhật',f.updated_at],['Ghi chú phương pháp',f.method]].filter(([,v])=>String(v||'').trim());
    footer.innerHTML=rows.map(([k,v])=>'<p><strong>'+esc(k)+':</strong> '+esc(v)+'</p>').join('')||'<p class="ec-footer-empty">Chưa có thông tin chân trang.</p>';
  };
  const renderPublication=()=>{ document.title=state.publication.title||baseline.publication.title; const h=document.querySelector('.site-header strong'); if(h&&state.publication.masthead)h.textContent=state.publication.masthead; renderFooter(); };
  const renderAll=()=>{ applyText(); applyB03(); applyB06(); renderPublication(); renderMediaSummary('HERO_MEDIA',document.querySelector('#s00 .asset-frame')); renderMediaSummary('B03_GRAPHIC_REPLACEMENT',document.querySelector('#plan-visual')); state.interactive.B01?.items?.forEach((it,i)=>renderMediaSummary(it.id,document.querySelector('.ec-b01-media-slot[data-item="'+i+'"]'))); };

  const closePanel=()=>{ panel.hidden=true; panelOpen=false; if(lastFocused&&document.contains(lastFocused))lastFocused.focus(); };
  const openPanel=(title,html)=>{ lastFocused=document.activeElement; panel.querySelector('#ec-panel-title').textContent=title; panelBody.innerHTML=html; panel.hidden=false; panelOpen=true; panel.querySelector('#ec-close').focus(); };

  const setText=(field,value,reason='')=>{
    if(!field||field.policy==='LOCKED')return; const cleaned=String(value||'').replace(/\r/g,'').trim(); const current=state.text[field.id]?.after||field.baseline; if(cleaned===current)return;
    checkpoint();
    if(!cleaned||cleaned===field.baseline) delete state.text[field.id]; else state.text[field.id]={fieldId:field.id,path:field.path,section:field.section,before:field.baseline,after:cleaned,policy:field.policy,timestamp:now(),reason,previewOnly:field.policy==='HOLD_FOR_RESEARCH'||field.policy==='REVIEW_REQUIRED'};
    if(field.node.matches('#s00 h1')) state.publication.title=cleaned||field.baseline;
    if(field.node.matches('#s00 .dek')) state.publication.sapo=cleaned||field.baseline;
    renderAll();refresh();
  };
  const stopText=(commit=true)=>{if(!activeText)return;const {field,old}=activeText;const next=field.node.textContent;field.node.removeAttribute('contenteditable');field.node.classList.remove('ec-active');activeText=null;field.node.textContent=old;if(commit)setText(field,next);else renderAll();};
  const beginText=field=>{
    if(field.policy==='LOCKED'){showNotice('ĐÃ KHÓA — không thay đổi logic hoặc trạng thái bằng chứng.');return;}
    if(field.policy==='HOLD_FOR_RESEARCH'||field.policy==='REVIEW_REQUIRED'){openProposal(field);return;}
    if(activeText)stopText(true);activeText={field,old:field.node.textContent};field.node.setAttribute('contenteditable','plaintext-only');field.node.classList.add('ec-active');field.node.focus();showNotice('Đang sửa câu chữ. Enter để lưu, Esc để hủy.');
  };
  const openProposal=field=>{
    const current=state.text[field.id]?.after||field.baseline;
    openPanel('ĐỀ XUẤT CÂU CHỮ · '+field.section,'<p class="ec-warning">'+(field.policy==='HOLD_FOR_RESEARCH'?'CHỜ BỔ SUNG NGHIÊN CỨU — chỉ lưu đề xuất; không thay đổi trạng thái bằng chứng.':'CẦN DUYỆT — đề xuất chưa phải nội dung cuối.')+'</p><label>Nội dung hiện tại<textarea id="ec-proposed" rows="6">'+esc(current)+'</textarea></label><label>Lý do thay đổi<input id="ec-proposed-reason" value="'+esc(state.text[field.id]?.reason||'')+'"></label><button type="button" id="ec-proposed-save">LƯU ĐỀ XUẤT</button>');
    panel.querySelector('#ec-proposed-save').addEventListener('click',()=>{setText(field,panel.querySelector('#ec-proposed').value,panel.querySelector('#ec-proposed-reason').value.trim());closePanel();showNotice('Đã lưu đề xuất. Trạng thái nghiên cứu/duyệt không đổi.');});panel.querySelector('#ec-proposed').focus();
  };

  const fileWarnings=m=>{
    const w=[]; if(m.media_type==='VIDEO'){
      if(m.file_size>40*1024*1024)w.push('Tệp video khá lớn; có thể làm chậm tải trên di động.');
      if(m.width>1920||m.height>1920)w.push('Độ phân giải trên 1080p thường không cần thiết cho kích thước hiển thị hiện tại.');
      if(!m.poster_name)w.push('Nên có ảnh poster để tải trang ổn định hơn.');
      if(m.autoplay)w.push('Tự phát có thể gây khó chịu; hệ thống sẽ tự tắt tiếng khi tự phát.');
      if(!/video\/(mp4|webm)/.test(m.file_type||''))w.push('Nên ưu tiên H.264 MP4 hoặc WebM phổ biến.');
    }
    return w;
  };
  const mediaTechnical=m=>({slot_id:m.slot_id,media_type:m.media_type,asset_type:m.asset_type,representation_status:m.representation_status,file_name:m.file_name,file_type:m.file_type,file_size:m.file_size,duration:m.duration,width:m.width,height:m.height,evidence_impact:m.evidence_impact,review_status:m.review_status});
  const openMedia=(slotId,{title='CHỈNH MEDIA',hold=false,evidenceImpact='PRESENTATION_ONLY'}={})=>{
    if(!state.media[slotId])state.media[slotId]=emptyMedia(slotId,''); const m=state.media[slotId]; if(!m.evidence_impact)m.evidence_impact=evidenceImpact;
    openPanel(title,(hold?'<p class="ec-warning">CHỜ BỔ SUNG NGHIÊN CỨU — media chỉ là đề xuất, không nâng mức chắc chắn.</p>':'')+
      '<p class="ec-type-badge">MEDIA · Ảnh hoặc video</p>'+ 
      '<div class="ec-asset-input-actions"><label>TẢI LÊN / THAY MEDIA<input id="ec-media-file" type="file" accept="image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm"></label><button id="ec-media-remove" type="button">GỠ MEDIA</button><button id="ec-media-restore" type="button">KHÔI PHỤC MEDIA GỐC</button></div>'+ 
      '<label>Loại hình ảnh<select id="ec-media-asset-type">'+optionHtml(typeLabels,m.asset_type)+'</select></label>'+ 
      '<label>Nhãn hiển thị<select id="ec-media-representation">'+optionHtml(representationLabels,m.representation_status)+'</select></label>'+ 
      '<label><input id="ec-media-show-caption" type="checkbox"'+(m.show_caption?' checked':'')+'> Hiển thị chú thích</label>'+ 
      '<label>Chú thích<textarea id="ec-media-caption" rows="3">'+esc(m.caption)+'</textarea></label>'+ 
      '<label>Tác giả / Nguồn<input id="ec-media-credit" value="'+esc(m.credit)+'"></label>'+ 
      '<label>Nguồn tư liệu / Bối cảnh<input id="ec-media-source" value="'+esc(m.source_context)+'"></label>'+ 
      '<label>Mô tả ảnh cho người dùng khiếm thị<input id="ec-media-alt" value="'+esc(m.alt_text)+'"></label>'+ 
      '<label><input id="ec-media-decorative" type="checkbox"'+(m.decorative?' checked':'')+'> Ảnh trang trí</label>'+ 
      '<fieldset class="ec-video-options"'+(m.media_type==='VIDEO'?'':' hidden')+'><legend>Tùy chọn video</legend><label>Tỷ lệ<select id="ec-media-ratio"><option value="AUTO">Tự động</option><option value="16:9">16:9</option><option value="9:16">9:16</option></select></label><label><input id="ec-media-autoplay" type="checkbox"'+(m.autoplay?' checked':'')+'> Tự phát (sẽ tắt tiếng)</label><label><input id="ec-media-loop" type="checkbox"'+(m.loop?' checked':'')+'> Lặp lại</label><label>Ảnh poster<input id="ec-media-poster" type="file" accept="image/jpeg,image/png,image/webp,image/avif"></label><label>Phụ đề VTT nếu có<input id="ec-media-subtitle" type="file" accept="text/vtt,.vtt"></label></fieldset>'+ 
      '<label>Mức ảnh hưởng đến bằng chứng<select id="ec-media-impact">'+optionHtml(impactLabels,m.evidence_impact)+'</select></label>'+ 
      '<label>Lý do thay đổi<textarea id="ec-media-reason" rows="2">'+esc(m.change_reason)+'</textarea></label>'+ 
      '<div id="ec-media-status" class="ec-media-status">'+(m.file_name?'Tệp hiện tại: '+esc(m.file_name):'Chưa chọn tệp mới')+'</div>'+ 
      '<div id="ec-media-guidance" class="ec-media-guidance"></div>'+ 
      '<details class="ec-asset-advanced"><summary>CHI TIẾT KỸ THUẬT</summary><pre>'+esc(JSON.stringify(mediaTechnical(m),null,2))+'</pre></details>'+ 
      '<div class="ec-asset-input-actions"><button id="ec-media-save" type="button">LƯU BẢN NHÁP MEDIA</button><button id="ec-media-cancel" type="button">HỦY</button></div>');
    const q=id=>panel.querySelector('#'+id); q('ec-media-ratio').value=m.aspect_ratio||'AUTO'; let candidate=sessionFiles.get(slotId)||null, candidateUrl=m.object_url||null, poster=sessionPosters.get(slotId)||null, posterUrl=m.poster_url||null, meta={duration:m.duration,width:m.width,height:m.height};
    const updateVideoVisibility=type=>{panel.querySelector('.ec-video-options').hidden=type!=='VIDEO';};
    q('ec-media-file').addEventListener('change',()=>{
      const file=q('ec-media-file').files[0];if(!file)return; const isVideo=file.type.startsWith('video/'),isImage=file.type.startsWith('image/'); if(!isVideo&&!isImage){q('ec-media-status').textContent='Định dạng chưa được hỗ trợ.';q('ec-media-file').value='';return;}
      candidate=file; candidateUrl=URL.createObjectURL(file); const mt=isVideo?'VIDEO':'IMAGE'; updateVideoVisibility(mt); q('ec-media-status').textContent='Đã chọn '+(isVideo?'video':'ảnh')+' · '+Math.round(file.size/1024)+' KB';
      if(isVideo){const v=document.createElement('video');v.preload='metadata';v.src=candidateUrl;v.addEventListener('loadedmetadata',()=>{meta={duration:Number.isFinite(v.duration)?Math.round(v.duration*10)/10:null,width:v.videoWidth||null,height:v.videoHeight||null};q('ec-media-status').textContent+=' · '+(meta.duration??'?')+' giây · '+(meta.width||'?')+'×'+(meta.height||'?');},{once:true});}
      q('ec-media-file').dataset.mediaType=mt;
    });
    q('ec-media-poster').addEventListener('change',()=>{poster=q('ec-media-poster').files[0]||null;if(poster)posterUrl=URL.createObjectURL(poster);});
    q('ec-media-remove').addEventListener('click',()=>{candidate=null;candidateUrl=null;q('ec-media-file').value='';q('ec-media-status').textContent='Media sẽ được gỡ trong bản nháp.';q('ec-media-file').dataset.removed='1';});
    q('ec-media-restore').addEventListener('click',()=>{checkpoint();state.media[slotId]=clone(baseline.media[slotId]||emptyMedia(slotId,''));sessionFiles.delete(slotId);sessionPosters.delete(slotId);renderAll();refresh();closePanel();showNotice('Đã khôi phục media gốc.');});
    q('ec-media-cancel').addEventListener('click',closePanel);
    q('ec-media-save').addEventListener('click',()=>{
      checkpoint(); const old=state.media[slotId]||emptyMedia(slotId,''); const removed=q('ec-media-file').dataset.removed==='1'; const file=candidate; const mediaType=removed?old.media_type:(q('ec-media-file').dataset.mediaType||old.media_type||'IMAGE');
      const next={...old,slot_id:slotId,media_type:mediaType,asset_type:q('ec-media-asset-type').value,representation_status:q('ec-media-representation').value,file_name:removed?null:(file?.name||old.file_name),file_type:removed?null:(file?.type||old.file_type),file_size:removed?0:(file?.size||old.file_size||0),object_url:removed?null:(candidateUrl||old.object_url),poster_name:poster?.name||old.poster_name,poster_url:posterUrl||old.poster_url,caption:q('ec-media-caption').value.trim(),show_caption:q('ec-media-show-caption').checked,credit:q('ec-media-credit').value.trim(),source_context:q('ec-media-source').value.trim(),alt_text:q('ec-media-alt').value.trim(),decorative:q('ec-media-decorative').checked,aspect_ratio:q('ec-media-ratio').value,autoplay:q('ec-media-autoplay')?.checked||false,loop:q('ec-media-loop')?.checked||false,subtitle_name:q('ec-media-subtitle')?.files?.[0]?.name||old.subtitle_name,duration:meta.duration,width:meta.width,height:meta.height,change_reason:q('ec-media-reason').value.trim(),removed,evidence_impact:q('ec-media-impact').value,review_status:hold?'HOLD_FOR_RESEARCH':'DRAFT',timestamp:now()};
      next.warnings=fileWarnings(next); state.media[slotId]=next; if(file)sessionFiles.set(slotId,file);else if(removed)sessionFiles.delete(slotId); if(poster)sessionPosters.set(slotId,poster); renderAll();refresh();closePanel();showNotice('Đã lưu bản nháp media. Quyền sử dụng không được hệ thống tự xác minh.');
    });
    q('ec-media-file').focus();
  };

  const openB03=()=>{
    const d=state.structured.B03;
    openPanel('CHỈNH ĐỒ HỌA — B03','<p class="ec-type-badge">ĐỒ HỌA CÓ CẤU TRÚC</p><p>Chỉnh nội dung bên trong nhưng giữ nguyên bố cục và tương tác.</p>'+ 
      '<label>Toàn dự án<input id="b03-project" value="'+esc(d.project)+'"></label><label>Nền móng<input id="b03-foundation" value="'+esc(d.foundation)+'"></label><label>Lòng điện<input id="b03-hall" value="'+esc(d.hall)+'"></label><label>Đàn trì<input id="b03-court" value="'+esc(d.court)+'"></label><label>Chú giải / ghi chú nguồn<textarea id="b03-note" rows="3">'+esc(d.note)+'</textarea></label><label>Mô tả hỗ trợ tiếp cận<textarea id="b03-aria" rows="3">'+esc(d.aria)+'</textarea></label><label>Lý do thay đổi<input id="b03-reason" value="'+esc(d.reason||'')+'"></label>'+ 
      '<div class="ec-asset-input-actions"><button id="b03-save" type="button">LƯU NỘI DUNG ĐỒ HỌA</button><button id="b03-replace" type="button" class="secondary">THAY TOÀN BỘ ĐỒ HỌA</button><button id="b03-cancel" type="button">HỦY</button></div><details class="ec-asset-advanced"><summary>CHI TIẾT KỸ THUẬT</summary><pre>visual_type: STRUCTURED_GRAPHIC\nslot_id: B03_PLAN_VISUAL\ninteraction_logic: LOCKED\nlayout: LOCKED</pre></details>');
    panel.querySelector('#b03-save').addEventListener('click',()=>{checkpoint();const next={project:panel.querySelector('#b03-project').value.trim(),foundation:panel.querySelector('#b03-foundation').value.trim(),hall:panel.querySelector('#b03-hall').value.trim(),court:panel.querySelector('#b03-court').value.trim(),note:panel.querySelector('#b03-note').value.trim(),aria:panel.querySelector('#b03-aria').value.trim(),reason:panel.querySelector('#b03-reason').value.trim(),timestamp:now(),evidence_impact:'EVIDENCE_SUPPORTING'};const before=baseline.structured.B03;const numberChanged=['project','foundation','hall','court'].some(k=>(next[k].match(/[\d.,]+/g)||[]).join('|')!==(before[k].match(/[\d.,]+/g)||[]).join('|'));if(numberChanged)next.evidence_impact='EVIDENCE_AFFECTING';state.structured.B03=next;applyB03();refresh();closePanel();showNotice(numberChanged?'Đã lưu. Thay đổi số liệu được đánh dấu cần duyệt bằng chứng.':'Đã lưu nội dung đồ họa; bố cục và tương tác được giữ nguyên.');});
    panel.querySelector('#b03-replace').addEventListener('click',()=>openMedia('B03_GRAPHIC_REPLACEMENT',{title:'THAY TOÀN BỘ ĐỒ HỌA — B03',evidenceImpact:'EVIDENCE_SUPPORTING'}));panel.querySelector('#b03-cancel').addEventListener('click',closePanel);
  };
  const openB01=(selected=0)=>{
    const data=state.interactive.B01; if(!data)return; const item=data.items[selected]||data.items[0];
    openPanel('CHỈNH THÀNH PHẦN TƯƠNG TÁC — B01','<p class="ec-type-badge">THÀNH PHẦN TƯƠNG TÁC</p><p class="ec-item-nav">'+data.items.map((x,i)=>'<button type="button" data-b01-item="'+i+'"'+(i===selected?' class="active"':'')+'>ĐIỂM TƯƠNG TÁC '+(i+1)+'</button>').join('')+'</p><div id="b01-item-form"></div>');
    const renderForm=idx=>{const x=state.interactive.B01.items[idx];const form=panel.querySelector('#b01-item-form');form.innerHTML='<h3>ĐIỂM TƯƠNG TÁC '+(idx+1)+'</h3><p class="ec-locked-note">Trạng thái bằng chứng: Lớp '+esc(x.evidence_level)+' — khóa logic, không đổi tại đây.</p><label>Tiêu đề<input id="b01-title" value="'+esc(x.title)+'"></label><label>Nội dung chính<textarea id="b01-known" rows="4">'+esc(x.known)+'</textarea></label><label>Giới hạn / điều chưa thể kết luận<textarea id="b01-limit" rows="4">'+esc(x.limit)+'</textarea></label><label>Ghi chú<textarea id="b01-note" rows="3">'+esc(x.note)+'</textarea></label><label>Trạng thái hiển thị<select id="b01-status"><option>Đang dùng</option><option>Ẩn tạm</option><option>Chờ bổ sung nghiên cứu</option></select></label><label>Lý do thay đổi<input id="b01-reason" value="'+esc(x.reason||'')+'"></label><div class="ec-b01-media-slot" data-item="'+idx+'"></div><div class="ec-asset-input-actions"><button id="b01-media" type="button">CHỈNH MEDIA CỦA ĐIỂM</button><button id="b01-save" type="button">LƯU ĐIỂM TƯƠNG TÁC</button><button id="b01-cancel" type="button">HỦY</button></div><details class="ec-asset-advanced"><summary>CHI TIẾT KỸ THUẬT</summary><pre>visual_type: INTERACTIVE_COMPONENT\ncomponent_id: B01_REMAINS_VISUAL\nitem_id: '+esc(x.id)+'\nevidence_level: '+esc(x.evidence_level)+'</pre></details>';form.querySelector('#b01-status').value=x.status;renderMediaSummary(x.id,form.querySelector('.ec-b01-media-slot'));form.querySelector('#b01-media').addEventListener('click',()=>openMedia(x.id,{title:'CHỈNH MEDIA — ĐIỂM TƯƠNG TÁC '+(idx+1),evidenceImpact:'EVIDENCE_SUPPORTING'}));form.querySelector('#b01-save').addEventListener('click',()=>{checkpoint();const y=state.interactive.B01.items[idx];Object.assign(y,{title:form.querySelector('#b01-title').value.trim(),known:form.querySelector('#b01-known').value.trim(),limit:form.querySelector('#b01-limit').value.trim(),note:form.querySelector('#b01-note').value.trim(),status:form.querySelector('#b01-status').value,reason:form.querySelector('#b01-reason').value.trim(),timestamp:now()});renderB01Card(idx);refresh();closePanel();showNotice('Đã lưu điểm tương tác '+(idx+1)+'. Mức bằng chứng vẫn được khóa.');});form.querySelector('#b01-cancel').addEventListener('click',closePanel);};
    panel.querySelectorAll('[data-b01-item]').forEach(btn=>btn.addEventListener('click',()=>openB01(Number(btn.dataset.b01Item))));renderForm(selected);
  };
  const openB06=(selected=0)=>{
    const data=state.interactive.B06,item=data?.items?.[selected];if(!item)return;
    openPanel('CHỈNH NỘI DUNG TƯƠNG TÁC — B06','<p class="ec-type-badge">THÀNH PHẦN TƯƠNG TÁC</p><p class="ec-item-nav">'+data.items.map((x,i)=>'<button type="button" data-b06-item="'+i+'"'+(i===selected?' class="active"':'')+'>'+(i+1)+'</button>').join('')+'</p><label>Nhãn bước<input id="b06-label" value="'+esc(item.label)+'"></label><label>Tiêu đề giải thích<input id="b06-title" value="'+esc(item.title)+'"></label><label>Nội dung giải thích<textarea id="b06-copy" rows="5">'+esc(item.copy)+'</textarea></label><label>Lý do thay đổi<input id="b06-reason" value="'+esc(item.reason||'')+'"></label><div class="ec-asset-input-actions"><button id="b06-save" type="button">LƯU BƯỚC</button><button id="b06-cancel" type="button">HỦY</button></div><details class="ec-asset-advanced"><summary>CHI TIẾT KỸ THUẬT</summary><pre>component: B06_REASONING_CHAIN\ninteraction_logic: LOCKED\nitem_key: '+esc(item.key)+'</pre></details>');
    panel.querySelectorAll('[data-b06-item]').forEach(btn=>btn.addEventListener('click',()=>openB06(Number(btn.dataset.b06Item))));panel.querySelector('#b06-save').addEventListener('click',()=>{checkpoint();Object.assign(state.interactive.B06.items[selected],{label:panel.querySelector('#b06-label').value.trim(),title:panel.querySelector('#b06-title').value.trim(),copy:panel.querySelector('#b06-copy').value.trim(),reason:panel.querySelector('#b06-reason').value.trim(),timestamp:now()});applyB06(item.key);refresh();closePanel();showNotice('Đã lưu câu chữ B06; ID, thứ tự và logic chuyển bước không đổi.');});panel.querySelector('#b06-cancel').addEventListener('click',closePanel);
  };
  const publicationFields=[['masthead','Cơ quan báo chí / Măng-sét'],['section','Chuyên mục'],['title','Tiêu đề'],['sapo','Sapo'],['authors','Tác giả / Nhóm tác giả'],['publish_date','Ngày xuất bản'],['publish_time','Giờ xuất bản'],['updated_at','Ngày cập nhật gần nhất'],['slug','URL slug'],['editor','Biên tập'],['photos','Ảnh'],['graphics','Đồ họa'],['design','Thiết kế'],['team','Nhóm thực hiện']];
  const footerFields=[['authors','Tác giả / Nhóm tác giả'],['sources','Nguồn tài liệu và tư liệu'],['photos','Ảnh'],['graphics','Đồ họa / Thiết kế'],['editor','Biên tập'],['series','Giới thiệu dòng bài / chuyên đề'],['newsroom','Giới thiệu tòa soạn'],['publish_date','Ngày xuất bản'],['updated_at','Ngày cập nhật'],['method','Ghi chú phương pháp']];
  const openPublication=()=>{
    const p=state.publication,f=state.footer,s=state.share;
    openPanel('THÔNG TIN XUẤT BẢN','<h3>Thông tin bài</h3>'+publicationFields.map(([k,l])=>'<label>'+l+(k==='sapo'?'<textarea rows="4" data-pub="'+k+'">'+esc(p[k])+'</textarea>':'<input data-pub="'+k+'" value="'+esc(p[k])+'">')+'</label>').join('')+'<h3>Chân trang</h3><p class="ec-small">Trường để trống sẽ không hiển thị.</p>'+footerFields.map(([k,l])=>'<label>'+l+'<input data-footer="'+k+'" value="'+esc(f[k])+'"></label>').join('')+'<h3>Thông tin chia sẻ</h3><label>Tiêu đề chia sẻ<input data-share="title" value="'+esc(s.title)+'"></label><label>Mô tả chia sẻ<textarea data-share="description" rows="3">'+esc(s.description)+'</textarea></label><label>Ảnh đại diện chia sẻ<input data-share="thumbnail" value="'+esc(s.thumbnail)+'"></label><label>Canonical URL<input data-share="canonical" value="'+esc(s.canonical)+'"></label><div class="ec-asset-input-actions"><button id="ec-publication-save" type="button">LƯU THÔNG TIN</button><button id="ec-publication-cancel" type="button">HỦY</button></div>');
    panel.querySelector('#ec-publication-save').addEventListener('click',()=>{checkpoint();panel.querySelectorAll('[data-pub]').forEach(el=>state.publication[el.dataset.pub]=el.value.trim());panel.querySelectorAll('[data-footer]').forEach(el=>state.footer[el.dataset.footer]=el.value.trim());panel.querySelectorAll('[data-share]').forEach(el=>state.share[el.dataset.share]=el.value.trim());const h1Field=[...fields.values()].find(x=>x.node.matches('#s00 h1'));const dekField=[...fields.values()].find(x=>x.node.matches('#s00 .dek'));if(h1Field&&state.publication.title!==h1Field.baseline)state.text[h1Field.id]={fieldId:h1Field.id,path:h1Field.path,section:h1Field.section,before:h1Field.baseline,after:state.publication.title,policy:'EDITABLE',timestamp:now(),reason:'Đồng bộ từ Thông tin xuất bản',previewOnly:false};if(dekField&&state.publication.sapo!==dekField.baseline)state.text[dekField.id]={fieldId:dekField.id,path:dekField.path,section:dekField.section,before:dekField.baseline,after:state.publication.sapo,policy:'EDITABLE',timestamp:now(),reason:'Đồng bộ từ Thông tin xuất bản',previewOnly:false};renderAll();refresh();closePanel();showNotice('Đã cập nhật thông tin xuất bản và chân trang.');});panel.querySelector('#ec-publication-cancel').addEventListener('click',closePanel);
  };

  const currentDiffs=()=>{
    const rows=[];
    Object.values(state.text).forEach(r=>rows.push({kind:'text',title:r.section,before:r.before,after:r.after,time:r.timestamp,reason:r.reason,technical:{field_id:r.fieldId,policy:r.policy}}));
    Object.entries(state.media).forEach(([id,m])=>{if(!m.timestamp)return;const b=baseline.media[id]||emptyMedia(id,'');rows.push({kind:'media',title:id,before:(b.caption||b.file_name||'Chưa có media'),after:(m.caption||m.file_name||(m.removed?'Đã gỡ media':'Đã đổi metadata')),time:m.timestamp,reason:m.change_reason,technical:mediaTechnical(m),media:{id,m}});});
    const b03=state.structured.B03;if(JSON.stringify(b03)!==JSON.stringify(baseline.structured.B03))rows.push({kind:'graphic',title:'B03 — Đồ họa có cấu trúc',before:[baseline.structured.B03.project,baseline.structured.B03.foundation,baseline.structured.B03.hall,baseline.structured.B03.court].join(' · '),after:[b03.project,b03.foundation,b03.hall,b03.court].join(' · '),time:b03.timestamp,reason:b03.reason,technical:{visual_type:'STRUCTURED_GRAPHIC',slot_id:'B03_PLAN_VISUAL',evidence_impact:b03.evidence_impact}});
    state.interactive.B01?.items?.forEach((x,i)=>{const b=baseline.interactive.B01.items[i];if(JSON.stringify(x)!==JSON.stringify(b))rows.push({kind:'interactive',title:'B01 — Điểm tương tác '+(i+1),before:b.title+' · '+b.known,after:x.title+' · '+x.known,time:x.timestamp,reason:x.reason,technical:{visual_type:'INTERACTIVE_COMPONENT',item_id:x.id,evidence_level:x.evidence_level}});});
    state.interactive.B06?.items?.forEach((x,i)=>{const b=baseline.interactive.B06.items[i];if(JSON.stringify(x)!==JSON.stringify(b))rows.push({kind:'interactive',title:'B06 — Bước '+(i+1),before:b.label+' · '+b.copy,after:x.label+' · '+x.copy,time:x.timestamp,reason:x.reason,technical:{component:'B06_REASONING_CHAIN',item_key:x.key}});});
    if(JSON.stringify(state.publication)!==JSON.stringify(baseline.publication))rows.push({kind:'metadata',title:'Thông tin xuất bản',before:baseline.publication.title,after:state.publication.title,time:now(),reason:'',technical:{publication:state.publication}});
    if(JSON.stringify(state.footer)!==JSON.stringify(baseline.footer))rows.push({kind:'metadata',title:'Chân trang',before:'Bản gốc',after:'Đã cập nhật dữ liệu chân trang',time:now(),reason:'',technical:{footer:state.footer}});
    return rows;
  };
  const openHistory=()=>{
    const rows=currentDiffs(); openPanel('LỊCH SỬ CHỈNH SỬA',rows.length?rows.map(r=>'<article class="ec-diff"><h3>'+esc(r.title)+'</h3><div class="ec-before"><strong>TRƯỚC</strong><p>'+esc(r.before)+'</p></div><div class="ec-after"><strong>SAU</strong><p>'+esc(r.after)+'</p></div>'+(r.reason?'<p><strong>Lý do:</strong> '+esc(r.reason)+'</p>':'')+'<p class="ec-small">'+esc(r.time||'Chưa lưu thời điểm')+'</p><details class="ec-asset-advanced"><summary>CHI TIẾT KỸ THUẬT</summary><pre>'+esc(JSON.stringify(r.technical,null,2))+'</pre></details></article>').join(''):'<p>Chưa có thay đổi so với bản gốc.</p>');
  };
  const saveDraft=()=>{if(activeText)stopText(true);try{const payload={schema:'interactive-editorial-console/v0.4',branch:BRANCH,savedAt:now(),state:clone(state)};Object.values(payload.state.media).forEach(m=>{m.object_url=null;m.poster_url=null;if(m.file_name)m.binary_reselect_required=true;});localStorage.setItem(STORAGE,JSON.stringify(payload));savedState=serial();refresh();showNotice('Đã lưu nháp trên trình duyệt này. Tệp media cần chọn lại sau khi tải lại.');}catch(e){showNotice('Không thể lưu nháp vào trình duyệt. Hãy dùng Xuất gói thay đổi.');}};
  const undo=()=>{if(activeText)stopText(true);if(!undoStack.length)return;redoStack.push(sessionSnapshot());restoreSession(undoStack.pop());showNotice('Đã hoàn tác.');};
  const redo=()=>{if(activeText)stopText(true);if(!redoStack.length)return;undoStack.push(sessionSnapshot());restoreSession(redoStack.pop());showNotice('Đã làm lại.');};
  const restoreBaseline=()=>{if(!confirm('Khôi phục toàn bộ bản gốc trong phiên biên tập này?'))return;checkpoint();Object.keys(state.text).forEach(k=>delete state.text[k]);state.publication=clone(baseline.publication);state.footer=clone(baseline.footer);state.share=clone(baseline.share);state.structured=clone(baseline.structured);state.interactive=clone(baseline.interactive);state.media=clone(baseline.media);sessionFiles.clear();sessionPosters.clear();renderAll();refresh();showNotice('Đã khôi phục bản gốc trong trình duyệt.');};
  const exportChanges=()=>{const payload={schema:'interactive-editorial-changeset/v0.4',exportedAt:now(),source:{repository:'hoanddk/dkt-interactive',branch:BRANCH,path:'index.html'},productState:'EDITORIAL_FINISHING',editorialAccessState:'LIVE_EDIT',changes:currentDiffs(),publication:state.publication,footer:state.footer,share:state.share,review:{approved:false,mergeAllowed:false,publishAllowed:false}};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='dkt-editorial-changes-'+now().slice(0,19).replace(/[:T]/g,'-')+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);showNotice('Đã xuất gói thay đổi kỹ thuật. Không có commit hoặc publish tự động.');};
  const exitMode=()=>{if(isDirty()&&!confirm('Có thay đổi chưa LƯU NHÁP. Thoát biên tập?'))return;const u=new URL(location.href);u.searchParams.delete('edit');u.searchParams.delete('editorial_mode');location.assign(u.toString());};

  main.addEventListener('click',e=>{
    const hotspotEdit=e.target.closest('[data-ec-hotspot-edit]');if(hotspotEdit){e.preventDefault();openB01(Number(hotspotEdit.dataset.ecHotspotEdit));return;}
    const el=e.target.closest('[data-editorial-field]');if(!el)return;const field=fields.get(el.dataset.editorialField);if(!field||field.policy==='LOCKED'||field.interactiveControl)return;e.preventDefault();beginText(field);
  });
  main.addEventListener('dblclick',e=>{const el=e.target.closest('[data-editorial-field]');if(!el)return;const field=fields.get(el.dataset.editorialField);if(!field||!field.interactiveControl)return;e.preventDefault();e.stopPropagation();if(field.node.closest('#roof-case .reasoning-chain')){const idx=[...document.querySelectorAll('#roof-case [data-reason]')].indexOf(field.node);openB06(Math.max(0,idx));}else beginText(field);});
  main.addEventListener('keydown',e=>{const el=e.target.closest('[data-editorial-field]');if(!el)return;const field=fields.get(el.dataset.editorialField);if(!field||field.policy==='LOCKED')return;if(activeText&&activeText.field===field){if(e.key==='Escape'){e.preventDefault();stopText(false);}else if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();stopText(true);}}else if(!field.interactiveControl&&(e.key==='Enter'||e.key===' ')){e.preventDefault();beginText(field);}else if(field.interactiveControl&&e.key==='F2'){e.preventDefault();if(field.node.closest('#roof-case .reasoning-chain'))openB06([...document.querySelectorAll('#roof-case [data-reason]')].indexOf(field.node));else beginText(field);}});
  main.addEventListener('focusout',e=>{if(activeText&&e.target===activeText.field.node)stopText(true);});

  const addControl=(target,text,handler,className='ec-visual-control')=>{if(!target)return;const b=document.createElement('button');b.type='button';b.className=className;b.textContent=text;b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();handler();});target.insertAdjacentElement('afterend',b);return b;};
  addControl(document.querySelector('#s00 .asset-frame'),'CHỈNH MEDIA',()=>openMedia('HERO_MEDIA',{title:'CHỈNH MEDIA — HERO'}));
  addControl(document.querySelector('#plan-visual'),'CHỈNH NỘI DUNG ĐỒ HỌA',openB03);
  addControl(document.querySelector('#remains .hotspot-stage'),'CHỈNH THÀNH PHẦN TƯƠNG TÁC',()=>openB01(0));
  addControl(document.querySelector('#roof-case .reasoning-chain'),'CHỈNH NỘI DUNG CÁC BƯỚC',()=>openB06(0));

  document.querySelectorAll('#remains [data-hotspot]').forEach((btn,i)=>btn.addEventListener('click',()=>queueMicrotask(()=>{document.querySelectorAll('#remains [data-hotspot]').forEach((x,j)=>x.classList.toggle('ec-hotspot-selected',i===j));renderB01Card(i);}))); 
  document.querySelectorAll('#roof-case [data-reason]').forEach(btn=>btn.addEventListener('click',()=>queueMicrotask(()=>applyB06(btn.dataset.reason))));

  bar.addEventListener('click',e=>{const b=e.target.closest('[data-ec-action]');if(!b||b.tagName==='A')return;const a=b.dataset.ecAction;if(a==='save')saveDraft();else if(a==='undo')undo();else if(a==='redo')redo();else if(a==='history')openHistory();else if(a==='publication')openPublication();else if(a==='restore')restoreBaseline();else if(a==='export')exportChanges();else if(a==='exit')exitMode();});
  panel.querySelector('#ec-close').addEventListener('click',closePanel);
  document.addEventListener('keydown',e=>{
    const mod=e.metaKey||e.ctrlKey;if(mod&&e.key.toLowerCase()==='z'&&!e.altKey){e.preventDefault();if(e.shiftKey)redo();else undo();return;}
    if(!panelOpen)return;if(e.key==='Escape'){e.preventDefault();closePanel();return;}if(e.key!=='Tab')return;const focus=[...panel.querySelectorAll('button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),summary')].filter(x=>x.offsetParent!==null);if(!focus.length)return;const first=focus[0],last=focus[focus.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  });
  window.addEventListener('beforeunload',e=>{if(isDirty()){e.preventDefault();e.returnValue='';}});

  try{const raw=localStorage.getItem(STORAGE);if(raw){const payload=JSON.parse(raw);if(payload.schema==='interactive-editorial-console/v0.4'&&payload.branch===BRANCH){Object.assign(state,payload.state||{});Object.values(state.media||{}).forEach(m=>{m.object_url=null;m.poster_url=null;});savedState=serial();showNotice('Đã nạp bản nháp local. Tệp media cần chọn lại nếu đã thay.');}}}catch(e){showNotice('Không thể nạp bản nháp local.');}
  if(!savedState)savedState=serial();renderAll();refresh();
  window.__editorialConsoleV04={version:'0.1.4',state,getChanges:currentDiffs,undo,redo,saveDraft,openHistory,openPublication,openB03,openB01,openB06,openMedia,isDirty};
  window.__editorialAssets={getChanges:()=>currentDiffs().filter(x=>x.kind==='media'),hasChanges:()=>Object.values(state.media).some(m=>m.timestamp),canUndo:()=>undoStack.length>0,canRedo:()=>redoStack.length>0,isDirty,saveDraft,restoreAll:restoreBaseline,undo,redo,compareHtml:()=>'',slots:Object.keys(state.media)};
})();