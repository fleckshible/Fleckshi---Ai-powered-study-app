import { STORAGE_KEY, BACKUP_KEY } from './schema.js';
import { migrateState } from './migrations.js';

let state = loadFromStorage();
const listeners = new Set();

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return migrateState(null);

    const parsed = JSON.parse(raw);
    if (parsed && !parsed.schemaVersion && !localStorage.getItem(BACKUP_KEY)) {
      // Snapshot original v1 payload before first migration
      localStorage.setItem(BACKUP_KEY, raw);
    }
    return migrateState(parsed);
  } catch (err) {
    console.error('Failed to load state from localStorage:', err);
    return migrateState(null);
  }
}

export function getState() {
  return state;
}

export function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save state to localStorage:', err);
  }
}

export function setState(updater) {
  const next = typeof updater === 'function' ? updater(state) : updater;
  if (next && next !== state) {
    state = next;
  }
  saveState();
  notify();
}

export function replaceState(rawState) {
  state = migrateState(rawState);
  saveState();
  notify();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify() {
  listeners.forEach((fn) => fn(state));
}

export function getActiveSubject() {
  return state.subjects.find((s) => s.id === state.activeSubjectId) || null;
}
