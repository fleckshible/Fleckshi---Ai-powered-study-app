export const MODEL_GROUPS = ['Gemini 4', 'Flash', 'Flash-Lite', 'Pro', 'Other'];

export const TASK_ROUTING_LABELS = {
  ocr: 'Syllabus Photo / Image OCR',
  chat: 'Grounded & Syllabus Chat',
  notes: 'Notes, Summary, Guide, FAQ, Glossary & Timeline',
  practice: 'Quizzes & Flashcards',
  visualPlan: 'Mind Map & Revision Plan'
};

export const DEFAULT_TASK_ROUTING = {
  ocr: 'fast',
  chat: 'balanced',
  notes: 'balanced',
  practice: 'balanced',
  visualPlan: 'balanced'
};

export const DEFAULT_FALLBACK_ORDER = ['balanced', 'fast', 'deep'];

/**
 * Curated verified Gemini API catalog (used for metadata enrichment and offline fallback).
 */
export const CURATED_MODELS = [
  // Gemini 4
  {
    id: 'gemini-4-hydrogen',
    displayName: 'Gemini 4 Hydrogen',
    group: 'Gemini 4',
    speed: 'Balanced',
    supportsImages: true,
    inputTokenLimit: 1048576,
    outputTokenLimit: 65536,
    tierHint: 'Paid',
    thinkingMode: 'level',
    allowedThinkingLevels: ['default', 'low', 'medium', 'high', 'xhigh'],
    curated: true
  },
  {
    id: 'gemini-4-argon',
    displayName: 'Gemini 4 Argon',
    group: 'Gemini 4',
    speed: 'Deep',
    supportsImages: true,
    inputTokenLimit: 1048576,
    outputTokenLimit: 65536,
    tierHint: 'Paid',
    thinkingMode: 'level',
    allowedThinkingLevels: ['default', 'low', 'medium', 'high'],
    curated: true
  },
  {
    id: 'gemini-4-carbon',
    displayName: 'Gemini 4 Carbon',
    group: 'Gemini 4',
    speed: 'Deep',
    supportsImages: true,
    inputTokenLimit: 1048576,
    outputTokenLimit: 65536,
    tierHint: 'Paid',
    thinkingMode: 'level',
    allowedThinkingLevels: ['default', 'low', 'medium', 'high'],
    curated: true
  },
  // Flash
  {
    id: 'gemini-3.8-flash',
    displayName: 'Gemini 3.8 Flash',
    group: 'Flash',
    speed: 'Fast',
    supportsImages: true,
    inputTokenLimit: 1048576,
    outputTokenLimit: 65536,
    tierHint: 'Free tier',
    thinkingMode: 'level',
    allowedThinkingLevels: ['default', 'minimal', 'low', 'medium', 'high'],
    curated: true
  },
  {
    id: 'gemini-3.6-flash',
    displayName: 'Gemini 3.6 Flash',
    group: 'Flash',
    speed: 'Fast',
    supportsImages: true,
    inputTokenLimit: 1048576,
    outputTokenLimit: 65536,
    tierHint: 'Free tier',
    thinkingMode: 'level',
    allowedThinkingLevels: ['default', 'minimal', 'low', 'medium', 'high'],
    curated: true
  },
  {
    id: 'gemini-3.5-flash',
    displayName: 'Gemini 3.5 Flash',
    group: 'Flash',
    speed: 'Fast',
    supportsImages: true,
    inputTokenLimit: 1048576,
    outputTokenLimit: 65536,
    tierHint: 'Free tier',
    thinkingMode: 'level',
    allowedThinkingLevels: ['default', 'minimal', 'low', 'medium', 'high'],
    curated: true
  },
  {
    id: 'gemini-2.5-flash',
    displayName: 'Gemini 2.5 Flash',
    group: 'Flash',
    speed: 'Fast',
    supportsImages: true,
    inputTokenLimit: 1048576,
    outputTokenLimit: 65536,
    tierHint: 'Free tier',
    thinkingMode: 'budget',
    allowedBudgets: [-1, 0, 1024, 4096, 8192],
    curated: true
  },
  // Flash-Lite
  {
    id: 'gemini-3.5-flash-lite',
    displayName: 'Gemini 3.5 Flash-Lite',
    group: 'Flash-Lite',
    speed: 'Fast',
    supportsImages: true,
    inputTokenLimit: 1048576,
    outputTokenLimit: 65536,
    tierHint: 'Free tier',
    thinkingMode: 'level',
    allowedThinkingLevels: ['default', 'minimal', 'low', 'medium'],
    curated: true
  },
  {
    id: 'gemini-3.1-flash-lite',
    displayName: 'Gemini 3.1 Flash-Lite',
    group: 'Flash-Lite',
    speed: 'Fast',
    supportsImages: true,
    inputTokenLimit: 1048576,
    outputTokenLimit: 65536,
    tierHint: 'Free tier',
    thinkingMode: 'level',
    allowedThinkingLevels: ['default', 'minimal', 'low', 'medium'],
    curated: true
  },
  {
    id: 'gemini-2.5-flash-lite',
    displayName: 'Gemini 2.5 Flash-Lite',
    group: 'Flash-Lite',
    speed: 'Fast',
    supportsImages: true,
    inputTokenLimit: 1048576,
    outputTokenLimit: 65536,
    tierHint: 'Free tier',
    thinkingMode: 'budget',
    allowedBudgets: [-1, 0, 1024, 4096],
    curated: true
  },
  // Pro
  {
    id: 'gemini-3.1-pro-preview',
    displayName: 'Gemini 3.1 Pro Preview',
    group: 'Pro',
    speed: 'Deep',
    supportsImages: true,
    inputTokenLimit: 1048576,
    outputTokenLimit: 65536,
    tierHint: 'Paid',
    thinkingMode: 'level',
    allowedThinkingLevels: ['default', 'low', 'medium', 'high'],
    curated: true
  },
  {
    id: 'gemini-2.5-pro',
    displayName: 'Gemini 2.5 Pro',
    group: 'Pro',
    speed: 'Deep',
    supportsImages: true,
    inputTokenLimit: 1048576,
    outputTokenLimit: 65536,
    tierHint: 'Paid',
    thinkingMode: 'budget',
    allowedBudgets: [-1, 1024, 4096, 8192],
    curated: true
  },
  // Other
  {
    id: 'gemma-4-31b-it',
    displayName: 'Gemma 4 31B IT',
    group: 'Other',
    speed: 'Balanced',
    supportsImages: false,
    inputTokenLimit: 131072,
    outputTokenLimit: 8192,
    tierHint: 'Free tier',
    thinkingMode: 'none',
    allowedThinkingLevels: [],
    curated: true
  }
];

