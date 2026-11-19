import { uid } from '../utils/uid.js';

/**
 * Count words in plain text.
 * @param {string} text
 * @returns {number}
 */
export function countWords(text) {
  if (!text || typeof text !== 'string') return 0;
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Split source text into stable citation-addressable chunks (`${sourceId}#c${index}`).
 * @param {string} sourceId
 * @param {string} rawText
 * @param {number} [sourceIndex=1]
 * @param {number} [maxWords=180]
 * @returns {Array<{ id: string, label: string, sourceId: string, index: number, text: string }>}
 */
export function chunkSourceText(sourceId, rawText, sourceIndex = 1, maxWords = 180) {
  const clean = String(rawText || '').replace(/\r\n/g, '\n').trim();
  if (!clean) return [];

  const paragraphs = clean
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks = [];
  let buffer = [];
  let bufferWords = 0;

  const flush = () => {
    if (!buffer.length) return;
    const idx = chunks.length + 1;
    chunks.push({
      id: `${sourceId}#c${idx}`,
      label: `S${sourceIndex}·C${idx}`,
      sourceId,
      index: idx,
      text: buffer.join('\n\n')
    });
    buffer = [];
    bufferWords = 0;
  };

  for (const para of paragraphs) {
    const words = para.split(/\s+/);
    if (words.length > maxWords) {
      flush();
      for (let i = 0; i < words.length; i += maxWords) {
        const slice = words.slice(i, i + maxWords).join(' ');
        const idx = chunks.length + 1;
        chunks.push({
          id: `${sourceId}#c${idx}`,
          label: `S${sourceIndex}·C${idx}`,
          sourceId,
          index: idx,
          text: slice
        });
      }
      continue;
    }

    if (bufferWords + words.length > maxWords && buffer.length) {
      flush();
    }
    buffer.push(para);
    bufferWords += words.length;
  }

  flush();
  return chunks;
}

/**
 * Create a structured Notebook source with word count and stable chunks.
 * @param {object} opts
 */
export function createNotebookSource({
  id = `src_${uid()}`,
  title = 'Untitled Source',
  type = 'paste',
  rawText = '',
  topicId = null,
  thumbnail = null,
  sourceIndex = 1
} = {}) {
  const cleanText = String(rawText || '').trim();
  const chunks = chunkSourceText(id, cleanText, sourceIndex);
  return {
    id,
    title: String(title || 'Untitled Source').trim(),
    type, // 'paste' | 'file' | 'topic-notes' | 'image'
    topicId: topicId || null,
    included: true,
    wordCount: countWords(cleanText),
    thumbnail: thumbnail || null,
    rawText: cleanText,
    chunks,
    createdAt: new Date().toISOString()
  };
}

/**
 * Extract citation references matching `[src_id#c1]` or `[S1·C1]` from a model answer.
 * @param {string} text
 * @param {Array} allChunks
 */
export function extractCitationsFromText(text, allChunks = []) {
  if (!text || !allChunks.length) return [];
  const byId = new Map(allChunks.map((c) => [c.id, c]));
  const byLabel = new Map(allChunks.map((c) => [c.label, c]));
  const found = new Map();

  const bracketRe = /\[([^\]]+)\]/g;
  let m;
  while ((m = bracketRe.exec(text)) !== null) {
    const tokens = m[1].split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
    for (const tok of tokens) {
      const chunk = byId.get(tok) || byLabel.get(tok);
      if (chunk && !found.has(chunk.id)) {
        found.set(chunk.id, {
          chunkId: chunk.id,
          sourceId: chunk.sourceId,
          label: chunk.label,
          quote: chunk.text.slice(0, 140)
        });
      }
    }
  }
  return Array.from(found.values());
}
