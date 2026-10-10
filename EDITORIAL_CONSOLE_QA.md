# Interactive Editorial Console v0.1 — QA & controlled handoff

Scope: PILOT_LOCAL implementation, TOOLKIT_CANDIDATE. Source of truth remains the Git repository.
Branch: editorial/round-2a-v0.1.5. No merge, deployment or Git write from browser.

## How to open (local checkout of the review branch)

1. Checkout the review branch and serve its root over HTTP, for example: python3 -m http.server 8000
2. Public mode: http://localhost:8000/
3. Edit mode: http://localhost:8000/?edit=1
4. Controlled-mode simulation: http://localhost:8000/?edit=1&editorial_mode=controlled
5. Post-publish-mode simulation: http://localhost:8000/?edit=1&editorial_mode=post_publish

Query parameters are **not authentication** and do not establish authoritative product or approval state.
Do not publish the edit-mode URL as a credential-protected editorial system.

## Manual browser QA required before READY_FOR_EDITORIAL_USE

- [ ] Public URL has no toolbar, edit styles, focusable editorial fields or local draft overlays.
- [ ] Hero h1, dek, B01 plain-text paragraphs, B06 intro, B07 intro and B09 zone descriptions can be edited by click.
- [ ] Click editable text, type, press Enter: immediate preview and changed marker.
- [ ] Esc while typing cancels the current field edit.
- [ ] SAVE DRAFT survives reload on the same browser/origin and shows saved state.
- [ ] UNDO restores the previous revision; RESTORE BASELINE restores branch text and clears saved draft.
- [ ] COMPARE displays before/after, section, field ID, timestamp, classification, review status and selective QC.
- [ ] EXPORT CHANGES downloads parseable JSON with baselineId and no Git credentials.
- [ ] B04 Evidence Tower text/logic remains locked; its original 5-level interaction still works.
- [ ] B05 model tabs still switch; all B05 proposals stay HOLD_FOR_RESEARCH and do not replace page claims.
- [ ] B08 legal status proposals stay HOLD_FOR_RESEARCH and do not replace page claims.
- [ ] B09 foundation-count hold slot is proposal-only; no 36/60 resolution is inserted.
- [ ] B03 measurement values and B07 owner/engineering status fields cannot be changed inline.
- [ ] In CONTROLLED_EDIT, edits are PENDING_REVIEW with classification and selective QC.
- [ ] In POST_PUBLISH_EDITABLE, EXPORT requires a reason per change and creates a POST_PUBLISH_UPDATE record.
- [ ] Desktop viewport: 1440x900 and 1280x800. No console obstruction or focus loss.
- [ ] Mobile viewport: 390x844 and 360x800. Toolbar wraps; panel scrolls and remains usable.
- [ ] Keyboard: Tab reaches editable text and controls, Enter activates edit, Escape cancels/closes, panel focus cycles.
- [ ] Existing hotspots, B02 layers, B03 plan toggles, B04 levels, B05 tabs, B06 reasoning chain, B08 verb ladder remain functional.
- [ ] Check cross-browser (Chromium, Firefox, Safari if available); no console errors.

## Static source checks already performed

- Public index conditionally loads editor.js and editor.css only when edit=1.
- No browser GitHub token or direct GitHub write is present in editor.js.
- B04 locked, B05/B08 and foundation-count marked HOLD_FOR_RESEARCH.
- Baseline-aware local draft, undo, restore, compare, export and selective-QC code exists.
- app.js was not modified by Console implementation.
- main branch is untouched.

Static source checks do **not** constitute a passed browser QA.

## Change set handoff / selective QC

The JSON export is a proposal, not an approval or Git patch. An external controlled apply step must:
1. Verify repository, branch, source path, current Git commit and baselineId/field before-text.
2. Reject changed selectors, changed baseline text or stale source revisions.
3. Keep HOLD_FOR_RESEARCH proposals out of final content until source/claim verification.
4. Apply allowed changes on a review branch only; create a Git commit and reviewer diff.
5. Reopen selective QC gates from each record's impactQc.
6. Obtain explicit merge/publish approval; create public update log for post-publish changes.

## Known v0.1 limitations

- No CMS, identity/role enforcement, server sync, multi-device draft sync or automatic Git apply.
- Plain-text leaf nodes are inline-editable. Rich-text elements with nested markup outside HOLD areas are locked in v0.1.
- Dynamic JS-generated reader-facing text is not inline-editable; this avoids accidental interaction/evidence-state changes.
- Browser localStorage is draft convenience, not durable version history or source of truth.
- Query-parameter editorial modes are UI/workflow simulations until backed by approved release metadata.
- No hosted review-branch preview is provisioned by this change; local checkout or controlled preview deployment is required.
- Asset replacement is classification-ready in the JSON schema, not a functional asset uploader.
