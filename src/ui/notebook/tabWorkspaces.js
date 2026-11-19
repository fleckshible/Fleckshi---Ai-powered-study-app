import { escapeHtml } from '../../utils/dom.js';
import { diffDays, toDateKey } from '../../utils/date.js';
import {
  getScopedArtifact,
  makeArtifactKey,
  migrateLegacyNotebookTab
} from '../../storage/notebookStore.js';
import { formatShortModelName, getModelMeta, resolveModelForTask } from '../../features/modelCatalog.js';
import {
  buildSyllabusBrainFromSubject,
  getTaskKeyForTool
} from '../../features/notebookGenerators.js';
import { renderRichMarkdown } from '../../features/markdownRenderer.js';
import {
  renderAnimatedIcon,
  renderIconTile,
  renderStatusBadge,
  renderEmptyIllustration
} from '../icons.js';
import { renderGroupedModelOptions } from './modelPicker.js';

export { migrateLegacyNotebookTab };

export const TAB_TOOL_LABELS = {
  home: 'Home',
  sources: 'Sources',
  chat: 'Chat',
  learn: 'Learn',
  practice: 'Practice',
  plan: 'Plan',
  notes: 'Notes',
  summary: 'Summary',
  studyGuide: 'Study Guide',
  faq: 'FAQ',
  glossary: 'Glossary',
  timeline: 'Timeline',
  mindMap: 'Mind Map',
  flashcards: 'Flashcards',
  quiz: 'Quiz',
  revisionPlan: 'Revision Plan'
};

export const NOTEBOOK_TABS = [
  { id: 'home', label: 'Home', icon: 'sec:home' },
  { id: 'sources', label: 'Sources', icon: 'sec:sources' },
  { id: 'chat', label: 'Chat', icon: 'sec:chat' },
  { id: 'learn', label: 'Learn', icon: 'sec:learn' },
  { id: 'practice', label: 'Practice', icon: 'sec:practice' },
  { id: 'plan', label: 'Plan', icon: 'sec:plan' }
];

export const LEARN_VIEWS = [
  { id: 'notes', icon: 'notes', label: 'Notes' },
  { id: 'summary', icon: 'summary', label: 'Summary' },
  { id: 'studyGuide', icon: 'studyGuide', label: 'Study Guide' },
  { id: 'faq', icon: 'faq', label: 'FAQ' },
  { id: 'glossary', icon: 'glossary', label: 'Glossary' },
  { id: 'timeline', icon: 'timeline', label: 'Timeline' },
  { id: 'mindMap', icon: 'mindMap', label: 'Mind Map' }
];

export const PRACTICE_VIEWS = [
  { id: 'flashcards', icon: 'flashcards', label: 'Flashcards' },
  { id: 'quiz', icon: 'quiz', label: 'Quiz' }
];

function renderEmptySvgIllustration(kind = 'doc') {
  if (kind === 'chat') {
    return (
      `<svg class="nb-drawable-svg" width="56" height="56" viewBox="0 0 56 56" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
      `<path class="nb-drawable-path" d="M 10 14 H 46 V 38 H 24 L 14 46 V 38 H 10 Z"/>` +
      `<path class="nb-drawable-path" d="M 18 23 H 38"/>` +
      `<path class="nb-drawable-path" d="M 18 29 H 31"/>` +
      `</svg>`
    );
  }
  if (kind === 'sources') {
    return (
      `<svg class="nb-drawable-svg" width="56" height="56" viewBox="0 0 56 56" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
      `<path class="nb-drawable-path" d="M 14 10 H 34 L 44 20 V 46 H 14 Z"/>` +
      `<path class="nb-drawable-path" d="M 34 10 V 20 H 44"/>` +
      `<path class="nb-drawable-path" d="M 21 28 H 37"/>` +
      `<path class="nb-drawable-path" d="M 21 35 H 32"/>` +
      `</svg>`
    );
  }
  return (
    `<svg class="nb-drawable-svg" width="56" height="56" viewBox="0 0 56 56" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
    `<circle class="nb-drawable-path" cx="28" cy="28" r="19"/>` +
    `<path class="nb-drawable-path" d="M 28 14 Q 30 26 42 28 Q 30 30 28 42 Q 26 30 14 28 Q 26 26 28 14 Z"/>` +
    `</svg>`
  );
}

export function formatTextWithCitations(text, allChunks) {
  return renderRichMarkdown(text, allChunks);
}

/**
 * Resolve concrete `{ scopeType, scopeId, scopeLabel, chapterObj, topicObj, chapters }` from notebook & subject.
 */
export function resolveActiveScopeDetails(notebook, subject, toolId) {
  const brain = notebook?.syllabusBrain || buildSyllabusBrainFromSubject(subject);
  const chapters = brain?.chapters || [];
  const rawScope = notebook?.activeScope || { scopeType: 'chapter', chapterId: null, topicId: null };

  let scopeType = toolId === 'revisionPlan' ? 'subject' : rawScope.scopeType || 'chapter';
  if (toolId === 'notes' && scopeType === 'subject' && chapters.some((c) => c.topics?.length)) {
    scopeType = 'topic';
  }
  if ((scopeType === 'chapter' || scopeType === 'topic') && !chapters.length) {
    scopeType = 'subject';
  }

  let chapterObj = chapters.find((c) => c.id === rawScope.chapterId) || chapters[0] || null;
  let topicObj = null;
  if (chapterObj) {
    topicObj =
      (chapterObj.topics || []).find((t) => t.id === rawScope.topicId) ||
      chapterObj.topics?.[0] ||
      null;
  }

  if (scopeType === 'topic' && !topicObj) {
    scopeType = chapterObj ? 'chapter' : 'subject';
  }

  if (scopeType === 'topic' && topicObj) {
    return {
      scopeType: 'topic',
      scopeId: topicObj.id,
      scopeLabel: topicObj.name,
      chapterObj,
      topicObj,
      chapters
    };
  }
  if (scopeType === 'chapter' && chapterObj) {
    return {
      scopeType: 'chapter',
      scopeId: chapterObj.id,
      scopeLabel: chapterObj.name,
      chapterObj,
      topicObj,
      chapters
    };
  }
  return {
    scopeType: 'subject',
    scopeId: subject?.id || notebook?.subjectId || 'all',
    scopeLabel: brain?.subjectName || subject?.name || 'Whole Subject',
    chapterObj,
    topicObj,
    chapters
  };
}

function renderGroundingToggle(groundingMode) {
  return (
    `<div class="nb-seg-control" role="group" aria-label="Grounding mode">` +
    `<button type="button" class="nb-seg-btn${
      groundingMode === 'sources' ? ' active' : ''
    }" data-nb-grounding="sources">${renderAnimatedIcon('ctrl:sourcesMode', {
      size: 13
    })}<span>From my sources</span></button>` +
    `<button type="button" class="nb-seg-btn${
      groundingMode === 'syllabus' ? ' active' : ''
    }" data-nb-grounding="syllabus">${renderAnimatedIcon('ctrl:syllabusMode', {
      size: 13
    })}<span>Syllabus-guided</span></button>` +
    `</div>`
  );
}

function renderSplitGenerateButton({
  artifact,
  artifactKey,
  effectiveModel,
  liveModels,
  isGeneratingTab,
  autoGenChecked,
  editNoteMode,
  splitMenuOpen,
  hideModelAndAuto = false
}) {
  const versionCount = artifact?.versions?.length || 0;
  const shortModel = formatShortModelName(effectiveModel, liveModels);

  const menuHtml = splitMenuOpen
    ? `<div class="nb-menu-popup nb-split-menu" id="nbSplitActionMenu" role="menu">` +
      `<div class="nb-ws-pop-field" style="padding:4px 6px;">` +
      `<label class="nb-ws-pop-label" for="nbTabModelOverrideSelect">Model: ${escapeHtml(
        shortModel
      )}</label>` +
      `<select id="nbTabModelOverrideSelect" class="ui-select" aria-label="Override generation model">${renderGroupedModelOptions(
        effectiveModel,
        liveModels
      )}</select>` +
      `</div>` +
      (!hideModelAndAuto
        ? `<label class="u-check-label" style="padding:6px 8px;">` +
          `<input type="checkbox" id="nbAutoGenTabCb" ${autoGenChecked ? 'checked' : ''}>` +
          `<span>Auto-generate on tab open</span>` +
          `</label>`
        : '') +
      (versionCount
        ? `<button type="button" class="nb-menu-item" role="menuitem" id="nbOpenVersionsBtn" data-artifact-key="${escapeHtml(
            artifactKey
          )}"><span class="nb-item-icon-box">${renderAnimatedIcon('ctrl:versions', {
            size: 14
          })}</span><div class="nb-menu-item-main"><span>Versions &amp; Compare (${versionCount})</span></div></button>`
        : '') +
      (artifact && typeof artifact.content === 'string'
        ? `<button type="button" class="nb-menu-item" role="menuitem" id="nbToggleNoteEditBtn"><span class="nb-item-icon-box">${renderAnimatedIcon(
            'ctrl:edit',
            { size: 14 }
          )}</span><div class="nb-menu-item-main"><span>${
            editNoteMode ? 'Preview Markdown' : 'Edit Markdown'
          }</span></div></button>` +
          `<button type="button" class="nb-menu-item" role="menuitem" id="nbCopyMdBtn"><span class="nb-item-icon-box">${renderAnimatedIcon(
            'ctrl:copy',
            { size: 14 }
          )}</span><div class="nb-menu-item-main"><span>Copy .md</span></div></button>` +
          `<button type="button" class="nb-menu-item" role="menuitem" id="nbDownloadMdBtn"><span class="nb-item-icon-box">${renderAnimatedIcon(
            'ctrl:download',
            { size: 14 }
          )}</span><div class="nb-menu-item-main"><span>Download .md</span></div></button>` +
          `<button type="button" class="nb-menu-item" role="menuitem" id="nbSpeakArtifactBtn"><span class="nb-item-icon-box">${renderAnimatedIcon(
            'ctrl:speak',
            { size: 14 }
          )}</span><div class="nb-menu-item-main"><span>Read Aloud</span></div></button>`
        : '') +
      `</div>`
    : '';

  return (
    `<div class="nb-ws-pop-wrap">` +
    `<div class="nb-split-btn">` +
    `<button type="button" class="btn-primary btn-md nb-split-main" id="nbRunActiveGenBtn" ${
      isGeneratingTab ? 'disabled' : ''
    }>${renderAnimatedIcon('ctrl:generate', { size: 14 })}<span>${
      artifact ? 'Regenerate' : 'Generate'
    }</span></button>` +
    `<button type="button" class="btn-primary btn-md nb-split-caret" id="nbSplitCaretBtn" aria-haspopup="menu" aria-expanded="${splitMenuOpen}" aria-label="Generation model and artifact options">&#9662;</button>` +
    `</div>` +
    menuHtml +
    `</div>`
  );
}

