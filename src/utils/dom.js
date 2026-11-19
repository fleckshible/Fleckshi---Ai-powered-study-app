/**
 * Escape HTML special characters for safe template interpolation.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  const s = str == null ? '' : String(str);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render a circular SVG progress ring.
 * @param {number} pct
 * @param {number} [size=30]
 * @param {string} [extraClass='']
 * @returns {string}
 */
export function ringSvg(pct, size = 30, extraClass = '') {
  const clamped = Math.max(0, Math.min(100, Math.round(pct || 0)));
  const r = (size - 6) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - clamped / 100);
  return (
    `<div class="subject-progress-ring ${extraClass}" data-ring-pct="${clamped}" data-ring-circ="${circumference}">` +
    `<svg width="${size}" height="${size}" aria-hidden="true">` +
    `<circle class="bg" cx="${c}" cy="${c}" r="${r}" fill="none" stroke-width="3"></circle>` +
    `<circle class="fg" cx="${c}" cy="${c}" r="${r}" fill="none" stroke-width="3" ` +
    `stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round"></circle>` +
    `</svg><div class="pct">${clamped}</div></div>`
  );
}
