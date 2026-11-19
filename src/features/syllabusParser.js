/**
 * Offline rule-based syllabus splitter.
 * Exposes a pluggable async `SyllabusSplitter` interface so an AI/Gemini splitter
 * can be swapped in later without changing the import UI.
 */

export const offlineRuleSplitter = {
  id: 'offline-rules',
  name: 'Offline Line & Bullet Parser',

  /**
   * Parse pasted syllabus text into clean topic strings.
   * Handles bullets (-, *, •, ▪, –), numbered lists (1., 1), (1)), and blank lines.
   * @param {string} rawText
   * @returns {Promise<string[]>}
   */
  async split(rawText) {
    if (!rawText || typeof rawText !== 'string') return [];

    const lines = rawText.split(/\r?\n/);
    const seen = new Set();
    const topics = [];

    for (const rawLine of lines) {
      let line = rawLine.trim();
      if (!line) continue;

      // Strip common list prefixes: bullets, checkboxes, numbering
      line = line
        .replace(/^[-*•▪–—+]+\s*/, '')
        .replace(/^\[[ xX]?\]\s*/, '')
        .replace(/^\(?\d+[.)]\s*/, '')
        .replace(/^[a-zA-Z][.)]\s+/, '')
        .replace(/\s+/g, ' ')
        .trim();

      if (!line || line.length < 2) continue;

      const key = line.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        topics.push(line);
      }
    }

    return topics;
  }
};

let activeSplitter = offlineRuleSplitter;

export function setSyllabusSplitter(splitter) {
  if (splitter && typeof splitter.split === 'function') {
    activeSplitter = splitter;
  }
}

export async function parseSyllabusText(rawText) {
  return activeSplitter.split(rawText);
}
