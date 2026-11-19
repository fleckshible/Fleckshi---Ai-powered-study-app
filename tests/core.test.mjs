import test from 'node:test';
import assert from 'node:assert/strict';

import { migrateState } from '../src/storage/migrations.js';
import { getSubjectStats } from '../src/features/examPlanner.js';
import { syncSrsOnReadToggle, advanceSrsOnRevise, getDueQueue } from '../src/features/spacedRevision.js';
import { recordMarkActivity, recordStudyMinutes, getHeatmapCells, getWeeklySummary } from '../src/features/habits.js';
import { offlineRuleSplitter } from '../src/features/syllabusParser.js';
import { parseImportedBackup, exportStateJson, parseBackupBundle } from '../src/storage/backup.js';
import {
  chunkSourceText,
  createNotebookSource,
  extractCitationsFromText
} from '../src/features/notebookChunker.js';
import { computeDownscaleDimensions } from '../src/features/imageProcessor.js';
import {
  validateAndNormalizeSyllabusJson,
  validateAndNormalizeSyllabusBrain,
  syllabusBrainToLedgerSyllabus,
  mergeSyllabusIntoState
} from '../src/features/notebookGenerators.js';
import {
  filterAndNormalizeLiveModels,
  buildModelCatalogView,
  resolvePresetModel,
  resolveModelForTask,
  buildThinkingConfigForModel,
  buildFallbackQueue
} from '../src/features/modelCatalog.js';
import { executeWithModelFallback } from '../src/features/geminiClient.js';
import {
  recordModelUsage,
  getTodayModelUsage,
  removeApiKey
} from '../src/storage/keyVault.js';
import {
  makeArtifactKey,
  parseArtifactKey,
  migrateNotebookRecord,
  getScopedArtifact,
  setScopedArtifact,
  restoreArtifactVersion
} from '../src/storage/notebookStore.js';
import { renderSubjectView } from '../src/ui/subjectView.js';
import {
  buildChapterGenerationTasks,
  createQueueRunner
} from '../src/features/generationQueue.js';
import {
  renderRichMarkdown,
  stripMarkdownAndLatexForSpeech,
  createStreamRenderThrottle
} from '../src/features/markdownRenderer.js';
import {
  detectDefaultFxLevel,
  getFxLevel,
  setFxLevel,
  cycleFxLevel
} from '../src/animations/fxController.js';
import {
  computeBezelDragStep,
  cleanupViewScope,
  runInViewScope,
  initBezelDraggable,
  initThemeSwitchDraggable
} from '../src/animations/animeEffects.js';
import { formatShortModelName } from '../src/features/modelCatalog.js';
import {
  NOTEBOOK_TABS,
  LEARN_VIEWS,
  PRACTICE_VIEWS,
  migrateLegacyNotebookTab
} from '../src/ui/notebook/tabWorkspaces.js';
import fs from 'node:fs';
import {
  ICON_REGISTRY,
  renderAnimatedIcon,
  renderIconTile,
  renderStatusBadge,
  renderEmptyIllustration
} from '../src/ui/icons.js';

test('v1 to v3 migration preserves subjects, topics, and marks', () => {
  const v1 = {
    activeSubjectId: 's1',
    subjects: [
      {
        id: 's1',
        name: 'Organic Chemistry',
        topics: [{ id: 't1', name: 'Alkanes', read: true, revised: false, practiced: false }]
      }
    ]
  };
  const v3 = migrateState(v1);
  assert.equal(v3.schemaVersion, 3);
  assert.equal(v3.subjects.length, 1);
  assert.equal(v3.subjects[0].topics[0].name, 'Alkanes');
  assert.equal(v3.subjects[0].topics[0].read, true);
  assert.equal(v3.subjects[0].topics[0].srs.stage, 0);
  assert.deepEqual(v3.subjects[0].topics[0].doubts, []);
});

test('examPlanner computes weighted readiness %, countdown, pace, and weak spots', () => {
  const subject = {
    id: 's1',
    name: 'Physics',
    examDate: '2026-11-27',
    topics: [
      { id: 't1', name: 'Kinematics', read: true, revised: true, practiced: true }, // 6/6
      { id: 't2', name: 'Optics', read: true, revised: false, practiced: false }    // 1/6
    ]
  };
  const stats = getSubjectStats(subject, '2026-11-17');
  assert.equal(stats.daysLeft, 10);
  assert.equal(stats.isExamNear, true);
  assert.equal(stats.readinessPct, Math.round((7 / 12) * 100));
  assert.equal(stats.topicsPerDay, 0.1);
  assert.equal(stats.weakSpots.length, 1);
  assert.equal(stats.weakSpots[0].name, 'Optics');
});

test('spacedRevision schedules +1, +3, +7, +21 days and populates Today queue', () => {
  const state = migrateState({
    subjects: [
      {
        id: 's1',
        name: 'Math',
        topics: [{ id: 't1', name: 'Integrals', read: false, revised: false, practiced: false }]
      }
    ]
  });
  const topic = state.subjects[0].topics[0];
  syncSrsOnReadToggle(topic, true, '2026-11-17');
  assert.equal(topic.srs.nextDue, '2026-11-18');

  let queue = getDueQueue(state, '2026-11-18');
  assert.equal(queue.dueToday.length, 1);
  assert.equal(queue.overdue.length, 0);

  advanceSrsOnRevise(topic, '2026-11-18');
  assert.equal(topic.srs.nextDue, '2026-11-21'); // +3d
  advanceSrsOnRevise(topic, '2026-11-21');
  assert.equal(topic.srs.nextDue, '2026-11-28'); // +7d
  advanceSrsOnRevise(topic, '2026-11-28');
  assert.equal(topic.srs.nextDue, '2026-12-19'); // +21d
  advanceSrsOnRevise(topic, '2026-12-19');
  assert.equal(topic.srs.nextDue, null);
});

