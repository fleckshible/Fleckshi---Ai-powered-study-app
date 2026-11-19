const DB_NAME = 'revision-ledger-notebooks-v1';
const DB_VERSION = 1;
const STORE_NAME = 'notebooks';
const FALLBACK_KEY = 'revision-ledger-notebooks-fallback-v1';

export const NOTEBOOK_SCHEMA_VERSION = 2;
export const MAX_ARTIFACT_VERSIONS = 3;

export function makeArtifactKey(type, scopeType = 'subject', scopeId = 'all') {
  const t = String(type || 'summary').trim();
  const st = String(scopeType || 'subject').trim();
  const sid = String(scopeId || 'all').trim();
  return `${t}::${st}::${sid}`;
}

export function parseArtifactKey(key) {
  const [type = 'summary', scopeType = 'subject', scopeId = 'all'] = String(key || '').split('::');
  return { type, scopeType, scopeId };
}

const VALID_TOP_TABS = new Set(['home', 'sources', 'chat', 'learn', 'practice', 'plan']);
const VALID_LEARN_VIEWS = new Set([
  'notes',
  'summary',
  'studyGuide',
  'faq',
  'glossary',
  'timeline',
  'mindMap'
]);
const VALID_PRACTICE_VIEWS = new Set(['flashcards', 'quiz']);

/**
 * Migrate any legacy v1/v2/28-view tab ID into the unified 6-tab + sub-view state.
 */
export function migrateLegacyNotebookTab(rawTab, notebook = null) {
  const id = String(rawTab || 'home').trim();
  const baseLearn = VALID_LEARN_VIEWS.has(notebook?.activeLearnView)
    ? notebook.activeLearnView
    : 'notes';
  const baseNotesMode = notebook?.activeNotesMode === 'mine' ? 'mine' : 'ai';
  const basePractice = VALID_PRACTICE_VIEWS.has(notebook?.activePracticeView)
    ? notebook.activePracticeView
    : 'flashcards';
  const baseQuizMode = ['play', 'build', 'history'].includes(notebook?.activeQuizMode)
    ? notebook.activeQuizMode
    : 'play';

  if (id === 'home' || id === 'home:overview' || id === 'visual:matrix') {
    return {
      tabId: 'home',
      learnView: baseLearn,
      notesMode: baseNotesMode,
      practiceView: basePractice,
      quizMode: baseQuizMode,
      modalAction: null,
      chatDrawerTab: null,
      tool: null
    };
  }
  if (id === 'home:scan' || id === 'home:tree' || id === 'home:paste' || id === 'home:sync' || id === 'home:queue') {
    return {
      tabId: 'home',
      learnView: baseLearn,
      notesMode: baseNotesMode,
      practiceView: basePractice,
      quizMode: baseQuizMode,
      modalAction: id.slice(5),
      chatDrawerTab: null,
      tool: null
    };
  }
  if (id === 'sources' || id === 'sources:library') {
    return {
      tabId: 'sources',
      learnView: baseLearn,
      notesMode: baseNotesMode,
      practiceView: basePractice,
      quizMode: baseQuizMode,
      modalAction: null,
      chatDrawerTab: null,
      tool: null
    };
  }
  if (id === 'sources:upload' || id === 'sources:paste' || id === 'sources:topics') {
    return {
      tabId: 'sources',
      learnView: baseLearn,
      notesMode: baseNotesMode,
      practiceView: basePractice,
      quizMode: baseQuizMode,
      modalAction: id,
      chatDrawerTab: null,
      tool: null
    };
  }
  if (id === 'chat' || id === 'chat:stream') {
    return {
      tabId: 'chat',
      learnView: baseLearn,
      notesMode: baseNotesMode,
      practiceView: basePractice,
      quizMode: baseQuizMode,
      modalAction: null,
      chatDrawerTab: null,
      tool: null
    };
  }
  if (id === 'chat:citations' || id === 'chat:settings') {
    return {
      tabId: 'chat',
      learnView: baseLearn,
      notesMode: baseNotesMode,
      practiceView: basePractice,
      quizMode: baseQuizMode,
      modalAction: null,
      chatDrawerTab: id === 'chat:citations' ? 'citations' : 'settings',
      tool: null
    };
  }
  if (id === 'learn') {
    return {
      tabId: 'learn',
      learnView: baseLearn,
      notesMode: baseNotesMode,
      practiceView: basePractice,
      quizMode: baseQuizMode,
      modalAction: null,
      chatDrawerTab: null,
      tool: baseLearn
    };
  }
  if (id === 'personalNotes') {
    return {
      tabId: 'learn',
      learnView: 'notes',
      notesMode: 'mine',
      practiceView: basePractice,
      quizMode: baseQuizMode,
      modalAction: null,
      chatDrawerTab: null,
      tool: 'notes'
    };
  }
  if (id === 'visual') {
    return {
      tabId: 'learn',
      learnView: 'mindMap',
      notesMode: baseNotesMode,
      practiceView: basePractice,
      quizMode: baseQuizMode,
      modalAction: null,
      chatDrawerTab: null,
      tool: 'mindMap'
    };
  }
  if (VALID_LEARN_VIEWS.has(id)) {
    return {
      tabId: 'learn',
      learnView: id,
      notesMode: id === 'notes' ? baseNotesMode : 'ai',
      practiceView: basePractice,
      quizMode: baseQuizMode,
      modalAction: null,
      chatDrawerTab: null,
      tool: id
    };
  }
  if (id === 'practice') {
    return {
      tabId: 'practice',
      learnView: baseLearn,
      notesMode: baseNotesMode,
      practiceView: basePractice,
      quizMode: baseQuizMode,
      modalAction: null,
      chatDrawerTab: null,
      tool: basePractice
    };
  }
  if (id === 'flashcards') {
    return {
      tabId: 'practice',
      learnView: baseLearn,
      notesMode: baseNotesMode,
      practiceView: 'flashcards',
      quizMode: baseQuizMode,
      modalAction: null,
      chatDrawerTab: null,
      tool: 'flashcards'
    };
  }
  if (id === 'quiz') {
    return {
      tabId: 'practice',
      learnView: baseLearn,
      notesMode: baseNotesMode,
      practiceView: 'quiz',
      quizMode: baseQuizMode,
      modalAction: null,
      chatDrawerTab: null,
      tool: 'quiz'
    };
  }
  if (id === 'quiz:config' || id === 'quiz:history') {
    return {
      tabId: 'practice',
      learnView: baseLearn,
      notesMode: baseNotesMode,
      practiceView: 'quiz',
      quizMode: id === 'quiz:config' ? 'build' : 'history',
      modalAction: null,
      chatDrawerTab: null,
      tool: 'quiz'
    };
  }
  if (id === 'plan' || id === 'revisionPlan' || id === 'plan:sync') {
    return {
      tabId: 'plan',
      learnView: baseLearn,
      notesMode: baseNotesMode,
      practiceView: basePractice,
      quizMode: baseQuizMode,
      modalAction: null,
      chatDrawerTab: null,
      tool: 'revisionPlan'
    };
  }

  return {
    tabId: VALID_TOP_TABS.has(id) ? id : 'home',
    learnView: baseLearn,
    notesMode: baseNotesMode,
    practiceView: basePractice,
    quizMode: baseQuizMode,
    modalAction: null,
    chatDrawerTab: null,
    tool: null
  };
}

