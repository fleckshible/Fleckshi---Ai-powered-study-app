import { LEVELS } from '../storage/schema.js';
import { addDays, lastNDays, toDateKey } from '../utils/date.js';

function ensureDayEntry(activityLog, dateKey) {
  if (!activityLog[dateKey]) {
    activityLog[dateKey] = { ticks: 0, minutes: 0, xp: 0, bySubject: {} };
  }
  if (!activityLog[dateKey].bySubject) {
    activityLog[dateKey].bySubject = {};
  }
  return activityLog[dateKey];
}

function ensureSubjectEntry(dayEntry, subjectId) {
  if (!dayEntry.bySubject[subjectId]) {
    dayEntry.bySubject[subjectId] = { ticks: 0, minutes: 0 };
  }
  return dayEntry.bySubject[subjectId];
}

/**
 * Record a level mark toggle in activityLog, XP, and streak.
 * @param {object} state
 * @param {string} subjectId
 * @param {string} levelKey
 * @param {boolean} isNowOn
 * @param {string} [todayKey=toDateKey()]
 */
export function recordMarkActivity(state, subjectId, levelKey, isNowOn, todayKey = toDateKey()) {
  const lvl = LEVELS.find((l) => l.key === levelKey);
  const xpDelta = lvl ? lvl.xp : 10;
  const day = ensureDayEntry(state.activityLog, todayKey);
  const subj = ensureSubjectEntry(day, subjectId);

  if (isNowOn) {
    day.ticks += 1;
    day.xp += xpDelta;
    subj.ticks += 1;
    state.xp = Math.max(0, (state.xp || 0) + xpDelta);
  } else {
    day.ticks = Math.max(0, day.ticks - 1);
    day.xp = Math.max(0, day.xp - xpDelta);
    subj.ticks = Math.max(0, subj.ticks - 1);
    state.xp = Math.max(0, (state.xp || 0) - xpDelta);
  }

  recomputeStreak(state, todayKey);
}

/**
 * Record study minutes from the Pomodoro timer into activityLog and streak.
 * @param {object} state
 * @param {string|null} subjectId
 * @param {number} minutes
 * @param {string} [todayKey=toDateKey()]
 */
export function recordStudyMinutes(state, subjectId, minutes, todayKey = toDateKey()) {
  if (!Number.isFinite(minutes) || minutes <= 0) return;
  const rounded = Math.round(minutes);
  const day = ensureDayEntry(state.activityLog, todayKey);
  day.minutes += rounded;

  if (subjectId) {
    const subj = ensureSubjectEntry(day, subjectId);
    subj.minutes += rounded;
  }

  recomputeStreak(state, todayKey);
}

/**
 * Recompute current & longest daily streaks from activityLog.
 * A day counts as active if ticks > 0 or minutes > 0.
 * @param {object} state
 * @param {string} [todayKey=toDateKey()]
 */
export function recomputeStreak(state, todayKey = toDateKey()) {
  const log = state.activityLog || {};
  const isActive = (key) => {
    const e = log[key];
    return Boolean(e && (e.ticks > 0 || e.minutes > 0));
  };

  let current = 0;
  let cursor = isActive(todayKey) ? todayKey : addDays(todayKey, -1);
  while (isActive(cursor)) {
    current++;
    cursor = addDays(cursor, -1);
  }

  const longest = Math.max(state.streak?.longest || 0, current);
  state.streak = {
    current,
    longest,
    lastActiveDate: isActive(todayKey) ? todayKey : state.streak?.lastActiveDate || null
  };
}

/**
 * Build heatmap data for the last N weeks (default 20 weeks = 140 days).
 * @param {object} state
 * @param {number} [weeks=20]
 * @param {string} [todayKey=toDateKey()]
 */
export function getHeatmapCells(state, weeks = 20, todayKey = toDateKey()) {
  const totalDays = weeks * 7;
  const keys = lastNDays(totalDays, todayKey);
  const log = state.activityLog || {};

  return keys.map((dateKey) => {
    const entry = log[dateKey] || { ticks: 0, minutes: 0, xp: 0 };
    const score = (entry.ticks || 0) + Math.floor((entry.minutes || 0) / 15);
    let level = 0;
    if (score >= 7) level = 4;
    else if (score >= 4) level = 3;
    else if (score >= 2) level = 2;
    else if (score >= 1) level = 1;

    return {
      dateKey,
      ticks: entry.ticks || 0,
      minutes: entry.minutes || 0,
      level
    };
  });
}

/**
 * Compute 7-day weekly summary: topics advanced (ticks) and minutes studied per subject.
 * @param {object} state
 * @param {string} [todayKey=toDateKey()]
 */
export function getWeeklySummary(state, todayKey = toDateKey()) {
  const days = lastNDays(7, todayKey);
  const log = state.activityLog || {};
  const bySubject = new Map();

  for (const s of state.subjects || []) {
    bySubject.set(s.id, { subjectId: s.id, name: s.name, ticks: 0, minutes: 0 });
  }

  let totalTicks = 0;
  let totalMinutes = 0;

  for (const d of days) {
    const entry = log[d];
    if (!entry) continue;
    totalTicks += entry.ticks || 0;
    totalMinutes += entry.minutes || 0;

    if (entry.bySubject) {
      for (const [sid, subData] of Object.entries(entry.bySubject)) {
        if (!bySubject.has(sid)) continue;
        const row = bySubject.get(sid);
        row.ticks += subData.ticks || 0;
        row.minutes += subData.minutes || 0;
      }
    }
  }

  const rows = Array.from(bySubject.values());
  return {
    totalTicks,
    totalMinutes,
    rows
  };
}

/**
 * Compute Scholar Level, Rank Title, and progress toward next level (100 XP per level).
 * @param {number} [xp=0]
 */
export function getLevelProgress(xp = 0) {
  const safeXp = Math.max(0, Math.floor(Number(xp) || 0));
  const level = Math.floor(safeXp / 100) + 1;
  const currentLevelXp = safeXp % 100;
  const nextLevelXp = 100;
  const nextThreshold = level * 100;
  const progressPct = Math.min(100, Math.round((currentLevelXp / nextLevelXp) * 100));

  let title = 'Novice Scholar';
  if (level >= 11) title = 'Grandmaster of Recall';
  else if (level >= 7) title = 'Revision Architect';
  else if (level >= 4) title = 'Syllabus Tactician';
  else if (level >= 2) title = 'Focused Initiate';

  return {
    xp: safeXp,
    level,
    title,
    currentLevelXp,
    nextLevelXp,
    nextThreshold,
    progressPct
  };
}