/**
 * Single Sources page: Library + Chunk Inspector + one "+ Add Source" split menu.
 */
export function renderSourcesWorkspace({
  notebook,
  allChunks,
  highlightedChunkId,
  ocrQueue = [],
  addMenuOpen = false
}) {
  const addMenuHtml = addMenuOpen
    ? `<div class="nb-menu-popup nb-split-menu" id="nbAddSourceMenu" role="menu">` +
      `<label class="nb-menu-item" role="menuitem">` +
      `<span class="nb-item-icon-box">${renderAnimatedIcon('sources:upload', { size: 15 })}</span>` +
      `<div class="nb-menu-item-main"><span>Upload File / PDF</span><span class="nb-menu-item-desc">Text, Markdown, PDF, or Images</span></div>` +
      `<input type="file" id="nbFileInput" accept=".txt,.md,.pdf,image/png,image/jpeg,image/webp" multiple class="nb-hidden-input">` +
      `</label>` +
      `<label class="nb-menu-item" role="menuitem">` +
      `<span class="nb-item-icon-box">${renderAnimatedIcon('ctrl:camera', { size: 15 })}</span>` +
      `<div class="nb-menu-item-main"><span>Camera Photo</span><span class="nb-menu-item-desc">Capture textbook page for OCR</span></div>` +
      `<input type="file" id="nbCameraInput" accept="image/*" capture="environment" class="nb-hidden-input">` +
      `</label>` +
      `<button type="button" class="nb-menu-item" role="menuitem" id="nbAddPasteBtn">` +
      `<span class="nb-item-icon-box">${renderAnimatedIcon('sources:paste', { size: 15 })}</span>` +
      `<div class="nb-menu-item-main"><span>Paste Notes</span><span class="nb-menu-item-desc">Add lecture or text excerpt</span></div>` +
      `</button>` +
      `<button type="button" class="nb-menu-item" role="menuitem" id="nbAddNotesBtn">` +
      `<span class="nb-item-icon-box">${renderAnimatedIcon('sources:topics', { size: 15 })}</span>` +
      `<div class="nb-menu-item-main"><span>Import Topic Notes</span><span class="nb-menu-item-desc">Pull notes &amp; doubts from Ledger</span></div>` +
      `</button>` +
      `</div>`
    : '';

  const sourcesHtml = notebook.sources.length
    ? notebook.sources
        .map(
          (src) =>
            `<div class="nb-source-card${src.included ? '' : ' excluded'}" data-source-id="${escapeHtml(
              src.id
            )}">` +
            `<div class="nb-source-top">` +
            `<span class="nb-src-drag" title="Drag to reorder">&#8942;&#8942;</span>` +
            `<input type="checkbox" data-nb-toggle-src="${escapeHtml(src.id)}" ${
              src.included ? 'checked' : ''
            } aria-label="Include ${escapeHtml(src.title)}">` +
            (src.thumbnail
              ? `<img class="nb-source-thumb" src="${escapeHtml(
                  src.thumbnail
                )}" alt="Thumbnail for ${escapeHtml(src.title)}">`
              : '') +
            `<div class="u-flex-1">` +
            `<div style="font-size:14.5px; font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(
              src.title
            )}</div>` +
            `<div class="mono nb-ws-sub">${escapeHtml(
              src.type
            )} · ${src.wordCount} words · ${src.chunks?.length || 0} chunks</div>` +
            `</div>` +
            `<button type="button" class="topic-del" data-nb-del-src="${escapeHtml(
              src.id
            )}" aria-label="Remove source">&times;</button>` +
            `</div>` +
            `<div class="nb-source-chunks">` +
            (src.chunks || [])
              .map(
                (c) =>
                  `<button type="button" class="nb-chunk-chip${
                    highlightedChunkId === c.id ? ' highlighted' : ''
                  }" data-chunk-id="${escapeHtml(c.id)}" title="${escapeHtml(
                    c.text.slice(0, 140)
                  )}">${escapeHtml(c.label)}</button>`
              )
              .join('') +
            `</div>` +
            (highlightedChunkId && (src.chunks || []).some((c) => c.id === highlightedChunkId)
              ? `<div class="nb-artifact-box" style="margin-top:10px; font-size:13.5px;">${escapeHtml(
                  (src.chunks || []).find((c) => c.id === highlightedChunkId)?.text || ''
                )}</div>`
              : '') +
            `</div>`
        )
        .join('')
    : `<div class="nb-empty-center" id="nbDropZone">${renderEmptyIllustration('sec:sources', {
        title: 'No Sources Added Yet',
        subtitle:
          'Drop files, PDFs, or images here, press Ctrl+V to paste an image, or click Add Source above.',
        accent: 'sources'
      })}</div>`;

  return (
    `<section class="nb-workspace-card nb-spotlight-zone" id="nbSourcesPanel" aria-label="Sources Workspace">` +
    `<div class="nb-workspace-topbar">` +
    `<div class="nb-ws-title-group">` +
    renderIconTile('sec:sources', { accent: 'sources' }) +
    `<div>` +
    `<h2 class="serif nb-ws-title">Sources (${notebook.sources.length})<span class="title-dot"></span></h2>` +
    `<div class="mono nb-ws-sub">${allChunks.length} active chunks${
      ocrQueue.length ? ` · ${ocrQueue.length} OCR queued` : ''
    }</div>` +
    `</div>` +
    `</div>` +
    `<div class="nb-ws-controls">` +
    `<div class="nb-ws-pop-wrap">` +
    `<button type="button" class="btn-primary btn-md" id="nbAddSourceMenuBtn" aria-haspopup="menu" aria-expanded="${addMenuOpen}">${renderAnimatedIcon(
      'sources:upload',
      { size: 18 }
    )}<span>Add Source</span><span>&#9662;</span></button>` +
    addMenuHtml +
    `</div>` +
    `</div>` +
    `</div>` +
    `<div class="nb-workspace-body" id="nbSourcesList"><div class="nb-reading-col">${sourcesHtml}</div></div>` +
    `</section>`
  );
}

/**
 * Single Chat page + right-side Gear Drawer (Citations + Chat Options/Model/Export/Clear).
 */