export function createEmptyNotebook(subjectId) {
  return {
    notebookSchemaVersion: NOTEBOOK_SCHEMA_VERSION,
    subjectId,
    updatedAt: new Date().toISOString(),
    activeTab: 'home',
    activeLearnView: 'notes',
    activeNotesMode: 'ai',
    activePracticeView: 'flashcards',
    activeQuizMode: 'play',
    activeScope: {
      scopeType: 'chapter',
      chapterId: null,
      topicId: null
    },
    groundingMode: 'sources', // 'sources' | 'syllabus'
    autoGenerateOnTabOpen: {
      scoped: false,
      wholeSubject: false
    },
    syllabusBrain: null,
    sources: [],
    chatHistory: [],
    artifactsMap: {},
    artifacts: {
      summary: null,
      studyGuide: null,
      faq: null,
      glossary: null,
      timeline: null,
      flashcards: [],
      quiz: null,
      mindMap: null,
      revisionPlan: null
    },
    quizHistory: [],
    queueState: {
      status: 'idle',
      concurrency: 1,
      tasks: [],
      updatedAt: null
    }
  };
}

/**
 * Non-destructive migration from notebook v1 (flat `artifacts`) -> v2 (`artifactsMap`, `syllabusBrain`,
 * `quizHistory`, `queueState`, tab/scope/grounding preferences).
 */
