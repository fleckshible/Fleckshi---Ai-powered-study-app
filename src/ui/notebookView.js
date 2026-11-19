import '../styles/notebook.css';
import 'katex/dist/katex.min.css';
import { escapeHtml } from '../utils/dom.js';
import { setFxLevel } from '../animations/fxController.js';
import { renderAnimatedIcon, renderIconTile, renderEmptyIllustration } from './icons.js';
import {
  createStreamRenderThrottle,
  renderRichMarkdown
} from '../features/markdownRenderer.js';
import { uid } from '../utils/uid.js';
import { addDays, toDateKey } from '../utils/date.js';
import { getState, setState } from '../storage/store.js';
import {
  DEFAULT_GEMINI_MODEL,
  getActiveApiKey,
  getCachedLiveModels,
  getKeyVaultConfig,
  removeApiKey,
  saveApiKeyEncrypted,
  saveApiKeyPlain,
  unlockApiKey,
  updateModelSettings
} from '../storage/keyVault.js';
import {
  getNotebook,
  getScopedArtifact,
  makeArtifactKey,
  migrateLegacyNotebookTab,
  restoreArtifactVersion,
  saveNotebook,
  setScopedArtifact
} from '../storage/notebookStore.js';
import {
  createNotebookSource,
  extractCitationsFromText
} from '../features/notebookChunker.js';
import { downscaleImageFile } from '../features/imageProcessor.js';
import { extractPdfContent } from '../features/pdfExtractor.js';
import {
  formatShortModelName,
  resolveModelForTask
} from '../features/modelCatalog.js';
import {
  ensureLiveModelsLoaded,
  streamGroundedChat,
  testApiKeyAndListModels,
  testSingleModel
} from '../features/geminiClient.js';
import {
  buildSyllabusBrainFromSubject,
  extractSyllabusBrainFromInputs,
  getTaskKeyForTool,
  mergeSyllabusIntoState,
  runStudioGenerator,
  speakText,
  stopSpeaking,
  syllabusBrainToLedgerSyllabus,
  transcribeImageWithGemini,
  validateAndNormalizeSyllabusBrain
} from '../features/notebookGenerators.js';
import {
  buildChapterGenerationTasks,
  createQueueRunner
} from '../features/generationQueue.js';
import { advanceSrsWithConfidence } from '../features/spacedRevision.js';
import { buildPrintableHtml, printHtmlDocument } from '../features/pdfExporter.js';
import {
  dismissFleckshiFocusSuggestion,
  maybeSuggestFleckshiFocusMode
} from './fleckshiGuide.js';
import {
  animateDecodeTitle,
  animateKeyLockedMorph,
  animateMindMapBuild,
  animateNotebookIcons,
  animateNotebookOpen,
  animateOcrScanSweep,
  animateQuizFinish,
  animateTabWorkspaceSwitch,
  animateWorkspacePopover,
  bindFlashcardInteractions,
  bindNotebookAmbientInteractions,
  bindSourceDragInteractions,
  bindSyllabusTreeDrag,
  cleanupNotebookEffects,
  cleanupNotebookTabEffects,
  revealWordsAnimated,
  runNotebookLayoutUpdate,
  shuffleItems,
  startStreamingTimers,
  startThinkingConstellation
} from '../animations/notebookEffects.js';
import { renderKeyAndRoutingModal } from './notebook/modelPicker.js';
import {
  renderApplyLedgerModal,
  renderGenerateAllModal,
  renderHomeWorkspace,
  renderSyllabusScanModal,
  renderSyllabusTreeModal
} from './notebook/syllabusBrainUi.js';
import {
  LEARN_VIEWS,
  NOTEBOOK_TABS,
  PRACTICE_VIEWS,
  renderChatWorkspace,
  renderOcrReviewModal,
  renderPasteAndTopicNotesModals,
  renderPlanWorkspace,
  renderScopeSheetModal,
  renderScopedGeneratorWorkspace,
  renderSourcesWorkspace,
  renderVersionCompareModal,
  resolveActiveScopeDetails,
  TAB_TOOL_LABELS
} from './notebook/tabWorkspaces.js';

const GENERATOR_TABS = new Set([
  'notes',
  'summary',
  'studyGuide',
  'faq',
  'glossary',
  'timeline',
  'flashcards',
  'quiz',
  'mindMap',
  'revisionPlan'
]);

let activeNotebook = null;
let loadedSubjectId = null;
let pendingNotebookLoad = null;
let lastRenderedSubjectId = null;
let lastRenderedHeaderSig = '';
let lastRenderedStageSig = '';
let lastRenderedModalsSig = '';
let lastRenderedStageKey = '';
let lastFocusedBeforeModal = null;
let activeTrapContainer = null;

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function repositionOpenPopovers() {
  if (typeof window === 'undefined') return;
  const openPopovers = document.querySelectorAll('.nb-split-menu, .nb-ws-popover');
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  openPopovers.forEach((pop) => {
    const anchor =
      pop.closest('.nb-split-wrap, .nb-ws-pop-wrap')?.querySelector('button[aria-haspopup="menu"]') ||
      pop.parentElement;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const popRect = pop.getBoundingClientRect();
    const popW = popRect.width || 270;
    const popH = popRect.height || 220;
    let left = rect.right - popW;
    if (left < 12) left = Math.max(12, Math.min(rect.left, vw - popW - 12));
    if (left + popW > vw - 12) left = Math.max(12, vw - popW - 12);
    let top = rect.bottom + 6;
    if (top + popH > vh - 16 && rect.top - popH - 6 > 12) {
      top = rect.top - popH - 6;
    }
    pop.style.left = `${Math.round(left)}px`;
    pop.style.top = `${Math.round(top)}px`;
    pop.style.right = 'auto';
  });
}

function syncOverlayFocusTrap(modalHost) {
  const overlay =
    modalHost?.querySelector('.modal-card, .nb-scope-sheet') ||
    (chatDrawerOpen ? document.querySelector('.nb-cite-drawer') : null);

  if (overlay && overlay !== activeTrapContainer) {
    if (!activeTrapContainer && document.activeElement instanceof HTMLElement) {
      lastFocusedBeforeModal = document.activeElement;
    }
    activeTrapContainer = overlay;
    const firstFocusable = overlay.querySelector(FOCUSABLE_SELECTOR);
    if (firstFocusable instanceof HTMLElement) {
      firstFocusable.focus({ preventScroll: true });
    }
  } else if (!overlay && activeTrapContainer) {
    activeTrapContainer = null;
    if (lastFocusedBeforeModal && lastFocusedBeforeModal.isConnected) {
      lastFocusedBeforeModal.focus({ preventScroll: true });
    }
    lastFocusedBeforeModal = null;
  }
}

// Ephemeral view/menu/drawer/modal state
let splitMenuOpen = false;
let addSourceMenuOpen = false;
let chatDrawerOpen = false;
let scopeSheetOpen = false;
let scanModalOpen = false;
let treeModalOpen = false;
let isNotebookFullscreen = false;
let isOutlineCollapsed = false;
let prevOutlineBeforeFullscreen = false;
let focusSuggestionTimerId = null;
let pdfPreviewOpen = false;
const tabModelOverrides = {};

function clearFocusSuggestionTimer() {
  if (focusSuggestionTimerId !== null) {
    clearTimeout(focusSuggestionTimerId);
    focusSuggestionTimerId = null;
  }
}

function setNotebookFullscreen(nextVal) {
  const target = Boolean(nextVal);
  if (target === isNotebookFullscreen) return;
  isNotebookFullscreen = target;
  clearFocusSuggestionTimer();
  if (isNotebookFullscreen) {
    prevOutlineBeforeFullscreen = isOutlineCollapsed;
    isOutlineCollapsed = true;
    dismissFleckshiFocusSuggestion();
    const shellEl = document.getElementById('nbRootShell');
    if (shellEl && typeof shellEl.requestFullscreen === 'function' && !document.fullscreenElement) {
      shellEl.requestFullscreen().catch(() => {});
    }
  } else {
    isOutlineCollapsed = prevOutlineBeforeFullscreen;
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    }
  }
  renderNotebookDom(false);
}

let isStreaming = false;
let isGeneratingTab = false;
let generatingArtifactKey = null;
let activeAbortCtrl = null;
let stopCursorTimer = null;
let fallbackToastMsg = '';
let highlightedChunkId = null;
let citationDrawerChunkId = null;
let editNoteMode = false;

// Home Syllabus Brain ephemeral workflow
let pendingSyllabusDraft = null;
let syllabusScanning = false;
let syllabusScanError = '';
let syllabusPasteText = '';
let applyLedgerModalOpen = false;

// Key & Multi-Model Routing Modal state
let keyModalOpen = false;
let confirmDeleteKey = false;
let modelSearchQuery = '';
let keyTestStatus = '';
let keyTestError = '';
let pingResultText = '';

// Modals & Queues
let pasteModalOpen = false;
let topicNotesModalOpen = false;
let versionModalKey = null;
let selectedVersionIdx = 0;
let confirmRegenState = null; // { tabId, scope, modelOverride }
let ocrQueue = [];

// Generate Everything queue state
let queueModalOpen = false;
let activeQueueRunner = null;
let queueSnapshot = null;
let queueIncludeExisting = false;
let queueConcurrency = 1;
let queueSelectedTypes = ['summary', 'studyGuide', 'flashcards', 'quiz', 'mindMap'];

// Flashcards & Quiz session state
let fcSession = { index: 0, ratings: {} };
let quizTimerId = null;
let quizSession = {
  answers: {},
  shortSelfGrades: {},
  revealedShort: {},
  submitted: false,
  wrongOnly: false,
  suggestDone: false,
  secondsLeft: 0,
  config: {
    count: 8,
    difficulty: 'Medium',
    questionTypes: ['mcq', 'tf', 'short'],
    timed: false,
    instantFeedback: false,
    weakTopics: []
  }
};

const autoAttemptedKeys = new Set();
let docListenersAbort = null;

function clearQuizTimer() {
  if (quizTimerId) {
    clearInterval(quizTimerId);
    quizTimerId = null;
  }
}

export function unmountNotebookView() {
  if (activeAbortCtrl) {
    activeAbortCtrl.abort();
    activeAbortCtrl = null;
  }
  if (activeQueueRunner && queueSnapshot?.status === 'running') {
    activeQueueRunner.pause();
  }
  if (stopCursorTimer) {
    stopCursorTimer();
    stopCursorTimer = null;
  }
  clearQuizTimer();
  if (docListenersAbort) {
    docListenersAbort.abort();
    docListenersAbort = null;
  }
  stopSpeaking();
  cleanupNotebookEffects();
  isStreaming = false;
  isGeneratingTab = false;
  generatingArtifactKey = null;
  clearFocusSuggestionTimer();
  splitMenuOpen = false;
  addSourceMenuOpen = false;
  chatDrawerOpen = false;
  scopeSheetOpen = false;
  scanModalOpen = false;
  treeModalOpen = false;
  lastRenderedHeaderSig = '';
  lastRenderedStageSig = '';
  lastRenderedModalsSig = '';
  lastRenderedStageKey = '';
  activeTrapContainer = null;
  lastFocusedBeforeModal = null;
}

function getMountEl() {
  return document.getElementById('notebookMount');
}

function getIncludedChunks(nb) {
  const out = [];
  for (const src of nb?.sources || []) {
    if (!src.included) continue;
    for (const c of src.chunks || []) {
      out.push(c);
    }
  }
  return out;
}

function getActiveWorkspaceState(nb = activeNotebook) {
  const nav = migrateLegacyNotebookTab(nb?.activeTab || 'home', nb);
  const topTab = nav.tabId;
  const learnView = LEARN_VIEWS.some((v) => v.id === nb?.activeLearnView)
    ? nb.activeLearnView
    : nav.learnView || 'notes';
  const notesMode = nb?.activeNotesMode === 'mine' ? 'mine' : 'ai';
  const practiceView = PRACTICE_VIEWS.some((v) => v.id === nb?.activePracticeView)
    ? nb.activePracticeView
    : nav.practiceView || 'flashcards';
  const quizMode = ['play', 'build', 'history'].includes(nb?.activeQuizMode)
    ? nb.activeQuizMode
    : 'play';

  let activeTool = null;
  if (topTab === 'learn') activeTool = learnView;
  else if (topTab === 'practice') activeTool = practiceView;
  else if (topTab === 'plan') activeTool = 'revisionPlan';

  const accentKey = activeTool || topTab;
  return { topTab, learnView, notesMode, practiceView, quizMode, activeTool, accentKey };
}

function getActiveTabTaskKey(nb = activeNotebook) {
  const { topTab, activeTool } = getActiveWorkspaceState(nb);
  if (topTab === 'chat') return 'chat';
  if (topTab === 'sources' || (topTab === 'home' && (scanModalOpen || !nb?.syllabusBrain))) {
    return 'ocr';
  }
  if (activeTool) return getTaskKeyForTool(activeTool);
  return 'chat';
}

