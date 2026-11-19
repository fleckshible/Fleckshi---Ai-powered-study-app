import './styles/tokens.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/views.css';
import './styles/fleckshi.css';

import { getState, setState, replaceState, subscribe, getActiveSubject } from './storage/store.js';
import { createSubject, createTopic } from './storage/schema.js';
import { downloadBackup, parseBackupBundle } from './storage/backup.js';
import { uid } from './utils/uid.js';
import { toDateKey } from './utils/date.js';

import {
  getDueQueue,
  syncSrsOnReadToggle,
  advanceSrsOnRevise,
  advanceSrsWithConfidence
} from './features/spacedRevision.js';
import { recordMarkActivity } from './features/habits.js';
import { parseSyllabusText } from './features/syllabusParser.js';
import { getAudioState, setAudioPreset, subscribeAudio } from './features/audioSynth.js';
import {
  initPomodoroDefaults,
  subscribePomodoro,
  attachPomodoroTopic,
  setPomodoroDurations,
  setPomodoroMinutesFromDial,
  clearCompletedTopicPrompt,
  startPomodoro,
  pausePomodoro,
  resetPomodoro,
  switchPomodoroMode,
  getPomodoroState
} from './features/pomodoro.js';

import { renderSidebar } from './ui/sidebar.js';
import { renderSubjectView } from './ui/subjectView.js';
import { renderTodayView } from './ui/todayView.js';
import { renderDashboardView } from './ui/dashboardView.js';
import { renderFocusView } from './ui/focusView.js';
import { renderPomodoroWidget, renderChronoDialSvg, renderDigitSpans } from './ui/pomodoroWidget.js';
import { renderImportModal } from './ui/importModal.js';
import { renderBackupModal } from './ui/backupModal.js';

import {
  animateMarkSpring,
  animateTopicAdd,
  animateTopicRemove,
  animatePageSwitch,
  animateDigitFlip,
  animateDockMorph,
  observeDashboardReveals
} from './animations/motionEffects.js';
import {
  initAnimeEngine,
  cleanupViewScope,
  runInViewScope,
  animateHeroHeadline,
  initMagneticTilt,
  initTopicDragReorder,
  initBezelDraggable,
  initThemeSwitchDraggable,
  animateChronoSvg,
  syncChronoSubTimer,
  animateChronoStartShockwave,
  runLayoutTransition,
  initScrollReveals,
  initAmbientWaapiPulses,
  animateTopicStagger,
  animateProgressRings,
  animateCounters,
  animateTopicCelebration,
  animateDashboardCharts,
  animateParticleBurst,
  animatePipelineBeam,
  animateRecallCardSwipe
} from './animations/animeEffects.js';
import { applyFxAttribute } from './animations/fxController.js';
import { prefersReducedMotion } from './animations/reducedMotion.js';
import {
  initFleckshiGuide,
  notifyFleckshiAppChange,
  openFleckshiHelp
} from './ui/fleckshiGuide.js';

const THEME_KEY = 'revision-ledger-theme';
const expandedTopicIds = new Set();

let modalState = {
  importOpen: false,
  importRawText: '',
  importPreview: null,
  backupOpen: false
};

let pendingConfidence = null; // { subjectId, topicId, topicName }
let xpRulesOpen = false;
let topicFilter = 'all';
let topicSort = 'manual';
let selectedChapter = 'General';
const collapsedChapters = new Set();
let pastedLines = [];
const revealedRecallIds = new Set();
let lastAnimatedView = null;
let lastAnimatedSubjectId = null;
let lastAddedTopicId = null;
let lastToggledMark = null;
let lastCelebratedTopicId = null;
let prevDigitsStr = '';
let notebookModule = null;
let notebookModulePromise = null;
let fleckshiSpotlightTimer = null;
let fleckshiSpotlightEl = null;

function addSubjectFromName(rawName) {
  const name = String(rawName || '').replace(/\s+/g, ' ').trim();
  if (!name) {
    return { ok: false, reason: 'empty', message: 'Please enter a subject name.' };
  }
  const existing = (getState().subjects || []).find(
    (s) => s.name.trim().toLowerCase() === name.toLowerCase()
  );
  if (existing) {
    return {
      ok: false,
      reason: 'duplicate',
      existing,
      message: `"${existing.name}" already exists in your Ledger.`
    };
  }
  const subject = createSubject(name, { id: uid() });
  setState((prev) => ({
    ...prev,
    subjects: [...prev.subjects, subject],
    activeSubjectId: subject.id,
    activeView: 'subject'
  }));
  const confirmed = (getState().subjects || []).find((s) => s.id === subject.id) || null;
  return { ok: Boolean(confirmed), subject: confirmed };
}

function selectSubjectById(subjectId) {
  const existing = (getState().subjects || []).find((s) => s.id === subjectId);
  if (!existing) return { ok: false, reason: 'missing' };
  setState((prev) => ({
    ...prev,
    activeSubjectId: existing.id,
    activeView: 'subject'
  }));
  const current = getState();
  return {
    ok: current.activeSubjectId === existing.id && current.activeView === 'subject',
    subject: existing
  };
}

