import { escapeHtml } from '../utils/dom.js';
import { prefersReducedMotion } from '../animations/reducedMotion.js';
import { getFxLevel } from '../animations/fxController.js';
import {
  getEmoteSpec,
  getEmoteImageUrl,
  probeFleckshiSprite
} from '../features/fleckshiEmotes.js';
import {
  DEFAULT_SNOOZE_MS,
  loadFleckshiPrefs,
  saveFleckshiPrefs,
  resetFleckshiOnboarding,
  isFleckshiSnoozed
} from '../features/fleckshiState.js';

const VIEW_LABELS = {
  subject: 'Ledger',
  focus: 'Focus',
  today: 'Today',
  dashboard: 'Stats',
  notebook: 'Notebook'
};

let initialized = false;
let actions = {};
let snapshot = {
  activeView: 'subject',
  subjects: [],
  activeSubject: null,
  dueCount: 0,
  overdueCount: 0,
  pomodoroRunning: false
};
let prefs = loadFleckshiPrefs();
let spriteStatus = { available: false, width: 0, height: 0, cellAspect: 1 };

let rootEl = null;
let globalAbort = null;
let typingTimerId = null;
let spotlightTimerId = null;
let activeSpotlightEl = null;

let isOpen = false;
let currentMode = 'hub'; // 'intro' | 'ledger' | 'add-subject' | 'notebook' | 'learn' | 'hub'
let currentEmote = 'idle';
let customMessage = null; // { pill, title, body, sub } | null
let returnModeAfterAdd = 'notebook';

// Subject confirmation state
let subjectDraft = '';
let pendingConfirmName = '';
let subjectFeedback = null; // { type: 'error' | 'success', text: string, existingId?: string }

// Typewriter state
let fullCopyText = '';
let typedLength = 0;
let isTyping = false;
let messageSeq = 0;

// Optional discrete near-target / near-pointer placement (desktop >= 900px, never continuous tracking)
let lastExternalPointer = null; // { x, y, time, rect }
let positionedCoords = null; // { left, top } | null
let lastGuidedView = null;

const FOCUS_TIP_SESSION_KEY = 'revision-ledger-fleckshi-focus-tip-v1';
let focusTipDismissedInSession = false;
let pendingFocusEnterCallback = null;

function isFocusTipAlreadySeen() {
  if (focusTipDismissedInSession) return true;
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(FOCUS_TIP_SESSION_KEY) === '1') {
      focusTipDismissedInSession = true;
      return true;
    }
  } catch {
    // ignore storage errors
  }
  return false;
}

export function dismissFleckshiFocusSuggestion() {
  focusTipDismissedInSession = true;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(FOCUS_TIP_SESSION_KEY, '1');
    }
  } catch {
    // ignore storage errors
  }
  if (isOpen && customMessage?.showEnterFocusBtn) {
    closeBubble({ restoreFocus: false });
  }
}

function isReducedTypingMode() {
  return prefersReducedMotion() || getFxLevel() === 'minimal' || Boolean(prefs.typingPaused);
}

function clearTypingTimer() {
  if (typingTimerId !== null) {
    clearTimeout(typingTimerId);
    typingTimerId = null;
  }
}

function clearSpotlightHighlight() {
  if (spotlightTimerId !== null) {
    clearTimeout(spotlightTimerId);
    spotlightTimerId = null;
  }
  if (activeSpotlightEl) {
    activeSpotlightEl.classList.remove('fleckshi-spotlight-ring');
    activeSpotlightEl = null;
  }
}

function applySpotlight(selector) {
  if (typeof actions.highlightElement === 'function') {
    return actions.highlightElement(selector);
  }
  clearSpotlightHighlight();
  if (typeof document === 'undefined' || !selector) return { ok: false };
  const target = document.querySelector(selector);
  if (!target) return { ok: false };
  activeSpotlightEl = target;
  target.classList.add('fleckshi-spotlight-ring');
  try {
    target.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'nearest'
    });
  } catch {
    // ignore scroll errors
  }
  spotlightTimerId = setTimeout(() => {
    clearSpotlightHighlight();
  }, 2400);
  return { ok: true };
}

function formatContextSummary(snap) {
  const viewName = VIEW_LABELS[snap?.activeView] || 'Ledger';
  const subjCount = Array.isArray(snap?.subjects) ? snap.subjects.length : 0;
  const activeName = snap?.activeSubject?.name || '';
  const due = Number(snap?.dueCount) || 0;
  const parts = [`On ${viewName}`];
  if (activeName) {
    parts.push(activeName);
  } else {
    parts.push(subjCount === 0 ? 'No subjects yet' : `${subjCount} subjects`);
  }
  if (due > 0) {
    parts.push(`${due} due`);
  }
  return parts.join(' · ');
}

function formatDockStatus() {
  if (prefs.typingPaused) return 'Typing paused · Click to hide';
  if (currentMode === 'add-subject') return 'Waiting for subject name';
  if (!prefs.onboardingCompleted && ['intro', 'ledger', 'notebook', 'learn'].includes(currentMode)) {
    const stepMap = { intro: '1/5', ledger: '2/5', notebook: '4/5', learn: '5/5' };
    return `Tour ${stepMap[currentMode]} · Click to hide`;
  }
  return `${formatContextSummary(snapshot)}`;
}

