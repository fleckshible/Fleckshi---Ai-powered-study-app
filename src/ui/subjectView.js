import { escapeHtml } from '../utils/dom.js';
import { formatCountdown, getSubjectStats } from '../features/examPlanner.js';
import { toDateKey } from '../utils/date.js';
import { renderTopicExtras } from './topicExtras.js';
import {
  renderAnimatedIcon,
  renderIconTile,
  renderStatusBadge,
  renderEmptyIllustration
} from './icons.js';

const DEFAULT_CHAPTERS = ['General', 'Core Concepts', 'Formulas', 'High-Yield', 'Practice Set'];

function matchesFilter(topic, filter, today) {
  const allDone = topic.read && topic.revised && topic.practiced;
  if (filter === 'unstarted') return !topic.read && !topic.revised && !topic.practiced;
  if (filter === 'revision') {
    const dueNow = topic.srs?.nextDue && topic.srs.nextDue <= today;
    return Boolean(dueNow || (topic.read && !allDone));
  }
  if (filter === 'mastered') return allDone;
  return true;
}

function renderTopicCard(t, today, expandedTopicIds) {
  const allDone = t.read && t.revised && t.practiced;
  const isExpanded = expandedTopicIds.has(t.id);
  const beam1Pct = t.read ? (t.revised ? 100 : 50) : 0;
  const beam2Pct = t.revised ? (t.practiced ? 100 : 50) : 0;
  const reps = Math.max(t.practiced ? 1 : 0, t.practiceCount || 0);

  const tags = [];
  if (allDone) {
    tags.push(renderStatusBadge('mastered', 'Mastered'));
  }
  if (t.srs?.nextDue) {
    const isOverdue = t.srs.nextDue < today;
    const isDueToday = t.srs.nextDue === today;
    if (isOverdue) {
      tags.push(renderStatusBadge('due', `Overdue ${t.srs.nextDue}`));
    } else if (isDueToday) {
      tags.push(renderStatusBadge('stale', 'Due Today'));
    } else {
      tags.push(`<span class="ui-chip ui-chip--info">SRS ${escapeHtml(t.srs.nextDue)}</span>`);
    }
  }
  if (t.studyMinutes > 0) {
    tags.push(`<span class="ui-chip">${t.studyMinutes}m</span>`);
  }
  const openDoubts = (t.doubts || []).filter((d) => !d.resolved).length;
  if (openDoubts > 0) {
    tags.push(
      `<span class="ui-chip ui-chip--warn">${openDoubts} doubt${openDoubts === 1 ? '' : 's'}</span>`
    );
  }

  const showConfidence = t.revised || t.practiced;
  const confHtml = showConfidence
    ? `<div class="inline-conf-row">` +
      `<span>Recall confidence:</span>` +
      `<div class="inline-conf-btns">` +
      `<button type="button" class="conf-chip-btn${t.confidence === 'hard' ? ' active' : ''}" data-inline-conf="hard" data-topic="${t.id}">Hard (+1d)</button>` +
      `<button type="button" class="conf-chip-btn${
        !t.confidence || t.confidence === 'good' ? ' active' : ''
      }" data-inline-conf="good" data-topic="${t.id}">Good</button>` +
      `<button type="button" class="conf-chip-btn mint${
        t.confidence === 'easy' ? ' active' : ''
      }" data-inline-conf="easy" data-topic="${t.id}">Mastered</button>` +
      `</div>` +
      `</div>`
    : '';

  return (
    `<li class="topic-item" data-topic-row="${t.id}">` +
    `<div class="topic-card-body">` +
    `<div class="topic-card-top">` +
    `<div class="topic-left-group">` +
    `<span class="topic-drag-handle" title="Drag to reorder" aria-hidden="true">&#8942;&#8942;</span>` +
    `<div class="topic-main">` +
    `<div class="topic-name${allDone ? ' done-all' : ''}">${escapeHtml(t.name)}</div>` +
    (tags.length ? `<div class="topic-submeta">${tags.join('')}</div>` : '') +
    `</div>` +
    `</div>` +
    `<div class="topic-card-actions">` +
    `<div class="topic-menu-wrap">` +
    `<button type="button" class="topic-more-btn" data-topic-menu-btn="${t.id}" aria-haspopup="menu" aria-expanded="false" aria-label="Actions for ${escapeHtml(
      t.name
    )}" title="Topic actions">${renderAnimatedIcon('action:more', { size: 18 })}</button>` +
    `<div class="topic-action-menu" data-topic-menu="${t.id}" role="menu">` +
    `<button type="button" class="topic-menu-item" role="menuitem" data-focus-topic="${t.id}">${renderAnimatedIcon(
      'nav:focus',
      { size: 16 }
    )}<span>Focus on This</span></button>` +
    `<button type="button" class="topic-menu-item" role="menuitem" data-toggle-extras="${t.id}" aria-expanded="${isExpanded}">${renderAnimatedIcon(
      'notes',
      { size: 16 }
    )}<span>${isExpanded ? 'Hide Notes &amp; Doubts' : 'Notes &amp; Doubts'}</span></button>` +
    `<button type="button" class="topic-menu-item danger" role="menuitem" data-del-topic="${t.id}">${renderAnimatedIcon(
      'action:trash',
      { size: 16 }
    )}<span>Delete Topic</span></button>` +
    `</div>` +
    `</div>` +
    `</div>` +
    `</div>` +
    `<div class="mastery-pipeline" role="group" aria-label="Mastery stages for ${escapeHtml(t.name)}">` +
    `<button type="button" class="mark-btn pipeline-node m1${t.read ? ' on' : ''}" data-topic="${t.id}" data-level="read" aria-pressed="${Boolean(
      t.read
    )}" aria-label="Read once for ${escapeHtml(t.name)}${t.read ? ', done' : ', not done'}">&#9312; Read Once</button>` +
    `<div class="pipeline-beam"><div class="pipeline-beam-fill" data-beam-w="${beam1Pct}%" style="width:${beam1Pct}%"></div></div>` +
    `<button type="button" class="mark-btn pipeline-node m2${t.revised ? ' on' : ''}" data-topic="${t.id}" data-level="revised" aria-pressed="${Boolean(
      t.revised
    )}" aria-label="Revised for ${escapeHtml(t.name)}${t.revised ? ', done' : ', not done'}">&#9313; Revised</button>` +
    `<div class="pipeline-beam mint"><div class="pipeline-beam-fill" data-beam-w="${beam2Pct}%" style="width:${beam2Pct}%"></div></div>` +
    `<button type="button" class="mark-btn pipeline-node m3${t.practiced ? ' on' : ''}" data-topic="${t.id}" data-level="practiced" aria-pressed="${Boolean(
      t.practiced
    )}" aria-label="Practiced for ${escapeHtml(t.name)}${t.practiced ? ', done' : ', not done'}">&#9314; Practiced</button>` +
    (t.practiced
      ? `<button type="button" class="rep-pill" data-inc-practice="${t.id}" title="Log another practice rep">&times;${reps} +1</button>`
      : '') +
    `</div>` +
    confHtml +
    `</div>` +
    (isExpanded ? renderTopicExtras(t) : '') +
    `</li>`
  );
}

