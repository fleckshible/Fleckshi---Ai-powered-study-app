import { getScopedArtifact } from '../storage/notebookStore.js';
import { buildSyllabusBrainFromSubject } from './notebookGenerators.js';

export const QUEUE_CHAPTER_DEFAULT_TYPES = [
  'summary',
  'studyGuide',
  'flashcards',
  'quiz',
  'mindMap'
];

/**
 * Build ordered batch generation tasks across Syllabus Brain chapters + subject Revision Plan.
 * By default skips `{ type, scopeType, scopeId }` entries that already exist in `artifactsMap`.
 */
export function buildChapterGenerationTasks(notebook, subject, opts = {}) {
  const {
    includeExisting = false,
    groundingMode = notebook?.groundingMode || 'syllabus',
    types = QUEUE_CHAPTER_DEFAULT_TYPES,
    chapterIds = null,
    includeRevisionPlan = true
  } = opts;

  const brain = notebook?.syllabusBrain || buildSyllabusBrainFromSubject(subject);
  const chapters = (brain?.chapters || []).filter(
    (ch) => !chapterIds || chapterIds.includes(ch.id)
  );

  const tasks = [];
  let skippedExisting = 0;

  for (const ch of chapters) {
    for (const type of types) {
      const existing = getScopedArtifact(notebook, type, 'chapter', ch.id);
      const hasContent = existing && (Array.isArray(existing.content) ? existing.content.length > 0 : Boolean(existing.content));
      if (!includeExisting && hasContent) {
        skippedExisting++;
        continue;
      }
      tasks.push({
        id: `q_${type}_${ch.id}`,
        type,
        scopeType: 'chapter',
        scopeId: ch.id,
        scopeLabel: ch.name,
        chapterObj: ch,
        topicObj: null,
        groundingMode,
        status: 'pending',
        modelUsed: null,
        error: null
      });
    }
  }

  if (includeRevisionPlan && (subject?.id || notebook?.subjectId)) {
    const sid = subject?.id || notebook.subjectId;
    const existingPlan = getScopedArtifact(notebook, 'revisionPlan', 'subject', sid);
    if (includeExisting || !existingPlan?.content) {
      tasks.push({
        id: `q_revisionPlan_${sid}`,
        type: 'revisionPlan',
        scopeType: 'subject',
        scopeId: sid,
        scopeLabel: subject?.name || brain?.subjectName || 'Whole Subject',
        chapterObj: null,
        topicObj: null,
        groundingMode,
        status: 'pending',
        modelUsed: null,
        error: null
      });
    } else {
      skippedExisting++;
    }
  }

  return { tasks, skippedExisting };
}

/**
 * Concurrency-limited (1 or 2 workers) pausable/resumable/cancellable queue runner.
 */
export function createQueueRunner({
  tasks = [],
  concurrency = 1,
  runTaskFn,
  onProgress,
  onComplete
}) {
  const maxWorkers = concurrency === 2 ? 2 : 1;
  const list = tasks.map((t) => ({ ...t, status: t.status || 'pending' }));
  let status = 'idle'; // 'idle' | 'running' | 'paused' | 'cancelled' | 'done'
  let activeCount = 0;
  let cursor = 0;
  let activeCtrls = new Set();
  let resolveFinish = null;

  const getSnapshot = () => {
    const completed = list.filter((t) => t.status === 'done').length;
    const failed = list.filter((t) => t.status === 'error').length;
    const skipped = list.filter((t) => t.status === 'skipped').length;
    return {
      status,
      concurrency: maxWorkers,
      total: list.length,
      completed,
      failed,
      skipped,
      tasks: list.map((t) => ({
        id: t.id,
        type: t.type,
        scopeType: t.scopeType,
        scopeId: t.scopeId,
        scopeLabel: t.scopeLabel,
        status: t.status,
        modelUsed: t.modelUsed,
        error: t.error
      })),
      updatedAt: new Date().toISOString()
    };
  };

  const emitProgress = () => {
    onProgress?.(getSnapshot());
  };

  const checkDone = () => {
    const allFinished = cursor >= list.length && activeCount === 0;
    if (allFinished && status !== 'cancelled') {
      status = 'done';
      const snap = getSnapshot();
      onProgress?.(snap);
      onComplete?.(snap);
      resolveFinish?.(snap);
      resolveFinish = null;
    }
  };

  const spawnNext = () => {
    if (status !== 'running') return;
    while (activeCount < maxWorkers && cursor < list.length && status === 'running') {
      const idx = cursor++;
      const task = list[idx];
      if (!task || task.status !== 'pending') {
        continue;
      }

      activeCount++;
      task.status = 'running';
      task.error = null;
      const ctrl = new AbortController();
      activeCtrls.add(ctrl);
      emitProgress();

      Promise.resolve()
        .then(() => runTaskFn(task, ctrl.signal))
        .then((res) => {
          if (status === 'cancelled') {
            task.status = 'pending';
          } else {
            task.status = 'done';
            task.modelUsed = res?.modelUsed || null;
          }
        })
        .catch((err) => {
          if (
            err?.name === 'AbortError' ||
            ctrl.signal.aborted ||
            status === 'paused' ||
            status === 'cancelled'
          ) {
            task.status = 'pending';
          } else {
            task.status = 'error';
            task.error = err?.message || 'Generation failed.';
          }
        })
        .finally(() => {
          activeCtrls.delete(ctrl);
          activeCount--;
          emitProgress();
          if (status === 'running') {
            spawnNext();
            checkDone();
          } else if (status === 'cancelled' && activeCount === 0) {
            const snap = getSnapshot();
            onProgress?.(snap);
            onComplete?.(snap);
            resolveFinish?.(snap);
            resolveFinish = null;
          }
        });
    }
    checkDone();
  };

  return {
    start() {
      if (!list.length) {
        status = 'done';
        const snap = getSnapshot();
        onProgress?.(snap);
        onComplete?.(snap);
        return Promise.resolve(snap);
      }
      status = 'running';
      cursor = 0;
      const promise = new Promise((res) => {
        resolveFinish = res;
      });
      emitProgress();
      spawnNext();
      return promise;
    },
    pause() {
      if (status !== 'running') return;
      status = 'paused';
      activeCtrls.forEach((c) => c.abort());
      activeCtrls.clear();
      // Reset cursor so any aborted in-flight tasks remain queued on resume
      cursor = 0;
      emitProgress();
    },
    resume() {
      if (status !== 'paused') return;
      status = 'running';
      cursor = 0;
      emitProgress();
      spawnNext();
    },
    cancel() {
      if (status === 'done' || status === 'cancelled') return;
      status = 'cancelled';
      activeCtrls.forEach((c) => c.abort());
      activeCtrls.clear();
      emitProgress();
      if (activeCount === 0) {
        const snap = getSnapshot();
        onComplete?.(snap);
        resolveFinish?.(snap);
        resolveFinish = null;
      }
    },
    getSnapshot
  };
}