function renderTopHeader(subject, vaultConfig, liveModels) {
  const { topTab } = getActiveWorkspaceState(activeNotebook);
  const topMeta = NOTEBOOK_TABS.find((t) => t.id === topTab) || NOTEBOOK_TABS[0];
  const taskKey = getActiveTabTaskKey(activeNotebook);
  const resolvedModel = resolveModelForTask(taskKey, vaultConfig, liveModels);
  const shortModel = formatShortModelName(resolvedModel, liveModels);
  const aiStatusText = vaultConfig.unlocked
    ? `AI · ${shortModel}`
    : vaultConfig.hasStoredKey
      ? 'AI · Locked'
      : 'AI · No Key';

  const qRunning = queueSnapshot?.status === 'running' || queueSnapshot?.status === 'paused';
  const qDone = queueSnapshot?.completed || 0;
  const qTot = queueSnapshot?.total || 0;
  const srcCount = activeNotebook?.sources?.length || 0;

  const topTabsHtml = NOTEBOOK_TABS.map((t) => {
    const isActive = topTab === t.id;
    const badgeHtml =
      t.id === 'sources' && srcCount > 0 ? `<span class="nb-tab-badge">${srcCount}</span>` : '';
    return (
      `<button type="button" class="nb-top-tab${isActive ? ' active' : ''}" role="tab" ` +
      `id="nbTab_${escapeHtml(t.id)}" aria-selected="${isActive}" aria-controls="nbTabStage" tabindex="${
        isActive ? '0' : '-1'
      }" ` +
      `data-nb-top-tab="${escapeHtml(t.id)}">` +
      renderAnimatedIcon(t.icon, { size: 18 }) +
      `<span>${escapeHtml(t.label)}</span>` +
      badgeHtml +
      `</button>`
    );
  }).join('');

  return (
    `<header class="nb-header">` +
    `<div class="nb-header-row">` +
    `<div class="nb-brand-group">` +
    renderIconTile(topMeta.icon, { variant: 'default', accent: topTab }) +
    `<div class="nb-hero-wrap">` +
    `<h1 class="serif nb-hero-title">${escapeHtml(
      subject.name
    )}<span class="title-dot"></span></h1>` +
    `<div class="nb-hero-underline"></div>` +
    `</div>` +
    `<span class="ui-chip ui-chip--accent">${escapeHtml(topMeta.label)}</span>` +
    `</div>` +
    `<div class="nb-top-actions">` +
    (topTab === 'learn' || topTab === 'practice'
      ? `<button type="button" class="nb-model-chip" id="nbToggleOutlineRailBtn" aria-pressed="${Boolean(
          isOutlineCollapsed
        )}" title="Toggle Syllabus Outline Rail">${
          isOutlineCollapsed ? 'Show Outline' : 'Hide Outline'
        }</button>`
      : '') +
    `<button type="button" class="nb-model-chip nb-focus-mode-btn${
      isNotebookFullscreen ? ' is-active' : ''
    }" id="nbToggleFullscreenBtn" aria-pressed="${Boolean(
      isNotebookFullscreen
    )}" aria-label="${
      isNotebookFullscreen
        ? 'Exit Focus reading mode (Escape)'
        : 'Enter Fullscreen Focus reading mode'
    }" title="${
      isNotebookFullscreen
        ? 'Exit Focus reading mode (Esc)'
        : 'Expand into Fullscreen Focus reading mode'
    }">` +
    (isNotebookFullscreen
      ? `<svg class="nb-focus-mode-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14h6v6"/><path d="M20 10h-6V4"/><path d="M14 10l7-7"/><path d="M3 21l7-7"/></svg>`
      : `<svg class="nb-focus-mode-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`) +
    `<span>${isNotebookFullscreen ? 'Exit Focus' : 'Focus Mode'}</span>` +
    `</button>` +
    (qRunning
      ? `<button type="button" class="nb-model-chip" id="nbOpenQueuePillBtn">${renderAnimatedIcon(
          'home:queue',
          { size: 12 }
        )}<span class="nb-chip-dot"></span>Queue ${qDone}/${qTot}</button>`
      : '') +
    `<button type="button" class="nb-model-chip" id="nbOpenKeyModalBtn" title="Gemini API Key, Model Routing, Grounding &amp; Effects">` +
    `<span class="nb-chip-dot${vaultConfig.unlocked ? '' : ' locked'}"></span>` +
    renderAnimatedIcon('ctrl:model', { size: 13 }) +
    `<span>${escapeHtml(aiStatusText)}</span>` +
    `</button>` +
    `</div>` +
    `</div>` +
    `<nav class="nb-top-tabs" id="nbTopTabBar" role="tablist" aria-label="Study Notebook Tabs">${topTabsHtml}</nav>` +
    (fallbackToastMsg
      ? `<div class="nb-toast" role="status"><span>${escapeHtml(
          fallbackToastMsg
        )}</span><button type="button" class="topic-del" id="nbDismissToastBtn" aria-label="Dismiss">&times;</button></div>`
      : '') +
    `</header>`
  );
}

function renderRegenConfirmModal() {
  if (!confirmRegenState) return '';
  const { tabId, scope, modelOverride } = confirmRegenState;
  return (
    `<div class="modal-backdrop" id="nbConfirmRegenBackdrop" role="dialog" aria-modal="true" aria-labelledby="nbRegenTitle">` +
    `<div class="modal-card">` +
    `<div class="modal-header">` +
    `<h2 class="serif" id="nbRegenTitle">Regenerate Existing Content?<span class="title-dot"></span></h2>` +
    `<button type="button" class="topic-del" id="nbCancelRegenBtn" aria-label="Close">&times;</button>` +
    `</div>` +
    `<p class="u-text-muted">Regenerate <strong>${escapeHtml(
      TAB_TOOL_LABELS[tabId] || tabId
    )}</strong> for <strong>${escapeHtml(scope.scopeLabel)}</strong> using <span class="mono">${escapeHtml(
      modelOverride
    )}</span>? Your current version will be archived (last 3 versions kept for comparison &amp; restore).</p>` +
    `<div class="modal-actions">` +
    `<button type="button" class="btn-secondary" id="nbCancelRegenBottomBtn">Keep Current</button>` +
    `<button type="button" class="btn-primary" id="nbConfirmRegenBtn">Regenerate Now</button>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

function buildActivePdfDocument(subject, allChunks) {
  if (!activeNotebook || !subject) return '';
  const { activeTool, notesMode } = getActiveWorkspaceState(activeNotebook);
  const tool = activeTool || 'notes';
  const scope = resolveActiveScopeDetails(activeNotebook, subject, tool);
  const toolLabel = TAB_TOOL_LABELS[tool] || tool;

  let bodyHtml = '';
  if (tool === 'notes' && notesMode === 'mine') {
    const targetTopic = (subject.topics || []).find(
      (t) => t.name.trim().toLowerCase() === scope.scopeLabel.trim().toLowerCase()
    );
    const noteText = targetTopic?.notes || document.getElementById('nbTopicNotesTextarea')?.value || '';
    bodyHtml = noteText.trim()
      ? renderRichMarkdown(noteText, allChunks)
      : '<p>No personal notes written for this scope yet.</p>';
  } else {
    const artifact = getScopedArtifact(activeNotebook, tool, scope.scopeType, scope.scopeId);
    if (!artifact) {
      bodyHtml = '<p>No generated content saved for this scope yet.</p>';
    } else if (typeof artifact.content === 'string') {
      bodyHtml = renderRichMarkdown(artifact.content, allChunks);
    } else if (tool === 'timeline' && Array.isArray(artifact.content)) {
      bodyHtml =
        '<ol>' +
        artifact.content
          .map(
            (ev) =>
              `<li><strong>${escapeHtml(ev.phase || ev.title || 'Stage')}</strong>` +
              (ev.detail ? ` — ${escapeHtml(ev.detail)}` : '') +
              `</li>`
          )
          .join('') +
        '</ol>';
    } else if (tool === 'mindMap' && artifact.content?.rootLabel) {
      const branches = Array.isArray(artifact.content.branches) ? artifact.content.branches : [];
      bodyHtml =
        `<h2>${escapeHtml(artifact.content.rootLabel)}</h2>` +
        '<ul>' +
        branches
          .map(
            (b) =>
              `<li><strong>${escapeHtml(b.label || '')}</strong>` +
              (Array.isArray(b.children) && b.children.length
                ? `<ul>${b.children.map((c) => `<li>${escapeHtml(c)}</li>`).join('')}</ul>`
                : '') +
              `</li>`
          )
          .join('') +
        '</ul>';
    } else if (tool === 'revisionPlan' && artifact.content?.schedule) {
      const sched = Array.isArray(artifact.content.schedule) ? artifact.content.schedule : [];
      bodyHtml =
        '<table><thead><tr><th>Day</th><th>Topic</th><th>Action</th></tr></thead><tbody>' +
        sched
          .map(
            (row) =>
              `<tr><td>${escapeHtml(String(row.day || row.date || ''))}</td><td>${escapeHtml(
                row.topicName || row.topic || ''
              )}</td><td>${escapeHtml(row.action || row.focus || '')}</td></tr>`
          )
          .join('') +
        '</tbody></table>';
    } else {
      bodyHtml = `<pre>${escapeHtml(JSON.stringify(artifact.content, null, 2))}</pre>`;
    }
  }

  return buildPrintableHtml({
    subjectName: subject.name,
    scopeLabel: scope.scopeLabel,
    toolLabel,
    bodyHtml
  });
}

function renderPdfPreviewModal(subject, allChunks) {
  if (!pdfPreviewOpen) return '';
  const htmlDoc = buildActivePdfDocument(subject, allChunks);
  return (
    `<div class="modal-backdrop" id="nbPdfPreviewBackdrop" role="dialog" aria-modal="true" aria-labelledby="nbPdfPreviewTitle">` +
    `<div class="modal-card nb-modal-lg u-stack-md">` +
    `<div class="modal-header">` +
    `<h2 class="serif" id="nbPdfPreviewTitle">PDF Export Preview<span class="title-dot"></span></h2>` +
    `<button type="button" class="topic-del" id="nbClosePdfPreviewBtn" aria-label="Close PDF preview">&times;</button>` +
    `</div>` +
    `<p class="u-text-sm" style="margin:0;">Clean light-paper layout with equations, headings, and page numbers. Choose <strong>Save as PDF</strong> in your browser print dialog.</p>` +
    `<iframe class="nb-pdf-preview-frame" id="nbPdfPreviewFrame" title="PDF Print Preview" srcdoc="${escapeHtml(
      htmlDoc
    )}"></iframe>` +
    `<div class="modal-actions u-row-end">` +
    `<button type="button" class="btn-secondary btn-md" id="nbClosePdfPreviewFooterBtn">Close</button>` +
    `<button type="button" class="btn-primary btn-md" id="nbPrintPdfBtn">Print / Save as PDF</button>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

function renderNotebookDom(animateEntrance = false) {
  const mount = getMountEl();
  if (!mount) return;

  const state = getState();
  const subject = state.subjects.find((s) => s.id === state.activeSubjectId) || null;
  if (!subject || !activeNotebook) {
    cleanupNotebookEffects();
    lastRenderedHeaderSig = '';
    lastRenderedStageSig = '';
    lastRenderedModalsSig = '';
    lastRenderedStageKey = '';
    mount.innerHTML = renderEmptyIllustration('nav:notebook', {
      title: 'Select or create a subject',
      subtitle: 'Each subject has its own Syllabus Brain, sources, notes, flashcards, quizzes, and revision plan.',
      accent: 'learn'
    });
    return;
  }

  const vaultConfig = getKeyVaultConfig();
  const liveModels = getCachedLiveModels();
  const allChunks = getIncludedChunks(activeNotebook);
  const {
    topTab,
    learnView,
    notesMode,
    practiceView,
    quizMode,
    activeTool,
    accentKey
  } = getActiveWorkspaceState(activeNotebook);

  let stageHtml = '';
  if (topTab === 'home') {
    stageHtml = renderHomeWorkspace({
      notebook: activeNotebook,
      subject,
      syllabusScanning,
      syllabusScanError,
      syllabusPasteText,
      vaultConfig,
      liveModels
    });
  } else if (topTab === 'sources') {
    stageHtml = renderSourcesWorkspace({
      notebook: activeNotebook,
      allChunks,
      highlightedChunkId,
      ocrQueue,
      addMenuOpen: addSourceMenuOpen
    });
  } else if (topTab === 'chat') {
    stageHtml = renderChatWorkspace({
      notebook: activeNotebook,
      allChunks,
      vaultConfig,
      liveModels,
      citationDrawerChunkId,
      chatDrawerOpen
    });
  } else if (topTab === 'plan') {
    const planScope = resolveActiveScopeDetails(activeNotebook, subject, 'revisionPlan');
    const planKey = makeArtifactKey('revisionPlan', planScope.scopeType, planScope.scopeId);
    stageHtml = renderPlanWorkspace({
      notebook: activeNotebook,
      subject,
      vaultConfig,
      liveModels,
      isGeneratingTab: Boolean(isGeneratingTab && generatingArtifactKey === planKey),
      splitMenuOpen,
      tabModelOverride: tabModelOverrides.revisionPlan || null
    });
  } else {
    const toolScope = activeTool
      ? resolveActiveScopeDetails(activeNotebook, subject, activeTool)
      : null;
    const toolKey = toolScope
      ? makeArtifactKey(activeTool, toolScope.scopeType, toolScope.scopeId)
      : null;
    stageHtml = renderScopedGeneratorWorkspace({
      parentTab: topTab,
      activeView: topTab === 'practice' ? practiceView : learnView,
      notesMode,
      quizMode,
      notebook: activeNotebook,
      subject,
      allChunks,
      vaultConfig,
      liveModels,
      isGeneratingTab: Boolean(isGeneratingTab && toolKey && generatingArtifactKey === toolKey),
      editNoteMode,
      fcSession,
      quizSession,
      splitMenuOpen,
      tabModelOverride: tabModelOverrides[activeTool] || null,
      outlineCollapsed: isOutlineCollapsed
    });
  }

  const modalsHtml =
    renderSyllabusScanModal({
      open: scanModalOpen,
      notebook: activeNotebook,
      subject,
      syllabusScanning,
      syllabusScanError,
      syllabusPasteText,
      vaultConfig,
      liveModels
    }) +
    renderSyllabusTreeModal({
      open: treeModalOpen,
      draft: pendingSyllabusDraft
    }) +
    renderScopeSheetModal({
      open: scopeSheetOpen,
      notebook: activeNotebook,
      subject,
      activeTool: activeTool || 'notes'
    }) +
    renderKeyAndRoutingModal({
      open: keyModalOpen,
      vaultConfig,
      liveModels,
      modelSearchQuery,
      keyTestStatus,
      keyTestError,
      pingResultText,
      defaultGroundingMode: activeNotebook.groundingMode || 'sources',
      confirmDeleteKey
    }) +
    renderApplyLedgerModal({
      open: applyLedgerModalOpen,
      notebook: activeNotebook,
      subject
    }) +
    renderGenerateAllModal({
      open: queueModalOpen,
      notebook: activeNotebook,
      queueSnapshot,
      queueIncludeExisting,
      queueConcurrency,
      queueSelectedTypes
    }) +
    renderVersionCompareModal({
      versionModalKey,
      notebook: activeNotebook,
      selectedVersionIdx
    }) +
    renderPdfPreviewModal(subject, allChunks) +
    renderOcrReviewModal(ocrQueue) +
    renderPasteAndTopicNotesModals({
      pasteModalOpen,
      topicNotesModalOpen,
      subject
    }) +
    renderRegenConfirmModal();

  const headerHtml = renderTopHeader(subject, vaultConfig, liveModels);
  const stageKey = `${topTab}::${activeTool || ''}::${notesMode}::${quizMode}`;
  const existingShell = document.getElementById('nbRootShell');
  const needsFullShell =
    animateEntrance ||
    !existingShell ||
    existingShell.getAttribute('data-subject-id') !== String(subject.id);

  let stageChanged = false;
  const stageKeyChanged = stageKey !== lastRenderedStageKey;

  if (needsFullShell) {
    cleanupNotebookEffects();
    mount.innerHTML =
      `<div class="nb-shell${isNotebookFullscreen ? ' is-fullscreen' : ''}" id="nbRootShell" data-subject-id="${escapeHtml(
        String(subject.id)
      )}" data-nb-section="${escapeHtml(topTab)}" data-nb-accent="${escapeHtml(accentKey)}">` +
      `<div class="nb-ambient-canvas" id="nbAmbientCanvas" aria-hidden="true">` +
      `<div class="nb-perspective-grid"></div>` +
      `<div class="nb-aurora-blob blob-violet"></div>` +
      `<div class="nb-aurora-blob blob-sapphire"></div>` +
      `<div class="nb-aurora-blob blob-cyan"></div>` +
      `</div>` +
      `<svg id="nbCitationOverlay" aria-hidden="true"><path id="nbCitationPath" fill="none" stroke="#34D399" stroke-width="2" stroke-linecap="round"/></svg>` +
      `<div id="nbHeaderSlot">${headerHtml}</div>` +
      `<div class="nb-stage" id="nbTabStage" role="tabpanel" aria-labelledby="nbTab_${escapeHtml(
        topTab
      )}">${stageHtml}</div>` +
      `<div id="nbModalHost">${modalsHtml}</div>` +
      `</div>`;
    lastRenderedHeaderSig = headerHtml;
    lastRenderedStageSig = stageHtml;
    lastRenderedModalsSig = modalsHtml;
    lastRenderedStageKey = stageKey;
    stageChanged = true;
  } else {
    // Keyed targeted update: preserve #nbRootShell & #nbAmbientCanvas so UI toggles never rebuild them
    existingShell.classList.toggle('is-fullscreen', isNotebookFullscreen);
    existingShell.setAttribute('data-nb-section', topTab);
    existingShell.setAttribute('data-nb-accent', accentKey);

    const headerSlot = document.getElementById('nbHeaderSlot');
    if (headerSlot && headerHtml !== lastRenderedHeaderSig) {
      headerSlot.innerHTML = headerHtml;
      lastRenderedHeaderSig = headerHtml;
    }

    const stageEl = document.getElementById('nbTabStage');
    if (stageEl && stageHtml !== lastRenderedStageSig) {
      cleanupNotebookTabEffects();
      stageEl.setAttribute('aria-labelledby', `nbTab_${topTab}`);
      stageEl.innerHTML = stageHtml;
      lastRenderedStageSig = stageHtml;
      lastRenderedStageKey = stageKey;
      stageChanged = true;
    }

    const modalHost = document.getElementById('nbModalHost');
    if (modalHost && modalsHtml !== lastRenderedModalsSig) {
      modalHost.innerHTML = modalsHtml;
      lastRenderedModalsSig = modalsHtml;
    }
  }

  attachNotebookEvents(subject, allChunks, vaultConfig, liveModels);

  const shell = document.getElementById('nbRootShell');
  const stage = document.getElementById('nbTabStage');
  const modalHost = document.getElementById('nbModalHost');
  document.body.classList.toggle('nb-fullscreen-active', isNotebookFullscreen);

  if (needsFullShell) {
    animateNotebookOpen(shell);
    bindNotebookAmbientInteractions(shell);
  } else if (stageChanged && stageKeyChanged && stage) {
    animateTabWorkspaceSwitch(stage);
  }

  if (needsFullShell || stageChanged) {
    animateNotebookIcons(shell);
    if (stageKeyChanged && activeTool && GENERATOR_TABS.has(activeTool)) {
      animateDecodeTitle(document.querySelector('.nb-artifact-title'));
    }
  }

  if (splitMenuOpen || addSourceMenuOpen) {
    repositionOpenPopovers();
    animateWorkspacePopover(document.querySelector('.nb-split-menu'));
  }

  syncOverlayFocusTrap(modalHost);

  if (stageChanged && topTab === 'sources') {
    bindSourceDragInteractions(
      shell,
      async (fromIdx, toIdx) => {
        runNotebookLayoutUpdate('#nbSourcesList', () => {
          const [moved] = activeNotebook.sources.splice(fromIdx, 1);
          activeNotebook.sources.splice(toIdx, 0, moved);
        });
        await saveNotebook(activeNotebook);
        renderNotebookDom(false);
      },
      null
    );
  }

  if (treeModalOpen && pendingSyllabusDraft) {
    bindSyllabusTreeDrag(document.getElementById('nbSyllabusTreeList'), (fromIdx, toIdx) => {
      const list = pendingSyllabusDraft?.chapters;
      if (!list) return;
      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);
      renderNotebookDom(false);
    });
  }

  if (stageChanged && activeTool === 'mindMap') {
    animateMindMapBuild(document.getElementById('nbMindMapCanvas'));
  }
  if (stageChanged && activeTool === 'flashcards') {
    const fcEl = document.getElementById('nbFlashcardEl');
    if (fcEl) {
      bindFlashcardInteractions(fcEl, null, (rating) => handleFlashcardScore(rating, subject));
    }
  }
  if (ocrQueue.length || syllabusScanning) {
    animateOcrScanSweep(
      document.getElementById('nbOcrPreviewBox') || document.getElementById('nbSyllabusDropZone')
    );
  }

  scheduleFocusModeSuggestionCheck(topTab, activeTool);
}