export function renderChatWorkspace({
  notebook,
  allChunks,
  vaultConfig,
  liveModels,
  citationDrawerChunkId,
  chatDrawerOpen = false,
  pendingChatImages = [],
  chatAttachmentError = ''
}) {
  const routedModel = resolveModelForTask('chat', vaultConfig, liveModels);
  const routedMeta = getModelMeta(routedModel, liveModels);
  const shortChatModel = formatShortModelName(routedModel, liveModels);
  const needsVisionSwitch = pendingChatImages.length > 0 && !routedMeta.supportsImages;
  const drawerChunk = citationDrawerChunkId
    ? allChunks.find((c) => c.id === citationDrawerChunkId) || null
    : null;
  const drawerOpen = Boolean(chatDrawerOpen || drawerChunk);

  const msgsHtml = notebook.chatHistory.length
    ? notebook.chatHistory
        .map(
          (m) =>
            `<article class="nb-chat-msg ${m.role === 'user' ? 'user' : 'model'}">` +
            `<div class="nb-chat-role">` +
            `<div class="u-row-wrap">` +
            `<span>${m.role === 'user' ? 'You' : 'Gemini'}</span>` +
            (m.model
              ? `<span class="nb-badge-mini">${escapeHtml(
                  formatShortModelName(m.model, liveModels)
                )}</span>`
              : '') +
            `</div>` +
            (m.role !== 'user'
              ? `<button type="button" class="topic-action-btn" data-nb-speak="${escapeHtml(
                  m.id
                )}" title="Read answer aloud">Speak</button>`
              : '') +
            `</div>` +
            `<div class="nb-chat-body">${formatTextWithCitations(m.text, allChunks)}</div>` +
            `</article>`
        )
        .join('')
    : `<div class="nb-empty-center">${renderEmptyIllustration('sec:chat', {
        title: 'Study Chat',
        subtitle:
          'Ask grounded questions across your uploaded sources or get curriculum-guided explanations.',
        accent: 'chat'
      })}</div>`;

  const drawerHtml = drawerOpen
    ? `<aside class="nb-cite-drawer" aria-label="Chat Options and Citations">` +
      `<div class="u-row-between">` +
      `<strong style="font-size:14px;">Citations &amp; Chat Options</strong>` +
      `<button type="button" class="topic-del" id="nbCloseChatDrawerBtn" aria-label="Close drawer">&times;</button>` +
      `</div>` +
      `<div class="nb-ws-pop-field">` +
      `<label class="nb-ws-pop-label" for="nbChatModelOverrideSelect">Chat Model</label>` +
      `<select id="nbChatModelOverrideSelect" class="ui-select">${renderGroupedModelOptions(
        routedModel,
        liveModels
      )}</select>` +
      `</div>` +
      `<div class="u-row-wrap">` +
      (notebook.chatHistory.length
        ? `<button type="button" class="btn-secondary btn-sm" id="nbExportChatMdBtn">${renderAnimatedIcon(
            'ctrl:download',
            { size: 15 }
          )}<span>Export .md</span></button>` +
          `<button type="button" class="btn-secondary btn-sm u-text-danger" id="nbClearChatBtn">${renderAnimatedIcon(
            'action:trash',
            { size: 15 }
          )}<span>Clear Chat</span></button>`
        : `<span class="u-text-sm">No messages yet.</span>`) +
      `</div>` +
      (drawerChunk
        ? `<div class="u-divider-top">` +
          `<div class="mono u-text-mint" style="font-size:11.5px; margin-bottom:4px;">Selected Citation: ${escapeHtml(
            drawerChunk.label
          )}</div>` +
          `<div class="nb-artifact-box" style="font-size:13px;">${escapeHtml(
            drawerChunk.text
          )}</div>` +
          `</div>`
        : '') +
      `<div class="u-divider-top u-flex-1" style="overflow-y:auto;">` +
      `<div class="ui-label" style="margin-bottom:8px;">Active Passages (${allChunks.length})</div>` +
      (allChunks.length
        ? allChunks
            .slice(0, 20)
            .map(
              (c) =>
                `<div class="nb-coverage-card" style="padding:10px 12px; margin-bottom:8px;">` +
                `<div class="mono u-text-accent" style="font-size:11px; margin-bottom:3px;">${escapeHtml(
                  c.label
                )}</div>` +
                `<div class="u-text-sm">${escapeHtml(
                  c.text.slice(0, 140)
                )}${c.text.length > 140 ? '...' : ''}</div>` +
                `</div>`
            )
            .join('')
        : `<div class="u-text-sm">Add sources to inspect cited chunks here.</div>`) +
      `</div>` +
      `</aside>`
    : '';

  return (
    `<div class="nb-chat-layout${drawerOpen ? ' with-drawer' : ''}" id="nbChatPanel">` +
    `<section class="nb-workspace-card nb-chat-card nb-spotlight-zone" aria-label="Notebook Chat">` +
    `<div class="nb-workspace-topbar">` +
    `<div class="nb-ws-title-group">` +
    renderIconTile('sec:chat', { accent: 'chat' }) +
    `<h2 class="serif nb-ws-title">Chat<span class="title-dot"></span></h2>` +
    `<span class="ui-chip ui-chip--accent">${escapeHtml(shortChatModel)} · ${allChunks.length} chunks</span>` +
    `</div>` +
    `<div class="nb-ws-controls">` +
    `<button type="button" class="btn-secondary btn-sm" id="nbToggleChatDrawerBtn" aria-expanded="${drawerOpen}" title="Cited passages & chat options">${renderAnimatedIcon(
      'chat:settings',
      { size: 16 }
    )}<span>Citations &amp; Options</span></button>` +
    `</div>` +
    `</div>` +
    `<div class="nb-chat-scroll" id="nbChatScroll" aria-live="polite">` +
    `<div class="nb-chat-log nb-reading-col" id="nbChatLog">${msgsHtml}</div>` +
    `<div id="nbStreamBox" style="display:none; margin-top:12px;" class="nb-chat-msg model nb-reading-col">` +
    `<div class="nb-chat-role"><span>Streaming · ${escapeHtml(shortChatModel)}</span><span id="nbRetryStatus" class="mono"></span></div>` +
    `<div class="nb-thinking-bar" id="nbThinkingBar">` +
    `<svg width="56" height="22" viewBox="0 0 56 22" aria-hidden="true">` +
    `<path id="nbThoughtPath" d="M 4 11 Q 28 2 52 11 Q 28 20 4 11" fill="none" stroke="rgba(56,189,248,0.35)" stroke-width="1.2"/>` +
    `<circle class="nb-constellation-dot" cx="14" cy="11" r="2.2" fill="#38BDF8"/>` +
    `<circle class="nb-constellation-dot" cx="28" cy="6" r="2.2" fill="#2563EB"/>` +
    `<circle class="nb-constellation-dot" cx="42" cy="11" r="2.2" fill="#A7F3D0"/>` +
    `<circle id="nbThoughtDot" cx="4" cy="11" r="3" fill="#A7F3D0"/>` +
    `</svg>` +
    `<span>Synthesizing answer...</span>` +
    `<button type="button" class="btn-secondary btn-sm" id="nbCancelStreamBtn" style="margin-left:auto;">Cancel</button>` +
    `</div>` +
    `<div id="nbStreamText" style="margin-top:8px;"></div>` +
    `<span class="nb-stream-cursor" id="nbStreamCursor"></span>` +
    `</div>` +
    `</div>` +
    `<form class="nb-chat-form nb-reading-col" id="nbChatForm">` +
    renderGroundingToggle(notebook.groundingMode) +
    (pendingChatImages.length
      ? `<div class="nb-chat-attachments" id="nbChatAttachments" aria-label="Attached images">` +
        pendingChatImages
          .map(
            (img, idx) =>
              `<div class="nb-chat-attach-chip">` +
              `<img src="${escapeHtml(img.previewUrl)}" alt="${escapeHtml(img.name)}" class="nb-chat-attach-thumb">` +
              `<span class="nb-chat-attach-name">${escapeHtml(img.name)}</span>` +
              `<button type="button" class="topic-del" data-nb-chat-remove-img="${idx}" aria-label="Remove ${escapeHtml(
                img.name
              )}">&times;</button>` +
              `</div>`
          )
          .join('') +
        `</div>`
      : '') +
    (needsVisionSwitch
      ? `<div class="nb-danger-confirm u-row-between u-row-wrap" role="alert">` +
        `<span class="u-text-sm"><strong>${escapeHtml(
          shortChatModel
        )}</strong> does not support image attachments. Switch to a vision-capable model or remove the image.</span>` +
        `<button type="button" class="btn-secondary btn-sm" id="nbChatSwitchVisionBtn">Switch to Gemini 3.8 Flash</button>` +
        `</div>`
      : '') +
    (chatAttachmentError
      ? `<div class="u-text-danger" role="alert" style="font-size:12.5px;">${escapeHtml(
          chatAttachmentError
        )}</div>`
      : '') +
    `<div class="u-row-wrap u-w-full" style="flex-wrap:nowrap;">` +
    `<input type="file" id="nbChatImageInput" accept="image/png,image/jpeg,image/webp" multiple class="nb-hidden-input" aria-hidden="true">` +
    `<button type="button" class="btn-secondary btn-md nb-chat-attach-btn" id="nbChatAttachBtn" title="Attach PNG, JPG, or WebP images (or Ctrl+V paste)" aria-label="Attach images (PNG, JPG, WebP)">` +
    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>` +
    `</button>` +
    `<input type="text" id="nbChatInput" placeholder="Ask about your sources, or paste/attach an image..." autocomplete="off" aria-label="Chat message">` +
    `<button type="submit" class="btn-primary btn-md" id="nbSendBtn">` +
    `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">` +
    `<path id="nbSendGlyph" d="M 22 2 L 11 13 M 22 2 L 15 22 L 11 13 L 2 9 Z"/>` +
    `<path id="nbIconSendRef" d="M 22 2 L 11 13 M 22 2 L 15 22 L 11 13 L 2 9 Z" opacity="0"/>` +
    `<path id="nbIconThinkRef" d="M 12 2 A 10 10 0 1 1 2 12" opacity="0"/>` +
    `<path id="nbIconCheckRef" d="M 4 12 L 10 18 L 20 6" opacity="0"/>` +
    `</svg>` +
    `<span>Ask</span>` +
    `</button>` +
    `</div>` +
    `</form>` +
    `</section>` +
    drawerHtml +
    `</div>`
  );
}

