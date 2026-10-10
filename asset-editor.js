/* Editorial Content Editor v0.1 — visual draft extension. No Git API or binary persistence. */
(() => {
  'use strict';
  if (new URLSearchParams(location.search).get('edit') !== '1') return;
  const root = document.querySelector('main');
  const toolbar = document.querySelector('#editor-console');
  const panel = document.querySelector('#editor-panel');
  if (!root || !toolbar || !panel) return;
  const now = () => new Date().toISOString();
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const types = ['PHOTO_CURRENT','ARCHIVAL_PHOTO','EDITORIAL_GRAPHIC','SCHEMATIC','RECONSTRUCTION','MAP','DATA_VISUAL','PLACEHOLDER'];
  const rights = ['NOT_CHECKED','UNKNOWN','RESTRICTED','CLEARED'];
  const provenances = ['MISSING','PARTIAL','COMPLETE'];
  const representations = ['EDITORIAL_ILLUSTRATION','NOT_CURRENT_PHOTO','RECONSTRUCTION_HYPOTHESIS','SCHEMATIC_NOT_TO_SCALE','DOCUMENTARY_PHOTO','ARCHIVAL_WITH_CONTEXT','PLACEHOLDER_NOT_FINAL'];
  const impacts = ['PRESENTATION_ONLY','EVIDENCE_SUPPORTING','EVIDENCE_AFFECTING','CLAIM_AFFECTING'];
  const strongestImpact = (slot,meta) => {
    const min = slot.baseline.evidence_impact;
    const fromType = meta.asset_type==='RECONSTRUCTION'?'EVIDENCE_AFFECTING':'PRESENTATION_ONLY';
    return [meta.evidence_impact,min,fromType].reduce((a,b)=>impacts.indexOf(a)>=impacts.indexOf(b)?a:b);
  };
  const mapping = [
    ['HERO_IMAGE','s00','.asset-frame','EDITORIAL_GRAPHIC','EDITORIAL_ILLUSTRATION','PRESENTATION_ONLY',false],
    ['B01_REMAINS_VISUAL','remains','.hotspot-stage','EDITORIAL_GRAPHIC','NOT_CURRENT_PHOTO','EVIDENCE_SUPPORTING',false],
    ['B01_HOTSPOT_01','remains',null,'EDITORIAL_GRAPHIC','NOT_CURRENT_PHOTO','EVIDENCE_SUPPORTING',false],
    ['B01_HOTSPOT_02','remains',null,'EDITORIAL_GRAPHIC','NOT_CURRENT_PHOTO','EVIDENCE_SUPPORTING',false],
    ['B01_HOTSPOT_03','remains',null,'EDITORIAL_GRAPHIC','NOT_CURRENT_PHOTO','EVIDENCE_SUPPORTING',false],
    ['B03_PLAN_VISUAL','measure','#plan-visual','SCHEMATIC','SCHEMATIC_NOT_TO_SCALE','EVIDENCE_SUPPORTING',false],
    ['B05_MODEL_A','models','#model-a .model-schematic','RECONSTRUCTION','RECONSTRUCTION_HYPOTHESIS','EVIDENCE_AFFECTING',true],
    ['B05_MODEL_B','models','#model-b .model-schematic','RECONSTRUCTION','RECONSTRUCTION_HYPOTHESIS','EVIDENCE_AFFECTING',true],
    ['B05_MODEL_C','models','#model-c .model-schematic','EDITORIAL_GRAPHIC','EDITORIAL_ILLUSTRATION','EVIDENCE_AFFECTING',true],
    ['B06_ROOF_VISUAL','roof-case',null,'RECONSTRUCTION','RECONSTRUCTION_HYPOTHESIS','EVIDENCE_AFFECTING',false],
    ['B07_PRESERVATION_SCHEMATIC','preserve',null,'SCHEMATIC','SCHEMATIC_NOT_TO_SCALE','EVIDENCE_SUPPORTING',false],
    ['B08_LEGAL_VISUAL','control-gates',null,'EDITORIAL_GRAPHIC','EDITORIAL_ILLUSTRATION','CLAIM_AFFECTING',true],
    ['B09_CLOSURE_VISUAL','closure',null,'EDITORIAL_GRAPHIC','EDITORIAL_ILLUSTRATION','PRESENTATION_ONLY',false]
  ];
  const branch = 'editorial/round-2a-v0.1.5';
  const storageKey = 'dkt:asset-editor:v0.1:' + branch;
  const slots = new Map();
  const undo = [];
  let active = null;
  let lastSaved = '[]';
  let stale = false;
  const changed = () => Array.from(slots.values()).filter(s => s.record).map(s => s.record);
  const fingerprint = () => JSON.stringify(changed());
  const safeFile = f => f.name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,100);
  const emptyMetadata = (id, type, repr, impact) => ({
    slot_id:id, asset_id:'BASELINE_PLACEHOLDER_'+id, asset_type:type, file_name:null,
    caption:'',credit:'',source:'',alt_text:'',decorative:false,
    rights_status:'NOT_CHECKED',provenance_status:'MISSING',representation_status:repr,
    evidence_level: id==='B01_REMAINS_VISUAL'?'1 / 2':id==='B01_HOTSPOT_03'?'2':/^B01_HOTSPOT_0[12]$/.test(id)?'1':id==='B06_ROOF_VISUAL'?'4':null,
    evidence_impact:impact,editorial_status:'BASELINE',change_reason:'',version:0,
    source_id:null,provenance_id:null
  });
  mapping.forEach(([id,sectionId,selector,type,repr,impact,hold]) => {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const hotspotNumber = /^B01_HOTSPOT_0([123])$/.exec(id)?.[1] || null;
    let target = selector ? section.querySelector(selector) : null;
    let virtual = false;
    if (hotspotNumber) {
      const stage = section.querySelector('.hotspot-stage');
      let group = section.querySelector('.ec-hotspot-asset-group');
      if (stage && !group) {
        group = document.createElement('div');
        group.className = 'ec-hotspot-asset-group';
        group.setAttribute('aria-label','Chỉnh ảnh cho từng điểm tương tác B01');
        stage.insertAdjacentElement('afterend',group);
      }
      if (group) {
        target = document.createElement('div');
        target.className = 'ec-hotspot-asset';
        target.dataset.hotspotNumber = hotspotNumber;
        group.append(target);
        virtual = true;
      }
    }
    if (!target) {
      target = document.createElement('div');
      target.className = 'ec-virtual-asset';
      target.setAttribute('aria-label','Visual proposal slot '+id);
      const wrap = document.createElement('div');
      wrap.className = 'wrap';
      wrap.append(target);
      section.append(wrap);
      virtual = true;
    }
    const baseline = emptyMetadata(id,type,repr,impact);
    if (id === 'HERO_IMAGE') {
      const cap = section.querySelector('figcaption');
      baseline.caption = cap ? cap.textContent.trim() : '';
    }
    if (id === 'B01_REMAINS_VISUAL') baseline.caption = 'ĐỒ HỌA BIÊN TẬP · KHÔNG PHẢI ẢNH HIỆN TRẠNG';
    if (hotspotNumber) baseline.caption = 'Điểm tương tác '+Number(hotspotNumber)+' — chưa có ảnh riêng được xác minh';
    if (id === 'B03_PLAN_VISUAL') baseline.caption = 'Sơ đồ đơn giản hóa các phạm vi đo; không thay bản vẽ khảo cổ.';
    const originalImg = target.querySelector('img[src]');
    if (originalImg) {
      baseline.file_name = originalImg.getAttribute('src');
      baseline.asset_id = 'BASELINE_'+id;
      baseline.alt_text = originalImg.alt || '';
    }
    const slot = {id,sectionId,target,virtual,hold,hotspotNumber,baseline,record:null,file:null,url:null,preview:null,captionEl:null,ctrl:null,originalImg};
    slots.set(id,slot);
    target.dataset.editorialSlot = id;
    target.classList.add('ec-asset-host');
    const ctrl = document.createElement('button');
    ctrl.type = 'button';
    ctrl.className = 'ec-asset-control';
    ctrl.textContent = hotspotNumber?'CHỈNH ẢNH ĐIỂM '+Number(hotspotNumber):(hold?'CHỈNH ẢNH · Chờ xác minh':'CHỈNH ẢNH');
    ctrl.setAttribute('aria-label',hotspotNumber?'Chỉnh ảnh điểm tương tác '+Number(hotspotNumber)+' — B01 Dấu tích còn lại':'Chỉnh sửa hình ảnh'+(hold?' — chờ xác minh tư liệu':''));
    ctrl.addEventListener('click', e => {e.preventDefault();e.stopPropagation();if(hotspotNumber)selectHotspot(slot);open(slot);});
    slot.ctrl = ctrl;
    target.append(ctrl);
    const display = document.createElement('div');
    display.className = 'ec-asset-display';
    display.hidden = true;
    slot.preview = display;
    target.append(display);
  });
  // The public hotspot interaction remains intact. Edit mode adds a contextual
  // action AFTER app.js updates the evidence card; each action targets its own slot.
  const selectHotspot = slot => {
    if (!slot?.hotspotNumber) return;
    const section = document.getElementById('remains');
    section?.querySelectorAll('[data-hotspot]').forEach((btn,i)=>{
      btn.classList.toggle('ec-hotspot-selected',i+1===Number(slot.hotspotNumber));
    });
    section?.querySelectorAll('.ec-hotspot-asset').forEach(el=>{
      el.classList.toggle('ec-hotspot-asset-selected',el.dataset.hotspotNumber===slot.hotspotNumber);
    });
  };
  document.querySelectorAll('#remains [data-hotspot]').forEach((btn,i)=>{
    const id='B01_HOTSPOT_0'+(i+1);
    const slot=slots.get(id);
    if(!slot)return;
    btn.addEventListener('click',()=>{
      selectHotspot(slot);
      queueMicrotask(()=>{
        const card=document.querySelector('#hotspot-card');
        if(!card)return;
        const action=document.createElement('button');
        action.type='button';
        action.className='ec-hotspot-context-action';
        action.textContent='CHỈNH ẢNH — ĐIỂM TƯƠNG TÁC '+(i+1);
        action.setAttribute('aria-label','Mở chỉnh sửa ảnh điểm tương tác '+(i+1));
        action.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();selectHotspot(slot);open(slot);});
        card.querySelectorAll('.ec-hotspot-context-action').forEach(el=>el.remove());
        card.append(action);
      });
    });
  });
  const snapshot = () => Array.from(slots.values()).map(s => ({
    id:s.id,record:s.record?JSON.parse(JSON.stringify(s.record)):null,file:s.file,url:s.url
  }));
  const restoreSnapshot = state => {
    state.forEach(item => {
      const s = slots.get(item.id); if (!s) return;
      s.record=item.record;s.file=item.file;s.url=item.url;render(s);
    });
    refresh();
  };
  const notify = message => { const el=document.querySelector('#ec-notice'); if(el)el.textContent=message; };
  const qcFor = (m,hold) => {
    const qc=['VISUAL_LAYOUT_QC','ACCESSIBILITY_ALT_QC','CAPTION_CREDIT_QC','RIGHTS_PROVENANCE_QC'];
    if (m.evidence_impact==='EVIDENCE_SUPPORTING') qc.push('EVIDENCE_ALIGNMENT_QC');
    if (m.evidence_impact==='EVIDENCE_AFFECTING') qc.push('REOPEN_EVIDENCE_REVIEW');
    if (m.evidence_impact==='CLAIM_AFFECTING') qc.push('REOPEN_EDITORIAL_DECISION','SOURCE_VERIFICATION');
    if (hold) qc.push('HOLD_FOR_RESEARCH','SOURCE_VERIFICATION');
    return qc;
  };
  const gate = (m,hold,fileAvailable) => {
    const reasons=[];
    if (hold) reasons.push('HOLD_FOR_RESEARCH');
    if (m.rights_status!=='CLEARED') reasons.push('RIGHTS_NOT_CLEARED');
    if (m.provenance_status!=='COMPLETE') reasons.push('PROVENANCE_NOT_COMPLETE');
    if (m.asset_type==='PLACEHOLDER') reasons.push('PLACEHOLDER_NOT_FINAL');
    if (m.asset_type==='RECONSTRUCTION' && m.representation_status!=='RECONSTRUCTION_HYPOTHESIS') reasons.push('RECONSTRUCTION_LABEL_REQUIRED');
    if (m.asset_type==='SCHEMATIC' && m.representation_status!=='SCHEMATIC_NOT_TO_SCALE') reasons.push('SCHEMATIC_LABEL_REQUIRED');
    if (m.asset_type==='EDITORIAL_GRAPHIC' && m.representation_status!=='EDITORIAL_ILLUSTRATION' && m.representation_status!=='NOT_CURRENT_PHOTO') reasons.push('EDITORIAL_GRAPHIC_LABEL_REQUIRED');
    if (m.asset_type==='ARCHIVAL_PHOTO' && (!m.source.trim()||!m.caption.trim())) reasons.push('ARCHIVAL_SOURCE_CONTEXT_REQUIRED');
    if (!m.decorative && !m.alt_text.trim() && !m.removed) reasons.push('ALT_REQUIRED');
    if (m.alt_text.trim() && m.caption.trim() && m.alt_text.trim()===m.caption.trim()) reasons.push('ALT_DUPLICATES_CAPTION');
    if (!m.change_reason.trim()) reasons.push('CHANGE_REASON_REQUIRED');
    if (!m.removed && m.file_name && !fileAvailable) reasons.push('BINARY_RESELECT_OR_CONTROLLED_UPLOAD_REQUIRED');
    return reasons;
  };
  const assetType = (slot,meta) => slot.record?.type || 'ASSET_CHANGE';
  const makeRecord = (slot,meta,file,url) => {
    const prior = slot.record;
    const fileName = file?safeFile(file):meta.file_name;
    const oldId=slot.baseline.asset_id;
    const newId=meta.removed?null:(file?slot.id+'_DRAFT_'+Date.now():prior?.new_asset_id||oldId);
    const m={...meta,slot_id:slot.id,file_name:fileName,asset_id:newId,version:slot.baseline.version+1,editorial_status:'DRAFT'};
    m.evidence_impact=strongestImpact(slot,m);
    const binaryRequired=!!file || !!(prior?.binaryRequired && !meta.removed);
    const gateReasons=gate(m,slot.hold,!!file || !binaryRequired);
    const type=meta.removed?'ASSET_CHANGE':file?'IMAGE_REPLACE':'ASSET_CHANGE';
    return {type,slot_id:slot.id,section:slot.sectionId,old_asset_id:oldId,new_asset_id:newId,
      old:slot.baseline,new:m,change_timestamp:now(),change_reason:m.change_reason,
      changed_by:null,review_status:slot.hold?'HOLD_FOR_RESEARCH':'PENDING_REVIEW',
      evidence_sensitive:slot.hold,evidence_impact:m.evidence_impact,impactQc:qcFor(m,slot.hold),
      gate_reasons:gateReasons,publish_eligible:false,review_approved:false,
      binaryRequired,binaryAvailableInSession:!!file,
      upload_manifest:file?{file_name:fileName,mime_type:file.type,bytes:file.size,repository_path:'assets/editorial/'+slot.id.toLowerCase()+'/'+fileName,upload_status:'PENDING_CONTROLLED_UPLOAD'}:
        (binaryRequired?{file_name:fileName,upload_status:'RESELECT_REQUIRED'}:null),
      revision_type:new URLSearchParams(location.search).get('editorial_mode')==='post_publish'?'POST_PUBLISH_ASSET_UPDATE':
        new URLSearchParams(location.search).get('editorial_mode')==='controlled'?'POST_BASELINE_ASSET_CHANGE':'LIVE_EDIT_ASSET_DRAFT'};
  };
  // Editorial labels only: gate codes, IDs and manifest remain unchanged in the data model.
  const typeLabels = {
    PHOTO_CURRENT:'Ảnh hiện trạng', ARCHIVAL_PHOTO:'Ảnh tư liệu',
    EDITORIAL_GRAPHIC:'Đồ họa biên tập', SCHEMATIC:'Sơ đồ minh họa',
    RECONSTRUCTION:'Hình phục dựng', MAP:'Bản đồ',
    DATA_VISUAL:'Đồ họa dữ liệu', PLACEHOLDER:'Ảnh giữ chỗ'
  };
  const valueLabels = {
    ...typeLabels,
    NOT_CHECKED:'Chưa kiểm tra', UNKNOWN:'Chưa rõ', RESTRICTED:'Bị hạn chế', CLEARED:'Đã xác nhận',
    MISSING:'Thiếu thông tin', PARTIAL:'Một phần', COMPLETE:'Đầy đủ',
    EDITORIAL_ILLUSTRATION:'Đồ họa minh họa biên tập',
    NOT_CURRENT_PHOTO:'Không phải ảnh hiện trạng',
    RECONSTRUCTION_HYPOTHESIS:'Hình phục dựng giả định',
    SCHEMATIC_NOT_TO_SCALE:'Sơ đồ không theo tỷ lệ',
    DOCUMENTARY_PHOTO:'Ảnh tư liệu thực địa',
    ARCHIVAL_WITH_CONTEXT:'Ảnh lưu trữ có bối cảnh',
    PLACEHOLDER_NOT_FINAL:'Ảnh giữ chỗ — chưa hoàn thiện',
    PRESENTATION_ONLY:'Chỉ thay đổi trình bày',
    EVIDENCE_SUPPORTING:'Hỗ trợ bằng chứng',
    EVIDENCE_AFFECTING:'Có ảnh hưởng đến bằng chứng',
    CLAIM_AFFECTING:'Có ảnh hưởng đến nhận định',
    HOLD_FOR_RESEARCH:'Chờ bổ sung nghiên cứu',
    LOCKED:'Đã khóa'
  };
  const gateLabels = {
    HOLD_FOR_RESEARCH:'Đang chờ xác minh tư liệu',
    RIGHTS_NOT_CLEARED:'Chưa xác nhận quyền sử dụng',
    PROVENANCE_NOT_COMPLETE:'Thông tin nguồn gốc chưa đầy đủ',
    PLACEHOLDER_NOT_FINAL:'Ảnh giữ chỗ chưa thể xuất bản',
    RECONSTRUCTION_LABEL_REQUIRED:'Ảnh phục dựng cần ghi rõ tính giả định',
    SCHEMATIC_LABEL_REQUIRED:'Sơ đồ cần ghi rõ giới hạn tỷ lệ',
    EDITORIAL_GRAPHIC_LABEL_REQUIRED:'Đồ họa cần ghi rõ tính chất minh họa',
    ARCHIVAL_SOURCE_CONTEXT_REQUIRED:'Ảnh tư liệu cần nguồn và bối cảnh',
    ALT_REQUIRED:'Chưa có mô tả ảnh cho accessibility',
    ALT_DUPLICATES_CAPTION:'Mô tả ảnh trùng caption',
    CHANGE_REASON_REQUIRED:'Cần ghi lý do thay ảnh',
    BINARY_RESELECT_OR_CONTROLLED_UPLOAD_REQUIRED:'Cần chọn lại file ảnh để hoàn tất bàn giao'
  };
  const humanGate = code => gateLabels[code] || 'Cần kiểm tra bổ sung trong chi tiết kỹ thuật';
  const readiness = (rec,hold) => hold ? 'Draft · Hold · Chờ xác minh' :
    rec.gate_reasons.length ? 'Draft · Not Final · Chưa đủ điều kiện' : 'Draft · Ready for Review · Chờ duyệt';
  const rightsLabel = value => value==='CLEARED'?'Đã xác nhận':
    value==='RESTRICTED'?'Bị hạn chế':'Chưa kiểm tra';
  const provenanceLabel = value => value==='COMPLETE'?'Đầy đủ':
    value==='PARTIAL'?'Một phần':'Thiếu';
  const addLine = (parent,cls,label,value) => {
    const p=document.createElement('p');
    p.className=cls;
    const strong=document.createElement('strong');
    strong.textContent=label+': ';
    p.append(strong,document.createTextNode(value));
    parent.append(p);
    return p;
  };
  const addTechnical = (parent,rec,slot) => {
    const details=document.createElement('details');
    details.className='ec-asset-advanced';
    const summary=document.createElement('summary');
    summary.textContent='CHI TIẾT KỸ THUẬT';
    details.append(summary);
    const m=rec.new;
    const technical=[
      ['asset_id',m.asset_id],['file_name',m.file_name],
      ['slot_id',slot.id],['version',m.version],
      ['asset_type',m.asset_type],['representation_status',m.representation_status],
      ['rights_status',m.rights_status],['provenance_status',m.provenance_status],
      ['evidence_impact',m.evidence_impact],['gate_codes',rec.gate_reasons],
      ['QC_flags',rec.impactQc],['upload_manifest',rec.upload_manifest],
      ['review_status',rec.review_status],['publish_eligible',rec.publish_eligible]
    ];
    const pre=document.createElement('pre');
    pre.className='ec-asset-technical-data';
    pre.textContent=JSON.stringify(Object.fromEntries(technical),null,2);
    details.append(pre);
    parent.append(details);
  };
  const render = s => {
    const rec=s.record;
    const display=s.preview;
    display.replaceChildren();
    if (!rec) {display.hidden=true;s.target.classList.remove('ec-has-asset-change');return;}
    display.hidden=false;
    s.target.classList.add('ec-has-asset-change');
    const m=rec.new;
    // Image first; never put internal status, asset ID or file hash above the caption.
    if (m.removed) {
      const p=document.createElement('p');p.className='ec-asset-empty';
      p.textContent='Ảnh đã được gỡ trong bản nháp. Ảnh gốc vẫn được giữ trong Git.';
      display.append(p);
      // Preserve a stable testable state marker, not a raw metadata block.
      p.dataset.assetState='REMOVED IN DRAFT';
    } else if (s.url) {
      const img=document.createElement('img');
      img.src=s.url;img.alt=m.decorative?'':m.alt_text;
      img.decoding='async';img.className='ec-preview-image';
      display.append(img);
    } else if (rec.binaryRequired) {
      const p=document.createElement('p');p.className='ec-asset-empty';
      p.textContent='Chưa có binary sau khi tải lại. Vui lòng chọn lại ảnh để xem trước và bàn giao.';
      display.append(p);
    } else {
      const p=document.createElement('p');p.className='ec-asset-empty';
      p.textContent='Đã cập nhật thông tin ảnh; chưa thay file ảnh.';
      display.append(p);
    }
    const summary=document.createElement('div');
    summary.className='ec-asset-editorial-summary';
    addLine(summary,'ec-asset-caption','Chú thích ảnh',m.caption||'Chưa có');
    addLine(summary,'ec-asset-credit','Nguồn / Tác giả',m.credit||'Chưa có');
    const status=document.createElement('div');
    status.className='ec-asset-status';
    status.textContent=readiness(rec,s.hold);
    summary.append(status);
    if (rec.gate_reasons.length) {
      const warning=document.createElement('div');
      warning.className='ec-asset-warning';
      warning.setAttribute('role','status');
      const title=document.createElement('strong');
      title.textContent='Ảnh này chưa đủ điều kiện xuất bản';
      warning.append(title);
      const list=document.createElement('ul');
      [...new Set(rec.gate_reasons.map(humanGate))].forEach(reason=>{
        const li=document.createElement('li');li.textContent=reason;list.append(li);
      });
      warning.append(list);
      summary.append(warning);
    }
    const compact=document.createElement('div');
    compact.className='ec-asset-compact';
    addLine(compact,'ec-asset-meta','Loại hình ảnh',typeLabels[m.asset_type]||'Loại ảnh cần kiểm tra');
    addLine(compact,'ec-asset-meta','Mô tả ảnh',m.decorative?'Ảnh trang trí':m.alt_text.trim()?'Đã có':'Chưa có');
    addLine(compact,'ec-asset-meta','Quyền sử dụng',rightsLabel(m.rights_status));
    addLine(compact,'ec-asset-meta','Nguồn gốc tư liệu',provenanceLabel(m.provenance_status));
    summary.append(compact);
    addTechnical(summary,rec,s);
    display.append(summary);
  };
  const refresh = () => {
    const btn=toolbar.querySelector('[data-ec-action="asset"]');
    if(btn)btn.textContent='CHỈNH ẢNH ('+changed().length+')';
    if (typeof window.__editorialRefresh === 'function') window.__editorialRefresh();
  };
  const optionHtml = (values,selected) => values.map(v=>'<option value="'+esc(v)+'"'+(v===selected?' selected':'')+'>'+esc(valueLabels[v]||'Cần kiểm tra')+'</option>').join('');
  const open = slot => {
    if (!slot) return;
    active=slot;
    const m=slot.record?.new || slot.baseline;
    const title=panel.querySelector('#ec-panel-title');
    title.textContent=slot.hotspotNumber?'CHỈNH ẢNH — ĐIỂM TƯƠNG TÁC '+Number(slot.hotspotNumber):'CHỈNH SỬA ẢNH · '+(slot.hold?'Chờ xác minh':'Bản nháp');
    const body=panel.querySelector('#ec-panel-body');
    body.innerHTML=(slot.hotspotNumber?'<p class="ec-asset-section">Mục: <strong>B01 — Dấu tích còn lại</strong></p>':'')+'<p class="ec-warning">'+(slot.hold?'Đang chờ xác minh tư liệu — chỉ được đề xuất và xem trước, chưa thể xuất bản.':'Bản nháp ảnh — không tự cập nhật Git hoặc xuất bản.')+'</p>'+
      '<details class="ec-asset-advanced ec-asset-panel-advanced"><summary>CHI TIẾT KỸ THUẬT</summary><pre class="ec-asset-technical-data">'+esc(JSON.stringify({slot_id:slot.id,asset_id:m.asset_id,baseline_asset_id:slot.baseline.asset_id,file_name:m.file_name,version:m.version,rights_status:m.rights_status,provenance_status:m.provenance_status,representation_status:m.representation_status,evidence_impact:m.evidence_impact,gate_codes:slot.record?.gate_reasons||[],upload_manifest:slot.record?.upload_manifest||null,review_status:slot.record?.review_status||'BASELINE'},null,2))+'</pre></details>'+
      '<div class="ec-asset-input-actions"><label>TẢI LÊN / THAY ẢNH<input id="ec-asset-file" type="file" accept="image/jpeg,image/png,image/webp,image/avif"></label><button type="button" id="ec-asset-remove">GỠ ẢNH</button><button type="button" id="ec-asset-restore">KHÔI PHỤC ẢNH GỐC</button></div>'+
      '<label>Loại hình ảnh<select id="ec-asset-type">'+optionHtml(types,m.asset_type)+'</select></label>'+
      '<label>Chú thích ảnh<textarea id="ec-asset-caption" rows="3">'+esc(m.caption)+'</textarea></label>'+
      '<label>Nguồn / Tác giả<input id="ec-asset-credit" value="'+esc(m.credit)+'"></label>'+
      '<label>Mô tả ảnh cho người dùng khiếm thị<input id="ec-asset-alt" value="'+esc(m.alt_text)+'"></label>'+
      '<label><input id="ec-asset-decorative" type="checkbox"'+(m.decorative?' checked':'')+'> Ảnh trang trí (không cần mô tả nội dung)</label>'+
      '<label>Nguồn tư liệu / Bối cảnh<input id="ec-asset-source" value="'+esc(m.source)+'"></label>'+
      '<label>Quyền sử dụng<select id="ec-asset-rights">'+optionHtml(rights,m.rights_status)+'</select></label>'+
      '<label>Nguồn gốc tư liệu<select id="ec-asset-provenance">'+optionHtml(provenances,m.provenance_status)+'</select></label>'+
      '<label>Nhãn hiển thị<select id="ec-asset-representation">'+optionHtml(representations,m.representation_status)+'</select></label>'+
      '<label>Mức ảnh hưởng đến bằng chứng<select id="ec-asset-impact">'+optionHtml(impacts,m.evidence_impact)+'</select></label>'+
      '<label>Lý do thay đổi<textarea id="ec-asset-reason" rows="2">'+esc(m.change_reason)+'</textarea></label>'+
      '<div id="ec-asset-file-status" role="status" aria-live="polite">Ảnh hiện tại: '+(m.file_name?'Đã có file':'Chưa có file')+'</div>'+
      '<p class="ec-small">Mã nguồn tư liệu, mức bằng chứng và trạng thái phê duyệt không được thay đổi tại đây.</p>'+
      '<div class="ec-asset-input-actions"><button type="button" id="ec-asset-save">LƯU BẢN NHÁP ẢNH</button><button type="button" id="ec-asset-cancel">HỦY</button></div>';
    panel.hidden=false;
    const q=id=>panel.querySelector('#'+id);
    let candidateFile=null,candidateUrl=null,removed=!!m.removed;
    q('ec-asset-file').addEventListener('change',ev=>{
      const file=ev.target.files[0];if(!file)return;
      if(!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type)||file.size>15*1024*1024){
        q('ec-asset-file-status').textContent='Từ chối file. Chỉ JPEG, PNG, WebP, AVIF; tối đa 15 MB.';
        ev.target.value='';return;
      }
      candidateFile=file;candidateUrl=URL.createObjectURL(file);removed=false;
      q('ec-asset-file-status').textContent='Đã chọn ảnh bản nháp ('+Math.round(file.size/1024)+' KB).';
    });
    q('ec-asset-remove').addEventListener('click',()=>{removed=true;candidateFile=null;candidateUrl=null;q('ec-asset-file-status').textContent='Đã gỡ ảnh trong bản nháp';});
    q('ec-asset-restore').addEventListener('click',()=>{
      undo.push(snapshot());window.__editorialLastEdit='asset';restoreSnapshot(undo[undo.length-1].map(x=>x.id===slot.id?{...x,record:null,file:null,url:null}:x));
      panel.hidden=true;active=null;notify('Đã khôi phục ảnh gốc trong bản nháp'+(slot.hotspotNumber?' tại điểm tương tác '+Number(slot.hotspotNumber):'')+'.');
    });
    q('ec-asset-cancel').addEventListener('click',()=>{panel.hidden=true;active=null;});
    q('ec-asset-save').addEventListener('click',()=>{
      const newMeta={...m,asset_type:q('ec-asset-type').value,caption:q('ec-asset-caption').value.trim(),
        credit:q('ec-asset-credit').value.trim(),alt_text:q('ec-asset-alt').value.trim(),
        decorative:q('ec-asset-decorative').checked,source:q('ec-asset-source').value.trim(),
        rights_status:q('ec-asset-rights').value,provenance_status:q('ec-asset-provenance').value,
        representation_status:q('ec-asset-representation').value,evidence_impact:q('ec-asset-impact').value,
        change_reason:q('ec-asset-reason').value.trim(),removed};
      const nextFile=removed?null:(candidateFile||slot.file);
      const nextUrl=removed?null:(candidateUrl||slot.url);
      const comparable={...newMeta};
      if (!comparable.removed) delete comparable.removed;
      const same=JSON.stringify({...comparable,asset_id:slot.baseline.asset_id,file_name:slot.baseline.file_name,editorial_status:'BASELINE',version:0})===JSON.stringify(slot.baseline);
      if(same&&!nextFile) {undo.push(snapshot());slot.record=null;slot.file=null;slot.url=null;}
      else {
        undo.push(snapshot());
        slot.record=makeRecord(slot,newMeta,nextFile,nextUrl);
        window.__editorialLastEdit = 'asset';
        slot.file=nextFile;slot.url=nextUrl;
      }
      render(slot);refresh();panel.hidden=true;active=null;
      notify(slot.record ? 'Đã lưu bản nháp ảnh. '+(slot.record.gate_reasons.length?'Ảnh chưa đủ điều kiện xuất bản.':'Đang chờ duyệt.') : 'Đã khôi phục ảnh gốc.');
    });
    q('ec-asset-file').focus();
  };
  document.addEventListener('keydown', event => {
    if (panel.hidden || !panel.querySelector('#ec-asset-file')) return;
    if (event.key==='Escape') {event.preventDefault();panel.hidden=true;active=null;return;}
    if (event.key!=='Tab') return;
    const focusable=Array.from(panel.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled])'));
    if (!focusable.length) return;
    if (event.shiftKey && document.activeElement===focusable[0]) {event.preventDefault();focusable[focusable.length-1].focus();}
    else if (!event.shiftKey && document.activeElement===focusable[focusable.length-1]) {event.preventDefault();focusable[0].focus();}
  });
  const button=document.createElement('button');
  button.type='button';button.dataset.ecAction='asset';button.textContent='EDIT ASSET';
  button.addEventListener('click',()=>open(slots.get(active?.id)||slots.get('HERO_IMAGE')));
  toolbar.querySelector('.ec-actions').insertBefore(button,toolbar.querySelector('[data-ec-action="exit"]'));
  const exportRecords = () => changed().map(rec => ({
    ...rec, binaryAvailableInSession:!!slots.get(rec.slot_id).file,
    gate_reasons:gate(rec.new,rec.evidence_sensitive,!!slots.get(rec.slot_id).file || !rec.binaryRequired),
    publish_eligible:false,review_approved:false
  }));
  const saveDraft = () => {
    const payload={schema:'interactive-editorial-asset-draft/v0.1',branch,savedAt:now(),
      changes:exportRecords().map(rec=>({...rec,binaryAvailableInSession:false,
        upload_manifest:rec.binaryRequired?{...rec.upload_manifest,upload_status:'RESELECT_REQUIRED'}:null}))};
    try{localStorage.setItem(storageKey,JSON.stringify(payload));lastSaved=fingerprint();notify('Đã lưu metadata asset; file binary chỉ ở phiên hiện tại, cần controlled upload.');return true;}
    catch(err){notify('Không thể lưu metadata asset vào localStorage; hãy EXPORT CHANGES.');return false;}
  };
  const restoreAll = () => {
    undo.push(snapshot());slots.forEach(s=>{s.record=null;s.file=null;s.url=null;render(s);});
    try{localStorage.removeItem(storageKey);}catch(err){}
    lastSaved=fingerprint();refresh();
  };
  const undoLast = () => {if(!undo.length)return false;restoreSnapshot(undo.pop());return true;};
  const compareHtml = () => exportRecords().map(r=>'<article class="ec-diff"><h3>ASSET · '+esc(r.slot_id)+'</h3>'+
    '<p>'+esc(r.type)+' · '+esc(r.change_timestamp)+' · '+esc(r.review_status)+'</p>'+
    '<div class="ec-before"><strong>BEFORE</strong><p>'+esc(JSON.stringify(r.old,null,2))+'</p></div>'+
    '<div class="ec-after"><strong>AFTER</strong><p>'+esc(JSON.stringify(r.new,null,2))+'</p></div>'+
    '<p class="ec-warning">'+esc(r.gate_reasons.join(' · ')||'PENDING_REVIEW')+'</p>'+
    '<p class="ec-small">QC: '+esc(r.impactQc.join(' · '))+'</p></article>').join('');
  try {
    const raw=localStorage.getItem(storageKey);
    if(raw){
      const payload=JSON.parse(raw);
      if(payload.schema==='interactive-editorial-asset-draft/v0.1'&&payload.branch===branch){
        (payload.changes||[]).forEach(rec=>{
          const slot=slots.get(rec.slot_id);if(!slot||rec.old_asset_id!==slot.baseline.asset_id)return;
          slot.record={...rec,binaryAvailableInSession:false,publish_eligible:false,
            gate_reasons:gate(rec.new,slot.hold,!rec.binaryRequired)};
          slot.file=null;slot.url=null;render(slot);
        });
        lastSaved=fingerprint();
      } else stale=true;
    }
  }catch(err){stale=true;}
  if(stale)notify('Asset draft cũ không tương thích, không tự áp dụng.');
  refresh();
  window.__editorialAssets={
    getChanges:exportRecords,hasChanges:()=>changed().length>0,canUndo:()=>undo.length>0,
    isDirty:()=>fingerprint()!==lastSaved,
    saveDraft,restoreAll,undo:undoLast,compareHtml,
    slots:Array.from(slots.keys())
  };
  if (typeof window.__editorialRefresh === 'function') window.__editorialRefresh();
})();
