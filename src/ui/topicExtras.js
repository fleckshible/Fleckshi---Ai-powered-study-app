import { escapeHtml } from '../utils/dom.js';

export function renderTopicExtras(topic) {
  const linksHtml = (topic.links || [])
    .map(
      (lnk) =>
        `<li class="extras-item">` +
        `<a href="${escapeHtml(lnk.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(lnk.title || lnk.url)}</a>` +
        `<button type="button" class="topic-del" data-del-link="${lnk.id}" data-topic="${topic.id}" aria-label="Remove link">&times;</button>` +
        `</li>`
    )
    .join('');

  const doubtsHtml = (topic.doubts || [])
    .map(
      (d) =>
        `<li class="extras-item${d.resolved ? ' resolved' : ''}">` +
        `<label><input type="checkbox" data-toggle-doubt="${d.id}" data-topic="${topic.id}" ${
          d.resolved ? 'checked' : ''
        }><span>${escapeHtml(d.text)}</span></label>` +
        `<button type="button" class="topic-del" data-del-doubt="${d.id}" data-topic="${topic.id}" aria-label="Remove doubt">&times;</button>` +
        `</li>`
    )
    .join('');

  return (
    `<div class="topic-extras" data-extras-panel="${topic.id}">` +
    `<div class="extras-section">` +
    `<h4>Notes</h4>` +
    `<textarea class="extras-notes" data-notes-topic="${topic.id}" placeholder="Key formulas, mnemonics, or page numbers...">${escapeHtml(
      topic.notes || ''
    )}</textarea>` +
    `</div>` +
    `<div class="extras-section">` +
    `<h4>Links</h4>` +
    (linksHtml ? `<ul class="extras-list">${linksHtml}</ul>` : '') +
    `<form class="extras-inline-form" data-add-link-form="${topic.id}">` +
    `<input type="text" name="title" placeholder="Title (optional)" aria-label="Link title">` +
    `<input type="url" name="url" placeholder="https://..." required aria-label="Link URL">` +
    `<button type="submit" class="btn-secondary">Add Link</button>` +
    `</form>` +
    `</div>` +
    `<div class="extras-section">` +
    `<h4>Doubts Checklist</h4>` +
    (doubtsHtml ? `<ul class="extras-list">${doubtsHtml}</ul>` : '') +
    `<form class="extras-inline-form" data-add-doubt-form="${topic.id}">` +
    `<input type="text" name="doubt" placeholder="Add a doubt or question to clear..." required aria-label="New doubt">` +
    `<button type="submit" class="btn-secondary">Add Doubt</button>` +
    `</form>` +
    `</div>` +
    `</div>`
  );
}
