import { escapeHtml } from '../../utils/dom.js';
import { getScopedArtifact } from '../../storage/notebookStore.js';
import { resolveModelForTask, formatShortModelName } from '../../features/modelCatalog.js';
import { syllabusBrainToLedgerSyllabus } from '../../features/notebookGenerators.js';
import { renderAnimatedIcon, renderIconTile, renderStatusBadge } from '../icons.js';

const COVERAGE_BADGES = [
  { id: 'notes', label: 'Notes', scope: 'topic' },
  { id: 'summary', label: 'Summary', scope: 'chapter' },
  { id: 'studyGuide', label: 'Guide', scope: 'chapter' },
  { id: 'faq', label: 'FAQ', scope: 'chapter' },
  { id: 'glossary', label: 'Glossary', scope: 'chapter' },
  { id: 'timeline', label: 'Timeline', scope: 'chapter' },
  { id: 'mindMap', label: 'Mind Map', scope: 'chapter' },
  { id: 'flashcards', label: 'Cards', scope: 'chapter' },
  { id: 'quiz', label: 'Quiz', scope: 'chapter' }
];

function renderScanInputsHtml({
  notebook,
  subject,
  syllabusScanning,
  syllabusScanError,
  syllabusPasteText,
  vaultConfig,
  liveModels,
  compact = false
}) {
  const ocrModel = resolveModelForTask('ocr', vaultConfig, liveModels);
  const shortModel = formatShortModelName(ocrModel, liveModels);

  return (
    `<div class="nb-hero-drop" id="nbSyllabusDropZone" tabindex="0">` +
    `<div class="nb-scan-line nb-hover-scan"></div>` +
    (syllabusScanning
      ? `<div class="nb-ocr-thumb-wrap u-row-center" style="width:220px; height:96px;">` +
        `<span class="mono u-text-accent" style="font-size:12px;">Reading syllabus with ${escapeHtml(
          shortModel
        )}...</span>` +
        `<div class="nb-scan-line"></div>` +
        `</div>`
      : renderIconTile('home:scan', { variant: 'hero', size: 24, accent: 'home' }) +
        `<div class="serif" style="font-size:20px;">Drop syllabus photo(s), PDF, or paste image (Ctrl+V)</div>` +
        `<div class="u-text-muted" style="max-width:520px;">Supports PNG, JPG, WEBP photos, PDFs, or outline text. Always opens the Syllabus Tree Editor to review before saving.</div>` +
        `<div class="u-row-center">` +
        `<label class="btn-primary btn-md">${renderAnimatedIcon('sources:upload', {
          size: 18
        })}<span>Upload Photo / PDF</span><input type="file" id="nbSyllabusFileInput" accept=".pdf,.txt,.md,.json,image/png,image/jpeg,image/webp" multiple class="nb-hidden-input"></label>` +
        `<label class="btn-secondary btn-md">${renderAnimatedIcon('ctrl:camera', {
          size: 18
        })}<span>Camera Capture</span><input type="file" id="nbSyllabusCameraInput" accept="image/*" capture="environment" class="nb-hidden-input"></label>` +
        `<button type="button" class="btn-secondary btn-md" id="nbBuildFromLedgerBtn">${renderAnimatedIcon(
          'home:sync',
          { size: 18 }
        )}<span>Build from Ledger (${subject?.topics?.length || 0})</span></button>` +
        `</div>`) +
    `</div>` +
    (syllabusScanError
      ? `<div class="u-text-danger">${escapeHtml(syllabusScanError)}</div>`
      : '') +
    `<div class="ui-field">` +
    `<label for="nbSyllabusPasteInput" class="ui-label">Or paste syllabus outline or JSON:</label>` +
    `<textarea id="nbSyllabusPasteInput" class="modal-textarea" style="min-height:${
      compact ? '95px' : '115px'
    }; margin-bottom:0;" placeholder="Unit 1: Kinematics&#10;- Motion in 1D&#10;- Vectors">${escapeHtml(
      syllabusPasteText || ''
    )}</textarea>` +
    `<div class="u-row-end">` +
    `<button type="button" class="btn-secondary btn-md" id="nbValidateJsonPasteBtn">${renderAnimatedIcon(
      'sources:paste',
      { size: 18 }
    )}<span>Import Validated JSON</span></button>` +
    `<button type="button" class="btn-primary btn-md" id="nbParsePastedSyllabusBtn" ${
      syllabusScanning ? 'disabled' : ''
    }>${renderAnimatedIcon('ctrl:generate', { size: 18 })}<span>${
      syllabusScanning ? 'Parsing Syllabus...' : 'Parse Syllabus with AI'
    }</span></button>` +
    `</div>` +
    `</div>` +
    (notebook?.syllabusBrain && !compact
      ? `<div class="u-row-end"><button type="button" class="btn-secondary btn-md" id="nbCancelRescanBtn">Back to Overview</button></div>`
      : '')
  );
}

