import { escapeHtml } from '../utils/dom.js';
import { toDateKey } from '../utils/date.js';
import { getHeatmapCells, getWeeklySummary, getLevelProgress } from '../features/habits.js';
import { getSubjectStats } from '../features/examPlanner.js';

function renderHeatmapSvg(cells) {
  const cols = Math.ceil(cells.length / 7);
  const cellSize = 13;
  const gap = 3;
  const width = cols * (cellSize + gap);
  const height = 7 * (cellSize + gap);

  const rects = cells
    .map((cell, idx) => {
      const col = Math.floor(idx / 7);
      const row = idx % 7;
      const x = col * (cellSize + gap);
      const y = row * (cellSize + gap);
      const fill = `var(--heat-${cell.level})`;
      const title = `${cell.dateKey}: ${cell.ticks} marks, ${cell.minutes}m studied`;
      return `<rect class="heatmap-cell" x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="3" fill="${fill}" style="transform-origin:${
        x + cellSize / 2
      }px ${y + cellSize / 2}px;"><title>${escapeHtml(title)}</title></rect>`;
    })
    .join('');

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Study activity heatmap">${rects}</svg>`;
}

/**
 * 3-ring concentric SVG Subject Mastery Gauge (Read cyan, Revised sapphire, Practiced mint).
 */
function renderSubjectMasteryRings(subject) {
  const stats = getSubjectStats(subject);
  const total = Math.max(1, stats.total);
  const rings = [
    { r: 18, pct: stats.total ? stats.counts.read / total : 0, color: '#38BDF8' },
    { r: 13, pct: stats.total ? stats.counts.revised / total : 0, color: '#2563EB' },
    { r: 8, pct: stats.total ? stats.counts.practiced / total : 0, color: '#10B981' }
  ];

  const circles = rings
    .map((ring) => {
      const c = 2 * Math.PI * ring.r;
      const offset = c * (1 - ring.pct);
      return (
        `<circle cx="22" cy="22" r="${ring.r}" fill="none" stroke="var(--border-hairline)" stroke-width="2.6"/>` +
        `<circle class="mastery-ring-fg" cx="22" cy="22" r="${ring.r}" fill="none" stroke="${ring.color}" stroke-width="2.6" ` +
        `stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}" ` +
        `data-circ="${c.toFixed(2)}" data-target-offset="${offset.toFixed(2)}" stroke-linecap="round"/>`
      );
    })
    .join('');

  return `<svg class="mastery-rings-svg" width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">${circles}</svg>`;
}

