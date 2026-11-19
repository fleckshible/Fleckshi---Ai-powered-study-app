import {
  SCHEMA_VERSION,
  createDefaultState,
  createSubject,
  createTopic
} from './schema.js';
import { uid } from '../utils/uid.js';

/**
 * Migrate any v1/v2 persisted state to the current schemaVersion without losing
 * existing subjects, topics, or level marks.
 * @param {unknown} raw
 * @returns {object}
 */
export function migrateState(raw) {
  const base = createDefaultState();
  if (!raw || typeof raw !== 'object') return base;

  const fromVersion = Number(raw.schemaVersion) || 1;

  const subjects = Array.isArray(raw.subjects)
    ? raw.subjects.map((s) =>
        createSubject(s?.name || 'Untitled Subject', {
          id: s?.id || uid(),
          examDate: s?.examDate || null,
          topics: Array.isArray(s?.topics)
            ? s.topics.map((t) =>
                createTopic(t?.name || 'Untitled Topic', {
                  id: t?.id || uid(),
                  chapter: t?.chapter,
                  read: Boolean(t?.read),
                  revised: Boolean(t?.revised),
                  practiced: Boolean(t?.practiced),
                  practiceCount: t?.practiceCount,
                  confidence: t?.confidence,
                  srs: t?.srs,
                  studyMinutes: t?.studyMinutes,
                  notes: t?.notes,
                  links: t?.links,
                  doubts: t?.doubts
                })
              )
            : []
        })
      )
    : [];

  const activeSubjectId =
    raw.activeSubjectId && subjects.some((s) => s.id === raw.activeSubjectId)
      ? raw.activeSubjectId
      : subjects[0]?.id || null;

  const validViews = new Set(['subject', 'today', 'focus', 'dashboard', 'notebook']);
  const activeView = validViews.has(raw.activeView) ? raw.activeView : 'subject';

  const rawPomo = raw.pomodoro && typeof raw.pomodoro === 'object' ? raw.pomodoro : {};
  const workMinutes =
    fromVersion < 3 && rawPomo.workMinutes === 120
      ? 25
      : Number.isFinite(rawPomo.workMinutes) && rawPomo.workMinutes >= 1 && rawPomo.workMinutes <= 120
        ? rawPomo.workMinutes
        : base.pomodoro.workMinutes;
  const breakMinutes =
    Number.isFinite(rawPomo.breakMinutes) && rawPomo.breakMinutes >= 1 && rawPomo.breakMinutes <= 60
      ? rawPomo.breakMinutes
      : base.pomodoro.breakMinutes;

  return {
    ...base,
    schemaVersion: SCHEMA_VERSION,
    subjects,
    activeSubjectId,
    activeView,
    dailyGoal: Number.isFinite(raw.dailyGoal) && raw.dailyGoal > 0 ? raw.dailyGoal : base.dailyGoal,
    xp: Number.isFinite(raw.xp) && raw.xp >= 0 ? raw.xp : 0,
    streak: {
      ...base.streak,
      ...(raw.streak && typeof raw.streak === 'object' ? raw.streak : {})
    },
    activityLog:
      raw.activityLog && typeof raw.activityLog === 'object' ? raw.activityLog : {},
    pomodoro: {
      workMinutes,
      breakMinutes
    }
  };
}
