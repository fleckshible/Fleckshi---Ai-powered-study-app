import { escapeHtml, ringSvg } from '../utils/dom.js';
import { getSubjectStats, formatCountdown } from '../features/examPlanner.js';
import { getDueQueue } from '../features/spacedRevision.js';
import { getLevelProgress } from '../features/habits.js';
import { renderAnimatedIcon } from './icons.js';

export function renderSidebar(state, currentTheme = 'dark', { collapsed = false } = {}) {
  const due = getDueQueue(state);
  const levelInfo = getLevelProgress(state.xp || 0);

  const subjectItems = state.subjects
    .map((s) => {
      const stats = getSubjectStats(s);
      const activeCls =
        state.activeView === 'subject' && s.id === state.activeSubjectId ? ' active' : '';
      const countdown = s.examDate ? ` · ${formatCountdown(stats.daysLeft)}` : '';
      return (
        `<li class="subject-item${activeCls}" data-subject="${s.id}" tabindex="0" role="button" aria-pressed="${
          state.activeView === 'subject' && s.id === state.activeSubjectId
        }">` +
        `<div style="min-width:0; flex:1;">` +
        `<div class="subject-name">${escapeHtml(s.name)}</div>` +
        `<div class="subject-meta">${stats.total} ${stats.total === 1 ? 'topic' : 'topics'}${escapeHtml(countdown)}</div>` +
        `</div>` +
        ringSvg(stats.readinessPct, 28) +
        `<button class="subject-del" data-del-subject="${s.id}" title="Delete subject" aria-label="Delete ${escapeHtml(s.name)}">&times;</button>` +
        `</li>`
      );
    })
    .join('');

  const dueBadge = due.totalDue > 0 ? `<span class="nav-badge">${due.totalDue}</span>` : '';

  const sunSvg =
    `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
    `<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>` +
    `</svg>`;
  const moonSvg =
    `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
    `<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>` +
    `</svg>`;
  const collapseSvg = collapsed
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>`;

  const navItems = [
    { id: 'subject', icon: 'nav:subject', label: 'Ledger' },
    { id: 'focus', icon: 'nav:focus', label: 'Focus' },
    { id: 'today', icon: 'nav:today', label: 'Today', badge: dueBadge },
    { id: 'dashboard', icon: 'nav:dashboard', label: 'Stats' },
    { id: 'notebook', icon: 'nav:notebook', label: 'Notebook' }
  ];

  const navHtml = navItems
    .map(
      (item) =>
        `<button type="button" class="nav-tab${state.activeView === item.id ? ' active' : ''}" data-nav="${
          item.id
        }" title="${escapeHtml(item.label)}" aria-label="${escapeHtml(item.label)}">` +
        renderAnimatedIcon(item.icon, { size: 20 }) +
        `<span class="nav-label">${escapeHtml(item.label)}</span>` +
        (item.badge || '') +
        `</button>`
    )
    .join('');

  return (
    `<aside class="cover" aria-label="Revision Ledger Navigation">` +
    `<div class="sidebar-top-zone">` +
    `<div class="cover-top">` +
    `<h1 class="cover-title serif">Revision Ledger<span class="title-dot"></span></h1>` +
    `<div class="cover-top-actions">` +
    `<button type="button" class="sidebar-collapse-btn" id="toggleSidebarCollapseBtn" aria-expanded="${!collapsed}" aria-label="${
      collapsed ? 'Expand sidebar' : 'Collapse sidebar to icons'
    }" title="${collapsed ? 'Expand sidebar' : 'Collapse sidebar to icons'}">${collapseSvg}</button>` +
    `</div>` +
    `</div>` +
    `<nav class="cover-nav" aria-label="Views">${navHtml}</nav>` +
    `<div class="sidebar-xp-pill">` +
    `<div class="sidebar-xp-row">` +
    `<div style="display:flex; align-items:center; gap:6px;"><span class="mini-lvl-badge">LVL ${levelInfo.level}</span><span>${levelInfo.xp} XP</span></div>` +
    `<span class="streak-pill waapi-pulse">${state.streak?.current || 0}d streak</span>` +
    `</div>` +
    `<div class="sidebar-xp-track"><div class="sidebar-xp-fill" style="width:${levelInfo.progressPct}%"></div></div>` +
    `</div>` +
    `</div>` +
    `<ul class="subject-list">${subjectItems}</ul>` +
    `<div class="sidebar-bottom-dock">` +
    `<form class="add-subject-form" id="addSubjectForm">` +
    `<input type="text" id="newSubjectInput" placeholder="New subject..." autocomplete="off" aria-label="New subject name">` +
    `<button type="submit">Add</button>` +
    `</form>` +
    `<div class="cover-footer-row">` +
    `<button type="button" class="cover-icon-btn" id="openBackupBtn" title="Export or import JSON backup">${renderAnimatedIcon(
      'action:backup',
      { size: 16 }
    )}<span class="nav-label">Data</span></button>` +
    `<div class="theme-switch-track" id="themeSwitchTrack" data-theme-state="${currentTheme}" role="switch" tabindex="0" aria-checked="${
      currentTheme === 'dark'
    }" aria-label="Drag or click to toggle Day and Night theme">` +
    `<span class="theme-switch-icon sun">${sunSvg}</span>` +
    `<span class="theme-switch-icon moon">${moonSvg}</span>` +
    `<div class="theme-switch-thumb" id="themeSwitchThumb">${currentTheme === 'dark' ? moonSvg : sunSvg}</div>` +
    `</div>` +
    `</div>` +
    `</div>` +
    `</aside>`
  );
}