function navigateAppView(viewId) {
  const allowed = ['subject', 'focus', 'today', 'dashboard', 'notebook'];
  if (!allowed.includes(viewId)) return { ok: false, reason: 'invalid-view' };
  setState((prev) => ({ ...prev, activeView: viewId }));
  const current = getState();
  return { ok: current.activeView === viewId, view: current.activeView };
}

async function openNotebookLearnForGuide(learnView = 'notes') {
  const current = getState();
  const subjectId = current.activeSubjectId || current.subjects?.[0]?.id || null;
  if (!subjectId) {
    return {
      ok: false,
      reason: 'no-subject',
      message: 'Add at least one subject first so Study Notebook has a workspace to open.'
    };
  }
  if (current.activeView !== 'notebook' || current.activeSubjectId !== subjectId) {
    setState((prev) => ({
      ...prev,
      activeSubjectId: subjectId,
      activeView: 'notebook'
    }));
  }
  try {
    const mod = await ensureNotebookModule();
    if (getState().activeView !== 'notebook') {
      return { ok: false, reason: 'navigated-away', message: 'Left Notebook before it finished loading.' };
    }
    await mod.mountNotebookView(subjectId);
    if (getState().activeView !== 'notebook') {
      return { ok: false, reason: 'navigated-away', message: 'Left Notebook before switching to Learn.' };
    }
    const navRes = await mod.navigateNotebookTo('learn', learnView);
    notifyFleckshiAppChange(getFleckshiSnapshot());
    return navRes;
  } catch (err) {
    return { ok: false, reason: 'load-error', message: err?.message || 'Notebook failed to load.' };
  }
}

function highlightElementForGuide(selector) {
  if (fleckshiSpotlightTimer !== null) {
    clearTimeout(fleckshiSpotlightTimer);
    fleckshiSpotlightTimer = null;
  }
  if (fleckshiSpotlightEl) {
    fleckshiSpotlightEl.classList.remove('fleckshi-spotlight-ring');
    fleckshiSpotlightEl = null;
  }
  document.querySelectorAll('.fleckshi-spotlight-ring').forEach((el) => {
    el.classList.remove('fleckshi-spotlight-ring');
  });
  const target = selector ? document.querySelector(selector) : null;
  if (!target) return { ok: false };
  fleckshiSpotlightEl = target;
  target.classList.add('fleckshi-spotlight-ring');
  try {
    target.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'nearest'
    });
  } catch {
    // ignore
  }
  fleckshiSpotlightTimer = setTimeout(() => {
    if (fleckshiSpotlightEl) {
      fleckshiSpotlightEl.classList.remove('fleckshi-spotlight-ring');
      fleckshiSpotlightEl = null;
    }
    fleckshiSpotlightTimer = null;
  }, 2400);
  return { ok: true };
}

function getFleckshiSnapshot() {
  const state = getState();
  const due = getDueQueue(state);
  return {
    activeView: state.activeView || 'subject',
    subjects: state.subjects || [],
    activeSubject: getActiveSubject(),
    dueCount: due.totalDue || 0,
    overdueCount: due.overdue?.length || 0,
    pomodoroRunning: Boolean(getPomodoroState()?.running)
  };
}
const SIDEBAR_COLLAPSED_KEY = 'revision_ledger_sidebar_collapsed_v1';
let sidebarCollapsed = (() => {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
})();

async function ensureNotebookModule() {
  if (notebookModule) return notebookModule;
  if (!notebookModulePromise) {
    notebookModulePromise = import('./ui/notebookView.js').then((mod) => {
      notebookModule = mod;
      return mod;
    });
  }
  return notebookModulePromise;
}

function getTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}

function setTheme(next, rerender = false) {
  const safe = next === 'light' ? 'light' : 'dark';
  const root = document.documentElement;
  root.classList.add('theme-crossfade');
  root.setAttribute('data-theme', safe);
  localStorage.setItem(THEME_KEY, safe);
  if (rerender) renderApp();
  setTimeout(() => root.classList.remove('theme-crossfade'), 320);
}

function applySavedTheme() {
  const saved = localStorage.getItem(THEME_KEY) || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
}

function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark', true);
}