function resolveCurrentStepViewModel() {
  if (customMessage) {
    return {
      pill: customMessage.pill || 'Fleckshi Guide',
      title: customMessage.title || 'Here is what I found',
      body: customMessage.body || '',
      sub: customMessage.sub || ''
    };
  }

  switch (currentMode) {
    case 'intro':
      return {
        pill: '1/5 · Welcome',
        title: 'Welcome to Fleckshi',
        body:
          'Your study space, guided. I’m Fleckshi—I can show you around, from adding your first subject to generating study notes in Notebook.',
        sub: ''
      };
    case 'ledger':
      return {
        pill: '2/5 · Ledger',
        title: 'Your Subject Ledger',
        body:
          'Track topics across Read Once, Revised, and Practiced. Add topics, run Bulk Import, or set an exam date.',
        sub: ''
      };
    case 'add-subject':
      return {
        pill: !prefs.onboardingCompleted ? '3/5 · Add Subject' : 'Add a Subject',
        title: 'Which subject are you studying?',
        body: 'Type a name and review it before I add it to your Ledger.',
        sub: ''
      };
    case 'notebook':
      return {
        pill: '4/5 · Notebook',
        title: 'Meet Study Notebook',
        body:
          'Each subject gets its own Syllabus Brain, Sources, Study Chat, Practice quizzes, and Revision Plan.',
        sub: ''
      };
    case 'learn':
      return {
        pill: '5/5 · Learn',
        title: 'Generate Notes in Learn',
        body:
          'Open Learn inside Notebook to generate Notes, Summaries, Study Guides, FAQs, Glossaries, Timelines, and Mind Maps.',
        sub: ''
      };
    case 'hub':
    default:
      return {
        pill: 'Quick Help',
        title: 'Where would you like to go?',
        body: 'Pick a shortcut below or replay the quick tour.',
        sub: ''
      };
  }
}

function updateTypedTextDom() {
  if (!rootEl) return;
  const copyEl = rootEl.querySelector('#fleckshiTypedCopy');
  if (!copyEl) return;
  const shown = isTyping ? fullCopyText.slice(0, typedLength) : fullCopyText;
  copyEl.textContent = shown;
  if (isTyping && typedLength < fullCopyText.length) {
    copyEl.setAttribute('aria-hidden', 'true');
  } else {
    copyEl.removeAttribute('aria-hidden');
  }
}

function startTypingMessage(nextText) {
  clearTypingTimer();
  fullCopyText = String(nextText || '');
  messageSeq += 1;

  const srEl = rootEl?.querySelector('#fleckshiSrLive');
  if (srEl) {
    srEl.textContent = `${fullCopyText}`;
  }

  if (isReducedTypingMode() || !fullCopyText.length) {
    typedLength = fullCopyText.length;
    isTyping = false;
    updateTypedTextDom();
    return;
  }

  typedLength = 0;
  isTyping = true;
  updateTypedTextDom();

  const expectedSeq = messageSeq;
  const stepTick = () => {
    if (!isOpen || expectedSeq !== messageSeq) {
      clearTypingTimer();
      isTyping = false;
      return;
    }
    if (isReducedTypingMode() || (typeof document !== 'undefined' && document.hidden)) {
      typedLength = fullCopyText.length;
      isTyping = false;
      updateTypedTextDom();
      return;
    }
    const chunk = fullCopyText.length > 120 ? 2 : 1;
    typedLength = Math.min(fullCopyText.length, typedLength + chunk);
    updateTypedTextDom();
    if (typedLength < fullCopyText.length) {
      typingTimerId = setTimeout(stepTick, 20);
    } else {
      isTyping = false;
      typingTimerId = null;
      updateTypedTextDom();
    }
  };

  typingTimerId = setTimeout(stepTick, 20);
}

function computeClampedStagePos(pointerInfo) {
  if (typeof window === 'undefined' || window.innerWidth < 900 || !pointerInfo) return null;
  const stageEl = rootEl?.querySelector('#fleckshiStage');
  const stageW = Math.min(344, Math.max(260, stageEl?.offsetWidth || 344));
  const stageH = Math.min(420, Math.max(210, stageEl?.offsetHeight || 290));
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const sidebarEl = document.querySelector('.cover');
  const sidebarRect = sidebarEl ? sidebarEl.getBoundingClientRect() : null;
  const sidebarRight = sidebarRect && sidebarRect.width > 0 ? Math.round(sidebarRect.right) : 250;
  const minLeft = Math.max(16, Math.min(sidebarRight + 14, vw - stageW - 18));
  const maxLeft = Math.max(minLeft, vw - stageW - 18);
  const minTop = 16;
  const maxTop = Math.max(minTop, vh - stageH - 24);

  const avoid = pointerInfo.rect;
  const margin = 16;
  let left = pointerInfo.x + margin;
  let top = pointerInfo.y - stageH - margin;

  if (avoid) {
    const rightSpace = vw - (avoid.right + margin);
    const leftSpace = avoid.left - minLeft - margin;
    if (rightSpace >= stageW) {
      left = avoid.right + margin;
      top = Math.max(minTop, avoid.top - 12);
    } else if (leftSpace >= stageW) {
      left = avoid.left - stageW - margin;
      top = Math.max(minTop, avoid.top - 12);
    } else if (avoid.bottom + margin + stageH <= vh - 24) {
      left = avoid.left;
      top = avoid.bottom + margin;
    } else if (avoid.top - margin - stageH >= minTop) {
      left = avoid.left;
      top = avoid.top - stageH - margin;
    }
  }

  let clampedLeft = Math.round(Math.max(minLeft, Math.min(maxLeft, left)));
  let clampedTop = Math.round(Math.max(minTop, Math.min(maxTop, top)));

  // Avoid covering an actively focused input/textarea outside Fleckshi
  const activeEl = document.activeElement;
  if (
    activeEl instanceof Element &&
    (!rootEl || !rootEl.contains(activeEl)) &&
    activeEl.matches('input, textarea, select')
  ) {
    const ar = activeEl.getBoundingClientRect();
    const overlapsActive =
      clampedLeft < ar.right + 12 &&
      clampedLeft + stageW > ar.left - 12 &&
      clampedTop < ar.bottom + 12 &&
      clampedTop + stageH > ar.top - 12;
    if (overlapsActive) {
      if (ar.bottom + 16 + stageH <= vh - 20) {
        clampedTop = Math.round(ar.bottom + 16);
      } else if (ar.top - 16 - stageH >= minTop) {
        clampedTop = Math.round(ar.top - 16 - stageH);
      } else if (ar.right + 16 + stageW <= vw - 16) {
        clampedLeft = Math.round(ar.right + 16);
      }
    }
  }

  return {
    left: Math.round(Math.max(minLeft, Math.min(maxLeft, clampedLeft))),
    top: Math.round(Math.max(minTop, Math.min(maxTop, clampedTop)))
  };
}

function findFirstVisibleTarget(selector) {
  if (typeof document === 'undefined' || !selector) return null;
  const list = document.querySelectorAll(selector);
  for (const el of list) {
    const r = el.getBoundingClientRect();
    if (r && (r.width > 0 || r.height > 0)) return el;
  }
  return null;
}