function renderCoverageMatrixBody(notebook, subject) {
  const brain = notebook.syllabusBrain;
  const chapters = brain?.chapters || [];
  const totalTopics = chapters.reduce((acc, ch) => acc + (ch.topics?.length || 0), 0);
  const ledgerMatches = syllabusBrainToLedgerSyllabus(brain, subject, subject?.name);

  const hasIncludedSources = (notebook.sources || []).some((s) => s.included && s.chunks?.length);
  const syllabusArtifactsCount = Object.values(notebook.artifactsMap || {}).filter(
    (a) => a && a.mode === 'syllabus'
  ).length;

  const chaptersHtml = chapters
    .map((ch) => {
      let readyCount = 0;
      const pillsHtml = COVERAGE_BADGES.map((b) => {
        let done = false;
        let scopeType = b.scope;
        if (b.id === 'notes') {
          done = (ch.topics || []).some((tp) => {
            const art = getScopedArtifact(notebook, 'notes', 'topic', tp.id);
            return Boolean(art?.content);
          });
          if (!ch.topics?.length) scopeType = 'chapter';
        } else {
          const art = getScopedArtifact(notebook, b.id, 'chapter', ch.id);
          done = Boolean(art && (Array.isArray(art.content) ? art.content.length : art.content));
        }
        if (done) readyCount += 1;

        return `<button type="button" class="nb-cov-pill${done ? ' done' : ''}" data-nb-jump="${
          b.id
        }" data-nb-jump-ch="${escapeHtml(ch.id)}" data-nb-jump-tp="${escapeHtml(
          ch.topics?.[0]?.id || ''
        )}" data-nb-jump-scope="${scopeType}">${renderAnimatedIcon(b.id, {
          size: 16
        })}<span>${escapeHtml(b.label)}${done ? ' ✓' : ''}</span></button>`;
      }).join('');

      const chapterBadge =
        readyCount === COVERAGE_BADGES.length
          ? renderStatusBadge('mastered', 'Complete')
          : readyCount > 0
            ? renderStatusBadge('generated', `${readyCount}/${COVERAGE_BADGES.length} ready`)
            : '';

      const topicNames = (ch.topics || [])
        .slice(0, 6)
        .map((t) => escapeHtml(t.name))
        .join(' · ');

      return (
        `<div class="nb-coverage-card nb-spotlight-zone nb-tilt-card">` +
        `<div class="u-row-between">` +
        `<strong style="font-size:15.5px;">${escapeHtml(ch.name)}</strong>` +
        `<div class="u-row-wrap">${chapterBadge}<span class="ui-chip ui-chip--accent">${
          ch.topics?.length || 0
        } topics</span></div>` +
        `</div>` +
        (topicNames
          ? `<div class="u-text-muted" style="margin-top:6px;">${topicNames}${
              (ch.topics?.length || 0) > 6 ? ` +${ch.topics.length - 6} more` : ''
            }</div>`
          : '') +
        `<div class="nb-cov-pills">${pillsHtml}</div>` +
        `</div>`
      );
    })
    .join('');

  return (
    `<div class="nb-workspace-topbar">` +
    `<div class="nb-ws-title-group">` +
    renderIconTile('home:overview', { accent: 'home' }) +
    `<div>` +
    `<h2 class="serif nb-ws-title">Syllabus Overview<span class="title-dot"></span></h2>` +
    `<div class="nb-ws-sub">${chapters.length} chapters · ${totalTopics} topics${
      brain.examDate ? ` · Exam ${escapeHtml(brain.examDate)}` : ''
    }</div>` +
    `</div>` +
    `</div>` +
    `<div class="nb-ws-controls">` +
    `<button type="button" class="btn-secondary btn-sm" id="nbEditBrainBtn">${renderAnimatedIcon(
      'home:tree',
      { size: 16 }
    )}<span>Edit Tree</span></button>` +
    `<button type="button" class="btn-secondary btn-sm" id="nbRescanSyllabusBtn">${renderAnimatedIcon(
      'home:scan',
      { size: 16 }
    )}<span>Scan / Paste</span></button>` +
    `<button type="button" class="btn-secondary btn-sm" id="nbApplyToLedgerBtn">${renderAnimatedIcon(
      'home:sync',
      { size: 16 }
    )}<span>Apply to Ledger (${ledgerMatches.preview.newTopicsCount})</span></button>` +
    `<button type="button" class="btn-primary btn-md" id="nbOpenQueueModalBtn">${renderAnimatedIcon(
      'home:queue',
      { size: 18 }
    )}<span>Generate Everything</span></button>` +
    `</div>` +
    `</div>` +
    (hasIncludedSources && syllabusArtifactsCount > 0
      ? `<div class="nb-warn-banner">` +
        `<span><strong>${syllabusArtifactsCount}</strong> syllabus-guided artifacts can now be upgraded with source citations.</span>` +
        `<button type="button" class="btn-primary btn-sm" id="nbUpgradeGroundedBtn">Regenerate Grounded Versions</button>` +
        `</div>`
      : '') +
    `<div class="nb-workspace-body"><div class="nb-coverage-grid">${chaptersHtml}</div></div>`
  );
}

