import { escapeHtml } from '../utils/dom.js';

export function renderImportModal(previewTopics = null, rawText = '') {
  const previewHtml = previewTopics
    ? `<p style="font-size:13px; color:var(--ink-soft); margin:0 0 8px;">Preview (${previewTopics.length} topics detected — uncheck any to skip):</p>` +
      `<ul class="preview-list">` +
      previewTopics
        .map(
          (t, i) =>
            `<li><label style="display:flex; align-items:center; gap:8px; flex:1; cursor:pointer;">` +
            `<input type="checkbox" class="import-preview-cb" data-idx="${i}" checked>` +
            `<span>${escapeHtml(t)}</span>` +
            `</label></li>`
        )
        .join('') +
      `</ul>`
    : '';

  return (
    `<div class="modal-backdrop" id="importModalBackdrop" role="dialog" aria-modal="true" aria-labelledby="importModalTitle">` +
    `<div class="modal-card">` +
    `<div class="modal-header">` +
    `<h2 class="serif" id="importModalTitle">Bulk Import Syllabus</h2>` +
    `<button type="button" class="topic-del" id="closeImportModalBtn" aria-label="Close modal">&times;</button>` +
    `</div>` +
    `<p style="font-size:13px; color:var(--ink-soft); margin:0 0 10px;">Paste lines, bullets (-, *, &bull;), or numbered items. Works 100% offline.</p>` +
    `<textarea class="modal-textarea" id="bulkImportText" placeholder="- Atomic Structure&#10;- Chemical Bonding&#10;1. Thermodynamics">${escapeHtml(rawText)}</textarea>` +
    previewHtml +
    `<div class="modal-actions">` +
    `<button type="button" class="btn-secondary" id="previewImportBtn">Preview</button>` +
    (previewTopics && previewTopics.length
      ? `<button type="button" class="btn-primary" id="confirmImportBtn">Add ${previewTopics.length} Topics</button>`
      : '') +
    `</div>` +
    `</div>` +
    `</div>`
  );
}