const CURATED_MAP = new Map(CURATED_MODELS.map((m) => [m.id, m]));

const PRESET_CANDIDATES = {
  fast: [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite'
  ],
  balanced: [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-4-hydrogen',
    'gemini-2.5-flash',
    'gemini-4-argon'
  ],
  deep: [
    'gemini-4-argon',
    'gemini-4-carbon',
    'gemini-4-hydrogen',
    'gemini-3.1-pro-preview',
    'gemini-2.5-pro'
  ]
};

const NON_TEXT_MODEL_RE =
  /(?:^|-)(?:tts|transcribe|embedding|embed|imagen|veo|lyria|aqa|robotics)(?:-|$)/i;

function inferGroup(id) {
  const lower = id.toLowerCase();
  if (lower.startsWith('gemini-4-')) return 'Gemini 4';
  if (lower.includes('flash-lite')) return 'Flash-Lite';
  if (lower.includes('flash')) return 'Flash';
  if (lower.includes('pro')) return 'Pro';
  return 'Other';
}

function inferSpeed(id) {
  const lower = id.toLowerCase();
  if (lower.includes('flash')) return 'Fast';
  if (lower.includes('argon') || lower.includes('carbon') || lower.includes('pro')) return 'Deep';
  return 'Balanced';
}

function inferTier(id) {
  const lower = id.toLowerCase();
  if (lower.includes('argon') || lower.includes('carbon') || lower.includes('pro')) return 'Paid';
  return 'Unknown';
}

