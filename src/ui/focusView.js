import { escapeHtml } from '../utils/dom.js';
import { toDateKey } from '../utils/date.js';
import { getDueQueue } from '../features/spacedRevision.js';
import { LEVELS } from '../storage/schema.js';
import { renderChronoDialSvg, renderDigitSpans } from './pomodoroWidget.js';

function renderAudioWaveSvg(active) {
  const heights = [6, 12, 9, 15, 8, 13, 7];
  const bars = heights
    .map(
      (h, i) =>
        `<rect x="${i * 4}" y="${16 - (active ? h : 4)}" width="2.2" height="${active ? h : 4}" rx="1"/>`
    )
    .join('');
  return `<svg class="audio-wave-svg${active ? ' active' : ''}" width="28" height="16" viewBox="0 0 28 16" aria-hidden="true">${bars}</svg>`;
}

export function renderFocusView(state, pomoState, audioState) {
  const today = toDateKey();
  const due = getDueQueue(state, today);
  const dueCombined = [...due.overdue, ...due.dueToday];
  const activeSubject =
    state.subjects.find((s) => s.id === state.activeSubjectId) || state.subjects[0] || null;
  const activeTopic = pomoState.topicName || 'No topic attached (click Attach below)';
  const currentWorkMins = state.pomodoro?.workMinutes || 25;
  const isBreak = pomoState.mode === 'break';

  const statusLabel = pomoState.running
    ? isBreak
      ? 'BREAK ACTIVE'
      : 'FOCUSING'
    : isBreak
      ? 'BREAK READY'
      : 'READY TO DIAL · DRAG BEZEL';

  const presets = [15, 25, 45, 60]
    .map(
      (m) =>
        `<button type="button" class="pomo-btn${
          currentWorkMins === m && pomoState.mode === 'focus' ? ' primary' : ''
        }" data-pomo-preset="${m}">${m}M</button>`
    )
    .join('');

  const synthButtons = [
    { id: 'off', label: 'OFF' },
    { id: 'drone', label: 'DRONE' },
    { id: 'rain', label: 'RAIN' },
    { id: 'theta', label: 'THETA' }
  ]
    .map(
      (p) =>
        `<button type="button" class="pomo-btn${
          audioState.preset === p.id ? (p.id === 'off' ? ' primary' : ' mint') : ''
        }" data-audio-preset="${p.id}">${p.label}</button>`
    )
    .join('');

  const confidenceBanner = pomoState.lastCompletedTopic
    ? `<div class="confidence-banner">` +
      `<span>Session complete for <strong>${escapeHtml(
        pomoState.lastCompletedTopic.topicName
      )}</strong> — rate recall confidence:</span>` +
      `<div class="confidence-actions">` +
      `<button type="button" class="btn-secondary" data-conf-rating="hard" data-conf-subj="${pomoState.lastCompletedTopic.subjectId}" data-conf-topic="${pomoState.lastCompletedTopic.topicId}">Hard (+1d)</button>` +
      `<button type="button" class="btn-secondary" data-conf-rating="good" data-conf-subj="${pomoState.lastCompletedTopic.subjectId}" data-conf-topic="${pomoState.lastCompletedTopic.topicId}">Good</button>` +
      `<button type="button" class="btn-primary" data-conf-rating="easy" data-conf-subj="${pomoState.lastCompletedTopic.subjectId}" data-conf-topic="${pomoState.lastCompletedTopic.topicId}">Easy (Boost)</button>` +
      `</div>` +
      `</div>`
    : '';

  const queueHtml = dueCombined.length
    ? dueCombined
        .slice(0, 8)
        .map(
          (item) =>
            `<div class="srs-card">` +
            `<div>` +
            `<span class="srs-subject-pill">${escapeHtml(item.subjectName)}</span>` +
            `<div class="topic-name">${escapeHtml(item.topic.name)}</div>` +
            `<div class="topic-submeta"><span class="topic-tag ${
              item.nextDue < today ? 'overdue' : 'due'
            }">${escapeHtml(item.intervalLabel)} · ${escapeHtml(item.nextDue)}</span></div>` +
            `</div>` +
            `<div style="display:flex; gap:6px;">` +
            `<button type="button" class="btn-secondary" data-attach-focus-topic="${item.topic.id}" data-attach-focus-subj="${item.subjectId}">Attach</button>` +
            `<button type="button" class="btn-primary" data-srs-revise="${item.topic.id}" data-srs-subject="${item.subjectId}">Revised</button>` +
            `</div>` +
            `</div>`
        )
        .join('')
    : `<p class="view-subtitle">No spaced revisions due today. Attach a topic from your active subject below.</p>`;

  const subjectTopicsHtml = activeSubject?.topics?.length
    ? activeSubject.topics
        .slice(0, 12)
        .map((t) => {
          const isAttached = pomoState.topicId === t.id;
          const marks = LEVELS.map(
            (l) =>
              `<button type="button" class="mark-btn ${l.cls}${t[l.key] ? ' on' : ''}" ` +
              `data-focus-mark-topic="${t.id}" data-focus-mark-subj="${activeSubject.id}" data-focus-mark-lvl="${l.key}" ` +
              `aria-label="${l.label} for ${escapeHtml(t.name)}">${l.short}</button>`
          ).join('');
          return (
            `<div class="srs-card">` +
            `<div style="min-width:0; flex:1;">` +
            `<div class="topic-name">${escapeHtml(t.name)}</div>` +
            `<div class="topic-submeta"><span class="topic-tag">${t.studyMinutes || 0}m logged</span></div>` +
            `</div>` +
            `<div class="marks">${marks}</div>` +
            `<button type="button" class="${isAttached ? 'btn-primary' : 'btn-secondary'}" ` +
            `data-attach-focus-topic="${t.id}" data-attach-focus-subj="${activeSubject.id}">${
              isAttached ? 'Active' : 'Attach'
            }</button>` +
            `</div>`
          );
        })
        .join('')
    : `<p class="view-subtitle">Add topics in Ledger to attach them here.</p>`;

  return (
    `<main class="page" data-page-view="focus">` +
    `<div class="view-header">` +
    `<div>` +
    `<h1 class="serif hero-split-title">Focus Engine<span class="title-dot"></span></h1>` +
    `<p class="view-subtitle">Attached: <span class="mono">${escapeHtml(activeTopic)}</span></p>` +
    `</div>` +
    `<button type="button" class="btn-secondary" id="collapseChronoBtn">MINIMIZE HUD</button>` +
    `</div>` +
    confidenceBanner +
    `<div class="focus-studio-grid">` +
    `<section class="chrono-stage" aria-label="Chrono-Engine Timepiece">` +
    `<div class="chrono-header-box">` +
    `<span class="chrono-status-pill${isBreak ? ' break' : ''}" id="chronoStatusPill">${statusLabel}</span>` +
    `<div class="chrono-top-readout" id="chronoMainReadout">${renderDigitSpans(
      pomoState.secondsLeft
    )}</div>` +
    `<div class="chrono-sub-hint mono">Drag outer knob (5–120m) · Tap center star to ${
      pomoState.running ? 'pause' : 'start'
    }</div>` +
    `</div>` +
    `<div class="chrono-svg-wrap" id="chronoMainWrap">` +
    renderChronoDialSvg(pomoState, 320, true) +
    `</div>` +
    `<div class="chrono-preset-row">` +
    (pomoState.running
      ? `<button type="button" class="pomo-btn primary" data-pomo="pause">PAUSE</button>`
      : `<button type="button" class="pomo-btn primary" data-pomo="start">START</button>`) +
    `<button type="button" class="pomo-btn" data-pomo="reset">RESET</button>` +
    `<button type="button" class="pomo-btn mint" data-pomo="switch">${
      pomoState.mode === 'focus' ? 'BREAK MODE' : 'FOCUS MODE'
    }</button>` +
    `</div>` +
    `<div class="chrono-preset-row">${presets}</div>` +
    `<div class="audio-synth-bar">` +
    `<div style="display:flex; align-items:center; gap:8px;">` +
    renderAudioWaveSvg(audioState.active) +
    `<span class="mono" style="font-size:11px; color:var(--text-secondary);">FOCUS SYNTH</span>` +
    `</div>` +
    `<div class="audio-presets">${synthButtons}</div>` +
    `</div>` +
    `</section>` +
    `<section class="focus-queue-panel">` +
    `<h2 class="serif">Today&rsquo;s Revision Queue<span class="title-dot"></span></h2>` +
    queueHtml +
    (activeSubject
      ? `<h2 class="serif" style="margin-top:20px;">${escapeHtml(
          activeSubject.name
        )} Topics<span class="title-dot"></span></h2>${subjectTopicsHtml}`
      : '') +
    `</section>` +
    `</div>` +
    `</main>`
  );
}
