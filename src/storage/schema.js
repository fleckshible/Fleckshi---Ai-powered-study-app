export const STORAGE_KEY = 'revision-ledger-v1';
export const BACKUP_KEY = 'revision-ledger-v1-backup';
export const SCHEMA_VERSION = 3;

export const LEVELS = [
  { key: 'read', short: 'R', label: 'Read once', cls: 'm1', xp: 10, weight: 1 },
  { key: 'revised', short: 'Rv', label: 'Revised', cls: 'm2', xp: 20, weight: 2 },
  { key: 'practiced', short: 'P', label: 'Practiced', cls: 'm3', xp: 30, weight: 3 }
];

export const SRS_INTERVALS = [1, 3, 7, 21];

export function createDefaultSrs() {
  return {
    stage: 0,       // 0: +1d, 1: +3d, 2: +7d, 3: +21d, 4: completed
    nextDue: null,  // YYYY-MM-DD | null
    lastReviewed: null,
    history: []
  };
}

export function createTopic(name, overrides = {}) {
  const practiced = Boolean(overrides.practiced);
  return {
    id: overrides.id || '',
    name: String(name || '').trim(),
    chapter:
      typeof overrides.chapter === 'string' && overrides.chapter.trim()
        ? overrides.chapter.trim()
        : 'General',
    read: Boolean(overrides.read),
    revised: Boolean(overrides.revised),
    practiced,
    practiceCount: Number.isFinite(overrides.practiceCount)
      ? Math.max(0, overrides.practiceCount)
      : practiced
        ? 1
        : 0,
    confidence: overrides.confidence || null,
    srs: overrides.srs ? { ...createDefaultSrs(), ...overrides.srs } : createDefaultSrs(),
    studyMinutes: Number.isFinite(overrides.studyMinutes) ? overrides.studyMinutes : 0,
    notes: typeof overrides.notes === 'string' ? overrides.notes : '',
    links: Array.isArray(overrides.links) ? overrides.links : [],
    doubts: Array.isArray(overrides.doubts) ? overrides.doubts : []
  };
}

export function createSubject(name, overrides = {}) {
  return {
    id: overrides.id || '',
    name: String(name || '').trim(),
    examDate: typeof overrides.examDate === 'string' && overrides.examDate ? overrides.examDate : null,
    topics: Array.isArray(overrides.topics) ? overrides.topics : []
  };
}

export function createDefaultState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    subjects: [],
    activeSubjectId: null,
    activeView: 'subject', // 'subject' | 'today' | 'dashboard'
    dailyGoal: 5,
    xp: 0,
    streak: {
      current: 0,
      longest: 0,
      lastActiveDate: null
    },
    activityLog: {},
    pomodoro: {
      workMinutes: 25,
      breakMinutes: 5
    }
  };
}
