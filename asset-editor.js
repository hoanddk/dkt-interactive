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
    evidence_level: id==='B01_REMAINS_VISUAL'?'1 / 2':id==='B06_ROOF_VISUAL'?'4':null,
    evidence_impact:impact,editorial_status:'BASELINE',change_reason:'',version:0,
    source_id:null,provenance_id:null
  });
  mapping.forEach(([id,sectionId,selector,type,repr,impact,hold]) => {
    const section = document.getElementById(sectionId);
    if (!section) return;
    let target = selector ? section.querySelector(selector) : null;
    let virtual = false;
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
    if (id === 'B03_PLAN_VISUAL') baseline.caption = 'Sơ đồ đơn giản hóa các phạm vi đo; không thay bản vẽ khảo cổ.';
    const originalImg = target.querySelector('img[src]');
    if (originalImg) {
      baseline.file_name = originalImg.getAttribute('src');
      baseline.asset_id = 'BASELINE_'+id;
      baseline.alt_text = originalImg.alt || '';
    }
    const slot = {id,sectionId,target,virtual,hold,baseline,record:null,file:null,url:null,preview:null,captionEl:null,ctrl:null,originalImg};
    slots.set(id,slot);
    target.dataset.editorialSlot = id;
    target.classList.add('ec-asset-host');
    const ctrl = document.createElement('button');
    ctrl.type = 'button';
    ctrl.className = 'ec-asset-control';
    ctrl.textContent = 'EDIT ASSET · '+id+(hold?' · HOLD_FOR_RESEARCH':'');
    ctrl.setAttribute('aria-label','Edit visual asset '+id+(hold?' evidence-sensitive':''));
    ctrl.addEventListener('click', e => {e.preventDefault();e.stopPropagation();open(slot);});
    slot.ctrl = ctrl;
    target.append(ctrl);
    const display = document.createElement('div');
    display.className = 'ec-asset-display';
    display.hidden = true;
    slot.preview = display;
    target.append(display);
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
  const render = s => {
    const rec=s.record;
    const display=s.preview;
    display.replaceChildren();
    if (!rec) {display.hidden=true;s.target.classList.remove('ec-has-asset-change');return;}
    display.hidden=false;
    s.target.classList.add('ec-has-asset-change');
    const m=rec.new;
    const label=document.createElement('div');
    label.className='ec-asset-status';
    label.textContent='DRAFT · '+s.id+' · '+(s.hold?'EVIDENCE-SENSITIVE / HOLD_FOR_RESEARCH · ':'')+(rec.gate_reasons.length?'NOT FINAL':'REVIEW PENDING');
    display.append(label);
    if (m.removed) {
      const p=document.createElement('p');p.textContent='REMOVED IN DRAFT — baseline vẫn nguyên trong Git.';display.append(p);
    } else if (s.url) {
      const img=document.createElement('img');
      img.src=s.url;img.alt=m.decorative?'':m.alt_text;
      img.decoding='async';img.className='ec-preview-image';
      display.append(img);
    } else if (rec.binaryRequired) {
      const p=document.createElement('p');p.textContent='Chưa có binary sau khi tải lại. Chọn lại ảnh để preview / controlled upload.';display.append(p);
    } else {
      const p=document.createElement('p');p.textContent='Đã cập nhật metadata của visual slot; chưa thay file ảnh.';display.append(p);
    }
    const details=document.createElement('p');
    details.className='ec-asset-meta';
    details.textContent=(m.file_name||'Không có file')+' · '+m.asset_type+' · '+m.representation_status+' · '+m.rights_status+' / '+m.provenance_status;
    display.append(details);
    for (const [labelText,value] of [['CAPTION',m.caption],['CREDIT',m.credit],['ALT',m.decorative?'DECORATIVE':m.alt_text]]) {
      const p=document.createElement('p');p.className='ec-asset-meta';p.textContent=labelText+': '+(value||'—');display.append(p);
    }
    if (rec.gate_reasons.length) {
      const p=document.createElement('p');p.className='ec-warning';p.textContent='GATES: '+rec.gate_reasons.join(' · ');display.append(p);
    }
  };
  const refresh = () => {
    const btn=toolbar.querySelector('[data-ec-action="asset"]');
    if(btn)btn.textContent='EDIT ASSET ('+changed().length+')';
    if (typeof window.__editorialRefresh === 'function') window.__editorialRefresh();
  };
  const optionHtml = (values,selected) => values.map(v=>'<option value="'+esc(v)+'"'+(v===selected?' selected':'')+'>'+esc(v)+'</option>').join('');
  const open = slot => {
    if (!slot) return;
    active=slot;
    const m=slot.record?.new || slot.baseline;
    const title=panel.querySelector('#ec-panel-title');
    title.textContent='EDIT ASSET · '+slot.id;
    const body=panel.querySelector('#ec-panel-body');
    body.innerHTML='<p class="ec-warning">'+(slot.hold?'EVIDENCE-SENSITIVE / HOLD_FOR_RESEARCH — preview/proposal only.':'Asset draft — không tự cập nhật Git hoặc publish.')+'</p>'+
      '<p class="ec-small">Stable slot ID: '+esc(slot.id)+' · Baseline: '+esc(slot.baseline.asset_id)+'</p>'+
      '<div class="ec-asset-input-actions"><label>UPLOAD / REPLACE IMAGE<input id="ec-asset-file" type="file" accept="image/jpeg,image/png,image/webp,image/avif"></label><button type="button" id="ec-asset-remove">REMOVE IMAGE</button><button type="button" id="ec-asset-restore">RESTORE BASELINE IMAGE</button></div>'+
      '<label>Asset type<select id="ec-asset-type">'+optionHtml(types,m.asset_type)+'</select></label>'+
      '<label>Caption<textarea id="ec-asset-caption" rows="3">'+esc(m.caption)+'</textarea></label>'+
      '<label>Credit<input id="ec-asset-credit" value="'+esc(m.credit)+'"></label>'+
      '<label>Alt text<input id="ec-asset-alt" value="'+esc(m.alt_text)+'"></label>'+
      '<label><input id="ec-asset-decorative" type="checkbox"'+(m.decorative?' checked':'')+'> Decorative (no informational alt)</label>'+
      '<label>Source / context<input id="ec-asset-source" value="'+esc(m.source)+'"></label>'+
      '<label>Rights<select id="ec-asset-rights">'+optionHtml(rights,m.rights_status)+'</select></label>'+
      '<label>Provenance<select id="ec-asset-provenance">'+optionHtml(provenances,m.provenance_status)+'</select></label>'+
      '<label>Representation label<select id="ec-asset-representation">'+optionHtml(representations,m.representation_status)+'</select></label>'+
      '<label>Evidence impact<select id="ec-asset-impact">'+optionHtml(impacts,m.evidence_impact)+'</select></label>'+
      '<label>Change reason<textarea id="ec-asset-reason" rows="2">'+esc(m.change_reason)+'</textarea></label>'+
      '<div id="ec-asset-file-status" role="status" aria-live="polite">File: '+esc(m.file_name||'chưa có')+'</div>'+
      '<p class="ec-small">Source IDs / provenance IDs, evidence level, approval/verification status không được thay qua editor.</p>'+
      '<div class="ec-asset-input-actions"><button type="button" id="ec-asset-save">SAVE ASSET DRAFT</button><button type="button" id="ec-asset-cancel">CANCEL</button></div>';
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
      q('ec-asset-file-status').textContent='DRAFT · '+file.name+' · '+file.type+' · '+file.size+' bytes';
    });
    q('ec-asset-remove').addEventListener('click',()=>{removed=true;candidateFile=null;candidateUrl=null;q('ec-asset-file-status').textContent='REMOVED IN DRAFT';});
    q('ec-asset-restore').addEventListener('click',()=>{
      undo.push(snapshot());window.__editorialLastEdit='asset';restoreSnapshot(undo[undo.length-1].map(x=>x.id===slot.id?{...x,record:null,file:null,url:null}:x));
      panel.hidden=true;active=null;notify('Đã restore baseline asset '+slot.id+' trong draft.');
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
      notify('Asset draft: '+slot.id+' · '+(slot.record?.gate_reasons.join(', ')||'baseline')+'. Không tự publish.');
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