export function migrateNotebookRecord(raw, subjectIdFallback = null) {
  const sid = raw?.subjectId || subjectIdFallback || 'default';
  const base = createEmptyNotebook(sid);
  if (!raw || typeof raw !== 'object') return base;

  const artifactsMap = raw.artifactsMap && typeof raw.artifactsMap === 'object'
    ? { ...raw.artifactsMap }
    : {};

  // Migrate v1 flat `artifacts` entries into scoped artifactsMap entries if absent
  const legacyArtifacts = raw.artifacts && typeof raw.artifacts === 'object' ? raw.artifacts : {};
  const legacyTypes = [
    'notes',
    'summary',
    'studyGuide',
    'faq',
    'glossary',
    'timeline',
    'flashcards',
    'quiz',
    'mindMap',
    'revisionPlan'
  ];

  for (const type of legacyTypes) {
    const val = legacyArtifacts[type];
    const hasContent = Array.isArray(val) ? val.length > 0 : Boolean(val);
    if (!hasContent) continue;

    const key = makeArtifactKey(type, 'subject', sid);
    if (!artifactsMap[key]) {
      artifactsMap[key] = {
        key,
        type,
        scopeType: 'subject',
        scopeId: sid,
        content: val,
        mode: 'sources',
        model: 'gemini-4-hydrogen',
        generatedAt: raw.updatedAt || new Date().toISOString(),
        userEdited: false,
        versions: []
      };
    }
  }

  const migratedNav = migrateLegacyNotebookTab(raw.activeTab || 'home', raw);

  return {
    ...base,
    ...raw,
    notebookSchemaVersion: NOTEBOOK_SCHEMA_VERSION,
    subjectId: sid,
    activeTab: migratedNav.tabId,
    activeLearnView: VALID_LEARN_VIEWS.has(raw.activeLearnView)
      ? raw.activeLearnView
      : migratedNav.learnView,
    activeNotesMode: raw.activeNotesMode === 'mine' ? 'mine' : migratedNav.notesMode,
    activePracticeView: VALID_PRACTICE_VIEWS.has(raw.activePracticeView)
      ? raw.activePracticeView
      : migratedNav.practiceView,
    activeQuizMode: ['play', 'build', 'history'].includes(raw.activeQuizMode)
      ? raw.activeQuizMode
      : migratedNav.quizMode,
    activeScope: {
      scopeType: raw.activeScope?.scopeType || 'chapter',
      chapterId: raw.activeScope?.chapterId || null,
      topicId: raw.activeScope?.topicId || null
    },
    groundingMode: raw.groundingMode === 'syllabus' ? 'syllabus' : 'sources',
    autoGenerateOnTabOpen: {
      scoped: raw.autoGenerateOnTabOpen?.scoped !== undefined ? Boolean(raw.autoGenerateOnTabOpen.scoped) : true,
      wholeSubject: Boolean(raw.autoGenerateOnTabOpen?.wholeSubject)
    },
    syllabusBrain: raw.syllabusBrain && Array.isArray(raw.syllabusBrain.chapters)
      ? raw.syllabusBrain
      : null,
    sources: Array.isArray(raw.sources) ? raw.sources : [],
    chatHistory: Array.isArray(raw.chatHistory) ? raw.chatHistory : [],
    artifactsMap,
    artifacts: {
      ...base.artifacts,
      ...legacyArtifacts
    },
    quizHistory: Array.isArray(raw.quizHistory) ? raw.quizHistory : [],
    queueState:
      raw.queueState && typeof raw.queueState === 'object'
        ? {
            status: raw.queueState.status || 'idle',
            concurrency: raw.queueState.concurrency === 2 ? 2 : 1,
            tasks: Array.isArray(raw.queueState.tasks) ? raw.queueState.tasks : [],
            updatedAt: raw.queueState.updatedAt || null
          }
        : base.queueState
  };
}

export function getScopedArtifact(notebook, type, scopeType = 'subject', scopeId = null) {
  if (!notebook) return null;
  const sid = scopeId || notebook.subjectId || 'all';
  const key = makeArtifactKey(type, scopeType, sid);
  return notebook.artifactsMap?.[key] || null;
}

/**
 * Store an artifact under `{ type, scopeType, scopeId }`, keeping up to the last 3 previous versions.
 */