function inferThinkingMeta(id, rawThinkingFlag) {
  const lower = id.toLowerCase();
  if (rawThinkingFlag === false || lower.startsWith('gemma-') || /^gemini-(?:1\.|2\.0-flash)/.test(lower)) {
    return { thinkingMode: 'none', allowedThinkingLevels: [], allowedBudgets: [] };
  }
  if (lower.startsWith('gemini-4-')) {
    return {
      thinkingMode: 'level',
      allowedThinkingLevels:
        lower === 'gemini-4-hydrogen'
          ? ['default', 'low', 'medium', 'high', 'xhigh']
          : ['default', 'low', 'medium', 'high'],
      allowedBudgets: []
    };
  }
  if (lower.startsWith('gemini-3')) {
    return {
      thinkingMode: 'level',
      allowedThinkingLevels: lower.includes('flash')
        ? ['default', 'minimal', 'low', 'medium', 'high']
        : ['default', 'low', 'medium', 'high'],
      allowedBudgets: []
    };
  }
  if (lower.startsWith('gemini-2.5-')) {
    return {
      thinkingMode: 'budget',
      allowedThinkingLevels: [],
      allowedBudgets: lower.includes('pro') ? [-1, 1024, 4096, 8192] : [-1, 0, 1024, 4096, 8192]
    };
  }
  if (rawThinkingFlag === true) {
    return {
      thinkingMode: 'level',
      allowedThinkingLevels: ['default', 'low', 'medium', 'high'],
      allowedBudgets: []
    };
  }
  return { thinkingMode: 'none', allowedThinkingLevels: [], allowedBudgets: [] };
}

/**
 * Resolve normalized metadata for any model ID, merging curated specs and optional live metadata.
 * @param {string} modelId
 * @param {Array|object|null} [liveOrMeta=null]
 */