function guideToTarget(selector, { spotlight = true } = {}) {
  if (spotlight) {
    applySpotlight(selector);
  }
  if (typeof window === 'undefined' || typeof document === 'undefined' || window.innerWidth < 900) {
    return;
  }
  const target = findFirstVisibleTarget(selector);
  if (!target) return;
  const rect = target.getBoundingClientRect();
  positionedCoords = computeClampedStagePos({
    x: rect.right,
    y: rect.top,
    rect
  });
}

function getViewGuideSelector(viewName) {
  switch (viewName) {
    case 'focus':
      return '#chronoMainWrap, [data-nav="focus"]';
    case 'today':
      return '[data-nav="today"]';
    case 'dashboard':
      return '[data-nav="dashboard"]';
    case 'notebook':
      return '#nbTab_learn, .nb-top-tabs, [data-nav="notebook"]';
    case 'subject':
    default:
      return '#addTopicForm, [data-nav="subject"]';
  }
}

function getModeGuideSpec(mode) {
  switch (mode) {
    case 'intro':
      return { selector: '[data-nav="subject"], #addSubjectForm', spotlight: false };
    case 'ledger':
      return { selector: '#addTopicForm, [data-nav="subject"]', spotlight: true };
    case 'add-subject':
      return { selector: '#addSubjectForm', spotlight: true };
    case 'notebook':
      return { selector: '[data-nav="notebook"], .nb-top-tabs', spotlight: true };
    case 'learn':
      return { selector: '#nbTab_learn, [data-nav="notebook"]', spotlight: true };
    default:
      return null;
  }
}

function renderPortraitHtml(size = 'md') {
  const sizeCls = size === 'sm' ? ' fleckshi-portrait--sm' : '';
  const iconPx = size === 'sm' ? 18 : 26;

  if (spriteStatus.available) {
    const imgUrl = getEmoteImageUrl(currentEmote);
    return (
      `<div class="fleckshi-portrait${sizeCls}">` +
      `<img class="fleckshi-img" src="${escapeHtml(imgUrl)}" alt="Fleckshi" decoding="async">` +
      `</div>`
    );
  }

  // Intentional guide compass/spark emblem fallback (when image assets are missing)
  return (
    `<div class="fleckshi-portrait${sizeCls}" title="Fleckshi assets missing — expected PNGs in public/assets/fleckshi-emotes-clean/">` +
    `<div class="fleckshi-portrait-fallback" role="img" aria-label="Fleckshi">` +
    `<svg width="${iconPx}" height="${iconPx}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
    `<circle cx="12" cy="12" r="9"/>` +
    `<polygon points="16.2 7.8 14 14 7.8 16.2 10 10 16.2 7.8" fill="currentColor" fill-opacity="0.22"/>` +
    `</svg>` +
    `</div>` +
    `</div>`
  );
}

function renderCloudBodyExtras() {
  if (customMessage) {
    if (customMessage.showEnterFocusBtn) {
      return (
        `<div class="fleckshi-actions">` +
        `<button type="button" class="fleckshi-btn-secondary" data-fleckshi-action="dismiss-focus-tip">Not now</button>` +
        `<button type="button" class="fleckshi-btn-primary" data-fleckshi-action="enter-focus-mode">Enter Focus Mode</button>` +
        `</div>`
      );
    }
    const extraBtns = [];
    if (customMessage.showAddSubjectBtn) {
      extraBtns.push(
        `<button type="button" class="fleckshi-btn-primary" data-fleckshi-action="goto-add-subject">Add a subject</button>`
      );
    }
    if (customMessage.showLearnBtn) {
      extraBtns.push(
        `<button type="button" class="fleckshi-btn-primary" data-fleckshi-action="open-learn">Open Learn</button>`
      );
    }
    return (
      `<div class="fleckshi-actions">` +
      extraBtns.join('') +
      `<button type="button" class="fleckshi-btn-secondary" data-fleckshi-action="goto-hub">Help topics</button>` +
      `</div>`
    );
  }

  if (currentMode === 'intro') {
    return (
      `<div class="fleckshi-actions">` +
      `<button type="button" class="fleckshi-btn-secondary" data-fleckshi-action="skip-tour">Skip</button>` +
      `<button type="button" class="fleckshi-btn-primary" data-fleckshi-action="step-ledger">Start tour</button>` +
      `</div>`
    );
  }

  if (currentMode === 'ledger') {
    return (
      `<div class="fleckshi-actions">` +
      `<button type="button" class="fleckshi-btn-secondary" data-fleckshi-action="skip-tour">Skip</button>` +
      `<button type="button" class="fleckshi-btn-secondary" data-fleckshi-action="show-ledger">Show me</button>` +
      `<button type="button" class="fleckshi-btn-primary" data-fleckshi-action="step-add-subject">Next</button>` +
      `</div>`
    );
  }

  if (currentMode === 'add-subject') {
    const feedbackHtml = subjectFeedback
      ? `<div class="fleckshi-feedback ${
          subjectFeedback.type === 'error' ? 'is-error' : 'is-success'
        }">${escapeHtml(subjectFeedback.text)}${
          subjectFeedback.existingId
            ? ` <button type="button" class="fleckshi-mini-btn" data-fleckshi-select-subj="${escapeHtml(
                subjectFeedback.existingId
              )}">Open existing</button>`
            : ''
        }</div>`
      : '';

    const confirmHtml = pendingConfirmName
      ? `<div class="fleckshi-confirm-box">` +
        `<div>Add <strong>${escapeHtml(pendingConfirmName)}</strong> to your Ledger?</div>` +
        `<div class="fleckshi-actions" style="margin-top:0;">` +
        `<button type="button" class="fleckshi-btn-secondary" id="fleckshiEditSubjectBtn">Change</button>` +
        `<button type="button" class="fleckshi-btn-primary" id="fleckshiConfirmAddSubjectBtn">Confirm &amp; Add</button>` +
        `</div>` +
        `</div>`
      : '';

    const nextStepLabel = prefs.onboardingCompleted ? 'Back' : 'Next';
    const nextAction = prefs.onboardingCompleted ? 'goto-hub' : 'step-notebook';

    return (
      `<div class="fleckshi-cloud-scroll">` +
      `<div class="fleckshi-subject-box">` +
      `<label class="fleckshi-subject-label" for="fleckshiSubjectInput">Subject name</label>` +
      `<form class="fleckshi-subject-row" id="fleckshiSubjectForm">` +
      `<input type="text" id="fleckshiSubjectInput" class="fleckshi-subject-input" value="${escapeHtml(
        subjectDraft
      )}" placeholder="e.g. Organic Chemistry" autocomplete="off">` +
      `<button type="submit" class="fleckshi-btn-primary">Review</button>` +
      `</form>` +
      confirmHtml +
      feedbackHtml +
      `</div>` +
      `</div>` +
      `<div class="fleckshi-actions">` +
      (!prefs.onboardingCompleted
        ? `<button type="button" class="fleckshi-btn-secondary" data-fleckshi-action="skip-tour">Skip</button>`
        : '') +
      `<button type="button" class="fleckshi-btn-secondary" data-fleckshi-action="${nextAction}">${nextStepLabel}</button>` +
      `</div>`
    );
  }

  if (currentMode === 'notebook') {
    return (
      `<div class="fleckshi-actions">` +
      `<button type="button" class="fleckshi-btn-secondary" data-fleckshi-action="skip-tour">Skip</button>` +
      `<button type="button" class="fleckshi-btn-secondary" data-fleckshi-action="show-notebook">Show me</button>` +
      `<button type="button" class="fleckshi-btn-primary" data-fleckshi-action="step-learn">Next</button>` +
      `</div>`
    );
  }

  if (currentMode === 'learn') {
    return (
      `<div class="fleckshi-actions">` +
      `<button type="button" class="fleckshi-btn-secondary" data-fleckshi-action="open-learn">Open Learn</button>` +
      `<button type="button" class="fleckshi-btn-primary" data-fleckshi-action="finish-tour">Finish tour</button>` +
      `</div>`
    );
  }

  // Hub suggestions (constrained scroll container)
  const dueCount = Number(snapshot?.dueCount) || 0;
  return (
    `<div class="fleckshi-cloud-scroll">` +
    `<div class="fleckshi-suggestions">` +
    `<button type="button" class="fleckshi-suggest-btn" data-fleckshi-suggest="add-subject">` +
    `Add a subject<span>Confirm before saving</span>` +
    `</button>` +
    `<button type="button" class="fleckshi-suggest-btn" data-fleckshi-suggest="organize-topics">` +
    `Organize topics<span>Chapters, Import &amp; &hellip;</span>` +
    `</button>` +
    `<button type="button" class="fleckshi-suggest-btn" data-fleckshi-suggest="due-today">` +
    `Due today<span>${dueCount > 0 ? `${dueCount} due now` : 'Check Today queue'}</span>` +
    `</button>` +
    `<button type="button" class="fleckshi-suggest-btn" data-fleckshi-suggest="start-focus">` +
    `Focus session<span>Chrono dial &amp; audio</span>` +
    `</button>` +
    `<button type="button" class="fleckshi-suggest-btn" data-fleckshi-suggest="generate-notes">` +
    `Study notes<span>Open Notebook &rarr; Learn</span>` +
    `</button>` +
    `<button type="button" class="fleckshi-suggest-btn" data-fleckshi-suggest="replay-tour">` +
    `Replay tour<span>Quick walkthrough</span>` +
    `</button>` +
    `</div>` +
    `</div>`
  );
}