test('habits tracks XP, streak, heatmap, and weekly summary', () => {
  const state = migrateState({
    subjects: [{ id: 's1', name: 'Bio', topics: [] }]
  });
  recordMarkActivity(state, 's1', 'read', true, '2026-11-17');
  recordStudyMinutes(state, 's1', 25, '2026-11-17');

  assert.equal(state.xp, 10);
  assert.equal(state.streak.current, 1);
  const cells = getHeatmapCells(state, 20, '2026-11-17');
  assert.equal(cells.length, 140);
  assert.ok(cells[cells.length - 1].level >= 1);

  const weekly = getWeeklySummary(state, '2026-11-17');
  assert.equal(weekly.totalTicks, 1);
  assert.equal(weekly.totalMinutes, 25);
});

test('syllabusParser extracts clean unique topics from bullets and numbered lists', async () => {
  const raw = `
    - Atomic Structure
    * Chemical Bonding
    1. Thermodynamics
    1. Thermodynamics
    • Electrochemistry
  `;
  const topics = await offlineRuleSplitter.split(raw);
  assert.deepEqual(topics, [
    'Atomic Structure',
    'Chemical Bonding',
    'Thermodynamics',
    'Electrochemistry'
  ]);
});

test('backup parser validates and migrates exported JSON', () => {
  const json = JSON.stringify({
    app: 'Revision Ledger',
    data: { subjects: [{ id: 's1', name: 'History', topics: [] }] }
  });
  const imported = parseImportedBackup(json);
  assert.equal(imported.schemaVersion, 3);
  assert.equal(imported.subjects[0].name, 'History');
});

test('pomodoro defaults to 25/5 and migrates stuck v2 120m once while preserving intentional v3 120m', () => {
  const fresh = migrateState(null);
  assert.equal(fresh.schemaVersion, 3);
  assert.equal(fresh.pomodoro.workMinutes, 25);
  assert.equal(fresh.pomodoro.breakMinutes, 5);

  const stuckV2 = migrateState({
    schemaVersion: 2,
    subjects: [],
    pomodoro: { workMinutes: 120, breakMinutes: 5 }
  });
  assert.equal(stuckV2.schemaVersion, 3);
  assert.equal(stuckV2.pomodoro.workMinutes, 25);

  const intentionalV3 = migrateState({
    schemaVersion: 3,
    subjects: [],
    pomodoro: { workMinutes: 120, breakMinutes: 10 }
  });
  assert.equal(intentionalV3.schemaVersion, 3);
  assert.equal(intentionalV3.pomodoro.workMinutes, 120);
  assert.equal(intentionalV3.pomodoro.breakMinutes, 10);
});

test('computeBezelDragStep tracks shortest signed angle and clamps 12 oclock boundaries', () => {
  // Initial touch at 90 deg (3 o'clock) -> 30 minutes
  let stepState = computeBezelDragStep(null, null, 90, 5);
  assert.equal(stepState.mins, 30);

  // Drag clockwise to 355 deg -> ~118.3 -> 120m
  stepState = computeBezelDragStep(stepState.angleDeg, stepState.accumMins, 180, 5);
  assert.equal(stepState.mins, 60);
  stepState = computeBezelDragStep(stepState.angleDeg, stepState.accumMins, 355, 5);
  assert.equal(stepState.mins, 120);

  // Cross 12 o'clock clockwise (355 -> 5 deg = +10 deg): must stay clamped at 120m, NOT jump to 5m!
  stepState = computeBezelDragStep(stepState.angleDeg, stepState.accumMins, 5, 5);
  assert.equal(stepState.mins, 120);

  // Start near 15 deg (5m) and cross 12 o'clock counterclockwise (15 -> 350 deg = -25 deg): must stay clamped at 5m!
  let lowState = computeBezelDragStep(null, null, 15, 5);
  assert.equal(lowState.mins, 5);
  lowState = computeBezelDragStep(lowState.angleDeg, lowState.accumMins, 350, 5);
  assert.equal(lowState.mins, 5);

  // Shift-drag 1-minute precision
  const fineState = computeBezelDragStep(null, null, 102, 1);
  assert.equal(fineState.mins, 34);
});

test('bezel and theme switch listeners survive cleanupViewScope -> attach -> runInViewScope', () => {
  const prevWindow = globalThis.window;
  globalThis.window = { matchMedia: () => ({ matches: true }) };

  const makeMockEl = () => {
    const handlers = new Map();
    const attrs = new Map();
    return {
      dataset: {},
      style: {},
      addEventListener(type, fn) {
        if (!handlers.has(type)) handlers.set(type, new Set());
        handlers.get(type).add(fn);
      },
      removeEventListener(type, fn) {
        handlers.get(type)?.delete(fn);
      },
      dispatch(type, evt = {}) {
        handlers.get(type)?.forEach((fn) => fn(evt));
      },
      setAttribute(k, v) {
        attrs.set(k, String(v));
      },
      getAttribute(k) {
        return attrs.get(k) ?? null;
      },
      querySelector() {
        return null;
      },
      querySelectorAll() {
        return [];
      },
      getBoundingClientRect() {
        return { left: 0, top: 0, width: 360, height: 360 };
      }
    };
  };

  try {
    const svgEl = makeMockEl();
    const bezelTarget = makeMockEl();
    const trackEl = makeMockEl();
    const thumbEl = makeMockEl();

    let dialed = [];
    let autoPaused = 0;
    let themeSet = null;
    let currentTheme = 'dark';

    // Exact renderApp() lifecycle order: cleanup -> attach -> runInViewScope
    cleanupViewScope();
    initBezelDraggable(
      bezelTarget,
      svgEl,
      (mins, step, commit) => dialed.push({ mins, step, commit }),
      () => {
        autoPaused++;
      }
    );
    initThemeSwitchDraggable(
      trackEl,
      thumbEl,
      () => currentTheme,
      (next) => {
        themeSet = next;
        currentTheme = next;
      }
    );
    runInViewScope(makeMockEl(), () => {});

    // Synthetic pointerdown at (316, 180) => r=136 at 3 o'clock (90 deg -> 30m)
    bezelTarget.dispatch('pointerdown', {
      clientX: 316,
      clientY: 180,
      pointerId: 1,
      shiftKey: false,
      preventDefault() {}
    });
    // Synthetic pointermove to (180, 316) => 6 o'clock (180 deg -> 60m)
    bezelTarget.dispatch('pointermove', {
      clientX: 180,
      clientY: 316,
      pointerId: 1,
      shiftKey: false
    });
    bezelTarget.dispatch('pointerup', { pointerId: 1 });

    assert.equal(autoPaused, 1);
    assert.equal(dialed[0].mins, 30);
    assert.equal(dialed[0].commit, false);
    assert.equal(dialed[dialed.length - 1].mins, 60);
    assert.equal(dialed[dialed.length - 1].commit, true);

    // Theme switch click must also survive runInViewScope
    trackEl.dispatch('click', {});
    assert.equal(themeSet, 'light');
  } finally {
    cleanupViewScope();
    globalThis.window = prevWindow;
  }
});