function scheduleFocusModeSuggestionCheck(topTab, activeTool) {
  clearFocusSuggestionTimer();
  if (
    isNotebookFullscreen ||
    isGeneratingTab ||
    isStreaming ||
    editNoteMode ||
    topTab !== 'learn' ||
    !['notes', 'summary', 'studyGuide', 'faq', 'glossary'].includes(activeTool)
  ) {
    return;
  }
  const textBody = document.getElementById('nbArtifactTextBody');
  const scrollEl = document.getElementById('nbArtifactScroll');
  if (!textBody) return;
  const textLen = (textBody.textContent || '').trim().length;
  const isLongNote =
    textLen >= 360 ||
    Boolean(scrollEl && scrollEl.scrollHeight > scrollEl.clientHeight + 60);
  if (!isLongNote) return;

  focusSuggestionTimerId = setTimeout(() => {
    focusSuggestionTimerId = null;
    if (isNotebookFullscreen || isGeneratingTab || isStreaming || editNoteMode) return;
    maybeSuggestFleckshiFocusMode({
      onEnterFocus: () => setNotebookFullscreen(true)
    });
  }, 1800);
}

async function switchTab(nextTab, extraScope = null) {
  if (!activeNotebook) return;
  clearQuizTimer();
  cleanupNotebookTabEffects();
  splitMenuOpen = false;
  addSourceMenuOpen = false;
  scopeSheetOpen = false;
  editNoteMode = false;

  const state = getState();
  const subject = state.subjects.find((s) => s.id === state.activeSubjectId) || null;
  const nav = migrateLegacyNotebookTab(nextTab, activeNotebook);

  activeNotebook.activeTab = nav.tabId;
  if (nav.tabId === 'learn' && nav.learnView) {
    activeNotebook.activeLearnView = nav.learnView;
    if (nav.learnView === 'notes' && nav.notesMode) {
      activeNotebook.activeNotesMode = nav.notesMode;
    }
  }
  if (nav.tabId === 'practice' && nav.practiceView) {
    activeNotebook.activePracticeView = nav.practiceView;
    if (nav.practiceView === 'quiz' && nav.quizMode) {
      activeNotebook.activeQuizMode = nav.quizMode;
    }
  }

  if (nav.modalAction === 'scan' || nav.modalAction === 'paste') {
    scanModalOpen = Boolean(activeNotebook.syllabusBrain);
  } else if (nav.modalAction === 'tree') {
    pendingSyllabusDraft = activeNotebook.syllabusBrain
      ? JSON.parse(JSON.stringify(activeNotebook.syllabusBrain))
      : buildSyllabusBrainFromSubject(subject || { name: 'Subject', topics: [] });
    treeModalOpen = true;
  } else if (nav.modalAction === 'sync') {
    applyLedgerModalOpen = true;
  } else if (nav.modalAction === 'queue') {
    queueModalOpen = true;
  } else if (nav.modalAction === 'sources:upload') {
    addSourceMenuOpen = true;
  } else if (nav.modalAction === 'sources:paste') {
    pasteModalOpen = true;
  } else if (nav.modalAction === 'sources:topics') {
    topicNotesModalOpen = true;
  }

  if (nav.chatDrawerTab) {
    chatDrawerOpen = true;
  }

  if (extraScope) {
    activeNotebook.activeScope = {
      ...activeNotebook.activeScope,
      ...extraScope
    };
  }

  await saveNotebook(activeNotebook);
  renderNotebookDom(false);
  maybeAutoGenerateOnTabOpen();
}

function maybeAutoGenerateOnTabOpen() {
  if (!activeNotebook || isStreaming || isGeneratingTab) return;
  const { topTab, learnView, notesMode, activeTool } = getActiveWorkspaceState(activeNotebook);
  if (!activeTool || !GENERATOR_TABS.has(activeTool)) return;
  if (topTab === 'learn' && learnView === 'notes' && notesMode === 'mine') return;

  const cfg = getKeyVaultConfig();
  if (!cfg.unlocked) return;

  const state = getState();
  const subject = state.subjects.find((s) => s.id === state.activeSubjectId) || null;
  if (!subject) return;

  const scope = resolveActiveScopeDetails(activeNotebook, subject, activeTool);
  const autoEnabled =
    scope.scopeType === 'subject'
      ? Boolean(activeNotebook.autoGenerateOnTabOpen?.wholeSubject)
      : Boolean(activeNotebook.autoGenerateOnTabOpen?.scoped);

  if (!autoEnabled) return;

  const key = makeArtifactKey(activeTool, scope.scopeType, scope.scopeId);
  if (getScopedArtifact(activeNotebook, activeTool, scope.scopeType, scope.scopeId)) return;
  if (autoAttemptedKeys.has(key)) return;

  const chunks = getIncludedChunks(activeNotebook);
  if (activeNotebook.groundingMode === 'sources' && !chunks.length) return;
  if (
    activeNotebook.groundingMode === 'syllabus' &&
    !activeNotebook.syllabusBrain &&
    !(subject.topics || []).length
  ) {
    return;
  }

  autoAttemptedKeys.add(key);
  runTabGenerator(activeTool, subject, {
    modelOverride: tabModelOverrides[activeTool] || null
  });
}

async function runSyllabusScanFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length || !activeNotebook) return;
  const subject = getState().subjects.find((s) => s.id === activeNotebook.subjectId);

  syllabusScanning = true;
  syllabusScanError = '';
  renderNotebookDom(false);

  const images = [];
  const textParts = [];

  try {
    for (const file of files) {
      const lower = (file.name || '').toLowerCase();
      if (file.type?.startsWith('image/') || /\.(png|jpe?g|webp)$/.test(lower)) {
        const processed = await downscaleImageFile(file, 1600, 0.85);
        images.push({ base64Data: processed.base64Data, mimeType: processed.mimeType });
      } else if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
        const res = await extractPdfContent(file);
        if (!res.isScanned && res.text.trim()) {
          textParts.push(res.text.trim());
        } else if (res.pageImages?.length) {
          res.pageImages.forEach((p) =>
            images.push({ base64Data: p.base64Data, mimeType: p.mimeType })
          );
        }
      } else {
        const rawText = await file.text();
        if (lower.endsWith('.json')) {
          try {
            pendingSyllabusDraft = validateAndNormalizeSyllabusBrain(rawText, subject?.name);
            activeNotebook.activeTab = 'home';
            scanModalOpen = false;
            treeModalOpen = true;
            syllabusScanning = false;
            renderNotebookDom(false);
            return;
          } catch {
            textParts.push(rawText);
          }
        } else if (rawText.trim()) {
          textParts.push(rawText.trim());
        }
      }
    }

    const { brain, modelUsed, fallbackFrom } = await extractSyllabusBrainFromInputs({
      images,
      text: textParts.join('\n\n'),
      subjectName: subject?.name || '',
      onModelFallback: ({ fromModel, toModel }) => {
        fallbackToastMsg = `OCR fallback: ${fromModel} unavailable — used ${toModel}`;
      }
    });

    if (fallbackFrom) {
      fallbackToastMsg = `OCR fallback: ${fallbackFrom} unavailable — used ${modelUsed}`;
    }
    pendingSyllabusDraft = brain;
    activeNotebook.activeTab = 'home';
    scanModalOpen = false;
    treeModalOpen = true;
  } catch (err) {
    syllabusScanError = err.message || 'Could not extract syllabus.';
  } finally {
    syllabusScanning = false;
    renderNotebookDom(false);
  }
}

