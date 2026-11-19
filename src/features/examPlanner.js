import { LEVELS } from '../storage/schema.js';
import { diffDays, toDateKey } from '../utils/date.js';

export const EXAM_NEAR_DAYS = 14;

/**
 * Compute counts, weighted readiness %, exam countdown, pace, and weak spots for a subject.
 * Weighted readiness: read = 1, revised = 2, practiced = 3 (max 6 per topic).
 * @param {object} subject
 * @param {string} [todayKey=toDateKey()]
 * @returns {object}
 */
export function getSubjectStats(subject, todayKey = toDateKey()) {
  const topics = subject?.topics || [];
  const total = topics.length;
  const counts = { read: 0, revised: 0, practiced: 0 };

  let weightedScore = 0;
  let remainingTopics = 0;

  for (const t of topics) {
    for (const lvl of LEVELS) {
      if (t[lvl.key]) {
        counts[lvl.key]++;
        weightedScore += lvl.weight;
      }
    }
    if (!(t.read && t.revised && t.practiced)) {
      remainingTopics++;
    }
  }

  const maxWeighted = total * 6;
  const readinessPct = maxWeighted ? Math.round((weightedScore / maxWeighted) * 100) : 0;

  const daysLeft = subject?.examDate ? diffDays(todayKey, subject.examDate) : null;
  const isExamNear = daysLeft !== null && daysLeft >= 0 && daysLeft <= EXAM_NEAR_DAYS;

  let topicsPerDay = null;
  if (daysLeft !== null && daysLeft >= 0) {
    topicsPerDay = Number((remainingTopics / Math.max(1, daysLeft)).toFixed(1));
  }

  // Weak spots: topics at level 1 or 2 (started or partially done, not yet practiced) when exam is near
  const weakSpots = isExamNear
    ? topics.filter((t) => !t.practiced && (t.read || t.revised || total > 0))
        .filter((t) => !(t.read && t.revised && t.practiced) && !t.practiced)
    : [];

  return {
    total,
    counts,
    readinessPct,
    remainingTopics,
    daysLeft,
    isExamNear,
    topicsPerDay,
    weakSpots
  };
}

/**
 * Human-readable countdown label for an exam date.
 * @param {number|null} daysLeft
 * @returns {string}
 */
export function formatCountdown(daysLeft) {
  if (daysLeft === null) return '';
  if (daysLeft < 0) return `Passed (${Math.abs(daysLeft)}d ago)`;
  if (daysLeft === 0) return 'Exam today';
  if (daysLeft === 1) return '1 day left';
  return `${daysLeft} days left`;
}
