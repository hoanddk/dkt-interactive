/* Interactive Editorial Console v0.1 — branch-only browser draft tool.
   No GitHub credentials, API writes, or publishing capability. */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  if (params.get('edit') !== '1') return;
  const MODE_MAP = { live: 'LIVE_EDIT', controlled: 'CONTROLLED_EDIT', post_publish: 'POST_PUBLISH_EDITABLE' };
  const mode = MODE_MAP[params.get('editorial_mode')] || 'LIVE_EDIT';
  const productState = 'EDITORIAL_FINISHING';
  const sourceBranch = 'editorial/round-2a-v0.1.5';
  const sourcePath = 'index.html';
  const storageKey = 'dkt:editorial-console:v0.1:' + sourceBranch;
  const contentSelector = 'h1,h2,h3,p,figcaption,li,.badge,.status-badge,.placeholder-label,.plan-shape span,.representation-banner';
  const main = document.querySelector('main');
  if (!main) return;

  const time = () => new Date().toISOString();
  const hash = (str) => {
    let n = 2166136261;
    for (let i = 0; i < str.length; i++) {
      n ^= str.charCodeAt(i);
      n = Math.imul(n, 16777619);
    }
    return ('00000000' + (n >>> 0).toString(16)).slice(-8);
  };
  const textValue = (el) => (el.textContent || '').trim();
  const safe = (value) => String(value || '').replace(/[&<>"']/g, (ch) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const sectionOf = (el) => el.closest('section');
  const selectorFor = (el, section) => {
    const parts = [];
    let node = el;
    while (node && node !== section) {
      const tag = node.tagName.toLowerCase();
      const siblings = Array.from(node.parentElement.children).filter((x) => x.tagName === node.tagName);
      parts.unshift(tag + ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')');
      node = node.parentElement;
    }
    return '#' + section.id + ' > ' + parts.join(' > ');
  };
  const policyFor = (el, section) => {
    const id = section.id;
    if (id === 'evidence-tower') return 'LOCKED';
    if (id === 'models' || id === 'control-gates') return 'HOLD_FOR_RESEARCH';
    if (el.matches('[data-editorial-hold]') || el.closest('[data-editorial-hold]')) return 'HOLD_FOR_RESEARCH';
    if (id === 'measure' && (el.closest('.plan-grid') || el.closest('.narrow p'))) return 'LOCKED';
    if (id === 'remains' && (el.closest('.label-row') || el.closest('.hotspot-stage'))) return 'LOCKED';
    if (id === 'preserve' && el.closest('.status-grid')) return 'LOCKED';
    if (el.closest('.tower-controls,.reasoning-chain,.gate-grid,.technical-fallback,.layer-stack')) return 'LOCKED';
    if (el.matches('.representation-banner,.badge,.status-badge')) return 'LOCKED';
    if (el.matches('li') && id === 'closure') return 'REVIEW_REQUIRED';
    return 'EDITABLE';
  };

  // Only leaf text nodes are editable in v0.1; inline markup and dynamic JS output remain intact.
  const fields = new Map();
  main.querySelectorAll(contentSelector).forEach((el) => {
    const section = sectionOf(el);
    if (!section || !section.id || !textValue(el)) return;
    const path = selectorFor(el, section);
    const id = section.id + ':' + hash(path);
    const rich = Array.from(el.children).length > 0;
    const policy = rich ? 'LOCKED' : policyFor(el, section);
    if (fields.has(id)) return;
    const field = { id, path, section: section.dataset.block || section.dataset.screen || section.id,
      element: el.tagName.toLowerCase(), baseline: textValue(el), policy, node: el };
    fields.set(id, field);
    el.dataset.editorialField = id;
    el.dataset.editorialPolicy = policy;
    if (policy !== 'LOCKED') {
      el.tabIndex = 0;
      el.setAttribute('aria-label', (policy === 'HOLD_FOR_RESEARCH' ? 'Đề xuất câu chữ, đang giữ chờ nghiên cứu: ' : 'Chỉnh sửa: ') + field.baseline.slice(0, 100));
    } else {
      el.title = 'LOCKED — không cho thay đổi logic, cấu trúc hoặc dữ liệu bằng editor v0.1';
    }
  });
  const baselineId = hash(Array.from(fields.values()).map((f) => f.id + '|' + f.baseline + '|' + f.policy).join('\n'));
  const revisions = new Map();
  const undoStack = [];
  let savedFingerprint = '';
  let active = null;
  let panelOpen = false;
  let noticeTimer = null;
  let lastFocused = null;
  let storageEnabled = true;

  const bar = document.createElement('aside');
  bar.id = 'editor-console';
  bar.setAttribute('aria-label', 'Interactive Editorial Console');
  bar.innerHTML = '<div class="ec-heading"><strong>EDITORIAL CONSOLE v0.1</strong><span id="ec-count">0 changes</span></div>' +
    '<div class="ec-state">' + safe(productState) + ' · ' + safe(mode) + ' · local preview, chưa xác thực phân quyền</div>' +
    '<div class="ec-actions"><button type="button" data-ec-action="save">SAVE DRAFT</button>' +
    '<button type="button" data-ec-action="undo">UNDO</button>' +
    '<button type="button" data-ec-action="restore">RESTORE BASELINE</button>' +
    '<button type="button" data-ec-action="compare">COMPARE</button>' +
    '<button type="button" data-ec-action="export">EXPORT CHANGES</button>' +
    '<button type="button" data-ec-action="exit">EXIT EDIT MODE</button></div>' +
    '<div id="ec-notice" role="status" aria-live="polite">Nhấp vào chữ được đánh dấu để sửa; vùng HOLD chỉ nhận đề xuất.</div>';
  document.body.prepend(bar);

  const panel = document.createElement('section');
  panel.id = 'editor-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'Bảng chỉnh sửa và so sánh');
  panel.innerHTML = '<div class="ec-panel-head"><h2 id="ec-panel-title">Editorial changes</h2><button type="button" id="ec-close" aria-label="Đóng bảng">×</button></div><div id="ec-panel-body"></div>';
  document.body.append(panel);
  const panelBody = panel.querySelector('#ec-panel-body');
  const notice = bar.querySelector('#ec-notice');
  const count = bar.querySelector('#ec-count');

  const recordList = () => Array.from(revisions.values()).sort((a, b) => a.fieldId.localeCompare(b.fieldId));
  const fingerprint = () => JSON.stringify(recordList());
  const showNotice = (message) => {
    notice.textContent = message;
    if (noticeTimer) clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { notice.textContent = 'Bản nháp local, không tự commit hoặc publish.'; }, 6500);
  };
  const getQC = (kind) => {
    if (kind === 'COPY_ONLY') return ['EDITORIAL_DIFF'];
    if (kind === 'PRESENTATION') return ['PRESENTATION_QC'];
    if (kind === 'ASSET_CHANGE') return ['ASSET_RIGHTS_QC', 'VISUAL_QC'];
    if (kind === 'EVIDENCE_AFFECTING' || kind === 'CLAIM_CHANGE') return ['SOURCE_VERIFICATION', 'EVIDENCE_QC'];
    if (kind === 'CORRECTION') return ['SOURCE_VERIFICATION', 'CORRECTION_REVIEW', 'PUBLIC_UPDATE_LOG'];
    return ['EDITORIAL_REVIEW'];
  };
  const defaultKind = (field) => field.policy === 'HOLD_FOR_RESEARCH' || field.policy === 'REVIEW_REQUIRED' ? 'EVIDENCE_AFFECTING' : 'COPY_ONLY';
  const qcFor = (kind, policy) => Array.from(new Set(getQC(kind).concat(policy === 'HOLD_FOR_RESEARCH' || policy === 'REVIEW_REQUIRED' ? ['SOURCE_VERIFICATION', 'EVIDENCE_QC'] : [])));
  const makeRecord = (field, proposed, prior) => {
    const classification = prior ? prior.classification : defaultKind(field);
    const reviewStatus = field.policy === 'HOLD_FOR_RESEARCH' ? 'HOLD_FOR_RESEARCH' :
      (mode === 'LIVE_EDIT' ? 'DRAFT' : 'PENDING_REVIEW');
    return { fieldId: field.id, selector: field.path, section: field.section, element: field.element,
      before: field.baseline, after: proposed, classification, reviewStatus,
      impactQc: qcFor(classification, field.policy), timestamp: time(), editorialMode: mode,
      evidencePolicy: field.policy, reason: prior ? prior.reason || '' : '',
      previewOnly: field.policy === 'HOLD_FOR_RESEARCH' };
  };
  const applyRecord = (field, rec) => {
    field.node.textContent = rec && !rec.previewOnly ? rec.after : field.baseline;
    field.node.classList.toggle('ec-changed', !!rec);
    field.node.classList.toggle('ec-proposal', !!(rec && rec.previewOnly));
  };
  const refresh = () => {
    for (const field of fields.values()) applyRecord(field, revisions.get(field.id));
    count.textContent = revisions.size + ' changes' + (fingerprint() === savedFingerprint ? ' · saved' : ' · unsaved');
    bar.querySelector('[data-ec-action="undo"]').disabled = undoStack.length === 0;
    bar.querySelector('[data-ec-action="export"]').disabled = revisions.size === 0;
  };
  const pushUndo = () => {
    undoStack.push(recordList().map((r) => ({...r})));
    if (undoStack.length > 60) undoStack.shift();
  };
  const setRevision = (field, proposed) => {
    if (!field || field.policy === 'LOCKED') return;
    const cleaned = String(proposed).replace(/\r/g, '').trim();
    if (cleaned === (revisions.get(field.id)?.after || field.baseline)) return;
    if (cleaned.length > 10000) { showNotice('Tối đa 10.000 ký tự mỗi trường.'); return; }
    pushUndo();
    if (!cleaned || cleaned === field.baseline) revisions.delete(field.id);
    else revisions.set(field.id, makeRecord(field, cleaned, revisions.get(field.id)));
    refresh();
  };
  const closePanel = () => {
    panel.hidden = true;
    panelOpen = false;
    if (lastFocused && document.contains(lastFocused)) lastFocused.focus();
  };
  const openPanel = (title, html) => {
    lastFocused = document.activeElement;
    panel.querySelector('#ec-panel-title').textContent = title;
    panelBody.innerHTML = html;
    panel.hidden = false;
    panelOpen = true;
    panel.querySelector('#ec-close').focus();
  };
  const openProposal = (field) => {
    const current = revisions.get(field.id);
    const label = field.policy === 'HOLD_FOR_RESEARCH' ? 'EVIDENCE-SENSITIVE / HOLD_FOR_RESEARCH — chỉ lưu đề xuất, không đổi nội dung trang.' :
      'REVIEW_REQUIRED — thay đổi phải qua evidence QC.';
    openPanel('Đề xuất · ' + field.section, '<p class="ec-warning">' + safe(label) + '</p>' +
      '<p class="ec-small">Nguồn đang hiển thị:</p><blockquote>' + safe(field.baseline) + '</blockquote>' +
      '<label for="ec-proposed">Đề xuất wording</label><textarea id="ec-proposed" rows="5"></textarea>' +
      '<button type="button" id="ec-propose-save">Lưu đề xuất vào change set</button>');
    const area = panel.querySelector('#ec-proposed');
    area.value = current ? current.after : field.baseline;
    panel.querySelector('#ec-propose-save').addEventListener('click', () => {
      setRevision(field, area.value);
      closePanel();
      showNotice('Đã cập nhật đề xuất. Chưa xác minh hoặc phê duyệt claim.');
    });
    area.focus();
  };
  const stopEdit = (commit = true) => {
    if (!active) return;
    const { field, old } = active;
    const next = field.node.textContent;
    field.node.removeAttribute('contenteditable');
    field.node.classList.remove('ec-active');
    active = null;
    field.node.textContent = old;
    if (commit) setRevision(field, next);
    else refresh();
  };
  const beginEdit = (field) => {
    if (active && active.field === field) return;
    if (active) stopEdit(true);
    if (field.policy === 'LOCKED') { showNotice('LOCKED — không được sửa bằng Console v0.1.'); return; }
    if (field.policy === 'HOLD_FOR_RESEARCH' || field.policy === 'REVIEW_REQUIRED') { openProposal(field); return; }
    active = { field, old: field.node.textContent };
    field.node.setAttribute('contenteditable', 'plaintext-only');
    field.node.classList.add('ec-active');
    field.node.focus();
    showNotice('Đang sửa ' + field.section + '. Enter để lưu; Esc để hủy.');
  };
  main.addEventListener('click', (event) => {
    const el = event.target.closest('[data-editorial-field]');
    if (!el || !main.contains(el)) return;
    const field = fields.get(el.dataset.editorialField);
    if (!field) return;
    if (field.policy === 'LOCKED') { showNotice('LOCKED · ' + field.section); return; }
    if (!active || active.field !== field) { event.preventDefault(); beginEdit(field); }
  });
  main.addEventListener('keydown', (event) => {
    const el = event.target.closest('[data-editorial-field]');
    if (!el) return;
    const field = fields.get(el.dataset.editorialField);
    if (!field || field.policy === 'LOCKED') return;
    if (active && active.field === field) {
      if (event.key === 'Escape') { event.preventDefault(); stopEdit(false); }
      else if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); stopEdit(true); }
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); beginEdit(field);
    }
  });
  main.addEventListener('focusout', (event) => {
    if (active && event.target === active.field.node) stopEdit(true);
  });

  const saveDraft = () => {
    if (active) stopEdit(true);
    const payload = { schema: 'interactive-editorial-draft/v0.1', sourceBranch, sourcePath,
      baselineId, savedAt: time(), editorialMode: mode, changes: recordList() };
    try {
      localStorage.setItem(storageKey, JSON.stringify(payload));
      savedFingerprint = fingerprint();
      refresh();
      showNotice('Đã lưu bản nháp trên trình duyệt này. Git vẫn là source of truth.');
    } catch (error) {
      storageEnabled = false;
      showNotice('Không thể lưu localStorage. Hãy dùng EXPORT CHANGES để giữ bản nháp.');
    }
  };
  const restore = () => {
    if (active) stopEdit(true);
    if (!window.confirm('Khôi phục baseline của nhánh review? Các thay đổi chưa export có thể mất.')) return;
    pushUndo();
    revisions.clear();
    try { localStorage.removeItem(storageKey); } catch (error) { /* local storage unavailable */ }
    savedFingerprint = fingerprint();
    refresh();
    showNotice('Đã khôi phục baseline trong trình duyệt; không thay đổi Git.');
  };
  const undo = () => {
    if (active) stopEdit(true);
    if (!undoStack.length) return;
    const snapshot = undoStack.pop();
    revisions.clear();
    snapshot.forEach((r) => revisions.set(r.fieldId, r));
    refresh();
    showNotice('Đã hoàn tác thao tác gần nhất.');
  };
  const updateMetadata = (fieldId, key, value) => {
    const rec = revisions.get(fieldId);
    if (!rec) return;
    pushUndo();
    rec[key] = value;
    rec.timestamp = time();
    if (key === 'classification') rec.impactQc = qcFor(value, rec.evidencePolicy);
    refresh();
    showCompare();
  };
  const kinds = ['COPY_ONLY', 'PRESENTATION', 'ASSET_CHANGE', 'EVIDENCE_AFFECTING', 'CLAIM_CHANGE', 'CORRECTION'];
  const showCompare = () => {
    if (active) stopEdit(true);
    const rows = recordList().map((rec) => {
      const options = kinds.map((k) => '<option value="' + k + '"' + (k === rec.classification ? ' selected' : '') + '>' + k + '</option>').join('');
      return '<article class="ec-diff"><h3>' + safe(rec.section) + ' · ' + safe(rec.element) + '</h3>' +
        '<p class="ec-small">' + safe(rec.fieldId) + ' · ' + safe(rec.timestamp) + ' · ' + safe(rec.reviewStatus) + '</p>' +
        '<div class="ec-before"><strong>BEFORE</strong><p>' + safe(rec.before) + '</p></div>' +
        '<div class="ec-after"><strong>AFTER / PROPOSAL</strong><p>' + safe(rec.after) + '</p></div>' +
        '<label>Classification <select data-ec-kind="' + safe(rec.fieldId) + '">' + options + '</select></label>' +
        '<label>Reason / correction note <input data-ec-reason="' + safe(rec.fieldId) + '" value="' + safe(rec.reason) + '" placeholder="Ghi chú cho reviewer"></label>' +
        '<p class="ec-small">QC: ' + safe(rec.impactQc.join(', ')) + (rec.previewOnly ? ' · HOLD_FOR_RESEARCH · không preview lên trang' : '') + '</p></article>';
    }).join('');
    openPanel('COMPARE · ' + revisions.size + ' changes', rows || '<p>Chưa có thay đổi so với baseline.</p>');
    panel.querySelectorAll('[data-ec-kind]').forEach((sel) => sel.addEventListener('change', () => updateMetadata(sel.dataset.ecKind, 'classification', sel.value)));
    panel.querySelectorAll('[data-ec-reason]').forEach((inp) => inp.addEventListener('change', () => updateMetadata(inp.dataset.ecReason, 'reason', inp.value)));
  };
  const exportChanges = () => {
    if (active) stopEdit(true);
    if (!revisions.size) return;
    const changes = recordList();
    const post = mode === 'POST_PUBLISH_EDITABLE';
    if (post && changes.some((r) => !r.reason.trim())) {
      showNotice('POST_PUBLISH_UPDATE yêu cầu ghi reason cho từng thay đổi trong COMPARE.');
      showCompare();
      return;
    }
    const payload = {
      schema: 'interactive-editorial-changeset/v0.1',
      consoleVersion: '0.1', exportedAt: time(), productState, editorialAccessState: mode,
      source: { repository: 'hoanddk/dkt-interactive', branch: sourceBranch, path: sourcePath,
        baselineId, contentAuthority: 'GIT_REPOSITORY', commitSha: null },
      changeSetStatus: 'PENDING_GIT_REVIEW',
      postPublishUpdate: post ? { type: 'POST_PUBLISH_UPDATE', status: 'PENDING_REVIEW', publishedVersion: null } : null,
      changes,
      review: { approved: false, mergeAllowed: false, publishAllowed: false,
        holdCount: changes.filter((r) => r.previewOnly).length,
        qcGates: Array.from(new Set(changes.flatMap((r) => r.impactQc))) }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dkt-editorial-changes-' + time().slice(0, 19).replace(/[:T]/g, '-') + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    showNotice('Đã xuất change set JSON. Không có commit hoặc publish tự động.');
  };
  const exitMode = () => {
    if (active) stopEdit(true);
    if (fingerprint() !== savedFingerprint && !window.confirm('Có thay đổi chưa SAVE DRAFT. Thoát Edit Mode?')) return;
    const url = new URL(location.href);
    url.searchParams.delete('edit');
    url.searchParams.delete('editorial_mode');
    location.assign(url.toString());
  };
  bar.addEventListener('click', (event) => {
    const button = event.target.closest('[data-ec-action]');
    if (!button) return;
    const action = button.dataset.ecAction;
    if (action === 'save') saveDraft();
    else if (action === 'undo') undo();
    else if (action === 'restore') restore();
    else if (action === 'compare') showCompare();
    else if (action === 'export') exportChanges();
    else if (action === 'exit') exitMode();
  });
  panel.querySelector('#ec-close').addEventListener('click', closePanel);
  document.addEventListener('keydown', (event) => {
    if (!panelOpen) return;
    if (event.key === 'Escape') { event.preventDefault(); closePanel(); return; }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(panel.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'));
    if (!focusable.length) return;
    const first = focusable[0], last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  });
  window.addEventListener('beforeunload', (event) => {
    if (fingerprint() !== savedFingerprint) { event.preventDefault(); event.returnValue = ''; }
  });
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const draft = JSON.parse(raw);
      if (draft.schema !== 'interactive-editorial-draft/v0.1' || draft.baselineId !== baselineId) {
        showNotice('Baseline của nhánh đã thay đổi. Draft cũ không được tự áp dụng; hãy kiểm tra và xuất bản cũ nếu cần.');
      } else {
        (draft.changes || []).forEach((rec) => {
          const field = fields.get(rec.fieldId);
          if (!field || field.baseline !== rec.before || field.policy === 'LOCKED') return;
          const restored = makeRecord(field, rec.after, rec);
          restored.timestamp = rec.timestamp;
          restored.reason = rec.reason || '';
          revisions.set(field.id, restored);
        });
        savedFingerprint = fingerprint();
        if (revisions.size) showNotice('Đã nạp draft local. Các thay đổi vẫn chờ review.');
      }
    }
  } catch (error) {
    storageEnabled = false;
    showNotice('Local draft không khả dụng; có thể dùng EXPORT CHANGES.');
  }
  refresh();
  if (!storageEnabled) bar.dataset.storageUnavailable = 'true';
})();