export function renderDashboardView(state, xpRulesOpen = false) {
  const today = toDateKey();
  const todayEntry = state.activityLog?.[today] || { ticks: 0, minutes: 0 };
  const goal = state.dailyGoal || 5;
  const goalPct = Math.min(100, Math.round((todayEntry.ticks / goal) * 100));
  const streakDays = state.streak?.current || 0;
  const streakMomentumPct = Math.min(100, Math.round((streakDays / 7) * 100));

  const levelInfo = getLevelProgress(state.xp || 0);
  const cells = getHeatmapCells(state, 20, today);
  const weekly = getWeeklySummary(state, today);
  const maxWeeklyScore = Math.max(1, ...weekly.rows.map((r) => r.ticks * 10 + r.minutes));
  const subjectsById = new Map((state.subjects || []).map((s) => [s.id, s]));

  const allWeakSpots = [];
  for (const s of state.subjects || []) {
    const st = getSubjectStats(s, today);
    if (st.isExamNear && st.weakSpots.length) {
      allWeakSpots.push({ subject: s.name, count: st.weakSpots.length, daysLeft: st.daysLeft });
    }
  }

  const flameIcon = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`;
  const targetIcon = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`;
  const sparkIcon = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`;
  const clockIcon = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

  return (
    `<main class="page" data-page-view="dashboard">` +
    `<div class="view-header">` +
    `<div>` +
    `<h1 class="serif hero-split-title">Habits &amp; Progress<span class="title-dot"></span></h1>` +
    `<p class="view-subtitle">Daily streak growth, Scholar XP progression, 20-week matrix, and mastery rings.</p>` +
    `</div>` +
    `</div>` +
    `<div class="dash-grid">` +
    `<div class="dash-card streak-card">` +
    `<div class="dash-card-head"><span class="dash-card-label">Current Streak</span><span class="dash-card-icon">${flameIcon}</span></div>` +
    `<div style="display:flex; align-items:baseline; justify-content:space-between; gap:8px;">` +
    `<div class="dash-card-val waapi-pulse" data-count-to="${streakDays}" data-count-suffix="d">${streakDays}d</div>` +
    `<span class="streak-growth-pill">${streakDays > 0 ? 'ACTIVE GROWTH' : 'READY'}</span>` +
    `</div>` +
    `<div class="mini-progress-track"><div class="mini-progress-fill" style="width:${streakMomentumPct}%"></div></div>` +
    `<div class="dash-card-sub">Longest: ${state.streak?.longest || 0}d · 7d goal</div>` +
    `</div>` +
    `<div class="dash-card">` +
    `<div class="dash-card-head"><span class="dash-card-label">Today&rsquo;s Goal</span><span class="dash-card-icon">${targetIcon}</span></div>` +
    `<div class="dash-card-val">${todayEntry.ticks}/${goal}</div>` +
    `<div class="mini-progress-track"><div class="mini-progress-fill" style="width:${goalPct}%"></div></div>` +
    `<div class="dash-card-sub">${goalPct}% of daily target</div>` +
    `</div>` +
    `<div class="dash-card">` +
    `<div class="dash-card-head"><span class="dash-card-label">Total XP</span><span class="dash-card-icon">${sparkIcon}</span></div>` +
    `<div class="dash-card-val" data-count-to="${levelInfo.xp}">${levelInfo.xp}</div>` +
    `<div class="dash-card-sub">Rank: ${escapeHtml(levelInfo.title)}</div>` +
    `</div>` +
    `<div class="dash-card">` +
    `<div class="dash-card-head"><span class="dash-card-label">7-Day Study</span><span class="dash-card-icon">${clockIcon}</span></div>` +
    `<div class="dash-card-val">${(weekly.totalMinutes / 60).toFixed(1)}h</div>` +
    `<div class="dash-card-sub">${weekly.totalTicks} topics ticked</div>` +
    `</div>` +
    `</div>` +
    `<section class="xp-feature-panel" aria-label="Level and XP Progression">` +
    `<div class="xp-panel-top">` +
    `<div class="xp-level-group">` +
    `<div class="xp-level-badge">LVL ${levelInfo.level}</div>` +
    `<div class="xp-title-stack">` +
    `<h2 class="serif">${escapeHtml(levelInfo.title)}<span class="title-dot"></span></h2>` +
    `<p>${levelInfo.xp} / ${levelInfo.nextThreshold} XP · ${100 - levelInfo.currentLevelXp} XP to Level ${
      levelInfo.level + 1
    }</p>` +
    `</div>` +
    `</div>` +
    `<button type="button" class="btn-secondary" id="toggleXpRulesBtn" aria-expanded="${xpRulesOpen}">${
      xpRulesOpen ? 'HIDE XP RULES' : 'HOW XP WORKS'
    }</button>` +
    `</div>` +
    `<div class="xp-bar-track"><div class="xp-bar-fill" data-xp-pct="${levelInfo.progressPct}%" style="width:${levelInfo.progressPct}%"></div></div>` +
    (xpRulesOpen
      ? `<div class="xp-info-drawer">` +
        `<div class="xp-rule-pill"><span>Read Once (R)</span><b>+10 XP</b></div>` +
        `<div class="xp-rule-pill"><span>Spaced Revision (Rv)</span><b>+20 XP</b></div>` +
        `<div class="xp-rule-pill"><span>Practiced Mastery (P)</span><b>+30 XP</b></div>` +
        `</div>`
      : '') +
    `</section>` +
    `<section class="dash-panel">` +
    `<h2 class="serif">Activity Heatmap<span class="title-dot"></span></h2>` +
    `<div class="heatmap-wrap">${renderHeatmapSvg(cells)}</div>` +
    `<div class="heatmap-legend">` +
    `<span>Less</span>` +
    `<i class="heatmap-swatch" style="background:var(--heat-0)"></i>` +
    `<i class="heatmap-swatch" style="background:var(--heat-1)"></i>` +
    `<i class="heatmap-swatch" style="background:var(--heat-2)"></i>` +
    `<i class="heatmap-swatch" style="background:var(--heat-3)"></i>` +
    `<i class="heatmap-swatch" style="background:var(--heat-4)"></i>` +
    `<span>More</span>` +
    `</div>` +
    `</section>` +
    `<section class="dash-panel">` +
    `<h2 class="serif">Weekly Summary by Subject<span class="title-dot"></span></h2>` +
    (weekly.rows.length
      ? weekly.rows
          .map((r) => {
            const barPct = Math.round(((r.ticks * 10 + r.minutes) / maxWeeklyScore) * 100);
            const subj = subjectsById.get(r.subjectId);
            const rings = subj ? renderSubjectMasteryRings(subj) : '';
            return (
              `<div class="weekly-row">` +
              rings +
              `<div>` +
              `<div><strong>${escapeHtml(r.name)}</strong></div>` +
              `<div class="weekly-bar-track"><div class="weekly-bar-fill" data-bar-width="${barPct}%" style="width:${barPct}%"></div></div>` +
              `</div>` +
              `<div class="mono" style="text-align:right; color:var(--text-secondary); font-size:12px;">` +
              `<b>${r.ticks}</b> ticks · <b>${(r.minutes / 60).toFixed(1)}h</b>` +
              `</div>` +
              `</div>`
            );
          })
          .join('')
      : `<div class="weekly-empty-card">` +
        `<svg width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">` +
        `<circle cx="24" cy="24" r="20" fill="none" stroke="var(--border-hairline)" stroke-width="3"/>` +
        `<circle cx="24" cy="24" r="14" fill="none" stroke="#38BDF8" stroke-width="3" stroke-dasharray="48 40" stroke-linecap="round"/>` +
        `<circle cx="24" cy="24" r="8" fill="none" stroke="#10B981" stroke-width="3" stroke-dasharray="28 24" stroke-linecap="round"/>` +
        `</svg>` +
        `<div style="flex:1;">` +
        `<strong style="display:block; margin-bottom:4px;">No subjects tracked yet</strong>` +
        `<p class="view-subtitle" style="margin:0;">Add your first subject in the sidebar to unlock concentric mastery rings and weekly velocity bars.</p>` +
        `</div>` +
        `<button type="button" class="btn-primary" id="emptyAddSubjectCta">ADD SUBJECT</button>` +
        `</div>`) +
    `</section>` +
    (allWeakSpots.length
      ? `<section class="dash-panel">` +
        `<h2 class="serif">Upcoming Exam Weak Spots<span class="title-dot"></span></h2>` +
        allWeakSpots
          .map(
            (w) =>
              `<div class="weekly-row" style="grid-template-columns:1fr auto;"><span>${escapeHtml(
                w.subject
              )} (${w.daysLeft}d left)</span><b class="mono" style="color:var(--red)">${
                w.count
              } weak topics</b></div>`
          )
          .join('') +
        `</section>`
      : '') +
    `</main>`
  );
}
