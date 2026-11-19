export const FLECKSHI_STORAGE_KEY = 'revision-ledger-fleckshi-v1';
export const FLECKSHI_SCHEMA_VERSION = 1;
export const DEFAULT_SNOOZE_MS = 30 * 60 * 1000;

function createDefaultPrefs() {
  return {
    version: FLECKSHI_SCHEMA_VERSION,
    onboardingCompleted: false,
    dismissed: false,
    pausedUntil: null,
    typingPaused: false
  };
}

let memoryPrefs = createDefaultPrefs();

function canUseStorage() {
  try {
    return typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function';
  } catch {
    return false;
  }
}

function normalizePrefs(raw) {
  const base = createDefaultPrefs();
  if (!raw || typeof raw !== 'object') return base;
  const pausedUntil =
    typeof raw.pausedUntil === 'number' && Number.isFinite(raw.pausedUntil) && raw.pausedUntil > 0
      ? raw.pausedUntil
      : null;
  return {
    version: FLECKSHI_SCHEMA_VERSION,
    onboardingCompleted: Boolean(raw.onboardingCompleted),
    dismissed: Boolean(raw.dismissed),
    pausedUntil,
    typingPaused: Boolean(raw.typingPaused)
  };
}

/**
 * Load persisted Fleckshi onboarding, dismissal, and typing pause settings.
 * Falls back cleanly to in-memory state if localStorage is unavailable or corrupt.
 */
export function loadFleckshiPrefs() {
  if (!canUseStorage()) return { ...memoryPrefs };
  try {
    const raw = localStorage.getItem(FLECKSHI_STORAGE_KEY);
    if (!raw) return { ...memoryPrefs };
    const parsed = normalizePrefs(JSON.parse(raw));
    memoryPrefs = parsed;
    return { ...parsed };
  } catch {
    return { ...memoryPrefs };
  }
}

/**
 * Merge a partial preferences update and persist to localStorage when available.
 * @param {Partial<ReturnType<typeof createDefaultPrefs>>} patch
 */
export function saveFleckshiPrefs(patch) {
  const current = loadFleckshiPrefs();
  const next = normalizePrefs({ ...current, ...(patch || {}) });
  memoryPrefs = next;
  if (canUseStorage()) {
    try {
      localStorage.setItem(FLECKSHI_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage quota/privacy failures gracefully
    }
  }
  return { ...next };
}

/**
 * Clear onboarding completion and snooze/dismissal flags so the tour can replay cleanly.
 */
export function resetFleckshiOnboarding() {
  return saveFleckshiPrefs({
    onboardingCompleted: false,
    dismissed: false,
    pausedUntil: null
  });
}

/**
 * Return true when Fleckshi is currently within a user-requested snooze window.
 */
export function isFleckshiSnoozed(prefs, now = Date.now()) {
  if (!prefs || typeof prefs.pausedUntil !== 'number') return false;
  return prefs.pausedUntil > now;
}