test('notebookChunker splits long text into stable citation-addressable chunks and extracts citations', () => {
  const para1 = Array.from({ length: 120 }, (_, i) => `alpha${i}`).join(' ');
  const para2 = Array.from({ length: 120 }, (_, i) => `beta${i}`).join(' ');
  const src = createNotebookSource({
    id: 'src_chem',
    title: 'Thermodynamics Notes',
    type: 'paste',
    rawText: `${para1}\n\n${para2}`,
    sourceIndex: 1
  });

  assert.equal(src.wordCount, 240);
  assert.equal(src.chunks.length, 2);
  assert.equal(src.chunks[0].id, 'src_chem#c1');
  assert.equal(src.chunks[0].label, 'S1·C1');
  assert.equal(src.chunks[1].id, 'src_chem#c2');
  assert.equal(src.chunks[1].label, 'S1·C2');

  const answer = 'First law conserves energy [S1·C1] while entropy rises [src_chem#c2] [unknown#c9].';
  const citations = extractCitationsFromText(answer, src.chunks);
  assert.equal(citations.length, 2);
  assert.equal(citations[0].chunkId, 'src_chem#c1');
  assert.equal(citations[1].chunkId, 'src_chem#c2');
  assert.equal(citations[1].label, 'S1·C2');
});

test('imageProcessor computeDownscaleDimensions caps longest edge at 1600px and OCR creates image source', () => {
  const landscape = computeDownscaleDimensions(3200, 1600, 1600);
  assert.deepEqual(landscape, { width: 1600, height: 800, scale: 0.5 });

  const portrait = computeDownscaleDimensions(1000, 2000, 1600);
  assert.deepEqual(portrait, { width: 800, height: 1600, scale: 0.8 });

  const small = computeDownscaleDimensions(800, 600, 1600);
  assert.deepEqual(small, { width: 800, height: 600, scale: 1 });

  const imgSrc = createNotebookSource({
    id: 'src_img_1',
    title: 'Whiteboard Photo',
    type: 'image',
    thumbnail: 'data:image/jpeg;base64,thumb',
    rawText: 'dG = dH - T dS\n\nSpontaneous when dG < 0.',
    sourceIndex: 2
  });
  assert.equal(imgSrc.type, 'image');
  assert.equal(imgSrc.thumbnail, 'data:image/jpeg;base64,thumb');
  assert.equal(imgSrc.chunks[0].id, 'src_img_1#c1');
  assert.equal(imgSrc.chunks[0].label, 'S2·C1');
});

test('validateAndNormalizeSyllabusJson and mergeSyllabusIntoState prevent duplicates and keep marks', () => {
  const rawJson = '```json\n' +
    JSON.stringify({
      subjects: [
        {
          name: 'Organic Chemistry',
          examDate: '2026-12-15',
          topics: [
            { name: 'Alkanes', chapter: 'Hydrocarbons' },
            { name: 'Alkenes', chapter: 'Hydrocarbons' },
            { name: 'alkenes', chapter: 'Duplicate' },
            'Alkynes'
          ]
        },
        {
          name: 'Linear Algebra',
          topics: ['Eigenvalues', 'SVD']
        }
      ]
    }) +
    '\n```';

  const normalized = validateAndNormalizeSyllabusJson(rawJson);
  assert.equal(normalized.subjects.length, 2);
  assert.equal(normalized.subjects[0].topics.length, 3);
  assert.equal(normalized.subjects[0].topics[2].chapter, 'General');

  const existing = migrateState({
    activeSubjectId: 's1',
    subjects: [
      {
        id: 's1',
        name: 'Organic Chemistry',
        topics: [
          { id: 't1', name: 'Alkanes', chapter: 'Intro', read: true, revised: true, practiced: false, notes: 'Keep me' }
        ]
      }
    ]
  });

  const { nextState, addedSubjects, addedTopics } = mergeSyllabusIntoState(existing, normalized);
  assert.equal(addedSubjects, 1);
  assert.equal(addedTopics, 4); // Alkenes, Alkynes, Eigenvalues, SVD
  assert.equal(nextState.subjects.length, 2);

  const orgChem = nextState.subjects[0];
  assert.equal(orgChem.examDate, '2026-12-15');
  assert.equal(orgChem.topics.length, 3);
  assert.equal(orgChem.topics[0].read, true);
  assert.equal(orgChem.topics[0].revised, true);
  assert.equal(orgChem.topics[0].notes, 'Keep me');
  assert.equal(orgChem.topics[1].chapter, 'Hydrocarbons');
});

test('exportStateJson and parseBackupBundle round-trip optional notebooks without any API key field', () => {
  const state = migrateState({
    subjects: [{ id: 's1', name: 'Physics', topics: [] }]
  });
  const notebooks = [
    {
      subjectId: 's1',
      sources: [{ id: 'src_1', title: 'Notes', type: 'paste', included: true, chunks: [] }],
      chat: [],
      artifacts: {}
    }
  ];

  const json = exportStateJson(state, notebooks);
  assert.equal(json.includes('keyVault'), false);
  const bundle = parseBackupBundle(json);
  assert.equal(bundle.state.subjects[0].name, 'Physics');
  assert.equal(bundle.notebooks.length, 1);
  assert.equal(bundle.notebooks[0].subjectId, 's1');
});