function renderGuideDom({ restartTyping = false } = {}) {
  if (!rootEl) return;

  const snoozed = isFleckshiSnoozed(prefs);
  const launcherLabel = snoozed ? 'Help · Snoozed' : 'Help';

  const vm = resolveCurrentStepViewModel();
  const canMoveNearClick =
    typeof window !== 'undefined' &&
    window.innerWidth >= 900 &&
    Boolean(lastExternalPointer) &&
    Date.now() - lastExternalPointer.time < 60000;

  const posStyle =
    positionedCoords && typeof window !== 'undefined' && window.innerWidth >= 900
      ? ` style="left:${positionedCoords.left}px;top:${positionedCoords.top}px;"`
      : '';
  const posClass = posStyle ? ' is-positioned' : '';

  const stageHtml = isOpen
    ? `<section class="fleckshi-stage${posClass}" id="fleckshiStage"${posStyle} role="dialog" aria-modal="false" aria-labelledby="fleckshiCloudTitle">` +
      `<div class="fleckshi-cloud">` +
      `<div class="fleckshi-cloud-head">` +
      `<span class="fleckshi-step-pill">${escapeHtml(vm.pill)}</span>` +
      `<div class="fleckshi-cloud-controls">` +
      `<button type="button" class="fleckshi-mini-btn" id="fleckshiPauseTypingBtn" aria-pressed="${Boolean(
        prefs.typingPaused
      )}" title="Pause or resume typing effect">${prefs.typingPaused ? 'Resume' : 'Pause'}</button>` +
      (posStyle
        ? `<button type="button" class="fleckshi-mini-btn" id="fleckshiDockBtn" title="Dock to corner">Dock</button>`
        : canMoveNearClick
          ? `<button type="button" class="fleckshi-mini-btn" id="fleckshiNearClickBtn" title="Move near last click">Near</button>`
          : '') +
      `<button type="button" class="fleckshi-mini-btn" id="fleckshiSnoozeBtn" title="Snooze reminders for 30 minutes">30m</button>` +
      `<button type="button" class="fleckshi-mini-btn" id="fleckshiDismissBtn" aria-label="Dismiss Fleckshi help" title="Dismiss">&times;</button>` +
      `</div>` +
      `</div>` +
      `<div class="fleckshi-cloud-title-row">` +
      `<h2 class="fleckshi-cloud-title" id="fleckshiCloudTitle">${escapeHtml(vm.title)}</h2>` +
      `</div>` +
      `<p class="fleckshi-cloud-copy" id="fleckshiTypedCopy"></p>` +
      (vm.sub
        ? `<p class="fleckshi-cloud-sub" id="fleckshiContextSummary">${escapeHtml(vm.sub)}</p>`
        : '') +
      `<div class="fleckshi-sr-only" id="fleckshiSrLive" role="status" aria-live="polite"></div>` +
      renderCloudBodyExtras() +
      `</div>` +
      `<button type="button" class="fleckshi-character-dock" id="fleckshiDockToggleBtn" aria-expanded="true" title="Hide Fleckshi help">` +
      renderPortraitHtml('md') +
      `<div class="fleckshi-character-meta">` +
      `<span class="fleckshi-name">Fleckshi</span>` +
      `<span class="fleckshi-dock-state" id="fleckshiDockState">${escapeHtml(formatDockStatus())}</span>` +
      `</div>` +
      `</button>` +
      `</section>`
    : `<button type="button" class="fleckshi-launcher" id="fleckshiLauncherBtn" aria-expanded="false" aria-controls="fleckshiStage" title="Open Fleckshi Help Guide">` +
      renderPortraitHtml('sm') +
      `<span>${escapeHtml(launcherLabel)}</span>` +
      `</button>`;

  rootEl.innerHTML = stageHtml;

  attachGuideDomEvents();

  if (isOpen) {
    if (restartTyping) {
      startTypingMessage(vm.body);
    } else {
      fullCopyText = String(vm.body || '');
      if (isReducedTypingMode()) {
        isTyping = false;
        typedLength = fullCopyText.length;
      }
      updateTypedTextDom();
    }
  } else {
    clearTypingTimer();
  }
}