function renderApp() {
  if (window.__chronoBezelDragging) return;
  const app = document.getElementById('app');
  if (!app) return;

  cleanupViewScope();
  if (notebookModule) {
    notebookModule.unmountNotebookView();
  }

  const state = getState();
  const activeSubject = getActiveSubject();
  const pomoState = getPomodoroState();
  const audioState = getAudioState();

  let mainHtml = '';
  if (state.activeView === 'today') {
    mainHtml = renderTodayView(state, revealedRecallIds);
  } else if (state.activeView === 'dashboard') {
    mainHtml = renderDashboardView(state, xpRulesOpen);
  } else if (state.activeView === 'focus') {
    mainHtml = renderFocusView(state, pomoState, audioState);
  } else if (state.activeView === 'notebook') {
    mainHtml =
      `<main class="page" data-page-view="notebook">` +
      `<div id="notebookMount">` +
      `<div class="empty-state">` +
      `<h2 class="serif">Loading Study Notebook<span class="title-dot"></span></h2>` +
      `<p>Initializing Gemini BYOK workspace...</p>` +
      `</div>` +
      `</div>` +
      `</main>`;
  } else {
    mainHtml = renderSubjectView(activeSubject, expandedTopicIds, pendingConfidence, {
      filter: topicFilter,
      sort: topicSort,
      selectedChapter,
      collapsedChapters,
      pastedLines
    });
  }

  let modalHtml = '';
  if (modalState.importOpen) {
    modalHtml = renderImportModal(modalState.importPreview, modalState.importRawText);
  } else if (modalState.backupOpen) {
    modalHtml = renderBackupModal(state);
  }

  app.dataset.sidebarCollapsed = sidebarCollapsed ? 'true' : 'false';
  document.body.classList.toggle('fleckshi-in-notebook', state.activeView === 'notebook');
  app.innerHTML =
    renderSidebar(state, getTheme(), { collapsed: sidebarCollapsed }) +
    mainHtml +
    `<div id="pomodoroMount">${renderPomodoroWidget(pomoState, state.activeView)}</div>` +
    `<div id="modalMount">${modalHtml}</div>`;

  attachEvents();
  runPostRenderAnimations(state, pomoState);
  notifyFleckshiAppChange(getFleckshiSnapshot());

  if (state.activeView === 'notebook') {
    ensureNotebookModule()
      .then((mod) => {
        if (getState().activeView === 'notebook') {
          return mod.mountNotebookView(getState().activeSubjectId);
        }
      })
      .catch((err) => {
        const mount = document.getElementById('notebookMount');
        if (mount) {
          mount.innerHTML = `<div class="empty-state"><h2 class="serif">Notebook failed to load</h2><p id="nbLoadErr"></p></div>`;
          const errEl = mount.querySelector('#nbLoadErr');
          if (errEl) errEl.textContent = err?.message || 'Unexpected load error.';
        }
      });
  }
}

function renderModalOnly() {
  const mount = document.getElementById('modalMount');
  if (!mount) return;
  const state = getState();
  if (modalState.importOpen) {
    mount.innerHTML = renderImportModal(modalState.importPreview, modalState.importRawText);
    attachModalEvents();
  } else if (modalState.backupOpen) {
    mount.innerHTML = renderBackupModal(state);
    attachModalEvents();
  } else {
    mount.innerHTML = '';
  }
}

function renderPomodoroOnly(pomoState) {
  const state = getState();
  const nextMins = Math.floor(pomoState.secondsLeft / 60);
  const nextSecs = pomoState.secondsLeft % 60;
  const nextDigitsStr = `${String(nextMins).padStart(2, '0')}:${String(nextSecs).padStart(2, '0')}`;

  if (state.activeView === 'focus') {
    const wrap = document.getElementById('chronoMainWrap');
    const readout = document.getElementById('chronoMainReadout');
    const statusPill = document.getElementById('chronoStatusPill');
    const isBreak = pomoState.mode === 'break';

    if (readout) {
      readout.innerHTML = renderDigitSpans(pomoState.secondsLeft);
    }
    if (statusPill) {
      statusPill.className = `chrono-status-pill${isBreak ? ' break' : ''}`;
      statusPill.textContent = pomoState.running
        ? isBreak
          ? 'BREAK ACTIVE'
          : 'FOCUSING'
        : isBreak
          ? 'BREAK READY'
          : 'READY TO DIAL · DRAG BEZEL';
    }

    if (wrap) {
      if (!window.__chronoBezelDragging) {
        wrap.innerHTML = renderChronoDialSvg(pomoState, 320, true);
        attachChronoInteractiveEvents();
        animateChronoSvg(
          wrap,
          1 - pomoState.secondsLeft / Math.max(1, pomoState.totalSeconds)
        );
        syncChronoSubTimer(pomoState.running, wrap);
      }
    } else {
      renderApp();
      return;
    }
  } else {
    const mount = document.getElementById('pomodoroMount');
    if (!mount) return;
    mount.innerHTML = renderPomodoroWidget(pomoState, state.activeView);
    attachPomodoroEvents();
    syncChronoSubTimer(pomoState.running, mount);
  }

  // Flip only changed digits via motion.dev
  if (prevDigitsStr && prevDigitsStr !== nextDigitsStr) {
    const digitEls = document.querySelectorAll('.flip-digit');
    digitEls.forEach((el) => {
      const pos = Number(el.getAttribute('data-digit-pos'));
      if (prevDigitsStr[pos] !== nextDigitsStr[pos]) {
        animateDigitFlip(el);
      }
    });
  }
  prevDigitsStr = nextDigitsStr;

  if (pomoState.lastCompletedTopic) {
    pendingConfidence = pomoState.lastCompletedTopic;
    animateParticleBurst(document.getElementById('chronoMainWrap') || document.getElementById('chronoDock'));
    clearCompletedTopicPrompt();
    renderApp();
  }
}

