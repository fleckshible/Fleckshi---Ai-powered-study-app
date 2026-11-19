import { toDateKey } from '../utils/date.js';
import {
  DEFAULT_FALLBACK_ORDER,
  DEFAULT_TASK_ROUTING
} from '../features/modelCatalog.js';

export const KEY_VAULT_STORAGE_KEY = 'revision-ledger-key-vault-v1';
export const LIVE_MODELS_SESSION_KEY = 'revision-ledger-live-models-v1';
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

let sessionUnlockedKey = null;
let memoryVaultFallback = null;
let memoryLiveModels = null;

function hasLocalStorage() {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function hasSessionStorage() {
  try {
    return typeof sessionStorage !== 'undefined';
  } catch {
    return false;
  }
}

function toBase64(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < arr.length; i++) {
    bin += String.fromCharCode(arr[i]);
  }
  return btoa(bin);
}

function fromBase64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

async function deriveAesKey(passphrase, saltBytes) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function readRawVault() {
  if (!hasLocalStorage()) return memoryVaultFallback;
  try {
    const raw = localStorage.getItem(KEY_VAULT_STORAGE_KEY);
    if (!raw) return memoryVaultFallback;
    return JSON.parse(raw);
  } catch {
    return memoryVaultFallback;
  }
}

function writeRawVault(record) {
  memoryVaultFallback = record;
  if (!hasLocalStorage()) return;
  try {
    localStorage.setItem(KEY_VAULT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // ignore storage quota errors
  }
}

function migrateThinkingMap(raw) {
  const existing = raw?.modelThinking && typeof raw.modelThinking === 'object'
    ? { ...raw.modelThinking }
    : {};
  if (raw?.deeperThinking && Object.keys(existing).length === 0) {
    existing[DEFAULT_GEMINI_MODEL] = 'high';
    existing['gemini-2.5-flash'] = 8192;
  }
  return existing;
}

function buildDefaultSettings(prev = {}, overrides = {}) {
  const taskRouting = {
    ...DEFAULT_TASK_ROUTING,
    ...(prev.taskRouting || {}),
    ...(overrides.taskRouting || {})
  };
  const fallbackOrder = Array.isArray(overrides.fallbackOrder)
    ? [...overrides.fallbackOrder]
    : Array.isArray(prev.fallbackOrder) && prev.fallbackOrder.length
      ? [...prev.fallbackOrder]
      : [...DEFAULT_FALLBACK_ORDER];

  const modelThinking = {
    ...migrateThinkingMap(prev),
    ...(overrides.modelThinking || {})
  };

  return {
    model: overrides.model || prev.model || DEFAULT_GEMINI_MODEL,
    customModel: overrides.customModel ?? prev.customModel ?? '',
    preset: overrides.preset || prev.preset || 'balanced',
    useSingleModel:
      overrides.useSingleModel !== undefined
        ? Boolean(overrides.useSingleModel)
        : Boolean(prev.useSingleModel),
    taskRouting,
    modelThinking,
    fallbackOrder,
    autoFallback:
      overrides.autoFallback !== undefined
        ? Boolean(overrides.autoFallback)
        : prev.autoFallback !== undefined
          ? Boolean(prev.autoFallback)
          : true,
    deeperThinking:
      overrides.deeperThinking !== undefined
        ? Boolean(overrides.deeperThinking)
        : Boolean(prev.deeperThinking),
    usageCounters:
      overrides.usageCounters && typeof overrides.usageCounters === 'object'
        ? overrides.usageCounters
        : prev.usageCounters && typeof prev.usageCounters === 'object'
          ? prev.usageCounters
          : {}
  };
}

/**
 * Return safe metadata about the stored API key vault (never returns the raw key).
 */
export function getKeyVaultConfig() {
  const raw = readRawVault();
  const settings = buildDefaultSettings(raw || {});
  const encrypted = Boolean(raw?.encrypted && raw?.ciphertext);
  const hasStoredKey = encrypted || Boolean(raw?.plainKey);
  const unlocked = Boolean(
    (!encrypted && raw?.plainKey) || (encrypted && sessionUnlockedKey)
  );

  return {
    hasStoredKey,
    encrypted,
    unlocked,
    ...settings
  };
}

/**
 * Return the active API key in memory if unlocked or remembered in browser.
 * @returns {string|null}
 */
export function getActiveApiKey() {
  const raw = readRawVault();
  if (!raw) return null;
  if (raw.encrypted) return sessionUnlockedKey || null;
  return raw.plainKey || null;
}

/**
 * Save API key directly in browser localStorage (default "Remember in this browser" mode).
 */
export function saveApiKeyPlain(apiKey, settings = {}) {
  const cleanKey = String(apiKey || '').trim();
  if (!cleanKey) throw new Error('API key cannot be empty.');
  const prev = readRawVault() || {};
  sessionUnlockedKey = cleanKey;
  writeRawVault({
    encrypted: false,
    salt: null,
    iv: null,
    ciphertext: null,
    plainKey: cleanKey,
    ...buildDefaultSettings(prev, settings)
  });
}

/**
 * Save API key encrypted with PBKDF2 + AES-GCM (opt-in passphrase lock).
 */
export async function saveApiKeyEncrypted(apiKey, passphrase, settings = {}) {
  const cleanKey = String(apiKey || '').trim();
  const cleanPass = String(passphrase || '');
  if (!cleanKey) throw new Error('API key cannot be empty.');
  if (cleanPass.length < 4) throw new Error('Passphrase must be at least 4 characters.');

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await deriveAesKey(cleanPass, salt);
  const cipherBuf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    new TextEncoder().encode(cleanKey)
  );

  const prev = readRawVault() || {};
  sessionUnlockedKey = cleanKey;
  writeRawVault({
    encrypted: true,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(cipherBuf),
    plainKey: null,
    ...buildDefaultSettings(prev, settings)
  });
}