function goToMode(mode, emote = 'idle', { custom = null, restartTyping = true, guide = true } = {}) {
  currentMode = mode;
  currentEmote = emote;
  customMessage = custom;
  if (mode !== 'add-subject') {
    pendingConfirmName = '';
    subjectFeedback = null;
  }
  if (guide && !custom) {
    const modeSpec = getModeGuideSpec(mode);
    if (modeSpec) {
      guideToTarget(modeSpec.selector, { spotlight: modeSpec.spotlight });
    }
  }
  renderGuideDom({ restartTyping });
}

function closeBubble({ persistDismiss = false, snoozeMs = 0, restoreFocus = false } = {}) {
  if (customMessage?.showEnterFocusBtn) {
    focusTipDismissedInSession = true;
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(FOCUS_TIP_SESSION_KEY, '1');
      }
    } catch {
      // ignore
    }
  }
  clearTypingTimer();
  clearSpotlightHighlight();
  isTyping = false;
  isOpen = false;
  positionedCoords = null;
  if (persistDismiss) {
    prefs = saveFleckshiPrefs({ dismissed: true, pausedUntil: null });
  } else if (snoozeMs > 0) {
    prefs = saveFleckshiPrefs({ pausedUntil: Date.now() + snoozeMs });
  }
  renderGuideDom({ restartTyping: false });
  if (restoreFocus) {
    rootEl?.querySelector('#fleckshiLauncherBtn')?.focus({ preventScroll: true });
  }
}

async function handleOpenLearn(fromSuggestion = false) {
  currentEmote = 'loading';
  customMessage = {
    pill: fromSuggestion ? 'Study Notes' : '5/5 · Learn',
    title: 'Opening Notebook → Learn...',
    body: 'Loading your subject Notebook and switching to Learn.'
  };
  renderGuideDom({ restartTyping: true });

  const res =
    typeof actions.openNotebookLearn === 'function'
      ? await actions.openNotebookLearn('notes')
      : { ok: false, reason: 'unavailable', message: 'Notebook action is unavailable right now.' };

  if (!res?.ok) {
    currentEmote = res?.reason === 'no-subject' ? 'curious' : 'confused';
    customMessage = {
      pill: 'Could not open Learn',
      title: res?.reason === 'no-subject' ? 'Add a subject first' : 'Learn did not open yet',
      body:
        res?.message ||
        'Please select or add a subject first so Notebook knows which syllabus to open.',
      showAddSubjectBtn: res?.reason === 'no-subject'
    };
    renderGuideDom({ restartTyping: true });
    return;
  }

  guideToTarget('#nbTab_learn, #nbEmptyGenerateBtn, #nbSplitMainBtn');
  if (!prefs.onboardingCompleted && !fromSuggestion) {
    prefs = saveFleckshiPrefs({ onboardingCompleted: true });
  }
  currentEmote = 'helping';
  customMessage = {
    pill: 'Learn Confirmed',
    title: 'How to generate Notes',
    body:
      'Pick a scope and grounding mode ("From my sources" or "Syllabus-guided"), then click Generate. Use the top-right AI button to set your Gemini key.',
    sub: 'Notes, Summary, Study Guide, FAQ, Glossary, Timeline & Mind Map live here.'
  };
  renderGuideDom({ restartTyping: true });
}