function runPostRenderAnimations(state, pomoState) {
  const pageEl = document.querySelector('.page');
  const viewChanged =
    lastAnimatedView !== state.activeView ||
    (state.activeView === 'subject' && lastAnimatedSubjectId !== state.activeSubjectId);

  runInViewScope(document.getElementById('app'), () => {
    initAmbientWaapiPulses(document);
    initMagneticTilt(document);

    if (viewChanged && pageEl) {
      animatePageSwitch(pageEl);
      animateHeroHeadline(pageEl);
      initScrollReveals(pageEl);

      if (state.activeView === 'subject') {
        animateTopicStagger(document.getElementById('topicList'));
      } else if (state.activeView === 'dashboard') {
        observeDashboardReveals();
        animateDashboardCharts(pageEl);
      } else if (state.activeView === 'focus') {
        const wrap = document.getElementById('chronoMainWrap');
        if (wrap) {
          animateChronoSvg(
            wrap,
            1 - pomoState.secondsLeft / Math.max(1, pomoState.totalSeconds)
          );
          syncChronoSubTimer(pomoState.running, wrap);
        }
      }
    }

    if (state.activeView === 'subject' && topicSort === 'manual') {
      document.querySelectorAll('.topic-list').forEach((listEl) => {
        const listItems = Array.from(listEl.querySelectorAll('.topic-item'));
        initTopicDragReorder(listEl, (fromIdx, toIdx) => {
          const fromId = listItems[fromIdx]?.getAttribute('data-topic-row');
          const toId = listItems[toIdx]?.getAttribute('data-topic-row');
          if (!fromId || !toId) return;
          runLayoutTransition('#topicList', () => {
            setState((prev) => {
              const subj = prev.subjects.find((s) => s.id === prev.activeSubjectId);
              if (!subj || !subj.topics?.length) return prev;
              const realFrom = subj.topics.findIndex((t) => t.id === fromId);
              const realTo = subj.topics.findIndex((t) => t.id === toId);
              if (realFrom === -1 || realTo === -1) return prev;
              const [moved] = subj.topics.splice(realFrom, 1);
              subj.topics.splice(realTo, 0, moved);
              return prev;
            });
          });
        });
      });
    }
  });

  if (state.activeView !== 'focus') {
    syncChronoSubTimer(pomoState.running, document.getElementById('pomodoroMount'));
  }

  animateProgressRings(document);
  animateCounters(pageEl || document);

  if (lastAddedTopicId) {
    const row = document.querySelector(`[data-topic-row="${lastAddedTopicId}"]`);
    if (row) animateTopicAdd(row);
    lastAddedTopicId = null;
  }

  if (lastToggledMark) {
    const btn = document.querySelector(
      `.mark-btn[data-topic="${lastToggledMark.topicId}"][data-level="${lastToggledMark.level}"]`
    );
    if (btn) animateMarkSpring(btn);
    lastToggledMark = null;
  }

  if (lastCelebratedTopicId) {
    const row = document.querySelector(`[data-topic-row="${lastCelebratedTopicId}"]`);
    if (row) animateTopicCelebration(row);
    lastCelebratedTopicId = null;
  }

  lastAnimatedView = state.activeView;
  lastAnimatedSubjectId = state.activeSubjectId;
}

function attachChronoInteractiveEvents() {
  const bezel = document.querySelector('[data-chrono-bezel]');
  const svgEl = document.getElementById('chronoMainSvg');
  if (bezel && svgEl) {
    initBezelDraggable(
      bezel,
      svgEl,
      (mins, step, commit) => setPomodoroMinutesFromDial(mins, step, commit),
      () => {
        if (getPomodoroState().running) pausePomodoro();
      }
    );
  }

  const star = document.getElementById('chronoStarTrigger');
  if (star) {
    const triggerStar = () => {
      const action = star.getAttribute('data-pomo');
      if (action === 'start') {
        startPomodoro();
        animateChronoStartShockwave(document.getElementById('chronoMainWrap'));
      } else {
        pausePomodoro();
      }
    };
    star.addEventListener('click', triggerStar);
    star.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        triggerStar();
      }
    });
  }
}

function attachPomodoroEvents() {
  attachChronoInteractiveEvents();

  document.querySelectorAll('[data-pomo]').forEach((btn) => {
    if (btn.id === 'chronoStarTrigger') return;
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-pomo');
      if (action === 'start') {
        startPomodoro();
        animateChronoStartShockwave(document.getElementById('chronoMainWrap') || document);
      } else if (action === 'pause') {
        pausePomodoro();
      } else if (action === 'reset') {
        resetPomodoro();
      } else if (action === 'switch') {
        switchPomodoroMode(getPomodoroState().mode === 'focus' ? 'break' : 'focus');
      }
    });
  });

  document.querySelectorAll('[data-pomo-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const mins = Number(btn.getAttribute('data-pomo-preset'));
      const { pomodoro } = getState();
      setPomodoroDurations(mins, pomodoro?.breakMinutes || 5);
    });
  });

  document.querySelectorAll('[data-audio-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setAudioPreset(btn.getAttribute('data-audio-preset'));
    });
  });

  document.getElementById('expandChronoBtn')?.addEventListener('click', () => {
    runLayoutTransition('.app', () => {
      setState((prev) => ({ ...prev, activeView: 'focus' }));
    });
  });

  document.getElementById('collapseChronoBtn')?.addEventListener('click', () => {
    runLayoutTransition('.app', () => {
      setState((prev) => ({ ...prev, activeView: 'subject' }));
    });
    const dock = document.getElementById('chronoDock');
    if (dock) animateDockMorph(dock);
  });
}