async function processAddedSourceFiles(fileList) {
  const files = Array.from(fileList || []);
  if (!files.length || !activeNotebook) return;
  const startCount = activeNotebook.sources.length;

  for (const file of files) {
    const lower = (file.name || '').toLowerCase();
    if (file.type?.startsWith('image/') || /\.(png|jpe?g|webp)$/.test(lower)) {
      const processed = await downscaleImageFile(file, 1600, 0.85);
      ocrQueue.push({
        id: `ocr_${uid()}`,
        title: file.name || `Image ${ocrQueue.length + 1}`,
        base64Data: processed.base64Data,
        mimeType: processed.mimeType,
        thumbnail: processed.thumbnail,
        text: '',
        status: 'pending',
        error: ''
      });
      continue;
    }

    if (lower.endsWith('.pdf') || file.type === 'application/pdf') {
      try {
        const res = await extractPdfContent(file);
        if (!res.isScanned && res.text.trim()) {
          activeNotebook.sources.push(
            createNotebookSource({
              title: file.name,
              type: 'file',
              rawText: res.text,
              sourceIndex: activeNotebook.sources.length + 1
            })
          );
        } else if (res.pageImages?.length) {
          res.pageImages.forEach((p) => {
            ocrQueue.push({
              id: `ocr_${uid()}`,
              title: p.title,
              base64Data: p.base64Data,
              mimeType: p.mimeType,
              thumbnail: p.thumbnail,
              text: '',
              status: 'pending',
              error: ''
            });
          });
        }
      } catch (err) {
        fallbackToastMsg = `PDF read error: ${err.message}`;
      }
      continue;
    }

    const text = await file.text();
    if (text.trim()) {
      activeNotebook.sources.push(
        createNotebookSource({
          title: file.name || 'Text Source',
          type: 'file',
          rawText: text,
          sourceIndex: activeNotebook.sources.length + 1
        })
      );
    }
  }

  if (!ocrQueue.length && activeNotebook.sources.length > startCount) {
    activeNotebook.activeTab = 'sources';
    fallbackToastMsg = `Added ${activeNotebook.sources.length - startCount} source(s) to library.`;
  }

  await saveNotebook(activeNotebook);
  renderNotebookDom(false);

  if (ocrQueue.length && ocrQueue[0].status === 'pending') {
    await runOcrOnHead();
  }
}

async function runOcrOnHead() {
  if (!ocrQueue.length) return;
  const head = ocrQueue[0];
  head.status = 'scanning';
  head.error = '';
  renderNotebookDom(false);

  try {
    const res = await transcribeImageWithGemini(head.base64Data, head.mimeType, null, null, {
      onModelFallback: ({ fromModel, toModel }) => {
        fallbackToastMsg = `OCR fallback: ${fromModel} unavailable — used ${toModel}`;
      }
    });
    head.status = 'ready';
    head.text = res?.transcribedText || '';
    renderNotebookDom(false);
    const ta = document.getElementById('nbOcrTextInput');
    if (ta) revealWordsAnimated(ta);
  } catch (err) {
    head.status = 'error';
    head.error = err.message || 'Unable to transcribe image.';
    renderNotebookDom(false);
  }
}

async function handleChatSubmit(question, allChunks) {
  if (!question || isStreaming || !activeNotebook) return;
  const state = getState();
  const subject = state.subjects.find((s) => s.id === state.activeSubjectId);

  activeNotebook.chatHistory.push({
    id: `msg_${uid()}`,
    role: 'user',
    text: question,
    createdAt: new Date().toISOString()
  });
  await saveNotebook(activeNotebook);
  renderNotebookDom(false);

  const shell = document.getElementById('nbRootShell');
  const streamBox = document.getElementById('nbStreamBox');
  const streamTextEl = document.getElementById('nbStreamText');
  const cursorEl = document.getElementById('nbStreamCursor');
  const retryEl = document.getElementById('nbRetryStatus');
  const scrollBox = document.getElementById('nbChatScroll');

  if (!streamBox || !streamTextEl) return;

  isStreaming = true;
  activeAbortCtrl = new AbortController();
  streamBox.style.display = 'block';
  streamTextEl.textContent = '';
  startThinkingConstellation(shell, true);
  stopCursorTimer = startStreamingTimers(cursorEl, null);
  scrollBox.scrollTop = scrollBox.scrollHeight;

  let usedModel = resolveModelForTask('chat', getKeyVaultConfig(), getCachedLiveModels());
  const brain = activeNotebook.syllabusBrain || buildSyllabusBrainFromSubject(subject);
  const syllabusContext = brain
    ? (brain.chapters || [])
        .map((c) => `${c.name}: ${(c.topics || []).map((t) => t.name).join(', ')}`)
        .join('\n')
    : '';

  const streamThrottle = createStreamRenderThrottle((accumulated) => {
    streamTextEl.innerHTML = renderRichMarkdown(accumulated, allChunks);
    if (scrollBox) scrollBox.scrollTop = scrollBox.scrollHeight;
  }, 85);

  try {
    const finalText = await streamGroundedChat({
      question,
      chunks: allChunks,
      chatHistory: activeNotebook.chatHistory,
      groundingMode: activeNotebook.groundingMode,
      syllabusContext,
      signal: activeAbortCtrl.signal,
      onModelUsed: ({ modelUsed }) => {
        if (modelUsed) usedModel = modelUsed;
      },
      onModelFallback: ({ fromModel, toModel }) => {
        fallbackToastMsg = `Model ${fromModel} unavailable/rate-limited — answered using ${toModel}`;
      },
      onRetryCountdown: (secs) => {
        if (retryEl) retryEl.textContent = secs > 0 ? `Rate limit: retrying in ${secs}s...` : '';
      },
      onChunk: (_delta, accumulated) => {
        streamThrottle.update(accumulated);
      }
    });
    streamThrottle.flush(finalText);

    activeNotebook.chatHistory.push({
      id: `msg_${uid()}`,
      role: 'model',
      text: finalText,
      model: usedModel,
      mode: activeNotebook.groundingMode,
      citations: extractCitationsFromText(finalText, allChunks),
      createdAt: new Date().toISOString()
    });
    await saveNotebook(activeNotebook);
  } catch (err) {
    if (err.message !== 'Request cancelled.') {
      activeNotebook.chatHistory.push({
        id: `msg_${uid()}`,
        role: 'model',
        text: `Error: ${err.message}`,
        model: usedModel,
        createdAt: new Date().toISOString()
      });
      await saveNotebook(activeNotebook);
    }
  } finally {
    streamThrottle.cancel();
    isStreaming = false;
    activeAbortCtrl = null;
    stopCursorTimer?.();
    stopCursorTimer = null;
    startThinkingConstellation(shell, false);
    renderNotebookDom(false);
    const msgs = document.querySelectorAll('.nb-chat-msg.model .nb-chat-body');
    const latest = msgs[msgs.length - 1];
    if (latest) revealWordsAnimated(latest);
  }
}

async function runTabGenerator(tabId, subject, opts = {}) {
  if (isGeneratingTab || isStreaming || !activeNotebook) return;
  const scope = opts.scopeOverride || resolveActiveScopeDetails(activeNotebook, subject, tabId);
  const artifactKey = makeArtifactKey(tabId, scope.scopeType, scope.scopeId);
  if (generatingArtifactKey === artifactKey) return;
  const modelOverride = opts.modelOverride || null;
  const existing = getScopedArtifact(activeNotebook, tabId, scope.scopeType, scope.scopeId);

  if (existing && !opts.confirmed) {
    confirmRegenState = {
      tabId,
      scope,
      modelOverride:
        modelOverride ||
        resolveModelForTask(getTaskKeyForTool(tabId), getKeyVaultConfig(), getCachedLiveModels())
    };
    renderNotebookDom(false);
    return;
  }

  confirmRegenState = null;
  clearQuizTimer();
  isGeneratingTab = true;
  generatingArtifactKey = artifactKey;
  activeAbortCtrl = new AbortController();
  renderNotebookDom(false);

  const chunks = getIncludedChunks(activeNotebook);
  const genStreamThrottle = createStreamRenderThrottle((full) => {
    const prevEl = document.getElementById('nbGenStreamPreview');
    if (prevEl) prevEl.innerHTML = renderRichMarkdown(full, chunks);
  }, 85);

  try {
    const res = await runStudioGenerator(tabId, {
      chunks,
      subject,
      syllabusBrain: activeNotebook.syllabusBrain,
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
      chapterObj: scope.chapterObj,
      topicObj: scope.topicObj,
      groundingMode: activeNotebook.groundingMode,
      quizOptions: quizSession.config,
      modelOverride,
      returnMeta: true,
      signal: activeAbortCtrl.signal,
      onModelFallback: ({ fromModel, toModel }) => {
        fallbackToastMsg = `Model ${fromModel} unavailable/rate-limited — generated with ${toModel}`;
      },
      onStreamChunk: (_d, full) => {
        genStreamThrottle.update(full);
      }
    });
    genStreamThrottle.cancel();

    setScopedArtifact(activeNotebook, {
      type: tabId,
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      content: res.content,
      mode: res.mode,
      model: res.modelUsed,
      userEdited: false
    });

    if (tabId === 'flashcards') {
      fcSession = { index: 0, ratings: {} };
    }
    if (tabId === 'quiz') {
      quizSession = {
        ...quizSession,
        answers: {},
        shortSelfGrades: {},
        revealedShort: {},
        submitted: false,
        wrongOnly: false,
        suggestDone: false,
        secondsLeft: quizSession.config.timed ? (Array.isArray(res.content) ? res.content.length : 8) * 60 : 0
      };
      if (quizSession.config.timed && quizSession.secondsLeft > 0) {
        startQuizCountdown(subject);
      }
    }

    await saveNotebook(activeNotebook);
  } catch (err) {
    if (err.message !== 'Request cancelled.') {
      fallbackToastMsg = err.message;
    }
  } finally {
    genStreamThrottle.cancel();
    isGeneratingTab = false;
    generatingArtifactKey = null;
    activeAbortCtrl = null;
    renderNotebookDom(false);
  }
}

function startQuizCountdown(subject) {
  clearQuizTimer();
  quizTimerId = setInterval(() => {
    if (quizSession.submitted) {
      clearQuizTimer();
      return;
    }
    quizSession.secondsLeft = Math.max(0, quizSession.secondsLeft - 1);
    const badge = document.getElementById('nbQuizTimerBadge');
    if (badge) {
      const m = Math.floor(quizSession.secondsLeft / 60);
      const s = String(quizSession.secondsLeft % 60).padStart(2, '0');
      badge.textContent = `Time left: ${m}:${s}`;
    }
    if (quizSession.secondsLeft === 0) {
      clearQuizTimer();
      handleGradeQuiz(subject);
    }
  }, 1000);
}

async function handleGradeQuiz(subject) {
  clearQuizTimer();
  const scope = resolveActiveScopeDetails(activeNotebook, subject, 'quiz');
  const artifact = getScopedArtifact(activeNotebook, 'quiz', scope.scopeType, scope.scopeId);
  const qs = Array.isArray(artifact?.content) ? artifact.content : [];

  quizSession.submitted = true;
  let score = 0;
  const wrongQuestions = [];

  qs.forEach((q, idx) => {
    const chosen = quizSession.answers[idx];
    const right =
      q.type === 'short'
        ? quizSession.shortSelfGrades[idx] === 'correct'
        : chosen === q.correctIndex;
    if (right) score++;
    else wrongQuestions.push(q.question);
  });

  const pct = qs.length ? Math.round((score / qs.length) * 100) : 0;
  activeNotebook.quizHistory = [
    {
      id: `qh_${uid()}`,
      createdAt: new Date().toISOString(),
      scopeType: scope.scopeType,
      scopeId: scope.scopeId,
      scopeLabel: scope.scopeLabel,
      score,
      total: qs.length,
      pct,
      model: artifact?.model || 'gemini-4-hydrogen',
      mode: artifact?.mode || 'sources',
      wrongCount: wrongQuestions.length
    },
    ...(activeNotebook.quizHistory || [])
  ].slice(0, 25);

  await saveNotebook(activeNotebook);
  renderNotebookDom(false);
  animateQuizFinish(document.getElementById('nbTabStage'), pct);
}

async function handleFlashcardScore(rating, subject) {
  const scope = resolveActiveScopeDetails(activeNotebook, subject, 'flashcards');
  const artifact = getScopedArtifact(activeNotebook, 'flashcards', scope.scopeType, scope.scopeId);
  const cards = Array.isArray(artifact?.content) ? artifact.content : [];
  if (!cards.length) return;

  const idx = Math.max(0, Math.min(fcSession.index, cards.length - 1));
  const currentCard = cards[idx];
  fcSession.ratings[idx] = rating;
  fcSession.index = (idx + 1) % cards.length;

  const matchedTopic = (subject?.topics || []).find(
    (t) =>
      (currentCard?.topicName &&
        t.name.trim().toLowerCase() === currentCard.topicName.trim().toLowerCase()) ||
      currentCard?.front?.toLowerCase().includes(t.name.toLowerCase())
  );

  if (matchedTopic) {
    setState((prev) => {
      const s = prev.subjects.find((x) => x.id === subject.id);
      const t = s?.topics.find((x) => x.id === matchedTopic.id);
      if (t) advanceSrsWithConfidence(t, rating, toDateKey());
      return prev;
    });
    return;
  }
  renderNotebookDom(false);
}