export function setScopedArtifact(
  notebook,
  {
    type,
    scopeType = 'subject',
    scopeId = null,
    scopeLabel = '',
    content,
    mode = 'sources',
    model = 'gemini-4-hydrogen',
    userEdited = false
  }
) {
  if (!notebook) throw new Error('Notebook is required.');
  if (!notebook.artifactsMap || typeof notebook.artifactsMap !== 'object') {
    notebook.artifactsMap = {};
  }

  const sid = scopeId || notebook.subjectId || 'all';
  const key = makeArtifactKey(type, scopeType, sid);
  const existing = notebook.artifactsMap[key];
  let versions = Array.isArray(existing?.versions) ? [...existing.versions] : [];

  const prevHasContent = Array.isArray(existing?.content)
    ? existing.content.length > 0
    : Boolean(existing?.content);

  if (existing && prevHasContent) {
    versions.unshift({
      content: existing.content,
      mode: existing.mode || 'sources',
      model: existing.model || 'gemini-4-hydrogen',
      generatedAt: existing.generatedAt || new Date().toISOString(),
      userEdited: Boolean(existing.userEdited)
    });
    versions = versions.slice(0, MAX_ARTIFACT_VERSIONS);
  }

  const record = {
    key,
    type,
    scopeType,
    scopeId: sid,
    scopeLabel: scopeLabel || existing?.scopeLabel || '',
    content,
    mode: mode === 'syllabus' ? 'syllabus' : 'sources',
    model: model || 'gemini-4-hydrogen',
    generatedAt: new Date().toISOString(),
    userEdited: Boolean(userEdited),
    versions
  };

  notebook.artifactsMap[key] = record;

  // Keep legacy subject-level mirror updated cleanly
  if (scopeType === 'subject' && notebook.artifacts && type in notebook.artifacts) {
    notebook.artifacts[type] = content;
  }

  return record;
}

/**
 * Swap the active artifact content with one of its saved `versions[versionIndex]`.
 */
export function restoreArtifactVersion(notebook, key, versionIndex) {
  const current = notebook?.artifactsMap?.[key];
  if (!current || !Array.isArray(current.versions)) return null;
  const target = current.versions[versionIndex];
  if (!target) return null;

  const remaining = current.versions.filter((_, idx) => idx !== versionIndex);
  remaining.unshift({
    content: current.content,
    mode: current.mode || 'sources',
    model: current.model || 'gemini-4-hydrogen',
    generatedAt: current.generatedAt || new Date().toISOString(),
    userEdited: Boolean(current.userEdited)
  });

  const restored = {
    ...current,
    content: target.content,
    mode: target.mode || 'sources',
    model: target.model || 'gemini-4-hydrogen',
    generatedAt: target.generatedAt || new Date().toISOString(),
    userEdited: Boolean(target.userEdited),
    versions: remaining.slice(0, MAX_ARTIFACT_VERSIONS)
  };

  notebook.artifactsMap[key] = restored;
  if (restored.scopeType === 'subject' && notebook.artifacts && restored.type in notebook.artifacts) {
    notebook.artifacts[restored.type] = restored.content;
  }
  return restored;
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'subjectId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
}

function readFallbackMap() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(FALLBACK_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeFallbackMap(map) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(map));
  } catch {
    // ignore storage quota errors
  }
}

export async function getNotebook(subjectId) {
  if (!subjectId) return null;
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(subjectId);
      req.onsuccess = () => {
        resolve(migrateNotebookRecord(req.result, subjectId));
      };
      req.onerror = () => reject(req.error);
    });
  } catch {
    const map = readFallbackMap();
    return migrateNotebookRecord(map[subjectId], subjectId);
  }
}

export async function saveNotebook(notebook) {
  if (!notebook?.subjectId) return null;
  const payload = migrateNotebookRecord(
    {
      ...notebook,
      updatedAt: new Date().toISOString()
    },
    notebook.subjectId
  );

  try {
    const db = await openDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(payload);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    const map = readFallbackMap();
    map[payload.subjectId] = payload;
    writeFallbackMap(map);
  }
  return payload;
}

export async function getAllNotebooks() {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () =>
        resolve(
          (Array.isArray(req.result) ? req.result : []).map((nb) =>
            migrateNotebookRecord(nb, nb?.subjectId)
          )
        );
      req.onerror = () => reject(req.error);
    });
  } catch {
    const map = readFallbackMap();
    return Object.values(map).map((nb) => migrateNotebookRecord(nb, nb?.subjectId));
  }
}

export async function importNotebooksBulk(notebooksList = []) {
  if (!Array.isArray(notebooksList) || !notebooksList.length) return;
  for (const nb of notebooksList) {
    if (nb && nb.subjectId) {
      await saveNotebook(migrateNotebookRecord(nb, nb.subjectId));
    }
  }
}
