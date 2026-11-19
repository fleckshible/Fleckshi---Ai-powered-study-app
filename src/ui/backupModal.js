export function renderBackupModal(state) {
  return (
    `<div class="modal-backdrop" id="backupModalBackdrop" role="dialog" aria-modal="true" aria-labelledby="backupModalTitle">` +
    `<div class="modal-card">` +
    `<div class="modal-header">` +
    `<h2 class="serif" id="backupModalTitle">Settings &amp; Backup<span class="title-dot"></span></h2>` +
    `<button type="button" class="topic-del" id="closeBackupModalBtn" aria-label="Close modal">&times;</button>` +
    `</div>` +
    `<div style="margin-bottom:16px;">` +
    `<label for="dailyGoalInput" style="display:block; font-size:13px; font-weight:500; margin-bottom:6px;">Daily Goal (level ticks per day)</label>` +
    `<div style="display:flex; gap:8px;">` +
    `<input type="number" id="dailyGoalInput" min="1" max="50" value="${state.dailyGoal || 5}" style="width:90px; padding:7px 10px; border:1px solid var(--border-strong); border-radius:4px; background:var(--bg-surface); color:var(--text-primary);">` +
    `<button type="button" class="btn-secondary" id="saveGoalBtn">Save Goal</button>` +
    `</div>` +
    `</div>` +
    `<div style="border-top:1px solid var(--border-hairline); padding-top:14px;">` +
    `<p style="font-size:13px; color:var(--text-secondary); margin:0 0 10px;">Export all subjects, topics, notes, and activity logs as a JSON file, or restore from a previous backup.</p>` +
    `<label style="display:flex; align-items:center; gap:8px; font-size:12.5px; margin-bottom:12px; cursor:pointer;">` +
    `<input type="checkbox" id="includeNotebooksBackupCb">` +
    `<span>Include Study Notebooks in backup (never includes API key)</span>` +
    `</label>` +
    `<div style="display:flex; flex-wrap:wrap; gap:10px;">` +
    `<button type="button" class="btn-primary" id="exportJsonBtn">Export JSON Backup</button>` +
    `<label class="btn-secondary" style="display:inline-flex; align-items:center; cursor:pointer;">` +
    `Import JSON Backup<input type="file" id="importJsonInput" accept=".json,application/json" style="display:none;">` +
    `</label>` +
    `</div>` +
    `<div id="backupStatusMsg" style="font-size:12.5px; margin-top:10px; color:var(--emerald-streak);"></div>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}