function handleSuggestion(suggestId) {
  customMessage = null;
  if (suggestId === 'add-subject') {
    returnModeAfterAdd = 'hub';
    subjectFeedback = null;
    pendingConfirmName = '';
    goToMode('add-subject', 'curious');
    setTimeout(() => rootEl?.querySelector('#fleckshiSubjectInput')?.focus(), 0);
    return;
  }

  if (suggestId === 'organize-topics') {
    const res = actions.navigateTo?.('subject') || { ok: false };
    if (!res.ok) {
      goToMode('hub', 'confused', {
        custom: {
          pill: 'Navigation Check',
          title: 'Could not open Ledger',
          body: 'Please select or create a subject from the left sidebar first.'
        }
      });
      return;
    }
    const hasSubject = Boolean(snapshot?.subjects?.length);
    if (hasSubject) {
      guideToTarget('#addTopicForm, #openBulkImportBtn');
    } else {
      guideToTarget('#addSubjectForm');
    }
    goToMode('hub', hasSubject ? 'helping' : 'curious', {
      custom: {
        pill: 'Ledger Confirmed',
        title: hasSubject ? 'Organizing Topics' : 'Add your first subject',
        body: hasSubject
          ? 'Pick a chapter next to "Add Topic", paste multi-line syllabi or use Bulk Import, and click "⋯" on any topic for Focus, Notes & Doubts, or Delete.'
          : 'Your Ledger has no subjects yet. Add one first to track topics and chapters.',
        showAddSubjectBtn: !hasSubject
      }
    });
    return;
  }

  if (suggestId === 'due-today') {
    const res = actions.navigateTo?.('today') || { ok: false };
    if (!res.ok) {
      goToMode('hub', 'error', {
        custom: {
          pill: 'Navigation Check',
          title: 'Could not open Today',
          body: 'Try clicking Today in the left sidebar.'
        }
      });
      return;
    }
    guideToTarget('[data-nav="today"]');
    const due = Number(snapshot?.dueCount) || 0;
    goToMode('hub', due > 0 ? 'focused' : 'relieved', {
      custom: {
        pill: 'Today Confirmed',
        title: due > 0 ? `${due} topic${due === 1 ? '' : 's'} due today` : 'All caught up',
        body:
          due > 0
            ? 'Click "Test Recall" on a due card, then rate Forgot, Good, or Easy to schedule your next spaced review.'
            : 'No spaced-revision items are due today. Mark any topic "Read Once" in Ledger to start the +1d pipeline.'
      }
    });
    return;
  }

  if (suggestId === 'start-focus') {
    const res = actions.navigateTo?.('focus') || { ok: false };
    if (!res.ok) {
      goToMode('hub', 'error', {
        custom: {
          pill: 'Navigation Check',
          title: 'Could not open Focus',
          body: 'Try clicking Focus in the left sidebar.'
        }
      });
      return;
    }
    guideToTarget('#chronoMainWrap');
    goToMode('hub', 'focused', {
      custom: {
        pill: 'Focus Confirmed',
        title: 'Using the Chrono Dial',
        body:
          'Drag the outer ring or pick a preset (5–120m), optionally choose ambient audio, and press Start or the center star.'
      }
    });
    return;
  }

  if (suggestId === 'generate-notes') {
    handleOpenLearn(true);
    return;
  }

  if (suggestId === 'replay-tour') {
    prefs = resetFleckshiOnboarding();
    goToMode('intro', 'cheerful');
  }
}

function submitSubjectDraftForReview() {
  const input = rootEl?.querySelector('#fleckshiSubjectInput');
  const raw = (input ? input.value : subjectDraft).replace(/\s+/g, ' ').trim();
  subjectDraft = raw;
  if (!raw) {
    pendingConfirmName = '';
    subjectFeedback = { type: 'error', text: 'Please enter a subject name first.' };
    currentEmote = 'curious';
    renderGuideDom({ restartTyping: false });
    rootEl?.querySelector('#fleckshiSubjectInput')?.focus();
    return;
  }

  const existing = (snapshot?.subjects || []).find(
    (s) => s.name.trim().toLowerCase() === raw.toLowerCase()
  );
  if (existing) {
    pendingConfirmName = '';
    subjectFeedback = {
      type: 'error',
      text: `"${existing.name}" already exists in your Ledger.`,
      existingId: existing.id
    };
    currentEmote = 'confused';
    renderGuideDom({ restartTyping: false });
    return;
  }

  subjectFeedback = null;
  pendingConfirmName = raw;
  currentEmote = 'thinking';
  renderGuideDom({ restartTyping: false });
  rootEl?.querySelector('#fleckshiConfirmAddSubjectBtn')?.focus();
}

function confirmAndAddSubject() {
  const nameToAdd = pendingConfirmName;
  if (!nameToAdd || typeof actions.addSubject !== 'function') return;

  const res = actions.addSubject(nameToAdd);
  if (res?.ok && res.subject) {
    pendingConfirmName = '';
    subjectDraft = '';
    subjectFeedback = {
      type: 'success',
      text: `Added "${res.subject.name}" to your Ledger and opened it.`
    };
    currentEmote = 'success';
    renderGuideDom({ restartTyping: false });
    applySpotlight('[data-subject="' + res.subject.id + '"], #addTopicForm');
    return;
  }

  pendingConfirmName = '';
  subjectFeedback = {
    type: 'error',
    text: res?.message || 'Could not add that subject. Please check the name and try again.',
    existingId: res?.existing?.id
  };
  currentEmote = 'error';
  renderGuideDom({ restartTyping: false });
}

