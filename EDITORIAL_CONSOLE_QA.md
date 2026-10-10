# Interactive Editorial Console v0.1.4 — QA & newsroom usability handoff

**Pilot:** Điện Kính Thiên  
**Branch:** `editorial/round-2a-v0.1.5`  
**Classification:** `PILOT_LOCAL FIX` / `TOOLKIT_CANDIDATE`  
**Acceptance after implementation:** `READY_FOR_EDITORIAL_USABILITY_QA_ROUND_2` — **not** final editorial-use approval.

Source of truth remains Git. The browser editor cannot merge, publish, authenticate users or write to GitHub.

## Open locally

1. Checkout `editorial/round-2a-v0.1.5`.
2. Serve the repository root over HTTP, e.g. `python3 -m http.server 8000`.
3. Reader view: `http://localhost:8000/`.
4. Edit mode: `http://localhost:8000/?edit=1`.
5. Saved-draft preview: use **XEM TRƯỚC** from the editor or open `/?preview=1` on the same origin/browser.

Query parameters are not authentication or approval state.

## Gate 1 — Runtime QA Harness

Automated Chromium QA must pass on:
- desktop 1440px;
- mobile 390px;
- mobile 375px.

Required automated coverage:

- [ ] Public mode has no Editorial Console controls.
- [ ] Primary toolbar is Vietnamese: LƯU NHÁP / HOÀN TÁC / LÀM LẠI / LỊCH SỬ / THÔNG TIN XUẤT BẢN / XEM TRƯỚC / THOÁT BIÊN TẬP.
- [ ] Restore/export live only under **CÔNG CỤ NÂNG CAO**.
- [ ] Inline visible copy can be edited directly.
- [ ] Save Draft survives reload.
- [ ] Undo and Redo work for text.
- [ ] `Ctrl/Cmd+Z` = Undo; `Shift+Ctrl/Cmd+Z` = Redo.
- [ ] LỊCH SỬ shows newsroom-readable TRƯỚC / SAU; raw objects stay collapsed in CHI TIẾT KỸ THUẬT.
- [ ] Export is a non-publishing JSON handoff with merge/publish false.
- [ ] Restore baseline remains undoable.
- [ ] Clean Exit does not create a false unsaved warning.
- [ ] B04 remains LOCKED and its interaction still works.
- [ ] B05 / B08 allow wording proposals only; HOLD state is unchanged.
- [ ] B06 button labels and explanatory copy are editable while item keys/order/interaction remain locked.
- [ ] B03 routes to **CHỈNH ĐỒ HỌA — B03** and defaults to structured field editing, not upload.
- [ ] B03 structured field edits preserve plan controls.
- [ ] B03 numerical edits are classified evidence-affecting.
- [ ] `THAY TOÀN BỘ ĐỒ HỌA` is a separate secondary flow.
- [ ] B01 hotspot 1 / 2 / 3 opens the matching item directly and highlights the selected hotspot.
- [ ] B01 items remain independent; evidence level stays locked.
- [ ] Each B01 item can open its own media editor.
- [ ] Image/media editor has caption, author/source, source context and alt; no fake per-image Rights gate.
- [ ] Optional caption renders nothing when disabled.
- [ ] Media edits participate in Undo / Redo.
- [ ] Video smoke test covers MP4/WebM selection, ratio, poster, autoplay/mute intent, loop and soft performance guidance.
- [ ] Publication panel exposes masthead, section, title, sapo, authors, publish/update date-time and slug.
- [ ] Optional footer fields disappear cleanly when empty.
- [ ] Preview is reader mode and exposes compact share controls.
- [ ] Reader view does not show internal HOLD/gate/slot/asset codes.
- [ ] B01 / B03 / B05 / B06 / B08 reader interactions do not regress.
- [ ] Panel Escape and focus-return work.
- [ ] No document-level horizontal overflow.
- [ ] No uncaught browser errors during core routing.

**Gate result name:** `RUNTIME_QA_PASS`.

Automated browser success alone does **not** close F-EDITOR-UX-04.

## Gate 2 — Real-editor usability walkthrough

After Runtime QA passes, a newsroom user reopens `/?edit=1` and performs a live walkthrough.

Review questions:

- [ ] Without documentation, can the editor understand what each primary toolbar action does?
- [ ] Does the user naturally click visible copy to edit it?
- [ ] Is the difference between reader view and editorial overlay obvious?
- [ ] Can the user undo and redo without fear of losing work?
- [ ] Is LỊCH SỬ useful without exposing JSON/IDs?
- [ ] Does B01 clearly map hotspot 1/2/3 to item 1/2/3?
- [ ] Does B03 clearly communicate “edit graphic content” vs “replace whole graphic”?
- [ ] Can B06 wording change without suggesting that interaction logic changed?
- [ ] Are B05/B08 HOLD proposals understandable as proposals, not approvals?
- [ ] Are media caption/source controls concise enough for normal newsroom use?
- [ ] Does the video flow give useful guidance without hard-blocking ordinary files?
- [ ] Is THÔNG TIN XUẤT BẢN understandable and are optional fields unobtrusive?
- [ ] Does the footer contain only real supplied values?
- [ ] Does XEM TRƯỚC feel like the article readers would actually see?
- [ ] On 390px / 375px, is the editor usable without excessive scrolling/confusion?