/**
 * Render the Notebook `Home` tab (Overview when syllabus exists; Scan Hero when no syllabus exists).
 */
export function renderHomeWorkspace({
  notebook,
  subject,
  syllabusScanning,
  syllabusScanError,
  syllabusPasteText,
  vaultConfig,
  liveModels
}) {
  if (!notebook?.syllabusBrain) {
    return (
      `<section class="nb-workspace-card nb-spotlight-zone">` +
      `<div class="nb-workspace-topbar">` +
      `<div class="nb-ws-title-group">` +
      renderIconTile('home:scan', { accent: 'home' }) +
      `<h2 class="serif nb-ws-title">Build Your Syllabus Brain<span class="title-dot"></span></h2>` +
      `</div>` +
      `</div>` +
      `<div class="nb-workspace-body"><div class="nb-reading-stack">${renderScanInputsHtml({
        notebook,
        subject,
        syllabusScanning,
        syllabusScanError,
        syllabusPasteText,
        vaultConfig,
        liveModels,
        compact: false
      })}</div></div>` +
      `</section>`
    );
  }

  return (
    `<section class="nb-workspace-card nb-spotlight-zone">${renderCoverageMatrixBody(
      notebook,
      subject
    )}</section>`
  );
}

export function renderSyllabusScanModal({
  open,
  notebook,
  subject,
  syllabusScanning,
  syllabusScanError,
  syllabusPasteText,
  vaultConfig,
  liveModels
}) {
  if (!open) return '';
  return (
    `<div class="modal-backdrop" id="nbScanSyllabusBackdrop" role="dialog" aria-modal="true" aria-labelledby="nbScanModalTitle">` +
    `<div class="modal-card nb-modal-lg u-stack-md">` +
    `<div class="modal-header">` +
    `<h2 class="serif" id="nbScanModalTitle">Scan or Paste Syllabus<span class="title-dot"></span></h2>` +
    `<button type="button" class="topic-del" id="nbCancelRescanBtn" aria-label="Close">&times;</button>` +
    `</div>` +
    `<div class="u-stack-md">` +
    renderScanInputsHtml({
      notebook,
      subject,
      syllabusScanning,
      syllabusScanError,
      syllabusPasteText,
      vaultConfig,
      liveModels,
      compact: true
    }) +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

export function renderSyllabusTreeModal({ open, draft }) {
  if (!open || !draft) return '';
  const chaptersHtml = (draft.chapters || [])
    .map((ch, cIdx) => {
      const topicsHtml = (ch.topics || [])
        .map(
          (tp, tIdx) =>
            `<div class="nb-tree-topic-row">` +
            `<input type="text" class="ui-input u-flex-1" data-nb-tree-tp-name="${cIdx}:${tIdx}" value="${escapeHtml(
              tp.name
            )}" aria-label="Topic name">` +
            `<input type="text" class="ui-input u-flex-1" data-nb-tree-tp-subs="${cIdx}:${tIdx}" value="${escapeHtml(
              (tp.subtopics || []).join(', ')
            )}" placeholder="Subtopics (comma-separated)" aria-label="Subtopics">` +
            `<button type="button" class="topic-del" data-nb-tree-del-tp="${cIdx}:${tIdx}" title="Remove topic">&times;</button>` +
            `</div>`
        )
        .join('');

      return (
        `<div class="nb-tree-chapter" data-nb-tree-ch-idx="${cIdx}">` +
        `<div class="nb-tree-ch-head">` +
        `<span class="nb-tree-drag" title="Drag to reorder chapter">&#8942;&#8942;</span>` +
        `<input type="text" class="ui-input u-flex-1" data-nb-tree-ch-name="${cIdx}" value="${escapeHtml(
          ch.name
        )}" aria-label="Chapter name">` +
        `<button type="button" class="btn-secondary btn-sm" data-nb-tree-add-tp="${cIdx}">+ Topic</button>` +
        (cIdx > 0
          ? `<button type="button" class="btn-secondary btn-sm" data-nb-tree-merge-ch="${cIdx}" title="Merge topics into chapter above">Merge &uarr;</button>`
          : '') +
        `<button type="button" class="topic-del" data-nb-tree-del-ch="${cIdx}" title="Delete chapter">&times;</button>` +
        `</div>` +
        `<div class="nb-tree-topic-list">${
          topicsHtml ||
          `<span class="u-text-sm">No topics yet — click + Topic.</span>`
        }</div>` +
        `</div>`
      );
    })
    .join('');

  return (
    `<div class="modal-backdrop" id="nbTreeModalBackdrop" role="dialog" aria-modal="true" aria-labelledby="nbTreeModalTitle">` +
    `<div class="modal-card nb-modal-xl u-stack-md">` +
    `<div class="modal-header">` +
    `<h2 class="serif" id="nbTreeModalTitle">Edit Syllabus Tree<span class="title-dot"></span></h2>` +
    `<button type="button" class="topic-del" id="nbTreeDiscardBtn" aria-label="Close">&times;</button>` +
    `</div>` +
    `<p class="u-text-muted" style="margin:0;">Rename, merge, or drag chapters to reorder before saving your Syllabus Brain.</p>` +
    `<div class="u-grid-2">` +
    `<div class="ui-field">` +
    `<label for="nbTreeSubjectName" class="ui-label">Subject Name</label>` +
    `<input type="text" id="nbTreeSubjectName" class="ui-input" value="${escapeHtml(
      draft.subjectName || ''
    )}">` +
    `</div>` +
    `<div class="ui-field">` +
    `<label for="nbTreeExamDate" class="ui-label">Exam Date (optional)</label>` +
    `<input type="date" id="nbTreeExamDate" class="ui-input" value="${escapeHtml(
      draft.examDate || ''
    )}">` +
    `</div>` +
    `</div>` +
    `<div id="nbSyllabusTreeList" class="nb-tree-scroll">${chaptersHtml}</div>` +
    `<div class="modal-actions u-row-between">` +
    `<button type="button" class="btn-secondary btn-md" id="nbTreeAddChapterBtn">+ Add Chapter</button>` +
    `<div class="u-row-wrap">` +
    `<button type="button" class="btn-secondary btn-md" id="nbTreeDiscardBottomBtn">Cancel</button>` +
    `<button type="button" class="btn-primary btn-md" id="nbTreeLooksGoodBtn">Save Syllabus Brain</button>` +
    `</div>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

export function renderApplyLedgerModal({ open, notebook, subject }) {
  if (!open || !notebook?.syllabusBrain) return '';
  const { preview } = syllabusBrainToLedgerSyllabus(
    notebook.syllabusBrain,
    subject,
    subject?.name
  );

  const itemsHtml = preview.newTopicItems.length
    ? preview.newTopicItems
        .slice(0, 30)
        .map(
          (t) =>
            `<div class="weekly-row" style="grid-template-columns:1fr auto;">` +
            `<span>${escapeHtml(t.name)}</span>` +
            `<span class="nb-badge-mini">${escapeHtml(t.chapter)}</span>` +
            `</div>`
        )
        .join('')
    : `<p class="view-subtitle" style="margin:0;">All Syllabus Brain topics already exist in "${escapeHtml(
        preview.subjectName
      )}". Nothing duplicated.</p>`;

  return (
    `<div class="modal-backdrop" id="nbApplyLedgerBackdrop" role="dialog" aria-modal="true" aria-labelledby="nbApplyLedgerTitle">` +
    `<div class="modal-card u-stack-md">` +
    `<div class="modal-header">` +
    `<h2 class="serif" id="nbApplyLedgerTitle">Apply Syllabus Brain to Ledger<span class="title-dot"></span></h2>` +
    `<button type="button" class="topic-del" id="nbCloseApplyLedgerBtn" aria-label="Close">&times;</button>` +
    `</div>` +
    `<div class="u-text-accent" style="font-size:13px;">` +
    `Subject: ${escapeHtml(preview.subjectName)} · ${preview.newTopicsCount} new topics to add · ${
      preview.duplicateTopicsCount
    } existing topics preserved` +
    `</div>` +
    `<div class="u-scroll-box">${itemsHtml}</div>` +
    `<div class="modal-actions">` +
    `<button type="button" class="btn-secondary btn-md" id="nbCancelApplyLedgerBtn">Cancel</button>` +
    `<button type="button" class="btn-primary btn-md" id="nbConfirmApplyLedgerBtn">Merge ${preview.newTopicsCount} Topics into Ledger</button>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}

export function renderGenerateAllModal({
  open,
  notebook,
  queueSnapshot,
  queueIncludeExisting,
  queueConcurrency,
  queueSelectedTypes
}) {
  if (!open) return '';
  const snap = queueSnapshot || notebook?.queueState || { status: 'idle', tasks: [] };
  const isRunning = snap.status === 'running';
  const isPaused = snap.status === 'paused';
  const total = snap.total || snap.tasks?.length || 0;
  const done = snap.completed || (snap.tasks || []).filter((t) => t.status === 'done').length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const typeOptions = [
    { id: 'summary', label: 'Summary' },
    { id: 'studyGuide', label: 'Study Guide' },
    { id: 'flashcards', label: 'Flashcards' },
    { id: 'quiz', label: 'Quiz' },
    { id: 'mindMap', label: 'Mind Map' }
  ];

  const tasksHtml = (snap.tasks || [])
    .slice(0, 40)
    .map(
      (t) =>
        `<div class="weekly-row" style="grid-template-columns:1fr auto auto;">` +
        `<span><strong>${escapeHtml(t.scopeLabel)}</strong> · ${escapeHtml(t.type)}</span>` +
        `<span class="nb-badge-mini">${escapeHtml(t.modelUsed || '-')}</span>` +
        `<span class="nb-badge-mini">${escapeHtml(t.status)}${
          t.error ? `: ${escapeHtml(t.error)}` : ''
        }</span>` +
        `</div>`
    )
    .join('');

  return (
    `<div class="modal-backdrop" id="nbQueueBackdrop" role="dialog" aria-modal="true" aria-labelledby="nbQueueTitle">` +
    `<div class="modal-card nb-modal-md u-stack-md">` +
    `<div class="modal-header">` +
    `<h2 class="serif" id="nbQueueTitle">Generate Everything Queue<span class="title-dot"></span></h2>` +
    `<button type="button" class="topic-del" id="nbCloseQueueBtn" aria-label="Close">&times;</button>` +
    `</div>` +
    `<p class="u-text-muted" style="margin:0;">` +
    `Generates missing chapter artifacts cleanly using your Syllabus Brain + configured per-task models and backoff retries.` +
    `</p>` +
    `<div class="u-row-wrap">` +
    typeOptions
      .map(
        (t) =>
          `<label class="u-check-label">` +
          `<input type="checkbox" class="nb-queue-type-cb" value="${t.id}" ${
            queueSelectedTypes.includes(t.id) ? 'checked' : ''
          } ${isRunning ? 'disabled' : ''}>` +
          `<span>${t.label}</span></label>`
      )
      .join('') +
    `</div>` +
    `<div class="u-row-between">` +
    `<label class="u-check-label">` +
    `<input type="checkbox" id="nbQueueIncludeExistingCb" ${
      queueIncludeExisting ? 'checked' : ''
    } ${isRunning ? 'disabled' : ''}>` +
    `<span>Regenerate existing items (archives last 3 versions)</span>` +
    `</label>` +
    `<label class="u-check-label">` +
    `<span>Concurrency:</span>` +
    `<select id="nbQueueConcurrencySelect" class="ui-select" style="width:auto;" ${isRunning ? 'disabled' : ''}>` +
    `<option value="1"${queueConcurrency === 1 ? ' selected' : ''}>1 (Safest)</option>` +
    `<option value="2"${queueConcurrency === 2 ? ' selected' : ''}>2 (Faster)</option>` +
    `</select></label>` +
    `</div>` +
    (total
      ? `<div class="u-stack-sm">` +
        `<div class="mono u-text-sm">Progress: ${done} / ${total} (${pct}%) · Status: ${escapeHtml(
          snap.status
        )}</div>` +
        `<div class="sidebar-xp-track"><div class="sidebar-xp-fill" style="width:${pct}%"></div></div>` +
        `</div>` +
        `<div class="u-scroll-box">${tasksHtml}</div>`
      : '') +
    `<div class="modal-actions">` +
    (!isRunning && !isPaused
      ? `<button type="button" class="btn-primary btn-md" id="nbStartQueueBtn">Start Queue</button>`
      : '') +
    (isRunning ? `<button type="button" class="btn-secondary btn-md" id="nbPauseQueueBtn">Pause</button>` : '') +
    (isPaused ? `<button type="button" class="btn-primary btn-md" id="nbResumeQueueBtn">Resume</button>` : '') +
    (isRunning || isPaused
      ? `<button type="button" class="btn-secondary btn-md u-text-danger" id="nbCancelQueueBtn">Cancel Queue</button>`
      : '') +
    `</div>` +
    `</div>` +
    `</div>`
  );
}
