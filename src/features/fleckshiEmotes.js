export const FLECKSHI_ASSET_BASE = './assets/fleckshi-emotes-clean';
export const FLECKSHI_SPRITE_URL = './assets/fleckshi-emotes-clean/fleckshi-emotes-atlas.png';

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
      const key = label.toLowerCase();
      acc[key] = Object.freeze({
        key,
        col,
        row,
        label,
        src: `${FLECKSHI_ASSET_BASE}/${key}.png`
      });
    });
    return acc;
  }, {})
);

let cachedProbePromise = null;

/**
 * Look up metadata & individual PNG path for a Fleckshi expression, defaulting to Idle.
 * @param {string} name
 * @returns {{ key: string, col: number, row: number, label: string, src: string }}
 */
export function getEmoteSpec(name) {
  const key = typeof name === 'string' ? name.trim().toLowerCase() : '';
  return FLECKSHI_EMOTES[key] || FLECKSHI_EMOTES.idle;
}

/**
 * Return the URL for an individual transparent expression PNG.
 * @param {string} name
 * @returns {string}
 */
export function getEmoteImageUrl(name) {
  return getEmoteSpec(name).src;
}

/**
 * Probe once per session whether `./assets/fleckshi-emotes-clean/idle.png`
 * exists and decodes cleanly in the browser. Never polls.
 * @returns {Promise<{ available: boolean, width: number, height: number }>}
 */
export function probeFleckshiSprite() {
  if (cachedProbePromise) return cachedProbePromise;

  if (typeof Image === 'undefined') {
    cachedProbePromise = Promise.resolve({ available: false, width: 0, height: 0 });
    return cachedProbePromise;
  }

  cachedProbePromise = new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      const width = Number(img.naturalWidth) || 0;
      const height = Number(img.naturalHeight) || 0;
      resolve(width > 0 && height > 0 ? { available: true, width, height } : { available: false, width: 0, height: 0 });
    };
    img.onerror = () => {
      resolve({ available: false, width: 0, height: 0 });
    };
    img.src = FLECKSHI_EMOTES.idle.src;
  });

  return cachedProbePromise;
}