function renderTimelineSvgDom(val, allChunks) {
  if (typeof val === 'string') {
    return `<div class="nb-artifact-box nb-fill-scroll"><div class="nb-reading-col">${formatTextWithCitations(
      val,
      allChunks
    )}</div></div>`;
  }
  const events = Array.isArray(val?.events) ? val.events : [];
  if (!events.length) return `<p class="view-subtitle">No timeline events generated yet.</p>`;

  return (
    `<div class="nb-artifact-box nb-fill-scroll">` +
    `<div class="nb-reading-col">` +
    `<h3 class="serif" style="margin:0 0 14px;">${escapeHtml(val.title || 'Progression Timeline')}</h3>` +
    `<div class="nb-timeline-list">` +
    events
      .map(
        (ev) =>
          `<div class="nb-tl-node">` +
          `<div class="nb-tl-dot"></div>` +
          `<div class="mono" style="font-size:11px; color:var(--blue-cyan); font-weight:700;">${escapeHtml(
            ev.orderLabel
          )}</div>` +
          `<div style="font-weight:600; font-size:14.5px; margin:2px 0;">${escapeHtml(ev.title)}</div>` +
          `<div style="font-size:13.5px; color:var(--text-secondary);">${formatTextWithCitations(
            ev.detail || '',
            allChunks
          )}</div>` +
          `</div>`
      )
      .join('') +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

export function computeMindMapLayout(mindMap) {
  if (!mindMap || !mindMap.rootLabel) {
    return { width: 960, height: 420, nodes: [], edges: [] };
  }
  const branches = Array.isArray(mindMap.branches) ? mindMap.branches.slice(0, 6) : [];
  const w = 960;
  const leafStep = 44;
  const branchGap = 22;

  const branchSpans = branches.map((br) => {
    const childCount = Array.isArray(br.children) ? Math.min(4, br.children.length) : 0;
    return Math.max(72, Math.max(1, childCount) * leafStep + 14);
  });
  const totalSpan =
    branchSpans.reduce((acc, s) => acc + s, 0) + Math.max(0, branches.length - 1) * branchGap;
  const h = Math.max(420, totalSpan + 48);

  const rootW = 172;
  const rootH = 42;
  const rootLeft = 40;
  const rootTop = Math.round(h / 2 - rootH / 2);

  const branchW = 188;
  const branchH = 38;
  const branchLeft = 330;

  const childW = 248;
  const childH = 32;
  const childLeft = 640;

  const nodes = [
    {
      id: 'root',
      kind: 'root',
      label: mindMap.rootLabel,
      left: rootLeft,
      top: rootTop,
      width: rootW,
      height: rootH
    }
  ];
  const edges = [];

  let cursorY = Math.round((h - totalSpan) / 2);
  branches.forEach((br, idx) => {
    const span = branchSpans[idx];
    const centerY = cursorY + span / 2;
    const brTop = Math.round(centerY - branchH / 2);
    const brId = `br_${idx}`;

    nodes.push({
      id: brId,
      kind: 'branch',
      label: br.label || `Branch ${idx + 1}`,
      left: branchLeft,
      top: brTop,
      width: branchW,
      height: branchH
    });
    edges.push({
      from: 'root',
      to: brId,
      stroke: '#38BDF8',
      strokeWidth: 1.8,
      opacity: 0.95
    });

    const children = Array.isArray(br.children) ? br.children.slice(0, 4) : [];
    const childrenSpan = Math.max(0, children.length - 1) * leafStep;
    children.forEach((child, cIdx) => {
      const cy = centerY - childrenSpan / 2 + cIdx * leafStep;
      const cTop = Math.round(cy - childH / 2);
      const cId = `ch_${idx}_${cIdx}`;
      nodes.push({
        id: cId,
        kind: 'child',
        label: child,
        left: childLeft,
        top: cTop,
        width: childW,
        height: childH
      });
      edges.push({
        from: brId,
        to: cId,
        stroke: '#34D399',
        strokeWidth: 1.35,
        opacity: 0.85
      });
    });

    cursorY += span + branchGap;
  });

  return { width: w, height: h, nodes, edges };
}

function buildMindMapCurvePath(fromNode, toNode) {
  const x1 = fromNode.left + fromNode.width;
  const y1 = fromNode.top + fromNode.height / 2;
  const x2 = toNode.left;
  const y2 = toNode.top + toNode.height / 2;
  const midX = (x1 + x2) / 2;
  return `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
}

function renderMindMapSvg(mindMap) {
  if (!mindMap || !mindMap.rootLabel) return '';
  const layout = computeMindMapLayout(mindMap);
  const byId = new Map(layout.nodes.map((n) => [n.id, n]));

  const edgesHtml = layout.edges
    .map((e) => {
      const fromNode = byId.get(e.from);
      const toNode = byId.get(e.to);
      if (!fromNode || !toNode) return '';
      const d = buildMindMapCurvePath(fromNode, toNode);
      return `<path class="nb-mm-edge" data-mm-from="${escapeHtml(e.from)}" data-mm-to="${escapeHtml(
        e.to
      )}" d="${d}" fill="none" stroke="${e.stroke}" stroke-width="${e.strokeWidth}" opacity="${e.opacity}"/>`;
    })
    .join('');

  const nodesHtml = layout.nodes
    .map((n) => {
      const borderStyle =
        n.kind === 'root'
          ? 'border-color:var(--mint-glow); font-weight:700;'
          : n.kind === 'branch'
            ? 'border-color:var(--blue-cyan); font-weight:600;'
            : 'font-size:11px;';
      return (
        `<div class="nb-mm-html-node nb-mm-node" data-mm-id="${escapeHtml(
          n.id
        )}" data-mm-base-left="${n.left}" data-mm-base-top="${n.top}" data-mm-w="${
          n.width
        }" data-mm-h="${n.height}" style="left:${n.left}px; top:${n.top}px; width:${
          n.width
        }px; min-height:${n.height}px; ${borderStyle}">${escapeHtml(n.label)}</div>`
      );
    })
    .join('');

  return (
    `<div class="nb-mindmap-viewport-wrap">` +
    `<div class="nb-mindmap-toolbar">` +
    `<span class="u-text-sm">Drag canvas to pan · Drag nodes to arrange · Wheel to zoom</span>` +
    `<div class="u-row-wrap">` +
    `<button type="button" class="btn-secondary btn-sm" id="nbMmZoomOutBtn" aria-label="Zoom out">-</button>` +
    `<span class="mono u-text-sm" id="nbMmZoomReadout">100%</span>` +
    `<button type="button" class="btn-secondary btn-sm" id="nbMmZoomInBtn" aria-label="Zoom in">+</button>` +
    `<button type="button" class="btn-secondary btn-sm" id="nbMmFitBtn">Fit to View</button>` +
    `<button type="button" class="btn-secondary btn-sm" id="nbMmResetBtn">Reset</button>` +
    `</div>` +
    `</div>` +
    `<div class="nb-mindmap-viewport" id="nbMindMapViewport" tabindex="0" aria-label="Interactive Mind Map">` +
    `<div class="nb-mindmap-canvas" id="nbMindMapCanvas" data-mm-width="${layout.width}" data-mm-height="${layout.height}" style="width:${layout.width}px; height:${layout.height}px;">` +
    `<svg class="nb-mindmap-svg" width="${layout.width}" height="${layout.height}" viewBox="0 0 ${layout.width} ${layout.height}" style="position:absolute; inset:0; pointer-events:none;">${edgesHtml}</svg>` +
    nodesHtml +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

function renderPersonalNotesWorkspace({ scope, subject }) {
  const targetLedgerTopic = (subject?.topics || []).find(
    (t) => t.name.trim().toLowerCase() === scope.scopeLabel.trim().toLowerCase()
  );

  return (
    `<div class="nb-workspace-body">` +
    `<div class="nb-reading-stack">` +
    `<div class="u-row-between">` +
    `<div class="u-text-muted">` +
    (targetLedgerTopic
      ? `Synced directly with Ledger topic: <strong class="u-text-mint">${escapeHtml(
          targetLedgerTopic.name
        )}</strong>`
      : `Topic "${escapeHtml(
          scope.scopeLabel
        )}" is not in Ledger yet — use Home &rarr; Apply to Ledger to sync personal notes.`) +
    `</div>` +
    (targetLedgerTopic
      ? `<button type="button" class="btn-primary btn-md" id="nbSavePersonalNoteBtn" data-ledger-topic-id="${escapeHtml(
          targetLedgerTopic.id
        )}">Save My Notes</button>`
      : '') +
    `</div>` +
    `<textarea id="nbPersonalNoteInput" class="modal-textarea nb-full-textarea" ${
      targetLedgerTopic ? '' : 'disabled'
    } placeholder="${
      targetLedgerTopic
        ? 'Write your own formulas, memory hooks, derivations, and exam reminders...'
        : 'Apply Syllabus Brain to Ledger to edit personal topic notes.'
    }">${escapeHtml(targetLedgerTopic?.notes || '')}</textarea>` +
    `</div>` +
    `</div>`
  );
}

function renderQuizBuilderWorkspace({ scope, subject, quizSession }) {
  const cfg = quizSession.config;
  const weakTopics = (subject?.topics || []).filter(
    (t) => !t.practiced || !t.revised || t.confidence === 'hard'
  );

  return (
    `<div class="nb-workspace-body">` +
    `<div class="nb-artifact-box nb-fill-scroll"><div class="nb-focus-col u-stack-lg">` +
    `<div>` +
    `<h3 class="serif" style="margin:0 0 4px;">Build Quiz · ${escapeHtml(
      scope.scopeLabel
    )}<span class="title-dot"></span></h3>` +
    `<p class="u-text-muted" style="margin:0;">Choose question count, difficulty, formats, and focus on weak topics.</p>` +
    `</div>` +
    `<div class="u-grid-2">` +
    `<div class="ui-field">` +
    `<label class="ui-label" for="nbQuizCountSel">Question Count</label>` +
    `<select id="nbQuizCountSel" class="ui-select">` +
    [5, 8, 10, 15]
      .map((n) => `<option value="${n}"${cfg.count === n ? ' selected' : ''}>${n} questions</option>`)
      .join('') +
    `</select>` +
    `</div>` +
    `<div class="ui-field">` +
    `<label class="ui-label" for="nbQuizDiffSel">Difficulty Level</label>` +
    `<select id="nbQuizDiffSel" class="ui-select">` +
    ['Easy', 'Medium', 'Hard', 'Exam-Level']
      .map((d) => `<option value="${d}"${cfg.difficulty === d ? ' selected' : ''}>${d}</option>`)
      .join('') +
    `</select>` +
    `</div>` +
    `</div>` +
    `<div class="ui-field">` +
    `<span class="ui-label">Question Formats</span>` +
    `<div class="u-row-wrap">` +
    `<label class="u-check-label"><input type="checkbox" class="nb-quiz-type-cb" value="mcq" ${
      cfg.questionTypes.includes('mcq') ? 'checked' : ''
    }>Multiple Choice (MCQ)</label>` +
    `<label class="u-check-label"><input type="checkbox" class="nb-quiz-type-cb" value="tf" ${
      cfg.questionTypes.includes('tf') ? 'checked' : ''
    }>True / False</label>` +
    `<label class="u-check-label"><input type="checkbox" class="nb-quiz-type-cb" value="short" ${
      cfg.questionTypes.includes('short') ? 'checked' : ''
    }>Short Answer</label>` +
    `</div>` +
    `</div>` +
    `<div class="ui-field">` +
    `<span class="ui-label">Timer &amp; Feedback</span>` +
    `<div class="u-row-wrap">` +
    `<label class="u-check-label"><input type="checkbox" id="nbQuizTimedCb" ${
      cfg.timed ? 'checked' : ''
    }>Timed Countdown Mode</label>` +
    `<label class="u-check-label"><input type="checkbox" id="nbQuizInstantCb" ${
      cfg.instantFeedback ? 'checked' : ''
    }>Instant Answer Reveal</label>` +
    `</div>` +
    `</div>` +
    `<div class="nb-coverage-card u-stack-sm">` +
    `<div style="font-size:13px; font-weight:600; color:var(--amber);">Detected Weak / Unpracticed Topics (${weakTopics.length})</div>` +
    (weakTopics.length
      ? `<div class="u-text-muted">${weakTopics
          .slice(0, 10)
          .map((t) => escapeHtml(t.name))
          .join(' · ')}</div>`
      : `<div class="u-text-muted">No weak topics flagged right now.</div>`) +
    `</div>` +
    `<div class="u-divider-top u-row-wrap">` +
    `<button type="button" class="btn-secondary btn-md" id="nbQuizWeakBtn">Quiz Weak Topics</button>` +
    `<button type="button" class="btn-primary btn-md" id="nbStartConfiguredQuizBtn">Generate &amp; Play Quiz</button>` +
    `</div>` +
    `</div></div>` +
    `</div>`
  );
}

function renderQuizHistoryWorkspace({ notebook }) {
  const history = notebook.quizHistory || [];
  const avgPct = history.length
    ? Math.round(history.reduce((s, h) => s + (Number(h.pct) || 0), 0) / history.length)
    : 0;
  const bestPct = history.length
    ? Math.max(...history.map((h) => Number(h.pct) || 0))
    : 0;

  return (
    `<div class="nb-workspace-body">` +
    `<div class="nb-focus-col u-stack-lg">` +
    `<div class="u-grid-auto">` +
    `<div class="nb-coverage-card"><div class="u-text-sm">Attempts</div><div class="mono" style="font-size:22px; font-weight:800;">${history.length}</div></div>` +
    `<div class="nb-coverage-card"><div class="u-text-sm">Average</div><div class="mono u-text-accent" style="font-size:22px; font-weight:800;">${avgPct}%</div></div>` +
    `<div class="nb-coverage-card"><div class="u-text-sm">Best</div><div class="mono u-text-mint" style="font-size:22px; font-weight:800;">${bestPct}%</div></div>` +
    `</div>` +
    `<div class="nb-artifact-box">` +
    (history.length
      ? history
          .map(
            (h) =>
              `<div class="weekly-row" style="grid-template-columns:1fr auto auto;">` +
              `<span>${escapeHtml(h.scopeLabel)}</span>` +
              `<span class="nb-badge-mini">${escapeHtml(formatShortModelName(h.model || ''))}</span>` +
              `<span class="mono" style="font-size:12.5px; color:${
                h.pct >= 80 ? 'var(--mint)' : 'var(--text-secondary)'
              };">${h.score}/${h.total} (${h.pct}%)</span>` +
              `</div>`
          )
          .join('')
      : `<div class="empty-state" style="margin:24px auto;">${renderEmptySvgIllustration(
          'doc'
        )}<h3 class="serif">No Quiz Attempts Yet<span class="title-dot"></span></h3><p>Finish a quiz in Play mode to record your scores.</p></div>`) +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

function renderQuizRunnerContent({ artifact, subject, quizSession }) {
  const qs = Array.isArray(artifact?.content) ? artifact.content : [];
  const cfg = quizSession.config;
  if (!qs.length) return '';

  const score = qs.reduce((acc, q, idx) => {
    const chosen = quizSession.answers[idx];
    const right =
      q.type === 'short'
        ? quizSession.shortSelfGrades[idx] === 'correct'
        : chosen === q.correctIndex;
    return acc + (quizSession.submitted && right ? 1 : 0);
  }, 0);

  const visibleQuestions = qs
    .map((q, idx) => ({ q, idx }))
    .filter(({ q, idx }) => {
      if (!(quizSession.submitted && quizSession.wrongOnly)) return true;
      const chosen = quizSession.answers[idx];
      const right =
        q.type === 'short'
          ? quizSession.shortSelfGrades[idx] === 'correct'
          : chosen === q.correctIndex;
      return !right;
    });

  const pct = qs.length ? Math.round((score / qs.length) * 100) : 0;

  const qsHtml = visibleQuestions
    .map(({ q, idx }) => {
      const chosen = quizSession.answers[idx];
      const showExplain = quizSession.submitted || (cfg.instantFeedback && chosen !== undefined);

      if (q.type === 'short') {
        const selfGrade = quizSession.shortSelfGrades[idx];
        return (
          `<div class="nb-quiz-q">` +
          `<div class="u-row-between">` +
          `<strong>${idx + 1}. ${renderRichMarkdown(q.question, [], { inline: true })}</strong>` +
          `<span class="nb-badge-mini">Short · ${escapeHtml(q.topicName || 'Topic')}</span>` +
          `</div>` +
          `<textarea class="modal-textarea" data-nb-short-ans="${idx}" style="min-height:68px; margin:10px 0;" placeholder="Type your answer...">${escapeHtml(
            typeof chosen === 'string' ? chosen : ''
          )}</textarea>` +
          `<div class="u-row-wrap">` +
          `<button type="button" class="btn-secondary btn-sm" data-nb-reveal-short="${idx}">Reveal Rubric</button>` +
          `<button type="button" class="btn-secondary btn-sm${
            selfGrade === 'correct' ? ' active u-text-mint' : ''
          }" data-nb-short-mark="${idx}:correct">Mark Correct</button>` +
          `<button type="button" class="btn-secondary btn-sm${
            selfGrade === 'wrong' ? ' u-text-danger' : ''
          }" data-nb-short-mark="${idx}:wrong">Missed</button>` +
          `</div>` +
          (quizSession.revealedShort[idx] || quizSession.submitted
            ? `<div class="u-text-muted" style="margin-top:10px;"><strong>Model Answer:</strong> ${renderRichMarkdown(
                q.answerText || '',
                [],
                { inline: true }
              )}<div style="margin-top:4px;">${renderRichMarkdown(q.explanation || '', [], {
                inline: true
              })}</div></div>`
            : '') +
          `</div>`
        );
      }

      const optsHtml = (q.options || [])
        .map((opt, oIdx) => {
          let stateCls = '';
          if (showExplain) {
            if (oIdx === q.correctIndex) stateCls = ' is-correct';
            else if (chosen === oIdx) stateCls = ' is-wrong';
          }
          return (
            `<label class="nb-quiz-opt-row${stateCls}">` +
            `<input type="radio" name="nbq_${idx}" value="${oIdx}" data-nb-quiz-opt="${idx}:${oIdx}" ${
              chosen === oIdx ? 'checked' : ''
            } ${quizSession.submitted ? 'disabled' : ''}>` +
            `<span>${renderRichMarkdown(opt, [], { inline: true })}</span>` +
            `</label>`
          );
        })
        .join('');

      return (
        `<div class="nb-quiz-q">` +
        `<div class="u-row-between">` +
        `<strong>${idx + 1}. ${renderRichMarkdown(q.question, [], { inline: true })}</strong>` +
        `<span class="nb-badge-mini">${escapeHtml(q.type.toUpperCase())}${
          q.topicName ? ` · ${escapeHtml(q.topicName)}` : ''
        }</span>` +
        `</div>` +
        optsHtml +
        (showExplain
          ? `<div class="u-text-muted" style="margin-top:10px;">${renderRichMarkdown(
              q.explanation || '',
              [],
              { inline: true }
            )}</div>`
          : '') +
        `</div>`
      );
    })
    .join('');

  const suggestHtml =
    quizSession.submitted && pct >= 80 && !quizSession.suggestDone && subject?.topics?.length
      ? `<div class="confidence-banner" id="nbQuizMarkSuggest">` +
        `<span>Scored ${pct}%! Suggested action: mark matched topic(s) as Practiced in Ledger?</span>` +
        `<button type="button" class="btn-primary btn-sm" id="nbConfirmQuizPracticedBtn">Confirm Practiced</button>` +
        `</div>`
      : '';

  return (
    `<div class="nb-artifact-box nb-fill-scroll"><div class="nb-focus-col">` +
    (cfg.timed && !quizSession.submitted
      ? `<div class="mono u-text-accent" id="nbQuizTimerBadge" style="font-size:12.5px; margin-bottom:12px;">Time left: ${Math.floor(
          quizSession.secondsLeft / 60
        )}:${String(quizSession.secondsLeft % 60).padStart(2, '0')}</div>`
      : '') +
    (quizSession.submitted
      ? `<div class="u-row-wrap" style="margin-bottom:16px;">` +
        `<svg width="54" height="54" viewBox="0 0 54 54" aria-hidden="true">` +
        `<circle cx="27" cy="27" r="22" fill="none" stroke="var(--border-hairline)" stroke-width="4"/>` +
        `<circle id="nbQuizScoreRing" cx="27" cy="27" r="22" fill="none" stroke="#A7F3D0" stroke-width="4" transform="rotate(-90 27 27)" stroke-linecap="round"/>` +
        `<text id="nbQuizScoreText" x="27" y="31" text-anchor="middle" fill="var(--text-primary)" font-family="JetBrains Mono, monospace" font-size="11" font-weight="700">${pct}%</text>` +
        `</svg>` +
        `<div><strong>Score: ${score} / ${qs.length} (${pct}%)</strong>` +
        `<div class="u-row-wrap" style="margin-top:8px;">` +
        `<button type="button" class="btn-secondary btn-sm" id="nbToggleWrongOnlyBtn">${
          quizSession.wrongOnly ? 'Show All Questions' : 'Review Wrong Answers'
        }</button>` +
        `<button type="button" class="btn-secondary btn-sm" id="nbResetQuizBtn">Retake</button>` +
        `</div></div></div>` +
        suggestHtml
      : '') +
    (qsHtml || `<p class="view-subtitle">Zero wrong answers to review!</p>`) +
    (!quizSession.submitted
      ? `<button type="button" class="btn-primary btn-md" id="nbGradeQuizBtn">Grade Quiz</button>`
      : '') +
    `</div></div>`
  );
}

function renderScopeOutlineRail({ notebook, subject, activeTool, scope }) {
  const brain = notebook?.syllabusBrain || buildSyllabusBrainFromSubject(subject);
  const chapters = brain?.chapters || [];
  const subjId = subject?.id || notebook?.subjectId || 'all';
  const subjDone = Boolean(getScopedArtifact(notebook, activeTool, 'subject', subjId)?.content);

  const itemsHtml =
    `<button type="button" class="nb-outline-item${
      scope.scopeType === 'subject' ? ' active' : ''
    }" data-nb-pick-scope="subject:${escapeHtml(subjId)}:">` +
    `<span class="nb-status-dot${subjDone ? ' done' : ''}"></span>` +
    `<span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">Whole Subject</span>` +
    `</button>` +
    chapters
      .map((ch) => {
        const chArt = getScopedArtifact(notebook, activeTool, 'chapter', ch.id);
        const chDone = Boolean(
          chArt && (Array.isArray(chArt.content) ? chArt.content.length : chArt.content)
        );
        const isChActive = scope.scopeType === 'chapter' && scope.scopeId === ch.id;
        const topicsHtml = (ch.topics || [])
          .map((tp) => {
            const tpArt = getScopedArtifact(notebook, activeTool, 'topic', tp.id);
            const tpDone = Boolean(
              tpArt && (Array.isArray(tpArt.content) ? tpArt.content.length : tpArt.content)
            );
            const isTpActive = scope.scopeType === 'topic' && scope.scopeId === tp.id;
            return (
              `<button type="button" class="nb-outline-item topic${
                isTpActive ? ' active' : ''
              }" data-nb-pick-scope="topic:${escapeHtml(ch.id)}:${escapeHtml(tp.id)}">` +
              `<span class="nb-status-dot${tpDone ? ' done' : ''}"></span>` +
              `<span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(
                tp.name
              )}</span>` +
              `</button>`
            );
          })
          .join('');

        return (
          `<div class="nb-outline-group">` +
          `<button type="button" class="nb-outline-item chapter${
            isChActive ? ' active' : ''
          }" data-nb-pick-scope="chapter:${escapeHtml(ch.id)}:">` +
          `<span class="nb-status-dot${chDone ? ' done' : ''}"></span>` +
          `<span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(
            ch.name
          )}</span>` +
          `</button>` +
          topicsHtml +
          `</div>`
        );
      })
      .join('');

  return (
    `<aside class="nb-outline-rail" aria-label="Chapter and Topic Outline">` +
    `<div class="nb-outline-head">Syllabus Outline</div>` +
    `<div class="nb-outline-list">${itemsHtml}</div>` +
    `</aside>`
  );
}

/**
 * Render Learn (Notes | Summary | Study Guide | FAQ | Glossary | Timeline | Mind Map)
 * or Practice (Flashcards | Quiz) with Outline Rail, View Chips & 2-control Toolbar.
 */
export function renderScopedGeneratorWorkspace({
  parentTab = 'learn',
  activeView = 'notes',
  notesMode = 'ai',
  quizMode = 'play',
  notebook,
  subject,
  allChunks,
  vaultConfig,
  liveModels,
  isGeneratingTab,
  editNoteMode,
  fcSession,
  quizSession,
  splitMenuOpen = false,
  tabModelOverride = null,
  outlineCollapsed = false
}) {
  const scope = resolveActiveScopeDetails(notebook, subject, activeView);
  const taskKey = getTaskKeyForTool(activeView);
  const routedModel = resolveModelForTask(taskKey, vaultConfig, liveModels);
  const effectiveModel = tabModelOverride || routedModel;
  const isPersonalNotes = activeView === 'notes' && notesMode === 'mine';
  const isQuizBuild = activeView === 'quiz' && quizMode === 'build';
  const isQuizHistory = activeView === 'quiz' && quizMode === 'history';

  const artifact =
    isPersonalNotes || isQuizHistory
      ? null
      : getScopedArtifact(notebook, activeView, scope.scopeType, scope.scopeId);
  const artifactKey = makeArtifactKey(activeView, scope.scopeType, scope.scopeId);

  const autoGenChecked =
    scope.scopeType === 'subject'
      ? Boolean(notebook.autoGenerateOnTabOpen?.wholeSubject)
      : Boolean(notebook.autoGenerateOnTabOpen?.scoped);

  const viewChips = (parentTab === 'practice' ? PRACTICE_VIEWS : LEARN_VIEWS)
    .map((v) => {
      const attr = parentTab === 'practice' ? 'data-nb-practice-view' : 'data-nb-learn-view';
      return (
        `<button type="button" class="nb-view-chip${
          activeView === v.id ? ' active' : ''
        }" ${attr}="${v.id}">${renderAnimatedIcon(v.icon, { size: 18 })}<span>${escapeHtml(
          v.label
        )}</span></button>`
      );
    })
    .join('');

  const viewChipStrip = `<div class="nb-view-chips" role="group" aria-label="${
    parentTab === 'practice' ? 'Practice Views' : 'Learn Views'
  }">${viewChips}</div>`;

  const subSegHtml =
    activeView === 'notes'
      ? `<div class="nb-seg-control" role="group" aria-label="Notes mode">` +
        `<button type="button" class="nb-seg-btn${
          notesMode === 'ai' ? ' active' : ''
        }" data-nb-notes-mode="ai">AI</button>` +
        `<button type="button" class="nb-seg-btn${
          notesMode === 'mine' ? ' active' : ''
        }" data-nb-notes-mode="mine">Mine</button>` +
        `</div>`
      : activeView === 'quiz'
        ? `<div class="nb-seg-control" role="group" aria-label="Quiz mode">` +
          `<button type="button" class="nb-seg-btn${
            quizMode === 'play' ? ' active' : ''
          }" data-nb-quiz-mode="play">Play</button>` +
          `<button type="button" class="nb-seg-btn${
            quizMode === 'build' ? ' active' : ''
          }" data-nb-quiz-mode="build">Build</button>` +
          `<button type="button" class="nb-seg-btn${
            quizMode === 'history' ? ' active' : ''
          }" data-nb-quiz-mode="history">History</button>` +
          `</div>`
        : '';

  const showGroundingAndGen = !isPersonalNotes && !isQuizHistory;

  const canExportPdf =
    (parentTab === 'learn' && (Boolean(artifact) || isPersonalNotes)) ||
    (parentTab === 'plan' && Boolean(artifact));

  const workspaceTopBar =
    `<div class="nb-workspace-topbar">` +
    `<div class="nb-ws-title-group">` +
    `<button type="button" class="nb-ws-trigger" id="nbScopeChipBtn" aria-label="Change scope">` +
    renderAnimatedIcon('ctrl:scope', { size: 14 }) +
    `<span>${escapeHtml(scope.scopeLabel)}</span>` +
    `<span class="nb-scope-caret">&#9662;</span>` +
    `</button>` +
    subSegHtml +
    (showGroundingAndGen ? renderGroundingToggle(notebook.groundingMode) : '') +
    `</div>` +
    `<div class="nb-ws-controls">` +
    (canExportPdf
      ? `<button type="button" class="btn-secondary btn-sm" id="nbExportPdfBtn" title="Preview &amp; export clean PDF">Export PDF</button>`
      : '') +
    (showGroundingAndGen && !isQuizBuild
      ? renderSplitGenerateButton({
          artifact,
          artifactKey,
          effectiveModel,
          liveModels,
          isGeneratingTab,
          autoGenChecked,
          editNoteMode,
          splitMenuOpen
        })
      : '') +
    `</div>` +
    `</div>`;

  let innerBodyHtml = '';

  if (isPersonalNotes) {
    innerBodyHtml = renderPersonalNotesWorkspace({ scope, subject });
  } else if (isQuizBuild) {
    innerBodyHtml = renderQuizBuilderWorkspace({ scope, subject, quizSession });
  } else if (isQuizHistory) {
    innerBodyHtml = renderQuizHistoryWorkspace({ notebook });
  } else if (isGeneratingTab) {
    innerBodyHtml =
      `<div class="nb-workspace-body">` +
      `<div class="nb-artifact-box nb-fill-scroll"><div class="nb-reading-col">` +
      `<div class="u-row-between" style="margin-bottom:12px;">` +
      `<span class="mono u-text-accent" style="font-size:12px;">Generating ${escapeHtml(
        TAB_TOOL_LABELS[activeView] || activeView
      )} · ${escapeHtml(formatShortModelName(effectiveModel, liveModels))}...</span>` +
      `<button type="button" class="btn-secondary btn-sm" id="nbCancelStreamBtn">Cancel</button>` +
      `</div>` +
      `<div id="nbGenStreamPreview" class="nb-markdown-body" aria-live="polite" aria-busy="true"></div>` +
      `</div></div>` +
      `</div>`;
  } else if (!artifact) {
    const emptyAccent = activeView === 'mindMap' ? 'visual' : parentTab;
    innerBodyHtml =
      `<div class="nb-workspace-body">` +
      `<div class="nb-empty-center">${renderEmptyIllustration(activeView, {
        title: `Generate ${TAB_TOOL_LABELS[activeView] || activeView} for "${scope.scopeLabel}"`,
        subtitle: `Mode: ${
          notebook.groundingMode === 'syllabus' ? 'Syllabus-guided' : 'From my sources'
        } · Model: ${formatShortModelName(effectiveModel, liveModels)}`,
        accent: emptyAccent,
        actionHtml: `<button type="button" class="btn-primary btn-md" id="nbEmptyGenerateBtn">${renderAnimatedIcon(
          'ctrl:generate',
          { size: 18 }
        )}<span>Generate Now</span></button>`
      })}</div>` +
      `</div>`;
  } else if (['notes', 'summary', 'studyGuide', 'faq', 'glossary'].includes(activeView)) {
    innerBodyHtml =
      `<div class="nb-workspace-body">` +
      (editNoteMode
        ? `<div class="nb-reading-stack">` +
          `<textarea id="nbEditArtifactTextarea" class="modal-textarea nb-full-textarea">${escapeHtml(
            String(artifact.content || '')
          )}</textarea>` +
          `<div class="u-row-between">` +
          `<button type="button" class="btn-secondary btn-md" id="nbToggleNoteEditBtn">Cancel &amp; Preview</button>` +
          `<button type="button" class="btn-primary btn-md" id="nbSaveEditedArtifactBtn" data-artifact-key="${escapeHtml(
            artifactKey
          )}">Save Edits</button>` +
          `</div></div>`
        : `<div class="nb-read-progress" id="nbReadProgressBar"></div>` +
          `<div class="nb-artifact-box nb-fill-scroll" id="nbArtifactScroll">` +
          `<div class="nb-reading-col">` +
          `<h3 class="serif nb-artifact-title">${escapeHtml(
            scope.scopeLabel
          )}<span class="title-dot"></span></h3>` +
          `<div id="nbArtifactTextBody">${formatTextWithCitations(
            String(artifact.content || ''),
            allChunks
          )}</div>` +
          `</div></div>`) +
      `</div>`;
  } else if (activeView === 'timeline') {
    innerBodyHtml = `<div class="nb-workspace-body">${renderTimelineSvgDom(
      artifact.content,
      allChunks
    )}</div>`;
  } else if (activeView === 'flashcards') {
    const cards = Array.isArray(artifact.content) ? artifact.content : [];
    if (!cards.length) {
      innerBodyHtml = `<div class="nb-workspace-body"><p class="view-subtitle">No flashcards in deck.</p></div>`;
    } else {
      const idx = Math.max(0, Math.min(fcSession.index, cards.length - 1));
      const card = cards[idx];
      const easyCount = Object.values(fcSession.ratings).filter((r) => r === 'easy').length;
      const deckPct = Math.round((easyCount / cards.length) * 100);
      innerBodyHtml =
        `<div class="nb-fc-workspace nb-focus-col">` +
        `<div class="u-row-between">` +
        `<span class="mono" style="font-size:12.5px;">Card ${idx + 1} / ${cards.length} · Mastered ${easyCount}/${cards.length} (${deckPct}%)</span>` +
        `<button type="button" class="btn-secondary btn-sm" id="nbShuffleDeckBtn">Shuffle Deck</button>` +
        `</div>` +
        `<div class="sidebar-xp-track"><div class="sidebar-xp-fill" style="width:${deckPct}%"></div></div>` +
        `<div class="nb-fc-stage">` +
        `<div class="nb-flashcard" id="nbFlashcardEl" tabindex="0" role="button" aria-label="Flashcard click to flip">` +
        `<div class="nb-fc-face nb-fc-front"><strong>${renderRichMarkdown(card.front, [], {
          inline: true
        })}</strong></div>` +
        `<div class="nb-fc-face nb-fc-back"><div>${renderRichMarkdown(card.back, [], {
          inline: true
        })}</div>` +
        (card.citation
          ? `<div class="mono u-text-accent" style="margin-top:10px; font-size:11.5px;">${escapeHtml(
              card.citation
            )}</div>`
          : '') +
        `</div></div></div>` +
        `<div class="u-row-center">` +
        `<button type="button" class="btn-secondary btn-md" data-nb-fc-score="hard">Again (Hard)</button>` +
        `<button type="button" class="btn-secondary btn-md" data-nb-fc-score="good">Good</button>` +
        `<button type="button" class="btn-primary btn-md" data-nb-fc-score="easy">Got It (Easy)</button>` +
        `</div></div>`;
    }
  } else if (activeView === 'quiz') {
    innerBodyHtml = `<div class="nb-workspace-body">${renderQuizRunnerContent({
      artifact,
      subject,
      quizSession
    })}</div>`;
  } else if (activeView === 'mindMap') {
    innerBodyHtml = `<div class="nb-workspace-body">${renderMindMapSvg(artifact.content)}</div>`;
  }

  return (
    `<div class="nb-workspace-layout${outlineCollapsed ? ' outline-collapsed' : ''}">` +
    (outlineCollapsed ? '' : renderScopeOutlineRail({ notebook, subject, activeTool: activeView, scope })) +
    `<section class="nb-workspace-card nb-spotlight-zone nb-tilt-card">` +
    viewChipStrip +
    workspaceTopBar +
    innerBodyHtml +
    `</section>` +
    `</div>`
  );
}

/**
 * Single Plan page: combines Exam Date & Today Sync + AI Spaced Revision Plan.
 */
export function renderPlanWorkspace({
  notebook,
  subject,
  vaultConfig,
  liveModels,
  isGeneratingTab,
  splitMenuOpen = false,
  tabModelOverride = null
}) {
  const scope = resolveActiveScopeDetails(notebook, subject, 'revisionPlan');
  const routedModel = resolveModelForTask('visualPlan', vaultConfig, liveModels);
  const effectiveModel = tabModelOverride || routedModel;
  const artifact = getScopedArtifact(notebook, 'revisionPlan', scope.scopeType, scope.scopeId);
  const artifactKey = makeArtifactKey('revisionPlan', scope.scopeType, scope.scopeId);

  const today = toDateKey();
  const examDate = subject?.examDate || notebook?.syllabusBrain?.examDate || '';
  const daysLeft = examDate ? diffDays(today, examDate) : null;
  const topics = subject?.topics || [];
  const revisedCount = topics.filter((t) => t.revised).length;
  const dueTodayCount = topics.filter((t) => t.srs?.nextDue && t.srs.nextDue <= today).length;

  const topBar =
    `<div class="nb-workspace-topbar">` +
    `<div class="nb-ws-title-group">` +
    renderIconTile('sec:plan', { accent: 'plan' }) +
    `<h2 class="serif nb-ws-title">Revision Plan &amp; Exam Sync<span class="title-dot"></span></h2>` +
    renderGroundingToggle(notebook.groundingMode) +
    `</div>` +
    `<div class="nb-ws-controls">` +
    (artifact
      ? `<button type="button" class="btn-secondary btn-sm" id="nbExportPdfBtn" title="Preview &amp; export clean PDF">Export PDF</button>`
      : '') +
    renderSplitGenerateButton({
      artifact,
      artifactKey,
      effectiveModel,
      liveModels,
      isGeneratingTab,
      autoGenChecked: false,
      editNoteMode: false,
      splitMenuOpen,
      hideModelAndAuto: true
    }) +
    `</div>` +
    `</div>`;

  const syncCard =
    `<div class="nb-coverage-card u-row-between">` +
    `<div class="u-row-wrap">` +
    `<div class="ui-field">` +
    `<label class="ui-label" for="nbPlanExamDateInput">Exam Date</label>` +
    `<input type="date" id="nbPlanExamDateInput" class="ui-input" value="${escapeHtml(examDate)}">` +
    `</div>` +
    `<div class="u-row-wrap">` +
    `<span class="ui-chip ui-chip--accent">${
      daysLeft !== null ? `${daysLeft}d left` : 'No exam date'
    }</span>` +
    `<span class="ui-chip ui-chip--success">${revisedCount}/${topics.length} revised</span>` +
    (dueTodayCount > 0 ? renderStatusBadge('due', `${dueTodayCount} due today`) : '') +
    `</div>` +
    `</div>` +
    `<button type="button" class="btn-secondary btn-md" id="nbJumpLedgerTodayBtn">${renderAnimatedIcon(
      'nav:today',
      { size: 18 }
    )}<span>Open Today Queue</span></button>` +
    `</div>`;

  let planBody = '';
  if (isGeneratingTab) {
    planBody =
      `<div class="nb-artifact-box nb-fill-scroll"><div class="nb-reading-col">` +
      `<div class="u-row-between" style="margin-bottom:10px;">` +
      `<span class="mono u-text-accent" style="font-size:12px;">Building revision plan...</span>` +
      `<button type="button" class="btn-secondary btn-sm" id="nbCancelStreamBtn">Cancel</button>` +
      `</div>` +
      `<div id="nbGenStreamPreview" class="nb-markdown-body" aria-live="polite" aria-busy="true"></div>` +
      `</div></div>`;
  } else if (!artifact) {
    planBody = `<div class="nb-empty-center">${renderEmptyIllustration('sec:plan', {
      title: 'Generate Personalized Revision Plan',
      subtitle: `AI prioritizes weak and unrevised topics up to your exam date using ${formatShortModelName(
        effectiveModel,
        liveModels
      )}.`,
      accent: 'plan',
      actionHtml: `<button type="button" class="btn-primary btn-md" id="nbEmptyGenerateBtn">${renderAnimatedIcon(
        'ctrl:generate',
        { size: 18 }
      )}<span>Generate Revision Plan</span></button>`
    })}</div>`;
  } else {
    const plan = artifact.content || {};
    const sched = Array.isArray(plan.schedule) ? plan.schedule : [];
    planBody =
      `<div class="nb-artifact-box nb-fill-scroll"><div class="nb-reading-col">` +
      `<p style="margin-top:0;">${escapeHtml(plan.summary || '')}</p>` +
      sched
        .map(
          (item) =>
            `<div class="weekly-row" style="grid-template-columns:1fr auto;">` +
            `<div><strong>${escapeHtml(item.topicName)}</strong><div class="u-text-muted">${escapeHtml(
              item.focusGoal
            )}</div></div>` +
            `<span class="topic-tag due">+${item.offsetDays}d</span>` +
            `</div>`
        )
        .join('') +
      `<div style="margin-top:16px;"><button type="button" class="btn-primary btn-md" id="nbApplyRevPlanBtn">Accept Plan into Today View</button></div>` +
      `</div></div>`;
  }

  return (
    `<section class="nb-workspace-card nb-spotlight-zone">` +
    topBar +
    `<div class="nb-workspace-body"><div class="nb-reading-stack">${syncCard}${planBody}</div></div>` +
    `</section>`
  );
}

/**
 * Mobile / compact viewport Scope Picker bottom-sheet modal.
 */
export function renderScopeSheetModal({ open, notebook, subject, activeTool }) {
  if (!open) return '';
  const scope = resolveActiveScopeDetails(notebook, subject, activeTool);
  const chapters = scope.chapters || [];
  const subjId = subject?.id || notebook?.subjectId || 'all';

  return (
    `<div class="modal-backdrop" id="nbScopeSheetBackdrop" role="dialog" aria-modal="true" aria-labelledby="nbScopeSheetTitle">` +
    `<div class="modal-card nb-scope-sheet">` +
    `<div class="modal-header">` +
    `<h2 class="serif" id="nbScopeSheetTitle">Select Scope<span class="title-dot"></span></h2>` +
    `<button type="button" class="topic-del" id="nbCloseScopeSheetBtn" aria-label="Close">&times;</button>` +
    `</div>` +
    `<div class="nb-outline-list" style="max-height:55dvh; overflow-y:auto;">` +
    `<button type="button" class="nb-outline-item${
      scope.scopeType === 'subject' ? ' active' : ''
    }" data-nb-pick-scope="subject:${escapeHtml(subjId)}:">Whole Subject</button>` +
    chapters
      .map((ch) => {
        const isChActive = scope.scopeType === 'chapter' && scope.scopeId === ch.id;
        const topicsHtml = (ch.topics || [])
          .map(
            (tp) =>
              `<button type="button" class="nb-outline-item topic${
                scope.scopeType === 'topic' && scope.scopeId === tp.id ? ' active' : ''
              }" data-nb-pick-scope="topic:${escapeHtml(ch.id)}:${escapeHtml(tp.id)}">${escapeHtml(
                tp.name
              )}</button>`
          )
          .join('');
        return (
          `<button type="button" class="nb-outline-item chapter${
            isChActive ? ' active' : ''
          }" data-nb-pick-scope="chapter:${escapeHtml(ch.id)}:">${escapeHtml(ch.name)}</button>` +
          topicsHtml
        );
      })
      .join('') +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

export function renderVersionCompareModal({ versionModalKey, notebook, selectedVersionIdx }) {
  if (!versionModalKey || !notebook?.artifactsMap?.[versionModalKey]) return '';
  const art = notebook.artifactsMap[versionModalKey];
  const versions = art.versions || [];
  const cmpIdx = Math.max(0, Math.min(selectedVersionIdx, Math.max(0, versions.length - 1)));
  const oldVer = versions[cmpIdx];

  const stringifyVal = (v) =>
    typeof v === 'string' ? v : JSON.stringify(v, null, 2);

  return (
    `<div class="modal-backdrop" id="nbVersionModalBackdrop" role="dialog" aria-modal="true" aria-labelledby="nbVerTitle">` +
    `<div class="modal-card nb-modal-xl u-stack-md">` +
    `<div class="modal-header">` +
    `<h2 class="serif" id="nbVerTitle">Version History &amp; Model Comparison<span class="title-dot"></span></h2>` +
    `<button type="button" class="topic-del" id="nbCloseVersionsBtn" aria-label="Close">&times;</button>` +
    `</div>` +
    `<div class="u-row-wrap">` +
    versions
      .map(
        (v, idx) =>
          `<button type="button" class="btn-secondary btn-sm${
            idx === cmpIdx ? ' active' : ''
          }" data-nb-select-ver="${idx}">v-${idx + 1} · ${escapeHtml(
            formatShortModelName(v.model)
          )} · ${escapeHtml(v.mode)}</button>`
      )
      .join('') +
    `</div>` +
    `<div class="nb-notes-split">` +
    `<div class="nb-note-pane">` +
    `<div class="mono u-text-mint" style="font-size:11.5px;">Current (${escapeHtml(
      formatShortModelName(art.model)
    )} · ${escapeHtml(art.mode)})</div>` +
    `<pre class="nb-ver-pre">${escapeHtml(
      stringifyVal(art.content)
    )}</pre>` +
    `</div>` +
    `<div class="nb-note-pane">` +
    `<div class="mono u-text-accent" style="font-size:11.5px;">Saved v-${cmpIdx + 1} (${escapeHtml(
      formatShortModelName(oldVer?.model || '')
    )} · ${escapeHtml(oldVer?.mode || '')})</div>` +
    `<pre class="nb-ver-pre">${escapeHtml(
      stringifyVal(oldVer?.content || '')
    )}</pre>` +
    `</div>` +
    `</div>` +
    `<div class="modal-actions">` +
    `<button type="button" class="btn-secondary btn-md" id="nbCloseVersionsBottomBtn">Close</button>` +
    `<button type="button" class="btn-primary btn-md" id="nbRestoreVersionBtn" data-nb-restore-ver="${cmpIdx}">Restore This Version</button>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

export function renderOcrReviewModal(ocrQueue) {
  if (!ocrQueue.length) return '';
  const item = ocrQueue[0];
  const remaining = ocrQueue.length - 1;

  return (
    `<div class="modal-backdrop" id="nbOcrModalBackdrop" role="dialog" aria-modal="true" aria-labelledby="nbOcrTitle">` +
    `<div class="modal-card u-stack-md">` +
    `<div class="modal-header">` +
    `<h2 class="serif" id="nbOcrTitle">Review Extracted Image Text${
      remaining ? ` (+${remaining} queued)` : ''
    }<span class="title-dot"></span></h2>` +
    `<button type="button" class="topic-del" id="nbCloseOcrBtn" aria-label="Skip image">&times;</button>` +
    `</div>` +
    `<div class="nb-ocr-preview" id="nbOcrPreviewBox">` +
    `<div class="nb-ocr-thumb-wrap">` +
    `<img class="nb-ocr-thumb" src="${escapeHtml(item.thumbnail)}" alt="Image preview">` +
    (item.status === 'scanning' ? `<div class="nb-scan-line"></div>` : '') +
    `</div>` +
    `<div class="u-stack-sm">` +
    `<input type="text" id="nbOcrTitleInput" class="ui-input" value="${escapeHtml(
      item.title
    )}" aria-label="Source title">` +
    (item.status === 'scanning'
      ? `<p class="mono u-text-accent" style="font-size:12px;">Scanning image with Gemini vision model...</p>`
      : item.error
        ? `<p class="u-text-danger">${escapeHtml(item.error)}</p>`
        : `<textarea class="modal-textarea" id="nbOcrTextInput" style="min-height:135px; margin-bottom:0;">${escapeHtml(
            item.text || ''
          )}</textarea>`) +
    `</div>` +
    `</div>` +
    `<div class="modal-actions">` +
    `<button type="button" class="btn-secondary btn-md" id="nbOcrRetryBtn">Retry</button>` +
    `<button type="button" class="btn-primary btn-md" id="nbOcrSaveBtn" ${
      item.status === 'scanning' ? 'disabled' : ''
    }>Save as Source</button>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

export function renderPasteAndTopicNotesModals({ pasteModalOpen, topicNotesModalOpen, subject }) {
  if (pasteModalOpen) {
    return (
      `<div class="modal-backdrop" id="nbPasteModalBackdrop" role="dialog" aria-modal="true" aria-labelledby="nbPasteModalTitle">` +
      `<div class="modal-card u-stack-md">` +
      `<div class="modal-header">` +
      `<h2 class="serif" id="nbPasteModalTitle">Paste Study Source<span class="title-dot"></span></h2>` +
      `<button type="button" class="topic-del" id="nbClosePasteBtn" aria-label="Close">&times;</button>` +
      `</div>` +
      `<input type="text" id="nbPasteTitleInput" class="ui-input" placeholder="Source title...">` +
      `<textarea class="modal-textarea" id="nbPasteBodyInput" placeholder="Paste lecture notes, textbook excerpt, or derivations..."></textarea>` +
      `<div class="modal-actions"><button type="button" class="btn-primary btn-md" id="nbSavePasteSrcBtn">Save Source</button></div>` +
      `</div>` +
      `</div>`
    );
  }

  if (topicNotesModalOpen && subject) {
    const withNotes = (subject.topics || []).filter(
      (t) => (t.notes && t.notes.trim()) || (t.doubts && t.doubts.length)
    );
    return (
      `<div class="modal-backdrop" id="nbNotesModalBackdrop" role="dialog" aria-modal="true" aria-labelledby="nbNotesModalTitle">` +
      `<div class="modal-card u-stack-md">` +
      `<div class="modal-header">` +
      `<h2 class="serif" id="nbNotesModalTitle">Import Topic Notes &amp; Doubts<span class="title-dot"></span></h2>` +
      `<button type="button" class="topic-del" id="nbCloseNotesBtn" aria-label="Close">&times;</button>` +
      `</div>` +
      (withNotes.length
        ? `<div class="u-scroll-box">` +
          withNotes
            .map(
              (t) =>
                `<label class="u-check-label" style="display:flex; padding:8px 0; border-bottom:1px solid var(--border-hairline);">` +
                `<input type="checkbox" class="nb-topic-note-cb" value="${escapeHtml(t.id)}" checked>` +
                `<span>${escapeHtml(t.name)}</span></label>`
            )
            .join('') +
          `</div>` +
          `<div class="modal-actions"><button type="button" class="btn-primary btn-md" id="nbImportTopicNotesBtn">Import Selected</button></div>`
        : `<p class="view-subtitle">No topics in this subject have written notes or doubts yet.</p>`) +
      `</div>` +
      `</div>`
    );
  }

  return '';
}