test('modelCatalog filters live models, groups correctly, and marks missing curated models unavailable', () => {
  const raw = [
    { name: 'models/gemini-4-hydrogen', displayName: 'Gemini 4 Hydrogen', supportedActions: ['generateContent'], inputTokenLimit: 1048576 },
    { name: 'models/gemini-3.8-flash', displayName: 'Gemini 3.8 Flash', supportedActions: ['generateContent'] },
    { name: 'models/gemini-2.5-flash-lite', displayName: 'Gemini 2.5 Flash-Lite', supportedActions: ['generateContent'] },
    { name: 'models/gemma-4-31b-it', displayName: 'Gemma 4 31B', supportedActions: ['generateContent'], thinking: false },
    { name: 'models/text-embedding-004', displayName: 'Embedding', supportedActions: ['embedContent'] },
    { name: 'models/gemini-3.8-flash-tts', displayName: 'Flash TTS', supportedActions: ['generateContent'] }
  ];

  const live = filterAndNormalizeLiveModels(raw);
  assert.deepEqual(
    live.map((m) => m.id),
    ['gemini-4-hydrogen', 'gemini-3.8-flash', 'gemini-2.5-flash-lite', 'gemma-4-31b-it']
  );

  const catalog = buildModelCatalogView(live);
  assert.equal(catalog.groups['Gemini 4'].find((m) => m.id === 'gemini-4-hydrogen')?.available, true);
  const argon = catalog.groups['Gemini 4'].find((m) => m.id === 'gemini-4-argon');
  assert.equal(argon?.available, false);
  assert.equal(argon?.availabilityReason, 'not available for this key');
  assert.equal(catalog.availableModels.some((m) => m.id === 'gemini-4-argon'), false);

  // Offline / no live list preserves curated fallback list
  const offlineCatalog = buildModelCatalogView(null);
  assert.equal(offlineCatalog.hasLiveList, false);
  assert.ok(offlineCatalog.availableModels.some((m) => m.id === 'gemini-4-argon'));
});

test('preset resolution, per-task OCR vision routing, and fallback queue honor key capabilities', async () => {
  const limitedLive = filterAndNormalizeLiveModels([
    { name: 'models/gemini-3.6-flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemma-4-31b-it', supportedGenerationMethods: ['generateContent'] }
  ]);

  assert.equal(resolvePresetModel('fast', limitedLive), 'gemini-3.6-flash');
  assert.equal(resolvePresetModel('balanced', limitedLive), 'gemini-3.6-flash');
  assert.equal(resolvePresetModel('deep', limitedLive), 'gemini-3.6-flash');

  // Vision requirement for OCR rejects text-only gemma-4-31b-it even if selected as global model
  const ocrModel = resolveModelForTask(
    'ocr',
    {
      useSingleModel: true,
      preset: 'custom',
      model: 'gemma-4-31b-it',
      taskRouting: { ocr: 'gemma-4-31b-it', chat: 'gemma-4-31b-it' }
    },
    limitedLive
  );
  assert.equal(ocrModel, 'gemini-3.6-flash');

  const chatModel = resolveModelForTask(
    'chat',
    { useSingleModel: false, taskRouting: { chat: 'gemma-4-31b-it' } },
    limitedLive
  );
  assert.equal(chatModel, 'gemma-4-31b-it');

  // Fallback queue with requireVision omits gemma-4-31b-it
  const queue = buildFallbackQueue(
    'gemini-4-hydrogen',
    { autoFallback: true, fallbackOrder: ['gemma-4-31b-it', 'gemini-3.6-flash'] },
    limitedLive,
    { requireVision: true }
  );
  assert.deepEqual(queue, ['gemini-4-hydrogen', 'gemini-3.6-flash']);

  // executeWithModelFallback tries next model on 404 and notifies caller
  const calls = [];
  const notifications = [];
  const exec = await executeWithModelFallback(
    {
      taskKey: 'chat',
      vaultConfigOverride: {
        useSingleModel: false,
        autoFallback: true,
        taskRouting: { chat: 'balanced' },
        fallbackOrder: ['fast']
      },
      liveModelsOverride: filterAndNormalizeLiveModels([
        { name: 'models/gemini-4-hydrogen', supportedActions: ['generateContent'] },
        { name: 'models/gemini-3.8-flash', supportedActions: ['generateContent'] }
      ]),
      onModelFallback: (info) => notifications.push(info)
    },
    async (modelId) => {
      calls.push(modelId);
      if (modelId === 'gemini-4-hydrogen') {
        throw new Error('404 model not found');
      }
      return 'OK from Flash';
    }
  );
  assert.deepEqual(calls, ['gemini-4-hydrogen', 'gemini-3.8-flash']);
  assert.equal(exec.modelUsed, 'gemini-3.8-flash');
  assert.equal(exec.fallbackFrom, 'gemini-4-hydrogen');
  assert.equal(notifications.length, 1);

  // Usage counter increments cleanly per day
  removeApiKey();
  recordModelUsage('gemini-4-hydrogen', '2026-11-18');
  recordModelUsage('gemini-4-hydrogen', '2026-11-18');
  assert.equal(getTodayModelUsage('2026-11-18')['gemini-4-hydrogen'], 2);
});

test('buildThinkingConfigForModel uses thinkingLevel for Gemini 4/3, thinkingBudget for 2.5, and omits for non-thinking', () => {
  assert.deepEqual(buildThinkingConfigForModel('gemini-4-hydrogen', 'high'), {
    thinkingConfig: { thinkingLevel: 'HIGH' }
  });
  assert.deepEqual(buildThinkingConfigForModel('gemini-4-argon', 'xhigh'), {}); // unsupported xhigh on Argon omitted cleanly
  assert.deepEqual(buildThinkingConfigForModel('gemini-3.8-flash', 'minimal'), {
    thinkingConfig: { thinkingLevel: 'MINIMAL' }
  });
  assert.deepEqual(buildThinkingConfigForModel('gemini-2.5-flash', 'high'), {
    thinkingConfig: { thinkingBudget: 8192 }
  });
  assert.deepEqual(buildThinkingConfigForModel('gemini-2.5-flash', 0), {
    thinkingConfig: { thinkingBudget: 0 }
  });
  assert.deepEqual(buildThinkingConfigForModel('gemma-4-31b-it', 'high'), {});
});

