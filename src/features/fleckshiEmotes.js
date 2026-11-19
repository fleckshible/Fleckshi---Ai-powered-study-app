export const FLECKSHI_SPRITE_URL = './assets/fleckshi/fleckshi-emotes-source.png';

export const FLECKSHI_GRID = {
  cols: 8,
  rows: 4
};

const EMOTE_ROWS = [
  ['Idle', 'Happy', 'Excited', 'Wink', 'Cheerful', 'Curious', 'Thinking', 'Confused'],
  ['Surprised', 'Shocked', 'Blushing', 'Embarrassed', 'Pouting', 'Angry', 'Annoyed', 'Tired'],
  ['Sleepy', 'Sleeping', 'Relaxed', 'Relieved', 'Pleased', 'Proud', 'Eating', 'Drinking'],
  ['Focused', 'Working', 'Helping', 'Success', 'Error', 'Loading', 'Info', 'Waiting']
];

export const FLECKSHI_EMOTES = Object.freeze(
  EMOTE_ROWS.reduce((acc, rowLabels, row) => {
    rowLabels.forEach((label, col) => {
      acc[label.toLowerCase()] = Object.freeze({ col, row, label });
    });
    return acc;
  }, {})
);

let cachedProbePromise = null;

/**
 * Look up grid metadata for a Fleckshi expression, defaulting safely to Idle.
 * @param {string} name
 * @returns {{ col: number, row: number, label: string }}
 */
export function getEmoteSpec(name) {
  const key = typeof name === 'string' ? name.trim().toLowerCase() : '';
  return FLECKSHI_EMOTES[key] || FLECKSHI_EMOTES.idle;
}

/**
 * Compute CSS percentage `background-position` coordinates for an 8x4 sprite sheet
 * sized with `background-size: 800% 400%`.
 * @param {string} name
 * @returns {{ xPct: number, yPct: number }}
 */
export function getEmoteBackgroundPosition(name) {
  const spec = getEmoteSpec(name);
  const maxCol = Math.max(1, FLECKSHI_GRID.cols - 1);
  const maxRow = Math.max(1, FLECKSHI_GRID.rows - 1);
  return {
    xPct: (spec.col / maxCol) * 100,
    yPct: (spec.row / maxRow) * 100
  };
}

/**
 * Probe once per session whether `./assets/fleckshi/fleckshi-emotes-source.png`
 * exists and decodes cleanly in the browser. Never polls.
 * @returns {Promise<{ available: boolean, width: number, height: number, cellAspect: number }>}
 */
export function probeFleckshiSprite() {
  if (cachedProbePromise) return cachedProbePromise;

  if (typeof Image === 'undefined') {
    cachedProbePromise = Promise.resolve({
      available: false,
      width: 0,
      height: 0,
      cellAspect: 1
    });
    return cachedProbePromise;
  }

  cachedProbePromise = new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const width = Number(img.naturalWidth) || 0;
      const height = Number(img.naturalHeight) || 0;
      if (width > 0 && height > 0) {
        const cellW = width / FLECKSHI_GRID.cols;
        const cellH = height / FLECKSHI_GRID.rows;
        resolve({
          available: true,
          width,
          height,
          cellAspect: cellH > 0 ? cellW / cellH : 1
        });
      } else {
        resolve({ available: false, width: 0, height: 0, cellAspect: 1 });
      }
    };
    img.onerror = () => {
      resolve({ available: false, width: 0, height: 0, cellAspect: 1 });
    };
    img.src = FLECKSHI_SPRITE_URL;
  });

  return cachedProbePromise;
}
