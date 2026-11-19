import { toDateKey } from '../utils/date.js';
import { migrateState } from './migrations.js';

/**
 * Serialize full ledger state (plus optional notebooks array, never the API key) as formatted JSON.
 * @param {object} state
 * @param {Array|null} [notebooks=null]
 * @returns {string}
 */
export function exportStateJson(state, notebooks = null) {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: 'Revision Ledger',
    data: state
  };
  if (Array.isArray(notebooks)) {
    payload.notebooks = notebooks;
  }
  return JSON.stringify(payload, null, 2);
}

/**
 * Trigger browser download of a JSON backup file.
 * @param {object} state
 * @param {Array|null} [notebooks=null]
 */
export function downloadBackup(state, notebooks = null) {
  const json = exportStateJson(state, notebooks);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `revision-ledger-backup-${toDateKey()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Parse and validate an imported JSON string (supports wrapped backups and raw v1/v2/v3 state).
 * @param {string} jsonText
 * @returns {object}
 */
export function parseImportedBackup(jsonText) {
  return parseBackupBundle(jsonText).state;
}

/**
 * Parse full backup bundle including optional notebooks array (never imports any API key).
 * @param {string} jsonText
 * @returns {{ state: object, notebooks: Array }}
 */
export function parseBackupBundle(jsonText) {
  const parsed = JSON.parse(jsonText);
  const payload =
    parsed && parsed.data && Array.isArray(parsed.data.subjects) ? parsed.data : parsed;

  if (!payload || !Array.isArray(payload.subjects)) {
    throw new Error('Invalid backup file: missing "subjects" array.');
  }
  const notebooks = Array.isArray(parsed?.notebooks) ? parsed.notebooks : [];
  return {
    state: migrateState(payload),
    notebooks
  };
}
