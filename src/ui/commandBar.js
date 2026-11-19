import { escapeHtml } from '../utils/dom.js';

/**
 * Build searchable list of commands from current state.
 * @param {object} state
 * @returns {Array<{ id: string, category: string, label: string, action: string, payload?: any }>}
 */
export function buildCommandItems(state) {
  const items = [
    { id: 'nav-subject', category: 'VIEW', label: 'Go to Subjects Ledger', action: 'nav', payload: 'subject' },
    { id: 'nav-focus', category: 'VIEW', label: 'Open Focus Engine Studio', action: 'nav', payload: 'focus' },
    { id: 'nav-today', category: 'VIEW', label: 'Open Today Spaced Revisions', action: 'nav', payload: 'today' },
    { id: 'nav-dash', category: 'VIEW', label: 'Open Stats & Activity Heatmap', action: 'nav', payload: 'dashboard' },
    { id: 'nav-notebook', category: 'VIEW', label: 'Open Study Notebook (Grounded AI)', action: 'nav', payload: 'notebook' },
    { id: 'nb-key', category: 'NOTEBOOK', label: 'Notebook: Configure Gemini API Key & Model', action: 'nb-key' },
    { id: 'nb-syllabus', category: 'NOTEBOOK', label: 'Notebook: Smart Syllabus Import (AI / JSON)', action: 'nb-syllabus' },
    { id: 'pomo-15', category: 'TIMER', label: 'Set Chrono-Engine to 15 minutes', action: 'preset', payload: 15 },
    { id: 'pomo-25', category: 'TIMER', label: 'Set Chrono-Engine to 25 minutes', action: 'preset', payload: 25 },
    { id: 'pomo-45', category: 'TIMER', label: 'Set Chrono-Engine to 45 minutes', action: 'preset', payload: 45 },
    { id: 'pomo-60', category: 'TIMER', label: 'Set Chrono-Engine to 60 minutes', action: 'preset', payload: 60 },
    { id: 'audio-drone', category: 'SYNTH', label: 'Audio Synth: Deep Space Drone', action: 'audio', payload: 'drone' },
    { id: 'audio-rain', category: 'SYNTH', label: 'Audio Synth: Crisp Rain', action: 'audio', payload: 'rain' },
    { id: 'audio-theta', category: 'SYNTH', label: 'Audio Synth: Binaural Theta Waves', action: 'audio', payload: 'theta' },
    { id: 'audio-off', category: 'SYNTH', label: 'Audio Synth: Mute / Off', action: 'audio', payload: 'off' },
    { id: 'theme-toggle', category: 'THEME', label: 'Toggle Deep Carbon-Blue / Crisp Studio White', action: 'theme' },
    { id: 'help-fleckshi', category: 'HELP', label: 'Open Fleckshi Help Guide', action: 'fleckshi-help' }
  ];

  for (const subj of state.subjects || []) {
    items.push({
      id: `subj-${subj.id}`,
      category: 'SUBJECT',
      label: `Switch to ${subj.name}`,
      action: 'subject',
      payload: subj.id
    });
    for (const topic of subj.topics || []) {
      items.push({
        id: `attach-${topic.id}`,
        category: 'ATTACH',
        label: `Focus on: ${subj.name} → ${topic.name}`,
        action: 'attach',
        payload: { subjectId: subj.id, topicId: topic.id, topicName: topic.name }
      });
    }
  }

  return items;
}

export function renderCommandBar(state, query = '', activeIdx = 0) {
  const all = buildCommandItems(state);
  const q = query.trim().toLowerCase();
  const filtered = q
    ? all.filter(
        (item) =>
          item.label.toLowerCase().includes(q) || item.category.toLowerCase().includes(q)
      )
    : all.slice(0, 14);

  const clampedIdx = Math.max(0, Math.min(activeIdx, Math.max(0, filtered.length - 1)));

  const listHtml = filtered.length
    ? filtered
        .map(
          (item, i) =>
            `<li class="cmd-item${i === clampedIdx ? ' active' : ''}" data-cmd-idx="${i}" data-cmd-id="${escapeHtml(
              item.id
            )}" role="option" aria-selected="${i === clampedIdx}">` +
            `<span>${escapeHtml(item.label)}</span>` +
            `<span class="cmd-cat">${escapeHtml(item.category)}</span>` +
            `</li>`
        )
        .join('')
    : `<li class="cmd-item" style="opacity:0.6;">No matching commands.</li>`;

  return (
    `<div class="cmd-backdrop" id="cmdBackdrop" role="dialog" aria-modal="true" aria-label="Command Palette">` +
    `<div class="cmd-palette">` +
    `<div class="cmd-input-row">` +
    `<span class="mono" style="color:var(--blue-cyan); font-size:12px;">&gt;_</span>` +
    `<input type="text" class="cmd-input" id="cmdInput" value="${escapeHtml(
      query
    )}" placeholder="Type a command, subject, or topic..." autocomplete="off" aria-label="Search commands">` +
    `<span class="mono" style="font-size:10px; color:var(--ink-soft);">ESC</span>` +
    `</div>` +
    `<ul class="cmd-list" role="listbox">${listHtml}</ul>` +
    `</div>` +
    `</div>`
  );
}
