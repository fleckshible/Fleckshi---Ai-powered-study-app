import { prefersReducedMotion } from './reducedMotion.js';

export const FX_STORAGE_KEY = 'revision-ledger-fx-level';
export const FX_LEVELS = ['full', 'balanced', 'minimal'];

let memoryFxFallback = null;

function hasLocalStorage() {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Detect hardware & OS reduced-motion defaults safely.
 * Defaults to 'balanced', or 'minimal' on reduced-motion / constrained devices.
 * @param {{ reducedMotion?: boolean, hardwareConcurrency?: number, deviceMemory?: number }} [env]
 * @returns {'full'|'balanced'|'minimal'}
 */
export function detectDefaultFxLevel(env = null) {
  const reduced =
    env?.reducedMotion !== undefined ? Boolean(env.reducedMotion) : prefersReducedMotion();
  if (reduced) return 'minimal';

  const cores =
    env?.hardwareConcurrency !== undefined
      ? env.hardwareConcurrency
      : typeof navigator !== 'undefined'
        ? navigator.hardwareConcurrency
        : undefined;
  if (typeof cores === 'number' && cores > 0 && cores <= 4) {
    return 'minimal';
  }

  const mem =
    env?.deviceMemory !== undefined
      ? env.deviceMemory
      : typeof navigator !== 'undefined'
        ? navigator.deviceMemory
        : undefined;
  if (typeof mem === 'number' && mem > 0 && mem <= 4) {
    return 'minimal';
  }

  return 'balanced';
}

export function getFxLevel() {
  if (prefersReducedMotion()) return 'minimal';

  let saved = memoryFxFallback;
  if (hasLocalStorage()) {
    try {
      saved = localStorage.getItem(FX_STORAGE_KEY) || memoryFxFallback;
    } catch {
      // ignore storage errors
    }
  }
  if (FX_LEVELS.includes(saved)) return saved;
  return detectDefaultFxLevel();
}

export function setFxLevel(level) {
  const valid = FX_LEVELS.includes(level) ? level : detectDefaultFxLevel();
  memoryFxFallback = valid;
  if (hasLocalStorage()) {
    try {
      localStorage.setItem(FX_STORAGE_KEY, valid);
    } catch {
      // ignore
    }
  }
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.setAttribute('data-fx', prefersReducedMotion() ? 'minimal' : valid);
  }
  return valid;
}

export function cycleFxLevel() {
  const current = getFxLevel();
  const order = ['balanced', 'full', 'minimal'];
  const next = order[(order.indexOf(current) + 1) % order.length] || 'balanced';
  return setFxLevel(next);
}

export function applyFxAttribute() {
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.setAttribute('data-fx', getFxLevel());
  }
}