async function launchBatchQueue({ includeExisting = false, groundingMode = null, types = null } = {}) {
  const state = getState();
  const subject = state.subjects.find((s) => s.id === state.activeSubjectId);
  if (!subject || !activeNotebook) return;

  const { tasks, skippedExisting } = buildChapterGenerationTasks(activeNotebook, subject, {
    includeExisting,
    groundingMode: groundingMode || activeNotebook.groundingMode,
    types: types || queueSelectedTypes
  });

  if (!tasks.length) {
    fallbackToastMsg = `Nothing new to queue (${skippedExisting} artifacts already generated).`;
    renderNotebookDom(false);
    return;
  }

  const chunks = getIncludedChunks(activeNotebook);

  activeQueueRunner = createQueueRunner({
    tasks,
    concurrency: queueConcurrency,
    runTaskFn: async (task, signal) => {
      const res = await runStudioGenerator(task.type, {
        chunks,
        subject,
        syllabusBrain: activeNotebook.syllabusBrain,
        scopeType: task.scopeType,
        scopeId: task.scopeId,
        chapterObj: task.chapterObj,
        topicObj: task.topicObj,
        groundingMode: task.groundingMode,
        returnMeta: true,
        signal,
        onModelFallback: ({ fromModel, toModel }) => {
          fallbackToastMsg = `Queue fallback: ${fromModel} -> ${toModel}`;
        }
      });
      setScopedArtifact(activeNotebook, {
        type: task.type,
        scopeType: task.scopeType,
        scopeId: task.scopeId,
        scopeLabel: task.scopeLabel,
        content: res.content,
        mode: res.mode,
        model: res.modelUsed
      });
      return res;
    },
    onProgress: (snap) => {
      queueSnapshot = snap;
      activeNotebook.queueState = snap;
      const { topTab } = getActiveWorkspaceState(activeNotebook);
      if (queueModalOpen || topTab === 'home') {
        renderNotebookDom(false);
      }
    },
    onComplete: async (snap) => {
      queueSnapshot = snap;
      activeNotebook.queueState = snap;
      await saveNotebook(activeNotebook);
      renderNotebookDom(false);
    }
  });

  queueModalOpen = true;
  renderNotebookDom(false);
  await activeQueueRunner.start();
}

function attachAriaTabKeyboardNav() {
  const tabButtons = Array.from(
    document.querySelectorAll('#nbTopTabBar [role="tab"]')
  );
  tabButtons.forEach((btn, idx) => {
    btn.addEventListener('keydown', (e) => {
      let targetIdx = -1;
      if (e.key === 'ArrowRight') {
        targetIdx = (idx + 1) % tabButtons.length;
      } else if (e.key === 'ArrowLeft') {
        targetIdx = (idx - 1 + tabButtons.length) % tabButtons.length;
      } else if (e.key === 'Home') {
        targetIdx = 0;
      } else if (e.key === 'End') {
        targetIdx = tabButtons.length - 1;
      }
      if (targetIdx >= 0) {
        e.preventDefault();
        const nextBtn = tabButtons[targetIdx];
        const nextTabId = nextBtn?.getAttribute('data-nb-top-tab');
        if (nextTabId) {
          switchTab(nextTabId).then(() => {
            document.getElementById(`nbTab_${nextTabId}`)?.focus();
          });
        }
      }
    });
  });
}