function attachModalEvents() {
  // Bulk Import Modal
  document.getElementById('closeImportModalBtn')?.addEventListener('click', () => {
    modalState.importOpen = false;
    renderModalOnly();
  });

  document.getElementById('previewImportBtn')?.addEventListener('click', async () => {
    const raw = document.getElementById('bulkImportText')?.value || '';
    modalState.importRawText = raw;
    modalState.importPreview = await parseSyllabusText(raw);
    renderModalOnly();
  });

  document.getElementById('confirmImportBtn')?.addEventListener('click', () => {
    const checked = Array.from(document.querySelectorAll('.import-preview-cb:checked')).map(
      (cb) => modalState.importPreview[Number(cb.getAttribute('data-idx'))]
    );
    modalState.importOpen = false;
    if (!checked.length) {
      renderModalOnly();
      return;
    }
    setState((prev) => {
      const subj = prev.subjects.find((s) => s.id === prev.activeSubjectId);
      if (subj) {
        checked.forEach((name) => subj.topics.push(createTopic(name, { id: uid() })));
      }
      return prev;
    });
  });

  // Backup & Settings Modal
  document.getElementById('closeBackupModalBtn')?.addEventListener('click', () => {
    modalState.backupOpen = false;
    renderModalOnly();
  });

  document.getElementById('saveGoalBtn')?.addEventListener('click', () => {
    const val = Number(document.getElementById('dailyGoalInput')?.value || 5);
    setState((prev) => ({ ...prev, dailyGoal: Math.max(1, Math.min(50, val)) }));
  });

  document.getElementById('exportJsonBtn')?.addEventListener('click', async () => {
    const includeNb = Boolean(document.getElementById('includeNotebooksBackupCb')?.checked);
    let notebooks = null;
    if (includeNb) {
      const { getAllNotebooks } = await import('./storage/notebookStore.js');
      notebooks = await getAllNotebooks();
    }
    downloadBackup(getState(), notebooks);
  });

  document.getElementById('importJsonInput')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const bundle = parseBackupBundle(text);
      if (bundle.notebooks?.length) {
        const { importNotebooksBulk } = await import('./storage/notebookStore.js');
        await importNotebooksBulk(bundle.notebooks);
      }
      modalState.backupOpen = false;
      replaceState(bundle.state);
    } catch (err) {
      const msg = document.getElementById('backupStatusMsg');
      if (msg) {
        msg.style.color = 'var(--red)';
        msg.textContent = err.message || 'Invalid backup file.';
      }
    }
  });
}

