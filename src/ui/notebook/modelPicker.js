import { escapeHtml } from '../../utils/dom.js';
import {
  buildModelCatalogView,
  formatContextSize,
  getModelMeta,
  MODEL_GROUPS,
  TASK_ROUTING_LABELS
} from '../../features/modelCatalog.js';
import { getTodayModelUsage } from '../../storage/keyVault.js';
import { FX_LEVELS, getFxLevel } from '../../animations/fxController.js';

/**
 * Render grouped `<option>` list of models for compact select pickers,
 * marking unavailable models from a verified key list as `disabled`.
 */
export function renderGroupedModelOptions(
  selectedValue,
  liveModels = null,
  { includePresets = false, requireVision = false } = {}
) {
  const catalog = buildModelCatalogView(liveModels);
  let html = '';

  if (includePresets) {
    html +=
      `<optgroup label="Presets (Auto-best for key)">` +
      `<option value="fast"${selectedValue === 'fast' ? ' selected' : ''}>Preset: Fast (Flash)</option>` +
      `<option value="balanced"${selectedValue === 'balanced' ? ' selected' : ''}>Preset: Balanced (Hydrogen)</option>` +
      `<option value="deep"${selectedValue === 'deep' ? ' selected' : ''}>Preset: Deep (Argon / Carbon)</option>` +
      `</optgroup>`;
  }

  for (const group of MODEL_GROUPS) {
    const rows = (catalog.groups[group] || []).filter((m) => !requireVision || m.supportsImages);
    if (!rows.length) continue;
    const opts = rows
      .map((m) => {
        const disabled = !m.available ? ' disabled' : '';
        const hint = !m.available ? ' (not available for this key)' : ` · ${m.speed}`;
        return `<option value="${escapeHtml(m.id)}"${
          selectedValue === m.id ? ' selected' : ''
        }${disabled}>${escapeHtml(m.displayName)} [${escapeHtml(m.id)}]${escapeHtml(hint)}</option>`;
      })
      .join('');
    html += `<optgroup label="${escapeHtml(group)}">${opts}</optgroup>`;
  }
  return html;
}

/**
 * Render dynamic Thinking configuration control for any model:
 * - Level selector for Gemini 4 & Gemini 3 thinking models
 * - Budget selector for Gemini 2.5 models
 * - Hidden (`""`) for non-thinking models
 */
export function renderThinkingControl(modelId, vaultConfig, liveModels = null, controlId = 'nbModelThinkingSelect') {
  const meta = getModelMeta(modelId, liveModels);
  if (!meta || meta.thinkingMode === 'none') {
    return '';
  }

  const currentVal = vaultConfig?.modelThinking?.[modelId] ?? 'default';

  if (meta.thinkingMode === 'level') {
    const levels = meta.allowedThinkingLevels || ['default', 'low', 'medium', 'high'];
    const labels = {
      default: 'Default (Model auto)',
      minimal: 'Minimal (Fastest)',
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      xhigh: 'X-High (Max)'
    };
    return (
      `<div class="ui-field">` +
      `<label for="${escapeHtml(controlId)}" class="ui-label">Thinking Level (${escapeHtml(
        meta.id
      )})</label>` +
      `<select id="${escapeHtml(controlId)}" class="ui-select" data-nb-thinking-model="${escapeHtml(
        meta.id
      )}">` +
      levels
        .map(
          (lvl) =>
            `<option value="${escapeHtml(lvl)}"${
              String(currentVal).toLowerCase() === lvl ? ' selected' : ''
            }>${escapeHtml(labels[lvl] || lvl)}</option>`
        )
        .join('') +
      `</select></div>`
    );
  }

  if (meta.thinkingMode === 'budget') {
    const budgets = meta.allowedBudgets || [-1, 0, 1024, 4096, 8192];
    const labels = {
      '-1': 'Dynamic (-1)',
      '0': 'Off (0)',
      '1024': 'Low (1024 tokens)',
      '4096': 'Medium (4096 tokens)',
      '8192': 'High (8192 tokens)'
    };
    return (
      `<div class="ui-field">` +
      `<label for="${escapeHtml(controlId)}" class="ui-label">Thinking Budget (${escapeHtml(
        meta.id
      )})</label>` +
      `<select id="${escapeHtml(controlId)}" class="ui-select" data-nb-thinking-model="${escapeHtml(
        meta.id
      )}">` +
      `<option value="default"${currentVal === 'default' ? ' selected' : ''}>Default</option>` +
      budgets
        .map(
          (b) =>
            `<option value="${b}"${
              String(currentVal) === String(b) ? ' selected' : ''
            }>${escapeHtml(labels[String(b)] || `${b} tokens`)}</option>`
        )
        .join('') +
      `</select></div>`
    );
  }

  return '';
}