function attachNotebookEvents(subject, allChunks, vaultConfig, liveModels) {
  if (docListenersAbort) docListenersAbort.abort();
  docListenersAbort = new AbortController();
  const sig = docListenersAbort.signal;

  // Global Escape handler & modal/drawer focus trap
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Tab' && activeTrapContainer && activeTrapContainer.isConnected) {
        const focusables = Array.from(activeTrapContainer.querySelectorAll(FOCUSABLE_SELECTOR));
        if (focusables.length) {
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (e.shiftKey && (document.activeElement === first || !activeTrapContainer.contains(document.activeElement))) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
        return;
      }

      if (e.key === 'Escape') {
        if (
          splitMenuOpen ||
          addSourceMenuOpen ||
          chatDrawerOpen ||
          scopeSheetOpen ||
          scanModalOpen ||
          treeModalOpen ||
          applyLedgerModalOpen ||
          queueModalOpen ||
          keyModalOpen ||
          pasteModalOpen ||
          topicNotesModalOpen ||
          pdfPreviewOpen ||
          versionModalKey ||
          confirmRegenState ||
          isNotebookFullscreen
        ) {
          e.preventDefault();
          if (
            splitMenuOpen ||
            addSourceMenuOpen ||
            chatDrawerOpen ||
            scopeSheetOpen ||
            scanModalOpen ||
            treeModalOpen ||
            applyLedgerModalOpen ||
            queueModalOpen ||
            keyModalOpen ||
            pasteModalOpen ||
            topicNotesModalOpen ||
            pdfPreviewOpen ||
            versionModalKey ||
            confirmRegenState
          ) {
            splitMenuOpen = false;
            addSourceMenuOpen = false;
            chatDrawerOpen = false;
            scopeSheetOpen = false;
            scanModalOpen = false;
            treeModalOpen = false;
            applyLedgerModalOpen = false;
            queueModalOpen = false;
            keyModalOpen = false;
            confirmDeleteKey = false;
            pasteModalOpen = false;
            topicNotesModalOpen = false;
            pdfPreviewOpen = false;
            versionModalKey = null;
            confirmRegenState = null;
          } else if (isNotebookFullscreen) {
            setNotebookFullscreen(false);
            return;
          }
          renderNotebookDom(false);
        }
      }
    },
    { signal: sig }
  );

  // Recompute open popover coordinates on viewport resize or scroll
  if (splitMenuOpen || addSourceMenuOpen) {
    window.addEventListener('resize', repositionOpenPopovers, { passive: true, signal: sig });
    window.addEventListener('scroll', repositionOpenPopovers, { capture: true, passive: true, signal: sig });
  }

  document.addEventListener(
    'click',
    (e) => {
      const needCloseSplit =
        splitMenuOpen && !e.target.closest('.nb-split-wrap');
      const needCloseAddSrc =
        addSourceMenuOpen && !e.target.closest('#nbAddSourceMenu') && !e.target.closest('#nbAddSourceMenuBtn');

      if (needCloseSplit || needCloseAddSrc) {
        if (needCloseSplit) splitMenuOpen = false;
        if (needCloseAddSrc) addSourceMenuOpen = false;
        renderNotebookDom(false);
      }
    },
    { signal: sig }
  );

  // Header controls
  document.getElementById('nbDismissToastBtn')?.addEventListener('click', () => {
    fallbackToastMsg = '';
    renderNotebookDom(false);
  });

  document.querySelectorAll('[data-nb-grounding]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const mode = btn.getAttribute('data-nb-grounding');
      if (!mode || activeNotebook.groundingMode === mode) return;
      activeNotebook.groundingMode = mode;
      await saveNotebook(activeNotebook);
      renderNotebookDom(false);
    });
  });

  document.getElementById('nbOpenQueuePillBtn')?.addEventListener('click', () => {
    queueModalOpen = true;
    renderNotebookDom(false);
  });

  document.querySelectorAll('[data-nb-set-fx]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setFxLevel(btn.getAttribute('data-nb-set-fx'));
      renderNotebookDom(false);
    });
  });

  document.getElementById('nbToggleOutlineRailBtn')?.addEventListener('click', () => {
    isOutlineCollapsed = !isOutlineCollapsed;
    renderNotebookDom(false);
  });

  document.getElementById('nbToggleFullscreenBtn')?.addEventListener('click', () => {
    setNotebookFullscreen(!isNotebookFullscreen);
  });

  document.getElementById('nbExportPdfBtn')?.addEventListener('click', () => {
    pdfPreviewOpen = true;
    renderNotebookDom(false);
  });
  document.getElementById('nbClosePdfPreviewBtn')?.addEventListener('click', () => {
    pdfPreviewOpen = false;
    renderNotebookDom(false);
  });
  document.getElementById('nbClosePdfPreviewFooterBtn')?.addEventListener('click', () => {
    pdfPreviewOpen = false;
    renderNotebookDom(false);
  });
  document.getElementById('nbPdfPreviewBackdrop')?.addEventListener('click', (e) => {
    if (e.target.id === 'nbPdfPreviewBackdrop') {
      pdfPreviewOpen = false;
      renderNotebookDom(false);
    }
  });
  document.getElementById('nbPrintPdfBtn')?.addEventListener('click', () => {
    const htmlDoc = buildActivePdfDocument(subject, allChunks);
    printHtmlDocument(htmlDoc);
  });

  document.getElementById('nbOpenKeyModalBtn')?.addEventListener('click', () => {
    keyModalOpen = true;
    confirmDeleteKey = false;
    keyTestError = '';
    keyTestStatus = '';
    pingResultText = '';
    renderNotebookDom(false);
  });

  // Model pickers in Key & Routing Modal
  document.querySelectorAll('[data-nb-pick-model]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const picked = btn.getAttribute('data-nb-pick-model');
      if (!picked) return;
      updateModelSettings({ model: picked, preset: 'custom', customModel: '' });
      renderNotebookDom(false);
    });
  });

  // Top 6-Tab Navigation + View Chips + In-Page Segments + Deep Links
  document.querySelectorAll('[data-nb-top-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('data-nb-top-tab');
      if (next) switchTab(next);
    });
  });

  document.querySelectorAll('[data-nb-tab-select]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('data-nb-tab-select');
      if (next) switchTab(next);
    });
  });

  document.querySelectorAll('[data-nb-learn-view]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const nextView = btn.getAttribute('data-nb-learn-view');
      if (!nextView || activeNotebook.activeLearnView === nextView) return;
      activeNotebook.activeTab = 'learn';
      activeNotebook.activeLearnView = nextView;
      editNoteMode = false;
      splitMenuOpen = false;
      await saveNotebook(activeNotebook);
      renderNotebookDom(false);
      maybeAutoGenerateOnTabOpen();
    });
  });

  document.querySelectorAll('[data-nb-practice-view]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const nextView = btn.getAttribute('data-nb-practice-view');
      if (!nextView || activeNotebook.activePracticeView === nextView) return;
      activeNotebook.activeTab = 'practice';
      activeNotebook.activePracticeView = nextView;
      splitMenuOpen = false;
      await saveNotebook(activeNotebook);
      renderNotebookDom(false);
      maybeAutoGenerateOnTabOpen();
    });
  });

  document.querySelectorAll('[data-nb-notes-mode]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const mode = btn.getAttribute('data-nb-notes-mode');
      if (!mode || activeNotebook.activeNotesMode === mode) return;
      activeNotebook.activeNotesMode = mode;
      editNoteMode = false;
      splitMenuOpen = false;
      await saveNotebook(activeNotebook);
      renderNotebookDom(false);
      if (mode === 'ai') maybeAutoGenerateOnTabOpen();
    });
  });

  document.querySelectorAll('[data-nb-quiz-mode]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const mode = btn.getAttribute('data-nb-quiz-mode');
      if (!mode || activeNotebook.activeQuizMode === mode) return;
      activeNotebook.activeQuizMode = mode;
      splitMenuOpen = false;
      await saveNotebook(activeNotebook);
      renderNotebookDom(false);
    });
  });

  attachAriaTabKeyboardNav();

  // HOME TAB: Syllabus Dropzone, Scan Modal & Review Tree Modal
  const sylDrop = document.getElementById('nbSyllabusDropZone');
  if (sylDrop) {
    sylDrop.addEventListener('dragover', (e) => {
      e.preventDefault();
      sylDrop.classList.add('drag-over');
    });
    sylDrop.addEventListener('dragleave', () => sylDrop.classList.remove('drag-over'));
    sylDrop.addEventListener('drop', (e) => {
      e.preventDefault();
      sylDrop.classList.remove('drag-over');
      runSyllabusScanFiles(e.dataTransfer?.files);
    });
    sylDrop.addEventListener('paste', (e) => {
      const files = Array.from(e.clipboardData?.items || [])
        .filter((it) => it.kind === 'file')
        .map((it) => it.getAsFile())
        .filter(Boolean);
      if (files.length) {
        e.preventDefault();
        runSyllabusScanFiles(files);
      }
    });
  }

  document.getElementById('nbSyllabusFileInput')?.addEventListener('change', (e) => {
    runSyllabusScanFiles(e.target.files);
  });
  document.getElementById('nbSyllabusCameraInput')?.addEventListener('change', (e) => {
    runSyllabusScanFiles(e.target.files);
  });
  document.getElementById('nbBuildFromLedgerBtn')?.addEventListener('click', () => {
    pendingSyllabusDraft = buildSyllabusBrainFromSubject(subject);
    scanModalOpen = false;
    treeModalOpen = true;
    renderNotebookDom(false);
  });
  document.getElementById('nbCancelRescanBtn')?.addEventListener('click', () => {
    scanModalOpen = false;
    syllabusScanError = '';
    renderNotebookDom(false);
  });
  document.getElementById('nbRescanSyllabusBtn')?.addEventListener('click', () => {
    syllabusScanError = '';
    scanModalOpen = true;
    renderNotebookDom(false);
  });
  document.getElementById('nbEditBrainBtn')?.addEventListener('click', () => {
    pendingSyllabusDraft = activeNotebook.syllabusBrain
      ? JSON.parse(JSON.stringify(activeNotebook.syllabusBrain))
      : buildSyllabusBrainFromSubject(subject);
    treeModalOpen = true;
    renderNotebookDom(false);
  });

  document.getElementById('nbValidateJsonPasteBtn')?.addEventListener('click', () => {
    const raw = document.getElementById('nbSyllabusPasteInput')?.value || '';
    syllabusPasteText = raw;
    try {
      pendingSyllabusDraft = validateAndNormalizeSyllabusBrain(raw, subject.name);
      syllabusScanError = '';
      scanModalOpen = false;
      treeModalOpen = true;
    } catch (err) {
      syllabusScanError = err.message;
    }
    renderNotebookDom(false);
  });

  document.getElementById('nbParsePastedSyllabusBtn')?.addEventListener('click', async () => {
    const raw = document.getElementById('nbSyllabusPasteInput')?.value.trim() || '';
    if (!raw) return;
    syllabusPasteText = raw;
    syllabusScanning = true;
    syllabusScanError = '';
    renderNotebookDom(false);
    try {
      const { brain } = await extractSyllabusBrainFromInputs({
        text: raw,
        subjectName: subject.name
      });
      pendingSyllabusDraft = brain;
      syllabusScanning = false;
      scanModalOpen = false;
      treeModalOpen = true;
    } catch (err) {
      syllabusScanError = err.message;
    } finally {
      syllabusScanning = false;
      renderNotebookDom(false);
    }
  });

  // Review Tree modal handlers
  if (treeModalOpen && pendingSyllabusDraft) {
    document.getElementById('nbTreeSubjectName')?.addEventListener('input', (e) => {
      pendingSyllabusDraft.subjectName = e.target.value;
    });
    document.getElementById('nbTreeExamDate')?.addEventListener('change', (e) => {
      pendingSyllabusDraft.examDate = e.target.value || null;
    });
    document.querySelectorAll('[data-nb-tree-ch-name]').forEach((inp) => {
      inp.addEventListener('input', (e) => {
        const cIdx = Number(inp.getAttribute('data-nb-tree-ch-name'));
        if (pendingSyllabusDraft.chapters[cIdx]) {
          pendingSyllabusDraft.chapters[cIdx].name = e.target.value;
        }
      });
    });
    document.querySelectorAll('[data-nb-tree-tp-name]').forEach((inp) => {
      inp.addEventListener('input', (e) => {
        const [cIdx, tIdx] = inp.getAttribute('data-nb-tree-tp-name').split(':').map(Number);
        if (pendingSyllabusDraft.chapters[cIdx]?.topics[tIdx]) {
          pendingSyllabusDraft.chapters[cIdx].topics[tIdx].name = e.target.value;
        }
      });
    });
    document.querySelectorAll('[data-nb-tree-tp-subs]').forEach((inp) => {
      inp.addEventListener('input', (e) => {
        const [cIdx, tIdx] = inp.getAttribute('data-nb-tree-tp-subs').split(':').map(Number);
        if (pendingSyllabusDraft.chapters[cIdx]?.topics[tIdx]) {
          pendingSyllabusDraft.chapters[cIdx].topics[tIdx].subtopics = e.target.value
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        }
      });
    });
    document.querySelectorAll('[data-nb-tree-add-tp]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cIdx = Number(btn.getAttribute('data-nb-tree-add-tp'));
        pendingSyllabusDraft.chapters[cIdx]?.topics.push({
          id: `tp_${uid()}`,
          name: 'New Topic',
          subtopics: []
        });
        renderNotebookDom(false);
      });
    });
    document.querySelectorAll('[data-nb-tree-del-tp]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const [cIdx, tIdx] = btn.getAttribute('data-nb-tree-del-tp').split(':').map(Number);
        pendingSyllabusDraft.chapters[cIdx]?.topics.splice(tIdx, 1);
        renderNotebookDom(false);
      });
    });
    document.querySelectorAll('[data-nb-tree-del-ch]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cIdx = Number(btn.getAttribute('data-nb-tree-del-ch'));
        pendingSyllabusDraft.chapters.splice(cIdx, 1);
        renderNotebookDom(false);
      });
    });
    document.querySelectorAll('[data-nb-tree-merge-ch]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cIdx = Number(btn.getAttribute('data-nb-tree-merge-ch'));
        if (cIdx > 0 && pendingSyllabusDraft.chapters[cIdx]) {
          const prev = pendingSyllabusDraft.chapters[cIdx - 1];
          const cur = pendingSyllabusDraft.chapters[cIdx];
          prev.topics = [...(prev.topics || []), ...(cur.topics || [])];
          pendingSyllabusDraft.chapters.splice(cIdx, 1);
          renderNotebookDom(false);
        }
      });
    });
    document.getElementById('nbTreeAddChapterBtn')?.addEventListener('click', () => {
      pendingSyllabusDraft.chapters.push({
        id: `ch_${uid()}`,
        name: `Chapter ${pendingSyllabusDraft.chapters.length + 1}`,
        topics: []
      });
      renderNotebookDom(false);
    });
    const discardTree = () => {
      pendingSyllabusDraft = null;
      treeModalOpen = false;
      renderNotebookDom(false);
    };
    document.getElementById('nbTreeDiscardBtn')?.addEventListener('click', discardTree);
    document.getElementById('nbTreeDiscardBottomBtn')?.addEventListener('click', discardTree);

    document.getElementById('nbTreeLooksGoodBtn')?.addEventListener('click', async () => {
      activeNotebook.syllabusBrain = validateAndNormalizeSyllabusBrain(
        pendingSyllabusDraft,
        subject.name
      );
      pendingSyllabusDraft = null;
      treeModalOpen = false;
      scanModalOpen = false;
      activeNotebook.activeTab = 'home';
      await saveNotebook(activeNotebook);
      renderNotebookDom(false);
    });
  }

  // Overview jumps & Apply to Ledger modal
  document.querySelectorAll('[data-nb-jump]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-nb-jump');
      const chId = btn.getAttribute('data-nb-jump-ch');
      const tpId = btn.getAttribute('data-nb-jump-tp');
      const scType = btn.getAttribute('data-nb-jump-scope') || 'chapter';
      switchTab(tabId, { scopeType: scType, chapterId: chId, topicId: tpId || null });
    });
  });

  document.getElementById('nbApplyToLedgerBtn')?.addEventListener('click', () => {
    applyLedgerModalOpen = true;
    renderNotebookDom(false);
  });
  document.getElementById('nbCloseApplyLedgerBtn')?.addEventListener('click', () => {
    applyLedgerModalOpen = false;
    renderNotebookDom(false);
  });
  document.getElementById('nbCancelApplyLedgerBtn')?.addEventListener('click', () => {
    applyLedgerModalOpen = false;
    renderNotebookDom(false);
  });
  document.getElementById('nbConfirmApplyLedgerBtn')?.addEventListener('click', async () => {
    const { ledgerSyllabus } = syllabusBrainToLedgerSyllabus(
      activeNotebook.syllabusBrain,
      subject,
      subject.name
    );
    const { nextState } = mergeSyllabusIntoState(getState(), ledgerSyllabus);
    applyLedgerModalOpen = false;
    activeNotebook.activeTab = 'home';
    await saveNotebook(activeNotebook);
    fallbackToastMsg = 'Syllabus Brain topics synced into Ledger!';
    setState(nextState);
  });

  // Upgrade syllabus-guided items -> grounded
  document.getElementById('nbUpgradeGroundedBtn')?.addEventListener('click', () => {
    const syllabusTasks = [];
    const brain = activeNotebook.syllabusBrain || buildSyllabusBrainFromSubject(subject);
    const chMap = new Map((brain?.chapters || []).map((c) => [c.id, c]));

    Object.values(activeNotebook.artifactsMap || {}).forEach((art) => {
      if (art?.mode === 'syllabus' && art.type !== 'notes') {
        syllabusTasks.push({
          id: `upg_${art.key}`,
          type: art.type,
          scopeType: art.scopeType,
          scopeId: art.scopeId,
          scopeLabel: art.scopeLabel || subject.name,
          chapterObj: chMap.get(art.scopeId) || null,
          topicObj: null,
          groundingMode: 'sources',
          status: 'pending'
        });
      }
    });

    if (!syllabusTasks.length) {
      fallbackToastMsg = 'Use Regenerate inside Topic Notes or open Queue to regenerate grounded chapter tabs.';
      renderNotebookDom(false);
      return;
    }

    const chunks = getIncludedChunks(activeNotebook);
    activeQueueRunner = createQueueRunner({
      tasks: syllabusTasks,
      concurrency: queueConcurrency,
      runTaskFn: async (task, signal) => {
        const res = await runStudioGenerator(task.type, {
          chunks,
          subject,
          syllabusBrain: activeNotebook.syllabusBrain,
          scopeType: task.scopeType,
          scopeId: task.scopeId,
          chapterObj: task.chapterObj,
          groundingMode: 'sources',
          returnMeta: true,
          signal
        });
        setScopedArtifact(activeNotebook, {
          type: task.type,
          scopeType: task.scopeType,
          scopeId: task.scopeId,
          scopeLabel: task.scopeLabel,
          content: res.content,
          mode: 'sources',
          model: res.modelUsed
        });
        return res;
      },
      onProgress: (snap) => {
        queueSnapshot = snap;
        const { topTab } = getActiveWorkspaceState(activeNotebook);
        if (queueModalOpen || topTab === 'home') renderNotebookDom(false);
      },
      onComplete: async (snap) => {
        queueSnapshot = snap;
        await saveNotebook(activeNotebook);
        renderNotebookDom(false);
      }
    });
    queueModalOpen = true;
    renderNotebookDom(false);
    activeQueueRunner.start();
  });

  // Batch Generate Everything Queue
  document.getElementById('nbOpenQueueModalBtn')?.addEventListener('click', () => {
    queueModalOpen = true;
    renderNotebookDom(false);
  });
  document.getElementById('nbCloseQueueBtn')?.addEventListener('click', () => {
    queueModalOpen = false;
    renderNotebookDom(false);
  });
  document.getElementById('nbQueueIncludeExistingCb')?.addEventListener('change', (e) => {
    queueIncludeExisting = e.target.checked;
  });
  document.getElementById('nbQueueConcurrencySelect')?.addEventListener('change', (e) => {
    queueConcurrency = Number(e.target.value) === 2 ? 2 : 1;
  });
  document.querySelectorAll('.nb-queue-type-cb').forEach((cb) => {
    cb.addEventListener('change', () => {
      queueSelectedTypes = Array.from(document.querySelectorAll('.nb-queue-type-cb:checked')).map(
        (x) => x.value
      );
    });
  });
  document.getElementById('nbStartQueueBtn')?.addEventListener('click', () => {
    launchBatchQueue({ includeExisting: queueIncludeExisting, types: queueSelectedTypes });
  });
  document.getElementById('nbPauseQueueBtn')?.addEventListener('click', () => activeQueueRunner?.pause());
  document.getElementById('nbResumeQueueBtn')?.addEventListener('click', () => activeQueueRunner?.resume());
  document.getElementById('nbCancelQueueBtn')?.addEventListener('click', () => activeQueueRunner?.cancel());

  // SOURCES TAB
  const srcDrop = document.getElementById('nbDropZone');
  if (srcDrop) {
    srcDrop.addEventListener('dragover', (e) => {
      e.preventDefault();
      srcDrop.classList.add('drag-over');
    });
    srcDrop.addEventListener('dragleave', () => srcDrop.classList.remove('drag-over'));
    srcDrop.addEventListener('drop', (e) => {
      e.preventDefault();
      srcDrop.classList.remove('drag-over');
      processAddedSourceFiles(e.dataTransfer?.files);
    });
  }
  document.getElementById('nbSourcesPanel')?.addEventListener('paste', (e) => {
    const files = Array.from(e.clipboardData?.items || [])
      .filter((it) => it.kind === 'file')
      .map((it) => it.getAsFile())
      .filter(Boolean);
    if (files.length) {
      e.preventDefault();
      processAddedSourceFiles(files);
    }
  });
  document.getElementById('nbAddSourceMenuBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    addSourceMenuOpen = !addSourceMenuOpen;
    splitMenuOpen = false;
    renderNotebookDom(false);
  });
  document.getElementById('nbAddPasteBtn')?.addEventListener('click', () => {
    addSourceMenuOpen = false;
    pasteModalOpen = true;
    renderNotebookDom(false);
  });
  document.getElementById('nbAddNotesBtn')?.addEventListener('click', () => {
    addSourceMenuOpen = false;
    topicNotesModalOpen = true;
    renderNotebookDom(false);
  });
  document.getElementById('nbFileInput')?.addEventListener('change', (e) => {
    addSourceMenuOpen = false;
    processAddedSourceFiles(e.target.files);
  });
  document.getElementById('nbCameraInput')?.addEventListener('change', (e) => {
    addSourceMenuOpen = false;
    processAddedSourceFiles(e.target.files);
  });
  document.querySelectorAll('[data-nb-toggle-src]').forEach((cb) => {
    cb.addEventListener('change', async () => {
      const src = activeNotebook.sources.find((s) => s.id === cb.getAttribute('data-nb-toggle-src'));
      if (src) src.included = cb.checked;
      await saveNotebook(activeNotebook);
      renderNotebookDom(false);
    });
  });
  document.querySelectorAll('[data-nb-del-src]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-nb-del-src');
      activeNotebook.sources = activeNotebook.sources.filter((s) => s.id !== id);
      await saveNotebook(activeNotebook);
      renderNotebookDom(false);
    });
  });
  document.querySelectorAll('[data-chunk-id]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const cid = chip.getAttribute('data-chunk-id');
      highlightedChunkId = highlightedChunkId === cid ? null : cid;
      renderNotebookDom(false);
    });
  });

  // CHAT TAB
  document.getElementById('nbToggleChatDrawerBtn')?.addEventListener('click', () => {
    chatDrawerOpen = !chatDrawerOpen;
    renderNotebookDom(false);
  });
  document.getElementById('nbCloseChatDrawerBtn')?.addEventListener('click', () => {
    chatDrawerOpen = false;
    citationDrawerChunkId = null;
    renderNotebookDom(false);
  });
  document.getElementById('nbChatForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const inp = document.getElementById('nbChatInput');
    const q = inp?.value.trim();
    if (!q) return;
    inp.value = '';
    handleChatSubmit(q, allChunks);
  });
  document.getElementById('nbCancelStreamBtn')?.addEventListener('click', () => {
    activeAbortCtrl?.abort();
  });
  document.getElementById('nbClearChatBtn')?.addEventListener('click', async () => {
    activeNotebook.chatHistory = [];
    citationDrawerChunkId = null;
    await saveNotebook(activeNotebook);
    renderNotebookDom(false);
  });
  document.getElementById('nbChatModelOverrideSelect')?.addEventListener('change', (e) => {
    updateModelSettings({
      taskRouting: { ...getKeyVaultConfig().taskRouting, chat: e.target.value }
    });
    renderNotebookDom(false);
  });
  document.getElementById('nbExportChatMdBtn')?.addEventListener('click', () => {
    if (!activeNotebook.chatHistory?.length) return;
    const md = activeNotebook.chatHistory
      .map((m) => `### ${m.role === 'user' ? 'You' : 'Gemini Notebook'}\n\n${m.text}`)
      .join('\n\n---\n\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${subject.name.replace(/[^a-z0-9-_]+/gi, '_')}_chat.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
  document.querySelectorAll('[data-cite-chunk]').forEach((btn) => {
    btn.addEventListener('click', () => {
      citationDrawerChunkId = btn.getAttribute('data-cite-chunk');
      highlightedChunkId = citationDrawerChunkId;
      chatDrawerOpen = true;
      renderNotebookDom(false);
    });
  });
  document.getElementById('nbCloseCiteDrawerBtn')?.addEventListener('click', () => {
    citationDrawerChunkId = null;
    renderNotebookDom(false);
  });
  document.querySelectorAll('[data-nb-speak]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const msg = activeNotebook.chatHistory.find((m) => m.id === btn.getAttribute('data-nb-speak'));
      if (msg) speakText(msg.text);
    });
  });

  // GENERATOR TABS SCOPE & ACTIONS
  document.getElementById('nbScopeChipBtn')?.addEventListener('click', () => {
    scopeSheetOpen = true;
    splitMenuOpen = false;
    renderNotebookDom(false);
  });
  document.getElementById('nbCloseScopeSheetBtn')?.addEventListener('click', () => {
    scopeSheetOpen = false;
    renderNotebookDom(false);
  });
  document.getElementById('nbScopeSheetBackdrop')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      scopeSheetOpen = false;
      renderNotebookDom(false);
    }
  });
  document.querySelectorAll('[data-nb-pick-scope]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const raw = btn.getAttribute('data-nb-pick-scope') || '';
      const parts = raw.split(':');
      const scopeType = parts[0] || 'subject';
      const chapterId = parts[1] || null;
      const topicId = parts[2] || null;
      activeNotebook.activeScope = {
        scopeType,
        chapterId: scopeType === 'subject' ? null : chapterId,
        topicId: scopeType === 'topic' ? topicId : null
      };
      scopeSheetOpen = false;
      splitMenuOpen = false;
      await saveNotebook(activeNotebook);
      renderNotebookDom(false);
      maybeAutoGenerateOnTabOpen();
    });
  });
  document.getElementById('nbSplitCaretBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    splitMenuOpen = !splitMenuOpen;
    addSourceMenuOpen = false;
    renderNotebookDom(false);
  });
  document.getElementById('nbTabModelOverrideSelect')?.addEventListener('change', (e) => {
    const { activeTool } = getActiveWorkspaceState(activeNotebook);
    const val = e.target.value;
    if (val && activeTool) {
      tabModelOverrides[activeTool] = val;
    }
    renderNotebookDom(false);
  });
  document.getElementById('nbAutoGenTabCb')?.addEventListener('change', async (e) => {
    const { activeTool } = getActiveWorkspaceState(activeNotebook);
    const scope = resolveActiveScopeDetails(activeNotebook, subject, activeTool || 'notes');
    if (scope.scopeType === 'subject') {
      activeNotebook.autoGenerateOnTabOpen.wholeSubject = e.target.checked;
    } else {
      activeNotebook.autoGenerateOnTabOpen.scoped = e.target.checked;
    }
    await saveNotebook(activeNotebook);
  });

  const triggerTabGen = (confirmed = false, extraOpts = {}) => {
    const { activeTool } = getActiveWorkspaceState(activeNotebook);
    const genTabId = extraOpts.forceTabId || activeTool || 'notes';
    const modelOverride =
      document.getElementById('nbTabModelOverrideSelect')?.value ||
      tabModelOverrides[genTabId] ||
      null;
    splitMenuOpen = false;
    runTabGenerator(genTabId, subject, { modelOverride, confirmed, ...extraOpts });
  };
  document.getElementById('nbRunActiveGenBtn')?.addEventListener('click', () => triggerTabGen(false));
  document.getElementById('nbEmptyGenerateBtn')?.addEventListener('click', () => triggerTabGen(true));
  document.getElementById('nbCancelRegenBtn')?.addEventListener('click', () => {
    confirmRegenState = null;
    renderNotebookDom(false);
  });
  document.getElementById('nbCancelRegenBottomBtn')?.addEventListener('click', () => {
    confirmRegenState = null;
    renderNotebookDom(false);
  });
  document.getElementById('nbConfirmRegenBtn')?.addEventListener('click', () => {
    if (!confirmRegenState) return;
    const { tabId, scope, modelOverride } = confirmRegenState;
    runTabGenerator(tabId, subject, {
      scopeOverride: scope,
      modelOverride,
      confirmed: true
    });
  });

  // Version Compare & Restore
  document.getElementById('nbOpenVersionsBtn')?.addEventListener('click', (e) => {
    versionModalKey = e.currentTarget.getAttribute('data-artifact-key');
    selectedVersionIdx = 0;
    renderNotebookDom(false);
  });
  document.getElementById('nbCloseVersionsBtn')?.addEventListener('click', () => {
    versionModalKey = null;
    renderNotebookDom(false);
  });
  document.getElementById('nbCloseVersionsBottomBtn')?.addEventListener('click', () => {
    versionModalKey = null;
    renderNotebookDom(false);
  });
  document.querySelectorAll('[data-nb-select-ver]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedVersionIdx = Number(btn.getAttribute('data-nb-select-ver')) || 0;
      renderNotebookDom(false);
    });
  });
  document.getElementById('nbRestoreVersionBtn')?.addEventListener('click', async (e) => {
    const vIdx = Number(e.currentTarget.getAttribute('data-nb-restore-ver')) || 0;
    if (versionModalKey) {
      restoreArtifactVersion(activeNotebook, versionModalKey, vIdx);
      await saveNotebook(activeNotebook);
      versionModalKey = null;
      renderNotebookDom(false);
    }
  });

  // Notes Personal Sync, Edit, Copy, Download .md
  document.getElementById('nbSavePersonalNoteBtn')?.addEventListener('click', (e) => {
    const tid = e.currentTarget.getAttribute('data-ledger-topic-id');
    const val = document.getElementById('nbPersonalNoteInput')?.value || '';
    fallbackToastMsg = 'Personal notes synced to Ledger topic.';
    setState((prev) => {
      const s = prev.subjects.find((x) => x.id === subject.id);
      const t = s?.topics.find((x) => x.id === tid);
      if (t) t.notes = val;
      return prev;
    });
  });

  document.getElementById('nbToggleNoteEditBtn')?.addEventListener('click', () => {
    editNoteMode = !editNoteMode;
    splitMenuOpen = false;
    renderNotebookDom(false);
  });
  document.getElementById('nbSaveEditedArtifactBtn')?.addEventListener('click', async (e) => {
    const key = e.currentTarget.getAttribute('data-artifact-key');
    const nextText = document.getElementById('nbEditArtifactTextarea')?.value || '';
    if (key && activeNotebook.artifactsMap[key]) {
      const cur = activeNotebook.artifactsMap[key];
      setScopedArtifact(activeNotebook, {
        type: cur.type,
        scopeType: cur.scopeType,
        scopeId: cur.scopeId,
        scopeLabel: cur.scopeLabel,
        content: nextText,
        mode: cur.mode,
        model: cur.model,
        userEdited: true
      });
      await saveNotebook(activeNotebook);
    }
    editNoteMode = false;
    renderNotebookDom(false);
  });
  document.getElementById('nbCopyMdBtn')?.addEventListener('click', () => {
    const { activeTool } = getActiveWorkspaceState(activeNotebook);
    const toolId = activeTool || 'notes';
    const scope = resolveActiveScopeDetails(activeNotebook, subject, toolId);
    const art = getScopedArtifact(activeNotebook, toolId, scope.scopeType, scope.scopeId);
    splitMenuOpen = false;
    if (typeof art?.content === 'string') {
      navigator.clipboard?.writeText(art.content);
      fallbackToastMsg = 'Copied Markdown to clipboard.';
      renderNotebookDom(false);
    }
  });
  document.getElementById('nbDownloadMdBtn')?.addEventListener('click', () => {
    const { activeTool } = getActiveWorkspaceState(activeNotebook);
    const toolId = activeTool || 'notes';
    const scope = resolveActiveScopeDetails(activeNotebook, subject, toolId);
    const art = getScopedArtifact(activeNotebook, toolId, scope.scopeType, scope.scopeId);
    splitMenuOpen = false;
    if (typeof art?.content === 'string') {
      const blob = new Blob([art.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${scope.scopeLabel.replace(/[^a-z0-9-_]+/gi, '_')}_${toolId}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }
  });
  document.getElementById('nbSpeakArtifactBtn')?.addEventListener('click', () => {
    const { activeTool } = getActiveWorkspaceState(activeNotebook);
    const toolId = activeTool || 'notes';
    const scope = resolveActiveScopeDetails(activeNotebook, subject, toolId);
    const art = getScopedArtifact(activeNotebook, toolId, scope.scopeType, scope.scopeId);
    splitMenuOpen = false;
    if (typeof art?.content === 'string') speakText(art.content);
  });

  // Flashcards
  document.querySelectorAll('[data-nb-fc-score]').forEach((btn) => {
    btn.addEventListener('click', () => handleFlashcardScore(btn.getAttribute('data-nb-fc-score'), subject));
  });
  document.getElementById('nbShuffleDeckBtn')?.addEventListener('click', async () => {
    const scope = resolveActiveScopeDetails(activeNotebook, subject, 'flashcards');
    const art = getScopedArtifact(activeNotebook, 'flashcards', scope.scopeType, scope.scopeId);
    if (Array.isArray(art?.content)) {
      art.content = shuffleItems(art.content);
      fcSession = { index: 0, ratings: {} };
      await saveNotebook(activeNotebook);
      renderNotebookDom(false);
    }
  });

  // Quiz config & interactions
  document.getElementById('nbQuizCountSel')?.addEventListener('change', (e) => {
    quizSession.config.count = Number(e.target.value) || 8;
  });
  document.getElementById('nbQuizDiffSel')?.addEventListener('change', (e) => {
    quizSession.config.difficulty = e.target.value;
  });
  document.querySelectorAll('.nb-quiz-type-cb').forEach((cb) => {
    cb.addEventListener('change', () => {
      const sel = Array.from(document.querySelectorAll('.nb-quiz-type-cb:checked')).map((x) => x.value);
      quizSession.config.questionTypes = sel.length ? sel : ['mcq'];
    });
  });
  document.getElementById('nbQuizTimedCb')?.addEventListener('change', (e) => {
    quizSession.config.timed = e.target.checked;
  });
  document.getElementById('nbQuizInstantCb')?.addEventListener('change', (e) => {
    quizSession.config.instantFeedback = e.target.checked;
  });
  document.getElementById('nbQuizWeakBtn')?.addEventListener('click', async () => {
    const weak = (subject.topics || []).filter(
      (t) => !t.practiced || !t.revised || t.confidence === 'hard'
    );
    quizSession.config.weakTopics = weak.slice(0, 8).map((t) => t.name);
    activeNotebook.activeTab = 'practice';
    activeNotebook.activePracticeView = 'quiz';
    activeNotebook.activeQuizMode = 'play';
    await saveNotebook(activeNotebook);
    triggerTabGen(true, { forceTabId: 'quiz' });
  });
  document.getElementById('nbStartConfiguredQuizBtn')?.addEventListener('click', async () => {
    quizSession.config.weakTopics = [];
    activeNotebook.activeTab = 'practice';
    activeNotebook.activePracticeView = 'quiz';
    activeNotebook.activeQuizMode = 'play';
    await saveNotebook(activeNotebook);
    triggerTabGen(true, { forceTabId: 'quiz' });
  });
  document.querySelectorAll('[data-nb-quiz-opt]').forEach((radio) => {
    radio.addEventListener('change', () => {
      const [qIdx, oIdx] = radio.getAttribute('data-nb-quiz-opt').split(':').map(Number);
      quizSession.answers[qIdx] = oIdx;
      if (quizSession.config.instantFeedback) renderNotebookDom(false);
    });
  });
  document.querySelectorAll('[data-nb-short-ans]').forEach((ta) => {
    ta.addEventListener('input', (e) => {
      const qIdx = Number(ta.getAttribute('data-nb-short-ans'));
      quizSession.answers[qIdx] = e.target.value;
    });
  });
  document.querySelectorAll('[data-nb-reveal-short]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const qIdx = Number(btn.getAttribute('data-nb-reveal-short'));
      quizSession.revealedShort[qIdx] = true;
      renderNotebookDom(false);
    });
  });
  document.querySelectorAll('[data-nb-short-mark]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const [qIdx, mark] = btn.getAttribute('data-nb-short-mark').split(':');
      quizSession.shortSelfGrades[Number(qIdx)] = mark;
      renderNotebookDom(false);
    });
  });
  document.getElementById('nbGradeQuizBtn')?.addEventListener('click', () => handleGradeQuiz(subject));
  document.getElementById('nbToggleWrongOnlyBtn')?.addEventListener('click', () => {
    quizSession.wrongOnly = !quizSession.wrongOnly;
    renderNotebookDom(false);
  });
  document.getElementById('nbResetQuizBtn')?.addEventListener('click', () => {
    clearQuizTimer();
    quizSession.answers = {};
    quizSession.shortSelfGrades = {};
    quizSession.revealedShort = {};
    quizSession.submitted = false;
    quizSession.wrongOnly = false;
    quizSession.suggestDone = false;
    renderNotebookDom(false);
  });
  document.getElementById('nbConfirmQuizPracticedBtn')?.addEventListener('click', () => {
    quizSession.suggestDone = true;
    const scope = resolveActiveScopeDetails(activeNotebook, subject, 'quiz');
    const artifact = getScopedArtifact(activeNotebook, 'quiz', scope.scopeType, scope.scopeId);
    const topicNames = new Set(
      (artifact?.content || []).map((q) => q.topicName?.trim().toLowerCase()).filter(Boolean)
    );
    setState((prev) => {
      const s = prev.subjects.find((x) => x.id === subject.id);
      if (!s) return prev;
      let updated = false;
      (s.topics || []).forEach((t) => {
        if (topicNames.has(t.name.trim().toLowerCase())) {
          t.practiced = true;
          t.practiceCount = Math.max(1, (t.practiceCount || 0) + 1);
          updated = true;
        }
      });
      if (!updated && s.topics?.length) {
        const firstUnpracticed = s.topics.find((t) => !t.practiced) || s.topics[0];
        firstUnpracticed.practiced = true;
        firstUnpracticed.practiceCount = Math.max(1, (firstUnpracticed.practiceCount || 0) + 1);
      }
      return prev;
    });
    fallbackToastMsg = 'Confirmed! Matched topics marked as Practiced in Ledger.';
  });

  // Plan accept into Today view & Exam Sync
  document.getElementById('nbPlanExamDateInput')?.addEventListener('change', async (e) => {
    const nextDate = e.target.value || null;
    if (activeNotebook.syllabusBrain) {
      activeNotebook.syllabusBrain.examDate = nextDate;
      await saveNotebook(activeNotebook);
    }
    setState((prev) => {
      const s = prev.subjects.find((x) => x.id === subject.id);
      if (s) s.examDate = nextDate;
      return prev;
    });
  });
  document.getElementById('nbJumpLedgerTodayBtn')?.addEventListener('click', () => {
    setState((prev) => ({ ...prev, activeView: 'today' }));
  });
  document.getElementById('nbApplyRevPlanBtn')?.addEventListener('click', () => {
    const scope = resolveActiveScopeDetails(activeNotebook, subject, 'revisionPlan');
    const planArt = getScopedArtifact(activeNotebook, 'revisionPlan', scope.scopeType, scope.scopeId);
    const sched = planArt?.content?.schedule || [];
    const today = toDateKey();
    setState((prev) => {
      const s = prev.subjects.find((x) => x.id === subject.id);
      if (!s) return prev;
      sched.forEach((item) => {
        const t = s.topics.find(
          (x) => x.name.trim().toLowerCase() === item.topicName.trim().toLowerCase()
        );
        if (t) {
          t.srs.nextDue = addDays(today, Math.max(0, Number(item.offsetDays) || 1));
        }
      });
      return prev;
    });
    fallbackToastMsg = 'Revision Plan dates applied to Today queue!';
  });

  // KEY VAULT & ROUTING MODAL
  document.getElementById('nbCloseKeyModalBtn')?.addEventListener('click', () => {
    keyModalOpen = false;
    confirmDeleteKey = false;
    renderNotebookDom(false);
  });
  document.getElementById('nbCloseKeyModalFooterBtn')?.addEventListener('click', () => {
    keyModalOpen = false;
    confirmDeleteKey = false;
    renderNotebookDom(false);
  });
  document.getElementById('nbUsePassphraseCb')?.addEventListener('change', (e) => {
    const wrap = document.getElementById('nbPassphraseWrap');
    if (wrap) wrap.style.display = e.target.checked ? 'block' : 'none';
  });
  document.getElementById('nbUnlockKeyBtn')?.addEventListener('click', async () => {
    try {
      await unlockApiKey(document.getElementById('nbUnlockPassInput')?.value || '');
      keyTestStatus = 'Key unlocked for this browser session.';
      keyTestError = '';
      await ensureLiveModelsLoaded();
    } catch (err) {
      keyTestError = err.message;
    }
    renderNotebookDom(false);
  });
  document.getElementById('nbTestKeyBtn')?.addEventListener('click', async () => {
    const typedKey = document.getElementById('nbApiKeyInput')?.value.trim() || getActiveApiKey();
    keyTestError = '';
    keyTestStatus = 'Testing key & discovering live generateContent models...';
    renderNotebookDom(false);
    try {
      const res = await testApiKeyAndListModels(typedKey);
      updateModelSettings({ model: res.recommendedModel });
      keyTestStatus = `Connected! Discovered ${res.models.length} generateContent models. Default: ${res.recommendedModel}`;
    } catch (err) {
      keyTestError = err.message;
      keyTestStatus = '';
    }
    renderNotebookDom(false);
  });
  document.getElementById('nbModalModelSearch')?.addEventListener('input', (e) => {
    modelSearchQuery = e.target.value;
    renderNotebookDom(false);
    const inp = document.getElementById('nbModalModelSearch');
    inp?.focus();
    inp?.setSelectionRange(inp.value.length, inp.value.length);
  });
  document.querySelectorAll('[data-nb-modal-preset]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = btn.getAttribute('data-nb-modal-preset');
      updateModelSettings({ preset: p, customModel: '' });
      renderNotebookDom(false);
    });
  });
  document.getElementById('nbModalThinkingSelect')?.addEventListener('change', (e) => {
    const modelId = e.target.getAttribute('data-nb-thinking-model');
    if (modelId) {
      updateModelSettings({
        modelThinking: { ...getKeyVaultConfig().modelThinking, [modelId]: e.target.value }
      });
    }
  });
  document.getElementById('nbPingSelectedModelBtn')?.addEventListener('click', async () => {
    const cfg = getKeyVaultConfig();
    const target = cfg.customModel || cfg.model || DEFAULT_GEMINI_MODEL;
    pingResultText = `Testing ${target}...`;
    renderNotebookDom(false);
    try {
      const res = await testSingleModel(target);
      pingResultText = `OK (${res.latencyMs} ms) · "${res.reply}"`;
    } catch (err) {
      pingResultText = `Error: ${err.message}`;
    }
    renderNotebookDom(false);
  });
  document.getElementById('nbUseSingleModelCb')?.addEventListener('change', (e) => {
    updateModelSettings({ useSingleModel: e.target.checked });
    renderNotebookDom(false);
  });
  document.getElementById('nbRequestDeleteKeyBtn')?.addEventListener('click', () => {
    confirmDeleteKey = true;
    renderNotebookDom(false);
  });
  document.getElementById('nbCancelDeleteKeyBtn')?.addEventListener('click', () => {
    confirmDeleteKey = false;
    renderNotebookDom(false);
  });
  document.getElementById('nbConfirmDeleteKeyBtn')?.addEventListener('click', () => {
    removeApiKey();
    confirmDeleteKey = false;
    const inp = document.getElementById('nbApiKeyInput');
    if (inp) inp.value = '';
    keyTestStatus = 'Stored API key deleted from browser storage and memory.';
    keyTestError = '';
    pingResultText = '';
    renderNotebookDom(false);
  });
  document.getElementById('nbSaveKeyBtn')?.addEventListener('click', async () => {
    const typedKey = document.getElementById('nbApiKeyInput')?.value.trim();
    const usePass = document.getElementById('nbUsePassphraseCb')?.checked;
    const pass = document.getElementById('nbKeyPassphraseInput')?.value || '';
    const customModel = document.getElementById('nbCustomModelInput')?.value.trim() || '';
    const useSingleModel = Boolean(document.getElementById('nbUseSingleModelCb')?.checked);
    const autoFallback = Boolean(document.getElementById('nbAutoFallbackCb')?.checked);
    const fallbackOrder = (document.getElementById('nbFallbackOrderInput')?.value || 'balanced, fast, deep')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const taskRouting = { ...getKeyVaultConfig().taskRouting };
    document.querySelectorAll('[data-nb-task-route]').forEach((sel) => {
      taskRouting[sel.getAttribute('data-nb-task-route')] = sel.value;
    });

    const settingsPayload = {
      customModel,
      useSingleModel,
      autoFallback,
      fallbackOrder,
      taskRouting
    };

    try {
      if (typedKey) {
        if (usePass) {
          await saveApiKeyEncrypted(typedKey, pass, settingsPayload);
        } else {
          saveApiKeyPlain(typedKey, settingsPayload);
        }
        await ensureLiveModelsLoaded();
      } else {
        updateModelSettings(settingsPayload);
      }
      animateKeyLockedMorph(document.getElementById('nbKeyModalBackdrop'));
      keyTestStatus = 'Saved key & routing.';
      keyTestError = '';
      setTimeout(() => {
        keyModalOpen = false;
        renderNotebookDom(false);
      }, 280);
    } catch (err) {
      keyTestError = err.message;
      renderNotebookDom(false);
    }
  });

  // OCR Queue & Paste & Topic Notes Modals
  document.getElementById('nbCloseOcrBtn')?.addEventListener('click', () => {
    ocrQueue.shift();
    renderNotebookDom(false);
    if (ocrQueue.length && ocrQueue[0].status === 'pending') runOcrOnHead();
  });
  document.getElementById('nbOcrRetryBtn')?.addEventListener('click', () => {
    if (ocrQueue.length) runOcrOnHead();
  });
  document.getElementById('nbOcrSaveBtn')?.addEventListener('click', async () => {
    const head = ocrQueue[0];
    if (!head) return;
    const title = document.getElementById('nbOcrTitleInput')?.value.trim() || head.title;
    const text = document.getElementById('nbOcrTextInput')?.value.trim() || head.text;
    if (text) {
      activeNotebook.sources.push(
        createNotebookSource({
          title,
          type: 'image',
          rawText: text,
          thumbnail: head.thumbnail,
          sourceIndex: activeNotebook.sources.length + 1
        })
      );
      await saveNotebook(activeNotebook);
    }
    ocrQueue.shift();
    if (!ocrQueue.length) {
      activeNotebook.activeTab = 'sources';
      await saveNotebook(activeNotebook);
    }
    renderNotebookDom(false);
    if (ocrQueue.length && ocrQueue[0].status === 'pending') runOcrOnHead();
  });

  document.getElementById('nbClosePasteBtn')?.addEventListener('click', () => {
    pasteModalOpen = false;
    renderNotebookDom(false);
  });
  document.getElementById('nbSavePasteSrcBtn')?.addEventListener('click', async () => {
    const title = document.getElementById('nbPasteTitleInput')?.value.trim() || 'Pasted Notes';
    const body = document.getElementById('nbPasteBodyInput')?.value.trim();
    if (!body) return;
    activeNotebook.sources.push(
      createNotebookSource({
        title,
        type: 'paste',
        rawText: body,
        sourceIndex: activeNotebook.sources.length + 1
      })
    );
    pasteModalOpen = false;
    activeNotebook.activeTab = 'sources';
    await saveNotebook(activeNotebook);
    fallbackToastMsg = `Saved source "${title}".`;
    renderNotebookDom(false);
  });

  document.getElementById('nbCloseNotesBtn')?.addEventListener('click', () => {
    topicNotesModalOpen = false;
    renderNotebookDom(false);
  });
  document.getElementById('nbImportTopicNotesBtn')?.addEventListener('click', async () => {
    const selectedIds = Array.from(document.querySelectorAll('.nb-topic-note-cb:checked')).map(
      (cb) => cb.value
    );
    for (const tid of selectedIds) {
      const t = subject.topics.find((x) => x.id === tid);
      if (!t) continue;
      const lines = [t.notes || ''];
      if (t.doubts?.length) {
        lines.push('Doubts:\n' + t.doubts.map((d) => `- ${d.text}`).join('\n'));
      }
      activeNotebook.sources.push(
        createNotebookSource({
          title: `Topic Notes: ${t.name}`,
          type: 'topic-notes',
          topicId: t.id,
          rawText: lines.filter(Boolean).join('\n\n'),
          sourceIndex: activeNotebook.sources.length + 1
        })
      );
    }
    topicNotesModalOpen = false;
    activeNotebook.activeTab = 'sources';
    await saveNotebook(activeNotebook);
    fallbackToastMsg = `Imported ${selectedIds.length} Ledger topic note(s).`;
    renderNotebookDom(false);
  });
}