**Gate result name while pending:** `EDITORIAL_USABILITY_QA_PENDING_USER_WALKTHROUGH`.

## Field-level edit policy

The console distinguishes editorial layers rather than locking whole components indiscriminately:

| Layer | Default behavior |
|---|---|
| `STRUCTURE` | LOCKED unless a component-specific editor exists |
| `INTERACTION_LOGIC` | LOCKED |
| `DISPLAY_COPY` | EDITABLE by default |
| `DATA` | EDITABLE or REVIEW_REQUIRED depending on evidence impact |
| `EVIDENCE_STATUS` | LOCKED / HOLD_FOR_RESEARCH |
| `ASSET/MEDIA` | Editable through media flow |
| `STYLE` | Not opened broadly in this Pilot |

Core rule: **lock the logic, not the language**.

### B04
- Evidence logic and structure remain locked.
- No F-EDITOR-UX-04 path may change its evidence state.

### B05 / B08
- Remain `HOLD_FOR_RESEARCH` internally.
- Heading/explanatory/caption wording can be saved as proposals.
- Proposal copy must not remove HOLD, change legal/approval state or upgrade certainty.

### 36/60
- Remains unresolved and outside this UX task.
- No usability control may convert the conflict into a final claim.

## Visual-type routing

The editor no longer assumes every visual is a file image.

- **IMAGE / MEDIA:** upload or replace image/video, optional caption, author/source, context and alt.
- **STRUCTURED_GRAPHIC:** edit internal text/data while preserving layout/interaction; replacing the whole graphic is a separate action.
- **INTERACTIVE_COMPONENT:** edit identified items/states rather than a single ambiguous asset.

Pilot examples:
- B03 = structured graphic.
- B01 = interactive component with three items.
- B06 = interactive reasoning chain with editable display copy and locked interaction keys/order.

## Media policy

The browser may accept image and basic video drafts. It provides soft warnings for measurable properties such as file size, resolution, missing poster and autoplay. Guidance prefers common 1080p H.264 MP4 where appropriate, poster images, lazy/offscreen loading and restrained autoplay.

There is **no per-file Rights status publish gate**. The system cannot verify real-world permission. Rights/legal clearance remains a newsroom policy and human responsibility outside the fake browser gate model.

Media file bytes are session-only in this Pilot. LocalStorage persists the draft metadata; a changed binary must be reselected after reload.

## Publication, footer and sharing

`THÔNG TIN XUẤT BẢN` contains article metadata, optional production credits, data-driven footer fields and share metadata. Empty optional footer fields render nothing in reader preview.

Reader sharing is intentionally compact:
- native device share when available;
- copy link fallback.

Facebook/Zalo/email shortcuts are not required for Pilot acceptance.

## Static/source audit expectations

- No Git token or Git write in browser code.
- `asset-editor.js` is now a compatibility shim; integrated editing lives in `editor.js`.
- Internal technical codes are allowed only in collapsed technical details/export/debug data, not normal user chrome.
- Reader mode must not render editor controls.
- Public interaction code must continue to work when editor code is absent.
- `main` is not merged or deployed by this task.

## Known Pilot limitations

- No CMS/backend, durable revision database, user roles or multi-user editing.
- No automatic Git apply/merge/publish.
- Media binaries are not persisted in localStorage.
- Preview is same-origin browser draft preview, not a hosted approval environment.
- Rich arbitrary HTML editing remains intentionally constrained.
- Video metadata depends on browser decoding of the selected file; invalid test fixtures may have no duration/resolution.
- Share thumbnail/canonical metadata is editable but no social-platform preview validator is bundled.
- Reader source HTML may still contain editorial provenance wording that runtime JS presents in a reader-safe form; source-content normalization should be handled in the controlled apply/content lane, not by silently resolving research claims here.

## Final state for this remediation

When Gate 1 passes but Gate 2 has not yet been performed:

`F-EDITOR-UX-04`  
`REMEDIATION_IMPLEMENTED`  
`RUNTIME_QA_PASS`  
`EDITORIAL_USABILITY_QA_PENDING_USER_WALKTHROUGH`  
`READY_FOR_EDITORIAL_USABILITY_QA_ROUND_2`

Do **not** label `READY_FOR_EDITORIAL_USE_FINAL` until the second live newsroom walkthrough is explicitly accepted.