function attachGuideDomEvents() {
  if (!rootEl) return;

  rootEl.querySelector('#fleckshiLauncherBtn')?.addEventListener('click', () => {
    openFleckshiHelp({ source: 'launcher' });
  });

  rootEl.querySelector('#fleckshiDockToggleBtn')?.addEventListener('click', () => {
    closeBubble({ restoreFocus: true });
  });

  rootEl.querySelector('#fleckshiPauseTypingBtn')?.addEventListener('click', () => {
    const nextPaused = !prefs.typingPaused;
    prefs = saveFleckshiPrefs({ typingPaused: nextPaused });
    if (nextPaused && isTyping) {
      clearTypingTimer();
      typedLength = fullCopyText.length;
      isTyping = false;
    }
    renderGuideDom({ restartTyping: false });
  });

  rootEl.querySelector('#fleckshiNearClickBtn')?.addEventListener('click', () => {
    positionedCoords = computeClampedStagePos(lastExternalPointer);
    renderGuideDom({ restartTyping: false });
  });

  rootEl.querySelector('#fleckshiDockBtn')?.addEventListener('click', () => {
    positionedCoords = null;
    renderGuideDom({ restartTyping: false });
  });

  rootEl.querySelector('#fleckshiSnoozeBtn')?.addEventListener('click', () => {
    closeBubble({ snoozeMs: DEFAULT_SNOOZE_MS, restoreFocus: true });
  });

  rootEl.querySelector('#fleckshiDismissBtn')?.addEventListener('click', () => {
    closeBubble({
      persistDismiss: true,
      restoreFocus: true
    });
  });

  rootEl.querySelectorAll('[data-fleckshi-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const act = btn.getAttribute('data-fleckshi-action');
      if (act === 'step-ledger') {
        goToMode('ledger', 'info');
      } else if (act === 'show-ledger') {
        const res = actions.navigateTo?.('subject') || { ok: false };
        if (res.ok) {
          guideToTarget('[data-nav="subject"]');
          currentEmote = 'happy';
          renderGuideDom({ restartTyping: false });
        }
      } else if (act === 'step-add-subject') {
        returnModeAfterAdd = 'notebook';
        goToMode('add-subject', 'curious');
        setTimeout(() => rootEl?.querySelector('#fleckshiSubjectInput')?.focus(), 0);
      } else if (act === 'step-notebook') {
        goToMode('notebook', 'excited');
      } else if (act === 'show-notebook') {
        const res = actions.navigateTo?.('notebook') || { ok: false };
        if (res.ok) {
          guideToTarget('[data-nav="notebook"]');
          currentEmote = 'excited';
          renderGuideDom({ restartTyping: false });
        } else {
          currentEmote = 'confused';
          renderGuideDom({ restartTyping: false });
        }
      } else if (act === 'step-learn') {
        goToMode('learn', 'helping');
      } else if (act === 'open-learn') {
        handleOpenLearn(false);
      } else if (act === 'finish-tour') {
        prefs = saveFleckshiPrefs({ onboardingCompleted: true, dismissed: false, pausedUntil: null });
        goToMode('hub', 'proud');
      } else if (act === 'skip-tour') {
        prefs = saveFleckshiPrefs({ onboardingCompleted: true });
        goToMode('hub', 'pleased');
      } else if (act === 'goto-add-subject') {
        goToMode('add-subject', 'curious');
        setTimeout(() => rootEl?.querySelector('#fleckshiSubjectInput')?.focus(), 0);
      } else if (act === 'goto-hub') {
        goToMode(returnModeAfterAdd === 'notebook' && !prefs.onboardingCompleted ? 'notebook' : 'hub', 'idle');
      } else if (act === 'enter-focus-mode') {
        const cb = pendingFocusEnterCallback;
        pendingFocusEnterCallback = null;
        dismissFleckshiFocusSuggestion();
        if (typeof cb === 'function') {
          cb();
        } else {
          document.getElementById('nbToggleFullscreenBtn')?.click();
        }
      } else if (act === 'dismiss-focus-tip') {
        pendingFocusEnterCallback = null;
        dismissFleckshiFocusSuggestion();
      }
    });
  });

  rootEl.querySelectorAll('[data-fleckshi-suggest]').forEach((btn) => {
    btn.addEventListener('click', () => {
      handleSuggestion(btn.getAttribute('data-fleckshi-suggest'));
    });
  });

  const subjInput = rootEl.querySelector('#fleckshiSubjectInput');
  if (subjInput) {
    subjInput.addEventListener('input', () => {
      subjectDraft = subjInput.value;
      if (pendingConfirmName) {
        pendingConfirmName = '';
      }
    });
  }

  rootEl.querySelector('#fleckshiSubjectForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    submitSubjectDraftForReview();
  });

  rootEl.querySelector('#fleckshiEditSubjectBtn')?.addEventListener('click', () => {
    pendingConfirmName = '';
    currentEmote = 'curious';
    renderGuideDom({ restartTyping: false });
    rootEl?.querySelector('#fleckshiSubjectInput')?.focus();
  });

  rootEl.querySelector('#fleckshiConfirmAddSubjectBtn')?.addEventListener('click', () => {
    confirmAndAddSubject();
  });

  rootEl.querySelectorAll('[data-fleckshi-select-subj]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-fleckshi-select-subj');
      const res = actions.selectSubject?.(id);
      if (res?.ok && res.subject) {
        subjectFeedback = {
          type: 'success',
          text: `Switched to "${res.subject.name}" in Ledger.`
        };
        currentEmote = 'relieved';
        renderGuideDom({ restartTyping: false });
      }
    });
  });
}

function attachGlobalListeners() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (globalAbort) globalAbort.abort();
  globalAbort = new AbortController();
  const sig = globalAbort.signal;

  document.addEventListener(
    'pointerdown',
    (e) => {
      if (rootEl && rootEl.contains(e.target)) return;
      const targetEl =
        e.target instanceof Element
          ? e.target.closest('button, a, input, select, form, [role="button"], [role="tab"]')
          : null;
      lastExternalPointer = {
        x: e.clientX,
        y: e.clientY,
        time: Date.now(),
        rect: targetEl ? targetEl.getBoundingClientRect() : null
      };
    },
    { capture: true, passive: true, signal: sig }
  );

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== 'Escape' || !isOpen) return;
      if (document.querySelector('.modal-backdrop')) return;
      const focusInside = Boolean(rootEl && document.activeElement && rootEl.contains(document.activeElement));
      e.preventDefault();
      closeBubble({ restoreFocus: focusInside });
    },
    { signal: sig }
  );

  window.addEventListener(
    'resize',
    () => {
      if (!isOpen || !positionedCoords) return;
      if (window.innerWidth < 900) {
        positionedCoords = null;
        renderGuideDom({ restartTyping: false });
      } else {
        positionedCoords = computeClampedStagePos(lastExternalPointer);
        renderGuideDom({ restartTyping: false });
      }
    },
    { passive: true, signal: sig }
  );

  document.addEventListener(
    'visibilitychange',
    () => {
      if (document.hidden) {
        clearTypingTimer();
        clearSpotlightHighlight();
        if (isTyping) {
          typedLength = fullCopyText.length;
          isTyping = false;
          updateTypedTextDom();
        }
      }
    },
    { signal: sig }
  );
}

/**
 * Initialize Fleckshi once on document.body so full-app rerenders never disrupt state.
 */