/**
 * Mount/refresh the Study Notebook view asynchronously inside #notebookMount.
 */
export async function mountNotebookView(subjectId) {
  if (!subjectId) {
    activeNotebook = null;
    renderNotebookDom(false);
    return;
  }

  if (loadedSubjectId !== subjectId || !activeNotebook) {
    if (!pendingNotebookLoad || pendingNotebookLoad.subjectId !== subjectId) {
      const promise = getNotebook(subjectId).then((nb) => {
        activeNotebook = nb;
        loadedSubjectId = subjectId;
        if (pendingNotebookLoad?.subjectId === subjectId) {
          pendingNotebookLoad = null;
        }
        return nb;
      });
      pendingNotebookLoad = { subjectId, promise };
    }
    await pendingNotebookLoad.promise;
    pendingSyllabusDraft = null;
    scanModalOpen = false;
    treeModalOpen = false;
    splitMenuOpen = false;
    addSourceMenuOpen = false;
    scopeSheetOpen = false;
    fallbackToastMsg = '';
    fcSession = { index: 0, ratings: {} };
    quizSession.submitted = false;
  }

  const shouldAnimate = lastRenderedSubjectId !== subjectId;
  lastRenderedSubjectId = subjectId;
  renderNotebookDom(shouldAnimate);

  // Silently fetch & cache live models on load if an unlocked API key exists
  ensureLiveModelsLoaded().then((models) => {
    if (models && !isStreaming && !isGeneratingTab && !pendingSyllabusDraft && loadedSubjectId === subjectId) {
      renderNotebookDom(false);
    }
  });
}

export function openNotebookKeyModal() {
  keyModalOpen = true;
  renderNotebookDom(false);
}

export function openNotebookSyllabusModal() {
  if (activeNotebook) {
    activeNotebook.activeTab = 'home';
    scanModalOpen = Boolean(activeNotebook.syllabusBrain);
    syllabusScanError = '';
  }
  renderNotebookDom(false);
}

/**
 * Programmatically navigate inside a mounted Study Notebook and confirm the resulting active state.
 * @param {'home'|'sources'|'chat'|'learn'|'practice'|'plan'} tabId
 * @param {string|null} [subView]
 */
export async function navigateNotebookTo(tabId = 'learn', subView = null) {
  if (!activeNotebook) {
    return { ok: false, reason: 'not-mounted' };
  }
  const target = subView || tabId;
  await switchTab(target);
  const state = getActiveWorkspaceState(activeNotebook);
  const ok =
    state.topTab === tabId &&
    (!subView || state.learnView === subView || state.practiceView === subView);
  return {
    ok,
    tab: state.topTab,
    learnView: state.learnView,
    practiceView: state.practiceView
  };
}