export function getModelMeta(modelId, liveOrMeta = null) {
  const cleanId = String(modelId || '').replace(/^models\//, '').trim();
  const liveItem = Array.isArray(liveOrMeta)
    ? liveOrMeta.find((m) => m.id === cleanId)
    : liveOrMeta && liveOrMeta.id === cleanId
      ? liveOrMeta
      : null;

  const curated = CURATED_MAP.get(cleanId);
  if (curated) {
    return {
      ...curated,
      ...(liveItem
        ? {
            displayName: liveItem.displayName || curated.displayName,
            inputTokenLimit: liveItem.inputTokenLimit || curated.inputTokenLimit,
            outputTokenLimit: liveItem.outputTokenLimit || curated.outputTokenLimit,
            available: liveItem.available !== undefined ? liveItem.available : true
          }
        : {})
    };
  }

  if (liveItem && liveItem.group) {
    return liveItem;
  }

  const thinking = inferThinkingMeta(cleanId, liveItem?.thinking);
  return {
    id: cleanId,
    displayName: liveItem?.displayName || cleanId,
    group: inferGroup(cleanId),
    speed: inferSpeed(cleanId),
    supportsImages: !cleanId.toLowerCase().startsWith('gemma-'),
    inputTokenLimit: liveItem?.inputTokenLimit || (cleanId.toLowerCase().startsWith('gemma-') ? 131072 : 1048576),
    outputTokenLimit: liveItem?.outputTokenLimit || 65536,
    tierHint: inferTier(cleanId),
    ...thinking,
    curated: false
  };
}

/**
 * Filter raw Gemini `models.list` / REST entries to usable `generateContent` text/multimodal models.
 * @param {Array} rawApiModels
 */
export function filterAndNormalizeLiveModels(rawApiModels = []) {
  const seen = new Set();
  const result = [];

  for (const raw of rawApiModels || []) {
    const id = String(raw?.id || raw?.name || '')
      .replace(/^models\//, '')
      .trim();
    if (!id || seen.has(id)) continue;

    const methods = raw.supportedActions || raw.supportedGenerationMethods || [];
    if (Array.isArray(methods) && methods.length > 0 && !methods.includes('generateContent')) {
      continue;
    }
    if (NON_TEXT_MODEL_RE.test(id) || id.toLowerCase().includes('nano-banana')) {
      continue;
    }

    seen.add(id);
    const meta = getModelMeta(id, {
      id,
      displayName: raw.displayName || id,
      inputTokenLimit: raw.inputTokenLimit,
      outputTokenLimit: raw.outputTokenLimit,
      thinking: raw.thinking
    });
    result.push({
      ...meta,
      description: raw.description || '',
      thinking: typeof raw.thinking === 'boolean' ? raw.thinking : meta.thinkingMode !== 'none',
      available: true,
      availabilityReason: 'Available for this key'
    });
  }

  return result;
}

export function recommendFreeDefaultModel(liveModels = null) {
  const freePreferred = [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite'
  ];
  if (Array.isArray(liveModels) && liveModels.length > 0) {
    const liveIds = new Set(liveModels.map((m) => m.id));
    for (const id of freePreferred) {
      if (liveIds.has(id)) return id;
    }
  }
  return 'gemini-3.8-flash';
}

/**
 * Build grouped catalog view combining live key-accessible models and curated fallback metadata.
 * Models missing from a non-empty live list are marked `available: false` ("not available for this key").
 * @param {Array|null} liveModels
 * @param {string} [searchQuery='']
 */
export function buildModelCatalogView(liveModels = null, searchQuery = '') {
  const hasLive = Array.isArray(liveModels) && liveModels.length > 0;
  const liveById = new Map(hasLive ? liveModels.map((m) => [m.id, m]) : []);
  const combined = [];
  const addedIds = new Set();

  for (const curated of CURATED_MODELS) {
    addedIds.add(curated.id);
    if (hasLive) {
      const liveMatch = liveById.get(curated.id);
      if (liveMatch) {
        combined.push({
          ...curated,
          displayName: liveMatch.displayName || curated.displayName,
          inputTokenLimit: liveMatch.inputTokenLimit || curated.inputTokenLimit,
          outputTokenLimit: liveMatch.outputTokenLimit || curated.outputTokenLimit,
          available: true,
          unverified: false,
          availabilityReason: 'Available for this key'
        });
      } else {
        combined.push({
          ...curated,
          available: false,
          unverified: false,
          availabilityReason: 'not available for this key'
        });
      }
    } else {
      combined.push({
        ...curated,
        available: true,
        unverified: true,
        availabilityReason: 'Curated fallback (test key to verify)'
      });
    }
  }

  if (hasLive) {
    for (const live of liveModels) {
      if (addedIds.has(live.id)) continue;
      addedIds.add(live.id);
      combined.push({
        ...getModelMeta(live.id, live),
        available: true,
        unverified: false,
        availabilityReason: 'Available for this key'
      });
    }
  }

  const q = String(searchQuery || '').trim().toLowerCase();
  const filtered = q
    ? combined.filter(
        (m) =>
          m.id.toLowerCase().includes(q) ||
          m.displayName.toLowerCase().includes(q) ||
          m.group.toLowerCase().includes(q)
      )
    : combined;

  const groups = {};
  for (const g of MODEL_GROUPS) {
    groups[g] = [];
  }
  for (const m of filtered) {
    if (!groups[m.group]) groups[m.group] = [];
    groups[m.group].push(m);
  }

  return {
    hasLiveList: hasLive,
    groups,
    allModels: filtered,
    availableModels: combined.filter((m) => m.available)
  };
}

/**
 * Human-readable context window badge, e.g. 1048576 -> "1M ctx".
 */
export function formatContextSize(tokens) {
  const n = Number(tokens) || 0;
  if (!n) return '';
  if (n >= 1000000) {
    const m = Math.round((n / 1048576) * 10) / 10;
    return `${Number.isInteger(m) || m === 1 ? Math.round(m) : m}M ctx`;
  }
  if (n >= 1024) {
    return `${Math.round(n / 1024)}K ctx`;
  }
  return `${n} ctx`;
}

/**
 * Resolve preset ('fast' | 'balanced' | 'deep') to the best available model for the current key.
 * @param {'fast'|'balanced'|'deep'} preset
 * @param {Array|null} [liveModels=null]
 * @param {{ requireVision?: boolean }} [opts]
 */
export function resolvePresetModel(preset = 'balanced', liveModels = null, opts = {}) {
  const { requireVision = false } = opts;
  const key = PRESET_CANDIDATES[preset] ? preset : 'balanced';
  const { availableModels } = buildModelCatalogView(liveModels);
  const pool = requireVision ? availableModels.filter((m) => m.supportsImages) : availableModels;
  const fallbackPool = pool.length ? pool : availableModels;
  const byId = new Set(fallbackPool.map((m) => m.id));

  for (const candidateId of PRESET_CANDIDATES[key]) {
    if (byId.has(candidateId)) return candidateId;
  }
  return fallbackPool[0]?.id || 'gemini-4-hydrogen';
}

/**
 * Resolve exact model ID to use for a Study Notebook task ('ocr' | 'chat' | 'notes' | 'practice' | 'visualPlan').
 */
export function resolveModelForTask(taskKey, vaultConfig = {}, liveModels = null) {
  const requireVision = taskKey === 'ocr';
  const custom = vaultConfig?.customModel ? String(vaultConfig.customModel).trim() : '';
  if (custom) {
    const meta = getModelMeta(custom, liveModels);
    if (!requireVision || meta.supportsImages) {
      return custom;
    }
  }

  const { availableModels } = buildModelCatalogView(liveModels);
  const availableMap = new Map(availableModels.map((m) => [m.id, m]));

  const resolveSelection = (sel) => {
    if (!sel || sel === 'fast' || sel === 'balanced' || sel === 'deep') {
      return resolvePresetModel(sel || (requireVision ? 'fast' : 'balanced'), liveModels, {
        requireVision
      });
    }
    const found = availableMap.get(sel);
    if (found && (!requireVision || found.supportsImages)) {
      return found.id;
    }
    return resolvePresetModel(requireVision ? 'fast' : 'balanced', liveModels, { requireVision });
  };

  if (vaultConfig?.useSingleModel) {
    const singleTarget =
      vaultConfig.preset && vaultConfig.preset !== 'custom'
        ? vaultConfig.preset
        : vaultConfig.model;
    return resolveSelection(singleTarget);
  }

  const routeTarget = vaultConfig?.taskRouting?.[taskKey] || DEFAULT_TASK_ROUTING[taskKey] || 'balanced';
  return resolveSelection(routeTarget);
}

/**
 * Build valid thinkingConfig object for a specific model:
 * - Gemini 4 & Gemini 3 thinking models -> { thinkingConfig: { thinkingLevel } } (never thinkingBudget)
 * - Gemini 2.5 models -> { thinkingConfig: { thinkingBudget } } (never thinkingLevel)
 * - Non-thinking models -> {}
 */
export function buildThinkingConfigForModel(modelId, setting, liveModelMeta = null) {
  const meta = getModelMeta(modelId, liveModelMeta);
  if (!meta || meta.thinkingMode === 'none') {
    return {};
  }

  if (meta.thinkingMode === 'level') {
    if (setting === undefined || setting === null || setting === '' || setting === 'default') {
      return {};
    }
    const normalized = String(setting).trim().toLowerCase();
    const allowed = meta.allowedThinkingLevels || ['default', 'low', 'medium', 'high'];
    if (normalized === 'default' || !allowed.includes(normalized)) {
      return {};
    }
    return {
      thinkingConfig: {
        thinkingLevel: normalized.toUpperCase()
      }
    };
  }

  if (meta.thinkingMode === 'budget') {
    if (setting === undefined || setting === null || setting === '' || setting === 'default') {
      return {};
    }
    let budget = null;
    if (typeof setting === 'number' || /^-?\d+$/.test(String(setting).trim())) {
      budget = Number(setting);
    } else {
      const map = { off: 0, minimal: 0, low: 1024, medium: 4096, high: 8192, dynamic: -1 };
      budget = map[String(setting).trim().toLowerCase()] ?? null;
    }
    if (budget === null || Number.isNaN(budget)) return {};
    if (budget === 0 && !meta.allowedBudgets?.includes(0)) return {};
    return {
      thinkingConfig: {
        thinkingBudget: budget
      }
    };
  }

  return {};
}

/**
 * Build deduplicated ordered list of candidate models starting with `primaryModel`.
 */
export function buildFallbackQueue(
  primaryModel,
  vaultConfig = {},
  liveModels = null,
  opts = {}
) {
  const { requireVision = false } = opts;
  const { availableModels } = buildModelCatalogView(liveModels);
  const availMap = new Map(availableModels.map((m) => [m.id, m]));
  const queue = [];
  const seen = new Set();

  const pushCandidate = (id, forceIfCustom = false) => {
    const clean = String(id || '').trim();
    if (!clean || seen.has(clean)) return;
    const meta = availMap.get(clean) || (forceIfCustom ? getModelMeta(clean, liveModels) : null);
    if (!meta) return;
    if (requireVision && !meta.supportsImages) return;
    seen.add(clean);
    queue.push(clean);
  };

  if (primaryModel) {
    pushCandidate(primaryModel, true);
  }

  if (vaultConfig?.autoFallback !== false) {
    const rawOrder = Array.isArray(vaultConfig?.fallbackOrder) && vaultConfig.fallbackOrder.length
      ? vaultConfig.fallbackOrder
      : DEFAULT_FALLBACK_ORDER;

    for (const item of rawOrder) {
      if (item === 'fast' || item === 'balanced' || item === 'deep') {
        pushCandidate(resolvePresetModel(item, liveModels, { requireVision }));
      } else {
        pushCandidate(item, false);
      }
    }

    // Ensure at least one fast vision/general backup exists if order exhausted
    pushCandidate(resolvePresetModel('fast', liveModels, { requireVision }));
    pushCandidate(resolvePresetModel('balanced', liveModels, { requireVision }));
  }

  return queue;
}

/**
 * Format any full Gemini model ID into a concise short name for compact status chips/menus.
 * E.g. 'gemini-4-hydrogen' -> 'Hydrogen', 'gemini-2.5-flash-lite' -> 'Flash-Lite'.
 */
export function formatShortModelName(modelId, liveModels = null) {
  const clean = String(modelId || '').replace(/^models\//, '').trim();
  if (!clean) return 'Hydrogen';
  const lower = clean.toLowerCase();
  if (lower.includes('hydrogen')) return 'Hydrogen';
  if (lower.includes('argon')) return 'Argon';
  if (lower.includes('carbon')) return 'Carbon';
  if (lower.includes('flash-lite')) {
    const ver = /gemini-([\d.]+)/.exec(lower)?.[1];
    return ver ? `${ver} Flash-Lite` : 'Flash-Lite';
  }
  if (lower.includes('flash')) {
    const ver = /gemini-([\d.]+)/.exec(lower)?.[1];
    return ver ? `${ver} Flash` : 'Flash';
  }
  if (lower.includes('pro')) {
    const ver = /gemini-([\d.]+)/.exec(lower)?.[1];
    return ver ? `${ver} Pro` : 'Pro';
  }
  const meta = getModelMeta(clean, liveModels);
  if (meta?.displayName) {
    return meta.displayName.replace(/^Gemini\s+/i, '').slice(0, 18);
  }
  return clean.replace(/^gemini-/i, '').slice(0, 18);
}
