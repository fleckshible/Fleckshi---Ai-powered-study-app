import { escapeHtml } from '../utils/dom.js';
import { getSrsCommandCenterStats } from '../features/spacedRevision.js';
import { toDateKey } from '../utils/date.js';
import {
  renderAnimatedIcon,
  renderIconTile,
  renderStatusBadge,
  renderEmptyIllustration
} from './icons.js';

function renderRecallCards(items, isOverdue, revealedRecallIds) {
  return items
    .map((item) => {
      const t = item.topic;
      const isRevealed = revealedRecallIds.has(t.id);
      const hasNotes = Boolean(t.notes || (t.links && t.links.length) || (t.doubts && t.doubts.length));

      const previewBox = isRevealed
        ? `<div class="recall-preview-box">` +
          (t.notes ? `<div style="margin-bottom:6px;">${escapeHtml(t.notes)}</div>` : '') +
          (t.doubts?.length
            ? `<div class="mono" style="font-size:11px;">Open doubts: ${t.doubts
                .filter((d) => !d.resolved)
                .map((d) => escapeHtml(d.text))
                .join(' · ') || 'All cleared'}</div>`
            : '') +
          (!hasNotes ? `<span class="mono" style="font-size:11px;">No notes or doubts saved for this topic yet.</span>` : '') +
          `</div>`
        : '';

      return (
        `<div class="recall-card" data-recall-card="${t.id}">` +
        `<div class="recall-card-top">` +
        `<div>` +
        `<span class="srs-subject-pill">${escapeHtml(item.subjectName)}</span>` +
        `<div class="topic-name">${escapeHtml(t.name)}</div>` +
        `<div class="topic-submeta">` +
        renderStatusBadge(
          isOverdue ? 'due' : 'stale',
          `${item.intervalLabel} cycle · Due ${item.nextDue}`
        ) +
        `</div>` +
        `</div>` +
        `<div class="recall-actions">` +
        `<button type="button" class="btn-secondary btn-sm" data-toggle-recall="${t.id}">${renderAnimatedIcon(
          'notes',
          { size: 16 }
        )}<span>${isRevealed ? 'Hide Notes' : 'Test Recall'}</span></button>` +
        `<button type="button" class="btn-secondary btn-sm" data-attach-focus-topic="${t.id}" data-attach-focus-subj="${item.subjectId}">${renderAnimatedIcon(
          'nav:focus',
          { size: 16 }
        )}<span>Focus</span></button>` +
        `<button type="button" class="btn-secondary btn-sm" data-srs-rate="hard" data-srs-revise="${t.id}" data-srs-subject="${item.subjectId}">Forgot · Reset</button>` +
        `<button type="button" class="btn-primary btn-sm" data-srs-rate="good" data-srs-revise="${t.id}" data-srs-subject="${item.subjectId}">${renderAnimatedIcon(
          'action:check',
          { size: 16 }
        )}<span>Good · Next</span></button>` +
        `<button type="button" class="btn-secondary btn-sm" data-srs-rate="easy" data-srs-revise="${t.id}" data-srs-subject="${item.subjectId}">Easy · Boost</button>` +
        `</div>` +
        `</div>` +
        previewBox +
        `</div>`
      );
    })
    .join('');
}

