import { SRS_INTERVALS, createDefaultSrs } from '../storage/schema.js';
import { addDays, diffDays, toDateKey } from '../utils/date.js';

/**
 * Called when "read" is toggled on a topic.
 * Schedules the first +1d revision if not already scheduled/completed.
 * @param {object} topic
 * @param {boolean} isNowRead
 * @param {string} [todayKey=toDateKey()]
 */
export function syncSrsOnReadToggle(topic, isNowRead, todayKey = toDateKey()) {
  if (!topic.srs) topic.srs = createDefaultSrs();
  if (isNowRead && !topic.srs.nextDue && topic.srs.stage === 0) {
    topic.srs.stage = 0;
    topic.srs.nextDue = addDays(todayKey, SRS_INTERVALS[0]);
  }
}

/**
 * Called when a topic is marked revised (either from Today view or Subject view).
 * Clears current due item and schedules the next interval (+3, +7, +21), or completes.
 * @param {object} topic
 * @param {string} [todayKey=toDateKey()]
 */
export function advanceSrsOnRevise(topic, todayKey = toDateKey()) {
  if (!topic.srs) topic.srs = createDefaultSrs();
  const srs = topic.srs;

  srs.lastReviewed = todayKey;
  if (!Array.isArray(srs.history)) srs.history = [];
  srs.history.push({ date: todayKey, stage: srs.stage });

  const nextStage = srs.stage + 1;
  if (nextStage < SRS_INTERVALS.length) {
    srs.stage = nextStage;
    srs.nextDue = addDays(todayKey, SRS_INTERVALS[nextStage]);
  } else {
    srs.stage = SRS_INTERVALS.length;
    srs.nextDue = null;
  }
}

/**
 * Adjust spaced revision schedule based on user recall confidence rating.
 * @param {object} topic
 * @param {'hard'|'good'|'easy'} [rating='good']
 * @param {string} [todayKey=toDateKey()]
 */
export function advanceSrsWithConfidence(topic, rating = 'good', todayKey = toDateKey()) {
  if (!topic.srs) topic.srs = createDefaultSrs();
  const srs = topic.srs;

  if (rating === 'hard') {
    srs.lastReviewed = todayKey;
    if (!Array.isArray(srs.history)) srs.history = [];
    srs.history.push({ date: todayKey, stage: srs.stage, rating: 'hard' });
    srs.stage = 0;
    srs.nextDue = addDays(todayKey, SRS_INTERVALS[0]);
    return;
  }

  if (rating === 'easy') {
    srs.lastReviewed = todayKey;
    if (!Array.isArray(srs.history)) srs.history = [];
    srs.history.push({ date: todayKey, stage: srs.stage, rating: 'easy' });
    const nextStage = Math.min(SRS_INTERVALS.length, (srs.stage || 0) + 2);
    srs.stage = nextStage;
    srs.nextDue =
      nextStage < SRS_INTERVALS.length ? addDays(todayKey, SRS_INTERVALS[nextStage]) : null;
    return;
  }

  advanceSrsOnRevise(topic, todayKey);
}

/**
 * Collect all due and overdue topics across all subjects for the "Today" view.
 * @param {object} state
 * @param {string} [todayKey=toDateKey()]
 * @returns {{ overdue: Array, dueToday: Array, totalDue: number }}
 */
export function getDueQueue(state, todayKey = toDateKey()) {
  const overdue = [];
  const dueToday = [];

  for (const subject of state.subjects || []) {
    for (const topic of subject.topics || []) {
      const nextDue = topic.srs?.nextDue;
      if (!nextDue) continue;
      const stage = topic.srs?.stage ?? 0;
      const intervalDays = SRS_INTERVALS[Math.min(stage, SRS_INTERVALS.length - 1)];
      const item = {
        subjectId: subject.id,
        subjectName: subject.name,
        topic,
        nextDue,
        intervalLabel: `+${intervalDays}d`
      };
      if (nextDue < todayKey) {
        overdue.push(item);
      } else if (nextDue === todayKey) {
        dueToday.push(item);
      }
    }
  }

  overdue.sort((a, b) => a.nextDue.localeCompare(b.nextDue));
  return {
    overdue,
    dueToday,
    totalDue: overdue.length + dueToday.length
  };
}

/**
 * Compute full SRS Command Center telemetry: interval pipeline counts,
 * retention score, 7-day load, and upcoming 14-day forecast.
 * @param {object} state
 * @param {string} [todayKey=toDateKey()]
 */
export function getSrsCommandCenterStats(state, todayKey = toDateKey()) {
  const dueQueue = getDueQueue(state, todayKey);
  const buckets = { d1: 0, d3: 0, d7: 0, d21: 0 };
  const upcoming = [];
  let trackedCount = 0;
  let upcoming7DayLoad = 0;

  for (const subject of state.subjects || []) {
    for (const topic of subject.topics || []) {
      const srs = topic.srs;
      const hasSrs = Boolean(srs && (srs.nextDue || srs.stage > 0 || (srs.history && srs.history.length)));
      if (!hasSrs) continue;

      trackedCount++;
      const stage = srs.stage ?? 0;
      if (stage <= 0) buckets.d1++;
      else if (stage === 1) buckets.d3++;
      else if (stage === 2) buckets.d7++;
      else buckets.d21++;

      if (srs.nextDue && srs.nextDue > todayKey) {
        const delta = diffDays(todayKey, srs.nextDue);
        if (delta !== null && delta <= 7) {
          upcoming7DayLoad++;
        }
        if (delta !== null && delta <= 14) {
          const intervalDays = SRS_INTERVALS[Math.min(stage, SRS_INTERVALS.length - 1)];
          upcoming.push({
            subjectId: subject.id,
            subjectName: subject.name,
            topic,
            nextDue: srs.nextDue,
            daysUntil: delta,
            intervalLabel: `+${intervalDays}d`
          });
        }
      }
    }
  }

  upcoming.sort((a, b) => a.nextDue.localeCompare(b.nextDue));
  const retentionScorePct = trackedCount
    ? Math.max(0, Math.round(((trackedCount - dueQueue.overdue.length) / trackedCount) * 100))
    : 100;

  return {
    dueQueue,
    buckets,
    trackedCount,
    retentionScorePct,
    upcoming7DayLoad,
    upcomingForecast: upcoming.slice(0, 8)
  };
}
