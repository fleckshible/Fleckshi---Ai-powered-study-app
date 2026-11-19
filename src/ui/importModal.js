import { escapeHtml } from '../utils/dom.js';

export function renderImportModal(
  previewTopics = null,
  rawText = '',
  {
    images = [],
    scanning = false,
    ocrError = '',
    hasApiKey = false,
    skippedDuplicates = 0
  } = {}
) {
  const imagesHtml = images.length
    ? `<div style="display:flex; flex-direction:column; gap:6px; margin-bottom:10px;">` +
      images
        .map(
          (img, idx) =>
            `<div style="display:flex; align-items:center; gap:8px; padding:6px 8px; border:1px solid var(--border-hairline); border-radius:6px; background:var(--bg-surface);">` +
            `<img src="${escapeHtml(img.previewUrl)}" alt="${escapeHtml(
              img.name
            )}" style="width:36px; height:36px; object-fit:cover; border-radius:4px; flex-shrink:0;">` +
            `<div style="flex:1; min-width:0;">` +
            `<div style="font-size:12.5px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(
              img.name
            )}</div>` +
            `<div style="font-size:11.5px; color:${
              img.status === 'error' ? 'var(--red)' : 'var(--text-secondary)'
            };">${
              img.status === 'scanning'
                ? 'Extracting topics…'
                : img.status === 'done'
                  ? 'Extracted'
                  : img.status === 'error'
                    ? escapeHtml(img.error || 'OCR failed')
                    : 'Ready to scan'
            }</div>` +
            `</div>` +
            (img.status === 'error'
              ? `<button type="button" class="btn-secondary" style="padding:4px 8px; font-size:11.5px;" data-bulk-retry-img="${idx}">Retry</button>`
              : '') +
            `<button type="button" class="topic-del" data-bulk-remove-img="${idx}" aria-label="Remove ${escapeHtml(
              img.name
            )}">&times;</button>` +
            `</div>`
        )
        .join('') +
      `</div>`
    : '';

  const previewHtml = previewTopics
    ? `<p style="font-size:13px; color:var(--ink-soft); margin:0 0 8px;">Preview (${previewTopics.length} new topic${
        previewTopics.length === 1 ? '' : 's'
      } detected${
        skippedDuplicates > 0 ? `, ${skippedDuplicates} duplicate(s) skipped` : ''
      } — edit text or uncheck any to skip):</p>` +
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
    `<div class="modal-card" id="bulkImportModalCard">` +
    `<div class="modal-header">` +
    `<h2 class="serif" id="importModalTitle">Bulk Import Syllabus</h2>` +
    `<button type="button" class="topic-del" id="closeImportModalBtn" aria-label="Close modal">&times;</button>` +
    `</div>` +
    `<p style="font-size:13px; color:var(--ink-soft); margin:0 0 10px;">Paste lines, bullets (-, *, &bull;), or upload/paste syllabus images (PNG, JPG, WebP).</p>` +
    `<div style="display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-bottom:10px;">` +
    `<input type="file" id="bulkImportImgInput" accept="image/png,image/jpeg,image/webp" multiple style="display:none;" aria-hidden="true">` +
    `<button type="button" class="btn-secondary" id="bulkImportImgBtn" ${
      scanning ? 'disabled' : ''
    }>Upload Syllabus Image(s)</button>` +
    (images.length
      ? `<button type="button" class="btn-primary" id="runBulkImageOcrBtn" ${
          scanning ? 'disabled' : ''
        }>${scanning ? 'Extracting…' : `Extract from ${images.length} Image${images.length > 1 ? 's' : ''}`}</button>`
      : `<span style="font-size:12px; color:var(--text-secondary);">Tip: You can also press Ctrl+V to paste a screenshot here.</span>`) +
    `</div>` +
    imagesHtml +
    (!hasApiKey && images.length
      ? `<div style="padding:8px 10px; border-radius:6px; border:1px solid rgba(245,158,11,0.45); background:rgba(245,158,11,0.08); margin-bottom:10px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">` +
        `<span style="font-size:12.5px;">A Gemini API key is required to extract topics from images. Set up your key in Notebook → AI Settings.</span>` +
        `<button type="button" class="btn-secondary" id="bulkSetupApiKeyBtn" style="padding:5px 10px; font-size:12px;">Set up API Key</button>` +
        `</div>`
      : '') +
    (ocrError
      ? `<div style="font-size:12.5px; color:var(--red); margin-bottom:8px;" role="alert">${escapeHtml(
          ocrError
        )}</div>`
      : '') +
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