test('Syllabus Brain validation and Apply-to-Ledger conversion preserve chapters without duplicates', () => {
  const brain = validateAndNormalizeSyllabusBrain({
    subjectName: 'Physics',
    examDate: '2026-12-20',
    chapters: [
      {
        name: 'Mechanics',
        topics: [
          { name: 'Kinematics', subtopics: ['1D motion', 'Projectiles'] },
          { name: 'kinematics', subtopics: ['dup'] },
          { name: 'Newton Laws', subtopics: ['F=ma'] }
        ]
      }
    ]
  });

  assert.equal(brain.chapters.length, 1);
  assert.equal(brain.chapters[0].topics.length, 2);
  assert.deepEqual(brain.chapters[0].topics[0].subtopics, ['1D motion', 'Projectiles']);

  const existingSubject = {
    id: 's_phys',
    name: 'Physics',
    topics: [{ id: 't1', name: 'Kinematics', chapter: 'Mechanics', read: true, revised: false, practiced: false }]
  };
  const { ledgerSyllabus, preview } = syllabusBrainToLedgerSyllabus(brain, existingSubject, 'Physics');
  assert.equal(preview.newTopicsCount, 1);
  assert.equal(preview.duplicateTopicsCount, 1);

  const { nextState, addedTopics } = mergeSyllabusIntoState(
    migrateState({ activeSubjectId: 's_phys', subjects: [existingSubject] }),
    ledgerSyllabus
  );
  assert.equal(addedTopics, 1);
  assert.equal(nextState.subjects[0].topics.length, 2);
  assert.equal(nextState.subjects[0].topics[1].chapter, 'Mechanics');
  assert.equal(nextState.subjects[0].topics[0].read, true);
});

test('notebookStore v2 migration, scoped artifact keys, 3-version cap, and version restore', () => {
  const v1 = {
    subjectId: 's_bio',
    updatedAt: '2026-11-10T10:00:00.000Z',
    sources: [],
    chatHistory: [],
    artifacts: {
      summary: 'Old v1 summary',
      flashcards: [{ front: 'Cell?', back: 'Basic unit' }]
    }
  };

  const v2 = migrateNotebookRecord(v1, 's_bio');
  assert.equal(v2.notebookSchemaVersion, 2);
  assert.equal(makeArtifactKey('summary', 'subject', 's_bio'), 'summary::subject::s_bio');
  assert.deepEqual(parseArtifactKey('quiz::chapter::ch_1'), {
    type: 'quiz',
    scopeType: 'chapter',
    scopeId: 'ch_1'
  });

  const migratedSummary = getScopedArtifact(v2, 'summary', 'subject', 's_bio');
  assert.equal(migratedSummary?.content, 'Old v1 summary');

  // Push 4 updates -> keeps at most 3 versions in history
  for (let i = 1; i <= 4; i++) {
    setScopedArtifact(v2, {
      type: 'summary',
      scopeType: 'chapter',
      scopeId: 'ch_1',
      content: `Version ${i}`,
      model: i === 4 ? 'gemini-4-argon' : 'gemini-4-hydrogen',
      mode: 'syllabus'
    });
  }

  const key = makeArtifactKey('summary', 'chapter', 'ch_1');
  const current = v2.artifactsMap[key];
  assert.equal(current.content, 'Version 4');
  assert.equal(current.versions.length, 3);
  assert.equal(current.versions[0].content, 'Version 3');
  assert.equal(current.versions[2].content, 'Version 1');

  const restored = restoreArtifactVersion(v2, key, 1); // Restore Version 2
  assert.equal(restored.content, 'Version 2');
  assert.equal(restored.versions[0].content, 'Version 4');
});

test('generationQueue skips existing artifacts, enforces concurrency, and supports pause/resume', async () => {
  const nb = migrateNotebookRecord(
    {
      subjectId: 's1',
      syllabusBrain: {
        subjectName: 'Chem',
        chapters: [
          { id: 'c1', name: 'Atoms', topics: [{ id: 't1', name: 'Orbitals' }] },
          { id: 'c2', name: 'Bonds', topics: [{ id: 't2', name: 'Covalent' }] }
        ]
      }
    },
    's1'
  );

  // Pre-populate c1 summary so queue skips it
  setScopedArtifact(nb, {
    type: 'summary',
    scopeType: 'chapter',
    scopeId: 'c1',
    content: 'Already done'
  });

  const { tasks, skippedExisting } = buildChapterGenerationTasks(nb, { id: 's1', name: 'Chem' }, {
    includeExisting: false,
    types: ['summary', 'mindMap'],
    includeRevisionPlan: false
  });

  assert.equal(skippedExisting, 1);
  assert.equal(tasks.length, 3); // c1 mindMap, c2 summary, c2 mindMap

  let inFlight = 0;
  let peakConcurrency = 0;
  const completedIds = [];
  let pausedOnce = false;
  let runner = null;

  runner = createQueueRunner({
    tasks,
    concurrency: 2,
    runTaskFn: async (task, signal) => {
      inFlight++;
      peakConcurrency = Math.max(peakConcurrency, inFlight);
      await new Promise((r) => setTimeout(r, 15));
      inFlight--;
      if (signal.aborted) {
        const err = new Error('Aborted');
        err.name = 'AbortError';
        throw err;
      }
      if (!pausedOnce) {
        pausedOnce = true;
        completedIds.push(task.id);
        runner.pause();
        setTimeout(() => runner.resume(), 10);
        return { modelUsed: 'gemini-4-hydrogen' };
      }
      completedIds.push(task.id);
      return { modelUsed: 'gemini-4-hydrogen' };
    }
  });

  const finalSnap = await runner.start();
  assert.equal(finalSnap.status, 'done');
  assert.equal(finalSnap.completed, 3);
  assert.ok(peakConcurrency <= 2);
  assert.equal(completedIds.length, 3);
});