/**
 * Render searchable grouped model list with rich capability badges (Speed, Image, Context, Tier).
 */
export function renderSearchableModelList(selectedModelId, liveModels, searchQuery = '') {
  const catalog = buildModelCatalogView(liveModels, searchQuery);
  let html = '';

  for (const group of MODEL_GROUPS) {
    const rows = catalog.groups[group] || [];
    if (!rows.length) continue;
    html += `<div class="nb-model-group-label">${escapeHtml(group)}</div>`;
    for (const m of rows) {
      const ctxBadge = formatContextSize(m.inputTokenLimit);
      html +=
        `<button type="button" class="nb-model-row${selectedModelId === m.id ? ' selected' : ''}${
          !m.available ? ' unavailable' : ''
        }" data-nb-pick-model="${escapeHtml(m.id)}" ${!m.available ? 'disabled' : ''}>` +
        `<div class="u-flex-1">` +
        `<div style="font-size:13px; font-weight:600;">${escapeHtml(m.displayName)}</div>` +
        `<div class="mono u-text-sm">${escapeHtml(
          m.id
        )}${!m.available ? ' · not available for this key' : ''}</div>` +
        `</div>` +
        `<div class="u-row-end">` +
        `<span class="nb-badge-mini">${escapeHtml(m.speed)}</span>` +
        (m.supportsImages ? `<span class="nb-badge-mini">Vision</span>` : '') +
        (ctxBadge ? `<span class="nb-badge-mini">${escapeHtml(ctxBadge)}</span>` : '') +
        `<span class="nb-badge-mini">${escapeHtml(m.tierHint)}</span>` +
        `</div>` +
        `</button>`;
    }
  }

  if (!html) {
    html = `<div class="u-text-sm" style="padding:8px;">No matching models.</div>`;
  }
  return html;
}

/**
 * Unified AI Studio Settings Modal: API Key Vault, Live Models, Presets, Per-Task Routing,
 * Default Grounding Mode, Effects Level & Usage Counter.
 */