export function renderTodayView(state, revealedRecallIds = new Set()) {
  const today = toDateKey();
  const { dueQueue, buckets, retentionScorePct, upcoming7DayLoad, upcomingForecast } =
    getSrsCommandCenterStats(state, today);
  const { overdue, dueToday, totalDue } = dueQueue;

  const blitzCandidate = overdue[0] || dueToday[0] || upcomingForecast[0] || null;

  return (
    `<main class="page" data-page-view="today">` +
    `<div class="view-header">` +
    `<div class="u-row-wrap">` +
    renderIconTile('nav:today', { accent: 'plan' }) +
    `<div>` +
    `<h1 class="serif hero-split-title">Today&rsquo;s Revisions<span class="title-dot"></span></h1>` +
    `<p class="view-subtitle">Spaced-repetition command center (+1d, +3d, +7d, +21d memory pipeline).</p>` +
    `</div>` +
    `</div>` +
    (blitzCandidate
      ? `<button type="button" class="btn-primary btn-md" id="startRevisionBlitzBtn" data-blitz-subj="${blitzCandidate.subjectId}" data-blitz-topic="${blitzCandidate.topic.id}">${renderAnimatedIcon(
          'sec:practice',
          { size: 18 }
        )}<span>Start Revision Blitz</span></button>`
      : '') +
    `</div>` +
    `<div class="srs-telemetry-grid">` +
    `<div class="dash-card">` +
    `<div class="dash-card-label">Due Today</div>` +
    `<div class="dash-card-val" data-count-to="${totalDue}">${totalDue}</div>` +
    `<div class="dash-card-sub">${overdue.length} overdue · ${dueToday.length} scheduled</div>` +
    `</div>` +
    `<div class="dash-card streak-card">` +
    `<div class="dash-card-label">Memory Retention</div>` +
    `<div class="dash-card-val" data-count-to="${retentionScorePct}" data-count-suffix="%">${retentionScorePct}%</div>` +
    `<div class="dash-card-sub">On-time spaced reviews</div>` +
    `</div>` +
    `<div class="dash-card">` +
    `<div class="dash-card-label">Upcoming 7-Day Load</div>` +
    `<div class="dash-card-val" data-count-to="${upcoming7DayLoad}">${upcoming7DayLoad}</div>` +
    `<div class="dash-card-sub">Scheduled next 7 days</div>` +
    `</div>` +
    `</div>` +
    `<section class="srs-pipeline" aria-label="Spaced Interval Pipeline">` +
    `<div class="srs-stage-card"><div class="srs-stage-day">+1D STAGE</div><div class="srs-stage-count">${buckets.d1}</div><div class="srs-stage-label">Day 1 Fresh</div></div>` +
    `<div class="srs-stage-card"><div class="srs-stage-day">+3D STAGE</div><div class="srs-stage-count">${buckets.d3}</div><div class="srs-stage-label">Day 3 Consolidating</div></div>` +
    `<div class="srs-stage-card"><div class="srs-stage-day">+7D STAGE</div><div class="srs-stage-count">${buckets.d7}</div><div class="srs-stage-label">Day 7 Deepening</div></div>` +
    `<div class="srs-stage-card mint"><div class="srs-stage-day">+21D STAGE</div><div class="srs-stage-count">${buckets.d21}</div><div class="srs-stage-label">Day 21 Mastered</div></div>` +
    `</section>` +
    (totalDue === 0
      ? renderEmptyIllustration('status:mastered', {
          title: 'Queue Clear for Today',
          subtitle: `All spaced revisions for ${today} are complete. Mark any topic "Read Once" in Ledger to feed the +1d pipeline.`,
          accent: 'plan'
        })
      : (overdue.length
          ? `<section class="srs-section"><h2 class="srs-section-title overdue">Overdue (${overdue.length})</h2>${renderRecallCards(
              overdue,
              true,
              revealedRecallIds
            )}</section>`
          : '') +
        (dueToday.length
          ? `<section class="srs-section"><h2 class="srs-section-title">Due Today (${dueToday.length})</h2>${renderRecallCards(
              dueToday,
              false,
              revealedRecallIds
            )}</section>`
          : '')) +
    `<section class="dash-panel">` +
    `<h2 class="serif">Upcoming 14-Day Forecast<span class="title-dot"></span></h2>` +
    (upcomingForecast.length
      ? upcomingForecast
          .map(
            (u) =>
              `<div class="weekly-row" style="grid-template-columns:1fr auto;">` +
              `<div><span class="srs-subject-pill" style="margin-bottom:0; margin-right:8px;">${escapeHtml(
                u.subjectName
              )}</span><strong>${escapeHtml(u.topic.name)}</strong></div>` +
              `<div class="mono" style="font-size:11.5px; color:var(--text-secondary);">${escapeHtml(
                u.intervalLabel
              )} · in ${u.daysUntil}d (${escapeHtml(u.nextDue)})</div>` +
              `</div>`
          )
          .join('')
      : `<p class="view-subtitle" style="margin:0;">No future reviews queued yet. Start reading topics in your Ledger to build your 14-day forecast.</p>`) +
    `</section>` +
    `</main>`
  );
}