test('renderRichMarkdown parses Markdown headings, nested lists, bold lead-ins, LaTeX math, citations, and strips XSS', () => {
  const chunks = [{ id: 'src_1#c1', label: 'S1·C1', sourceId: 'src_1', text: 'Gibbs free energy' }];
  const sample = [
    '#### Thermodynamics Overview',
    '',
    '- **Gibbs Free Energy:** $\\Delta G^\\circ = -RT \\ln K$ governs equilibrium [S1·C1].',
    '  - **Spontaneous Reaction:** Occurs when $\\Delta G < 0$.',
    '',
    '$$',
    '\\int_0^\\infty e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}',
    '$$',
    '',
    '```js',
    'const price = "$5";',
    '```',
    '',
    '<script>alert("xss")</script><img src="x" onerror="alert(1)">'
  ].join('\n');

  const html = renderRichMarkdown(sample, chunks);
  assert.ok(html.includes('nb-markdown-body'));
  assert.ok(html.includes('<h4>Thermodynamics Overview</h4>'));
  assert.equal(html.includes('####'), false);
  assert.ok(html.includes('class="nb-kv-item"'));
  assert.ok(html.includes('class="nb-kv-term">Gibbs Free Energy:</strong>'));
  assert.ok(html.includes('class="nb-math-inline"'));
  assert.ok(html.includes('class="nb-math-block"'));
  assert.ok(html.includes('class="katex"'));
  assert.ok(html.includes('data-cite-chunk="src_1#c1"'));
  assert.ok(html.includes('const price = &quot;$5&quot;;'));
  assert.equal(html.includes('<script'), false);
  assert.equal(html.includes('onerror='), false);

  // Graceful fallback on malformed/incomplete LaTeX without throwing
  const malformed = renderRichMarkdown('Broken math $\\unknowncommand{\\frac{1}{$', []);
  assert.ok(malformed.includes('nb-markdown-body'));
});

test('stripMarkdownAndLatexForSpeech cleans Markdown & LaTeX macros and stream throttle batches updates', () => {
  const spoken = stripMarkdownAndLatexForSpeech(
    '## Key Ideas\n- **Energy:** $\\Delta G^\\circ = \\frac{a}{b}$ yields work [S1·C1]'
  );
  assert.equal(spoken.includes('#'), false);
  assert.equal(spoken.includes('**'), false);
  assert.equal(spoken.includes('$'), false);
  assert.ok(spoken.includes('Delta G degrees'));
  assert.ok(spoken.includes('a over b'));

  const updates = [];
  const t = createStreamRenderThrottle((val) => updates.push(val), 100);
  t.update('first');
  t.update('second');
  t.flush('final');
  assert.equal(updates[0], 'first');
  assert.equal(updates[updates.length - 1], 'final');
});

test('fxController detects constrained hardware/reduced-motion defaults and cycles persisted FX levels', () => {
  assert.equal(detectDefaultFxLevel({ reducedMotion: true, hardwareConcurrency: 16, deviceMemory: 32 }), 'minimal');
  assert.equal(detectDefaultFxLevel({ reducedMotion: false, hardwareConcurrency: 4, deviceMemory: 16 }), 'minimal');
  assert.equal(detectDefaultFxLevel({ reducedMotion: false, hardwareConcurrency: 8, deviceMemory: 4 }), 'minimal');
  assert.equal(detectDefaultFxLevel({ reducedMotion: false, hardwareConcurrency: 8, deviceMemory: 16 }), 'balanced');

  setFxLevel('balanced');
  assert.equal(getFxLevel(), 'balanced');
  assert.equal(cycleFxLevel(), 'full');
  assert.equal(cycleFxLevel(), 'minimal');
  assert.equal(cycleFxLevel(), 'balanced');
});