function attachEvents() {
  attachPomodoroEvents();
  attachModalEvents();

  // Navigation tabs & sidebar collapse rail
  document.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.getAttribute('data-nav');
      setState((prev) => ({ ...prev, activeView: view }));
    });
  });

  document.getElementById('toggleSidebarCollapseBtn')?.addEventListener('click', () => {
    sidebarCollapsed = !sidebarCollapsed;
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
    } catch {
      // ignore storage failure
    }
    renderApp();
  });

  // Draggable Day/Night Theme Switch & Backup button
  initThemeSwitchDraggable(
    document.getElementById('themeSwitchTrack'),
    document.getElementById('themeSwitchThumb'),
    getTheme,
    setTheme
  );
  document.getElementById('openBackupBtn')?.addEventListener('click', () => {
    modalState.backupOpen = true;
    renderModalOnly();
  });

  // Dashboard XP Rules toggle & empty state CTA
  document.getElementById('toggleXpRulesBtn')?.addEventListener('click', () => {
    xpRulesOpen = !xpRulesOpen;
    renderApp();
  });
  document.getElementById('emptyAddSubjectCta')?.addEventListener('click', () => {
    document.getElementById('newSubjectInput')?.focus();
  });

  // Add subject
  document.getElementById('addSubjectForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('newSubjectInput');
    const res = addSubjectFromName(input?.value);
    if (!res.ok && res.reason === 'duplicate' && res.existing) {
      selectSubjectById(res.existing.id);
      if (input) input.value = '';
    }
  });

  // Select subject
  document.querySelectorAll('[data-subject]').forEach((el) => {
    const select = () => {
      const id = el.getAttribute('data-subject');
      setState((prev) => ({
        ...prev,
        activeSubjectId: id,
        activeView: prev.activeView === 'notebook' ? 'notebook' : 'subject'
      }));
    };
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-del-subject]')) return;
      select();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        select();
      }
    });
  });

  // Delete subject
  document.querySelectorAll('[data-del-subject]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = el.getAttribute('data-del-subject');
      const state = getState();
      const subj = state.subjects.find((s) => s.id === id);
      if (!confirm(`Delete "${subj ? subj.name : 'this subject'}" and all its topics?`)) return;
      setState((prev) => {
        const subjects = prev.subjects.filter((s) => s.id !== id);
        const activeSubjectId =
          prev.activeSubjectId === id ? subjects[0]?.id || null : prev.activeSubjectId;
        return { ...prev, subjects, activeSubjectId };
      });
    });
  });

  // Exam date change / clear
  document.getElementById('examDateInput')?.addEventListener('change', (e) => {
    const val = e.target.value || null;
    setState((prev) => {
      const subj = prev.subjects.find((s) => s.id === prev.activeSubjectId);
      if (subj) subj.examDate = val;
      return prev;
    });
  });

  document.getElementById('clearExamDateBtn')?.addEventListener('click', () => {
    setState((prev) => {
      const subj = prev.subjects.find((s) => s.id === prev.activeSubjectId);
      if (subj) subj.examDate = null;
      return prev;
    });
  });

  // Chapter select, topic add, and multi-line paste detection
  document.getElementById('topicChapterSelect')?.addEventListener('change', (e) => {
    selectedChapter = e.target.value || 'General';
  });

  document.getElementById('newTopicInput')?.addEventListener('paste', async (e) => {
    const text = e.clipboardData?.getData('text') || '';
    if (!text.includes('\n')) return;
    const parsed = await parseSyllabusText(text);
    if (parsed.length > 1) {
      e.preventDefault();
      pastedLines = parsed;
      renderApp();
    }
  });

  document.getElementById('quickAddPastedBtn')?.addEventListener('click', () => {
    const lines = [...pastedLines];
    pastedLines = [];
    if (!lines.length) {
      renderApp();
      return;
    }
    setState((prev) => {
      const subj = prev.subjects.find((s) => s.id === prev.activeSubjectId);
      if (subj) {
        lines.forEach((name) =>
          subj.topics.push(createTopic(name, { id: uid(), chapter: selectedChapter }))
        );
      }
      return prev;
    });
  });

  document.getElementById('dismissPasteBtn')?.addEventListener('click', () => {
    pastedLines = [];
    renderApp();
  });

  document.getElementById('addTopicForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('newTopicInput');
    const name = input?.value.trim();
    if (!name) return;
    const topic = createTopic(name, { id: uid(), chapter: selectedChapter });
    lastAddedTopicId = topic.id;
    pastedLines = [];
    setState((prev) => {
      const subj = prev.subjects.find((s) => s.id === prev.activeSubjectId);
      if (subj) subj.topics.push(topic);
      return prev;
    });
    document.getElementById('newTopicInput')?.focus();
  });

  // Topic filters, sorting & collapsible chapters
  document.querySelectorAll('[data-topic-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      topicFilter = btn.getAttribute('data-topic-filter') || 'all';
      runLayoutTransition('#topicList', renderApp);
    });
  });

  document.getElementById('topicSortSelect')?.addEventListener('change', (e) => {
    topicSort = e.target.value || 'manual';
    renderApp();
  });

  document.querySelectorAll('[data-toggle-chapter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ch = btn.getAttribute('data-toggle-chapter');
      if (collapsedChapters.has(ch)) collapsedChapters.delete(ch);
      else collapsedChapters.add(ch);
      renderApp();
    });
  });

  // Toggle marks (Subject View + Focus Studio inline marks)
  const handleMarkToggle = (subjectId, topicId, level, btnEl) => {
    const today = toDateKey();
    const rowEl = btnEl?.closest?.('[data-topic-row]') || null;
    setState((prev) => {
      const subj = prev.subjects.find((s) => s.id === subjectId);
      const topic = subj?.topics.find((t) => t.id === topicId);
      if (!topic) return prev;

      const nextVal = !topic[level];
      topic[level] = nextVal;

      if (level === 'read') {
        syncSrsOnReadToggle(topic, nextVal, today);
      } else if (level === 'revised' && nextVal) {
        advanceSrsOnRevise(topic, today);
        pendingConfidence = { subjectId: subj.id, topicId: topic.id, topicName: topic.name };
      } else if (level === 'practiced' && nextVal) {
        topic.practiceCount = Math.max(1, topic.practiceCount || 0);
      }

      recordMarkActivity(prev, subj.id, level, nextVal, today);
      lastToggledMark = { topicId, level };
      if (nextVal) {
        animateParticleBurst(btnEl);
        if (rowEl) animatePipelineBeam(rowEl);
      }
      if (topic.read && topic.revised && topic.practiced && nextVal) {
        lastCelebratedTopicId = topicId;
      }
      return prev;
    });
  };

  // Increment practice repetition counter (+1 rep)
  document.querySelectorAll('[data-inc-practice]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const topicId = btn.getAttribute('data-inc-practice');
      const today = toDateKey();
      animateParticleBurst(btn);
      setState((prev) => {
        const subj = prev.subjects.find((s) => s.id === prev.activeSubjectId);
        const topic = subj?.topics.find((t) => t.id === topicId);
        if (!topic) return prev;
        topic.practiced = true;
        topic.practiceCount = (topic.practiceCount || 1) + 1;
        recordMarkActivity(prev, subj.id, 'practiced', true, today);
        return prev;
      });
    });
  });

  // Inline recall confidence selector on topic cards
  document.querySelectorAll('[data-inline-conf]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const rating = btn.getAttribute('data-inline-conf');
      const topicId = btn.getAttribute('data-topic');
      setState((prev) => {
        const subj = prev.subjects.find((s) => s.id === prev.activeSubjectId);
        const topic = subj?.topics.find((t) => t.id === topicId);
        if (topic) {
          topic.confidence = rating;
          advanceSrsWithConfidence(topic, rating, toDateKey());
        }
        return prev;
      });
    });
  });

  document.querySelectorAll('.mark-btn[data-topic]').forEach((btn) => {
    btn.addEventListener('click', () => {
      handleMarkToggle(
        getState().activeSubjectId,
        btn.getAttribute('data-topic'),
        btn.getAttribute('data-level'),
        btn
      );
    });
  });

  document.querySelectorAll('[data-focus-mark-topic]').forEach((btn) => {
    btn.addEventListener('click', () => {
      handleMarkToggle(
        btn.getAttribute('data-focus-mark-subj'),
        btn.getAttribute('data-focus-mark-topic'),
        btn.getAttribute('data-focus-mark-lvl'),
        btn
      );
    });
  });

  // Confidence rating buttons
  document.querySelectorAll('[data-conf-rating]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const rating = btn.getAttribute('data-conf-rating');
      const subjectId = btn.getAttribute('data-conf-subj');
      const topicId = btn.getAttribute('data-conf-topic');
      pendingConfidence = null;
      setState((prev) => {
        const subj = prev.subjects.find((s) => s.id === subjectId);
        const topic = subj?.topics.find((t) => t.id === topicId);
        if (topic) {
          advanceSrsWithConfidence(topic, rating, toDateKey());
        }
        return prev;
      });
    });
  });

  // Delete topic (with motion exit)
  document.querySelectorAll('[data-del-topic]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-del-topic');
      const row = document.querySelector(`[data-topic-row="${id}"]`);
      if (row) await animateTopicRemove(row);
      expandedTopicIds.delete(id);
      setState((prev) => {
        const subj = prev.subjects.find((s) => s.id === prev.activeSubjectId);
        if (subj) subj.topics = subj.topics.filter((t) => t.id !== id);
        return prev;
      });
    });
  });

  // Attach Pomodoro from Subject View
  document.querySelectorAll('[data-focus-topic]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const topicId = btn.getAttribute('data-focus-topic');
      const subj = getActiveSubject();
      const topic = subj?.topics.find((t) => t.id === topicId);
      if (subj && topic) {
        attachPomodoroTopic(subj.id, topic.id, topic.name);
        setState((prev) => ({ ...prev, activeView: 'focus' }));
      }
    });
  });

  // Attach Pomodoro from Today / Focus View
  document.querySelectorAll('[data-attach-focus-topic]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const topicId = btn.getAttribute('data-attach-focus-topic');
      const subjectId = btn.getAttribute('data-attach-focus-subj');
      const subj = getState().subjects.find((s) => s.id === subjectId);
      const topic = subj?.topics.find((t) => t.id === topicId);
      if (subj && topic) {
        attachPomodoroTopic(subj.id, topic.id, topic.name);
        setState((prev) => ({ ...prev, activeView: 'focus' }));
      }
    });
  });

  // Topic "⋯" secondary actions menu toggle
  document.querySelectorAll('[data-topic-menu-btn]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.getAttribute('data-topic-menu-btn');
      const targetMenu = document.querySelector(`[data-topic-menu="${id}"]`);
      const wasOpen = targetMenu?.classList.contains('open');
      document.querySelectorAll('.topic-action-menu.open').forEach((m) => m.classList.remove('open'));
      document.querySelectorAll('[data-topic-menu-btn]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
      if (!wasOpen && targetMenu) {
        targetMenu.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  // Toggle Topic Extras drawer
  document.querySelectorAll('[data-toggle-extras]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-toggle-extras');
      if (expandedTopicIds.has(id)) expandedTopicIds.delete(id);
      else expandedTopicIds.add(id);
      renderApp();
    });
  });

  // Topic Extras: Notes auto-save
  document.querySelectorAll('[data-notes-topic]').forEach((ta) => {
    ta.addEventListener('change', () => {
      const id = ta.getAttribute('data-notes-topic');
      setState((prev) => {
        const subj = prev.subjects.find((s) => s.id === prev.activeSubjectId);
        const topic = subj?.topics.find((t) => t.id === id);
        if (topic) topic.notes = ta.value;
        return prev;
      });
    });
  });

  // Topic Extras: Links add/delete
  document.querySelectorAll('[data-add-link-form]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = form.getAttribute('data-add-link-form');
      const title = form.elements.title.value.trim();
      const url = form.elements.url.value.trim();
      if (!url) return;
      setState((prev) => {
        const subj = prev.subjects.find((s) => s.id === prev.activeSubjectId);
        const topic = subj?.topics.find((t) => t.id === id);
        if (topic) {
          topic.links = [...(topic.links || []), { id: uid(), title: title || url, url }];
        }
        return prev;
      });
    });
  });

  document.querySelectorAll('[data-del-link]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const linkId = btn.getAttribute('data-del-link');
      const topicId = btn.getAttribute('data-topic');
      setState((prev) => {
        const subj = prev.subjects.find((s) => s.id === prev.activeSubjectId);
        const topic = subj?.topics.find((t) => t.id === topicId);
        if (topic) topic.links = (topic.links || []).filter((l) => l.id !== linkId);
        return prev;
      });
    });
  });

  // Topic Extras: Doubts add/toggle/delete
  document.querySelectorAll('[data-add-doubt-form]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const id = form.getAttribute('data-add-doubt-form');
      const text = form.elements.doubt.value.trim();
      if (!text) return;
      setState((prev) => {
        const subj = prev.subjects.find((s) => s.id === prev.activeSubjectId);
        const topic = subj?.topics.find((t) => t.id === id);
        if (topic) {
          topic.doubts = [...(topic.doubts || []), { id: uid(), text, resolved: false }];
        }
        return prev;
      });
    });
  });

  document.querySelectorAll('[data-toggle-doubt]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const doubtId = cb.getAttribute('data-toggle-doubt');
      const topicId = cb.getAttribute('data-topic');
      setState((prev) => {
        const subj = prev.subjects.find((s) => s.id === prev.activeSubjectId);
        const topic = subj?.topics.find((t) => t.id === topicId);
        const doubt = topic?.doubts?.find((d) => d.id === doubtId);
        if (doubt) doubt.resolved = cb.checked;
        return prev;
      });
    });
  });

  document.querySelectorAll('[data-del-doubt]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const doubtId = btn.getAttribute('data-del-doubt');
      const topicId = btn.getAttribute('data-topic');
      setState((prev) => {
        const subj = prev.subjects.find((s) => s.id === prev.activeSubjectId);
        const topic = subj?.topics.find((t) => t.id === topicId);
        if (topic) topic.doubts = (topic.doubts || []).filter((d) => d.id !== doubtId);
        return prev;
      });
    });
  });

  // Today / Focus View: Start Revision Blitz, Test Recall toggle, and Grade Recall Cards
  document.getElementById('startRevisionBlitzBtn')?.addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const subjectId = btn.getAttribute('data-blitz-subj');
    const topicId = btn.getAttribute('data-blitz-topic');
    const subj = getState().subjects.find((s) => s.id === subjectId);
    const topic = subj?.topics.find((t) => t.id === topicId);
    if (subj && topic) {
      attachPomodoroTopic(subj.id, topic.id, topic.name);
      setState((prev) => ({ ...prev, activeView: 'focus' }));
      startPomodoro();
      animateChronoStartShockwave(document.getElementById('chronoMainWrap') || document);
    }
  });

  document.querySelectorAll('[data-toggle-recall]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-toggle-recall');
      if (revealedRecallIds.has(id)) revealedRecallIds.delete(id);
      else revealedRecallIds.add(id);
      renderApp();
    });
  });

  document.querySelectorAll('[data-srs-revise]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const topicId = btn.getAttribute('data-srs-revise');
      const subjectId = btn.getAttribute('data-srs-subject');
      const rate = btn.getAttribute('data-srs-rate') || 'good';
      const today = toDateKey();
      const cardEl = btn.closest('[data-recall-card]');
      animateParticleBurst(btn);
      if (cardEl) await animateRecallCardSwipe(cardEl);
      revealedRecallIds.delete(topicId);
      setState((prev) => {
        const subj = prev.subjects.find((s) => s.id === subjectId);
        const topic = subj?.topics.find((t) => t.id === topicId);
        if (!topic) return prev;
        topic.revised = true;
        topic.confidence = rate;
        advanceSrsWithConfidence(topic, rate, today);
        recordMarkActivity(prev, subj.id, 'revised', true, today);
        return prev;
      });
    });
  });

  // Bulk Import Modal trigger
  document.getElementById('openBulkImportBtn')?.addEventListener('click', () => {
    modalState.importOpen = true;
    modalState.importRawText = '';
    modalState.importPreview = null;
    renderModalOnly();
  });
}