export function renderSubjectView(
  subject,
  expandedTopicIds = new Set(),
  pendingConfidence = null,
  uiOpts = {}
) {
  if (!subject) {
    return (
      `<main class="page">` +
      `<div class="empty-state">` +
      `<h2 class="serif">No subject yet<span class="title-dot"></span></h2>` +
      `<p>Add a subject on the left to begin tracking your syllabus.</p>` +
      `</div>` +
      `</main>`
    );
  }

  const today = toDateKey();
  const stats = getSubjectStats(subject, today);
  const countdownText = formatCountdown(stats.daysLeft);
  const filter = uiOpts.filter || 'all';
  const sortMode = uiOpts.sort || 'manual';
  const collapsedChapters = uiOpts.collapsedChapters || new Set();
  const pastedLines = uiOpts.pastedLines || [];
  const selectedChapter = uiOpts.selectedChapter || 'General';

  const chapterSet = new Set(DEFAULT_CHAPTERS);
  (subject.topics || []).forEach((t) => {
    if (t.chapter) chapterSet.add(t.chapter);
  });
  const chapterOptions = Array.from(chapterSet)
    .map(
      (c) =>
        `<option value="${escapeHtml(c)}"${c === selectedChapter ? ' selected' : ''}>${escapeHtml(
          c
        )}</option>`
    )
    .join('');

  const confidenceBanner =
    pendingConfidence && pendingConfidence.subjectId === subject.id
      ? `<div class="confidence-banner">` +
        `<span>Recall check for <strong>${escapeHtml(pendingConfidence.topicName)}</strong> — tune next SRS interval:</span>` +
        `<div class="confidence-actions">` +
        `<button type="button" class="btn-secondary" data-conf-rating="hard" data-conf-subj="${pendingConfidence.subjectId}" data-conf-topic="${pendingConfidence.topicId}">Hard (+1d)</button>` +
        `<button type="button" class="btn-secondary" data-conf-rating="good" data-conf-subj="${pendingConfidence.subjectId}" data-conf-topic="${pendingConfidence.topicId}">Good</button>` +
        `<button type="button" class="btn-primary" data-conf-rating="easy" data-conf-subj="${pendingConfidence.subjectId}" data-conf-topic="${pendingConfidence.topicId}">Easy (Boost)</button>` +
        `</div>` +
        `</div>`
      : '';

  const examMetrics =
    `<div class="exam-bar">` +
    `<div class="exam-date-group">` +
    `<label for="examDateInput">Exam</label>` +
    `<input type="date" id="examDateInput" value="${escapeHtml(subject.examDate || '')}">` +
    (subject.examDate
      ? `<button type="button" class="btn-secondary btn-sm" id="clearExamDateBtn" title="Clear exam date">Clear</button>`
      : '') +
    `</div>` +
    `<div class="exam-metrics">` +
    `<span class="metric-pill">Readiness <b data-count-to="${stats.readinessPct}" data-count-suffix="%">${stats.readinessPct}%</b></span>` +
    (stats.daysLeft !== null
      ? `<span class="metric-pill${stats.isExamNear ? ' urgent' : ''}"><b>${escapeHtml(countdownText)}</b></span>`
      : '') +
    (stats.topicsPerDay !== null
      ? `<span class="metric-pill">Pace <b>${stats.topicsPerDay}/d</b></span>`
      : '') +
    `</div>` +
    `</div>`;

  const weakSpotsHtml =
    stats.isExamNear && stats.weakSpots.length
      ? `<div class="weak-spots-box">` +
        `<div class="weak-spots-title">` +
        `<span>Weak spots (${stats.weakSpots.length} not practiced · exam near)</span>` +
        `</div>` +
        `<div class="weak-spots-chips">` +
        stats.weakSpots.map((t) => `<span class="weak-chip">${escapeHtml(t.name)}</span>`).join('') +
        `</div>` +
        `</div>`
      : '';

  const quickPasteHtml =
    pastedLines.length > 1
      ? `<div class="quick-paste-bar" id="quickPasteBar">` +
        `<span>Detected ${pastedLines.length} lines from clipboard paste.</span>` +
        `<div class="u-row-wrap">` +
        `<button type="button" class="btn-primary btn-sm" id="quickAddPastedBtn">Add ${pastedLines.length} topics</button>` +
        `<button type="button" class="btn-secondary btn-sm" id="dismissPasteBtn">Dismiss</button>` +
        `</div>` +
        `</div>`
      : '';

  let filteredTopics = (subject.topics || []).filter((t) => matchesFilter(t, filter, today));
  if (sortMode === 'alpha') {
    filteredTopics = [...filteredTopics].sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortMode === 'readiness') {
    const score = (t) => (t.read ? 1 : 0) + (t.revised ? 2 : 0) + (t.practiced ? 3 : 0);
    filteredTopics = [...filteredTopics].sort((a, b) => score(a) - score(b));
  }

  let topicsBodyHtml = '';
  if (!(subject.topics || []).length) {
    topicsBodyHtml = renderEmptyIllustration('nav:subject', {
      title: 'No topics added yet',
      subtitle: 'Type a topic above, paste a multi-line syllabus list, or click Bulk Import to populate your ledger.',
      accent: 'home'
    });
  } else if (!filteredTopics.length) {
    topicsBodyHtml = renderEmptyIllustration('ctrl:scope', {
      title: `No topics match “${filter}”`,
      subtitle: 'Try switching the filter pill above to see all topics in this subject.',
      accent: 'home'
    });
  } else {
    const groups = new Map();
    for (const t of filteredTopics) {
      const ch = t.chapter || 'General';
      if (!groups.has(ch)) groups.set(ch, []);
      groups.get(ch).push(t);
    }

    if (groups.size === 1 && groups.has('General')) {
      topicsBodyHtml = `<ul class="topic-list" id="topicList">${filteredTopics
        .map((t) => renderTopicCard(t, today, expandedTopicIds))
        .join('')}</ul>`;
    } else {
      topicsBodyHtml = `<div id="topicList">` +
        Array.from(groups.entries())
          .map(([ch, list]) => {
            const doneCount = list.filter((t) => t.read && t.revised && t.practiced).length;
            const pct = Math.round((doneCount / Math.max(1, list.length)) * 100);
            const isCollapsed = collapsedChapters.has(ch);
            return (
              `<section class="chapter-section">` +
              `<button type="button" class="chapter-header" data-toggle-chapter="${escapeHtml(
                ch
              )}" aria-expanded="${!isCollapsed}">` +
              `<span>${isCollapsed ? '&#9654;' : '&#9660;'} ${escapeHtml(ch)} (${doneCount}/${list.length})</span>` +
              `<div class="chapter-mini-bar"><div class="chapter-mini-fill" style="width:${pct}%"></div></div>` +
              `</button>` +
              (isCollapsed
                ? ''
                : `<ul class="topic-list">${list
                    .map((t) => renderTopicCard(t, today, expandedTopicIds))
                    .join('')}</ul>`) +
              `</section>`
            );
          })
          .join('') +
        `</div>`;
    }
  }

  const filterButtons = [
    { id: 'all', label: 'All' },
    { id: 'unstarted', label: 'Not Started' },
    { id: 'revision', label: 'Needs Revision' },
    { id: 'mastered', label: 'Mastered' }
  ]
    .map(
      (f) =>
        `<button type="button" class="filter-pill${filter === f.id ? ' active' : ''}" data-topic-filter="${f.id}">${f.label}</button>`
    )
    .join('');

  return (
    `<main class="page" data-page-view="subject">` +
    `<div class="subject-header-card">` +
    `<div class="subject-header">` +
    `<div class="u-row-wrap">${renderIconTile('nav:subject', { accent: 'home' })}<h1 class="serif hero-split-title">${escapeHtml(
      subject.name
    )}<span class="title-dot"></span></h1></div>` +
    `<div class="tally">` +
    `<div><b>${stats.counts.read}/${stats.total}</b>read</div>` +
    `<div><b>${stats.counts.revised}/${stats.total}</b>revised</div>` +
    `<div><b>${stats.counts.practiced}/${stats.total}</b>practiced</div>` +
    `</div>` +
    `</div>` +
    `<div class="subject-completion-bar" title="${stats.readinessPct}% weighted mastery">` +
    `<div class="subject-completion-fill" style="width:${stats.readinessPct}%"></div>` +
    `</div>` +
    examMetrics +
    `</div>` +
    confidenceBanner +
    weakSpotsHtml +
    `<form class="add-topic-form topic-composer-row" id="addTopicForm">` +
    `<select class="chapter-select" id="topicChapterSelect" aria-label="Chapter or tag">${chapterOptions}</select>` +
    `<input type="text" id="newTopicInput" placeholder="Add topic (or paste text / image)..." autocomplete="off" aria-label="New topic name">` +
    `<button type="submit" class="btn-primary btn-md">${renderAnimatedIcon('action:plus', {
      size: 18
    })}<span>Add Topic</span></button>` +
    `<input type="file" id="ledgerQuickImageInput" accept="image/png,image/jpeg,image/webp" multiple style="display:none;" aria-hidden="true">` +
    `<button type="button" class="btn-secondary btn-md" id="openQuickImageImportBtn" title="Extract topics from PNG, JPG, or WebP syllabus photos">${renderAnimatedIcon(
      'sources:camera',
      { size: 18 }
    )}<span>From Image</span></button>` +
    `<button type="button" class="btn-secondary btn-md" id="openBulkImportBtn">${renderAnimatedIcon(
      'sources:upload',
      { size: 18 }
    )}<span>Bulk Import</span></button>` +
    `</form>` +
    quickPasteHtml +
    `<div class="topic-filter-bar">` +
    `<div class="filter-pills">${filterButtons}</div>` +
    `<select class="chapter-select" id="topicSortSelect" aria-label="Sort topics">` +
    `<option value="manual"${sortMode === 'manual' ? ' selected' : ''}>Order: Manual</option>` +
    `<option value="readiness"${sortMode === 'readiness' ? ' selected' : ''}>Sort: Least Mastered</option>` +
    `<option value="alpha"${sortMode === 'alpha' ? ' selected' : ''}>Sort: A–Z</option>` +
    `</select>` +
    `</div>` +
    topicsBodyHtml +
    `</main>`
  );
}