export function renderKeyAndRoutingModal({
  open,
  vaultConfig,
  liveModels,
  modelSearchQuery,
  keyTestStatus,
  keyTestError,
  pingResultText,
  defaultGroundingMode = 'sources'
}) {
  if (!open) return '';

  const selectedModel = vaultConfig.customModel || vaultConfig.model || 'gemini-4-hydrogen';
  const usageMap = getTodayModelUsage();
  const usageRows = Object.entries(usageMap);

  const taskPickersHtml = Object.entries(TASK_ROUTING_LABELS)
    .map(([taskKey, label]) => {
      const val = vaultConfig.taskRouting?.[taskKey] || (taskKey === 'ocr' ? 'fast' : 'balanced');
      return (
        `<div class="nb-route-row">` +
        `<label for="nbRoute_${taskKey}" class="ui-label">${escapeHtml(label)}${
          taskKey === 'ocr' ? ' <span class="nb-badge-mini">Vision</span>' : ''
        }</label>` +
        `<select id="nbRoute_${taskKey}" class="ui-select" data-nb-task-route="${taskKey}" ${
          vaultConfig.useSingleModel ? 'disabled' : ''
        }>${renderGroupedModelOptions(val, liveModels, {
          includePresets: true,
          requireVision: taskKey === 'ocr'
        })}</select>` +
        `</div>`
      );
    })
    .join('');

  return (
    `<div class="modal-backdrop" id="nbKeyModalBackdrop" role="dialog" aria-modal="true" aria-labelledby="nbKeyModalTitle">` +
    `<div class="modal-card nb-modal-lg u-stack-md">` +
    `<div class="modal-header">` +
    `<h2 class="serif" id="nbKeyModalTitle">Gemini Key &amp; Model Routing<span class="title-dot"></span></h2>` +
    `<button type="button" class="topic-del" id="nbCloseKeyModalBtn" aria-label="Close modal">&times;</button>` +
    `</div>` +
    `<p class="u-text-muted" style="margin:0;">` +
    `<strong>API Key:</strong> Get one from <span class="mono">aistudio.google.com/apikey</span>. Stored only in this browser (never logged or exported).` +
    `</p>` +
    `<p class="nb-hint-box">` +
    `Default: Remember in this browser. Note: an unlocked key is readable by any script on this origin; enable Passphrase Lock below to encrypt at rest (PBKDF2 + AES-GCM).` +
    `</p>` +
    (vaultConfig.encrypted && !vaultConfig.unlocked
      ? `<div class="u-stack-sm nb-coverage-card">` +
        `<label for="nbUnlockPassInput" class="ui-label">Unlock encrypted key</label>` +
        `<div class="u-row-wrap">` +
        `<input type="password" id="nbUnlockPassInput" class="ui-input u-flex-1" placeholder="Passphrase...">` +
        `<button type="button" class="btn-primary btn-md" id="nbUnlockKeyBtn">Unlock</button>` +
        `</div></div>`
      : '') +
    `<div class="u-row-wrap" style="align-items:flex-end;">` +
    `<div class="ui-field u-flex-1">` +
    `<label for="nbApiKeyInput" class="ui-label">Gemini API Key (leave blank to keep stored key)</label>` +
    `<input type="password" id="nbApiKeyInput" class="ui-input" placeholder="${
      vaultConfig.hasStoredKey ? '•••••••••••• (Key stored)' : 'AIza...'
    }">` +
    `</div>` +
    `<button type="button" class="btn-secondary btn-md" id="nbTestKeyBtn">Test Key &amp; Refresh Models</button>` +
    `</div>` +
    `<label class="u-check-label">` +
    `<input type="checkbox" id="nbUsePassphraseCb" ${vaultConfig.encrypted ? 'checked' : ''}>` +
    `<span>Optional: Encrypt key with passphrase</span>` +
    `</label>` +
    `<div id="nbPassphraseWrap" style="${vaultConfig.encrypted ? '' : 'display:none;'}">` +
    `<input type="password" id="nbKeyPassphraseInput" class="ui-input" placeholder="Passphrase (min 4 chars)...">` +
    `</div>` +
    (keyTestStatus ? `<div class="u-text-sm u-text-mint">${escapeHtml(keyTestStatus)}</div>` : '') +
    (keyTestError ? `<div class="u-text-danger">${escapeHtml(keyTestError)}</div>` : '') +
    `<div class="u-divider-top u-stack-sm">` +
    `<div class="u-row-between">` +
    `<strong style="font-size:13.5px;">Available Models &amp; Thinking</strong>` +
    `<div class="u-row-wrap">` +
    [
      { id: 'fast', label: 'Fast' },
      { id: 'balanced', label: 'Balanced' },
      { id: 'deep', label: 'Deep' }
    ]
      .map(
        (p) =>
          `<button type="button" class="btn-secondary btn-sm" data-nb-modal-preset="${p.id}">${p.label}</button>`
      )
      .join('') +
    `</div></div>` +
    `<input type="search" id="nbModalModelSearch" class="ui-input" value="${escapeHtml(
      modelSearchQuery
    )}" placeholder="Search live &amp; curated models...">` +
    `<div class="nb-model-list" id="nbModalModelList">${renderSearchableModelList(
      vaultConfig.model,
      liveModels,
      modelSearchQuery
    )}</div>` +
    `<div class="u-grid-2">` +
    `<div class="ui-field">` +
    `<label for="nbCustomModelInput" class="ui-label">Custom Model ID (optional override)</label>` +
    `<input type="text" id="nbCustomModelInput" class="ui-input" value="${escapeHtml(
      vaultConfig.customModel || ''
    )}" placeholder="e.g. gemini-4-hydrogen">` +
    `</div>` +
    renderThinkingControl(selectedModel, vaultConfig, liveModels, 'nbModalThinkingSelect') +
    `</div>` +
    `<div class="u-row-wrap">` +
    `<button type="button" class="btn-secondary btn-sm" id="nbPingSelectedModelBtn">Test This Model (${escapeHtml(
      selectedModel
    )})</button>` +
    (pingResultText ? `<span class="mono u-text-sm u-text-mint">${escapeHtml(pingResultText)}</span>` : '') +
    `</div>` +
    `</div>` +
    `<div class="u-divider-top u-stack-sm">` +
    `<div class="u-row-between">` +
    `<strong style="font-size:13.5px;">Per-Task Routing &amp; Automatic Fallback</strong>` +
    `<label class="u-check-label">` +
    `<input type="checkbox" id="nbUseSingleModelCb" ${vaultConfig.useSingleModel ? 'checked' : ''}>` +
    `<span>Use one model for everything</span>` +
    `</label>` +
    `</div>` +
    taskPickersHtml +
    `<div class="u-grid-2" style="align-items:end;">` +
    `<div class="ui-field">` +
    `<label for="nbFallbackOrderInput" class="ui-label">Fallback order (comma-separated presets or model IDs)</label>` +
    `<input type="text" id="nbFallbackOrderInput" class="ui-input" value="${escapeHtml(
      (vaultConfig.fallbackOrder || []).join(', ')
    )}">` +
    `</div>` +
    `<label class="u-check-label" style="padding-bottom:8px;">` +
    `<input type="checkbox" id="nbAutoFallbackCb" ${vaultConfig.autoFallback !== false ? 'checked' : ''}>` +
    `<span>Auto-fallback</span>` +
    `</label>` +
    `</div>` +
    `</div>` +
    `<div class="u-divider-top u-stack-sm">` +
    `<div class="u-text-sm">Today's Requests Sent (local browser estimate, not Google's real quota):</div>` +
    (usageRows.length
      ? `<div class="u-row-wrap">${usageRows
          .map(
            ([m, cnt]) =>
              `<span class="nb-badge-mini">${escapeHtml(m)}: ${cnt}</span>`
          )
          .join('')}</div>`
      : `<div class="u-text-sm">No requests sent today yet.</div>`) +
    `</div>` +
    `<div class="u-divider-top u-row-between">` +
    `<span class="ui-label">Default Notebook Grounding:</span>` +
    `<div class="nb-seg-control" role="group" aria-label="Default grounding mode">` +
    `<button type="button" class="nb-seg-btn${
      defaultGroundingMode === 'sources' ? ' active' : ''
    }" data-nb-grounding="sources">From my sources</button>` +
    `<button type="button" class="nb-seg-btn${
      defaultGroundingMode === 'syllabus' ? ' active' : ''
    }" data-nb-grounding="syllabus">Syllabus-guided</button>` +
    `</div>` +
    `</div>` +
    `<div class="u-divider-top u-row-between">` +
    `<span class="ui-label">Visual Effects Intensity (FX):</span>` +
    `<div class="nb-seg-control" role="group" aria-label="Visual effects level">` +
    FX_LEVELS.map(
      (lvl) =>
        `<button type="button" class="nb-seg-btn${
          getFxLevel() === lvl ? ' active' : ''
        }" data-nb-set-fx="${lvl}">${escapeHtml(lvl[0].toUpperCase() + lvl.slice(1))}</button>`
    ).join('') +
    `</div>` +
    `</div>` +
    `<div class="modal-actions u-row-between">` +
    (vaultConfig.hasStoredKey
      ? `<button type="button" class="btn-secondary btn-md u-text-danger" id="nbRemoveKeyBtn">Remove Key</button>`
      : `<span></span>`) +
    `<button type="button" class="btn-primary btn-md" id="nbSaveKeyBtn">Save Key &amp; Routing</button>` +
    `</div>` +
    `</div>` +
    `</div>`
  );
}