// Global outside-click to close Ledger topic "⋯" menu
document.addEventListener('click', (e) => {
  if (!e.target.closest('.topic-menu-wrap')) {
    document.querySelectorAll('.topic-action-menu.open').forEach((m) => m.classList.remove('open'));
    document.querySelectorAll('[data-topic-menu-btn]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  }
});

// Global Escape key to close menus & modals
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.topic-action-menu.open').forEach((m) => m.classList.remove('open'));
    document.querySelectorAll('[data-topic-menu-btn]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
    if (modalState.importOpen || modalState.backupOpen) {
      modalState.importOpen = false;
      modalState.backupOpen = false;
      renderModalOnly();
    }
  }
});

// Register PWA Service Worker (web/HTTPS only; skipped in packaged Electron desktop)
if (
  'serviceWorker' in navigator &&
  import.meta.env.PROD &&
  window.location.protocol !== 'file:' &&
  !window.fleckshiDesktop?.isDesktop
) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('Service worker registration skipped:', err);
    });
  });
}

initAnimeEngine();
applySavedTheme();
applyFxAttribute();
initPomodoroDefaults();
subscribe(renderApp);
subscribePomodoro(renderPomodoroOnly);
let audioSubscribedInit = false;
subscribeAudio(() => {
  if (!audioSubscribedInit) {
    audioSubscribedInit = true;
    return;
  }
  if (getState().activeView === 'focus') renderApp();
});
renderApp();
initFleckshiGuide(
  {
    getSnapshot: getFleckshiSnapshot,
    addSubject: addSubjectFromName,
    selectSubject: selectSubjectById,
    navigateTo: navigateAppView,
    openNotebookLearn: openNotebookLearnForGuide,
    highlightElement: highlightElementForGuide
  },
  getFleckshiSnapshot()
);