test('Phase A navigation: 6 top tabs, in-page view switches, and all 28+ legacy tab migrations', () => {
  assert.deepEqual(
    NOTEBOOK_TABS.map((t) => t.id),
    ['home', 'sources', 'chat', 'learn', 'practice', 'plan']
  );
  assert.deepEqual(
    LEARN_VIEWS.map((v) => v.id),
    ['notes', 'summary', 'studyGuide', 'faq', 'glossary', 'timeline', 'mindMap']
  );
  assert.deepEqual(
    PRACTICE_VIEWS.map((v) => v.id),
    ['flashcards', 'quiz']
  );

  // Legacy Home IDs & modal actions
  assert.equal(migrateLegacyNotebookTab('home').tabId, 'home');
  assert.equal(migrateLegacyNotebookTab('home:overview').modalAction, null);
  assert.equal(migrateLegacyNotebookTab('home:scan').modalAction, 'scan');
  assert.equal(migrateLegacyNotebookTab('home:tree').modalAction, 'tree');
  assert.equal(migrateLegacyNotebookTab('home:paste').modalAction, 'paste');
  assert.equal(migrateLegacyNotebookTab('home:sync').modalAction, 'sync');
  assert.equal(migrateLegacyNotebookTab('home:queue').modalAction, 'queue');
  assert.equal(migrateLegacyNotebookTab('visual:matrix').tabId, 'home');

  // Legacy Sources & Chat IDs
  assert.equal(migrateLegacyNotebookTab('sources').tabId, 'sources');
  assert.equal(migrateLegacyNotebookTab('sources:library').tabId, 'sources');
  assert.equal(migrateLegacyNotebookTab('sources:upload').modalAction, 'sources:upload');
  assert.equal(migrateLegacyNotebookTab('sources:paste').modalAction, 'sources:paste');
  assert.equal(migrateLegacyNotebookTab('sources:topics').modalAction, 'sources:topics');
  assert.equal(migrateLegacyNotebookTab('chat').tabId, 'chat');
  assert.equal(migrateLegacyNotebookTab('chat:stream').tabId, 'chat');
  assert.equal(migrateLegacyNotebookTab('chat:citations').chatDrawerTab, 'citations');
  assert.equal(migrateLegacyNotebookTab('chat:settings').chatDrawerTab, 'settings');

  // Legacy Learn / Notes / Visual IDs
  const notesRes = migrateLegacyNotebookTab('notes');
  assert.equal(notesRes.tabId, 'learn');
  assert.equal(notesRes.learnView, 'notes');
  assert.equal(notesRes.notesMode, 'ai');
  assert.equal(notesRes.tool, 'notes');

  const personalRes = migrateLegacyNotebookTab('personalNotes');
  assert.equal(personalRes.tabId, 'learn');
  assert.equal(personalRes.learnView, 'notes');
  assert.equal(personalRes.notesMode, 'mine');
  assert.equal(personalRes.tool, 'notes');

  for (const lv of ['summary', 'studyGuide', 'faq', 'glossary', 'timeline', 'mindMap']) {
    const res = migrateLegacyNotebookTab(lv);
    assert.equal(res.tabId, 'learn');
    assert.equal(res.learnView, lv);
    assert.equal(res.tool, lv);
  }
  assert.equal(migrateLegacyNotebookTab('visual').tabId, 'learn');
  assert.equal(migrateLegacyNotebookTab('visual').learnView, 'mindMap');

  // Legacy Practice IDs
  const fcRes = migrateLegacyNotebookTab('flashcards');
  assert.equal(fcRes.tabId, 'practice');
  assert.equal(fcRes.practiceView, 'flashcards');
  assert.equal(fcRes.tool, 'flashcards');

  const quizRes = migrateLegacyNotebookTab('quiz');
  assert.equal(quizRes.tabId, 'practice');
  assert.equal(quizRes.practiceView, 'quiz');
  assert.equal(quizRes.quizMode, 'play');
  assert.equal(quizRes.tool, 'quiz');

  assert.equal(migrateLegacyNotebookTab('quiz:config').quizMode, 'build');
  assert.equal(migrateLegacyNotebookTab('quiz:history').quizMode, 'history');

  // Legacy Plan IDs
  assert.equal(migrateLegacyNotebookTab('plan').tabId, 'plan');
  assert.equal(migrateLegacyNotebookTab('revisionPlan').tabId, 'plan');
  assert.equal(migrateLegacyNotebookTab('plan:sync').tabId, 'plan');

  // Remembered sub-views preserved per subject when switching between top tabs
  const mockNb = { activeLearnView: 'glossary', activeNotesMode: 'mine', activePracticeView: 'quiz', activeQuizMode: 'history' };
  const learnSaved = migrateLegacyNotebookTab('learn', mockNb);
  assert.equal(learnSaved.learnView, 'glossary');
  const practiceSaved = migrateLegacyNotebookTab('practice', mockNb);
  assert.equal(practiceSaved.practiceView, 'quiz');
  assert.equal(practiceSaved.quizMode, 'history');

  // Notebook migration preserves legacy activeTab -> structured fields
  const migrated = migrateNotebookRecord({ subjectId: 's_mig', activeTab: 'quiz:config' }, 's_mig');
  assert.equal(migrated.activeTab, 'practice');
  assert.equal(migrated.activePracticeView, 'quiz');
  assert.equal(migrated.activeQuizMode, 'build');

  // Short model label helper
  assert.equal(formatShortModelName('gemini-4-hydrogen'), 'Hydrogen');
  assert.equal(formatShortModelName('gemini-4-argon'), 'Argon');
  assert.equal(formatShortModelName('gemini-4-carbon'), 'Carbon');
});

test('ICON_REGISTRY & renderAnimatedIcon cover all 6 tabs, Learn/Practice views, sidebar nav, and controls', () => {
  for (const tab of NOTEBOOK_TABS) {
    assert.ok(ICON_REGISTRY[tab.icon], `Missing registry icon for tab ${tab.id}`);
    const svgStr = renderAnimatedIcon(tab.icon, { size: 15 });
    assert.ok(svgStr.includes('<svg') && svgStr.includes('rl-anim-icon') && svgStr.includes('rl-icon-draw'));
  }

  for (const view of [...LEARN_VIEWS, ...PRACTICE_VIEWS]) {
    assert.ok(ICON_REGISTRY[view.icon], `Missing registry icon for view ${view.id}`);
    assert.ok(renderAnimatedIcon(view.icon, { size: 14 }).includes(`data-rl-icon="${view.icon}"`));
  }

  for (const id of ['nav:subject', 'nav:focus', 'nav:today', 'nav:dashboard', 'nav:notebook', 'action:cmd', 'action:backup', 'ctrl:scope', 'ctrl:model', 'ctrl:tools', 'ctrl:generate', 'ctrl:grid']) {
    assert.ok(ICON_REGISTRY[id], `Missing icon ${id}`);
    assert.ok(renderAnimatedIcon(id).includes('rl-anim-'));
  }
});

test('Phase B: Subject Ledger unifies header card, composer bulk import, and topic overflow menu', () => {
  const subject = {
    id: 'subj-1',
    name: 'Organic Chemistry',
    examDate: '2026-12-01',
    topics: [
      {
        id: 'topic-1',
        name: 'Stereochemistry',
        status: 'not-started',
        confidence: 0,
        lastReviewed: null,
        notes: '',
        doubts: [],
        revisionCount: 0
      }
    ]
  };
  const html = renderSubjectView(subject, new Set(), null);
  assert.ok(html.includes('class="subject-header-card"'));
  assert.ok(!html.includes('class="subject-toolbar"'));
  assert.ok(!html.includes('class="legend"'));
  assert.ok(html.includes('id="addTopicForm"'));
  assert.ok(html.includes('id="openBulkImportBtn"'));
  assert.ok(html.includes('data-topic-menu-btn="topic-1"'));
  assert.ok(html.includes('data-topic-menu="topic-1"'));
  assert.ok(html.includes('data-focus-topic="topic-1"'));
  assert.ok(html.includes('data-toggle-extras="topic-1"'));
  assert.ok(html.includes('data-del-topic="topic-1"'));
});

