import { getState, setState } from '../storage/store.js';
import { recordStudyMinutes } from './habits.js';

const listeners = new Set();

let timerState = {
  mode: 'focus', // 'focus' | 'break'
  running: false,
  secondsLeft: 25 * 60,
  totalSeconds: 25 * 60,
  elapsedFocusSeconds: 0,
  subjectId: null,
  topicId: null,
  topicName: '',
  lastCompletedTopic: null // { subjectId, topicId, topicName }
};

let intervalId = null;

function emit() {
  listeners.forEach((fn) => fn({ ...timerState }));
}

export function subscribePomodoro(fn) {
  listeners.add(fn);
  fn({ ...timerState });
  return () => listeners.delete(fn);
}

export function getPomodoroState() {
  return { ...timerState };
}

export function initPomodoroDefaults() {
  const { pomodoro } = getState();
  if (!timerState.running) {
    const mins = pomodoro?.workMinutes || 25;
    timerState.secondsLeft = mins * 60;
    timerState.totalSeconds = mins * 60;
    emit();
  }
}

export function attachPomodoroTopic(subjectId, topicId, topicName) {
  timerState.subjectId = subjectId;
  timerState.topicId = topicId;
  timerState.topicName = topicName || '';
  emit();
}

export function clearCompletedTopicPrompt() {
  timerState.lastCompletedTopic = null;
  emit();
}

export function setPomodoroDurations(workMinutes, breakMinutes) {
  const w = Math.max(1, Math.min(120, Number(workMinutes) || 25));
  const b = Math.max(1, Math.min(60, Number(breakMinutes) || 5));
  setState((prev) => ({
    ...prev,
    pomodoro: { workMinutes: w, breakMinutes: b }
  }));
  if (!timerState.running) {
    const secs = (timerState.mode === 'focus' ? w : b) * 60;
    timerState.secondsLeft = secs;
    timerState.totalSeconds = secs;
    emit();
  }
}

/**
 * Set duration directly from the interactive 120-tick Chrono-Engine bezel (5..120m).
 * While actively dragging (`commit = false`), updates timerState without triggering a full DOM re-render.
 * On release (`commit = true`), persists the duration to store.
 * @param {number} minutes
 * @param {number} [step=5]
 * @param {boolean} [commit=true]
 */
export function setPomodoroMinutesFromDial(minutes, step = 5, commit = true) {
  const s = step === 1 ? 1 : 5;
  const m = Math.max(5, Math.min(120, Math.round(minutes / s) * s));
  if (!commit) {
    const clamped = timerState.mode === 'focus' ? m : Math.min(60, m);
    timerState.secondsLeft = clamped * 60;
    timerState.totalSeconds = clamped * 60;
    emit();
    return;
  }
  const { pomodoro } = getState();
  if (timerState.mode === 'focus') {
    setPomodoroDurations(m, pomodoro?.breakMinutes || 5);
  } else {
    setPomodoroDurations(pomodoro?.workMinutes || 25, Math.min(60, m));
  }
}

function flushElapsedMinutes() {
  const mins = Math.floor(timerState.elapsedFocusSeconds / 60);
  if (mins <= 0) return;

  timerState.elapsedFocusSeconds -= mins * 60;
  const { subjectId, topicId } = timerState;

  setState((prev) => {
    if (subjectId && topicId) {
      const subj = prev.subjects.find((s) => s.id === subjectId);
      const topic = subj?.topics.find((t) => t.id === topicId);
      if (topic) {
        topic.studyMinutes = (topic.studyMinutes || 0) + mins;
      }
    }
    recordStudyMinutes(prev, subjectId, mins);
    return prev;
  });
}

export function startPomodoro() {
  if (timerState.running) return;
  timerState.running = true;
  timerState.lastCompletedTopic = null;
  intervalId = setInterval(() => {
    if (timerState.secondsLeft > 0) {
      timerState.secondsLeft -= 1;
      if (timerState.mode === 'focus') {
        timerState.elapsedFocusSeconds += 1;
      }
      emit();
      return;
    }

    // Session finished
    if (timerState.mode === 'focus') {
      flushElapsedMinutes();
      if (timerState.subjectId && timerState.topicId) {
        timerState.lastCompletedTopic = {
          subjectId: timerState.subjectId,
          topicId: timerState.topicId,
          topicName: timerState.topicName
        };
      }
      const { pomodoro } = getState();
      const bSecs = (pomodoro?.breakMinutes || 5) * 60;
      timerState.mode = 'break';
      timerState.secondsLeft = bSecs;
      timerState.totalSeconds = bSecs;
    } else {
      const { pomodoro } = getState();
      const wSecs = (pomodoro?.workMinutes || 25) * 60;
      timerState.mode = 'focus';
      timerState.secondsLeft = wSecs;
      timerState.totalSeconds = wSecs;
    }
    timerState.running = false;
    clearInterval(intervalId);
    intervalId = null;
    emit();
  }, 1000);
  emit();
}

export function pausePomodoro() {
  if (!timerState.running) return;
  timerState.running = false;
  clearInterval(intervalId);
  intervalId = null;
  flushElapsedMinutes();
  emit();
}

export function resetPomodoro() {
  pausePomodoro();
  const { pomodoro } = getState();
  const secs = (pomodoro?.workMinutes || 25) * 60;
  timerState.mode = 'focus';
  timerState.secondsLeft = secs;
  timerState.totalSeconds = secs;
  timerState.elapsedFocusSeconds = 0;
  emit();
}

export function switchPomodoroMode(mode) {
  pausePomodoro();
  const { pomodoro } = getState();
  timerState.mode = mode === 'break' ? 'break' : 'focus';
  const secs =
    (timerState.mode === 'focus' ? pomodoro?.workMinutes || 25 : pomodoro?.breakMinutes || 5) * 60;
  timerState.secondsLeft = secs;
  timerState.totalSeconds = secs;
  emit();
}
