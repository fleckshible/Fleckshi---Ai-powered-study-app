const MS_PER_DAY = 86400000;

/**
 * Return local date as YYYY-MM-DD.
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function toDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parse a YYYY-MM-DD string into a local midnight Date.
 * @param {string} key
 * @returns {Date|null}
 */
export function parseDateKey(key) {
  if (!key || typeof key !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]) - 1;
  const d = Number(match[3]);
  const dt = new Date(y, m, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m || dt.getDate() !== d) return null;
  return dt;
}

/**
 * Add N days to a YYYY-MM-DD date key.
 * @param {string} key
 * @param {number} days
 * @returns {string}
 */
export function addDays(key, days) {
  const dt = parseDateKey(key) || new Date();
  dt.setDate(dt.getDate() + days);
  return toDateKey(dt);
}

/**
 * Signed difference in whole days: targetKey - baseKey.
 * Positive means targetKey is in the future.
 * @param {string} baseKey
 * @param {string} targetKey
 * @returns {number|null}
 */
export function diffDays(baseKey, targetKey) {
  const a = parseDateKey(baseKey);
  const b = parseDateKey(targetKey);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY);
}

/**
 * Format a YYYY-MM-DD key into a short readable date, e.g. "Nov 17".
 * @param {string} key
 * @returns {string}
 */
export function formatShortDate(key) {
  const dt = parseDateKey(key);
  if (!dt) return '';
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Return an array of the last N YYYY-MM-DD keys ending with endKey (inclusive).
 * @param {number} count
 * @param {string} [endKey=toDateKey()]
 * @returns {string[]}
 */
export function lastNDays(count, endKey = toDateKey()) {
  const result = [];
  for (let i = count - 1; i >= 0; i--) {
    result.push(addDays(endKey, -i));
  }
  return result;
}