export function initFleckshiGuide(nextActions = {}, initialSnapshot = null) {
  actions = nextActions || {};
  if (initialSnapshot) {
    snapshot = initialSnapshot;
  }

  if (typeof document === 'undefined') return;
  document.body.classList.toggle('fleckshi-in-notebook', snapshot?.activeView === 'notebook');

  if (initialized && rootEl?.isConnected) {
    notifyFleckshiAppChange(snapshot);
    return;
  }

  prefs = loadFleckshiPrefs();
  rootEl = document.getElementById('fleckshiRoot');
  if (!rootEl) {
    rootEl = document.createElement('div');
    rootEl.id = 'fleckshiRoot';
    rootEl.className = 'fleckshi-root';
    document.body.appendChild(rootEl);
  }

  initialized = true;
  attachGlobalListeners();

  if (!prefs.onboardingCompleted && !prefs.dismissed && !isFleckshiSnoozed(prefs)) {
    isOpen = true;
    currentMode = 'intro';
    currentEmote = 'cheerful';
    customMessage = null;
    const introSpec = getModeGuideSpec('intro');
    if (introSpec) guideToTarget(introSpec.selector, { spotlight: introSpec.spotlight });
  } else {
    isOpen = false;
    currentMode = 'hub';
    currentEmote = 'idle';
    customMessage = null;
  }
  lastGuidedView = snapshot?.activeView || 'subject';

  renderGuideDom({ restartTyping: isOpen });

  probeFleckshiSprite().then((result) => {
    if (!initialized || !rootEl?.isConnected) return;
    if (result.available !== spriteStatus.available) {
      spriteStatus = result;
      const dockPortrait = rootEl.querySelector('.fleckshi-character-dock .fleckshi-portrait');
      if (dockPortrait) {
        dockPortrait.outerHTML = renderPortraitHtml('md');
      }
      const launcherPortrait = rootEl.querySelector('#fleckshiLauncherBtn .fleckshi-portrait');
      if (launcherPortrait) {
        launcherPortrait.outerHTML = renderPortraitHtml('sm');
      }
    }
  });
}

/**
 * Sync app view/subject/due counts into Fleckshi without restarting active flows or input focus.
 */
export function notifyFleckshiAppChange(nextSnapshot) {
  if (!nextSnapshot) return;
  const prevView = lastGuidedView;
  snapshot = nextSnapshot;
  const nextView = snapshot?.activeView || 'subject';
  lastGuidedView = nextView;

  if (typeof document !== 'undefined') {
    document.body.classList.toggle('fleckshi-in-notebook', nextView === 'notebook');
  }
  if (!initialized || !rootEl) return;

  const dockStateEl = rootEl.querySelector('#fleckshiDockState');
  if (dockStateEl) {
    dockStateEl.textContent = formatDockStatus();
  }

  if (isOpen && prevView !== nextView && typeof window !== 'undefined' && window.innerWidth >= 900) {
    guideToTarget(getViewGuideSelector(nextView), { spotlight: false });
    const stageEl = rootEl.querySelector('#fleckshiStage');
    if (stageEl && positionedCoords) {
      stageEl.classList.add('is-positioned');
      stageEl.style.left = `${positionedCoords.left}px`;
      stageEl.style.top = `${positionedCoords.top}px`;
    }
  }
}

/**
 * Programmatically open Fleckshi (e.g., from Help button).
 */
export function openFleckshiHelp({ mode = null, nearPointer = false, source = 'api' } = {}) {
  if (!initialized) return;
  prefs = saveFleckshiPrefs({ dismissed: false, pausedUntil: null });
  isOpen = true;
  customMessage = null;
  if (mode) {
    currentMode = mode;
  } else {
    currentMode = prefs.onboardingCompleted ? 'hub' : 'intro';
  }
  currentEmote =
    currentMode === 'intro' ? 'cheerful' : currentMode === 'add-subject' ? 'curious' : 'happy';

  if (
    nearPointer &&
    source !== 'launcher' &&
    lastExternalPointer &&
    Date.now() - lastExternalPointer.time < 5000
  ) {
    positionedCoords = computeClampedStagePos(lastExternalPointer);
  } else {
    const modeSpec = getModeGuideSpec(currentMode);
    if (modeSpec) {
      guideToTarget(modeSpec.selector, { spotlight: modeSpec.spotlight });
    } else {
      guideToTarget(getViewGuideSelector(snapshot?.activeView), { spotlight: false });
    }
  }

  renderGuideDom({ restartTyping: true });

  if (source === 'launcher') {
    const focusTarget = rootEl?.querySelector(
      '#fleckshiSubjectInput, .fleckshi-suggest-btn, .fleckshi-btn-primary, #fleckshiDismissBtn'
    );
    focusTarget?.focus({ preventScroll: true });
  }
}

/**
 * Occasionally suggest Notebook Fullscreen Focus Mode when reading a long note.
 * Never interrupts active typing, open dialogs, onboarding tour steps, or once dismissed in the session.
 */
export function maybeSuggestFleckshiFocusMode({ onEnterFocus = null } = {}) {
  if (!initialized || !rootEl || typeof document === 'undefined') return false;
  if (isFocusTipAlreadySeen()) return false;
  if (isFleckshiSnoozed(prefs)) return false;
  if (isOpen && !prefs.onboardingCompleted) return false;
  if (isOpen && currentMode === 'add-subject') return false;
  if (document.querySelector('.modal-backdrop, .nb-scope-sheet, .nb-shell.is-fullscreen')) return false;

  const activeEl = document.activeElement;
  if (
    activeEl instanceof Element &&
    activeEl.matches('input, textarea, select, [contenteditable="true"]')
  ) {
    return false;
  }

  focusTipDismissedInSession = true;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(FOCUS_TIP_SESSION_KEY, '1');
    }
  } catch {
    // ignore
  }

  pendingFocusEnterCallback = onEnterFocus;
  isOpen = true;
  currentMode = 'hub';
  currentEmote = 'helping';
  // Keep Fleckshi docked at the bottom-right corner so she stays clear of the top-right Focus Mode button and note text
  positionedCoords = null;
  customMessage = {
    pill: 'Reading Tip',
    title: 'Want more room to read?',
    body: 'Switch to Focus Mode to expand this note across the screen and hide extra bars. Press Esc anytime to exit.',
    showEnterFocusBtn: true
  };

  renderGuideDom({ restartTyping: true });
  applySpotlight('#nbToggleFullscreenBtn');
  return true;
}

/**
 * Tear down Fleckshi DOM node, listeners, and timers cleanly.
 */
export function destroyFleckshiGuide() {
  clearTypingTimer();
  clearSpotlightHighlight();
  if (globalAbort) {
    globalAbort.abort();
    globalAbort = null;
  }
  if (rootEl && rootEl.parentNode) {
    rootEl.parentNode.removeChild(rootEl);
  }
  if (typeof document !== 'undefined') {
    document.body.classList.remove('fleckshi-in-notebook');
  }
  rootEl = null;
  initialized = false;
  isOpen = false;
}