test('Phase C: Icon System v2 duotone 20/24px, tiles, status badges, distinct section colors & zero idle icon loops', () => {
  const defaultIcon = renderAnimatedIcon('sec:home');
  assert.ok(defaultIcon.includes('width="20"'));
  assert.ok(defaultIcon.includes('rl-icon-fill'));

  const heroTile = renderIconTile('sec:learn', { variant: 'hero', accent: 'learn' });
  assert.ok(heroTile.includes('rl-icon-tile--hero'));
  assert.ok(heroTile.includes('data-tile-accent="learn"'));
  assert.ok(heroTile.includes('width="24"'));

  for (const st of ['generated', 'stale', 'due', 'mastered']) {
    const badge = renderStatusBadge(st);
    assert.ok(badge.includes(`status-badge is-${st}`));
    assert.ok(badge.includes(`data-rl-icon="status:${st}"`));
  }

  const empty = renderEmptyIllustration('sec:sources', {
    title: 'No Sources',
    subtitle: 'Drop files here',
    accent: 'sources'
  });
  assert.ok(empty.includes('rl-empty-card'));
  assert.ok(empty.includes('rl-icon-tile--hero'));

  const tokensCss = fs.readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
  for (const hex of ['#3B82F6', '#06B6D4', '#14B8A6', '#8B5CF6', '#D946EF', '#10B981', '#F59E0B', '#F43F5E']) {
    assert.ok(tokensCss.includes(hex), `Missing dark accent/semantic color ${hex}`);
  }
  const nbCss = fs.readFileSync(new URL('../src/styles/notebook.css', import.meta.url), 'utf8');
  assert.ok(
    !nbCss.includes(':root[data-theme="light"] .nb-shell[data-nb-accent]'),
    'Light-mode sapphire override bug must remain removed'
  );
  const layCss = fs.readFileSync(new URL('../src/styles/layout.css', import.meta.url), 'utf8');
  assert.ok(!/rl-icon-(float|pulse|scan|spin|tilt|wave).*infinite/.test(layCss), 'Idle icon infinite loops must be removed');
});

test('Phase D: keyed Notebook DOM updates, ARIA tabs/live regions, zero wheel-hijacking, visibility pause & model single-source-of-truth', () => {
  const nbViewSrc = fs.readFileSync(new URL('../src/ui/notebookView.js', import.meta.url), 'utf8');
  // Keyed containers prevent ambient canvas rebuild on UI toggles
  assert.ok(nbViewSrc.includes('id="nbHeaderSlot"'));
  assert.ok(nbViewSrc.includes('id="nbModalHost"'));
  assert.ok(nbViewSrc.includes('role="tabpanel"'));
  assert.ok(nbViewSrc.includes('aria-controls="nbTabStage"'));
  assert.ok(nbViewSrc.includes('repositionOpenPopovers'));
  assert.ok(nbViewSrc.includes('syncOverlayFocusTrap'));
  // Top tabs must never carry aria-haspopup
  const topTabSnippet = nbViewSrc.slice(
    nbViewSrc.indexOf('const topTabsHtml = NOTEBOOK_TABS.map'),
    nbViewSrc.indexOf('return (\n    `<header class="nb-header">')
  );
  assert.ok(!topTabSnippet.includes('aria-haspopup'), 'Top tabs must not use aria-haspopup');
  // Removed bottom dock & wheel-hijacking
  assert.ok(!nbViewSrc.includes('nb-bottom-dock'));
  assert.ok(!nbViewSrc.includes("addEventListener('wheel'"));

  const twSrc = fs.readFileSync(new URL('../src/ui/notebook/tabWorkspaces.js', import.meta.url), 'utf8');
  assert.ok(twSrc.includes('id="nbGenStreamPreview" class="nb-markdown-body" aria-live="polite"'));
  assert.ok(twSrc.includes('id="nbChatScroll" aria-live="polite"'));

  const nbFxSrc = fs.readFileSync(new URL('../src/animations/notebookEffects.js', import.meta.url), 'utf8');
  const animeFxSrc = fs.readFileSync(new URL('../src/animations/animeEffects.js', import.meta.url), 'utf8');
  assert.ok(nbFxSrc.includes("addEventListener('visibilitychange'"));
  assert.ok(animeFxSrc.includes("addEventListener('visibilitychange'"));

  // Single-source-of-truth model & grounding logic
  const singleCfg = {
    useSingleModel: true,
    model: 'gemini-4-hydrogen',
    preset: 'balanced',
    taskModels: {
      ocr: 'gemini-2.5-flash',
      chat: 'gemini-4-argon',
      notes: 'gemini-4-argon',
      quiz: 'gemini-4-argon',
      mindMap: 'gemini-4-argon'
    }
  };
  const live = [
    { id: 'gemini-4-hydrogen', displayName: 'Gemini 4 Hydrogen', supportsVision: true, supportedGenerationMethods: ['generateContent'] },
    { id: 'gemini-4-argon', displayName: 'Gemini 4 Argon', supportsVision: true, supportedGenerationMethods: ['generateContent'] },
    { id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', supportsVision: true, supportedGenerationMethods: ['generateContent'] }
  ];
  for (const task of ['chat', 'notes', 'quiz', 'mindMap', 'ocr']) {
    assert.equal(resolveModelForTask(task, singleCfg, live), 'gemini-4-hydrogen');
  }

  const migrated = migrateNotebookRecord({
    subjectId: 's1',
    activeTab: 'personalNotes',
    groundingMode: 'syllabus'
  });
  assert.equal(migrated.groundingMode, 'syllabus');
  const nav = migrateLegacyNotebookTab(migrated.activeTab, migrated);
  assert.equal(nav.tabId, 'learn');
  assert.equal(nav.learnView, 'notes');
  assert.equal(nav.notesMode, 'mine');
});