/**
 * Unlock an encrypted API key for the current browser tab session.
 */
export async function unlockApiKey(passphrase) {
  const raw = readRawVault();
  if (!raw?.encrypted || !raw?.ciphertext || !raw?.salt || !raw?.iv) {
    throw new Error('No encrypted key found.');
  }
  try {
    const aesKey = await deriveAesKey(String(passphrase || ''), fromBase64(raw.salt));
    const plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(raw.iv) },
      aesKey,
      fromBase64(raw.ciphertext)
    );
    const decoded = new TextDecoder().decode(plainBuf);
    if (!decoded) throw new Error('Empty decrypted key.');
    sessionUnlockedKey = decoded;
    return true;
  } catch {
    throw new Error('Incorrect passphrase. Unable to unlock API key.');
  }
}

export function lockApiKeySession() {
  sessionUnlockedKey = null;
}

export function removeApiKey() {
  sessionUnlockedKey = null;
  memoryVaultFallback = null;
  memoryLiveModels = null;
  if (hasLocalStorage()) {
    try {
      localStorage.removeItem(KEY_VAULT_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
  if (hasSessionStorage()) {
    try {
      sessionStorage.removeItem(LIVE_MODELS_SESSION_KEY);
    } catch {
      // ignore
    }
  }
}

export function updateModelSettings(partial = {}) {
  const prev = readRawVault() || {
    encrypted: false,
    salt: null,
    iv: null,
    ciphertext: null,
    plainKey: null
  };
  const nextSettings = buildDefaultSettings(prev, partial);
  writeRawVault({
    ...prev,
    ...nextSettings
  });
}

/**
 * Increment local daily request counter for a model (browser-local estimate, not Google's real quota).
 */
export function recordModelUsage(modelId, dateKey = toDateKey()) {
  if (!modelId) return;
  const prev = readRawVault() || {
    encrypted: false,
    salt: null,
    iv: null,
    ciphertext: null,
    plainKey: null
  };
  const counters = { ...(prev.usageCounters || {}) };
  // Keep only the last 14 days of local counters to avoid bloat
  const keys = Object.keys(counters).sort();
  while (keys.length > 14) {
    const oldest = keys.shift();
    if (oldest !== dateKey) delete counters[oldest];
  }
  const dayMap = { ...(counters[dateKey] || {}) };
  dayMap[modelId] = (Number(dayMap[modelId]) || 0) + 1;
  counters[dateKey] = dayMap;
  writeRawVault({
    ...prev,
    ...buildDefaultSettings(prev),
    usageCounters: counters
  });
}

/**
 * Return local daily request counts `{ [modelId]: count }` for today (or dateKey).
 */
export function getTodayModelUsage(dateKey = toDateKey()) {
  const raw = readRawVault();
  const counters = raw?.usageCounters?.[dateKey];
  return counters && typeof counters === 'object' ? { ...counters } : {};
}

export function getCachedLiveModels() {
  if (Array.isArray(memoryLiveModels) && memoryLiveModels.length) {
    return memoryLiveModels;
  }
  if (hasSessionStorage()) {
    try {
      const raw = sessionStorage.getItem(LIVE_MODELS_SESSION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          memoryLiveModels = parsed;
          return parsed;
        }
      }
    } catch {
      // ignore
    }
  }
  return null;
}

export function setCachedLiveModels(models) {
  memoryLiveModels = Array.isArray(models) ? models : null;
  if (hasSessionStorage()) {
    try {
      if (Array.isArray(models)) {
        sessionStorage.setItem(LIVE_MODELS_SESSION_KEY, JSON.stringify(models));
      } else {
        sessionStorage.removeItem(LIVE_MODELS_SESSION_KEY);
      }
    } catch {
      // ignore
    }
  }
}
